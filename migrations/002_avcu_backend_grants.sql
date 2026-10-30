-- Run after a DBA creates the dedicated non-login runtime role avcu_backend.
-- Do not grant this role to browser/member identities. Keep the connection string server-side.
BEGIN;
GRANT USAGE ON SCHEMA avcu_payments TO avcu_backend;

GRANT SELECT, INSERT, UPDATE ON
  avcu_payments.payment_operations,
  avcu_payments.provider_events,
  avcu_payments.provider_cursors,
  avcu_payments.bank_receipts,
  avcu_payments.payment_transfers,
  avcu_payments.payment_outbox,
  avcu_payments.worker_leases
TO avcu_backend;

GRANT SELECT, INSERT ON avcu_payments.payment_audit TO avcu_backend;
GRANT SELECT ON avcu_payments.ledger_accounts TO avcu_backend;
GRANT SELECT, INSERT ON
  avcu_payments.ledger_journals,
  avcu_payments.ledger_entries
TO avcu_backend;

GRANT USAGE, SELECT ON SEQUENCE avcu_payments.payment_audit_id_seq TO avcu_backend;
GRANT USAGE, SELECT ON SEQUENCE avcu_payments.payment_outbox_id_seq TO avcu_backend;

GRANT EXECUTE ON FUNCTION avcu_payments.acquire_lease(text, uuid, integer) TO avcu_backend;
GRANT EXECUTE ON FUNCTION avcu_payments.assert_lease(text, uuid, bigint) TO avcu_backend;
GRANT EXECUTE ON FUNCTION avcu_payments.renew_lease(text, uuid, bigint, integer) TO avcu_backend;
GRANT EXECUTE ON FUNCTION avcu_payments.release_lease(text, uuid, bigint) TO avcu_backend;

COMMIT;
