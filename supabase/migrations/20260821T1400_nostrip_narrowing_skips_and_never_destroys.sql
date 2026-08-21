-- TASK-NOSTRIP — NARROWING A CATEGORY MUST NEVER DESTROY REQUIRED PAPERWORK.
--
-- WHAT WAS PROVED ON PRODUCTION (TASK-CATEGORISE, rolled back):
--
--     trigger assigned:  6 documents, correct, derived from the cart
--     staff read "lessons" on the row and tick Rider  ->  ['RIDER']
--     after:             4 documents. HORSE_EMERGENCY_VET and
--                        RELEASE_HORSE_CARE DESTROYED.
--
-- No `audit_logs` row. No reason. No undo. No trace it ever happened. What is
-- destroyed is not a preference — it is the RECORD OF WHAT A PERSON WAS OBLIGED
-- TO SIGN before being on the property or handling a horse. D19's class, applied
-- to legal documents.
--
-- The whole strip was four lines in `apply_category_documents`, with no guard of
-- any kind beyond "an EMPTY category list deletes nothing":
--
--     DELETE FROM contact_required_documents crd
--      WHERE crd.contact_id = p_contact_id
--        AND crd.template_key NOT IN (SELECT template_key FROM _wanted);
--
-- CATEGORISE fixed the DERIVED path (`request_onboarding_categories` unions with
-- what the contact already holds, so a derived set can only ADD). It could not
-- fix a human deliberately choosing a narrower set. That is this migration.
--
-- ── THE SHAPE, WHICH ALREADY EXISTED ────────────────────────────────────────
-- CLOSEOUT §1.6 built `skipped_at` / `skipped_by` / `skip_reason` on
-- `contact_required_documents`, and eight readers already honour it
-- (`required_templates_for_contact`, `contact_document_wall_state`,
-- `my_onboarding_state`, `wall_onboarding_invariant_violations`,
-- `contact_required_documents_state`, `staff_assign_documents`,
-- `skip_required_document`, `unskip_required_document`). The row is RETAINED and
-- marked, with a reason, a who, and an undo that already exists.
--
--   A NARROWING SKIPS. IT NEVER DELETES.
--
-- ⚠️ D18 — there is ONE skipping body, `_skip_required_document`. Everything
-- else composes onto it: `skip_required_document` is its authorised front door,
-- and `narrow_contact_required_documents` calls it once per template. Writing
-- the UPDATE + audit a second time is the thing D18 forbids.
--
-- ── WHY `apply_category_documents` LOSES THE DELETE ENTIRELY ────────────────
-- It has FIVE callers and only one of them is a human act:
--   · `_ensure_client_account`        provisioning / adoption-by-email
--   · `provision_client_invitation`   the staff invitation
--   · `promote_buyer_from_offering`   a TRIGGER on purchase_items
--   · `redeem_contract_invitation`    a counterparty claiming a contract
--   · `request_onboarding_categories` (reads only)
-- A trigger that fires when somebody BUYS A LESSON has no business forming an
-- opinion about paperwork they already owe, and it was silently stripping it. So
-- the function becomes purely ADDITIVE for every caller. Deliberate narrowing
-- gets its own front door — `narrow_contact_required_documents` — which is
-- staff-gated, demands a reason, refuses executed evidence, skips rather than
-- deletes, and writes the audit row. An act that destroys evidence of a legal
-- obligation should have to be ASKED FOR by name, never fall out of a checkbox.
--
-- ── THE WALL ────────────────────────────────────────────────────────────────
-- Checked before building, because it decides whether skipping is sufficient:
-- `my_wall_state()` — the function that actually gates a member's session — does
-- not mention `skipped_at`, but it DELEGATES to `contact_document_wall_state()`,
-- which does. So a skipped requirement already stops blocking the person, and
-- this task needs no reconciliation of the two. Verified against the live bodies
-- (`pg_get_functiondef`, prod, 2026-08-21), not inferred.

BEGIN;

-- ── 1. THE ONE SKIPPING BODY (D18) ──────────────────────────────────────────
-- Extracted verbatim from CLOSEOUT §1.6's `skip_required_document` so that the
-- narrowing path can reuse it rather than grow a second copy. Internal: the
-- caller has already established authority. `p_actor` exists because a narrowing
-- may be performed inside another SECURITY DEFINER function whose caller is
-- service_role (auth.uid() NULL there); it defaults to auth.uid().
--
-- ⚠️ THE REASON IS REQUIRED, NOT OPTIONAL. CLOSEOUT accepted a blank one
-- (`nullif(btrim(...),'')` wrote NULL). D19 asks a value-moving act to capture
-- why, and NOSTRIP §2 states it outright — a mark on a legal requirement that
-- nobody has to explain is barely better than the delete it replaces.
CREATE OR REPLACE FUNCTION public._skip_required_document(
  p_contact_id uuid, p_template_key text, p_reason text, p_actor uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row    contact_required_documents%ROWTYPE;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_actor  uuid := coalesce(p_actor, auth.uid());
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to skip a required document';
  END IF;

  SELECT * INTO v_row FROM contact_required_documents
   WHERE contact_id = p_contact_id AND template_key = p_template_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no % requirement on this contact to skip', p_template_key;
  END IF;
  IF v_row.skipped_at IS NOT NULL THEN
    RETURN jsonb_build_object('skipped', true, 'skipped_at', v_row.skipped_at,
                              'already', true);
  END IF;

  -- Standing rule 2026-07-29, and NOSTRIP §1: an EXECUTED document is never
  -- skipped and never removed. A satisfied requirement is evidence that the
  -- obligation existed and was met — there is nothing here to skip, and marking
  -- it skipped would misstate the record.
  IF contact_document_satisfied(p_contact_id, p_template_key) THEN
    RAISE EXCEPTION 'this requirement is satisfied by an executed document and cannot be skipped';
  END IF;

  UPDATE contact_required_documents
     SET skipped_at = now(), skipped_by = v_actor, skip_reason = v_reason
   WHERE contact_id = p_contact_id AND template_key = p_template_key;

  -- Skipping is not signing: the audit shows WHO skipped it and WHEN, and the
  -- requirement row itself carries the mark. No document row is touched.
  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (v_actor, 'UPDATE', 'contact_required_documents', p_contact_id,
          jsonb_build_object('template_key', p_template_key, 'skipped_at', NULL),
          jsonb_build_object('event', 'requirement_skipped',
                             'template_key', p_template_key,
                             'skipped_at', now(),
                             'skipped_by', v_actor,
                             'reason', v_reason));

  RETURN jsonb_build_object('skipped', true, 'skipped_at', now());
END;
$function$;

REVOKE ALL ON FUNCTION public._skip_required_document(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._skip_required_document(uuid, text, text, uuid) TO service_role;

-- ── 2. THE AUTHORISED FRONT DOOR, NOW A DELEGATE ────────────────────────────
-- Same guards CLOSEOUT §1.6 shipped; the body moved into _skip_required_document
-- so the narrowing path cannot drift from it. The one behavioural change is the
-- required reason, which now lives in one place for both callers.
CREATE OR REPLACE FUNCTION public.skip_required_document(
  p_contact_id uuid, p_template_key text, p_reason text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT coalesce(has_staff_access(), false) THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;

  RETURN _skip_required_document(p_contact_id, p_template_key, p_reason, auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.skip_required_document(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.skip_required_document(uuid, text, text) TO authenticated, service_role;

-- ── 3. THE DELIBERATE NARROWING — the only door that removes a set ──────────
-- NOSTRIP §2 and §3. Staff say "this person now owes only these"; every standing
-- requirement outside that set is SKIPPED, not deleted, with the reason and the
-- actor on the row, and ONE audit row records the act as a whole.
--
-- §1 — executed evidence is refused OUTRIGHT, by name, before anything is
-- written. Not "skipped anyway", not "silently retained": the caller is told
-- which document they cannot remove and why, and the whole narrowing is
-- abandoned so a half-applied narrowing can never exist.
--
-- ⚠️ Reversal is `unskip_required_document`, which already existed — this
-- deliberately does NOT invent a second undo. `staff_assign_documents` also
-- clears a skip, and both are already wired into the Paperwork editor.
CREATE OR REPLACE FUNCTION public.narrow_contact_required_documents(
  p_contact_id uuid, p_keep_template_keys text[], p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_reason   text := nullif(btrim(coalesce(p_reason, '')), '');
  v_keep     text[] := coalesce(p_keep_template_keys, '{}');
  v_drop     text[];
  v_evidence text[];
  k          text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT coalesce(has_staff_access(), false) THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;

  -- §2 / test 6: a narrowing with no reason is REFUSED. Checked before the work
  -- so the refusal is about the act, not about whichever template sorts first.
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to remove required paperwork from someone''s record';
  END IF;

  -- What this narrowing would take away: standing (not already skipped)
  -- requirements outside the keep set.
  SELECT coalesce(array_agg(crd.template_key ORDER BY crd.template_key), '{}')
    INTO v_drop
    FROM contact_required_documents crd
   WHERE crd.contact_id = p_contact_id
     AND crd.skipped_at IS NULL
     AND crd.template_key <> ALL (v_keep);

  IF array_length(v_drop, 1) IS NULL THEN
    RETURN jsonb_build_object('skipped', '[]'::jsonb, 'kept_executed', '[]'::jsonb);
  END IF;

  -- §1 — EXECUTED PAPERWORK IS EVIDENCE AND IS NEVER REMOVED BY ANY PATH.
  SELECT coalesce(array_agg(d ORDER BY d), '{}') INTO v_evidence
    FROM unnest(v_drop) d WHERE contact_document_satisfied(p_contact_id, d);
  IF array_length(v_evidence, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'cannot remove %: satisfied by an executed document. Executed paperwork is the '
      'evidence that the obligation existed and was met, and is never removed — '
      'uncheck the rest, or leave this one on the record.',
      array_to_string(v_evidence, ', ');
  END IF;

  FOREACH k IN ARRAY v_drop LOOP
    PERFORM _skip_required_document(p_contact_id, k, v_reason, auth.uid());
  END LOOP;

  -- §3 — RECORD IT. `lesson_credits` and `bookings` are already absent from
  -- audit_logs (W10); this does not become a third silent table. One row for the
  -- narrowing ACT, naming the contact, the templates, the actor and the reason —
  -- beside the per-template rows _skip_required_document writes.
  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'contact_required_documents', p_contact_id,
          jsonb_build_object('event', 'requirements_before_narrowing',
                             'standing_templates', to_jsonb(v_drop || v_keep)),
          jsonb_build_object('event', 'requirements_narrowed',
                             'contact_id', p_contact_id,
                             'kept_templates', to_jsonb(v_keep),
                             'skipped_templates', to_jsonb(v_drop),
                             'skipped_by', auth.uid(),
                             'reason', v_reason,
                             'destroyed', false));

  RETURN jsonb_build_object('skipped', to_jsonb(v_drop), 'kept_executed', '[]'::jsonb);
END;
$function$;

COMMENT ON FUNCTION public.narrow_contact_required_documents(uuid, text[], text) IS
  'TASK-NOSTRIP: the ONLY door that removes a set of required documents from a '
  'person. It skips (retains + marks with who/when/why), never deletes; refuses '
  'without a reason; refuses outright when an executed document satisfies one of '
  'them; writes an audit_logs row. Undo is unskip_required_document.';

REVOKE ALL ON FUNCTION public.narrow_contact_required_documents(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.narrow_contact_required_documents(uuid, text[], text) TO authenticated, service_role;

-- ── 4. `apply_category_documents` IS NOW PURELY ADDITIVE ────────────────────
-- The four destroying lines are GONE. Reissued whole (not string-rewritten), so
-- this replays correctly on a fresh database.
--
-- Rule 1a is kept verbatim — an unmatched or empty category set still returns
-- the current count and touches nothing — because it is now one of two reasons
-- to do nothing rather than the only guard standing between a checkbox and a
-- destroyed legal record.
--
-- ⚠️ A requirement already in the wanted set that is SKIPPED stays skipped
-- (ON CONFLICT DO NOTHING, unchanged). Re-ticking a category must not silently
-- undo a deliberate staff skip — that is `unskip_required_document`'s job, and
-- it is on the row in the Paperwork editor. It matters most for the TRIGGER
-- caller: buying another lesson must not resurrect paperwork a staff member
-- decided this person does not owe.
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

  -- 1a: no wanted rows == no category input. Return the current count and change
  -- NOTHING. A re-invite with empty categories must never strip the requirements
  -- an earlier invite established.
  IF NOT EXISTS (SELECT 1 FROM _wanted) THEN
    SELECT count(*) INTO v_n
      FROM contact_required_documents WHERE contact_id = p_contact_id;
    RETURN v_n;
  END IF;

  -- NOSTRIP: THE DELETE THAT USED TO STAND HERE IS GONE.
  --
  --     DELETE FROM contact_required_documents crd
  --      WHERE crd.contact_id = p_contact_id
  --        AND crd.template_key NOT IN (SELECT template_key FROM _wanted);
  --
  -- It destroyed a person's standing legal requirements with no audit row, no
  -- reason, no actor and no undo, from five call sites — one of which is a
  -- trigger that fires when they buy a lesson. Assigning a category ADDS what
  -- that category requires. Taking requirements away is a separate, deliberate,
  -- reasoned act: narrow_contact_required_documents(), which skips and records.

  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, w.template_key, v_org FROM _wanted w
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_n
    FROM contact_required_documents WHERE contact_id = p_contact_id;

  RETURN v_n;
END;
$function$;

COMMENT ON FUNCTION public.apply_category_documents(uuid, text[]) IS
  'TASK-NOSTRIP: ADDITIVE ONLY. Assigning categories adds what those categories '
  'require and removes nothing, from any of its five callers. Deliberate removal '
  'is narrow_contact_required_documents(), which skips rather than deletes.';

-- ── 5. THE EDITOR'S REPLACE-SAVE STILL REMOVES, BUT NEVER EVIDENCE ──────────
-- CLOSEOUT §1.6 ruled the Paperwork editor's uncheck-and-save a legitimate
-- REMOVE: staff naming one document, deliberately, one at a time — which is the
-- opposite of a category checkbox silently reshaping a set. That stands.
--
-- What it lacked is §1 and §3: it would happily delete a requirement satisfied
-- by an EXECUTED document, and it left no trace of any removal at all.
CREATE OR REPLACE FUNCTION public.set_contact_required_documents(p_contact_id uuid, p_template_keys text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_n        integer;
  v_keep     text[] := coalesce(p_template_keys, '{}');
  v_removed  text[];
  v_evidence text[];
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN RAISE EXCEPTION 'staff access required'; END IF;
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL OR v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'contact not found in this org';
  END IF;

  SELECT coalesce(array_agg(crd.template_key ORDER BY crd.template_key), '{}')
    INTO v_removed
    FROM contact_required_documents crd
   WHERE crd.contact_id = p_contact_id
     AND crd.template_key <> ALL (v_keep);

  -- §1 — an EXECUTED requirement is never removed by ANY path. Refuse, and say
  -- which one: it is the evidence that the obligation existed and was met.
  IF array_length(v_removed, 1) IS NOT NULL THEN
    SELECT coalesce(array_agg(d ORDER BY d), '{}') INTO v_evidence
      FROM unnest(v_removed) d WHERE contact_document_satisfied(p_contact_id, d);
    IF array_length(v_evidence, 1) IS NOT NULL THEN
      RAISE EXCEPTION
        'cannot remove %: satisfied by an executed document. Executed paperwork is '
        'the evidence that the obligation existed and was met, and is never removed.',
        array_to_string(v_evidence, ', ');
    END IF;
  END IF;

  -- CLOSEOUT §1.6: delete only what left the set and insert only what joined it.
  -- The old delete-all-reinsert wiped skip marks on every editor save.
  DELETE FROM contact_required_documents
   WHERE contact_id = p_contact_id
     AND template_key <> ALL (v_keep);
  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT p_contact_id, k, v_org FROM unnest(v_keep) k
  ON CONFLICT DO NOTHING;

  -- §3 — record it. This path carries no reason (it is a checkbox, not a
  -- narrowing), so it records the actor and the names and says so.
  IF array_length(v_removed, 1) IS NOT NULL THEN
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
    VALUES (auth.uid(), 'UPDATE', 'contact_required_documents', p_contact_id,
            jsonb_build_object('event', 'requirements_before_editor_save',
                               'removed_templates', to_jsonb(v_removed)),
            jsonb_build_object('event', 'requirements_removed_in_editor',
                               'contact_id', p_contact_id,
                               'removed_templates', to_jsonb(v_removed),
                               'kept_templates', to_jsonb(v_keep),
                               'removed_by', auth.uid(),
                               'reason', NULL));
  END IF;

  SELECT count(*) INTO v_n
    FROM contact_required_documents WHERE contact_id = p_contact_id;
  RETURN v_n;
END;
$function$;

COMMIT;
