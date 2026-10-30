import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const STAFF_ROLES = new Set([
  'admin', 'administrator', 'super_administrator', 'executive',
  'operations_officer', 'operations_manager', 'finance_officer',
  'treasury_officer', 'compliance_officer', 'auditor',
]);
const STATUS_MAP: Record<string, string> = {
  submitted: 'submitted_to_bank',
  pending: 'pending_settlement',
  settled: 'settled',
  failed: 'failed',
  returned: 'returned',
};

export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const staff = await base44.auth.me();
    if (!staff?.id || !STAFF_ROLES.has(staff.role)) {
      return Response.json({ error: 'Authorized staff only.' }, { status: 403 });
    }

    const providerId = Deno.env.get('AVCU_BANK_PROVIDER_ID');
    if (!providerId) return Response.json({ error: 'No production banking provider is configured.' }, { status: 503 });

    const body = await req.json().catch(() => null);
    const limit = Number.isInteger(body?.limit) ? Math.min(Math.max(body.limit, 1), 100) : 50;
    const events = await base44.asServiceRole.entities.TransferWebhookEvent.filter({
      provider_id: providerId, signature_verified: true, processed: false,
    });
    let processed = 0;
    let unmatched = 0;
    let held = 0;

    for (const event of (events || []).slice(0, limit)) {
      const status = STATUS_MAP[event.provider_status];
      if (!status) { held++; continue; }
      const filters = event.transfer_id
        ? { provider_transfer_id: event.transfer_id, provider_id: providerId }
        : { bank_reference: event.bank_reference, provider_id: providerId };
      const matches = await base44.asServiceRole.entities.TransferRequest.filter(filters);
      if (!matches?.length) { unmatched++; continue; }
      const transfer = matches[0];
      if (matches.length !== 1 || transfer.amount_cents !== event.amount_cents ||
          transfer.currency !== event.currency || transfer.rail === 'INTERNAL') {
        held++;
        continue;
      }
      if (!['approved_awaiting_bank_submission', 'submitted_to_bank', 'pending_settlement', 'settled'].includes(transfer.status)) {
        held++;
        continue;
      }

      await base44.asServiceRole.entities.TransferRequest.update(transfer.id, {
        status,
        provider_id: providerId,
        provider_transfer_id: event.transfer_id || transfer.provider_transfer_id || '',
        bank_reference: event.bank_reference || transfer.bank_reference || '',
        webhook_last_event_id: event.provider_event_id,
        ...(status === 'settled' ? { settled_at: new Date().toISOString() } : {}),
      });
      await base44.asServiceRole.entities.TransferWebhookEvent.update(event.id, {
        processed: true, processed_at: new Date().toISOString(), processing_error: '',
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
