-- ─────────────────────────────────────────────────────────────────────────────
-- OWNER REVISION — THE NOTIFY MODEL. "Submit for review" becomes "Notify", and
-- the freeze rule splits in TWO, because there are two different things a party
-- can notify about:
--
--   CHANGES  = edits the author made to the DOCUMENT ITSELF (field values —
--              contract_change_log rows). These stay editable until the other
--              party OPENS THE DOCUMENT.
--   REQUESTS = change requests (contract_change_requests). These stay editable
--              until the other party SEES that specific request.
--
-- Notifying, by itself, freezes NOTHING. That is the whole point of the model:
-- the author is spared compounding corrections, and the recipient loses nothing
-- because nothing they have actually looked at can still change under them.
--
--     changes  ──notify──▶ [editable] ──counterparty OPENS DOCUMENT──▶ [frozen]
--     requests ──notify──▶ [editable] ──counterparty SEES THE REQUEST─▶ [frozen]
--
-- TWO DISTINCT TRIGGERS, both explicit client calls on a genuine view:
--   • mark_document_opened(doc)         — the counterparty actually opened and
--     rendered the document body. Not a list row, not a notification.
--   • mark_change_request_seen(ids[])   — the counterparty EXPANDED that thread.
--     Collapsed rows show a heading and a stamp, not the request content.
-- Neither is ever recorded for the actor's own authorship (you cannot freeze
-- your own work by looking at it).
--
-- ONE SOURCE OF TRUTH FOR COPY AND ENFORCEMENT (owner-mandated: "do not let the
-- copy and the rule drift"). `pending_notify_summary(document_id)` is that
-- single helper. It returns the counts and the party name that the confirmation
-- modal renders, AND the same booleans the enforcement paths test. The modal
-- cannot claim "you may edit your changes" unless this function says there are
-- unfrozen changes, because it is the same call.
--
-- SIDE NOTE FROM THE OWNER, ACTED ON HERE: no real contracts exist yet; all
-- current rows are test data due for a cleanup pass. So this migration
-- prioritises a correct final model over back-compatibility gymnastics.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── document-open ledger — the CHANGES freeze trigger ────────────────────────
CREATE TABLE IF NOT EXISTS public.document_opened (
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  contact_id  uuid        NOT NULL REFERENCES public.contacts(id),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opened_at   timestamptz NOT NULL DEFAULT now(),
  opened_role text,
  opened_label text,
  PRIMARY KEY (document_id, contact_id)
);

ALTER TABLE public.document_opened ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_opened_read ON public.document_opened;
CREATE POLICY document_opened_read ON public.document_opened
  FOR SELECT USING (
    (has_staff_access() AND org_id = current_org())
    OR caller_is_document_party(document_id));

GRANT SELECT ON public.document_opened TO authenticated;

COMMENT ON TABLE public.document_opened IS
  'One row per (document, viewer) recording that this person actually OPENED and '
  'rendered the document body. Written only by mark_document_opened. This is the '
  'freeze trigger for CHANGES (field edits): an author may keep editing the '
  'document until a counterparty has opened it.';

-- LATENT DEFECT FIXED HERE: contract_change_requests carries an RLS policy but
-- lost its table grants in the 20260729040000 rename, so `authenticated` could
-- not read it directly at all. Every app path goes through SECURITY DEFINER
-- RPCs so nothing was broken in practice, but the policy was dead letter.
GRANT SELECT ON public.contract_change_requests TO authenticated;
GRANT SELECT ON public.contract_change_request_seen TO authenticated;

-- ── mark_document_opened — the ONLY writer of the open ledger ───────────────
CREATE OR REPLACE FUNCTION public.mark_document_opened(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_cid uuid; v_role text; v_label text; v_ins int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  v_cid := current_contact_id();
  IF v_cid IS NULL THEN RETURN jsonb_build_object('opened', 0); END IF;

  SELECT role, label INTO v_role, v_label FROM comment_author_identity(p_document_id);

  -- FIRST OPEN WINS — a later visit never moves the stamp.
  INSERT INTO document_opened (document_id, contact_id, org_id, opened_role, opened_label)
  VALUES (p_document_id, v_cid, v_org, v_role, coalesce(v_label, 'A party'))
  ON CONFLICT (document_id, contact_id) DO NOTHING;
  GET DIAGNOSTICS v_ins = ROW_COUNT;

  RETURN jsonb_build_object('opened', v_ins);
END;
$function$;

-- ── document_changes_frozen — the CHANGES rule ──────────────────────────────
-- Frozen for a given author once ANY other party has opened the document.
CREATE OR REPLACE FUNCTION public.document_changes_frozen(
  p_document_id uuid, p_author_contact_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM document_opened o
     WHERE o.document_id = p_document_id
       AND o.contact_id IS DISTINCT FROM coalesce(p_author_contact_id, current_contact_id()));
$function$;

COMMENT ON FUNCTION public.document_changes_frozen(uuid, uuid) IS
  'True once a party OTHER than the author has OPENED the document. This is the '
  'freeze rule for CHANGES (field edits) — distinct from change_request_is_frozen, '
  'which freezes an individual REQUEST once that request has been SEEN.';

-- ── pending_notify_summary — THE single source of truth ─────────────────────
-- Drives the confirmation modal copy AND answers the enforcement questions, so
-- the two can never drift. "Pending" = since the last notify.
CREATE OR REPLACE FUNCTION public.pending_notify_summary(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_cid uuid; v_last timestamptz;
  v_changes int := 0; v_requests int := 0;
  v_other_role text; v_other_name text;
  v_changes_frozen boolean; v_requests_frozen boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT contact_id INTO v_cid FROM comment_author_identity(p_document_id);
  v_cid := coalesce(v_cid, current_contact_id());

  -- THE COUNTERPARTY, by ROLE name, derived from the document's own parties.
  -- Never hardcoded: whoever is not the caller is the other side.
  SELECT dp.party_role,
         initcap(lower(replace(dp.party_role, '_', ' ')))
    INTO v_other_role, v_other_name
    FROM document_parties dp
   WHERE dp.document_id = p_document_id
     AND dp.contact_id IS DISTINCT FROM v_cid
   ORDER BY dp.party_role
   LIMIT 1;
  v_other_name := coalesce(v_other_name, 'the other party');

  -- last notify by this caller on this document
  SELECT max(cr.submitted_at) INTO v_last
    FROM contract_change_requests cr
   WHERE cr.document_id = p_document_id AND cr.author_contact_id = v_cid;

  -- CHANGES pending = this caller's document edits not yet notified about
  SELECT count(*) INTO v_changes
    FROM contract_change_log cl
   WHERE cl.document_id = p_document_id
     AND cl.actor_contact_id = v_cid
     AND cl.change_kind IN ('field_value','field_structured')
     AND (v_last IS NULL OR cl.created_at > v_last);

  -- REQUESTS pending = this caller's un-notified (draft) requests
  SELECT count(*) INTO v_requests
    FROM contract_change_requests cr
   WHERE cr.document_id = p_document_id
     AND cr.parent_request_id IS NULL
     AND cr.author_contact_id = v_cid
     AND cr.submitted_at IS NULL;

  v_changes_frozen  := document_changes_frozen(p_document_id, v_cid);
  -- requests freeze individually; this reports whether ANY pending one is frozen
  v_requests_frozen := EXISTS (
    SELECT 1 FROM contract_change_requests cr
     WHERE cr.document_id = p_document_id
       AND cr.parent_request_id IS NULL
       AND cr.author_contact_id = v_cid
       AND change_request_is_frozen(cr.id));

  RETURN jsonb_build_object(
    'document_id',      p_document_id,
    'other_party_role', v_other_role,
    'other_party_name', v_other_name,
    'changes',          v_changes,
    'requests',         v_requests,
    'has_changes',      v_changes  > 0,
    'has_requests',     v_requests > 0,
    'anything',         (v_changes + v_requests) > 0,
    -- the SAME booleans the enforcement paths test
    'changes_frozen',   v_changes_frozen,
    'requests_frozen',  v_requests_frozen);
END;
$function$;

COMMENT ON FUNCTION public.pending_notify_summary(uuid) IS
  'THE single source of truth behind the Notify confirmation modal. Returns the '
  'counterparty ROLE name and the pending change/request counts the copy renders, '
  'alongside changes_frozen (document_changes_frozen) and requests_frozen '
  '(change_request_is_frozen) — the very predicates the enforcement paths test, so '
  'the modal copy and the rule cannot drift apart.';

-- ── enforce the CHANGES rule on the field-write path ────────────────────────
-- set_contract_field is the field-value writer. Once a counterparty has OPENED
-- the document, an author's changes are frozen.
-- Anchored on the existing workflow_state guard, which is unique in each body and
-- sits AFTER the document row has been loaded and BEFORE any write. The guard is
-- appended immediately after it, so a frozen document refuses the edit for the
-- same reason and in the same place a locked one does.
DO $do$
DECLARE
  v_fn text; v_src text; v_anchor text; v_guard text; v_n int;
BEGIN
  v_anchor :=
    'RAISE EXCEPTION ''document is locked (workflow_state=%): fields are read-only'', v_state;
  END IF;';

  v_guard := v_anchor || '

  -- THE CHANGES FREEZE (Notify model): an author may keep editing the document
  -- until a COUNTERPARTY has actually OPENED it. Requests freeze separately, per
  -- request, on being SEEN. Same predicate the Notify modal copy is built from.
  IF document_changes_frozen(p_document_id, NULL) THEN
    RAISE EXCEPTION ''the other party has already opened this document — your changes can no longer be edited'';
  END IF;';

  FOREACH v_fn IN ARRAY ARRAY['set_contract_field','set_field_structured'] LOOP
    SELECT pg_get_functiondef(oid) INTO v_src
      FROM pg_proc WHERE proname = v_fn AND pronamespace = 'public'::regnamespace
     LIMIT 1;

    IF v_src IS NULL THEN
      RAISE EXCEPTION '% not found — the CHANGES freeze would be unenforced', v_fn;
    END IF;
    IF position('document_changes_frozen' IN v_src) > 0 THEN
      CONTINUE;                                  -- already carries the guard
    END IF;

    v_n := (length(v_src) - length(replace(v_src, v_anchor, ''))) / length(v_anchor);
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'expected exactly one workflow_state guard in %, found %', v_fn, v_n;
    END IF;

    EXECUTE replace(v_src, v_anchor, v_guard);
  END LOOP;
END
$do$;

COMMIT;
