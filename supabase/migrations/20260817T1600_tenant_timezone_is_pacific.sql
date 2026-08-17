-- TIMEZONE — the business is in San Diego, California. The database was UTC.
--
-- Owner, 2026-08-17: "pacific timezone san diego california".
--
-- LESSONREQUEST found this and correctly refused to fix it in a feature task.
-- The database had NO timezone anywhere and the server ran UTC, so every
-- server-side to_char() rendered UTC to a human. 39 functions render a time.
-- Measured on live bookings before the change:
--
--   stored 2026-07-20 22:30+00  ->  client was told "Jul 20, 10:30 PM"   (really 3:30 PM)
--   stored 2026-07-24 15:00+00  ->  client was told "Jul 24, 03:00 PM"   (really 8:00 AM)
--   stored 2026-07-25 00:00+00  ->  client was told "Jul 25, 12:00 AM"   (really Jul 24, 5:00 PM)
--
-- The third is the worst: the WRONG DAY, not merely the wrong hour.
--
-- This also corrects a second, quieter class of bug. 12+ functions depend on
-- current_date or date_trunc('month', ...) — credit expiry, monthly lesson
-- generation, open-slot publication. Under UTC, "today" rolled over at 5pm
-- Pacific, so a month boundary fell in the middle of a working afternoon.
--
-- Applied at BOTH levels because PostgREST switches role per request:
--   ALTER DATABASE postgres  SET timezone TO 'America/Los_Angeles';
--   ALTER ROLE {anon, authenticated, service_role, authenticator} SET timezone ...
--
-- NO STORED DATA CHANGES. timestamptz is absolute; only rendering and
-- session-relative date maths move. Reversible by setting the value back.
--
-- ⚠️ SINGLE-TENANT ASSUMPTION. org_id exists throughout and a second tenant in
-- another timezone would need contacts/organizations to carry their own zone and
-- the rendering functions to use it. Recorded in the waves register.

ALTER DATABASE postgres SET timezone TO 'America/Los_Angeles';

ALTER ROLE anon          SET timezone TO 'America/Los_Angeles';
ALTER ROLE authenticated SET timezone TO 'America/Los_Angeles';
ALTER ROLE service_role  SET timezone TO 'America/Los_Angeles';
ALTER ROLE authenticator SET timezone TO 'America/Los_Angeles';
