-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT IS MISSING, AND ONLY WHEN IT MATTERS (2026-07-31, owner)
--
-- Returns the registry fields a member has not filled in — but ONLY when a
-- document that depends on them has actually been assigned. An empty field on a
-- record nobody is asking anything of is not a problem and must not nag.
--
-- Contact gaps and horse gaps come back SEPARATELY, because they are edited on
-- different pages: the dashboard renders one card each so "click to fill it in"
-- lands on the right screen rather than a guess.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.my_missing_required_data()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_assigned int;
  v_contact_gaps jsonb := '[]'::jsonb;
  v_horses jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN
    RETURN jsonb_build_object('contact', '[]'::jsonb, 'horses', '[]'::jsonb);
  END IF;

  -- THE TRIGGER CONDITION: an assigned document that is not yet satisfied.
  -- Without one, nothing is reported however empty the record is.
  SELECT count(*) INTO v_assigned
    FROM contact_required_documents crd
   WHERE crd.contact_id = v_contact;

  IF v_assigned = 0 THEN
    RETURN jsonb_build_object('contact', '[]'::jsonb, 'horses', '[]'::jsonb);
  END IF;

  -- Person fields. to_jsonb + ->> reads the column named by the registry, so a
  -- new requirement needs no code change here.
  SELECT coalesce(jsonb_agg(jsonb_build_object('column', r.column_name, 'label', r.label)
                            ORDER BY r.sort_order), '[]'::jsonb)
    INTO v_contact_gaps
    FROM document_data_requirements r
    CROSS JOIN LATERAL (SELECT to_jsonb(c) AS j FROM contacts c WHERE c.id = v_contact) x
   WHERE r.subject = 'contact' AND r.active
     AND nullif(btrim(coalesce(x.j ->> r.column_name, '')), '') IS NULL;

  -- Horse fields, per horse the member owns. Grouped by horse so the card can
  -- name which one is incomplete rather than listing bare field names.
  SELECT coalesce(jsonb_agg(h ORDER BY h->>'name'), '[]'::jsonb) INTO v_horses
    FROM (
      SELECT jsonb_build_object(
               'horse_id', hz.id,
               'name', coalesce(hz.nickname, hz.registered_name, 'Horse'),
               'missing', (
                 SELECT coalesce(jsonb_agg(jsonb_build_object('column', r.column_name, 'label', r.label)
                                           ORDER BY r.sort_order), '[]'::jsonb)
                   FROM document_data_requirements r
                  WHERE r.subject = 'horse' AND r.active
                    AND nullif(btrim(coalesce(to_jsonb(hz) ->> r.column_name, '')), '') IS NULL)) AS h
        FROM horses hz
       WHERE hz.deleted_at IS NULL
         AND hz.current_owner_contact_id = v_contact
    ) t
   WHERE jsonb_array_length(t.h -> 'missing') > 0;

  RETURN jsonb_build_object('contact', v_contact_gaps, 'horses', v_horses);
END
$function$;

GRANT EXECUTE ON FUNCTION public.my_missing_required_data() TO authenticated;

COMMENT ON FUNCTION public.my_missing_required_data() IS
  'Registry fields the caller has not filled, reported ONLY when they have an '
  'assigned document that needs them — an empty field nobody is waiting on is '
  'not a problem. Contact and horse gaps are returned separately because they '
  'are edited on different pages, so each notification can link to the right one.';
