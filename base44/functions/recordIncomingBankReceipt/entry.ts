import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const RECORD_ROLES = new Set(['admin','administrator','super_administrator','executive','operations_officer','operations_manager','finance_officer','treasury_officer','compliance_officer']);
const VERIFY_ROLES = new Set(['admin','administrator','super_administrator','finance_officer','treasury_officer','compliance_officer']);
const clean = (v: unknown, max = 500) => typeof v === 'string' ? v.trim().slice(0,max) : '';

export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({error:'Method not allowed'},{status:405});
  try {
    const base44=createClientFromRequest(req);
    const staff=await base44.auth.me();
    if(!staff?.id || !RECORD_ROLES.has(staff.role)) return Response.json({error:'Authorized staff only.'},{status:403});
    const body=await req.json().catch(()=>null);
    const action=clean(body?.action,32);
    const now=new Date().toISOString();

    if(action==='record_receipt'){
      const accountId=clean(body?.account_id,128);
      const memberUserId=clean(body?.member_user_id,128);
      const rail=clean(body?.rail,16);
      const bankReference=clean(body?.bank_reference,120);
      const evidence=clean(body?.evidence_reference,500);
      const idempotencyKey=clean(body?.idempotency_key,100);
      const amount=body?.amount_cents;
      const note=clean(body?.note,500);
      if(!accountId||!memberUserId||!['ACH','FEDWIRE'].includes(rail)||!bankReference||!evidence||
         !/^[A-Za-z0-9._:-]{16,100}$/.test(idempotencyKey)||!Number.isSafeInteger(amount)||amount<1||amount>100000000){
        return Response.json({error:'Account, member, ACH/Fedwire rail, amount, bank reference, evidence locator and idempotency key are required.'},{status:400});
      }
      const account=await base44.asServiceRole.entities.Account.get(accountId);
      if(!account||account.user_id!==memberUserId||account.status!=='active') return Response.json({error:'Target member account is unavailable or does not belong to that member.'},{status:404});
      const duplicate=await base44.asServiceRole.entities.IncomingBankReceipt.filter({idempotency_key:idempotencyKey});
      if(duplicate?.length) return Response.json({receipt:{id:duplicate[0].id,status:duplicate[0].status},duplicate:true,ledger_posted:false},{status:200});
      const sameReference=await base44.asServiceRole.entities.IncomingBankReceipt.filter({rail,bank_reference:bankReference});
      if(sameReference?.length) return Response.json({error:'This bank reference is already recorded. Review the existing receipt; do not create another.'},{status:409});
      const receipt=await base44.asServiceRole.entities.IncomingBankReceipt.create({
        member_user_id:memberUserId,account_id:accountId,rail,amount_cents:amount,currency:'USD',
        bank_reference:bankReference,idempotency_key:idempotencyKey,evidence_reference:evidence,
        status:'awaiting_verification',recorded_by_user_id:staff.id,recorded_at:now,record_note:note,
        ledger_posting_status:'not_posted'
      });
      await base44.asServiceRole.entities.AuditLog.create({
        action_type:'incoming_bank_receipt_recorded',
        description:`Manual incoming ${rail} receipt recorded pending independent verification`,
        details:JSON.stringify({receiptId:receipt.id,memberUserId,accountId,amountCents:amount,bankReference,evidenceReference:evidence,staffUserId:staff.id}),
        target_user_id:memberUserId,user_id:staff.id
      });
      await base44.asServiceRole.entities.Notification.create({
        user_id:memberUserId,title:'Incoming payment under verification',
        message:'AVCU recorded an incoming bank payment for verification. Your available balance has not been credited.',
        type:'info',read:false
      });
      return Response.json({receipt:{id:receipt.id,status:receipt.status,bank_reference:receipt.bank_reference},ledger_posted:false,message:'Receipt evidence recorded. Funds have not been credited.'},{status:201});
    }

    if(!['verify_received','record_return','reject_receipt'].includes(action)) return Response.json({error:'Valid action is required.'},{status:400});
    if(!VERIFY_ROLES.has(staff.role)) return Response.json({error:'A finance, treasury, compliance or administrator verifier is required.'},{status:403});
    const receiptId=clean(body?.receipt_id,128);
    const evidence=clean(body?.evidence_reference,500);
    const note=clean(body?.note,500);
    if(!receiptId||!evidence) return Response.json({error:'Receipt ID and independent bank evidence reference are required.'},{status:400});
    const receipt=await base44.asServiceRole.entities.IncomingBankReceipt.get(receiptId);
    if(!receipt) return Response.json({error:'Incoming receipt not found.'},{status:404});
    if(receipt.status!=='awaiting_verification') return Response.json({error:'Receipt is no longer awaiting verification.'},{status:409});
    if(receipt.recorded_by_user_id===staff.id) return Response.json({error:'The verifier must be a different staff member from the person who recorded the receipt.'},{status:403});
    const next=action==='verify_received'?'verified_received':action==='record_return'?'returned':'rejected';
    const claim=await base44.asServiceRole.entities.IncomingBankReceipt.updateMany(
      {id:receiptId,status:'awaiting_verification'},
      {$set:{status:next,verified_by_user_id:staff.id,verified_at:now,verification_evidence_reference:evidence,verification_note:note}}
    );
    if(!claim?.success||claim.updated!==1) return Response.json({error:'Another staff member changed this receipt. Refresh before retrying.'},{status:409});
    await base44.asServiceRole.entities.AuditLog.create({
      action_type:`incoming_bank_receipt_${action}`,
      description:`Incoming ${receipt.rail} receipt independently ${next}`,
      details:JSON.stringify({receiptId,memberUserId:receipt.member_user_id,amountCents:receipt.amount_cents,bankReference:receipt.bank_reference,recorderUserId:receipt.recorded_by_user_id,verifierUserId:staff.id,evidenceReference:evidence}),
      target_user_id:receipt.member_user_id,user_id:staff.id
    });
    await base44.asServiceRole.entities.Notification.create({
      user_id:receipt.member_user_id,
      title:next==='verified_received'?'Incoming payment verified':'Incoming payment exception',
      message:next==='verified_received'?'The bank receipt evidence was independently verified. Your account balance is not yet credited by this workflow.':'The incoming payment requires follow-up with AVCU support.',
      type:next==='verified_received'?'info':'warning',read:false
    });
    return Response.json({receipt:{id:receiptId,status:next},ledger_posted:false,message:next==='verified_received'?'Receipt evidence verified. Ledger posting remains a separate controlled step.':'Receipt exception recorded. No account balance was changed.'});
  } catch {
    return Response.json({error:'Incoming receipt action failed. No member balance was changed.'},{status:500});
  }
}
