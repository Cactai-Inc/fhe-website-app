-- Repeatable medications & supplements. Was flat single-med columns on horses; now a
-- child table so a horse can have MANY medications and MANY supplements, each with
-- cost, structured supplier (website/phone/Rx), and order quantity (units + days).
CREATE TABLE IF NOT EXISTS public.horse_medications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL,
  horse_id         uuid NOT NULL REFERENCES public.horses(id) ON DELETE CASCADE,
  kind             text NOT NULL DEFAULT 'MEDICATION',   -- 'MEDICATION' | 'SUPPLEMENT'
  sort_order       integer NOT NULL DEFAULT 0,
  name             text,
  dosage           text,
  instructions     text,
  cost             numeric,                 -- price per order
  supplier_website text,
  supplier_phone   text,
  rx_info          text,                    -- meds only (Rx #, prescriber); null for supplements
  order_units      text,                    -- number of units per order
  days_supply      text,                    -- how many days that order lasts
  created_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);
CREATE INDEX IF NOT EXISTS horse_medications_horse_idx ON public.horse_medications (horse_id) WHERE deleted_at IS NULL;

ALTER TABLE public.horse_medications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS horse_medications_org ON public.horse_medications;
CREATE POLICY horse_medications_org ON public.horse_medications
  FOR ALL USING (org_id = current_org()) WITH CHECK (org_id = current_org());
DROP POLICY IF EXISTS horse_medications_staff ON public.horse_medications;
CREATE POLICY horse_medications_staff ON public.horse_medications
  FOR SELECT USING (has_staff_access());
DROP POLICY IF EXISTS horse_medications_owner ON public.horse_medications;
CREATE POLICY horse_medications_owner ON public.horse_medications
  FOR SELECT USING (deleted_at IS NULL AND caller_owns_horse(horse_id));
DROP POLICY IF EXISTS horse_medications_admin ON public.horse_medications;
CREATE POLICY horse_medications_admin ON public.horse_medications
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT ON public.horse_medications TO authenticated;
