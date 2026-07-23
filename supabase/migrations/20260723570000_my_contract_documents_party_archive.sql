-- Surface the caller's per-party archive state on the documents list so a party
-- (or staff) who archived a terminated/cancelled contract can have it hidden from
-- their own list, independent of the global documents.archived_at.

DO $migration$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('my_contract_documents()'::regprocedure) INTO v_def;
  -- Add `my_archived_at` (this caller's per-party archive time) to every row. The
  -- two SELECT lists both select `... d.archived_at, d.cancelled_at,` — append the
  -- per-party lookup right after cancelled_at in each.
  v_def := replace(
    v_def,
    'd.archived_at, d.cancelled_at,',
    'd.archived_at, d.cancelled_at, (SELECT dpa.archived_at FROM document_party_archives dpa WHERE dpa.document_id = d.id AND dpa.contact_id = v_me) AS my_archived_at,'
  );
  EXECUTE v_def;
END
$migration$;
