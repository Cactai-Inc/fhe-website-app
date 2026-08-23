-- TASK-AUTHORITY §4.9 (Part C) — extend the existing audit mechanism to bookings.
-- Same audit_row_change() every other audited table uses (D18: no second audit
-- pattern). lesson_credits already carries audit_lesson_credits (added by
-- 20260630070000_mod_lessons.sql) — confirmed live on prod; nothing to do there.

DROP TRIGGER IF EXISTS audit_bookings ON bookings;
CREATE TRIGGER audit_bookings AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
