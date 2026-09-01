/*
  # FHE Suite — Barn Ops & Inventory cost-attribution ledger
                 (U11, migration 20260630100000_mod_barnops) — module mod.barnops

  Per PLATFORM_ARCHITECTURE.md §3, §7.7, §11, §15. The crown jewel: it MIRRORS the
  contract engine exactly — logging is dumb and cheap; attribution is a deterministic,
  re-runnable function of (event × allocation) → billable_lines, just as
  generate_document is a deterministic function of (template × tokens × config).

    resources           — catalog of consumables/durables (the "what").
    resource_lots       — a purchased lot: vendor/unit_cost/on_hand depletion unit.
    consumption_events  — the DUMB, cheap, APPEND-ONLY fact. NEVER computes money.
                          REVOKE UPDATE/DELETE — mirrors an unmerged template awaiting
                          resolution. Cannot be edited once logged.
    cost_allocation_rules — the explicit OVERRIDE layer for attribution. NOT the
                          primary source of the owner/lessee split (that is
                          horse_parties, §7.6); it exists only to override a specific
                          horse/lease/board split or hold the default/barn payer.

    resolve_consumption_billing(p_period tstzrange) — the deterministic resolver RPC
                          (require_module('mod.barnops') first), a pure re-runnable
                          function of (event × derived-or-overridden allocation) →
                          billable_lines per payer per period (source_kind='consumption').

  Attribution precedence per event's horse (§7.7), evaluated at the event's occurred_at:
    1. Explicit override: an active (effective-dated) cost_allocation_rules row on the
       horse's scope ('horse'). The deliberate override.
    2. Derived from horse_parties: otherwise the effective-dated share_pct rows for
       that horse (owner/lessee/any share-bearing role) — the single source of truth.
    3. Uncovered / remainder → an EXPLICIT default/barn payer line, NEVER dropped.

  Determinism guardrails (same discipline + tests as generate_document):
    - the effective split for a horse sums to 100 (deriving from horse_parties when no
      override; routing any remainder to the barn/default payer);
    - a consumption event with no covering override AND no horse_parties share surfaces
      as an explicit default/barn line, never silently dropped;
    - re-runnable/idempotent: re-running for the same period yields the SAME lines (it
      deletes its own prior unsettled 'consumption' lines for the period first, then
      re-emits), so a second call does not double-bill.

  Seams (§2): all four tables carry
    seam 1  RESTRICTIVE org_boundary  (org_id = current_org())
    seam 2  RESTRICTIVE module_gate   (has_module('mod.barnops'))
    seam 3  PERMISSIVE access         — staff RCUD; consumption_events additionally
            APPEND-ONLY (REVOKE UPDATE/DELETE).

  Audit-trigger attachment is U14's sole responsibility (§8.3): this migration declares
  deleted_at/deleted_by + REVOKEs, but attaches NO audit trigger.

  Depends on U2 (has_module/require_module), U5 (billable_lines), U9 (horse_parties as
  the payer source).
*/

-- ============================================================
-- resources — catalog of consumables/durables (the "what")
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  resource_key    text NOT NULL,
  name            text NOT NULL,
  category        text NOT NULL CHECK (category IN ('feed','med','bedding','supply','equipment')),
  unit_of_measure text NOT NULL DEFAULT 'unit',
  is_consumable   boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  UNIQUE (org_id, resource_key)
);

DROP TRIGGER IF EXISTS resources_set_updated_at ON resources;
CREATE TRIGGER resources_set_updated_at BEFORE UPDATE ON resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- resource_lots — a purchased lot (depletion + vendor attribution unit)
-- ============================================================
CREATE TABLE IF NOT EXISTS resource_lots (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  resource_id       uuid NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  vendor_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,   -- nullable
  qty_purchased     numeric(14,4) NOT NULL DEFAULT 0,
  unit_cost         numeric(12,4) NOT NULL DEFAULT 0,
  on_hand           numeric(14,4) NOT NULL DEFAULT 0,
  purchased_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS resource_lots_set_updated_at ON resource_lots;
CREATE TRIGGER resource_lots_set_updated_at BEFORE UPDATE ON resource_lots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- consumption_events — the DUMB, cheap, APPEND-ONLY fact. NEVER computes money.
--   Mirrors an unmerged template awaiting resolution (§7.7).
-- ============================================================
CREATE TABLE IF NOT EXISTS consumption_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  resource_id     uuid NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
  resource_lot_id uuid REFERENCES resource_lots(id) ON DELETE SET NULL,   -- nullable
  horse_id        uuid REFERENCES horses(id) ON DELETE SET NULL,          -- nullable
  qty             numeric(14,4) NOT NULL DEFAULT 1,
  administered_by uuid REFERENCES profiles(user_id) ON DELETE SET NULL,   -- staff
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

-- ============================================================
-- cost_allocation_rules — the explicit OVERRIDE layer for attribution (§7.7).
--   scope_id nullable (for 'default'). It OVERRIDES the horse_parties-derived split
--   for a specific horse/lease/board, or holds the default/barn payer.
-- ============================================================
CREATE TABLE IF NOT EXISTS cost_allocation_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  scope             text NOT NULL CHECK (scope IN ('horse','lease','board','default')),
  scope_id          uuid,                                                 -- nullable for 'default'
  payer_contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  share_pct         numeric(6,3) NOT NULL DEFAULT 100,
  effective_from    date,
  effective_to      date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

DROP TRIGGER IF EXISTS cost_allocation_rules_set_updated_at ON cost_allocation_rules;
CREATE TRIGGER cost_allocation_rules_set_updated_at BEFORE UPDATE ON cost_allocation_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS resources_resource_key_idx        ON resources (resource_key);
CREATE INDEX IF NOT EXISTS resources_active_idx              ON resources (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS resource_lots_resource_idx        ON resource_lots (resource_id);
CREATE INDEX IF NOT EXISTS resource_lots_vendor_idx          ON resource_lots (vendor_contact_id) WHERE vendor_contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consumption_events_resource_idx   ON consumption_events (resource_id);
CREATE INDEX IF NOT EXISTS consumption_events_horse_idx      ON consumption_events (horse_id) WHERE horse_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS consumption_events_occurred_idx   ON consumption_events (occurred_at);
CREATE INDEX IF NOT EXISTS cost_allocation_rules_scope_idx   ON cost_allocation_rules (scope, scope_id);
CREATE INDEX IF NOT EXISTS cost_allocation_rules_payer_idx   ON cost_allocation_rules (payer_contact_id);

-- ============================================================
-- Seam 1 — tenancy boundary (RESTRICTIVE), migration-26 recipe (§8.1).
-- New tables born empty: DEFAULT current_org() + NOT NULL suffice, no backfill.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['resources','resource_lots','consumption_events','cost_allocation_rules'] LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t||'_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
  END LOOP;
END $$;

-- ============================================================
-- Seam 2 — module gate (RESTRICTIVE): mod.barnops must be ON (§8.2).
-- A disabled module's rows are invisible AND unwritable even to that org's ADMIN.
-- ============================================================
ALTER TABLE resources             ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_lots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_allocation_rules ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['resources','resource_lots','consumption_events','cost_allocation_rules'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_module_gate', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (has_module(''mod.barnops'')) WITH CHECK (has_module(''mod.barnops''))',
      t||'_module_gate', t);
  END LOOP;
END $$;

-- ============================================================
-- Seam 3 — access (PERMISSIVE): staff RCUD (§2, §7.7). "All mod.barnops tables:
-- staff RCUD". consumption_events additionally APPEND-ONLY (REVOKE UPDATE/DELETE).
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['resources','resource_lots','consumption_events','cost_allocation_rules'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_staff_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated '
      'USING (has_staff_access()) WITH CHECK (has_staff_access())',
      t||'_staff_all', t);
  END LOOP;
END $$;

-- ============================================================
-- consumption_events is DUMB + APPEND-ONLY (§7.7): REVOKE UPDATE/DELETE for everyone.
-- Once logged, a consumption fact is immutable (mirrors an unmerged template / a
-- sealed signature). Corrections are new offsetting events, never edits.
-- ============================================================
REVOKE UPDATE, DELETE ON consumption_events FROM PUBLIC, anon, authenticated;

-- ============================================================
-- resolve_consumption_billing(p_period) — the deterministic resolver RPC (§7.7).
--   SECURITY DEFINER, runs PAST RLS, so it scopes EVERY read/write to current_org()
--   explicitly. First statement: require_module('mod.barnops') (Layer B, §4.3).
--
--   Re-runnable/idempotent: deletes its own prior UNSETTLED consumption lines for the
--   period first (settled lines are sealed and skipped), then re-emits — so a second
--   call yields the SAME lines and never double-bills.
--
--   For each consumption_event in p_period (by occurred_at), for the caller's tenant:
--     amount = qty * unit_cost (from the drawn lot, else 0);
--     precedence per horse at occurred_at:
--       1. explicit override: active cost_allocation_rules scope='horse', scope_id=horse
--       2. derived: effective-dated horse_parties share_pct rows for the horse
--       3. remainder / uncovered → the default/barn payer line (NEVER dropped)
--     splits sum to 100; any shortfall routes to the default/barn payer.
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_consumption_billing(p_period tstzrange)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org          uuid := current_org();
  v_default_payer uuid;
  v_ev            record;
  v_alloc         record;
  v_unit_cost     numeric;
  v_amount        numeric;
  v_covered       numeric;
  v_remainder     numeric;
  v_lines         integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  -- Layer B (§4.3): raise cleanly if the caller's tenant lacks the module.
  PERFORM require_module('mod.barnops');

  -- The default/barn payer: the active 'default'-scoped cost_allocation_rules row for
  -- this tenant (seeded by provision_tenant, §9 step 4). Any uncovered event or
  -- share-shortfall routes here so nothing is silently dropped.
  SELECT payer_contact_id INTO v_default_payer
  FROM cost_allocation_rules
  WHERE org_id = v_org
    AND scope = 'default'
    AND deleted_at IS NULL
    AND (effective_from IS NULL OR effective_from <= now()::date)
    AND (effective_to   IS NULL OR effective_to   >= now()::date)
  ORDER BY effective_from DESC NULLS LAST
  LIMIT 1;

  -- Idempotency: clear our own prior UNSETTLED consumption lines for this period so a
  -- re-run re-emits identically. SETTLED lines are sealed (U5 trigger) and preserved.
  DELETE FROM billable_lines
  WHERE org_id = v_org
    AND source_kind = 'consumption'
    AND status = 'OPEN'
    AND period = p_period;

  -- Walk every consumption event in the period, for THIS tenant only.
  FOR v_ev IN
    SELECT ce.id, ce.resource_id, ce.resource_lot_id, ce.horse_id, ce.qty, ce.occurred_at
    FROM consumption_events ce
    WHERE ce.org_id = v_org
      AND ce.deleted_at IS NULL
      AND ce.occurred_at <@ p_period
    ORDER BY ce.occurred_at, ce.id
  LOOP
    -- money is computed HERE (the resolver), never in the dumb event.
    SELECT COALESCE(rl.unit_cost, 0) INTO v_unit_cost
    FROM resource_lots rl
    WHERE rl.id = v_ev.resource_lot_id AND rl.org_id = v_org;
    v_unit_cost := COALESCE(v_unit_cost, 0);
    v_amount    := ROUND(v_ev.qty * v_unit_cost, 2);

    v_covered := 0;

    -- Precedence 1: explicit override on the horse's scope.
    IF v_ev.horse_id IS NOT NULL THEN
      FOR v_alloc IN
        SELECT car.payer_contact_id, car.share_pct
        FROM cost_allocation_rules car
        WHERE car.org_id = v_org
          AND car.scope = 'horse'
          AND car.scope_id = v_ev.horse_id
          AND car.deleted_at IS NULL
          AND (car.effective_from IS NULL OR car.effective_from <= v_ev.occurred_at::date)
          AND (car.effective_to   IS NULL OR car.effective_to   >= v_ev.occurred_at::date)
      LOOP
        INSERT INTO billable_lines
          (org_id, payer_contact_id, source_kind, source_id, horse_id, qty, unit_amount, amount, status, period)
        VALUES
          (v_org, v_alloc.payer_contact_id, 'consumption', v_ev.id, v_ev.horse_id,
           v_ev.qty, v_unit_cost, ROUND(v_amount * v_alloc.share_pct / 100, 2), 'OPEN', p_period);
        v_covered := v_covered + v_alloc.share_pct;
        v_lines := v_lines + 1;
      END LOOP;
    END IF;

    -- Precedence 2: derived from horse_parties (the single source of truth), only if
    -- no explicit override covered the horse.
    IF v_covered = 0 AND v_ev.horse_id IS NOT NULL THEN
      FOR v_alloc IN
        SELECT hp.contact_id AS payer_contact_id, hp.share_pct
        FROM horse_parties hp
        WHERE hp.org_id = v_org
          AND hp.horse_id = v_ev.horse_id
          AND hp.deleted_at IS NULL
          AND hp.share_pct IS NOT NULL
          AND hp.share_pct > 0
          AND (hp.effective_from IS NULL OR hp.effective_from <= v_ev.occurred_at::date)
          AND (hp.effective_to   IS NULL OR hp.effective_to   >= v_ev.occurred_at::date)
      LOOP
        INSERT INTO billable_lines
          (org_id, payer_contact_id, source_kind, source_id, horse_id, qty, unit_amount, amount, status, period)
        VALUES
          (v_org, v_alloc.payer_contact_id, 'consumption', v_ev.id, v_ev.horse_id,
           v_ev.qty, v_unit_cost, ROUND(v_amount * v_alloc.share_pct / 100, 2), 'OPEN', p_period);
        v_covered := v_covered + v_alloc.share_pct;
        v_lines := v_lines + 1;
      END LOOP;
    END IF;

    -- Precedence 3: uncovered / remainder → the default/barn payer, NEVER dropped.
    -- Applies when nothing covered the event (no horse, no override, no share) OR the
    -- effective split fell short of 100.
    v_remainder := 100 - v_covered;
    IF v_remainder > 0.0005 THEN
      IF v_default_payer IS NULL THEN
        RAISE EXCEPTION
          'consumption event % has an uncovered % share but no default/barn payer is configured (seed a default-scoped cost_allocation_rule)',
          v_ev.id, v_remainder
          USING errcode = 'insufficient_privilege';
      END IF;
      INSERT INTO billable_lines
        (org_id, payer_contact_id, source_kind, source_id, horse_id, qty, unit_amount, amount, status, period)
      VALUES
        (v_org, v_default_payer, 'consumption', v_ev.id, v_ev.horse_id,
         v_ev.qty, v_unit_cost, ROUND(v_amount * v_remainder / 100, 2), 'OPEN', p_period);
      v_lines := v_lines + 1;
    END IF;
  END LOOP;

  RETURN v_lines;
END;
$fn$;
