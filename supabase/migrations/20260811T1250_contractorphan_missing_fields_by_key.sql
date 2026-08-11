-- CONTRACTORPHAN — the missing-fields check compares KEYS, not counts.
--
-- Owner ruling 2026-08-11.
--
-- The count-based check ("holds fewer rows in contract_fields than its template has
-- defs") is a proxy, and it failed in both directions:
--
--   * FALSE NEGATIVE. DOC-U4PZP54FP5 is missing 15 keys its template defines, but it
--     also holds 26 keys the template no longer defines. 125 held > 114 defined, so
--     the count test passed a document that renders an incomplete contract.
--
--   * DRIFT. HORSE_LEASE_V2 went from 128 defs to 114 mid-task while LEASEFIX was
--     working correctly. Every document's "missing" count moved because the template
--     changed, not because the documents did. A check whose output depends on
--     unrelated template edits is not a check.
--
-- Now: a field is missing when its `field_key` is defined by the template and absent
-- from the document. Both numbers are reported — keys defined but absent, and stale
-- keys held that the template no longer defines. The second is not what the check
-- fires on, but it is the other half of the picture and the owner asked to see it.

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
    -- 5. missing fields its template defines — BY KEY. Reports both numbers.
    SELECT 'missing_fields', l.id, l.display_code, l.title, l.horse_name, l.status,
           l.current_status,
           k.absent::text || ' of ' || k.defined::text || ' defined fields absent'
             || CASE WHEN s.stale > 0
                     THEN '; ' || s.stale::text || ' stale fields held'
                     ELSE '' END
             || ' (' || t.template_key || ')'
      FROM live l
      JOIN contract_templates t ON t.id = l.template_id
      CROSS JOIN LATERAL (
        SELECT count(*) AS defined,
               count(*) FILTER (
                 WHERE NOT EXISTS (SELECT 1 FROM contract_fields f
                                    WHERE f.document_id = l.id
                                      AND f.field_key = fd.field_key)) AS absent
          FROM contract_field_defs fd
         WHERE fd.template_key = t.template_key) k
      CROSS JOIN LATERAL (
        SELECT count(*) AS stale
          FROM contract_fields f
         WHERE f.document_id = l.id
           AND NOT EXISTS (SELECT 1 FROM contract_field_defs fd
                            WHERE fd.template_key = t.template_key
                              AND fd.field_key = f.field_key)) s
     WHERE k.defined > 0 AND k.absent > 0
  ),
  spec (check_key, label, why, sort_order) AS (
    VALUES
      ('orphan_contract',  'Contract link points at a contract that no longer exists',
       'The document cannot be signed — the foreign-key re-check aborts the signing transaction.', 1),
      ('orphan_horse',     'Horse link points at a horse that is missing or removed',
       'The document names a horse the system can no longer resolve.', 2),
      ('ready_no_parties', 'Ready to sign, but nobody is a party to it',
       'Nobody can sign it and nobody is notified about it.', 3),
      ('missing_fields',   'Missing fields its template defines',
       'It renders as an incomplete contract, quietly. Compared by field key, so a template edit does not move the result.', 4)
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

REVOKE ALL ON FUNCTION public.document_integrity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.document_integrity() TO authenticated;
