-- DEALAUTO §1 — a deal comes into existence with no staff action.
--
-- Owner, 2026-08-22: "deals should auto generate now that i think about it so
-- that page should be self-populating not manually authored as the first step
-- before a contract nor after."
--
-- Measured the same day: `deals` had 0 rows in production against 6 contracts.
-- `create_deal` was correct and had exactly one caller — the New-deal modal on
-- DealsPage — so a deal could only exist if a human decided to author one
-- first. `deal_autocomplete_on_execution` has always been able to COMPLETE a
-- deal and has never been able to CREATE one (`... WHERE status = 'pending';
-- IF NOT FOUND THEN RETURN NEW;`).
--
-- WHERE CREATION BELONGS. Not at execution. The owner's phrase rules out both
-- ends — "not... as the first step before a contract nor after" — which leaves
-- the moment the contract itself first becomes real: the INSERT into
-- `contracts`. Three further facts agree with that reading and none with the
-- execution-time reading:
--   • `deal_status` already has a 'created' code whose comment reads "no
--     governing document yet: the deal exists, nothing has been opened". That
--     state is unreachable unless deals can exist before documents do.
--   • `deal_completion_state` reports "No Lessor named" / "No Lessee named" as
--     outstanding items. A deal born at execution can never show either.
--   • §4 turns DealsPage into the reporting surface for deals. A deal that only
--     appears at execution makes that page blind to every lease in flight,
--     which is precisely the population staff need to look at.
-- Execution keeps a second, idempotent call as a safety net (migration 3), so a
-- contract that predates this trigger still acquires its deal.
--
-- ONE CREATION PATH. `create_deal` is not reimplemented here: its INSERT is
-- lifted out into `ensure_deal_for_contract` and `create_deal` now calls it, so
-- there remains exactly one `INSERT INTO deals` in the whole database.

-- ── how a contract says what kind of deal it is ─────────────────────────────
-- Deliberately NOT a new classification. Every branch below reads something
-- that already exists and that some other function already trusts:
--   1. `terms->>'deal_kind'`   — what create_deal itself writes.
--   2. `terms->>'deal_side'`   — what start_lease_contract_v2 ('LEASE_IN'),
--      start_sale_contract and start_bill_of_sale_standalone ('SALE') write.
--   3. the governing document's template — the SAME predicate
--      `apply_contract_execution_effects` and `deal_autocomplete_on_execution`
--      both use, character for character.
--   4. the party roles on the contract.
-- Unclassifiable returns NULL, and NULL means no deal. A deal is never guessed
-- into a type: `deal_party_roles` and the SALE/LEASE fork in
-- `deal_completion_state` both branch on it.
CREATE OR REPLACE FUNCTION public.contract_deal_type(p_contract_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_terms jsonb;
  v_v     text;
BEGIN
  SELECT terms INTO v_terms FROM contracts WHERE id = p_contract_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- 1. the deal kind create_deal stamps on the contract it opens
  v_v := upper(coalesce(v_terms ->> 'deal_kind', ''));
  IF v_v IN ('SALE', 'LEASE') THEN RETURN v_v; END IF;

  -- 2. the deal side the three start_* functions stamp
  v_v := upper(coalesce(v_terms ->> 'deal_side', ''));
  IF v_v = 'SALE' THEN RETURN 'SALE'; END IF;
  IF v_v IN ('LEASE_IN', 'LEASE_OUT', 'LEASE') THEN RETURN 'LEASE'; END IF;

  -- 3. the governing document already on the contract
  SELECT CASE
           WHEN is_horse_lease_template(t.template_key) THEN 'LEASE'
           WHEN t.template_key = 'HORSE_PURCHASE_SALE' THEN 'SALE'
           WHEN coalesce(t.contract_kind, '') IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE') THEN 'SALE'
         END
    INTO v_v
    FROM documents d
    JOIN contract_templates t ON t.id = d.template_id
   WHERE d.contract_id = p_contract_id AND d.deleted_at IS NULL
     AND coalesce(d.workflow_state, '') <> 'void'
     AND (is_horse_lease_template(t.template_key)
          OR t.template_key = 'HORSE_PURCHASE_SALE'
          OR coalesce(t.contract_kind, '') IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE'))
   ORDER BY d.created_at
   LIMIT 1;
  IF v_v IS NOT NULL THEN RETURN v_v; END IF;

  -- 4. who is standing on each side
  SELECT CASE
           WHEN bool_or(cp.party_role IN ('LESSOR','LESSEE')) THEN 'LEASE'
           WHEN bool_or(cp.party_role IN ('BUYER','SELLER'))  THEN 'SALE'
         END
    INTO v_v
    FROM contract_parties cp WHERE cp.contract_id = p_contract_id;

  RETURN v_v;
END;
$function$;

-- ── the one place a deal row is written ─────────────────────────────────────
-- Idempotent by construction: `deals_contract_unique` is a plain UNIQUE on
-- contract_id, so a soft-deleted deal still occupies its contract. The lookup
-- therefore does NOT filter deleted_at — returning the existing id (even a
-- deleted one) is right, and re-inserting would raise.
--
-- No auth guard, deliberately: the callers are `create_deal` (which carries the
-- staff guard itself) and a trigger. Not granted to anyone; see the REVOKE.
CREATE OR REPLACE FUNCTION public.ensure_deal_for_contract(
  p_contract_id uuid,
  p_deal_type   text DEFAULT NULL,
  p_title       text DEFAULT NULL,
  p_notes       text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal uuid;
  v_type text;
  v_org  uuid;
BEGIN
  IF p_contract_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_deal FROM deals WHERE contract_id = p_contract_id;
  IF FOUND THEN
    -- a name or a note handed in later still lands on the existing container
    IF nullif(btrim(coalesce(p_title, '')), '') IS NOT NULL THEN
      UPDATE deals SET title = btrim(p_title) WHERE id = v_deal;
    END IF;
    IF nullif(btrim(coalesce(p_notes, '')), '') IS NOT NULL THEN
      UPDATE deals SET notes = btrim(p_notes) WHERE id = v_deal;
    END IF;
    RETURN v_deal;
  END IF;

  SELECT org_id INTO v_org FROM contracts WHERE id = p_contract_id;
  IF v_org IS NULL THEN RETURN NULL; END IF;

  v_type := coalesce(nullif(btrim(coalesce(p_deal_type, '')), ''),
                     contract_deal_type(p_contract_id));
  -- unclassifiable, or a type the deal layer does not know: no deal, no guess
  IF v_type IS NULL OR deal_party_roles(v_type) IS NULL THEN RETURN NULL; END IF;

  INSERT INTO deals (org_id, contract_id, deal_type, title, notes, created_by_contact_id)
    VALUES (v_org, p_contract_id, v_type,
            nullif(btrim(coalesce(p_title, '')), ''),
            nullif(btrim(coalesce(p_notes, '')), ''),
            current_contact_id())
    ON CONFLICT (contract_id) DO NOTHING
    RETURNING id INTO v_deal;

  IF v_deal IS NULL THEN
    SELECT id INTO v_deal FROM deals WHERE contract_id = p_contract_id;
  END IF;
  RETURN v_deal;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_deal_for_contract(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_deal_for_contract(uuid, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.ensure_deal_for_contract(uuid, text, text, text) FROM authenticated;

-- ── the contract births the deal ────────────────────────────────────────────
-- Isolated the way record_signature isolates its notify_staff: a deal is a
-- byproduct, and a byproduct may never roll back the thing it is a byproduct
-- of. A contract that fails to acquire a deal here still acquires one at
-- execution (migration 3) or from the backfill below.
CREATE OR REPLACE FUNCTION public.contracts_ensure_deal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    PERFORM ensure_deal_for_contract(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'contracts_ensure_deal: no deal opened for contract %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contracts_ensure_deal_trg ON public.contracts;
CREATE TRIGGER contracts_ensure_deal_trg
  AFTER INSERT ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.contracts_ensure_deal();

-- ── create_deal keeps its signature and loses its INSERT ────────────────────
-- Unchanged for its one caller. The only difference is that the deals row is
-- now written by ensure_deal_for_contract — which the INSERT above has already
-- run by the time control returns here, so this call finds it and applies the
-- title/notes the modal collected.
CREATE OR REPLACE FUNCTION public.create_deal(
  p_deal_type text,
  p_party_a_contact_ids uuid[] DEFAULT '{}',
  p_party_b_contact_ids uuid[] DEFAULT '{}',
  p_notes text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_horse_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_roles text[]; v_contract uuid; v_deal uuid; v_id uuid; v_n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to create a deal'; END IF;

  v_roles := deal_party_roles(p_deal_type);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'unknown deal type: % (expected SALE or LEASE)', p_deal_type;
  END IF;

  v_org := current_org();

  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, current_contact_id(),
            jsonb_build_object('deal_kind', p_deal_type))
    RETURNING id INTO v_contract;

  v_deal := ensure_deal_for_contract(v_contract, p_deal_type, p_title, p_notes);
  IF v_deal IS NULL THEN
    RAISE EXCEPTION 'could not open a deal for contract %', v_contract;
  END IF;

  FOREACH v_id IN ARRAY coalesce(p_party_a_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[1], v_id); v_n := v_n + 1;
  END LOOP;
  FOREACH v_id IN ARRAY coalesce(p_party_b_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[2], v_id); v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('deal_id', v_deal, 'contract_id', v_contract,
                            'deal_type', p_deal_type, 'roles', v_roles,
                            'members_added', v_n);
END;
$function$;

-- ── the contracts that predate the trigger ──────────────────────────────────
-- Additive and reversible (a deal is soft-deletable). Without it the Deals page
-- would report "no deals" over six real contracts, which is the same blindness
-- §4 exists to end.
DO $$
DECLARE r record; v_deal uuid;
BEGIN
  FOR r IN SELECT c.id FROM contracts c
            WHERE c.deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM deals d WHERE d.contract_id = c.id)
            ORDER BY c.created_at
  LOOP
    v_deal := ensure_deal_for_contract(r.id);
    IF v_deal IS NULL THEN
      RAISE NOTICE 'DEALAUTO backfill: contract % is not classifiable as a deal — skipped', r.id;
    END IF;
  END LOOP;
END $$;
