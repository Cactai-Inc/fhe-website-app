-- Stage 1g (REMEDIATION_PLAN): drop members.tier — vestigial, always
-- 'community'. The word "tier" stays reserved for a future real
-- membership-with-tiers product (D4). is_active_member() reads members.status
-- only (verified pre-migration); the gate's inputs are untouched here.
--
-- Rewired (complete 1e list for members.tier): ensure_my_member_access,
-- redeem_invitation (INSERTs lose the tier column), admin_client_overview
-- (jsonb loses the tier key), the memberships compatibility VIEW (recreated
-- without tier). provision_tenant / set_org_module reference the ORG-level
-- `tiers` table (tenant plans) — a different concept, untouched.

-- Guard: the column must be vestigial in fact, not by assumption.
DO $$
DECLARE v_distinct int;
BEGIN
  SELECT count(DISTINCT tier) INTO v_distinct FROM members WHERE tier IS NOT NULL;
  IF v_distinct > 1 THEN
    RAISE EXCEPTION 'members.tier carries % distinct values — not vestigial, aborting', v_distinct;
  END IF;
END $$;

-- Surgical rewrites: drop tier from the two INSERTs and the overview jsonb.
DO $$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='ensure_my_member_access';
  v_src := replace(v_src,
    'INSERT INTO members (user_id, tier, status, org_id)',
    'INSERT INTO members (user_id, status, org_id)');
  v_src := replace(v_src,
    'VALUES (auth.uid(), ''community'', ''active'', v_org)',
    'VALUES (auth.uid(), ''active'', v_org)');
  IF v_src ILIKE '%tier%' THEN RAISE EXCEPTION 'ensure_my_member_access rewrite incomplete'; END IF;
  EXECUTE v_src;

  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='redeem_invitation';
  v_src := replace(v_src,
    'INSERT INTO members (user_id, tier, status)',
    'INSERT INTO members (user_id, status)');
  v_src := replace(v_src,
    'VALUES (auth.uid(), ''community'', ''active'')',
    'VALUES (auth.uid(), ''active'')');
  IF v_src ILIKE '%tier%' THEN RAISE EXCEPTION 'redeem_invitation rewrite incomplete'; END IF;
  EXECUTE v_src;

  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND p.proname='admin_client_overview';
  v_src := replace(v_src,
    'jsonb_build_object(''tier'', m.tier, ''status'', m.status,',
    'jsonb_build_object(''status'', m.status,');
  IF v_src ILIKE '%m.tier%' THEN RAISE EXCEPTION 'admin_client_overview rewrite incomplete'; END IF;
  EXECUTE v_src;
END $$;

-- Compatibility view loses the column, then the column goes. (DROP + CREATE:
-- a view cannot lose a column via CREATE OR REPLACE, and the column cannot be
-- dropped while the view depends on it.)
DROP VIEW memberships;
ALTER TABLE members DROP COLUMN tier;
CREATE VIEW memberships AS
  SELECT id, user_id, status, started_at, renews_at, created_at, org_id FROM members;
GRANT ALL ON memberships TO anon, authenticated, service_role; -- matches the prior view's ACL exactly

-- Assertion: no live function references members.tier any more.
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname='public' AND prosrc ~* '\mm\.tier\M|members\.tier|\(user_id, tier';
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'members.tier references remain in: %', v_bad;
  END IF;
END $$;
