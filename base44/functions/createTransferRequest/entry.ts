import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MAX_AMOUNT_CENTS = 100000000;
const RAILS = new Set(['ACH', 'FEDWIRE', 'INTERNAL']);
const textField = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  try {
    const base44 = createClientFromRequest(req);
    const member = await base44.auth.me();
    if (!member?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return Response.json({ error: 'A valid JSON object is required' }, { status: 400 });
    }
    const rail = body.rail;
    const sourceAccountId = textField(body.source_account_id, 128);
    const beneficiaryName = textField(body.beneficiary_name, 120);
    const routing = textField(body.beneficiary_routing_number, 9);
    const accountLast4 = textField(body.beneficiary_account_last4, 4);
    const bankName = textField(body.beneficiary_bank_name, 120);
    const memo = textField(body.memo, 140);
    const key = textField(body.idempotency_key, 100);
    const cents = body.amount_cents;

    if (!RAILS.has(rail) || rail === 'INTERNAL') {
      return Response.json({ error: 'Only ACH and domestic Fedwire requests are accepted by this intake endpoint.' }, { status: 400 });
    }
    if (!sourceAccountId || !beneficiaryName || !bankName ||
        !/^\d{9}$/.test(routing) || !/^\d{4}$/.test(accountLast4) ||
        !Number.isSafeInteger(cents) || cents < 1 || cents > MAX_AMOUNT_CENTS ||
        !/^[A-Za-z0-9._:-]{16,100}$/.test(key)) {
      return Response.json({ error: 'Check the source account, beneficiary, 9-digit routing number, account last four, amount, and idempotency key.' }, { status: 400 });
    }

    const account = await base44.asServiceRole.entities.Account.get(sourceAccountId);
    if (!account || account.user_id !== member.id || account.status !== 'active') {
      return Response.json({ error: 'The selected source account is unavailable.' }, { status: 404 });
    }

    const existing = await base44.asServiceRole.entities.TransferRequest.filter({
      user_id: member.id,
      idempotency_key: key,
    });
    if (existing?.length) {
      return Response.json({ request: existing[0], duplicate: true }, { status: 200 });
    }

    const request = await base44.asServiceRole.entities.TransferRequest.create({
      user_id: member.id,
      source_account_id: sourceAccountId,
      rail,
      direction: 'outgoing',
      amount_cents: cents,
      currency: 'USD',
      beneficiary_name: beneficiaryName,
      beneficiary_bank_name: bankName,
      beneficiary_routing_number: routing,
      beneficiary_account_last4: accountLast4,
      memo,
      idempotency_key: key,
      status: 'awaiting_bank_review',
    });

    await Promise.allSettled([
      base44.asServiceRole.entities.Notification.create({
        user_id: member.id,
        title: 'Transfer request received',
        message: 'Your transfer request is recorded for bank and operations review. No funds have been moved.',
        type: 'info',
        read: false,
      }),
      base44.asServiceRole.entities.AuditLog.create({
        action_type: 'transfer_request_created',
        description: `Member submitted an outgoing ${rail} transfer request`,
        details: JSON.stringify({ transferRequestId: request.id, amount_cents: cents, currency: 'USD' }),
        target_user_id: member.id,
        user_id: member.id,
      }),
    ]);

    return Response.json({
      request,
      execution: 'not_submitted',
      message: 'Request recorded. It has not been sent to a bank and no balance was debited.',
    }, { status: 201 });
  } catch {
    return Response.json({ error: 'Transfer request could not be recorded. No transfer execution is confirmed.' }, { status: 500 });
  }
}
