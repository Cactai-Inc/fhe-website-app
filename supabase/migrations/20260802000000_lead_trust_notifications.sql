-- U1 — LEAD TRUST + NOTIFICATION INTEGRITY
-- Spec: u1-lead-trust-spec.md. Verify-first: every function below was rebuilt
-- as a full CREATE OR REPLACE from its LIVE pg_get_functiondef body captured
-- 2026-08-01, never string-patched and never reconstructed from a migration.
--
-- Deviations from spec, all evidence-backed and owner-ruled:
--   ITEM 3  spec said one NULL contact_type row; live count was 5. Owner ruling:
--           backfill all five to CONTACT (test-era rows, transitional value,
--           CONTACT gates nothing) and proceed to SET NOT NULL. The duplicate
--           and artifact rows go to BACKLOG pre-launch cleanup, NOT merged here.
--   ITEM 5b IntakePage reads no query params, so '?request=' is inert but
--           harmless; owner ruled to use it anyway so the resolver key stays
--           unique per request. Deep-link wiring is a BACKLOG entry.
--   ITEM 5e ANCHOR ABSENT — zero NULL-link notifications live, so 5e's own
--           done-check already passes. No producer touched. Prophylactic
--           hardening recorded in BACKLOG instead.

BEGIN;

-- ============================================================================
-- ITEM 1 — re-invites must never destroy document requirements
-- ============================================================================

-- 1a: an empty _wanted set means "no category input", never "remove everything".
-- 1c: canonicalize both sides of the category match (upper + underscores/spaces)
--     so HORSE_OWNER vs "horse owner" can never silently mismatch. The live body
--     already half-normalized (lower(replace(cat,'_',' '))); this tightens it to
--     a single canonical form applied identically to both sides.
CREATE OR REPLACE FUNCTION public.apply_category_documents(p_contact_id uuid, p_categories text[] DEFAULT NULL::text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  END IF;

  DROP TABLE IF EXISTS _wanted;
  CREATE TEMP TABLE _wanted ON COMMIT DROP AS
    SELECT DISTINCT cdr.template_key
      FROM category_document_requirements cdr
      JOIN unnest(v_cats) AS s(cat)
        -- 1c: one canonical form on BOTH sides (upper, spaces -> underscores)
        ON upper(replace(btrim(cdr.category), ' ', '_')) = upper(replace(btrim(s.cat), ' ', '_'))
     WHERE cdr.org_id = v_org;

  -- 1a: no wanted rows == no category input. Return the current count and
  -- delete NOTHING. A re-invite with empty categories must never strip the
  -- requirements an earlier invite established.
  IF NOT EXISTS (SELECT 1 FROM _wanted) THEN
    SELECT count(*) INTO v_n
      FROM contact_required_documents WHERE contact_id = p_contact_id;
    RETURN v_n;
  END IF;

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

-- 1b: an EXISTING contact with no categories passed gets no document assignment
--     at all — no GUEST default, no apply_category_documents call. The GUEST
--     default survives only for newly created contacts (GUEST pre-assigns
--     nothing by design, D8).
-- ITEM 3: when this adopts an existing contact, LEAD upgrades to CONTACT.
CREATE OR REPLACE FUNCTION public._ensure_client_account(p_org uuid, p_email text, p_first_name text, p_last_name text, p_categories text[], p_template_keys text[] DEFAULT NULL::text[], p_marker text DEFAULT 'CLIENT'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_client  uuid;
  v_email   text := lower(trim(p_email));
  v_fn      text := nullif(trim(coalesce(p_first_name, '')), '');
  v_ln      text := nullif(trim(coalesce(p_last_name,  '')), '');
  v_cats    text[];
  v_had_cats boolean;
  v_existing boolean := false;
BEGIN
  IF p_org IS NULL THEN RAISE EXCEPTION 'org is required'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'email is required'; END IF;
  IF p_marker NOT IN ('CLIENT','CUSTOMER') THEN RAISE EXCEPTION 'marker must be CLIENT or CUSTOMER'; END IF;

  SELECT array_agg(DISTINCT upper(btrim(c))) INTO v_cats
    FROM unnest(coalesce(p_categories, '{}')) c WHERE btrim(c) <> '';
  -- remember whether the CALLER supplied categories, before any defaulting
  v_had_cats := (v_cats IS NOT NULL AND array_length(v_cats, 1) IS NOT NULL);
  IF NOT v_had_cats THEN
    v_cats := ARRAY['GUEST'];  -- GUEST = no service docs pre-assigned (D8)
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_cats) c WHERE c NOT IN ('GUEST','RIDER','HORSE_OWNER')) THEN
    RAISE EXCEPTION 'categories must be a subset of GUEST/RIDER/HORSE_OWNER';
  END IF;

  -- upsert contact by email (skip contacts owned by a DIFFERENT account's profile)
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT c.is_company  -- the company contact is matched by id only, never email (D7 rule)
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (p_org, v_fn, v_ln, v_email) RETURNING id INTO v_contact;
  ELSE
    v_existing := true;
    UPDATE contacts SET
        first_name = CASE WHEN v_fn IS NOT NULL AND (NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))) THEN v_fn ELSE first_name END,
        last_name  = CASE WHEN v_ln IS NOT NULL AND NULLIF(trim(coalesce(last_name,'')),'') IS NULL
                          THEN v_ln ELSE last_name END,
        -- ITEM 3: adopting an existing contact into an account converts a LEAD
        -- into a real CONTACT. Every other type is left exactly as it is.
        contact_type = CASE WHEN contact_type = 'LEAD' THEN 'CONTACT' ELSE contact_type END
      WHERE id = v_contact;
  END IF;

  -- the clients row carries the D8 markers
  SELECT cl.id INTO v_client FROM clients cl WHERE cl.contact_id = v_contact AND cl.deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source, client_since, customer_since)
      VALUES (p_org, v_contact, 'provisioned invitation',
              CASE WHEN p_marker = 'CLIENT'   THEN now() END,
              CASE WHEN p_marker = 'CUSTOMER' THEN now() END)
      RETURNING id INTO v_client;
  ELSE
    UPDATE clients SET
        client_since   = coalesce(client_since,   CASE WHEN p_marker = 'CLIENT'   THEN now() END),
        customer_since = coalesce(customer_since, CASE WHEN p_marker = 'CUSTOMER' THEN now() END)
      WHERE id = v_client;
  END IF;

  -- groups are DERIVED — provisioning writes none; categories drive the
  -- onboarding document set only (GUEST pre-assigns nothing per D8).
  IF p_template_keys IS NOT NULL THEN
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    SELECT v_contact, k, p_org FROM unnest(p_template_keys) k WHERE btrim(k) <> ''
    ON CONFLICT DO NOTHING;
  ELSIF v_had_cats OR NOT v_existing THEN
    -- 1b: only assign documents when the caller actually named categories, or
    -- when this contact is brand new. An existing contact re-provisioned with
    -- no categories is left untouched.
    PERFORM apply_category_documents(v_contact, v_cats);
  END IF;

  RETURN jsonb_build_object('contact_id', v_contact, 'client_id', v_client);
END;
$function$;

-- ============================================================================
-- ITEM 2 — real request <-> contact link
-- ============================================================================

ALTER TABLE requests ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id);

-- the trigger already resolves-or-creates the contact and held the id only in a
-- local variable; persist it on both paths.
CREATE OR REPLACE FUNCTION public.requests_capture_contact()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_email   text := lower(nullif(trim(coalesce(NEW.contact_email, '')), ''));
BEGIN
  -- No email means nothing to dedupe on and no way to reach them; the request
  -- still stands on its own in the queue.
  IF v_email IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_contact
    FROM contacts
   WHERE lower(email) = v_email AND org_id = NEW.org_id AND deleted_at IS NULL
   ORDER BY created_at
   LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone, contact_type, notes)
    VALUES (NEW.org_id,
            nullif(trim(coalesce(NEW.contact_first_name, '')), ''),
            nullif(trim(coalesce(NEW.contact_last_name, '')), ''),
            v_email,
            nullif(trim(coalesce(NEW.contact_phone, '')), ''),
            'LEAD',
            'Captured from ' || coalesce(NEW.channel, 'inbound')
              || coalesce(' (' || NEW.category || ')', ''))
    RETURNING id INTO v_contact;
  END IF;

  -- ITEM 2: keep the link. Both paths (found-existing and created-new) persist
  -- the id, so provisioning follows a real FK instead of re-matching on email.
  NEW.contact_id := v_contact;

  RETURN NEW;
END
$function$;

-- backfill runs after the function swap, below, so the counts are reported.

-- ============================================================================
-- ITEM 3 — LEAD becomes CONTACT on conversion
-- ============================================================================
-- Owner ruling: all five live NULL rows are test-era and destined for the
-- pre-launch purge; CONTACT is the neutral type that gates nothing. The
-- Zigmund duplicate pair and the two Unnamed Contact artifacts are recorded
-- in BACKLOG for owner-decided disposal — deliberately NOT merged here
-- (d268330c is the live lessor on the reference sample draft).
UPDATE contacts SET contact_type = 'CONTACT' WHERE contact_type IS NULL;

ALTER TABLE contacts ALTER COLUMN contact_type SET DEFAULT 'CONTACT';
ALTER TABLE contacts ALTER COLUMN contact_type SET NOT NULL;

-- ============================================================================
-- ITEM 5a — kind-aware notification resolution (prerequisite for 5b/5c/5d)
-- ============================================================================
-- Existing callers pass one or two arguments and keep their current behavior
-- exactly: p_kind defaults to NULL, which resolves every kind for the link.
--
-- The old (text, uuid) signature MUST be dropped, not merely replaced: adding a
-- defaulted third parameter creates an OVERLOAD rather than replacing, and the
-- two candidates then make every existing 2-argument call ambiguous
-- ("function ... is not unique"). Verified live during this stage.
DROP FUNCTION IF EXISTS public.resolve_notifications_for_link(text, uuid);

CREATE OR REPLACE FUNCTION public.resolve_notifications_for_link(p_link text, p_actor uuid DEFAULT NULL::uuid, p_kind text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_ct integer := 0; v_n notifications%ROWTYPE;
BEGIN
  IF p_link IS NULL OR btrim(p_link) = '' THEN RETURN 0; END IF;
  FOR v_n IN SELECT * FROM notifications
              WHERE link = p_link
                AND (p_kind IS NULL OR kind = p_kind) LOOP
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
    VALUES (coalesce(p_actor, auth.uid()), 'DELETE', 'notifications', v_n.id,
      to_jsonb(v_n), jsonb_build_object('event', 'notification_resolved', 'by', 'target_resolved'));
    v_ct := v_ct + 1;
  END LOOP;
  DELETE FROM notifications WHERE link = p_link AND (p_kind IS NULL OR kind = p_kind);
  RETURN v_ct;
END;
$function$;

COMMIT;
