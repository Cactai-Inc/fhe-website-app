-- CAREPLANS m5 — the catalog editor can see which offerings have been sold.
--
-- §P2c, owner-ruled 2026-08-17: "the non editable components need to be updated."
-- `unit_count`, `weekly_frequency` and `config_kind` become editable in
-- AdminProductsPage. `config_kind` decides WHICH HALF of the entitlement formula
-- applies, so flipping it on an offering that people have already bought would
-- rewrite what those clients are owed. The ruling is explicit that the answer is
-- not to lock the field, so the editor WARNS instead — and to warn it has to know.
--
-- Guarded, not blocked: this returns the count, the UI makes the operator confirm.

CREATE OR REPLACE FUNCTION public.admin_offering_usage()
RETURNS TABLE(offering_id uuid, live_lines integer, bookings integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id,
         (SELECT count(*)::int FROM purchase_items pi
            JOIN purchases pu ON pu.id = pi.purchase_id AND pu.deleted_at IS NULL
           WHERE pi.offering_id = o.id AND pi.voided_at IS NULL),
         (SELECT count(*)::int FROM bookings b
           WHERE b.offering_id = o.id AND b.status NOT IN ('cancelled','expired'))
    FROM offerings o
   WHERE has_staff_access() AND o.org_id = current_org();
$$;

REVOKE ALL ON FUNCTION public.admin_offering_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_offering_usage() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_offering_usage() TO authenticated, service_role;
