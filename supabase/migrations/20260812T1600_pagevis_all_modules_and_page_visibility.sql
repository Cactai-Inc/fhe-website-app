/*
  # TASK-PAGEVIS — every module on, and the tenant hides pages one at a time

  Owner, 2026-08-11: *"status tile is needed, i should have all modules enabled
  for FHE tenant and i need the ability to hide individual pages not be required
  to hide entire modules nor be burdened by things i wont be using."*

  ── THE TWO LAYERS STAY SEPARATE ────────────────────────────────────────────

  `org_modules.enabled`      = what the tenant is ENTITLED to. A commercial fact.
                               The PLATFORM owner sets it (set_org_module, which
                               is SUPER_ADMIN-restricted).
  `org_page_visibility`      = what the tenant CHOOSES to see. A preference. The
                               TENANT owner sets it (set_page_hidden, admin).

  A hidden page is still entitled. Nothing here ever writes `org_modules.enabled`
  to satisfy a display preference — that would revoke an entitlement to declutter
  a menu and would take the module's other pages down with it, which is precisely
  what the owner is objecting to.

  ── PART 1: every mod.* entitlement ON for French Heritage ──────────────────

  Measured before this migration: brokerage / horserecords / lessons TRUE,
  barnops / boarding / employees FALSE. This turns the three on. It is scoped to
  the org with slug 'fhe' rather than "every org", because entitlement is a
  per-tenant commercial fact and a future tenant must not inherit FHE's grants.
  The 6 `core.*` rows are the substrate (tenancy, roles, contracts, payments,
  registry, branding) — not user-facing surfaces, not touched.

  D13: this is reversible without a developer — /app/ops/admin/modules already
  renders the full catalog with a per-module toggle.

  ── PART 2: page visibility, keyed on something that survives a rename ──────

  THE DESIGN DECISION OF THIS TASK. A visibility row keyed on a ROUTE PATH stops
  applying the moment the route moves, and the page the owner put away silently
  reappears. TASK-HORSEONE is about to move /app/ops/horse-records, so this is
  not hypothetical.

  So the key is NOT a path. It is a `page_key` — a stable slug owned by the code
  registry at src/lib/pageRegistry.ts, where the path is one FIELD beside it:

      { key: 'mgmt.horses', path: '/app/ops/horse-records', label: 'Horses' }

  Renaming a route edits `path`. `key` does not move, so every stored row keeps
  applying and nothing reappears. The database never stores, compares or knows a
  route path — the CHECK below enforces the key grammar (`group.page`) and that
  is the whole contract between the two sides.

  The catalog of pages deliberately lives in CODE, not in a table: code is what
  actually creates pages, and a second copy in the database would go stale the
  first time someone adds a route. The database owns exactly one thing — which
  keys this tenant has put away.

  PRESENCE MEANS HIDDEN. There is no `hidden boolean` column, so "default is
  visible" is structural rather than a default someone can flip: a page with no
  row shows, a page added tomorrow shows, and unhiding is a DELETE. New work can
  never ship invisible.

  ── PART 3: the way back can never be closed ────────────────────────────────

  `set_page_hidden` REFUSES to hide the page-visibility settings page itself.
  The refusal is in the FUNCTION, not in the UI, because a UI-only guard is
  bypassed by one RPC call from the browser console. Everything else — including
  every other Settings page — is hideable, because the visibility page is enough
  to get all of it back.

  ── RLS ─────────────────────────────────────────────────────────────────────

  Read    any staff account, own tenant only.
  Write   tenant ADMIN, own tenant only.
  Anon    no policy and no table grant.
  D1a     admin@cactai.io (PLATFORM owner, org_id NULL by design) is DENIED
          everywhere here: every policy compares org_id against current_org(),
          which is NULL for it, and NULL never equals. set_page_hidden checks
          `v_org IS NULL` explicitly. Being denied is CORRECT for it, not a bug.
*/

-- ============================================================
-- 1. Every mod.* entitlement ON for French Heritage Equestrian.
--    core.* is the substrate and is not part of this.
-- ============================================================
UPDATE org_modules om
   SET enabled = true,
       enabled_at = now(),
       updated_at = now()
  FROM organizations o
 WHERE o.id = om.org_id
   AND o.slug = 'fhe'
   AND om.module_key LIKE 'mod.%'
   AND om.enabled IS DISTINCT FROM true;

-- ============================================================
-- 2. org_page_visibility — one row per page this tenant has put away.
--    Surrogate `id` (rather than a bare composite PK) so audit_row_change()
--    can read NEW.id/OLD.id; org_modules carries the same shape.
-- ============================================================
CREATE TABLE IF NOT EXISTS org_page_visibility (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),

  -- A code-owned stable slug, never a route path. See the header.
  page_key          text NOT NULL,

  hidden_at         timestamptz NOT NULL DEFAULT now(),
  hidden_by_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id),

  UNIQUE (org_id, page_key),

  -- The key grammar IS the contract with src/lib/pageRegistry.ts. A path can
  -- never be stored here by accident: '/app/ops/boarding' does not match.
  CONSTRAINT org_page_visibility_key_shape
    CHECK (page_key ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$')
);

CREATE INDEX IF NOT EXISTS org_page_visibility_org_idx
  ON org_page_visibility (org_id);

COMMENT ON TABLE org_page_visibility IS
  'TASK-PAGEVIS: pages this tenant has hidden from its own navigation. PRESENCE = HIDDEN; '
  'no row means visible, so a page added later ships visible. Keyed on the code-owned '
  'page_key from src/lib/pageRegistry.ts, NEVER on a route path — a rename must not orphan '
  'the row. This is a display PREFERENCE and gates nothing: hidden routes still resolve.';

COMMENT ON COLUMN org_page_visibility.page_key IS
  'Stable slug from src/lib/pageRegistry.ts (grammar: group.page). The route path lives in '
  'the code registry beside it and may change without touching this row.';

ALTER TABLE org_page_visibility ENABLE ROW LEVEL SECURITY;

-- Org boundary (codebase convention; also the D1a backstop — NULL never equals).
DROP POLICY IF EXISTS org_page_visibility_org_boundary ON org_page_visibility;
CREATE POLICY org_page_visibility_org_boundary ON org_page_visibility
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org())
  WITH CHECK (org_id = current_org());

-- Any staff account reads its own tenant's choices — the nav filter runs for
-- MANAGER/EMPLOYEE too, not just the admin who set them.
DROP POLICY IF EXISTS org_page_visibility_staff_read ON org_page_visibility;
CREATE POLICY org_page_visibility_staff_read ON org_page_visibility
  FOR SELECT TO authenticated
  USING (has_staff_access() AND org_id = current_org());

-- The tenant ADMIN decides. Same gate the Branding/Products/Forms pages use.
DROP POLICY IF EXISTS org_page_visibility_admin_write ON org_page_visibility;
CREATE POLICY org_page_visibility_admin_write ON org_page_visibility
  FOR ALL TO authenticated
  USING (is_admin() AND org_id = current_org())
  WITH CHECK (is_admin() AND org_id = current_org());

-- Supabase grants the whole public schema to anon by default. RLS already
-- denies it (no policy names anon), but the grant is removed as well so the
-- denial does not rest on a single mechanism.
REVOKE ALL ON TABLE public.org_page_visibility FROM anon;

DROP TRIGGER IF EXISTS audit_org_page_visibility ON org_page_visibility;
CREATE TRIGGER audit_org_page_visibility
  AFTER INSERT OR DELETE OR UPDATE ON org_page_visibility
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ============================================================
-- 3. my_hidden_pages() — the read seam (mirrors my_modules()).
--    SECURITY DEFINER so the nav can resolve it for any signed-in caller in the
--    tenant without depending on the staff-read policy above.
-- ============================================================
CREATE OR REPLACE FUNCTION my_hidden_pages()
RETURNS SETOF text
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT page_key
    FROM org_page_visibility
   WHERE org_id = current_org()
   ORDER BY page_key
$$;

COMMENT ON FUNCTION my_hidden_pages() IS
  'TASK-PAGEVIS: the page_keys the CALLER''S OWN tenant has hidden from its navigation. '
  'current_org()-scoped; never crosses tenants; returns nothing for a caller with no org '
  '(D1a: correct for the platform owner). A display preference — it gates no data.';

REVOKE ALL ON FUNCTION public.my_hidden_pages() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.my_hidden_pages() TO authenticated, service_role;

-- ============================================================
-- 4. set_page_hidden(page_key, hidden) — the write seam.
--    Hide = INSERT. Unhide = DELETE. Nothing is ever soft-flagged, because
--    presence is the whole meaning of a row.
-- ============================================================
CREATE OR REPLACE FUNCTION set_page_hidden(p_page_key text, p_hidden boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  /* THE ONE PAGE THAT CANNOT BE HIDDEN. Guarded here rather than in the UI: a
     UI-only guard is bypassed by one supabase.rpc() call from the console, and
     a tenant that hides its own way back needs a developer to get it — exactly
     what D13 forbids. Every OTHER page, Branding/Products/Forms included, is
     hideable, because this page brings all of them back. */
  c_protected constant text[] := ARRAY['settings.page_visibility'];
  v_org uuid := current_org();
BEGIN
  IF NOT coalesce(is_admin(), false) OR v_org IS NULL THEN
    RAISE EXCEPTION 'set_page_hidden: restricted to a tenant administrator'
      USING ERRCODE = '42501';
  END IF;

  IF p_page_key IS NULL OR p_page_key !~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$' THEN
    RAISE EXCEPTION 'set_page_hidden: % is not a page key', coalesce(p_page_key, '(null)')
      USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_hidden, false) AND p_page_key = ANY (c_protected) THEN
    RAISE EXCEPTION 'set_page_hidden: % is the page that unhides everything else and cannot be hidden', p_page_key
      USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_hidden, false) THEN
    INSERT INTO org_page_visibility (org_id, page_key)
    VALUES (v_org, p_page_key)
    ON CONFLICT (org_id, page_key) DO NOTHING;
    RETURN true;
  END IF;

  DELETE FROM org_page_visibility
   WHERE org_id = v_org AND page_key = p_page_key;
  RETURN false;
END;
$$;

COMMENT ON FUNCTION set_page_hidden(text, boolean) IS
  'TASK-PAGEVIS: the tenant admin puts a page away (true) or brings it back (false). '
  'Returns the resulting hidden state. Writes ONLY org_page_visibility — never '
  'org_modules.enabled, which is an entitlement and not a display preference. Refuses to '
  'hide settings.page_visibility so the way back always exists.';

REVOKE ALL ON FUNCTION public.set_page_hidden(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_page_hidden(text, boolean) TO authenticated, service_role;
