-- AVCU outgoing funds reservations: lock the member ledger account while
-- calculating posted available funds and inserting a durable hold.
-- Apply after 001_avcu_payment_control_plane.sql and 002_avcu_backend_grants.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS avcu_payments.outgoing_funds_holds (
  id uuid PRIMARY KEY,
  operation_id uuid NOT NULL UNIQUE REFERENCES avcu_payments.payment_operations(id),
  ledger_account_id uuid NOT NULL REFERENCES avcu_payments.ledger_accounts(id),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL CHECK (status IN ('active','captured','released')),
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS outgoing_funds_holds_active_account_idx
  ON avcu_payments.outgoing_funds_holds(ledger_account_id)
  WHERE status='active';

CREATE OR REPLACE FUNCTION avcu_payments.reserve_outgoing_funds(
  p_operation_id uuid, p_account_ref text, p_amount_cents bigint, p_actor_id text
)
RETURNS TABLE(hold_id uuid, available_after_cents bigint, duplicate boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, avcu_payments
AS $$
DECLARE
  account_row avcu_payments.ledger_accounts%ROWTYPE;
  posted_balance numeric;
  active_holds numeric;
  existing avcu_payments.outgoing_funds_holds%ROWTYPE;
  new_id uuid := gen_random_uuid();
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR
     p_account_ref IS NULL OR length(p_account_ref)=0 OR
     p_actor_id IS NULL OR length(p_actor_id)=0 THEN
    RAISE EXCEPTION 'INVALID_FUNDS_RESERVATION_INPUT' USING ERRCODE='22023';
  END IF;

  SELECT * INTO account_row
    FROM avcu_payments.ledger_accounts
   WHERE external_account_ref=p_account_ref
     AND account_type='member_deposit'
     AND currency='USD'
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBER_LEDGER_ACCOUNT_NOT_CONFIGURED' USING ERRCODE='P0001';
  END IF;

  SELECT * INTO existing
    FROM avcu_payments.outgoing_funds_holds
   WHERE operation_id=p_operation_id
   FOR UPDATE;
  IF FOUND THEN
    IF existing.ledger_account_id<>account_row.id OR existing.amount_cents<>p_amount_cents THEN
      RAISE EXCEPTION 'FUNDS_HOLD_IDEMPOTENCY_CONFLICT' USING ERRCODE='23505';
    END IF;
    IF existing.status<>'active' THEN
      RAISE EXCEPTION 'FUNDS_HOLD_NOT_ACTIVE' USING ERRCODE='P0001';
    END IF;
    SELECT -COALESCE(sum(amount_cents),0) INTO posted_balance
      FROM avcu_payments.ledger_entries WHERE ledger_account_id=account_row.id;
    SELECT COALESCE(sum(amount_cents),0) INTO active_holds
      FROM avcu_payments.outgoing_funds_holds
     WHERE ledger_account_id=account_row.id AND status='active';
    RETURN QUERY SELECT existing.id,
      (posted_balance-active_holds)::bigint, true;
    RETURN;
  END IF;

  SELECT -COALESCE(sum(amount_cents),0) INTO posted_balance
    FROM avcu_payments.ledger_entries WHERE ledger_account_id=account_row.id;
  SELECT COALESCE(sum(amount_cents),0) INTO active_holds
    FROM avcu_payments.outgoing_funds_holds
   WHERE ledger_account_id=account_row.id AND status='active';

  IF posted_balance-active_holds < p_amount_cents THEN
    RAISE EXCEPTION 'INSUFFICIENT_AVAILABLE_FUNDS:available=%', (posted_balance-active_holds)::bigint
      USING ERRCODE='P0001';
  END IF;

  INSERT INTO avcu_payments.outgoing_funds_holds
    (id,operation_id,ledger_account_id,amount_cents,status)
  VALUES (new_id,p_operation_id,account_row.id,p_amount_cents,'active');

  INSERT INTO avcu_payments.payment_audit(actor_id,action,object_type,object_id,details)
  VALUES (p_actor_id,'outgoing_funds_reserved','payment_operation',p_operation_id::text,
    jsonb_build_object('hold_id',new_id,'ledger_account_id',account_row.id,
      'amount_cents',p_amount_cents,'available_before_cents',posted_balance-active_holds,
      'available_after_cents',posted_balance-active_holds-p_amount_cents));

  RETURN QUERY SELECT new_id,
    (posted_balance-active_holds-p_amount_cents)::bigint, false;
END;
$$;

CREATE OR REPLACE FUNCTION avcu_payments.transition_outgoing_funds_hold(
  p_operation_id uuid, p_target_status text, p_actor_id text, p_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, avcu_payments
AS $$
DECLARE
  hold_row avcu_payments.outgoing_funds_holds%ROWTYPE;
  account_id uuid;
BEGIN
  IF p_target_status NOT IN ('captured','released') THEN
    RAISE EXCEPTION 'INVALID_FUNDS_HOLD_TRANSITION' USING ERRCODE='22023';
  END IF;
  -- Always take the member account lock before the hold lock. Reservation and
  -- every ledger posting use this same order to avoid races and deadlocks.
  SELECT ledger_account_id INTO account_id
    FROM avcu_payments.outgoing_funds_holds
   WHERE operation_id=p_operation_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM avcu_payments.ledger_accounts
   WHERE id=account_id FOR UPDATE;
  SELECT * INTO hold_row FROM avcu_payments.outgoing_funds_holds
   WHERE operation_id=p_operation_id FOR UPDATE;
  IF hold_row.status=p_target_status THEN RETURN true; END IF;
  IF hold_row.status<>'active' THEN
    RAISE EXCEPTION 'FUNDS_HOLD_ALREADY_FINALIZED' USING ERRCODE='P0001';
  END IF;
  UPDATE avcu_payments.outgoing_funds_holds
     SET status=p_target_status,release_reason=CASE WHEN p_target_status='released' THEN left(p_reason,300) ELSE NULL END,
         updated_at=clock_timestamp()
   WHERE id=hold_row.id;
  INSERT INTO avcu_payments.payment_audit(actor_id,action,object_type,object_id,details)
  VALUES (p_actor_id,'outgoing_funds_'||p_target_status,'outgoing_funds_hold',hold_row.id::text,
    jsonb_build_object('operation_id',p_operation_id,'amount_cents',hold_row.amount_cents,'reason',p_reason));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION avcu_payments.reserve_outgoing_funds(uuid,text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION avcu_payments.transition_outgoing_funds_hold(uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION avcu_payments.reserve_outgoing_funds(uuid,text,bigint,text) TO avcu_backend;
GRANT EXECUTE ON FUNCTION avcu_payments.transition_outgoing_funds_hold(uuid,text,text,text) TO avcu_backend;

COMMIT;
