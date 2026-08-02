-- BACKLOG drain (2026-08-02): two hardening items with live preconditions
-- verified immediately before this migration.
-- 1) notifications.link NOT NULL — live count of NULL links was 0; both
--    producers (notify_staff / notify_user) take a link parameter. This makes
--    a future producer unable to write an unresolvable notification row.
ALTER TABLE notifications ALTER COLUMN link SET NOT NULL;
