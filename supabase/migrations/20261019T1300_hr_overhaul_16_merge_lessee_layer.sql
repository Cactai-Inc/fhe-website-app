-- horse_page_detail returns the lessee layer alongside the owner's record: the
-- owner/staff see every non-hidden lessee entry, each marked with the author's name
-- and lease origin. The owner's own data is returned unchanged; this is an additive
-- view, never a merge into the owner's columns.

DO $m$
DECLARE
  v_def text;
  v_old text := $q$      FROM purchases pu WHERE pu.horse_id = p_horse_id AND pu.deleted_at IS NULL), '[]'::jsonb)
  );
  RETURN v_out;$q$;
  v_new text := $q$      FROM purchases pu WHERE pu.horse_id = p_horse_id AND pu.deleted_at IS NULL), '[]'::jsonb),
    -- the lessee layer: entries a (current or former) lessee created, attributed to
    -- them, each marked with the author's name. Hidden-by-owner entries are omitted
    -- from this (owner/staff) view. The owner's own lists above are untouched.
    'lessee_entries', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', e.id, 'kind', e.kind, 'data', e.data, 'created_at', e.created_at,
        'hidden', e.hidden_by_owner,
        'author', coalesce(nullif(btrim(c.first_name||' '||c.last_name),''), c.email, 'Lessee'),
        'author_contact_id', e.author_contact_id)
        ORDER BY e.created_at DESC)
      FROM horse_lessee_entries e
      JOIN contacts c ON c.id = e.author_contact_id
      WHERE e.horse_id = p_horse_id AND e.deleted_at IS NULL
        AND NOT e.hidden_by_owner), '[]'::jsonb)
  );
  RETURN v_out;$q$;
BEGIN
  SELECT pg_get_functiondef('public.horse_page_detail(uuid)'::regprocedure) INTO v_def;
  IF position(v_old IN v_def) = 0 THEN
    RAISE EXCEPTION 'horse_page_detail purchases/return anchor not found';
  END IF;
  EXECUTE replace(v_def, v_old, v_new);
END $m$;
