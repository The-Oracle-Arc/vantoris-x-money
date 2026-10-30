import postgres from 'npm:postgres@3.4.7';

type Sql = ReturnType<typeof postgres>;
let client: Sql | null = null;

function database(): Sql {
  if (client) return client;
  const url = Deno.env.get('AVCU_LEDGER_TEST_DATABASE_URL') || Deno.env.get('AVCU_LEDGER_DATABASE_URL');
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


/** Register the Base44 projection after a unique SQL operation claim.
 * Repeating the same registration is safe; mismatched values are rejected. */
export async function registerPaymentTransfer(input: {
  base44TransferRequestId: string; idempotencyKey: string; sourceAccountRef: string;
  rail: 'ACH' | 'FEDWIRE'; amountCents: number;
}): Promise<{ id: string; duplicate: boolean }> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) throw new Error('INVALID_TRANSFER_AMOUNT');
  return await database().begin(async tx => {
    const rows = await tx`
      INSERT INTO avcu_payments.payment_transfers
        (id, base44_transfer_request_id, idempotency_key, source_account_ref, rail, amount_cents, status)
      VALUES (${uuid()}, ${input.base44TransferRequestId}, ${input.idempotencyKey},
        ${input.sourceAccountRef}, ${input.rail}, ${input.amountCents}, 'awaiting_bank_review')
      ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
    `;
    if (rows.length) return { id: rows[0].id, duplicate: false };
    const [prior] = await tx`
      SELECT id, base44_transfer_request_id, source_account_ref, rail, amount_cents
        FROM avcu_payments.payment_transfers WHERE idempotency_key=${input.idempotencyKey} FOR UPDATE
    `;
    if (!prior || prior.base44_transfer_request_id !== input.base44TransferRequestId ||
        prior.source_account_ref !== input.sourceAccountRef || prior.rail !== input.rail ||
        Number(prior.amount_cents) !== input.amountCents) {
      throw new Error('PAYMENT_TRANSFER_IDEMPOTENCY_CONFLICT');
    }
    return { id: prior.id, duplicate: true };
  });
}

export async function setProviderTransferReference(input: {
  base44TransferRequestId: string; providerId: string; providerTransferId: string;
}): Promise<void> {
  const changed = await database()`
    UPDATE avcu_payments.payment_transfers
       SET provider_id=${input.providerId}, provider_transfer_id=${input.providerTransferId},
           status='submitted_to_bank', updated_at=clock_timestamp()
     WHERE base44_transfer_request_id=${input.base44TransferRequestId}
       AND (provider_transfer_id IS NULL OR provider_transfer_id=${input.providerTransferId})
  `;
  if (changed.count !== 1) throw new Error('PAYMENT_TRANSFER_PROVIDER_REFERENCE_CONFLICT');
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
           event_type, event_sequence, payload_hash, amount_cents, currency, verified_at)
        VALUES (${uuid()}, 'plaid', ${input.environment}, ${providerEventId},
          ${event.transfer_id}, ${event.event_type}, ${event.event_id},
          ${hash}, ${amountCents}, 'USD', clock_timestamp())
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


export async function getProviderCursor(providerId: string, environment: 'sandbox' | 'production'): Promise<number> {
  const rows = await database()`
    SELECT after_id FROM avcu_payments.provider_cursors
     WHERE provider_id=${providerId} AND environment=${environment}
  `;
  return Number(rows[0]?.after_id ?? 0);
}

/** Process a verified Plaid event and any settlement/reversal journal in one
 * PostgreSQL transaction. Missing account mapping/clearing configuration is
 * a held event, never a guessed ledger posting. */
export async function processPlaidProviderEvent(input: {
  providerEventId: string; environment: 'sandbox' | 'production';
  clearingLedgerAccountId: string;
}): Promise<{ status: string; journalId?: string; reason?: string }> {
  return await database().begin(async tx => {
    const [event] = await tx`
      SELECT * FROM avcu_payments.provider_events
       WHERE provider_id='plaid' AND environment=${input.environment}
         AND provider_event_id=${input.providerEventId}
       FOR UPDATE
    `;
    if (!event) throw new Error('PROVIDER_EVENT_NOT_FOUND');
    if (event.processing_status === 'processed') return { status: 'duplicate' };
    if (!event.verified_at) throw new Error('UNVERIFIED_PROVIDER_EVENT');
    const [transfer] = await tx`
      SELECT * FROM avcu_payments.payment_transfers
       WHERE provider_id='plaid' AND provider_transfer_id=${event.transfer_reference}
       FOR UPDATE
    `;
    if (!transfer) {
      await tx`UPDATE avcu_payments.provider_events SET processing_status='held'
        WHERE id=${event.id}`;
      return { status:'held', reason:'No registered AVCU transfer mapping for provider transfer ID.' };
    }
    if (Number(transfer.amount_cents) !== Number(event.amount_cents) ||
        transfer.currency !== event.currency) {
      await tx`UPDATE avcu_payments.provider_events SET processing_status='held'
        WHERE id=${event.id}`;
      return { status:'held', reason:'Provider event amount or currency does not match the approved transfer.' };
    }
    if (event.event_sequence !== null && transfer.last_event_sequence !== null &&
        Number(event.event_sequence) <= Number(transfer.last_event_sequence)) {
      await tx`UPDATE avcu_payments.provider_events SET processing_status='processed', processed_at=clock_timestamp()
        WHERE id=${event.id}`;
      return { status:'ignored_old_event' };
    }

    const rawType = String(event.event_type).toLowerCase().replace(/^transfer[._]/,'');
    let nextStatus = '';
    let journalId: string | undefined;
    if (rawType === 'posted' || rawType === 'settled') {
      nextStatus = 'settled';
      if (!transfer.settled_journal_id) {
        const [memberLedger] = await tx`
          SELECT id FROM avcu_payments.ledger_accounts
           WHERE external_account_ref=${transfer.source_account_ref} AND currency=${transfer.currency}
        `;
        const [clearing] = await tx`
          SELECT id FROM avcu_payments.ledger_accounts
           WHERE id=${input.clearingLedgerAccountId} AND account_type='bank_clearing'
             AND currency=${transfer.currency}
        `;
        if (!memberLedger || !clearing) {
          await tx`UPDATE avcu_payments.provider_events SET processing_status='held'
            WHERE id=${event.id}`;
          return { status:'held', reason:'Member or bank-clearing ledger account mapping is missing.' };
        }
        journalId = uuid();
        await tx`
          INSERT INTO avcu_payments.ledger_journals
            (id, source_type, source_id, idempotency_key, currency, description)
          VALUES (${journalId}, 'outgoing_transfer_settlement', ${transfer.id},
            ${'settlement:'+transfer.id}, ${transfer.currency}, 'Settled outgoing bank transfer')
        `;
        await tx`
          INSERT INTO avcu_payments.ledger_entries(id,journal_id,ledger_account_id,currency,amount_cents)
          VALUES (${uuid()},${journalId},${memberLedger.id},${transfer.currency},${-Number(transfer.amount_cents)}),
                 (${uuid()},${journalId},${clearing.id},${transfer.currency},${Number(transfer.amount_cents)})
        `;
      } else journalId = transfer.settled_journal_id;
      await tx`UPDATE avcu_payments.payment_transfers
        SET status='settled', settled_journal_id=COALESCE(settled_journal_id,${journalId}),
            last_event_sequence=${event.event_sequence}, updated_at=clock_timestamp()
        WHERE id=${transfer.id}`;
    } else if (rawType === 'returned') {
      nextStatus = 'returned';
      if (transfer.settled_journal_id) {
        const [priorReversal] = await tx`SELECT id FROM avcu_payments.ledger_journals
          WHERE reversal_of=${transfer.settled_journal_id}`;
        if (!priorReversal) {
          const [original] = await tx`SELECT currency FROM avcu_payments.ledger_journals
            WHERE id=${transfer.settled_journal_id} FOR UPDATE`;
          if (!original) throw new Error('SETTLEMENT_JOURNAL_MISSING');
          journalId = uuid();
          await tx`
            INSERT INTO avcu_payments.ledger_journals
              (id,source_type,source_id,idempotency_key,currency,description,reversal_of)
            VALUES (${journalId},'provider_return',${transfer.settled_journal_id},
              ${'return:'+event.provider_event_id},${original.currency},
              'Reverse settled transfer returned by provider',${transfer.settled_journal_id})
          `;
          const originalEntries = await tx`SELECT ledger_account_id,amount_cents
            FROM avcu_payments.ledger_entries WHERE journal_id=${transfer.settled_journal_id}`;
          for (const entry of originalEntries) {
            await tx`INSERT INTO avcu_payments.ledger_entries
              (id,journal_id,ledger_account_id,currency,amount_cents)
              VALUES (${uuid()},${journalId},${entry.ledger_account_id},${original.currency},${-Number(entry.amount_cents)})`;
          }
        } else journalId = priorReversal.id;
      }
      await tx`UPDATE avcu_payments.payment_transfers SET status='returned',
        last_event_sequence=${event.event_sequence}, updated_at=clock_timestamp()
        WHERE id=${transfer.id}`;
    } else if (['pending','failed','cancelled'].includes(rawType)) {
      nextStatus = rawType;
      await tx`UPDATE avcu_payments.payment_transfers SET status=${nextStatus},
        last_event_sequence=${event.event_sequence}, updated_at=clock_timestamp()
        WHERE id=${transfer.id}`;
    } else {
      await tx`UPDATE avcu_payments.provider_events SET processing_status='held'
        WHERE id=${event.id}`;
      return { status:'held', reason:'Unsupported Plaid transfer event type.' };
    }

    await tx`UPDATE avcu_payments.provider_events SET processing_status='processed',
      processed_at=clock_timestamp() WHERE id=${event.id}`;
    await tx`
      INSERT INTO avcu_payments.payment_outbox(source_event_id,base44_transfer_request_id,target_status)
      VALUES (${event.id},${transfer.base44_transfer_request_id},${nextStatus==='pending'?'pending_settlement':nextStatus})
      ON CONFLICT (source_event_id) DO NOTHING
    `;
    await tx`
      INSERT INTO avcu_payments.payment_audit(actor_id,action,object_type,object_id,details)
      VALUES ('plaid-provider','provider_event_processed','provider_event',${event.provider_event_id},
        ${tx.json({transferId:transfer.id,status:nextStatus,journalId:journalId||null})})
    `;
    return { status:nextStatus, journalId };
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


export async function listQueuedPlaidEvents(limit = 50, environment: 'sandbox' | 'production' = 'sandbox') {
  const rows = await database()`
    SELECT provider_event_id FROM avcu_payments.provider_events
     WHERE provider_id='plaid' AND environment=${environment}
       AND processing_status IN ('queued','held')
     ORDER BY event_sequence ASC NULLS LAST LIMIT ${Math.min(Math.max(limit,1),100)}
  `;
  return rows.map(row => row.provider_event_id as string);
}

export async function listPendingPaymentOutbox(limit = 50) {
  const rows = await database()`
    SELECT id, base44_transfer_request_id, target_status, attempts
      FROM avcu_payments.payment_outbox
     WHERE delivered_at IS NULL ORDER BY id LIMIT ${Math.min(Math.max(limit,1),100)}
  `;
  return rows.map(row => ({id:Number(row.id),transferRequestId:row.base44_transfer_request_id,
    status:row.target_status,attempts:Number(row.attempts)}));
}

export async function markPaymentOutboxDelivered(id: number): Promise<boolean> {
  const result = await database()`
    UPDATE avcu_payments.payment_outbox SET delivered_at=clock_timestamp(),last_error=NULL
     WHERE id=${id} AND delivered_at IS NULL
  `;
  return result.count === 1;
}
export async function recordPaymentOutboxFailure(id: number, message: string): Promise<void> {
  await database()`
    UPDATE avcu_payments.payment_outbox
       SET attempts=attempts+1,last_error=${message.slice(0,500)}
     WHERE id=${id} AND delivered_at IS NULL
  `;
}

export async function closePaymentStore(): Promise<void> {
  if (client) { const current = client; client = null; await current.end({ timeout: 5 }); }
}
