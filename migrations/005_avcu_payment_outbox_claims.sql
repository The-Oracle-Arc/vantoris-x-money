-- Make Base44 projection delivery safe across concurrent workers and process crashes.
BEGIN;

ALTER TABLE avcu_payments.payment_outbox
  ADD COLUMN IF NOT EXISTS claim_owner uuid,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT clock_timestamp();

CREATE INDEX IF NOT EXISTS payment_outbox_claimable_idx
  ON avcu_payments.payment_outbox(available_at,id)
  WHERE delivered_at IS NULL;

COMMIT;
