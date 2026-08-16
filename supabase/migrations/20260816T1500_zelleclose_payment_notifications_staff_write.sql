-- TASK ZELLECLOSE — Dismiss was structurally blocked, not just org_id-blocked.
--
-- MEASURED live (BEGIN…ROLLBACK, a real staff user, real org_id match): a
-- staff UPDATE on `payment_notifications` affected 0 rows even with org_id
-- correctly set and current_org() matching. Cause: `payment_notifications_
-- org_boundary` is RESTRICTIVE (polpermissive = false), and the only
-- PERMISSIVE policy on the table (`payment_notifications_admin_read`) is
-- SELECT-only. Postgres RLS: a command with no applicable PERMISSIVE policy
-- is denied outright, regardless of whether restrictive policies would pass —
-- so UPDATE (and INSERT/DELETE) were unreachable for `authenticated` no
-- matter what org_id held. `src/lib/ops/api-payments.ts`'s own comment
-- already flagged the symptom ("KNOWN SERVER GAP … staff access is read-only
-- until an admin-write policy ships") without diagnosing the restrictive-vs-
-- permissive cause; this is that policy.
--
-- Scoped to UPDATE only — INSERT already works (server reconciliation runs as
-- service_role, which carries BYPASSRLS in Supabase; nothing in `src/` ever
-- inserts a notification row).

DROP POLICY IF EXISTS payment_notifications_staff_write ON payment_notifications;
CREATE POLICY payment_notifications_staff_write ON payment_notifications
  FOR UPDATE USING (has_staff_access()) WITH CHECK (has_staff_access());
