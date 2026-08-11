-- CONTRACTORPHAN Parts 2 and 3 — make document breakage visible, and give the owner
-- the controls to clear it himself.
--
--   Part 2: document_integrity()  — five checks, always rendered, zero counts included.
--   Part 3: can_cleanup_document() / cleanup_document() — the ops-only removal path.
--
-- Owner ruling 2026-08-10: "delete entirely and provide ui elements for me to be able
-- to see this and the functionality to be able to cleanup the mess next time".

-- ---------------------------------------------------------------------------
-- 0. Vocabulary for the cleanup trail.
--
-- Also inserted by the Part 1 migration; both are ON CONFLICT DO NOTHING so either can
-- run first. is_true_status = false ON PURPOSE — log_status_event() issues a second
-- `UPDATE documents SET current_status = …` for any code flagged true, and on a
-- document whose contract_id is orphaned that second same-transaction update re-runs
-- the foreign-key check and aborts. A cleanup is an ops event about the record, not a
-- stage of the contract lifecycle. DO NOT FLIP THIS FLAG.
-- ---------------------------------------------------------------------------
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('document', 'cleaned_up', 'Removed by cleanup', false, false, 70)
ON CONFLICT (entity_type, code) DO NOTHING;


-- ===========================================================================
-- PART 3a — can_cleanup_document(uuid)
--
-- Written in the image of can_void_document(), and deliberately STRICTER:
--   * can_void_document allows a party to void; this does NOT. Staff only —
--     cleanup is an ops action, not a party action.
--   * can_void_document only blocks a party who has themselves signed; this blocks
--     ANY live signature from ANYONE, signed or still pending. 61 executed documents
--     are evidence. There is no override, no confirm-twice, no staff bypass.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.can_cleanup_document(p_document_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_status text; v_dead boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT org_id, workflow_state, status,
         (voided_at IS NOT NULL OR terminated_at IS NOT NULL)
    INTO v_org, v_state, v_status, v_dead
    FROM documents
   WHERE id = p_document_id AND deleted_at IS NULL;

  -- unknown, already removed, or in a terminal state
  IF v_state IS NULL OR v_dead
     OR v_state IN ('executed', 'void', 'terminated')
     OR upper(coalesce(v_status, '')) IN ('EXECUTED', 'VOID', 'TERMINATED') THEN
    RETURN false;
  END IF;

  -- A document with a signature is never deletable from this UI. Ever.
  IF EXISTS (SELECT 1 FROM signatures s
              WHERE s.document_id = p_document_id
                AND s.deleted_at IS NULL) THEN
    RETURN false;
  END IF;

  RETURN has_staff_access() AND v_org = current_org();
END;
$function$;


-- ===========================================================================
-- PART 3b — cleanup_document(uuid, text)
--
-- One document at a time. There is no bulk form and one must never be added: a
-- "clean all" button over a list that includes signed documents is one mis-click
-- from destroying evidence.
--
-- Removal is the repo's soft-delete convention (documents.deleted_at) — the same
-- mechanism ensure_horse_documents already uses to sweep unsigned pending documents.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.cleanup_document(p_document_id uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc    documents%ROWTYPE;
  v_horse  text;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'a reason is required to remove a document';
  END IF;

  -- The guard is re-checked HERE, not merely consulted by the UI. A caller who
  -- reaches this function directly gets the same refusal the button does.
  IF NOT can_cleanup_document(p_document_id) THEN
    RAISE EXCEPTION 'this document cannot be removed: it is signed, executed, void, terminated, already removed, or you are not staff in this organisation';
  END IF;

  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  SELECT coalesce(h.nickname, h.registered_name) INTO v_horse
    FROM horses h WHERE h.id = v_doc.horse_id;

  UPDATE documents
     SET deleted_at = now(), deleted_by = auth.uid()
   WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'document was already removed'; END IF;

  -- Every cleanup writes a status_events row naming what was removed and why.
  -- Written with a direct INSERT rather than log_status_event() on purpose: that
  -- helper would issue a second UPDATE on the documents row for any is_true_status
  -- code, which is exactly what aborts on a document with an orphaned contract_id.
  -- The (entity_type, status) foreign key to status_events_vocab still validates the
  -- code, so nothing is lost by not going through the helper.
  INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
  VALUES (v_doc.org_id, 'document', p_document_id, 'cleaned_up',
          'Removed from the document integrity panel: '
            || coalesce(v_doc.display_code, p_document_id::text)
            || ' (' || coalesce(v_doc.title, 'untitled')
            || ', horse ' || coalesce(v_horse, 'none') || ')'
            || ' — status ' || coalesce(v_doc.status, '?')
            || ', no signatures. Reason: ' || v_reason,
          auth.uid());

  RETURN jsonb_build_object(
    'id',           p_document_id,
    'display_code', v_doc.display_code,
    'title',        v_doc.title,
    'horse',        v_horse,
    'removed_at',   now()
  );
END;
$function$;


-- ===========================================================================
-- PART 2 — document_integrity()
--
-- Five checks. Every check renders even at zero: a check that disappears when it
-- passes is a check the owner cannot trust — he needs to see that it ran.
--
-- The contact-orphan set is returned SEPARATELY, under `known`, and its items
-- deliberately carry no `can_cleanup` field at all. Those 6 are D1's stranded
-- executed documents on the owner's test identities; they leave with the owner-run
-- post-Stage-5 purge via the 5g routine, never ad hoc. No action control, ever.
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.document_integrity()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_limit  int  := 50;   -- items listed per check; `count` is always the true total
  v_checks jsonb;
  v_known  jsonb;
BEGIN
  IF v_org IS NULL OR NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;

  WITH live AS (
    SELECT d.*, coalesce(h.nickname, h.registered_name) AS horse_name
      FROM documents d
      LEFT JOIN horses h ON h.id = d.horse_id
     WHERE d.org_id = v_org AND d.deleted_at IS NULL
  ),
  findings AS (
    -- 1. contract link points at a contract row that does not exist
    SELECT 'orphan_contract'::text AS check_key, l.id, l.display_code, l.title,
           l.horse_name, l.status, l.current_status,
           'contract ' || l.contract_id::text || ' does not exist' AS detail
      FROM live l
     WHERE l.contract_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM contracts c WHERE c.id = l.contract_id)

    UNION ALL
    -- 2. horse link points at a horse that is missing or removed
    SELECT 'orphan_horse', l.id, l.display_code, l.title, l.horse_name, l.status,
           l.current_status, 'horse ' || l.horse_id::text || ' is missing or removed'
      FROM live l
     WHERE l.horse_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM horses h
                        WHERE h.id = l.horse_id AND h.deleted_at IS NULL)

    UNION ALL
    -- 4. ready to sign, but nobody is a party to it
    SELECT 'ready_no_parties', l.id, l.display_code, l.title, l.horse_name, l.status,
           l.current_status, 'ready to sign with no parties on the document'
      FROM live l
     WHERE l.current_status = 'ready_to_sign'
       AND NOT EXISTS (SELECT 1 FROM document_parties p WHERE p.document_id = l.id)

    UNION ALL
    -- 5. fewer fields than the template defines — renders an incomplete contract
    SELECT 'missing_fields', l.id, l.display_code, l.title, l.horse_name, l.status,
           l.current_status,
           (fd.defined - fv.have)::text || ' of ' || fd.defined::text
             || ' fields missing (' || t.template_key || ')'
      FROM live l
      JOIN contract_templates t ON t.id = l.template_id
      CROSS JOIN LATERAL (SELECT count(*) AS defined FROM contract_field_defs x
                           WHERE x.template_key = t.template_key) fd
      CROSS JOIN LATERAL (SELECT count(*) AS have FROM contract_fields x
                           WHERE x.document_id = l.id) fv
     WHERE fd.defined > 0 AND fv.have < fd.defined
  ),
  spec (check_key, label, why, sort_order) AS (
    VALUES
      ('orphan_contract',  'Contract link points at a contract that no longer exists',
       'The document cannot be signed — the foreign-key re-check aborts the signing transaction.', 1),
      ('orphan_horse',     'Horse link points at a horse that is missing or removed',
       'The document names a horse the system can no longer resolve.', 2),
      ('ready_no_parties', 'Ready to sign, but nobody is a party to it',
       'Nobody can sign it and nobody is notified about it.', 3),
      ('missing_fields',   'Holds fewer fields than its template defines',
       'It renders as an incomplete contract, quietly.', 4)
  ),
  listed AS (
    SELECT f.check_key,
           jsonb_agg(jsonb_build_object(
             'id',             f.id,
             'display_code',   f.display_code,
             'title',          f.title,
             'horse',          f.horse_name,
             'status',         f.status,
             'current_status', f.current_status,
             'detail',         f.detail,
             'can_cleanup',    can_cleanup_document(f.id)
           ) ORDER BY f.display_code) FILTER (WHERE f.rn <= v_limit) AS items,
           count(*) AS total
      FROM (SELECT f.*, row_number() OVER (PARTITION BY f.check_key
                                               ORDER BY f.display_code) AS rn
              FROM findings f) f
     GROUP BY f.check_key
  )
  SELECT jsonb_agg(jsonb_build_object(
           'key',   s.check_key,
           'label', s.label,
           'why',   s.why,
           'count', coalesce(l.total, 0),
           'items', coalesce(l.items, '[]'::jsonb)
         ) ORDER BY s.sort_order)
    INTO v_checks
    FROM spec s LEFT JOIN listed l ON l.check_key = s.check_key;

  -- 3. contact-orphans — reported, never actionable.
  SELECT jsonb_build_object(
           'key',   'orphan_contact',
           'label', 'Contact link points at a contact that is missing or removed',
           'note',  'Known and expected. These are the stranded executed documents on '
                    || 'the owner''s test identities. They are evidence and they leave '
                    || 'with the owner-run post-Stage-5 purge, via the 5g routine — '
                    || 'never from this panel.',
           'count', count(*),
           'items', coalesce(jsonb_agg(jsonb_build_object(
                      'id',             x.id,
                      'display_code',   x.display_code,
                      'title',          x.title,
                      'horse',          x.horse_name,
                      'status',         x.status,
                      'current_status', x.current_status,
                      'signatures',     x.sigs
                    ) ORDER BY x.status, x.display_code), '[]'::jsonb)
         )
    INTO v_known
    FROM (
      SELECT d.id, d.display_code, d.title, d.status, d.current_status,
             coalesce(h.nickname, h.registered_name) AS horse_name,
             (SELECT count(*) FROM signatures s
               WHERE s.document_id = d.id AND s.deleted_at IS NULL) AS sigs
        FROM documents d
        LEFT JOIN horses h ON h.id = d.horse_id
       WHERE d.org_id = v_org AND d.deleted_at IS NULL AND d.contact_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM contacts c
                          WHERE c.id = d.contact_id AND c.deleted_at IS NULL)
    ) x;

  RETURN jsonb_build_object(
    'checked_at',  now(),
    'item_limit',  v_limit,
    'checks',      coalesce(v_checks, '[]'::jsonb),
    'known',       v_known
  );
END;
$function$;


-- ---------------------------------------------------------------------------
-- GRANTS
--
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default. Revoke from PUBLIC first —
-- revoking from `anon` alone is the silent no-op that has bitten this repo three
-- times, because anon keeps the privilege it holds THROUGH PUBLIC.
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.can_cleanup_document(uuid)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleanup_document(uuid, text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.document_integrity()            FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_cleanup_document(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_document(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_integrity()         TO authenticated;
