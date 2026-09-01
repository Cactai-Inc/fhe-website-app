-- ─────────────────────────────────────────────────────────────────────────────
-- INBOUND AS A QUEUE — S5 (2026-07-30)
--
-- `requests` is WORK: it has a state machine and must reach zero. The person-
-- pages are REGISTRIES: browsed, never empty. Rendering both with the same page
-- format is what made the ops UI sprawl, and it is why nothing surfaced the fact
-- that 8 of 9 requests were still 'new'.
--
-- What the live backlog actually showed (2026-07-30) — the numbers matter,
-- because they change what "unhandled" means:
--
--   • 6 KIOSK entries whose person is ALREADY a converted client (Elisheva,
--     Ashlan, Raymond, Serena, Brian, Melanie). The work was done; nobody closed
--     the row. These are stale bookkeeping, not lost revenue.
--   • 3 BOOKING requests for lessons — Audrey Brennan, Hannah Dryden, Naomi
--     Pouliot — with NO contact record at all, 6 to 10 days after asking for a
--     lesson. THIS is the conversion loss.
--
-- So the queue needs two things the old page had neither of: an age signal, and
-- a way to tell "done but unclosed" apart from "nobody has touched this".
--
-- OWNER DECISION: an inbound submission creates a contact IMMEDIATELY, flagged
-- LEAD, so there is one person record from first touch and the Leads page is a
-- real campaign list. Implemented here as a trigger, and backfilled for the
-- three that slipped through.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Auto-capture: every inbound submission becomes a person ───────────────
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

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS requests_capture_contact_trg ON requests;
CREATE TRIGGER requests_capture_contact_trg
  AFTER INSERT ON requests
  FOR EACH ROW EXECUTE FUNCTION public.requests_capture_contact();

COMMENT ON FUNCTION public.requests_capture_contact() IS
  'Every inbound submission becomes a person immediately, flagged LEAD, so there '
  'is one record from first touch and the Leads page is a real campaign list. '
  'Matches an existing contact on email before creating one, so a returning '
  'visitor does not spawn a duplicate. An existing contact is never reclassified '
  '— a client who books again stays a client.';

-- ── 2. The queue view: age + whether the person was ever captured ────────────
CREATE OR REPLACE VIEW public.inbound_queue AS
  SELECT r.id, r.org_id, r.status, r.channel, r.category, r.created_at,
         r.contact_first_name, r.contact_last_name, r.contact_email, r.contact_phone,
         r.subject, r.notes, r.staff_notes, r.proposed_times, r.booking_eligible,
         (now()::date - r.created_at::date) AS days_open,
         c.id            AS contact_id,
         c.contact_type  AS contact_type,
         -- TRUE when this person already became a client: the request is stale
         -- bookkeeping rather than an untouched opportunity. Six of the nine
         -- rows in the live backlog are exactly this.
         (c.contact_type = 'CONTACT') AS already_converted,
         -- The real signal: untouched, not already converted, and aging.
         (r.status = 'new' AND coalesce(c.contact_type,'') <> 'CONTACT'
            AND (now()::date - r.created_at::date) >= 2) AS overdue
    FROM requests r
    LEFT JOIN LATERAL (
      SELECT c2.id, c2.contact_type FROM contacts c2
       WHERE lower(c2.email) = lower(r.contact_email)
         AND c2.org_id = r.org_id AND c2.deleted_at IS NULL
       ORDER BY c2.created_at LIMIT 1) c ON true;

COMMENT ON VIEW public.inbound_queue IS
  'Inbound work with an AGE and a conversion signal. `overdue` is deliberately '
  'narrow: still new, the person has not already become a client, and at least '
  '2 days old — so a request whose work is genuinely done but whose row was never '
  'closed does not shout for attention it does not need. `already_converted` '
  'marks that case so it can be closed in bulk.';

-- ── 3. Backfill the three that slipped through ──────────────────────────────
-- Audrey Brennan, Hannah Dryden and Naomi Pouliot asked for lessons 6–10 days
-- ago and were never captured as people. Create them as LEADs so they land on
-- the campaign list instead of existing only inside an unread queue row.
INSERT INTO contacts (org_id, first_name, last_name, email, phone, contact_type, notes)
SELECT DISTINCT ON (lower(r.contact_email))
       r.org_id,
       nullif(trim(coalesce(r.contact_first_name, '')), ''),
       nullif(trim(coalesce(r.contact_last_name, '')), ''),
       lower(r.contact_email),
       nullif(trim(coalesce(r.contact_phone, '')), ''),
       'LEAD',
       'Backfilled 2026-07-30 from an un-actioned ' || coalesce(r.channel, 'inbound')
         || coalesce(' (' || r.category || ')', '') || ' request.'
  FROM requests r
 WHERE nullif(trim(coalesce(r.contact_email, '')), '') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM contacts c
                    WHERE lower(c.email) = lower(r.contact_email)
                      AND c.org_id = r.org_id AND c.deleted_at IS NULL)
 ORDER BY lower(r.contact_email), r.created_at;
