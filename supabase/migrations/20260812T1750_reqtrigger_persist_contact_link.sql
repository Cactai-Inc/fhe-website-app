-- TASK REQTRIGGER — requests_capture_contact never actually links a request.
--
-- requests_capture_contact_trg fires AFTER INSERT. Assigning to NEW in an
-- AFTER trigger is discarded once the row is already written, so the
-- function's closing `NEW.contact_id := v_contact;` has always been a no-op
-- despite its own comment claiming the link is kept. Every requests row
-- inserted since requests.contact_id was added (2026-08-02) has been left
-- NULL by this path; two of the four were subsequently backfilled by
-- TASK-LEADCLEAN as one-offs.
--
-- Fix: keep the trigger AFTER (moving it BEFORE would make
-- requests_capture_contact_trg fire ahead of requests_normalise_phone_trg —
-- triggers run in name order and 'c' < 'n' — capturing the un-normalised
-- phone into the new contact row) and persist the resolved contact id with
-- an explicit UPDATE instead of the discarded NEW assignment. The UPDATE
-- only touches contact_id, so it never satisfies requests_normalise_phone_trg's
-- `UPDATE OF contact_phone` condition and cannot re-enter that trigger.
-- `contact_id IS NULL` in the WHERE is deliberate: it must never overwrite a
-- link a human or a later process already established.
--
-- Nothing else in the function changes. No backfill: rows already NULL stay
-- NULL until a real process (LEADCLEAN's or a future one) resolves them.
CREATE OR REPLACE FUNCTION public.requests_capture_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_email   text := lower(nullif(trim(coalesce(NEW.contact_email, '')), ''));
BEGIN
  -- No email means nothing to dedupe on and no way to reach them; the request
  -- still stands on its own in the queue.
  IF v_email IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_contact
    FROM contacts
   WHERE lower(email) = v_email AND org_id = NEW.org_id AND deleted_at IS NULL
   ORDER BY created_at
   LIMIT 1;

  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone, contact_type, notes)
    VALUES (NEW.org_id,
            nullif(trim(coalesce(NEW.contact_first_name, '')), ''),
            nullif(trim(coalesce(NEW.contact_last_name, '')), ''),
            v_email,
            nullif(trim(coalesce(NEW.contact_phone, '')), ''),
            'LEAD',
            'Captured from ' || coalesce(NEW.channel, 'inbound')
              || coalesce(' (' || NEW.category || ')', ''))
    RETURNING id INTO v_contact;
  END IF;

  -- ITEM 2, repaired: this trigger is AFTER INSERT, so `NEW.contact_id := ...`
  -- is discarded once the row is already written. Persist explicitly. The
  -- WHERE guard keeps this idempotent and never clobbers an existing link.
  UPDATE requests SET contact_id = v_contact
   WHERE id = NEW.id AND contact_id IS NULL;

  RETURN NEW;
END
$function$;
