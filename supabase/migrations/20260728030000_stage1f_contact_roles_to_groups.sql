-- Stage 1f (REMEDIATION_PLAN): contact_roles → groups — affiliations only.
--
-- Model after this migration:
--   groups(contact_id, group_type)  = RIDER / HORSE_OWNER / PARENT_GUARDIAN only,
--     written SOLELY by apply_affiliations (derived from executed docs + horses).
--   CLIENT   → gone as a standing row; the neutral promotion marker is the
--              ACTIVE clients row (verified: every CLIENT-role contact already
--              has one).
--   GUEST    → gone as a standing row; guest = account with an active clients
--              row and no group (my_standing_categories() encodes it).
--   PARTICIPANT / GUARDIAN → per-document concepts (document_parties carries
--              PARTICIPANT — verified backed; guardianship persists on
--              contacts.guardian_contact_id).
--   contacts.contact_type = faceless-side classification (VENDOR /
--              TRACKED_VISITOR / WEB_SUBMITTER), nullable.
--
-- Rewired here (the complete 1e list): apply_affiliations,
-- affiliation_reconciliation, apply_category_documents (now takes explicit
-- categories), _ensure_client_account, admin_create_client (both stop writing
-- standing rows), deliver_evaluation_report, sign_release,
-- update_my_onboarding_profile (surgical removal of standing-row inserts),
-- trg_default_guest_on_client + default_guest_on_client_role (retired),
-- evaluation_reports_owner_read policy, and the FE read path moves to the new
-- my_standing_categories() RPC (same commit).

-- ── A. Retire the GUEST-default trigger ─────────────────────────────────────
DROP TRIGGER IF EXISTS trg_default_guest_on_client ON contact_roles;
DROP FUNCTION IF EXISTS default_guest_on_client_role();

-- ── B. Remove non-affiliation standing rows ─────────────────────────────────
DELETE FROM contact_roles WHERE role_type IN ('CLIENT','GUEST','PARTICIPANT','GUARDIAN');

-- ── C. Rename table / column / constraints / policies; affiliation-only CHECK ─
ALTER TABLE contact_roles RENAME TO groups;
ALTER TABLE groups RENAME COLUMN role_type TO group_type;
ALTER TABLE groups RENAME CONSTRAINT contact_roles_pkey TO groups_pkey;
ALTER TABLE groups RENAME CONSTRAINT contact_roles_contact_id_fkey TO groups_contact_id_fkey;
ALTER TABLE groups RENAME CONSTRAINT contact_roles_contact_id_role_type_key TO groups_contact_id_group_type_key;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS contact_roles_role_type_check;
ALTER TABLE groups ADD CONSTRAINT groups_group_type_check
  CHECK (group_type IN ('RIDER','HORSE_OWNER','PARENT_GUARDIAN'));

DROP POLICY IF EXISTS contact_roles_admin_write ON groups;
DROP POLICY IF EXISTS contact_roles_select ON groups;
CREATE POLICY groups_admin_write ON groups FOR ALL USING (is_admin());
CREATE POLICY groups_select ON groups FOR SELECT
  USING (is_admin() OR (contact_id = current_contact_id()));

-- ── D. Faceless-side classification ─────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type text
  CHECK (contact_type IN ('VENDOR','TRACKED_VISITOR','WEB_SUBMITTER'));

-- ── E. Helper rename: _group_role_types → _group_types ──────────────────────
DROP FUNCTION IF EXISTS _group_role_types();
CREATE OR REPLACE FUNCTION public._group_types()
RETURNS text[] LANGUAGE sql IMMUTABLE
AS $$ SELECT ARRAY['RIDER','HORSE_OWNER','PARENT_GUARDIAN']::text[] $$;

-- ── F. The sole group writer ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_affiliations(p_contact_id uuid)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_want text[] := coalesce(derive_affiliations(p_contact_id), ARRAY[]::text[]);
BEGIN
  -- add missing group rows
  INSERT INTO groups (contact_id, group_type)
  SELECT p_contact_id, g FROM unnest(v_want) g
  ON CONFLICT (contact_id, group_type) DO NOTHING;

  -- remove group rows no longer derived
  DELETE FROM groups
   WHERE contact_id = p_contact_id
     AND group_type = ANY(_group_types())
     AND group_type <> ALL(v_want);

  RETURN v_want;
END;
$function$;

-- ── G. Reconciliation proof view-function ────────────────────────────────────
DROP FUNCTION IF EXISTS affiliation_reconciliation();  -- OUT column renamed
CREATE OR REPLACE FUNCTION public.affiliation_reconciliation()
RETURNS TABLE(contact_id uuid, display_code text, name text, has_account boolean, derived_groups text[], current_groups text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code,
         nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), ''),
         (p.user_id IS NOT NULL),
         coalesce(derive_affiliations(c.id), ARRAY[]::text[]),
         coalesce((SELECT array_agg(DISTINCT g.group_type ORDER BY g.group_type)
                     FROM groups g WHERE g.contact_id = c.id),
                  ARRAY[]::text[])
    FROM contacts c
    LEFT JOIN profiles p ON p.contact_id = c.id
   WHERE c.deleted_at IS NULL
   ORDER BY nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), '');
$function$;

-- ── H. Category-driven onboarding docs: categories now come from the CALLER ─
-- (standing rows no longer exist at provision time; GUEST/RIDER/HORSE_OWNER are
-- provisioning categories, not groups). NULL falls back to current groups, else
-- GUEST when an active clients row exists.
DROP FUNCTION IF EXISTS apply_category_documents(uuid);
CREATE OR REPLACE FUNCTION public.apply_category_documents(p_contact_id uuid, p_categories text[] DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_n    integer;
  v_cats text[];
BEGIN
  SELECT org_id INTO v_org FROM contacts
   WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'contact % not found', p_contact_id;
  END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL THEN
    SELECT coalesce(array_agg(DISTINCT g.group_type), ARRAY[]::text[]) INTO v_cats
      FROM groups g WHERE g.contact_id = p_contact_id AND g.group_type IN ('RIDER','HORSE_OWNER');
    IF array_length(v_cats, 1) IS NULL
       AND EXISTS (SELECT 1 FROM clients cl WHERE cl.contact_id = p_contact_id AND cl.deleted_at IS NULL) THEN
      v_cats := ARRAY['GUEST'];
    END IF;
  END IF;

  DROP TABLE IF EXISTS _wanted;
  CREATE TEMP TABLE _wanted ON COMMIT DROP AS
    SELECT DISTINCT cdr.template_key
      FROM category_document_requirements cdr
      JOIN unnest(v_cats) AS s(cat)
        ON lower(cdr.category) = lower(replace(s.cat, '_', ' '))
     WHERE cdr.org_id = v_org;

  DELETE FROM contact_required_documents crd
   WHERE crd.contact_id = p_contact_id
     AND crd.template_key NOT IN (SELECT template_key FROM _wanted);

  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, w.template_key, v_org FROM _wanted w
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_n
    FROM contact_required_documents WHERE contact_id = p_contact_id;

  RETURN v_n;
END;
$function$;

-- ── I. Account-creation spine: no more standing-row writes ──────────────────
CREATE OR REPLACE FUNCTION public._ensure_client_account(p_org uuid, p_email text, p_first_name text, p_last_name text, p_categories text[], p_template_keys text[] DEFAULT NULL::text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_client  uuid;
  v_email   text := lower(trim(p_email));
  v_fn      text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln      text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_cats    text[];
BEGIN
  IF p_org IS NULL THEN RAISE EXCEPTION 'org is required'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  IF v_cats IS NULL OR array_length(v_cats, 1) IS NULL THEN
    v_cats := ARRAY['GUEST'];  -- redeem flows default to GUEST; admin RPC always passes explicit cats
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN
    RAISE EXCEPTION 'categories must be a subset of GUEST/RIDER/HORSE_OWNER';
  END IF;

  -- upsert contact by email (skip contacts owned by a DIFFERENT account's profile)
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (p_org, v_fn, v_ln, v_email) RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
        first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))) THEN v_fn ELSE first_name END,
        last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                          THEN v_ln ELSE last_name END
      WHERE id = v_contact;
  END IF;

  -- the ACTIVE clients row IS the neutral promotion marker (D3)
  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (p_org, v_contact, 'provisioned invitation') RETURNING id INTO v_client;
  END IF;

  -- groups are DERIVED (apply_affiliations) — provisioning writes none; the
  -- chosen categories drive the onboarding document set only.
  IF p_template_keys IS NOT NULL THEN
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT v_contact, k, p_org FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
    ON CONFLICT DO NOTHING;
  ELSE
    PERFORM apply_category_documents(v_contact, v_cats);
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_client(p_first_name text, p_last_name text, p_email text, p_phone text DEFAULT NULL::text, p_categories text[] DEFAULT '{}'::text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_client  uuid;
  v_cats    text[];
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  IF coalesce(trim(p_email), '') = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;

  -- Map display category strings to provisioning-category tokens. Only the
  -- three account categories count; anything else stays a tag only.
  SELECT array_agg(DISTINCT tok)
    INTO v_cats
    FROM (
      SELECT CASE lower(btrim(c))
               WHEN 'guest'       THEN 'GUEST'
               WHEN 'rider'       THEN 'RIDER'
               WHEN 'horse owner' THEN 'HORSE_OWNER'
               ELSE NULL END AS tok
        FROM unnest(coalesce(p_categories, '{}')) c
    ) m
   WHERE tok IS NOT NULL;

  SELECT id INTO v_contact FROM contacts
   WHERE lower(email) = lower(trim(p_email)) AND deleted_at IS NULL
   LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (first_name, last_name, email, phone, tags)
    VALUES (nullif(trim(p_first_name), ''), nullif(trim(p_last_name), ''),
            lower(trim(p_email)), nullif(trim(p_phone), ''), coalesce(p_categories, '{}'))
    RETURNING id INTO v_contact;
  ELSE
    UPDATE contacts SET
      first_name = coalesce(nullif(trim(p_first_name), ''), first_name),
      last_name  = coalesce(nullif(trim(p_last_name), ''), last_name),
      phone      = coalesce(nullif(trim(p_phone), ''), phone),
      tags = (SELECT coalesce(array_agg(DISTINCT t), '{}')
                FROM unnest(coalesce(tags, '{}') || coalesce(p_categories, '{}')) t),
      updated_at = now()
    WHERE id = v_contact;
  END IF;

  SELECT id INTO v_client FROM clients
   WHERE contact_id = v_contact AND deleted_at IS NULL LIMIT 1;
  IF v_client IS NULL THEN
    INSERT INTO clients (contact_id, status, source)
    VALUES (v_contact, 'ACTIVE', 'staff created')
    RETURNING id INTO v_client;
  END IF;

  -- groups are DERIVED — the chosen categories only materialize the
  -- onboarding document set (same spine as provisioning).
  IF v_cats IS NOT NULL AND array_length(v_cats, 1) IS NOT NULL THEN
    PERFORM apply_category_documents(v_contact, v_cats);
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$function$;

-- ── J. Evaluation-report retention gate reads groups ────────────────────────
CREATE OR REPLACE FUNCTION public.deliver_evaluation_report(p_report_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_user    uuid;
  v_consistent boolean;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT contact_id, org_id INTO v_contact, v_org FROM evaluation_reports
   WHERE id = p_report_id AND org_id = current_org();
  IF v_contact IS NULL THEN RAISE EXCEPTION 'report not found'; END IF;

  SELECT EXISTS (SELECT 1 FROM groups g
                  WHERE g.contact_id = v_contact AND g.group_type IN ('RIDER','HORSE_OWNER'))
    INTO v_consistent;

  UPDATE evaluation_reports
     SET status = 'delivered', delivered_at = now(),
         available_until = CASE WHEN v_consistent THEN NULL ELSE now() + interval '90 days' END
   WHERE id = p_report_id;

  -- ALERT the client (their account), not just staff. notifications.user_id is
  -- the account; resolve it from the report's contact.
  SELECT user_id INTO v_user FROM profiles WHERE contact_id = v_contact LIMIT 1;
  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, v_user, 'evaluation_report_ready',
            'Your horse evaluation report is ready',
            'Your evaluation report is available to review, download, or share.',
            '/app/evaluations');
  END IF;
  PERFORM notify_staff(v_org, 'evaluation_report_delivered',
    'An evaluation report was delivered', '/app/ops/oversight');

  RETURN jsonb_build_object('ok', true, 'consistent_client', v_consistent);
END;
$function$;

-- ── K. evaluation_reports RLS: the RIDER/HORSE_OWNER retention branch ───────
DROP POLICY IF EXISTS evaluation_reports_owner_read ON evaluation_reports;
CREATE POLICY evaluation_reports_owner_read ON evaluation_reports FOR SELECT
USING (
  delivered_at IS NOT NULL AND deleted_at IS NULL AND (
    (contact_id = current_contact_id()
      AND (available_until IS NULL OR available_until >= now()
           OR EXISTS (SELECT 1 FROM groups g
                       WHERE g.contact_id = current_contact_id()
                         AND g.group_type IN ('RIDER','HORSE_OWNER'))))
    OR EXISTS (SELECT 1 FROM evaluation_report_shares s
                WHERE s.report_id = evaluation_reports.id
                  AND s.shared_with_contact_id = current_contact_id())
  )
);

-- ── L. Surgical removal of standing-row inserts from the two signing paths ──
DO $$
DECLARE
  v_src text;
  v_pat_client text := 'INSERT INTO contact_roles \(contact_id, role_type\)\s+VALUES \(v_contact, ''CLIENT''\)\s+ON CONFLICT \(contact_id, role_type\) DO NOTHING;\s+IF coalesce\(p_is_minor, false\) THEN\s+INSERT INTO contact_roles \(contact_id, role_type\)\s+VALUES \(v_contact, ''GUARDIAN''\)\s+ON CONFLICT \(contact_id, role_type\) DO NOTHING;\s+END IF;';
  v_pat_part   text := 'INSERT INTO contact_roles \(contact_id, role_type\)\s+VALUES \(v_minor_c, ''PARTICIPANT''\)\s+ON CONFLICT \(contact_id, role_type\) DO NOTHING;';
BEGIN
  -- sign_release: drop the CLIENT+GUARDIAN block and the minor PARTICIPANT insert
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sign_release';
  v_src := regexp_replace(v_src, v_pat_client, '', 'g');
  v_src := regexp_replace(v_src, v_pat_part, '', 'g');
  IF v_src ILIKE '%contact_roles%' THEN
    RAISE EXCEPTION 'sign_release rewrite incomplete — contact_roles still referenced';
  END IF;
  EXECUTE v_src;

  -- update_my_onboarding_profile: drop the minor PARTICIPANT insert
  SELECT pg_get_functiondef(p.oid) INTO v_src
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'update_my_onboarding_profile';
  v_src := regexp_replace(v_src,
    'INSERT INTO contact_roles \(contact_id, role_type\)\s+VALUES \(v_minor_c, ''PARTICIPANT''\) ON CONFLICT \(contact_id, role_type\) DO NOTHING;',
    '', 'g');
  IF v_src ILIKE '%contact_roles%' THEN
    RAISE EXCEPTION 'update_my_onboarding_profile rewrite incomplete — contact_roles still referenced';
  END IF;
  EXECUTE v_src;
END $$;

-- ── M. The nav/read model: my_standing_categories() ─────────────────────────
-- Old FE read: contact_roles ∩ {GUEST,RIDER,HORSE_OWNER}. New: groups, else
-- GUEST for an active client with no group (staff stay [], restriction inert).
CREATE OR REPLACE FUNCTION public.my_standing_categories()
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_groups  text[];
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  SELECT coalesce(array_agg(DISTINCT g.group_type ORDER BY g.group_type), ARRAY[]::text[])
    INTO v_groups
    FROM groups g
   WHERE g.contact_id = v_contact AND g.group_type IN ('RIDER','HORSE_OWNER');
  IF array_length(v_groups, 1) IS NOT NULL THEN RETURN v_groups; END IF;
  IF has_staff_access() THEN RETURN ARRAY[]::text[]; END IF;
  IF EXISTS (SELECT 1 FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL) THEN
    RETURN ARRAY['GUEST'];
  END IF;
  RETURN ARRAY[]::text[];
END;
$function$;
GRANT EXECUTE ON FUNCTION public.my_standing_categories() TO authenticated;

-- ── N. Assertions: no function may reference the old names ──────────────────
DO $$
DECLARE v_bad text;
BEGIN
  SELECT string_agg(proname, ', ') INTO v_bad
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND (prosrc ILIKE '%contact_roles%' OR prosrc ILIKE '%_group_role_types%');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'old-name references remain in: %', v_bad;
  END IF;
END $$;
