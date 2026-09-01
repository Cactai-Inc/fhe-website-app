-- Members can read their OWN purchases.
--
-- The purchases table had only a permissive staff-all SELECT policy plus a
-- RESTRICTIVE org-boundary policy. Net effect for a non-staff member: no
-- permissive policy grants them their own rows, so the member Orders page and
-- the onboarding payment step showed NOTHING. Provisioned clients (keyed on
-- buyer_contact_id, buyer_user_id null until they log in) were doubly invisible.
--
-- Add a permissive SELECT policy scoped to the buyer: their auth user OR their
-- linked contact (so a provisioned purchase shows before/after the user link).
-- The RESTRICTIVE org_boundary still applies (AND), keeping cross-org isolation.

DROP POLICY IF EXISTS purchases_member_own_select ON public.purchases;
CREATE POLICY purchases_member_own_select ON public.purchases
  FOR SELECT TO authenticated
  USING (
    buyer_user_id = auth.uid()
    OR buyer_contact_id = current_contact_id()
  );

-- purchase_items had the same gap (staff-only permissive + restrictive org).
-- Members must read the line items of a purchase they can read.
DROP POLICY IF EXISTS purchase_items_member_own_select ON public.purchase_items;
CREATE POLICY purchase_items_member_own_select ON public.purchase_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = purchase_items.purchase_id
        AND (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
    )
  );
