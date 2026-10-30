import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ROLES=new Set(['admin','administrator','super_administrator','finance_officer','treasury_officer','compliance_officer','auditor']);
const toCents=(value:unknown):number|null=>{
  if(typeof value!=='string'&&typeof value!=='number') return null;
  const n=Number(value);
  if(!Number.isFinite(n)||n<=0) return null;
  const cents=Math.round(n*100);
  return Number.isSafeInteger(cents)?cents:null;
};

export default async function(req:Request):Promise<Response>{
  if(req.method!=='POST') return Response.json({error:'Method not allowed'},{status:405});
  const base44=createClientFromRequest(req);
  let state:any=null;
  try{
    const staff=await base44.auth.me();
    if(!staff?.id||!ROLES.has(staff.role)) return Response.json({error:'Authorized finance/treasury staff only.'},{status:403});
    const clientId=Deno.env.get('PLAID_CLIENT_ID');
    const secret=Deno.env.get('PLAID_SECRET');
    const environment=Deno.env.get('PLAID_ENV');
    if(!clientId||!secret||!['sandbox','production'].includes(environment||'')) return Response.json({error:'Plaid credentials and environment are not configured.'},{status:503});
    const apiBase=environment==='production'?'https://production.plaid.com':'https://sandbox.plaid.com';
    const states=await base44.asServiceRole.entities.PlaidTransferSyncState.filter({provider_id:'plaid',environment});
    state=states?.[0]||null;
    if(!state){
      state=await base44.asServiceRole.entities.PlaidTransferSyncState.create({provider_id:'plaid',environment,after_id:0,syncing:false});
    }
    const lock=await base44.asServiceRole.entities.PlaidTransferSyncState.updateMany(
      {id:state.id,syncing:false},
      {$set:{syncing:true,last_error:''}}
    );
    if(!lock?.success||lock.updated!==1) return Response.json({error:'A Plaid event sync is already running. Retry after it finishes.'},{status:409});
    const afterId=Number.isSafeInteger(state.after_id)?state.after_id:0;
    const response=await fetch(`${apiBase}/transfer/event/sync`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({client_id:clientId,secret,after_id:afterId,count:500})
    });
    const payload=await response.json();
    if(!response.ok) throw new Error(payload?.error_message||payload?.display_message||'Plaid event sync request failed.');
    const events=Array.isArray(payload.transfer_events)?payload.transfer_events:[];
    let inserted=0,duplicates=0,held=0;
    let highest=afterId;
    for(const event of events){
      if(!Number.isSafeInteger(event.event_id)||event.event_id<=afterId||typeof event.transfer_id!=='string'||typeof event.event_type!=='string'){
        held++; continue;
      }
      highest=Math.max(highest,event.event_id);
      const cents=toCents(event.transfer_amount);
      if(!cents){held++;continue;}
      const providerEventId=`plaid-transfer-event:${event.event_id}`;
      const prior=await base44.asServiceRole.entities.TransferWebhookEvent.filter({provider_id:'plaid',provider_event_id:providerEventId});
      if(prior?.length){duplicates++;continue;}
      await base44.asServiceRole.entities.TransferWebhookEvent.create({
        provider_id:'plaid',provider_event_id:providerEventId,
        event_type:`TRANSFER.${event.event_type}`,webhook_type:'TRANSFER',webhook_code:'TRANSFER_EVENTS_UPDATE',
        transfer_id:event.transfer_id,amount_cents:cents,currency:'USD',
        provider_status:event.event_type,provider_event_sequence:event.event_id,
        event_timestamp:event.timestamp||'',transfer_type:event.transfer_type||'',
        account_id:event.account_id||'',failure_reason:event.failure_reason?.description||'',
        environment,signature_verified:false,provider_api_verified:true,processed:false,received_at:new Date().toISOString()
      });
      inserted++;
    }
    const update=await base44.asServiceRole.entities.PlaidTransferSyncState.updateMany(
      {id:state.id,syncing:true,after_id:afterId},
      {$set:{after_id:highest,syncing:false,last_synced_at:new Date().toISOString(),last_error:''}}
    );
    if(!update?.success||update.updated!==1) throw new Error('Could not safely commit Plaid event cursor.');
    return Response.json({inserted,duplicates,held,after_id:highest,has_more:payload.has_more===true,environment,message:'Events were fetched from Plaid and durably queued. Run bank reconciliation to apply verified status changes.'});
  }catch(error){
    if(state?.id){
      await base44.asServiceRole.entities.PlaidTransferSyncState.updateMany(
        {id:state.id,syncing:true},
        {$set:{syncing:false,last_error:error instanceof Error?error.message:'Unknown sync error'}}
      ).catch(()=>{});
    }
    return Response.json({error:'Plaid event sync failed; cursor was not intentionally advanced.',detail:error instanceof Error?error.message:'Unknown error'},{status:502});
  }
}
