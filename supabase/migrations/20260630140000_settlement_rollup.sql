/*
  # FHE Suite — Settlement roll-up: billable_lines -> transactions (U17, migration 41)
  Module: core.payments.  Depends on U5 (billable_lines, migration 20260630040000)
  and migration 22 (transactions) + migration 26 (org_scope on transactions).

  Per PLATFORM_ARCHITECTURE.md §7.11: closes "cost_allocations reach invoices".
  `billable_lines` is the universal charge primitive that board / lessons /
  consumption all emit into, but nothing stated HOW settled lines reach an invoice.
  This unit adds the ONE path a billable_line reaches a transactions INVOICE:

    settle_billable_lines(p_payer_contact_id, p_period)
      1. selects OPEN, un-stamped billable_lines for the payer in the period;
      2. inserts ONE transactions row (txn_type='INVOICE', amount = SUM(amount),
         payer_contact_id, period, engagement_id = shared engagement else NULL);
      3. stamps each rolled line status='SETTLED', transaction_id = <new txn>;
      4. at settle the lines become append-only (the U5 seal trigger fires — the
         OPEN->SETTLED transition is allowed because OLD.status='OPEN').

    Re-runnable / idempotent: a line already SETTLED / transaction_id-stamped is
    filtered out (status='OPEN' AND transaction_id IS NULL), so a second call for
    the same payer/period finds no OPEN lines and creates NO second invoice.

  SECURITY DEFINER, core (no require_module — shared by every emitter). Requires
  only that the caller is org staff and that the payer/lines belong to the caller's
  org (org_boundary). Every settle writes an audit_logs row (settle event).

  ADDITIVE transactions alterations (verified against …150000_transactions.sql +
  …190000_org_scope_data.sql; every existing row stays valid):
    - ALTER COLUMN engagement_id DROP NOT NULL   (an INVOICE may have no single
      engagement; relaxing a constraint invalidates no existing row).
    - extend txn_type CHECK to the SUPERSET (…, 'INVOICE') — re-adding the same
      values plus one, so existing PURCHASE/SALE/LEASE rows stay valid.
    - ADD COLUMN payer_contact_id uuid, period tstzrange (both nullable).
  transactions is already org-scoped (mig 26) + audited (mig 22), so no
  boundary/audit change is needed.
*/

-- ============================================================
-- transactions — additive alterations (§7.11)
-- ============================================================

-- 1) an INVOICE may have no single engagement → relax NOT NULL (safe; no row today
--    is NULL, and DROP NOT NULL never invalidates an existing row).
ALTER TABLE transactions ALTER COLUMN engagement_id DROP NOT NULL;

-- 2) extend txn_type CHECK to add 'INVOICE' (re-add the SUPERSET so every existing
--    PURCHASE/SALE/LEASE row stays valid). The original constraint is unnamed
--    (inline CHECK), so discover + drop it by catalog before re-adding a named one.
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
    FROM pg_constraint
   WHERE conrelid = 'transactions'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%txn_type%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE transactions DROP CONSTRAINT %I', v_con);
  END IF;
END $$;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_txn_type_check
  CHECK (txn_type IN ('PURCHASE','SALE','LEASE','INVOICE'));

-- 3) invoice roll-up columns (nullable). payer_contact_id ties the invoice to the
--    contact whose lines rolled up; period records the settled window.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payer_contact_id uuid REFERENCES contacts(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS period tstzrange;

CREATE INDEX IF NOT EXISTS transactions_payer_idx ON transactions (payer_contact_id);

-- ============================================================
-- settle_billable_lines — the roll-up RPC (§7.11)
--   Returns the new transactions row id, the summed amount, and the count of
--   lines rolled. When no OPEN lines exist for the payer/period it returns NULL
--   transaction_id / 0 count and creates NO invoice (the idempotent no-op).
-- ============================================================
CREATE OR REPLACE FUNCTION settle_billable_lines(
  p_payer_contact_id uuid,
  p_period           tstzrange DEFAULT NULL
)
RETURNS TABLE (transaction_id uuid, amount numeric, lines_settled int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org       uuid;
  v_sum       numeric(12,2);
  v_count     int;
  v_eng            uuid;
  v_eng_count      int;
  v_eng_has_untied boolean;
  v_eng_text       text;
  v_txn            uuid;
BEGIN
  -- Require org staff. Core RPC, but never callable by a client / anon: the caller
  -- must be a staff member of a tenant, and every line settled must belong to that
  -- same org (enforced by the org filter below).
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'settle_billable_lines: caller lacks staff access';
  END IF;

  v_org := current_org();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'settle_billable_lines: no current org';
  END IF;

  -- Gather the OPEN, un-stamped lines for this payer in this org (and period, when
  -- given). This is the idempotency filter: SETTLED / already-stamped lines are
  -- excluded, so a re-run finds nothing and creates no second invoice.
  --
  -- p_period semantics: when NULL, settle ALL open lines for the payer regardless
  -- of period; when given, settle only lines whose period is contained in it (a
  -- line with a NULL period is always eligible — a one-off charge with no window).
  SELECT COALESCE(SUM(bl.amount), 0)::numeric(12,2),
         COUNT(*)::int
    INTO v_sum, v_count
    FROM billable_lines bl
   WHERE bl.org_id = v_org
     AND bl.payer_contact_id = p_payer_contact_id
     AND bl.status = 'OPEN'
     AND bl.transaction_id IS NULL
     AND bl.deleted_at IS NULL
     AND (p_period IS NULL OR bl.period IS NULL OR bl.period <@ p_period);

  IF v_count = 0 THEN
    -- Idempotent no-op: nothing OPEN → no invoice created.
    transaction_id := NULL;
    amount         := 0;
    lines_settled  := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- engagement_id = the lines' engagement WHEN every rolled line resolves to the
  -- SAME single engagement, else NULL. billable_lines carry no direct engagement
  -- FK; a line's engagement (if any) is inferred from the horse it charges against —
  -- the engagement whose primary_horse_id is that horse, within this org. A line
  -- with no horse (or a horse tied to no engagement) resolves to NO engagement, so
  -- the moment ANY rolled line is un-tied, the lines do not "share one engagement"
  -- and the invoice's engagement_id is NULL. (LEFT JOIN so un-tied lines surface as
  -- a NULL bucket; count DISTINCT non-null engagements + detect any NULL bucket.)
  SELECT COUNT(DISTINCT e.id)::int,
         bool_or(e.id IS NULL),
         MIN(e.id::text)          -- text so MIN() exists; single-engagement case only
    INTO v_eng_count, v_eng_has_untied, v_eng_text
    FROM billable_lines bl
    LEFT JOIN engagements e
           ON e.primary_horse_id = bl.horse_id
          AND e.org_id = bl.org_id
          AND e.deleted_at IS NULL
   WHERE bl.org_id = v_org
     AND bl.payer_contact_id = p_payer_contact_id
     AND bl.status = 'OPEN'
     AND bl.transaction_id IS NULL
     AND bl.deleted_at IS NULL
     AND (p_period IS NULL OR bl.period IS NULL OR bl.period <@ p_period);

  IF v_eng_count = 1 AND NOT v_eng_has_untied THEN
    v_eng := v_eng_text::uuid;   -- exactly one engagement, every line tied to it
  ELSE
    v_eng := NULL;               -- zero / many engagements, or an un-tied line
  END IF;

  -- 2) insert exactly ONE transactions INVOICE. org_id set explicitly (not relying
  --    on current_org() default under DEFINER); status POSTED (the invoice exists).
  INSERT INTO transactions (org_id, engagement_id, txn_type, amount, payer_contact_id, period, status)
    VALUES (v_org, v_eng, 'INVOICE', v_sum, p_payer_contact_id, p_period, 'POSTED')
    RETURNING id INTO v_txn;

  -- 3) stamp each rolled line SETTLED + transaction_id (OPEN->SETTLED is allowed by
  --    the U5 seal; from here the line is append-only). Same filter as the sum, so
  --    only the lines counted above are stamped — no race with concurrently-added
  --    lines (they stay OPEN for the next settle).
  UPDATE billable_lines bl
     SET status = 'SETTLED',
         transaction_id = v_txn
   WHERE bl.org_id = v_org
     AND bl.payer_contact_id = p_payer_contact_id
     AND bl.status = 'OPEN'
     AND bl.transaction_id IS NULL
     AND bl.deleted_at IS NULL
     AND (p_period IS NULL OR bl.period IS NULL OR bl.period <@ p_period);

  -- Audit: the INVOICE INSERT (audit_transactions trigger) and each line's
  -- OPEN->SETTLED UPDATE (audit_billable_lines trigger) are captured automatically
  -- by the mig-13 audit_row_change() triggers already attached to both tables — no
  -- manual audit call needed; the settle is fully recorded in audit_logs.

  transaction_id := v_txn;
  amount         := v_sum;
  lines_settled  := v_count;
  RETURN NEXT;
END;
$fn$;

-- Core RPC: callable by authenticated staff (the body re-checks has_staff_access()).
REVOKE ALL ON FUNCTION settle_billable_lines(uuid, tstzrange) FROM public;
GRANT EXECUTE ON FUNCTION settle_billable_lines(uuid, tstzrange) TO authenticated, service_role;
