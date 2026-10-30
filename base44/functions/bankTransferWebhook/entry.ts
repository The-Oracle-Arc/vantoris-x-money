import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyHmac(rawBody: string, supplied: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const normalized = supplied.replace(/^sha256=/i, '').trim().toLowerCase();
  const expected = toHex(digest);
  if (!/^[a-f0-9]{64}$/.test(normalized) || normalized.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ normalized.charCodeAt(i);
  return mismatch === 0;
}

export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const providerId = Deno.env.get('AVCU_BANK_PROVIDER_ID');
  const secret = Deno.env.get('AVCU_BANK_WEBHOOK_SECRET');
  if (!providerId || !secret) {
    return Response.json({ error: 'Bank webhook is not configured. No event was accepted.' }, { status: 503 });
  }
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-avcu-signature') || '';
    if (!await verifyHmac(rawBody, signature, secret)) {
      return Response.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const eventType = typeof payload.type === 'string' ? payload.type.trim() : '';
    const transfer = payload.data && typeof payload.data === 'object' ? payload.data : {};
    const transferId = typeof transfer.transfer_id === 'string' ? transfer.transfer_id.trim() : '';
    const bankReference = typeof transfer.bank_reference === 'string' ? transfer.bank_reference.trim() : '';
    const amountCents = transfer.amount_cents;
    if (!eventId || !eventType || (!transferId && !bankReference) ||
        !Number.isSafeInteger(amountCents) || amountCents < 1 || transfer.currency !== 'USD') {
      return Response.json({ error: 'Webhook payload is incomplete or invalid.' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const existing = await base44.asServiceRole.entities.TransferWebhookEvent.filter({
      provider_id: providerId, provider_event_id: eventId,
    });
    if (existing?.length) return Response.json({ accepted: true, duplicate: true }, { status: 200 });

    await base44.asServiceRole.entities.TransferWebhookEvent.create({
      provider_id: providerId,
      provider_event_id: eventId,
      event_type: eventType,
      transfer_id: transferId,
      bank_reference: bankReference,
      amount_cents: amountCents,
      currency: 'USD',
      provider_status: typeof transfer.status === 'string' ? transfer.status : '',
      signature_verified: true,
      processed: false,
      received_at: new Date().toISOString(),
    });
    return Response.json({ accepted: true, processed: false, message: 'Signature verified. Event stored for reconciliation.' }, { status: 202 });
  } catch {
    return Response.json({ error: 'Webhook could not be accepted.' }, { status: 400 });
  }
}
