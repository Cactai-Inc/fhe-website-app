-- TASK-OFFERINGDOCS §3/§4 — the self-service doors carry their own paperwork,
-- and a ticked box stops being evidence.
--
-- Owner, 2026-08-24: "those tags are auto set by the purchase, the existence of a
-- file, or the existence of a record... i dont check any boxes for their tagging."
--
-- `derive_affiliations` counted THREE kinds of evidence: executed documents, the
-- purchase, and `invitations.categories` — the boxes a staff member ticked. The
-- first two are facts. The third is a guess carrying identical weight, and it is
-- the mechanism by which a tick became a legal obligation. It is removed here.
--
-- It cannot be removed alone. `/sign/<path>` provisions a CATEGORY and no
-- offering (PATH_CATEGORIES in api/sign-start.ts, p_offering_ids: []), so the tag
-- was the only thing assigning a self-service visitor their paperwork. This
-- migration gives those doors their own mapping first.
--
-- GUEST (owner's open question, decided): a visitor has no purchase, no horse, no
-- contract and no file, so nothing can derive the tag for them — which means the
-- tag cannot be what requires their documents. THE VISIT IS THE TRIGGER. The
-- guest door assigns the visitor set directly, and GUEST stays derived from the
-- executed RELEASE_GENERAL exactly as it already is. No tag is ticked anywhere.

CREATE TABLE IF NOT EXISTS sign_path_document_requirements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  path         text NOT NULL,
  template_key text NOT NULL,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sign_path_document_requirements_key
  ON sign_path_document_requirements (org_id, path, template_key);

ALTER TABLE sign_path_document_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS spdr_org_boundary ON sign_path_document_requirements;
CREATE POLICY spdr_org_boundary ON sign_path_document_requirements
  AS RESTRICTIVE TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());
DROP POLICY IF EXISTS spdr_read ON sign_path_document_requirements;
CREATE POLICY spdr_read ON sign_path_document_requirements
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS spdr_admin_write ON sign_path_document_requirements;
CREATE POLICY spdr_admin_write ON sign_path_document_requirements
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON sign_path_document_requirements TO authenticated;

-- Seed: exactly what each door assigned via its category today. `deal` carries
-- nothing — it claims an existing contract and provisions no client at all.
INSERT INTO sign_path_document_requirements (org_id, path, template_key)
SELECT o.id, x.path, x.template_key
  FROM organizations o
  CROSS JOIN (VALUES
    ('guest','COMPANY_POLICIES'), ('guest','FACILITY_RULES'), ('guest','RELEASE_GENERAL'),
    ('rider','COMPANY_POLICIES'), ('rider','FACILITY_RULES'),
    ('rider','HUMAN_EMERGENCY_MEDICAL'), ('rider','RELEASE_PARTICIPANT'),
    ('horse','COMPANY_POLICIES'), ('horse','FACILITY_RULES'),
    ('horse','HORSE_EMERGENCY_VET'), ('horse','RELEASE_HORSE_CARE'), ('horse','RELEASE_PARTICIPANT'),
    ('rider+horse','COMPANY_POLICIES'), ('rider+horse','FACILITY_RULES'),
    ('rider+horse','HUMAN_EMERGENCY_MEDICAL'), ('rider+horse','RELEASE_PARTICIPANT'),
    ('rider+horse','HORSE_EMERGENCY_VET'), ('rider+horse','RELEASE_HORSE_CARE')
  ) AS x(path, template_key)
 WHERE o.deleted_at IS NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_sign_path_documents(p_contact_id uuid, p_path text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_n integer;
BEGIN
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact % not found', p_contact_id; END IF;
  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, r.template_key, v_org
    FROM sign_path_document_requirements r
   WHERE r.org_id = v_org AND r.active AND r.path = lower(btrim(p_path))
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_n FROM contact_required_documents WHERE contact_id = p_contact_id;
  RETURN v_n;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.apply_sign_path_documents(uuid, text) TO service_role, authenticated;

-- ── A TICKED BOX IS NO LONGER EVIDENCE ────────────────────────────────────────
-- In-place rewrite: read the live body, remove the `inv` CTE and its three
-- references, re-execute. Not replayable on a fresh database.
DO $mig$
DECLARE v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'derive_affiliations';
  IF v_src IS NULL THEN RAISE EXCEPTION 'derive_affiliations not found'; END IF;
  IF position('FROM invitations i' IN v_src) = 0 THEN
    RAISE NOTICE 'the ticked-box branch is already gone — nothing to do';
    RETURN;
  END IF;

  -- the CTE itself
  v_src := regexp_replace(v_src,
    '  -- THE ADMIN''S DECISION.*?\),\s*\n(?=\s*-- THE PURCHASE)', '', 'ns');
  -- the three OR branches that read it
  v_src := replace(v_src, E'\n          OR EXISTS (SELECT 1 FROM inv WHERE cat = ''GUEST'')', '');
  v_src := replace(v_src, E'\n          OR EXISTS (SELECT 1 FROM inv WHERE cat = ''RIDER'')', '');
  v_src := replace(v_src, E'\n          OR EXISTS (SELECT 1 FROM inv WHERE cat = ''HORSE_OWNER'')', '');

  IF position('inv' IN v_src) > 0 AND position('FROM inv ' IN v_src) > 0 THEN
    RAISE EXCEPTION 'a reference to the inv CTE survived the rewrite — refusing to install';
  END IF;
  EXECUTE v_src;
END
$mig$;
