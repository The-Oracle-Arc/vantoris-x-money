import postgres from 'npm:postgres@3.4.7';

type Sql = ReturnType<typeof postgres>;
type Tx = Parameters<Parameters<Sql['begin']>[0]>[0];

let client: Sql | null = null;

function database(): Sql {
  if (client) return client;
  const url = Deno.env.get('AVCU_LEDGER_DATABASE_URL');
  if (!url) throw new Error('AVCU_LEDGER_DATABASE_URL is not configured; payment-critical storage is unavailable.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('AVCU_LEDGER_DATABASE_URL must use PostgreSQL.');
  }
  client = postgres(url, {
    ssl: 'require',
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
  });
  return client;
}

const uuid = () => crypto.randomUUID();

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}

function requireText(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${label}`);
  return value.trim();
}

export interface OperationClaim {
  id: string;
  status: string;
  created: boolean;
}

/** A unique constraint, not a preflight lookup, arbitrates concurrent retries. */
export async function claimPaymentOperation(input: {
  operationType: string;
  idempotencyKey: string;
  request: unknown;
}): Promise<OperationClaim> {
  const operationType = requireText(input.operationType, 'operation type', 80);
  const idempotencyKey = requireText(input.idempotencyKey, 'idempotency key', 160);
  const requestHash = await sha256(input.request);
  return await database().begin(async tx => {
    const inserted = await tx`
      INSERT INTO avcu_payments.payment_operations
        (id, operation_type, idempotency_key, request_hash, status)
      VALUES
        (${uuid()}, ${operationType}, ${idempotencyKey}, ${requestHash}, 'accepted')
      ON CONFLICT (operation_type, idempotency_key) DO NOTHING
      RETURNING id, status
    `;
    if (inserted.length) return { id: inserted[0].id, status: inserted[0].status, created: true };
    const [prior] = await tx`
      SELECT id, status, request_hash FROM avcu_payments.payment_operations
       WHERE operation_type = ${operationType} AND idempotency_key = ${idempotencyKey}
       FOR UPDATE
    `;
    if (!prior) throw new Error('Idempotency claim disappeared; retry safely.');
    if (prior.request_hash !== requestHash) {
      throw new Error('IDEMPOTENCY_CONFLICT: this key was already used with a different request.');
    }
    return { id: prior.id, status: prior.status, created: false };
  });
}

/** Store an API-verified or signature-verified event. Duplicate IDs are harmless;
 * a reused provider ID with different payload is a hard integrity exception. */
export async function ingestProviderEvent(input: {
  providerId: string; environment: 'sandbox' | 'production'; providerEventId: string;
  transferReference?: string; eventType: string; eventSequence?: number;
  payload: unknown; verifiedAt: string;
}): Promise<{ id: string; duplicate: boolean }> {
  const hash = await sha256(input.payload);
  return await database().begin(async tx => {
    const rows = await tx`
      INSERT INTO avcu_payments.provider_events
        (id, provider_id, environment, provider_event_id, transfer_reference,
         event_type, event_sequence, payload_hash, verified_at)
      VALUES
        (${uuid()}, ${requireText(input.providerId,'provider ID',80)},
         ${input.environment}, ${requireText(input.providerEventId,'provider event ID',200)},
         ${input.transferReference || null}, ${requireText(input.eventType,'event type',120)},
         ${input.eventSequence ?? null}, ${hash}, ${input.verifiedAt})
      ON CONFLICT (provider_id, environment, provider_event_id) DO NOTHING
      RETURNING id
    `;
    if (rows.length) return { id: rows[0].id, duplicate: false };
    const [prior] = await tx`
      SELECT id, payload_hash FROM avcu_payments.provider_events
       WHERE provider_id = ${input.providerId} AND environment = ${input.environment}
         AND provider_event_id = ${input.providerEventId}
       FOR UPDATE
    `;
    if (!prior || prior.payload_hash !== hash) throw new Error('PROVIDER_EVENT_INTEGRITY_CONFLICT');
    return { id: prior.id, duplicate: true };
  });
}

export interface Lease {
  lockName: string; ownerId: string; fencingToken: number; expiresAt: string;
}
export async function acquireLease(lockName: string, ownerId = uuid(), ttlSeconds = 300): Promise<Lease | null> {
  const rows = await database()`SELECT * FROM avcu_payments.acquire_lease(${lockName}, ${ownerId}, ${ttlSeconds})`;
  const row = rows[0];
  return row?.acquired ? { lockName, ownerId, fencingToken: Number(row.fencing_token), expiresAt: row.expires_at } : null;
}
export async function renewLease(lease: Lease, ttlSeconds = 300): Promise<boolean> {
  const [row] = await database()`SELECT avcu_payments.renew_lease(${lease.lockName}, ${lease.ownerId}, ${lease.fencingToken}, ${ttlSeconds}) AS renewed`;
  return row?.renewed === true;
}
export async function releaseLease(lease: Lease): Promise<boolean> {
  const [row] = await database()`SELECT avcu_payments.release_lease(${lease.lockName}, ${lease.ownerId}, ${lease.fencingToken}) AS released`;
  return row?.released === true;
}

/** Fetch cursor, insert the entire Plaid page and advance cursor in one commit.
 * Call only after obtaining the matching provider/environment lease. */
export async function commitPlaidEventPage(input: {
  lease: Lease; environment: 'sandbox' | 'production'; expectedAfterId: number;
  events: Array<{ event_id: number; transfer_id: string; event_type: string; transfer_amount: number; timestamp?: string }>;
}): Promise<{ afterId: number; inserted: number; duplicates: number }> {
  return await database().begin(async tx => {
    const [lock] = await tx`SELECT avcu_payments.assert_lease(${input.lease.lockName}, ${input.lease.ownerId}, ${input.lease.fencingToken}) AS valid`;
    if (!lock?.valid) throw new Error('LEASE_FENCING_REJECTED');
    const [cursor] = await tx`
      SELECT after_id FROM avcu_payments.provider_cursors
       WHERE provider_id = 'plaid' AND environment = ${input.environment}
       FOR UPDATE
    `;
    const actual = Number(cursor?.after_id ?? 0);
    if (actual !== input.expectedAfterId) throw new Error('PLAID_CURSOR_CONFLICT');
    let afterId = actual, inserted = 0, duplicates = 0;
    for (const event of input.events) {
      if (!Number.isSafeInteger(event.event_id) || event.event_id <= actual ||
          !event.transfer_id || !event.event_type ||
          !Number.isFinite(event.transfer_amount) || event.transfer_amount <= 0) {
        throw new Error('INVALID_PLAID_EVENT_PAGE');
      }
      const amountCents = Math.round(event.transfer_amount * 100);
      if (!Number.isSafeInteger(amountCents) || amountCents < 1) throw new Error('INVALID_PLAID_AMOUNT');
      const providerEventId = `plaid-transfer-event:${event.event_id}`;
      const payload = { ...event, amount_cents: amountCents };
      const hash = await sha256(payload);
      const rows = await tx`
        INSERT INTO avcu_payments.provider_events
          (id, provider_id, environment, provider_event_id, transfer_reference,
           event_type, event_sequence, payload_hash, verified_at)
        VALUES (${uuid()}, 'plaid', ${input.environment}, ${providerEventId},
          ${event.transfer_id}, ${event.event_type}, ${event.event_id},
          ${hash}, clock_timestamp())
        ON CONFLICT (provider_id, environment, provider_event_id) DO NOTHING
        RETURNING id
      `;
      if (rows.length) inserted++;
      else {
        const [prior] = await tx`
          SELECT payload_hash FROM avcu_payments.provider_events
           WHERE provider_id='plaid' AND environment=${input.environment}
             AND provider_event_id=${providerEventId}
        `;
        if (!prior || prior.payload_hash !== hash) throw new Error('PLAID_EVENT_PAYLOAD_CONFLICT');
        duplicates++;
      }
      afterId = Math.max(afterId, event.event_id);
    }
    await tx`
      INSERT INTO avcu_payments.provider_cursors(provider_id, environment, after_id)
      VALUES ('plaid', ${input.environment}, ${afterId})
      ON CONFLICT (provider_id, environment)
      DO UPDATE SET after_id=EXCLUDED.after_id, updated_at=clock_timestamp()
    `;
    await tx`
      INSERT INTO avcu_payments.payment_audit(actor_id, action, object_type, object_id, details)
      VALUES (${input.lease.ownerId}, 'plaid_page_committed', 'provider_cursor',
        ${input.environment}, ${tx.json({afterId, inserted, duplicates, fencingToken:input.lease.fencingToken})})
    `;
    return { afterId, inserted, duplicates };
  });
}

export interface JournalEntryInput { ledgerAccountId: string; amountCents: number; }
export async function postBalancedJournal(input: {
  sourceType: string; sourceId: string; idempotencyKey: string;
  description: string; currency?: string; entries: JournalEntryInput[];
}): Promise<{ journalId: string; duplicate: boolean }> {
  const currency = input.currency || 'USD';
  if (!input.entries || input.entries.length < 2 ||
      input.entries.some(e => !Number.isSafeInteger(e.amountCents) || e.amountCents === 0) ||
      input.entries.reduce((sum,e)=>sum+e.amountCents,0) !== 0) {
    throw new Error('UNBALANCED_JOURNAL');
  }
  return await database().begin(async tx => {
    const id = uuid();
    const rows = await tx`
      INSERT INTO avcu_payments.ledger_journals
        (id, source_type, source_id, idempotency_key, currency, description)
      VALUES (${id}, ${input.sourceType}, ${input.sourceId}, ${input.idempotencyKey}, ${currency}, ${input.description})
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id
    `;
    if (!rows.length) {
      const [prior] = await tx`SELECT id, source_type, source_id FROM avcu_payments.ledger_journals WHERE idempotency_key=${input.idempotencyKey} FOR UPDATE`;
      if (!prior || prior.source_type !== input.sourceType || prior.source_id !== input.sourceId) {
        throw new Error('LEDGER_IDEMPOTENCY_CONFLICT');
      }
      return { journalId: prior.id, duplicate: true };
    }
    for (const entry of input.entries) {
      await tx`INSERT INTO avcu_payments.ledger_entries
        (id, journal_id, ledger_account_id, currency, amount_cents)
        VALUES (${uuid()}, ${id}, ${entry.ledgerAccountId}, ${currency}, ${entry.amountCents})`;
    }
    return { journalId: id, duplicate: false };
  });
}

/** Reverse a complete journal once. New entries are exact opposites; source rows
 * remain immutable and the deferred balance trigger validates the new journal. */
export async function reverseJournal(input: {
  originalJournalId: string; idempotencyKey: string; actorId: string; reason: string;
}): Promise<{ journalId: string; duplicate: boolean }> {
  return await database().begin(async tx => {
    const [original] = await tx`
      SELECT id, currency FROM avcu_payments.ledger_journals
       WHERE id=${input.originalJournalId} FOR UPDATE
    `;
    if (!original) throw new Error('ORIGINAL_JOURNAL_NOT_FOUND');
    const [prior] = await tx`SELECT id FROM avcu_payments.ledger_journals WHERE reversal_of=${original.id}`;
    if (prior) {
      if (input.idempotencyKey) return { journalId: prior.id, duplicate: true };
      throw new Error('JOURNAL_ALREADY_REVERSED');
    }
    const reversalId = uuid();
    await tx`
      INSERT INTO avcu_payments.ledger_journals
        (id, source_type, source_id, idempotency_key, currency, description, reversal_of)
      VALUES (${reversalId}, 'reversal', ${original.id}, ${input.idempotencyKey},
        ${original.currency}, ${input.reason}, ${original.id})
    `;
    const entries = await tx`
      SELECT ledger_account_id, amount_cents FROM avcu_payments.ledger_entries
       WHERE journal_id=${original.id}
    `;
    if (entries.length < 2) throw new Error('ORIGINAL_JOURNAL_INVALID');
    for (const entry of entries) {
      await tx`INSERT INTO avcu_payments.ledger_entries
        (id, journal_id, ledger_account_id, currency, amount_cents)
        VALUES (${uuid()}, ${reversalId}, ${entry.ledger_account_id},
          ${original.currency}, ${-Number(entry.amount_cents)})`;
    }
    await tx`
      INSERT INTO avcu_payments.payment_audit(actor_id, action, object_type, object_id, details)
      VALUES (${input.actorId}, 'ledger_journal_reversed', 'ledger_journal',
        ${original.id}, ${tx.json({reversalJournalId:reversalId, reason:input.reason})})
    `;
    return { journalId: reversalId, duplicate: false };
  });
}

export async function closePaymentStore(): Promise<void> {
  if (client) { const current = client; client = null; await current.end({ timeout: 5 }); }
}
