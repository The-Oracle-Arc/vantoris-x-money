-- Harden payment audit as append-only. Apply after 003.
BEGIN;

CREATE OR REPLACE FUNCTION avcu_payments.reject_payment_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AVCU payment audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS payment_audit_immutable ON avcu_payments.payment_audit;
CREATE TRIGGER payment_audit_immutable
BEFORE UPDATE OR DELETE ON avcu_payments.payment_audit
FOR EACH ROW EXECUTE FUNCTION avcu_payments.reject_payment_audit_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON avcu_payments.payment_audit FROM avcu_backend;
GRANT SELECT, INSERT ON avcu_payments.payment_audit TO avcu_backend;

COMMIT;
