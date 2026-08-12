-- TASK LEADCLEAN — a lead card retires itself when the person becomes a client.
--
-- ONE definition of "this lead is done", and it already existed: the
-- `inbound_queue` view's own `already_converted` (c.contact_type = 'CONTACT',
-- joining requests → contacts on contact_id when set and lower(email) when not).
-- Nothing here writes a second definition, and nothing here materialises a
-- `converted` status — a derived value cannot drift, and it is retroactively
-- right for rows that never had a route to the status in the first place.
--
-- 1. inbound_open_count() — the Dashboard nav badge — stops counting requests
--    whose person is already a client. It counted `status = 'new'` flat, so six
--    people who had already been provisioned were still being announced as new
--    work. It now counts exactly what the dashboard's lead band lists: not in a
--    terminal status, and not already converted. Badge and list cannot disagree,
--    which was the stated contract in useOpenLeads.ts.
--
--    Note the widening from `status = 'new'` to "not terminal": with the Inbound
--    page retiring, the dashboard is the only surface these rows have, and a
--    `contacted` lead who never became a client is open work. Four live rows are
--    in exactly that state.
--
-- 2. requests.contact_id backfill — the view falls back to lower(email) when the
--    column is NULL, which works but is not evidence. Where exactly one
--    non-deleted contact holds that email the link is unambiguous, so it is made
--    explicit; where more than one does, the row is left NULL rather than guessed
--    (this project has been bitten by same-name-different-person before).
--
--    One row is deliberately skipped — see the WHERE clause below.
--
-- No request row is deleted, no status is rewritten, and no lead record leaves
-- history. Only the dashboard's OPEN list changes.

-- ── 1. The badge counts what the surface shows ───────────────────────────────
-- coalesce on already_converted matters: the flag is NULL when no contact row
-- matched at all, and `NOT NULL` would silently drop that request from the
-- count — the opposite of what an unmatched submission deserves.
CREATE OR REPLACE FUNCTION public.inbound_open_count()
RETURNS int
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'staff access required';
  END IF;
  RETURN
    (SELECT count(*) FROM inbound_queue q
      WHERE q.org_id = current_org()
        AND q.status NOT IN ('converted', 'expired')
        AND NOT coalesce(q.already_converted, false))
    +
    (SELECT count(*) FROM support_requests
      WHERE org_id = current_org() AND status <> 'resolved');
END;
$$;

COMMENT ON FUNCTION public.inbound_open_count() IS
  'Open inbound work for the Dashboard nav badge: requests that are neither in a terminal status nor already converted (inbound_queue.already_converted is the single definition — do not restate it here or in the client), plus support requests not yet resolved. Deliberately the same predicate the dashboard lead band lists, so the badge and the list can never disagree.';

-- ── 2. Make the unambiguous contact links explicit ───────────────────────────
-- HAVING count(*) = 1 is the whole guard: a request whose email matches two or
-- more live contacts keeps its NULL and is reported, not resolved by picking one.
--
-- 609d45cf-bc56-4c91-afe0-9555a6f9d137 is excluded on the owner's instruction:
-- that request is being held, untouched, as the acceptance control for the whole
-- lead-promotion chain. It stays NULL on purpose. Its `already_converted` is
-- false either way (its contact is a LEAD), so skipping it changes no verdict.
UPDATE requests r
   SET contact_id = m.contact_id
  FROM (
    -- array_agg(...)[1], not min(): Postgres has no min() aggregate for uuid.
    -- The ORDER BY is the same tie-break inbound_queue's own lateral join uses,
    -- so the two can never resolve a request to different people — though with
    -- HAVING count(*) = 1 below there is only ever one candidate to order.
    SELECT r2.id AS request_id, (array_agg(c.id ORDER BY c.created_at))[1] AS contact_id
      FROM requests r2
      JOIN contacts c
        ON c.deleted_at IS NULL
       AND c.org_id = r2.org_id
       AND lower(c.email) = lower(r2.contact_email)
     WHERE r2.contact_id IS NULL
       AND coalesce(btrim(r2.contact_email), '') <> ''
       AND r2.id <> '609d45cf-bc56-4c91-afe0-9555a6f9d137'::uuid
     GROUP BY r2.id
    HAVING count(*) = 1
  ) m
 WHERE r.id = m.request_id;
