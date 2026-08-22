-- DASHBOARDBUILD §3 (C6) — the seen-marker the notes loop needs, in the shape
-- this database already uses for exactly this problem.
--
-- The plan marks C6 PARTIAL for one reason: there is no way to say "I have read
-- the client's contribution to that lesson's notes." The task doc's instruction
-- is to converge on the existing idiom rather than invent a second one, and the
-- existing idiom is `contract_change_request_seen`:
--
--   (request_id, contact_id, org_id, seen_at, seen_role, seen_label)
--
-- Same columns, same primary key shape, same "a row IS the fact" semantics.
-- Keyed on contact_id rather than user_id for the same reason that table is:
-- the contact is the person, and both staff owners have contact records
-- (verified 2026-08-22 — Claire 862b7936…, CJ 75475f66…).
--
-- D32: a seen row is never deleted. Un-seeing is not a thing anyone asked for,
-- and a marker you can silently retract is not evidence of anything.
CREATE TABLE IF NOT EXISTS public.booking_note_seen (
  note_id    uuid        NOT NULL REFERENCES public.booking_notes(id) ON DELETE CASCADE,
  contact_id uuid        NOT NULL REFERENCES public.contacts(id)      ON DELETE CASCADE,
  org_id     uuid        NOT NULL DEFAULT current_org(),
  seen_at    timestamptz NOT NULL DEFAULT now(),
  seen_role  text,
  seen_label text,
  PRIMARY KEY (note_id, contact_id)
);

CREATE INDEX IF NOT EXISTS booking_note_seen_contact_idx
  ON public.booking_note_seen (contact_id, seen_at DESC);

ALTER TABLE public.booking_note_seen ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname='public' AND tablename='booking_note_seen'
                    AND policyname='booking_note_seen_self_read') THEN
    CREATE POLICY booking_note_seen_self_read ON public.booking_note_seen
      FOR SELECT TO authenticated
      USING (contact_id = current_contact_id()
             OR coalesce(has_staff_access() AND org_id = current_org(), false));
  END IF;
END$$;

COMMENT ON TABLE public.booking_note_seen IS
  'DASHBOARDBUILD C6. One row = this person has read that lesson note. Same shape '
  'as contract_change_request_seen, deliberately — see that table before changing this one.';

-- Marking one note seen. Writes are only ever through here: the table has no
-- INSERT policy, so a client cannot mark staff notes read on their behalf.
CREATE OR REPLACE FUNCTION public.mark_booking_note_seen(p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid := current_org();
  v_me   uuid := current_contact_id();
  v_note booking_notes%ROWTYPE;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'this account has no contact record to record a reading against';
  END IF;

  SELECT * INTO v_note FROM booking_notes WHERE id = p_note_id AND org_id = v_org;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO booking_note_seen (note_id, contact_id, org_id, seen_role, seen_label)
  VALUES (p_note_id, v_me, v_org, 'staff',
          (SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '')
             FROM contacts c WHERE c.id = v_me))
  ON CONFLICT (note_id, contact_id) DO NOTHING;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_booking_note_seen(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mark_booking_note_seen(uuid) TO authenticated, service_role;
