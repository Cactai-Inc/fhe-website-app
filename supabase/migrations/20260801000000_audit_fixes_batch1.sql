-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT FIXES — BATCH 1 (2026-08-01)
--
-- Sections applied here:
--   1. Signatures void only on an ACTUAL value change (full CREATE OR REPLACE
--      of both writers, built from the live definitions — no string patching)
--   2. contract_kind classification + the five HORSE_LEASE-keyed functions
--      repointed at it, so a HORSE_LEASE_V2 lease is no longer invisible to
--      execution effects, lock-time document bundling, vet/care document
--      assignment, expiry reminders, and sublease checks
--   3. Legacy HORSE_LEASE (v1) template + its dedicated start function retired
--   4. set_horse_locations(uuid,text,text) — the one verified-safe overload drop
--   5. ensure_contact_for_profile no longer references dropped columns
--
-- Deliberately NOT in this batch:
--   • REQ.* token resolver — it was written against `documents.request_id`,
--     which does not exist. There is no join path between a document and its
--     originating request today. Whether one should exist is a design
--     question, not a fix.
--   • sign_release / staff_assign_horse_party / _provision_purchase_for_offerings
--     overload drops — see section 4's note. The provision drop in particular
--     would have broken invite provisioning.
--   • Beau's execution-effects backfill — test data, per owner instruction.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- 1. SIGNATURES VOID ONLY ON AN ACTUAL VALUE CHANGE
-- ═════════════════════════════════════════════════════════════════════════
-- 20260731160000 placed `PERFORM void_signatures_on_edit(p_document_id)`
-- immediately after the freeze check, above the change detection. Saving a
-- field to the value it already holds therefore destroyed every signature on
-- the document: a client tabbing through a form made everyone re-sign.
--
-- Both writers are replaced in full rather than string-patched. These two
-- functions have been rewritten in place repeatedly and each layer made the
-- next more brittle; the bodies below are the live definitions as of
-- 2026-08-01 with only the void call relocated.

CREATE OR REPLACE FUNCTION public.set_contract_field(p_document_id uuid, p_field_key text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_row        contract_fields%ROWTYPE;
  v_confirmed  timestamptz;
  v_old_value  text;
  v_label      text;
  v_changed    boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role, value, label INTO v_owner_role, v_old_value, v_label
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  -- THE CHANGES FREEZE (Notify model): an author may keep editing the document
  -- until a COUNTERPARTY has actually OPENED it. Requests freeze separately, per
  -- request, on being SEEN. Same predicate the Notify modal copy is built from.
  IF document_changes_frozen(p_document_id, NULL) THEN
    RAISE EXCEPTION 'this contract is fully executed — it can no longer be edited';
  END IF;

  -- Decided before the write, while v_old_value still holds the prior value.
  v_changed := coalesce(v_old_value,'') IS DISTINCT FROM coalesce(p_value,'');

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := false;  -- H1: originator no longer grants edit rights
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND v_can_deal)
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  -- An edit changes the text a signature attested to, so any standing
  -- signature is voided. A save that writes back the identical value is not
  -- an edit and must leave signatures intact. The signer is told at the next SEND.
  IF v_changed THEN
    PERFORM void_signatures_on_edit(p_document_id);
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  -- bidirectional horse sync (contract → record): open states only, party or
  -- staff, never clobbers a differing value, idempotent when unchanged.
  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);
  END IF;

  -- audit: only log an actual change
  IF v_changed THEN
    PERFORM log_contract_change(p_document_id, 'field_value', p_field_key, v_label,
                                v_owner_role, v_old_value, p_value, '{}'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$function$;

-- set_field_structured differs in an important way: the comparable prose does
-- not exist until AFTER the write and recompose (v_new_prose is read back at
-- the end). The void call therefore cannot move into an early branch — it
-- moves to the same place the change is detected, after recomposition.
CREATE OR REPLACE FUNCTION public.set_field_structured(p_document_id uuid, p_field_key text, p_structured jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_confirmed  timestamptz;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_label      text;
  v_old_prose  text;
  v_new_prose  text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role, label, value INTO v_owner_role, v_label, v_old_prose
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  -- THE CHANGES FREEZE (Notify model): an author may keep editing the document
  -- until a COUNTERPARTY has actually OPENED it. Requests freeze separately, per
  -- request, on being SEEN. Same predicate the Notify modal copy is built from.
  IF document_changes_frozen(p_document_id, NULL) THEN
    RAISE EXCEPTION 'this contract is fully executed — it can no longer be edited';
  END IF;

  v_is_staff  := has_staff_access() AND v_org = current_org();
  v_is_orig   := false;  -- H1: originator no longer grants edit rights
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND v_can_deal)
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  UPDATE contract_fields
     SET structured = CASE WHEN p_structured = '{}'::jsonb THEN NULL ELSE p_structured END,
         updated_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  PERFORM recompose_document_fields(p_document_id);
  PERFORM remerge_contract_body(p_document_id);

  -- audit: capture the recomposed prose after the write; only log a real change
  SELECT value INTO v_new_prose FROM contract_fields
    WHERE document_id = p_document_id AND field_key = p_field_key;
  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, v_new_prose);
  END IF;
  IF coalesce(v_old_prose,'') IS DISTINCT FROM coalesce(v_new_prose,'') THEN
    -- An edit changes the text a signature attested to, so any standing
    -- signature is voided. Restructuring that recomposes to identical prose
    -- is not an edit and leaves signatures intact.
    PERFORM void_signatures_on_edit(p_document_id);
    PERFORM log_contract_change(p_document_id, 'field_structured', p_field_key, v_label,
                                v_owner_role, v_old_prose, v_new_prose,
                                jsonb_build_object('structured', p_structured));
  END IF;
END;
$function$;


-- ═════════════════════════════════════════════════════════════════════════
-- 2. CONTRACT_KIND — classify by kind, not by a literal template_key string
-- ═════════════════════════════════════════════════════════════════════════
ALTER TABLE contract_templates ADD COLUMN IF NOT EXISTS contract_kind text;

COMMENT ON COLUMN contract_templates.contract_kind IS
  'What the template IS, independent of its template_key string or version. '
  'Functions that need to know "is this a lease" must check this, never the '
  'literal key — HORSE_LEASE_V2 broke five functions still hardcoded to the '
  'v1 key string.';

UPDATE contract_templates
   SET contract_kind = CASE
     WHEN template_key LIKE 'HORSE_LEASE%'    THEN 'HORSE_LEASE'
     WHEN template_key = 'HORSE_PURCHASE_SALE' THEN 'HORSE_PURCHASE_SALE'
     ELSE contract_kind
   END
 WHERE contract_kind IS NULL;

CREATE OR REPLACE FUNCTION public.is_horse_lease_template(p_template_key text)
 RETURNS boolean
 LANGUAGE sql STABLE
AS $function$
  SELECT coalesce(
    (SELECT contract_kind = 'HORSE_LEASE' FROM contract_templates
      WHERE template_key = p_template_key
      ORDER BY version DESC LIMIT 1),
    p_template_key LIKE 'HORSE_LEASE%'  -- fallback if the template row is gone
  );
$function$;

COMMENT ON FUNCTION public.is_horse_lease_template(text) IS
  'The one place "is this template a horse lease" gets decided. Every '
  'function below was patched to call this instead of comparing against the '
  'literal string ''HORSE_LEASE'' — add a new lease template key and it is '
  'automatically covered as long as contract_kind is set correctly.';

-- 2a. apply_contract_execution_effects — the entry gate and the internal branch
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'apply_contract_execution_effects' AND pronamespace = 'public'::regnamespace;
  IF v_def IS NULL THEN RAISE NOTICE 'apply_contract_execution_effects not found'; RETURN; END IF;

  IF position('v_key NOT IN (''HORSE_LEASE'', ''HORSE_PURCHASE_SALE'')' in v_def) = 0 THEN
    RAISE NOTICE 'apply_contract_execution_effects: entry-gate literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def,
    'v_key NOT IN (''HORSE_LEASE'', ''HORSE_PURCHASE_SALE'')',
    'NOT (is_horse_lease_template(v_key) OR v_key = ''HORSE_PURCHASE_SALE'')');

  IF position('v_key = ''HORSE_LEASE''' in v_def) = 0 THEN
    RAISE NOTICE 'apply_contract_execution_effects: internal branch literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def, 'v_key = ''HORSE_LEASE''', 'is_horse_lease_template(v_key)');

  EXECUTE v_def;
  RAISE NOTICE 'apply_contract_execution_effects patched — lease execution effects now fire for HORSE_LEASE_V2';
END
$do$;

-- 2b. advance_document_workflow — the at-lock vet/care document bundling
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'advance_document_workflow' AND pronamespace = 'public'::regnamespace;
  IF v_def IS NULL THEN RAISE NOTICE 'advance_document_workflow not found'; RETURN; END IF;

  IF position('WHERE d.id = p_document_id) = ''HORSE_LEASE'' THEN' in v_def) = 0 THEN
    RAISE NOTICE 'advance_document_workflow: literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def,
    'WHERE d.id = p_document_id) = ''HORSE_LEASE'' THEN',
    'WHERE d.id = p_document_id) IS NOT NULL
       AND is_horse_lease_template((SELECT ct.template_key FROM documents d JOIN contract_templates ct ON ct.id = d.template_id WHERE d.id = p_document_id)) THEN');

  EXECUTE v_def;
  RAISE NOTICE 'advance_document_workflow patched — vet/care docs now bundle at lock for HORSE_LEASE_V2';
END
$do$;

-- 2c. ensure_horse_documents
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'ensure_horse_documents' AND pronamespace = 'public'::regnamespace;
  IF v_def IS NULL THEN RAISE NOTICE 'ensure_horse_documents not found'; RETURN; END IF;

  IF position('t.template_key = ''HORSE_LEASE''' in v_def) = 0 THEN
    RAISE NOTICE 'ensure_horse_documents: literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def, 't.template_key = ''HORSE_LEASE''', 'is_horse_lease_template(t.template_key)');

  EXECUTE v_def;
  RAISE NOTICE 'ensure_horse_documents patched';
END
$do$;

-- 2d. lease_reminder_sweep
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'lease_reminder_sweep' AND pronamespace = 'public'::regnamespace;
  IF v_def IS NULL THEN RAISE NOTICE 'lease_reminder_sweep not found'; RETURN; END IF;

  IF position('t.template_key = ''HORSE_LEASE'' AND dc.status = ''EXECUTED''' in v_def) = 0 THEN
    RAISE NOTICE 'lease_reminder_sweep: literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def,
    't.template_key = ''HORSE_LEASE'' AND dc.status = ''EXECUTED''',
    'is_horse_lease_template(t.template_key) AND dc.status = ''EXECUTED''');

  EXECUTE v_def;
  RAISE NOTICE 'lease_reminder_sweep patched — expiry reminders now fire for HORSE_LEASE_V2 leases';
END
$do$;

-- 2e. lease_sublease_allowed
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc
   WHERE proname = 'lease_sublease_allowed' AND pronamespace = 'public'::regnamespace;
  IF v_def IS NULL THEN RAISE NOTICE 'lease_sublease_allowed not found'; RETURN; END IF;

  IF position('WHERE dc.horse_id = p_horse_id AND t.template_key = ''HORSE_LEASE''' in v_def) = 0 THEN
    RAISE NOTICE 'lease_sublease_allowed: literal not found — check manually'; RETURN;
  END IF;
  v_def := replace(v_def,
    'WHERE dc.horse_id = p_horse_id AND t.template_key = ''HORSE_LEASE''',
    'WHERE dc.horse_id = p_horse_id AND is_horse_lease_template(t.template_key)');

  EXECUTE v_def;
  RAISE NOTICE 'lease_sublease_allowed patched';
END
$do$;


-- ═════════════════════════════════════════════════════════════════════════
-- 3. RETIRE THE LEGACY HORSE_LEASE (v1) TEMPLATE AND ITS START FUNCTION
-- ═════════════════════════════════════════════════════════════════════════
-- Verified 2026-08-01: HORSE_LEASE v1 has 0 documents; HORSE_LEASE_V2 has 2
-- (1 executed). Deactivate rather than delete so history stays intact.
UPDATE contract_templates
   SET active = false
 WHERE template_key = 'HORSE_LEASE' AND active;

-- Signature verified live before writing this line:
--   start_lease_contract(p_lessee_contact_id uuid, p_lessor_contact_id uuid,
--                        p_horse_id uuid, p_responsible_role text)
DROP FUNCTION IF EXISTS public.start_lease_contract(uuid, uuid, uuid, text);


-- ═════════════════════════════════════════════════════════════════════════
-- 4. DROP THE ONE VERIFIED-SAFE SHADOWED OVERLOAD
-- ═════════════════════════════════════════════════════════════════════════
-- set_horse_locations(uuid, text, text) — the legacy signature. The only
-- caller (src/lib/horses.ts:87) uses the jsonb version. Keeping both means a
-- 2-argument PostgREST call resolves by whichever argument keys happen to
-- match, and a shadowed call fails silently where an ambiguous one would error.
DROP FUNCTION IF EXISTS public.set_horse_locations(uuid, text, text);

-- NOT dropped here, deliberately:
--   • sign_release — no 14-argument overload exists; only the 26-argument
--     version is live. Nothing to drop.
--   • staff_assign_horse_party — the live signature is
--     (uuid, text, uuid, date, date, boolean, numeric, text), not the
--     3-argument one. Nothing to drop.
--   • _provision_purchase_for_offerings — the overload originally targeted
--     (…, boolean, text, text, numeric) is the one provision_client_invitation
--     calls positionally (p_mark_paid, p_payment_method) AND the one whose
--     grants are correctly scoped to authenticated/service_role. Dropping it
--     would break invite provisioning. The genuinely over-granted overload is
--     (…, text, boolean, numeric, text), which carries PUBLIC and anon — but
--     other call sites may resolve to it positionally, so it needs caller
--     verification first. Separate task.


-- ═════════════════════════════════════════════════════════════════════════
-- 5. ensure_contact_for_profile — remove references to columns profiles
--    does not have (address_line1/2, city, state, postal_code)
-- ═════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.ensure_contact_for_profile(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',  -- admin@fhequestrian.com
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',  -- hello@fhequestrian.com
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'   -- admin@cactai.io (platform)
  ]::uuid[];
  v_profile    profiles%ROWTYPE;
  v_contact_id uuid;
  v_first text;
  v_last  text;
  v_org   uuid;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_profile.contact_id IS NOT NULL THEN
    RETURN v_profile.contact_id;
  END IF;

  -- D1: protected identities never regrow a tenant bridge through this path.
  IF p_user_id = ANY(c_denied_users) THEN
    RETURN NULL;
  END IF;

  v_org := coalesce(v_profile.org_id, current_org());
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  v_first := NULLIF(trim(coalesce(v_profile.first_name, '')), '');
  v_last  := NULLIF(trim(coalesce(v_profile.last_name,  '')), '');
  IF v_first IS NULL AND v_last IS NULL THEN
    v_first := coalesce(v_profile.email, 'Unnamed Contact');
  END IF;

  IF v_profile.email IS NOT NULL THEN
    SELECT c.id INTO v_contact_id
    FROM contacts c
    WHERE lower(c.email) = lower(v_profile.email)
      AND c.org_id = v_org
      AND c.deleted_at IS NULL
      AND NOT c.is_company
      AND NOT EXISTS (SELECT 1 FROM profiles p2 WHERE p2.contact_id = c.id AND p2.user_id <> p_user_id)
    ORDER BY c.created_at
    LIMIT 1;
  END IF;

  IF v_contact_id IS NULL THEN
    -- profiles has no address columns — a contact seeded from a bare
    -- profile starts with name/email/phone only. Address, if any, lives on
    -- contacts already and is untouched by this path.
    INSERT INTO contacts (org_id, first_name, last_name, email, phone)
    VALUES (v_org, v_first, v_last, v_profile.email, v_profile.phone)
    RETURNING id INTO v_contact_id;
  END IF;

  PERFORM promote_contact_to_account(p_user_id, v_contact_id);
  RETURN v_contact_id;
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- END OF BATCH 1
-- ─────────────────────────────────────────────────────────────────────────────
