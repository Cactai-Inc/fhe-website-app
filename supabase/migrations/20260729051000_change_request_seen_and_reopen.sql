-- ─────────────────────────────────────────────────────────────────────────────
-- OWNER-FINAL 2 — SOFT CLOSE + SEEN STAMPS. THIS REVERSES THE LOCK-ON-SUBMIT
-- MODEL SHIPPED IN 20260729041000.
--
-- WHAT CHANGES
--   OLD: submitting a change request froze it. `upsert_change_request` refused
--        with "this request was submitted for review and can no longer be
--        edited", and `reply_to_change_request` / `agree_change_request` refused
--        on a closed thread with no way back.
--   NEW: submission NOTIFIES but does not freeze. What freezes an entry is the
--        other party SEEING it.
--
-- THE EDITABILITY RULE (owner's rationale: it spares the author from compounding
-- inputs with follow-up corrections, costs the recipient nothing, and carries no
-- legal implication because nothing already seen can change):
--
--     authored ──▶ notified ──▶ [still editable by its author]
--                                        │
--                            other party opens the thread
--                                        ▼
--                                 SEEN recorded ──▶ [frozen]
--
-- SEEN IS PER (ENTRY, VIEWER). One row per person who has genuinely viewed an
-- entry, carrying who + when + which party role — displayed as a "Seen" stamp
-- next to the author stamp. The author's own view is never recorded: seeing your
-- own entry must not freeze it.
--
-- SOFT CLOSE, NOT A HARD LOCK. A resolved request can be REOPENED by EITHER
-- PARTY. Reopening clears resolved_at/agreed_at, records who reopened and when,
-- and therefore puts the request back in the OPEN set — which is exactly the set
-- `contract_lock_blockers` counts, so locking is blocked again with no extra
-- wiring. (Verified: contract_lock_blockers counts root rows with
-- submitted_at IS NOT NULL AND resolved_at IS NULL.)
--
-- "GENUINELY VIEWED" — THE TRIGGER (owner asked this be defined and stated):
--   Seen is recorded ONLY by an explicit `mark_change_request_seen(entry_ids[])`
--   call the client makes when a reader EXPANDS a thread — i.e. the drawer row is
--   opened and the entry bodies are actually on screen. Rendering a collapsed
--   list, or the count badge, or the notification, records nothing: those show a
--   heading and a stamp, not the request content. The DB enforces the rest:
--     • an entry authored by the caller is skipped (never self-seen);
--     • an unsubmitted DRAFT is skipped (nobody else can see it anyway);
--     • the first view wins — seen_at is never overwritten by a later re-open.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── the seen ledger ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contract_change_request_seen (
  request_id  uuid        NOT NULL REFERENCES public.contract_change_requests(id) ON DELETE CASCADE,
  contact_id  uuid        NOT NULL REFERENCES public.contacts(id),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  seen_at     timestamptz NOT NULL DEFAULT now(),
  seen_role   text,
  seen_label  text,
  PRIMARY KEY (request_id, contact_id)
);

ALTER TABLE public.contract_change_request_seen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ccrs_read ON public.contract_change_request_seen;
CREATE POLICY ccrs_read ON public.contract_change_request_seen
  FOR SELECT USING (
    (has_staff_access() AND org_id = current_org())
    OR EXISTS (SELECT 1 FROM contract_change_requests cr
                WHERE cr.id = request_id AND caller_is_document_party(cr.document_id)));

COMMENT ON TABLE public.contract_change_request_seen IS
  'One row per (entry, viewer) recording a GENUINE view of a change-request entry: '
  'who, when, and with what party role. Written only by mark_change_request_seen, '
  'which the client calls when a reader EXPANDS the thread — never on collapsed '
  'render. An entry stays editable by its author until a row appears here.';

-- ── reopen bookkeeping on the request itself ────────────────────────────────
ALTER TABLE public.contract_change_requests
  ADD COLUMN IF NOT EXISTS reopened_at            timestamptz,
  ADD COLUMN IF NOT EXISTS reopened_by_contact_id uuid REFERENCES public.contacts(id);

COMMENT ON COLUMN public.contract_change_requests.reopened_at IS
  'Last time this request was reopened after being resolved. Resolution is a SOFT '
  'close: either party may reopen, which returns the request to the open set and '
  'therefore blocks locking again via contract_lock_blockers.';

-- ── mark_change_request_seen — the ONLY writer of the seen ledger ────────────
CREATE OR REPLACE FUNCTION public.mark_change_request_seen(p_request_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cid uuid; v_doc uuid; v_n int := 0; v_ins int; r record;
  v_role text; v_label text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('seen', 0);
  END IF;

  v_cid := current_contact_id();
  IF v_cid IS NULL THEN RETURN jsonb_build_object('seen', 0); END IF;

  FOR r IN
    SELECT cr.id, cr.org_id, cr.document_id, cr.author_contact_id, cr.submitted_at
      FROM contract_change_requests cr
     WHERE cr.id = ANY(p_request_ids)
  LOOP
    -- authorisation, per document (a batch could in principle span documents)
    IF NOT ((has_staff_access() AND r.org_id = current_org())
            OR caller_is_document_party(r.document_id)) THEN
      CONTINUE;
    END IF;
    -- never self-seen: viewing your own entry must not freeze it
    IF r.author_contact_id = v_cid THEN CONTINUE; END IF;
    -- a draft is not visible to anyone else and cannot be "seen"
    IF r.submitted_at IS NULL THEN CONTINUE; END IF;

    IF v_doc IS DISTINCT FROM r.document_id THEN
      v_doc := r.document_id;
      SELECT role, label INTO v_role, v_label FROM comment_author_identity(v_doc);
    END IF;

    -- FIRST VIEW WINS — a later re-open never moves the stamp
    INSERT INTO contract_change_request_seen (request_id, contact_id, org_id, seen_role, seen_label)
    VALUES (r.id, v_cid, r.org_id, v_role, coalesce(v_label, 'A party'))
    ON CONFLICT (request_id, contact_id) DO NOTHING;

    GET DIAGNOSTICS v_ins = ROW_COUNT;
    v_n := v_n + v_ins;
  END LOOP;

  RETURN jsonb_build_object('seen', v_n);
END;
$function$;

-- ── change_request_is_frozen — the single authority on editability ───────────
-- An entry is frozen once ANYONE other than its author has recorded a view.
CREATE OR REPLACE FUNCTION public.change_request_is_frozen(p_request_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM contract_change_request_seen s
      JOIN contract_change_requests cr ON cr.id = s.request_id
     WHERE s.request_id = p_request_id
       AND s.contact_id IS DISTINCT FROM cr.author_contact_id);
$function$;

COMMENT ON FUNCTION public.change_request_is_frozen(uuid) IS
  'True once a party OTHER than the author has genuinely viewed this entry. '
  'Submission alone does NOT freeze an entry — being seen does.';

-- ── upsert_change_request — SEEN replaces SUBMITTED as the freeze ────────────
CREATE OR REPLACE FUNCTION public.upsert_change_request(
  p_document_id uuid, p_target_section text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_cid uuid; v_role text; v_label text;
  v_id uuid; v_sub timestamptz; v_body text := coalesce(trim(p_body), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, workflow_state INTO v_org, v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  SELECT contact_id, role, label INTO v_cid, v_role, v_label
    FROM comment_author_identity(p_document_id);
  IF v_cid IS NULL THEN RAISE EXCEPTION 'no contact identity for the caller'; END IF;

  SELECT id, submitted_at INTO v_id, v_sub
    FROM contract_change_requests
   WHERE document_id = p_document_id
     AND parent_request_id IS NULL
     AND author_contact_id = v_cid
     AND coalesce(target_section,'') = coalesce(nullif(trim(p_target_section),''), '')
   LIMIT 1;

  -- THE REVERSAL: submission no longer refuses the edit. Only a recorded view by
  -- the other party does.
  IF v_id IS NOT NULL AND change_request_is_frozen(v_id) THEN
    RAISE EXCEPTION 'the other party has already seen this request — it can no longer be edited';
  END IF;

  -- empty body → remove. Only allowed while it is still a private draft: once it
  -- has been submitted the other party has been told it exists, so it is
  -- withdrawn by resolving it, not by vanishing.
  IF v_body = '' THEN
    IF v_id IS NOT NULL AND v_sub IS NULL THEN
      DELETE FROM contract_change_requests WHERE id = v_id;
      RETURN jsonb_build_object('id', NULL, 'removed', true);
    END IF;
    IF v_id IS NULL THEN
      RETURN jsonb_build_object('id', NULL, 'removed', true);
    END IF;
    RAISE EXCEPTION 'this request has been submitted — resolve it rather than emptying it';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO contract_change_requests (
      org_id, document_id, parent_request_id, anchor_kind, anchor_ref,
      target_section, body, author_contact_id, author_role, author_label, impact_rank)
    VALUES (
      v_org, p_document_id, NULL,
      CASE WHEN nullif(trim(p_target_section),'') IS NULL THEN 'document' ELSE 'field' END,
      nullif(trim(p_target_section), ''),
      nullif(trim(p_target_section), ''),
      v_body, v_cid, v_role, v_label,
      change_request_impact_rank(p_target_section))
    RETURNING id INTO v_id;
  ELSE
    UPDATE contract_change_requests
       SET body = v_body, edited_at = now(), updated_at = now()
     WHERE id = v_id;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'removed', false);
END;
$function$;

-- ── edit_change_request_entry — edit ANY of my unseen entries (root or reply) ─
-- The autosave path above is keyed by (document, author, section) and only ever
-- reaches a ROOT row. Thread replies need the same unseen-editability, so they
-- get an explicit by-id edit governed by the identical rule.
CREATE OR REPLACE FUNCTION public.edit_change_request_entry(p_request_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_org uuid; v_author uuid; v_state text; v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'a body is required'; END IF;

  SELECT document_id, org_id, author_contact_id
    INTO v_doc, v_org, v_author
    FROM contract_change_requests WHERE id = p_request_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown change request'; END IF;

  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  v_cid := current_contact_id();
  IF v_author IS DISTINCT FROM v_cid THEN
    RAISE EXCEPTION 'only the author may edit this entry';
  END IF;

  SELECT workflow_state INTO v_state FROM documents WHERE id = v_doc AND deleted_at IS NULL;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  IF change_request_is_frozen(p_request_id) THEN
    RAISE EXCEPTION 'the other party has already seen this entry — it can no longer be edited';
  END IF;

  UPDATE contract_change_requests
     SET body = trim(p_body), edited_at = now(), updated_at = now()
   WHERE id = p_request_id;

  RETURN jsonb_build_object('id', p_request_id, 'edited', true);
END;
$function$;

-- ── resolve / reopen — the SOFT close ────────────────────────────────────────
-- agree_change_request already toggles both ways (p_agreed=false clears the
-- close). It is rewritten here to (a) record reopen provenance and (b) drop the
-- "closed thread" dead end, so either party can genuinely reopen.
CREATE OR REPLACE FUNCTION public.agree_change_request(p_request_id uuid, p_agreed boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_doc uuid; v_org uuid; v_parent uuid; v_sub timestamptz; v_cid uuid; v_yes boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_yes := coalesce(p_agreed, true);

  SELECT document_id, org_id, parent_request_id, submitted_at
    INTO v_doc, v_org, v_parent, v_sub
    FROM contract_change_requests WHERE id = p_request_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown change request'; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'close the thread on its first entry'; END IF;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'this request has not been submitted for review yet'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  v_cid := current_contact_id();

  IF v_yes THEN
    UPDATE contract_change_requests
       SET resolved_at            = now(),
           resolved_by_contact_id = v_cid,
           agreed_at              = now(),
           agreed_by_contact_id   = v_cid,
           updated_at             = now()
     WHERE id = p_request_id;
  ELSE
    -- REOPEN — either party. Back into the open set, so locking blocks again.
    UPDATE contract_change_requests
       SET resolved_at            = NULL,
           resolved_by_contact_id = NULL,
           agreed_at              = NULL,
           agreed_by_contact_id   = NULL,
           reopened_at            = now(),
           reopened_by_contact_id = v_cid,
           updated_at             = now()
     WHERE id = p_request_id;
  END IF;

  RETURN jsonb_build_object('id', p_request_id, 'agreed', v_yes, 'reopened', NOT v_yes);
END;
$function$;

-- explicit, self-describing verbs over the same machinery
CREATE OR REPLACE FUNCTION public.resolve_change_request_thread(p_request_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $function$ SELECT agree_change_request(p_request_id, true); $function$;

CREATE OR REPLACE FUNCTION public.reopen_change_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER
SET search_path TO 'public'
AS $function$ SELECT agree_change_request(p_request_id, false); $function$;

COMMENT ON FUNCTION public.reopen_change_request(uuid) IS
  'Either party reopens a resolved request. Records who + when, clears the close, '
  'and returns the request to the open set — which contract_lock_blockers counts, '
  'so locking is blocked again.';

-- ── reply_to_change_request — a resolved thread is reopenable, not a dead end ─
CREATE OR REPLACE FUNCTION public.reply_to_change_request(p_request_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc uuid; v_org uuid; v_sub timestamptz; v_parent uuid;
  v_state text; v_cid uuid; v_role text; v_label text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF coalesce(trim(p_body),'') = '' THEN RAISE EXCEPTION 'a reply body is required'; END IF;

  SELECT document_id, org_id, submitted_at, parent_request_id
    INTO v_doc, v_org, v_sub, v_parent
    FROM contract_change_requests WHERE id = p_request_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown change request'; END IF;
  IF v_parent IS NOT NULL THEN RAISE EXCEPTION 'reply on the thread''s first entry'; END IF;
  IF v_sub IS NULL THEN RAISE EXCEPTION 'this request has not been submitted for review yet'; END IF;

  SELECT workflow_state INTO v_state FROM documents WHERE id = v_doc AND deleted_at IS NULL;
  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'this document is % — it is no longer open to change requests', v_state;
  END IF;

  IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(v_doc)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  SELECT contact_id, role, label INTO v_cid, v_role, v_label FROM comment_author_identity(v_doc);

  INSERT INTO contract_change_requests (
    org_id, document_id, parent_request_id, anchor_kind, body,
    author_contact_id, author_role, author_label, submitted_at)
  VALUES (v_org, v_doc, p_request_id, 'document', trim(p_body),
          v_cid, v_role, v_label, now())
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- ── the read model — carry seen + reopen + editability to the client ─────────
CREATE OR REPLACE FUNCTION public.contract_change_requests_list(p_document_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.created_at), '[]'::jsonb)
  FROM (
    SELECT cr.id, cr.parent_request_id, cr.anchor_kind, cr.anchor_ref,
           cr.target_section, cr.annotation_number, cr.impact_rank,
           cr.quote, cr.quote_prefix, cr.is_stale, cr.needs_review, cr.body,
           cr.author_label, cr.author_role, cr.author_contact_id,
           cr.submitted_at, cr.agreed_at, cr.resolved_at, cr.edited_at, cr.created_at,
           cr.reopened_at, cr.reopened_by_contact_id,
           coalesce(sd.heading, 'The whole document') AS section_heading,
           -- SEEN stamps: everyone other than the author who has viewed this entry
           coalesce((
             SELECT jsonb_agg(jsonb_build_object(
                      'contact_id', s.contact_id, 'seen_at', s.seen_at,
                      'role', s.seen_role, 'label', s.seen_label)
                    ORDER BY s.seen_at)
               FROM contract_change_request_seen s
              WHERE s.request_id = cr.id
                AND s.contact_id IS DISTINCT FROM cr.author_contact_id), '[]'::jsonb) AS seen_by,
           -- frozen = somebody other than the author has seen it
           EXISTS (SELECT 1 FROM contract_change_request_seen s2
                    WHERE s2.request_id = cr.id
                      AND s2.contact_id IS DISTINCT FROM cr.author_contact_id) AS is_frozen,
           -- can the CALLER still edit this entry? (author + not yet seen)
           (cr.author_contact_id = current_contact_id()
            AND NOT EXISTS (SELECT 1 FROM contract_change_request_seen s3
                             WHERE s3.request_id = cr.id
                               AND s3.contact_id IS DISTINCT FROM cr.author_contact_id)) AS can_edit
      FROM contract_change_requests cr
      LEFT JOIN documents d ON d.id = cr.document_id
      LEFT JOIN contract_templates ct ON ct.id = d.template_id
      LEFT JOIN contract_section_defs sd
             ON sd.template_key = ct.template_key AND sd.section_key = cr.target_section
     WHERE cr.document_id = p_document_id
       AND ((cr.org_id = current_org() AND has_staff_access())
            OR caller_is_document_party(p_document_id))
  ) t;
$function$;

COMMIT;
