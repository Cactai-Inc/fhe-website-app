-- Owner, 2026-08-23: "We need to make this follow up system much simpler.
-- a single button to confirm they have been contacted is sufficient."
--
-- markRequestContacted() (src/lib/ops/api-intake.ts) already exists and
-- already flips a request's status new -> contacted -- but
-- dash_people_waiting()'s WHERE clause still included 'contacted' as
-- waiting, so pressing that existing button did nothing visible: the row
-- never left the list. Narrowed to status = 'new' only, so the one-click
-- action this migration wires into the UI actually resolves the row,
-- reusing the existing write path rather than adding a second one (D18).
CREATE OR REPLACE FUNCTION public.dash_people_waiting()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_me   uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY (x->>'since')::timestamptz), '[]'::jsonb)
    INTO v_rows
  FROM (
    -- An inquiry nobody has answered yet -- and who has not already converted.
    SELECT jsonb_build_object(
             'kind',    'inquiry',
             'id',      r.id,
             'who',     coalesce(nullif(btrim(concat_ws(' ', r.contact_first_name, r.contact_last_name)), ''),
                                 r.contact_name, r.contact_email),
             'subject', coalesce(r.subject, r.category, 'New inquiry'),
             'detail',  left(coalesce(r.notes, ''), 160),
             'since',   r.created_at,
             'age_hours', floor(extract(epoch FROM now() - r.created_at) / 3600)::int,
             'status',  r.status,
             'contact_id', r.contact_id) AS x
      FROM requests r
      JOIN inbound_queue iq ON iq.id = r.id
     WHERE r.org_id = v_org AND r.status = 'new'
       AND NOT coalesce(iq.already_converted, false)

    UNION ALL
    -- Someone asked to move or cancel a session and is waiting on the answer.
    SELECT jsonb_build_object(
             'kind',    'reschedule',
             'id',      cr.id,
             'who',     (SELECT nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), '')
                           FROM profiles pr WHERE pr.user_id = cr.requested_by),
             'subject', CASE cr.request_kind WHEN 'cancel' THEN 'Cancellation request'
                                             ELSE 'Reschedule request' END,
             'detail',  coalesce(cr.note, ''),
             'since',   cr.created_at,
             'age_hours', floor(extract(epoch FROM now() - cr.created_at) / 3600)::int,
             'status',  cr.status,
             'booking_id', cr.booking_id)
      FROM booking_change_requests cr
     WHERE cr.org_id = v_org AND cr.status = 'pending'

    UNION ALL
    -- A direct message to me that I have not opened.
    SELECT jsonb_build_object(
             'kind',    'message',
             'id',      dm.id,
             'who',     (SELECT coalesce(pr.display_name,
                                 nullif(btrim(concat_ws(' ', pr.first_name, pr.last_name)), ''))
                           FROM profiles pr WHERE pr.user_id = dm.sender_id),
             'subject', 'Direct message',
             'detail',  left(dm.body, 160),
             'since',   dm.created_at,
             'age_hours', floor(extract(epoch FROM now() - dm.created_at) / 3600)::int,
             'sender_id', dm.sender_id)
      FROM direct_messages dm
     WHERE dm.org_id = v_org AND dm.deleted_at IS NULL
       AND dm.read_at IS NULL AND dm.recipient_id = v_me

    UNION ALL
    -- A comment on a contract that the barn has not replied under.
    SELECT jsonb_build_object(
             'kind',    'contract_note',
             'id',      m.id,
             'who',     m.author_label,
             'subject', 'Contract comment',
             'detail',  left(m.body, 160),
             'since',   m.created_at,
             'age_hours', floor(extract(epoch FROM now() - m.created_at) / 3600)::int,
             'note_id', m.note_id,
             'document_id', (SELECT n.document_id FROM contract_notes n WHERE n.id = m.note_id))
      FROM contract_note_messages m
     WHERE m.org_id = v_org AND m.deleted_at IS NULL
       AND m.author_contact_id IS DISTINCT FROM current_contact_id()
       AND NOT EXISTS (SELECT 1 FROM contract_note_messages later
                        WHERE later.note_id = m.note_id
                          AND later.deleted_at IS NULL
                          AND later.created_at > m.created_at
                          AND later.author_contact_id = current_contact_id())
  ) s;

  RETURN jsonb_build_object('count', jsonb_array_length(v_rows), 'items', v_rows);
END;
$function$;
