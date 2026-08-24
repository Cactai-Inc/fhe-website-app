-- Repair the real accounts caught by the gap 20260824T1700 describes: created
-- through a self-service door between the migration landing and its code
-- shipping, so they hold an invitation naming a path and no paperwork at all.
--
-- Idempotent and narrow by construction: apply_sign_path_documents inserts ON
-- CONFLICT DO NOTHING, and only contacts with ZERO requirements are touched, so
-- nobody who was deliberately given an empty set is disturbed.
DO $repair$
DECLARE r RECORD; v_n int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT i.contact_id, _sign_path_for_categories(i.categories) AS path
      FROM invitations i
      JOIN contacts c ON c.id = i.contact_id AND c.deleted_at IS NULL
     WHERE i.contact_id IS NOT NULL
       AND i.deleted_at IS NULL
       AND coalesce(i.status,'') NOT IN ('revoked','superseded')
       AND i.created_at >= timestamptz '2026-08-24 00:00:00-07'
       AND _sign_path_for_categories(i.categories) <> ''
       AND NOT EXISTS (SELECT 1 FROM contact_required_documents d
                        WHERE d.contact_id = i.contact_id)
  LOOP
    PERFORM apply_sign_path_documents(r.contact_id, r.path);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE 'repaired % account(s)', v_n;
END
$repair$;
