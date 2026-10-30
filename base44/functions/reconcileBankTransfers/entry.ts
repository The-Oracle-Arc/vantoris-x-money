import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const STAFF_ROLES = new Set([
  'admin', 'administrator', 'super_administrator', 'executive',
  'operations_officer', 'operations_manager', 'finance_officer',
  'treasury_officer', 'compliance_officer', 'auditor',
]);
const STATUS_MAP: Record<string, string> = {
  submitted: 'submitted_to_bank',
  posted: 'submitted_to_bank',
  pending: 'pending_settlement',
  settled: 'settled',
  failed: 'failed',
  returned: 'returned',
  cancelled: 'cancelled',
};

export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const staff = await base44.auth.me();
    if (!staff?.id || !STAFF_ROLES.has(staff.role)) {
      return Response.json({ error: 'Authorized staff only.' }, { status: 403 });
    }

    const providerId = Deno.env.get('AVCU_BANK_PROVIDER_ID') || (Deno.env.get('PLAID_CLIENT_ID') ? 'plaid' : '');
    if (!providerId) return Response.json({ error: 'No production banking provider is configured.' }, { status: 503 });

    const body = await req.json().catch(() => null);
    const limit = Number.isInteger(body?.limit) ? Math.min(Math.max(body.limit, 1), 100) : 50;
    const events = await base44.asServiceRole.entities.TransferWebhookEvent.filter({
      provider_id: providerId, processed: false,
    });
    let processed = 0;
    let unmatched = 0;
    let held = 0;

    for (const event of (events || []).filter((e:any) => e.signature_verified === true || e.provider_api_verified === true).slice(0, limit)) {
      const claim = await base44.asServiceRole.entities.TransferWebhookEvent.updateMany(
        { id: event.id, processed: false, processing: false },
        { $set: { processing: true, processing_started_at: new Date().toISOString() } },
      );
      if (!claim?.success || claim.updated !== 1) { held++; continue; }
      const release = async (reason:string) => {
        await base44.asServiceRole.entities.TransferWebhookEvent.updateMany(
          { id: event.id, processed: false, processing: true },
          { $set: { processing: false, processing_error: reason } },
        );
      };
      const status = STATUS_MAP[event.provider_status];
      if (!status) { held++; await release('Unsupported provider event status'); continue; }
      const filters = event.transfer_id
        ? { provider_transfer_id: event.transfer_id, provider_id: providerId }
        : { bank_reference: event.bank_reference, provider_id: providerId };
      const matches = await base44.asServiceRole.entities.TransferRequest.filter(filters);
      if (!matches?.length) { unmatched++; await release('No matching transfer request'); continue; }
      const transfer = matches[0];
      if (matches.length === 1 && Number.isSafeInteger(event.provider_event_sequence) &&
          Number.isSafeInteger(transfer.webhook_last_event_sequence) &&
          event.provider_event_sequence <= transfer.webhook_last_event_sequence) {
        await base44.asServiceRole.entities.TransferWebhookEvent.update(event.id, {
          processed: true, processing: false, processed_at: new Date().toISOString(), processing_error: 'Older or replayed provider event ignored.',
        });
        processed++;
        continue;
      }
      if (matches.length !== 1 || transfer.amount_cents !== event.amount_cents ||
          transfer.currency !== event.currency || transfer.rail === 'INTERNAL') {
        held++;
        await release('Transfer match is ambiguous or amount/currency/rail did not match');
        continue;
      }
      if (!['approved_awaiting_bank_submission', 'submitting_to_bank', 'submission_unknown', 'submitted_to_bank', 'pending_settlement', 'settled', 'returned', 'failed', 'cancelled'].includes(transfer.status)) {
        held++;
        await release('Transfer state is not eligible for this provider event');
        continue;
      }

      const applied = await base44.asServiceRole.entities.TransferRequest.updateMany(
        { id: transfer.id, status: transfer.status },
        { $set: {
          status,
          provider_id: providerId,
          provider_transfer_id: event.transfer_id || transfer.provider_transfer_id || '',
          bank_reference: event.bank_reference || transfer.bank_reference || '',
          webhook_last_event_id: event.provider_event_id,
          ...(Number.isSafeInteger(event.provider_event_sequence) ? { webhook_last_event_sequence: event.provider_event_sequence } : {}),
          ...(status === 'settled' ? { settled_at: new Date().toISOString() } : {}),
        } },
      );
      if (!applied?.success || applied.updated !== 1) { held++; await release('Transfer state changed concurrently'); continue; }
      await base44.asServiceRole.entities.TransferWebhookEvent.update(event.id, {
        processed: true, processing: false, processed_at: new Date().toISOString(), processing_error: '',
      });
      await base44.asServiceRole.entities.AuditLog.create({
        action_type: 'bank_transfer_reconciled',
        description: `Verified bank event reconciled for ${transfer.rail}`,
        details: JSON.stringify({
          transferRequestId: transfer.id,
          providerEventId: event.provider_event_id,
          providerStatus: event.provider_status,
          resultingStatus: status,
          bankReference: event.bank_reference || '',
        }),
        target_user_id: transfer.user_id,
        user_id: staff.id,
      });
      processed++;
    }

    return Response.json({ processed, unmatched, held, scanned: Math.min((events || []).length, limit) });
  } catch {
    return Response.json({ error: 'Reconciliation failed. No unverified event was applied.' }, { status: 500 });
  }
}
