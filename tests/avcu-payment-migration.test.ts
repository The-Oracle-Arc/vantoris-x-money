function assert(condition:unknown,message:string):asserts condition {
  if(!condition) throw new Error(message);
}

Deno.test('AVCU payment migration defines concurrency and ledger invariants',async()=>{
  const sql=await Deno.readTextFile('migrations/001_avcu_payment_control_plane.sql');
  for(const table of [
    'payment_operations','provider_events','provider_cursors','bank_receipts',
    'ledger_accounts','ledger_journals','ledger_entries','payment_transfers',
    'payment_outbox','payment_audit','worker_leases'
  ]) assert(sql.includes(`CREATE TABLE IF NOT EXISTS avcu_payments.${table}`),`Missing table ${table}`);
  for(const unique of [
    'UNIQUE (operation_type, idempotency_key)',
    'UNIQUE (provider_id, environment, provider_event_id)',
    'UNIQUE (rail, bank_reference)',
    'UNIQUE (idempotency_key)',
    'reversal_of uuid UNIQUE',
    'lock_name text PRIMARY KEY'
  ]) assert(sql.includes(unique),`Missing database uniqueness invariant: ${unique}`);
  for(const fn of ['acquire_lease','renew_lease','assert_lease','release_lease','assert_journal_balanced','audit_worker_lease_change'])
    assert(sql.includes(`FUNCTION avcu_payments.${fn}`),`Missing database function ${fn}`);
  assert(sql.includes('DEFERRABLE INITIALLY DEFERRED'),'Ledger balance must be checked at transaction commit.');
  assert(sql.includes('reject_ledger_mutation'),'Posted ledger rows must be append-only.');
  assert(sql.includes('AS $fn
});

Deno.test('AVCU outgoing funds holds serialize concurrent spending and only allow terminal transitions',async()=>{
  const sql=await Deno.readTextFile('migrations/003_avcu_outgoing_funds_holds.sql');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS avcu_payments.outgoing_funds_holds'),'Missing durable outgoing funds holds.');
  assert(sql.includes('FOR UPDATE'),'Reservation must lock the member ledger account.');
  assert(sql.includes('posted_balance-active_holds < p_amount_cents'),'Reservation must include posted balance and existing active holds.');
  assert(sql.includes('INSUFFICIENT_AVAILABLE_FUNDS'),'Insufficient funds must fail closed.');
  assert(sql.includes("p_target_status NOT IN ('captured','released')"),'Only capture/release transitions are allowed.');
  assert(sql.includes('GRANT EXECUTE ON FUNCTION avcu_payments.reserve_outgoing_funds'),'Backend role must execute the reservation function.');
});

Deno.test('AVCU payment audit is append-only',async()=>{
  const sql=await Deno.readTextFile('migrations/004_avcu_payment_audit_hardening.sql');
  assert(sql.includes('BEFORE UPDATE OR DELETE ON avcu_payments.payment_audit'),'Audit mutation trigger is missing.');
  assert(sql.includes('REVOKE UPDATE, DELETE, TRUNCATE ON avcu_payments.payment_audit FROM avcu_backend'),'Backend audit mutation privileges must be revoked.');
});

Deno.test('AVCU incoming receipt entity schema is valid and supports reversal state',async()=>{
  const schema=JSON.parse(await Deno.readTextFile('base44/entities/IncomingBankReceipt.jsonc'));
  assert(schema.properties.transactional_receipt_id,'Missing PostgreSQL receipt link.');
  assert(schema.properties.ledger_posting_status.enum.includes('reversed'),'Missing reversal projection state.');
  assert(schema.rls.create.user_condition.role==='admin','Incoming receipt writes must be server-only.');
  assert(schema.rls.delete===false,'Incoming receipt deletion must be denied.');
});

Deno.test('AVCU backend grant migration is least privilege',async()=>{
  const sql=await Deno.readTextFile('migrations/002_avcu_backend_grants.sql');
  assert(sql.includes('TO avcu_backend'),'Backend grants must target only the dedicated service role.');
  assert(sql.includes('GRANT SELECT ON avcu_payments.ledger_accounts'),'Ledger account mapping must be read-only to the adapter.');
  assert(sql.includes('GRANT SELECT, INSERT ON'), 'Ledger journals and entries must be append-only to the adapter role.');
  assert(!/GRANT\s+[^;]*DELETE/i.test(sql),'Adapter role must not receive delete privileges.');
  assert(!/GRANT\s+ALL/i.test(sql),'Adapter role must not receive blanket privileges.');
});
) && sql.includes('END;\\n$fn$;'),'Lease audit trigger must use valid PostgreSQL dollar quoting.');
});

Deno.test('AVCU outgoing funds holds serialize concurrent spending and only allow terminal transitions',async()=>{
  const sql=await Deno.readTextFile('migrations/003_avcu_outgoing_funds_holds.sql');
  assert(sql.includes('CREATE TABLE IF NOT EXISTS avcu_payments.outgoing_funds_holds'),'Missing durable outgoing funds holds.');
  assert(sql.includes('FOR UPDATE'),'Reservation must lock the member ledger account.');
  assert(sql.includes('posted_balance-active_holds < p_amount_cents'),'Reservation must include posted balance and existing active holds.');
  assert(sql.includes('INSUFFICIENT_AVAILABLE_FUNDS'),'Insufficient funds must fail closed.');
  assert(sql.includes("p_target_status NOT IN ('captured','released')"),'Only capture/release transitions are allowed.');
  assert(sql.includes('GRANT EXECUTE ON FUNCTION avcu_payments.reserve_outgoing_funds'),'Backend role must execute the reservation function.');
});

Deno.test('AVCU payment audit is append-only',async()=>{
  const sql=await Deno.readTextFile('migrations/004_avcu_payment_audit_hardening.sql');
  assert(sql.includes('BEFORE UPDATE OR DELETE ON avcu_payments.payment_audit'),'Audit mutation trigger is missing.');
  assert(sql.includes('REVOKE UPDATE, DELETE, TRUNCATE ON avcu_payments.payment_audit FROM avcu_backend'),'Backend audit mutation privileges must be revoked.');
});

Deno.test('AVCU incoming receipt entity schema is valid and supports reversal state',async()=>{
  const schema=JSON.parse(await Deno.readTextFile('base44/entities/IncomingBankReceipt.jsonc'));
  assert(schema.properties.transactional_receipt_id,'Missing PostgreSQL receipt link.');
  assert(schema.properties.ledger_posting_status.enum.includes('reversed'),'Missing reversal projection state.');
  assert(schema.rls.create.user_condition.role==='admin','Incoming receipt writes must be server-only.');
  assert(schema.rls.delete===false,'Incoming receipt deletion must be denied.');
});

Deno.test('AVCU backend grant migration is least privilege',async()=>{
  const sql=await Deno.readTextFile('migrations/002_avcu_backend_grants.sql');
  assert(sql.includes('TO avcu_backend'),'Backend grants must target only the dedicated service role.');
  assert(sql.includes('GRANT SELECT ON avcu_payments.ledger_accounts'),'Ledger account mapping must be read-only to the adapter.');
  assert(sql.includes('GRANT SELECT, INSERT ON'), 'Ledger journals and entries must be append-only to the adapter role.');
  assert(!/GRANT\s+[^;]*DELETE/i.test(sql),'Adapter role must not receive delete privileges.');
  assert(!/GRANT\s+ALL/i.test(sql),'Adapter role must not receive blanket privileges.');
});
