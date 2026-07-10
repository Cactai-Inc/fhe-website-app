/*
  # Instructors get the operational surfaces (owner: "everything except Settings")

  The nav + routes now admit instructors (MANAGER/EMPLOYEE) to every section
  except Settings. But several operational tables gated READS behind is_admin(),
  so those pages would render empty for an instructor. Widen the READ/servicing
  policies to has_staff_access() (ADMIN/SUPER_ADMIN/MANAGER/EMPLOYEE), keeping
  org scope. GOVERNANCE stays admin-only: membership writes and role changes
  (profiles_role_guard, unchanged) are not servicing.

  Billing, support, and transactions: staff read + act. Memberships: staff READ
  (the Team roster needs it); writes remain is_admin().
*/

-- billing_schedules: staff manage (billing page is now instructor-visible)
DROP POLICY IF EXISTS billing_admin_all ON billing_schedules;
CREATE POLICY billing_admin_all ON billing_schedules
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

DROP POLICY IF EXISTS billing_own_read ON billing_schedules;
CREATE POLICY billing_own_read ON billing_schedules FOR SELECT
  USING (client_id = current_client_id() OR (org_id = current_org() AND has_staff_access()));

-- support_requests: staff read + resolve
DROP POLICY IF EXISTS support_admin_update ON support_requests;
CREATE POLICY support_admin_update ON support_requests FOR UPDATE
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

DROP POLICY IF EXISTS support_own_read ON support_requests;
CREATE POLICY support_own_read ON support_requests FOR SELECT
  USING (user_id = auth.uid() OR (org_id = current_org() AND has_staff_access()));

-- transactions: staff read + act (already allowed engagement owners)
DROP POLICY IF EXISTS transactions_read ON transactions;
CREATE POLICY transactions_read ON transactions FOR SELECT
  USING (has_staff_access() OR caller_owns_engagement(engagement_id));

DROP POLICY IF EXISTS transactions_write ON transactions;
CREATE POLICY transactions_write ON transactions
  USING (has_staff_access() OR caller_owns_engagement(engagement_id))
  WITH CHECK (has_staff_access() OR caller_owns_engagement(engagement_id));

-- memberships: staff READ (Team roster); WRITES stay admin-only (governance)
DROP POLICY IF EXISTS memberships_select ON memberships;
CREATE POLICY memberships_select ON memberships FOR SELECT
  USING (user_id = auth.uid() OR has_staff_access());
