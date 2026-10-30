import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getTransferRailAdapter } from '../_shared/transferRails.ts';

const SUBMIT_ROLES = new Set(['admin', 'administrator', 'super_administrator', 'finance_officer', 'treasury_officer']);
export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const staff = await base44.auth.me();
    if (!staff?.id || !SUBMIT_ROLES.has(staff.role)) {
      return Response.json({ error: 'Authorized finance or treasury staff only.' }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    const requestId = typeof body?.request_id === 'string' ? body.request_id.trim() : '';
    if (!requestId) return Response.json({ error: 'Transfer request ID is required.' }, { status: 400 });

    const transfer = await base44.asServiceRole.entities.TransferRequest.get(requestId);
    if (!transfer) return Response.json({ error: 'Transfer request not found.' }, { status: 404 });
    if (transfer.status !== 'approved_awaiting_bank_submission') {
      return Response.json({ error: 'Transfer has not completed the required review approvals.' }, { status: 409 });
    }
    if (transfer.rail === 'FEDWIRE' &&
        (!transfer.reviewer_user_id || !transfer.approver_user_id ||
         transfer.reviewer_user_id === transfer.approver_user_id)) {
      return Response.json({ error: 'Wire requires two distinct staff approvals.' }, { status: 403 });
    }
    if (!transfer.beneficiary_account_token) {
      return Response.json({ error: 'A provider-issued beneficiary account token is required. No bank request was sent.' }, { status: 503 });
    }

    const rail = transfer.rail === 'ACH' ? 'ACH' : transfer.rail === 'FEDWIRE' ? 'FEDWIRE' : null;
    if (!rail) return Response.json({ error: 'Unsupported transfer rail. No bank request was sent.' }, { status: 400 });
    const adapter = getTransferRailAdapter(rail);
    const result = await adapter.submit({
      transferRequestId: transfer.id,
      amountCents: transfer.amount_cents,
      currency: 'USD',
      idempotencyKey: transfer.idempotency_key,
      beneficiary: {
        name: transfer.beneficiary_name,
        bankName: transfer.beneficiary_bank_name,
        routingNumber: transfer.beneficiary_routing_number,
        accountToken: transfer.beneficiary_account_token,
        accountLast4: transfer.beneficiary_account_last4,
      },
      memo: transfer.memo,
    });
    if (!result?.bankReference || !result.providerId) {
      return Response.json({ error: 'Provider did not return a valid bank reference. Transfer status was not advanced.' }, { status: 502 });
    }
    await base44.asServiceRole.entities.TransferRequest.update(transfer.id, {
      status: result.status === 'pending' ? 'pending_settlement' : 'submitted_to_bank',
      provider_id: result.providerId,
      bank_reference: result.bankReference,
      submitted_at: result.acceptedAt,
    });
    return Response.json({ submitted: true, bank_reference: result.bankReference, status: result.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transfer provider unavailable.';
    return Response.json({ error: message, execution: 'not_submitted' }, { status: 503 });
  }
}
