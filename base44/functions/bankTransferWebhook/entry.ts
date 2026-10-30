import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let i = 0; i < left.length; i++) mismatch |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return mismatch === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyPlaidWebhook(rawBody: string, token: string, clientId: string, secret: string, apiBase: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if (header.alg !== 'ES256' || typeof header.kid !== 'string' ||
        !Number.isFinite(payload.iat) || typeof payload.request_body_sha256 !== 'string') return false;

    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + 30 || now - payload.iat > 300) return false;

    const keyResponse = await fetch(`${apiBase}/webhook_verification_key/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, key_id: header.kid }),
    });
    if (!keyResponse.ok) return false;
    const keyPayload = await keyResponse.json();
    const jwk = keyPayload?.key;
    if (!jwk || jwk.kid !== header.kid || jwk.alg !== 'ES256' || jwk.crv !== 'P-256') return false;

    const publicKey = await crypto.subtle.importKey(
      'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'],
    );
    const validSignature = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      decodeBase64Url(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!validSignature) return false;

    const actualHash = await sha256Hex(rawBody);
    return constantTimeEqual(actualHash, payload.request_body_sha256.toLowerCase());
  } catch {
    return false;
  }
}

export default async function(req: Request): Promise<Response> {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const clientId = Deno.env.get('PLAID_CLIENT_ID');
  const secret = Deno.env.get('PLAID_SECRET');
  const environment = Deno.env.get('PLAID_ENV');
  if (!clientId || !secret || !['sandbox', 'production'].includes(environment || '')) {
    return Response.json({ error: 'Plaid webhook verification is not configured. No event was accepted.' }, { status: 503 });
  }

  try {
    const rawBody = await req.text();
    const verificationToken = req.headers.get('plaid-verification') || '';
    const apiBase = environment === 'production' ? 'https://production.plaid.com' : 'https://sandbox.plaid.com';
    if (!await verifyPlaidWebhook(rawBody, verificationToken, clientId, secret, apiBase)) {
      return Response.json({ error: 'Plaid webhook verification failed.' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const webhookType = typeof payload.webhook_type === 'string' ? payload.webhook_type : '';
    const webhookCode = typeof payload.webhook_code === 'string' ? payload.webhook_code : '';
    const itemId = typeof payload.item_id === 'string' ? payload.item_id : '';
    if (webhookType !== 'TRANSFER' || webhookCode !== 'TRANSFER_EVENTS_UPDATE' || !itemId) {
      return Response.json({ accepted: true, ignored: true }, { status: 200 });
    }

    const base44 = createClientFromRequest(req);
    // Plaid's webhook contains only a notification. The authoritative event details
    // must be fetched from /transfer/event/sync; never treat this ping as a payment event.
    const sync = await base44.asServiceRole.functions.invoke('syncPlaidTransferEvents', {});
    return Response.json({
      accepted: true,
      sync_triggered: true,
      sync,
      message: 'Webhook signature verified and authoritative Plaid event sync triggered.',
    }, { status: 200 });
  } catch {
    return Response.json({ error: 'Plaid webhook could not be accepted.' }, { status: 400 });
  }
}
