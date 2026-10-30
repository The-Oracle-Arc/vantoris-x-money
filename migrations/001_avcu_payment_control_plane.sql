-- AVCU payment-control foundation.
-- Apply only to a dedicated managed PostgreSQL database after security review.
-- Base44 remains the member-facing application; this schema is the proposed
-- transactional authority for payment idempotency, provider events and ledger posting.

BEGIN;

CREATE SCHEMA IF NOT EXISTS avcu_payments;


CREATE TABLE IF NOT EXISTS avcu_payments.provider_cursors (
  provider_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  after_id bigint NOT NULL DEFAULT 0 CHECK (after_id >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (provider_id, environment)
);


CREATE TABLE IF NOT EXISTS avcu_payments.payment_operations (
  id uuid PRIMARY KEY,
  operation_type text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('accepted','processing','unknown','succeeded','failed','reversed')),
  provider_id text,
  provider_reference text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (operation_type, idempotency_key)
);

CREATE TABLE IF NOT EXISTS avcu_payments.provider_events (
  id uuid PRIMARY KEY,
  provider_id text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  provider_event_id text NOT NULL,
  transfer_reference text,
  event_type text NOT NULL,
  event_sequence bigint,
  payload_hash text NOT NULL,
  amount_cents bigint CHECK (amount_cents IS NULL OR amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  verified_at timestamptz NOT NULL,
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'queued'
    CHECK (processing_status IN ('queued','processing','processed','held','failed')),
  fencing_token bigint,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (provider_id, environment, provider_event_id)
);

CREATE TABLE IF NOT EXISTS avcu_payments.bank_receipts (
  id uuid PRIMARY KEY,
  rail text NOT NULL CHECK (rail IN ('ACH','FEDWIRE')),
  bank_reference text NOT NULL,
  idempotency_key text NOT NULL,
  member_account_ref text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  evidence_reference text NOT NULL,
  verification_status text NOT NULL
    CHECK (verification_status IN ('awaiting_verification','verified_received','returned','rejected')),
  recorded_by text NOT NULL,
  verified_by text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (rail, bank_reference),
  UNIQUE (idempotency_key),
  CHECK (verified_by IS NULL OR verified_by <> recorded_by)
);

CREATE TABLE IF NOT EXISTS avcu_payments.ledger_accounts (
  id uuid PRIMARY KEY,
  external_account_ref text NOT NULL UNIQUE,
  account_type text NOT NULL CHECK (account_type IN ('member_deposit','bank_clearing','fee_income','suspense')),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (id, currency)
);

CREATE TABLE IF NOT EXISTS avcu_payments.ledger_journals (
  id uuid PRIMARY KEY,
  source_type text NOT NULL,
  source_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  description text NOT NULL,
  reversal_of uuid UNIQUE REFERENCES avcu_payments.ledger_journals(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (source_type, source_id)
);

CREATE TABLE IF NOT EXISTS avcu_payments.payment_transfers (
  id uuid PRIMARY KEY,
  base44_transfer_request_id text NOT NULL UNIQUE,
  idempotency_key text NOT NULL UNIQUE,
  source_account_ref text NOT NULL,
  provider_id text,
  provider_transfer_id text UNIQUE,
  rail text NOT NULL CHECK (rail IN ('ACH','FEDWIRE')),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status text NOT NULL,
  settled_journal_id uuid UNIQUE REFERENCES avcu_payments.ledger_journals(id),
  last_event_sequence bigint,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS avcu_payments.ledger_entries (
  id uuid PRIMARY KEY,
  journal_id uuid NOT NULL REFERENCES avcu_payments.ledger_journals(id),
  ledger_account_id uuid NOT NULL,
  currency char(3) NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (ledger_account_id, currency)
    REFERENCES avcu_payments.ledger_accounts(id, currency)
);

CREATE INDEX IF NOT EXISTS ledger_entries_journal_idx
  ON avcu_payments.ledger_entries(journal_id);

-- A journal cannot commit unless it contains at least two balanced entries.
CREATE OR REPLACE FUNCTION avcu_payments.assert_journal_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_journal uuid;
  entry_count bigint;
  net_cents numeric;
BEGIN
  target_journal := CASE WHEN TG_TABLE_NAME = 'ledger_journals' THEN NEW.id ELSE NEW.journal_id END;
  SELECT count(*), COALESCE(sum(amount_cents), 0)
    INTO entry_count, net_cents
    FROM avcu_payments.ledger_entries
   WHERE journal_id = target_journal;
  IF entry_count < 2 OR net_cents <> 0 THEN
    RAISE EXCEPTION 'AVCU ledger journal % is not balanced (entries %, net %)',
      target_journal, entry_count, net_cents USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ledger_journal_balance_check ON avcu_payments.ledger_journals;
CREATE CONSTRAINT TRIGGER ledger_journal_balance_check
AFTER INSERT ON avcu_payments.ledger_journals
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION avcu_payments.assert_journal_balanced();

DROP TRIGGER IF EXISTS ledger_entry_balance_check ON avcu_payments.ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entry_balance_check
AFTER INSERT ON avcu_payments.ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION avcu_payments.assert_journal_balanced();

-- Posted ledger facts are append-only. Corrections are new reversal journals.
CREATE OR REPLACE FUNCTION avcu_payments.reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'AVCU ledger rows are append-only; create a reversal journal';
END;
$$;

DROP TRIGGER IF EXISTS ledger_journals_immutable ON avcu_payments.ledger_journals;
CREATE TRIGGER ledger_journals_immutable
BEFORE UPDATE OR DELETE ON avcu_payments.ledger_journals
FOR EACH ROW EXECUTE FUNCTION avcu_payments.reject_ledger_mutation();

DROP TRIGGER IF EXISTS ledger_entries_immutable ON avcu_payments.ledger_entries;
CREATE TRIGGER ledger_entries_immutable
BEFORE UPDATE OR DELETE ON avcu_payments.ledger_entries
FOR EACH ROW EXECUTE FUNCTION avcu_payments.reject_ledger_mutation();

-- A fencing token changes on every successful lease acquisition. Workers must
-- include owner_id + fencing_token in every write they perform under the lease.
CREATE TABLE IF NOT EXISTS avcu_payments.worker_leases (
  lock_name text PRIMARY KEY,
  owner_id uuid NOT NULL,
  fencing_token bigint NOT NULL CHECK (fencing_token > 0),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE OR REPLACE FUNCTION avcu_payments.acquire_lease(
  p_lock_name text,
  p_owner_id uuid,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS TABLE(acquired boolean, fencing_token bigint, expires_at timestamptz)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_lock_name IS NULL OR length(p_lock_name) = 0
     OR p_ttl_seconds < 15 OR p_ttl_seconds > 1800 THEN
    RAISE EXCEPTION 'Invalid lease name or TTL';
  END IF;

  RETURN QUERY
  INSERT INTO avcu_payments.worker_leases AS current_lease
    (lock_name, owner_id, fencing_token, expires_at, updated_at)
  VALUES
    (p_lock_name, p_owner_id, 1,
     clock_timestamp() + make_interval(secs => p_ttl_seconds), clock_timestamp())
  ON CONFLICT (lock_name) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        fencing_token = current_lease.fencing_token + 1,
        expires_at = clock_timestamp() + make_interval(secs => p_ttl_seconds),
        updated_at = clock_timestamp()
    WHERE current_lease.expires_at <= clock_timestamp()
  RETURNING true, current_lease.fencing_token, current_lease.expires_at;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::bigint, NULL::timestamptz;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION avcu_payments.assert_lease(
  p_lock_name text,
  p_owner_id uuid,
  p_fencing_token bigint
)
RETURNS boolean
LANGUAGE sql
VOLATILE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM avcu_payments.worker_leases
     WHERE lock_name = p_lock_name
       AND owner_id = p_owner_id
       AND fencing_token = p_fencing_token
       AND expires_at > clock_timestamp()
  );
$$;

CREATE OR REPLACE FUNCTION avcu_payments.renew_lease(
  p_lock_name text,
  p_owner_id uuid,
  p_fencing_token bigint,
  p_ttl_seconds integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  IF p_ttl_seconds < 15 OR p_ttl_seconds > 1800 THEN
    RAISE EXCEPTION 'Invalid lease TTL';
  END IF;
  UPDATE avcu_payments.worker_leases
     SET expires_at = clock_timestamp() + make_interval(secs => p_ttl_seconds),
         updated_at = clock_timestamp()
   WHERE lock_name = p_lock_name
     AND owner_id = p_owner_id
     AND fencing_token = p_fencing_token
     AND expires_at > clock_timestamp();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

CREATE OR REPLACE FUNCTION avcu_payments.release_lease(
  p_lock_name text,
  p_owner_id uuid,
  p_fencing_token bigint
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE changed integer;
BEGIN
  UPDATE avcu_payments.worker_leases
     SET expires_at = clock_timestamp(), updated_at = clock_timestamp()
   WHERE lock_name = p_lock_name
     AND owner_id = p_owner_id
     AND fencing_token = p_fencing_token;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed = 1;
END;
$$;

-- No browser/member role should have direct write access. Grant only to a
-- dedicated backend database role after the deployment's role model is reviewed.
REVOKE ALL ON SCHEMA avcu_payments FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA avcu_payments FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA avcu_payments FROM PUBLIC;

COMMIT;
