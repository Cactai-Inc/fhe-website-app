-- MY STABLE + SHARED VENDORS — member-owned inventory surfaced on the Account hub.
-- A member keeps their own gear and supplies here (optional). Items may link a
-- VENDOR: either one picked from the shared vendor directory (the same directory
-- that backs Resources) or a new one the member enters — and, if they choose,
-- share back into the directory for the whole community.
--
-- CORRECTED per HANDOFF-horse-records.md (Update B): the drafted stable_horses /
-- stable_horse_parties tables and the stable_ownership enum are DROPPED FROM SCOPE.
-- There is ONE horse records table — the existing `horses` table — and the
-- agreements thread (Update A) is authoritative for it. Member horse visibility
-- comes from party relationships on the record, not a parallel member-horse table.
-- KEPT: vendors + stable_items (gear/supply) + stable_item_kind.
--
-- Tenancy: org_id = current_org(); ownership: user_id = auth.uid(). A member sees
-- and edits only their own stable rows. Vendors are org-wide: any member reads the
-- shared ones; a member may insert one (contributing to the directory); admins
-- manage all.

DO $$ BEGIN
  CREATE TYPE stable_item_kind AS ENUM ('gear', 'supply');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Shared vendor directory (backs Resources + My Stable vendor links) ──────
CREATE TABLE IF NOT EXISTS public.vendors (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  name          text NOT NULL,
  category      text,                              -- 'Vets' | 'Farriers' | 'Suppliers' | free text
  url           text,
  phone         text,
  email         text,
  note          text,
  shared        boolean NOT NULL DEFAULT false,    -- true = listed in the community Resources directory
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendors_org_shared_idx ON public.vendors (org_id, shared);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Any in-org member reads shared vendors (the directory) OR ones they created;
-- a member may add a vendor; the creator may edit theirs; admins manage all.
DROP POLICY IF EXISTS vendors_read ON public.vendors;
CREATE POLICY vendors_read ON public.vendors
  FOR SELECT USING (
    org_id = current_org() AND (shared OR created_by = auth.uid() OR is_admin())
  );

DROP POLICY IF EXISTS vendors_insert ON public.vendors;
CREATE POLICY vendors_insert ON public.vendors
  FOR INSERT WITH CHECK (org_id = current_org() AND created_by = auth.uid());

DROP POLICY IF EXISTS vendors_update_own ON public.vendors;
CREATE POLICY vendors_update_own ON public.vendors
  FOR UPDATE USING (org_id = current_org() AND (created_by = auth.uid() OR is_admin()))
  WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS vendors_admin_all ON public.vendors;
CREATE POLICY vendors_admin_all ON public.vendors
  FOR ALL USING (org_id = current_org() AND is_admin())
  WITH CHECK (org_id = current_org() AND is_admin());

-- ── Member gear + supplies (each may link a vendor) ────────────────────────
CREATE TABLE IF NOT EXISTS public.stable_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  user_id       uuid NOT NULL REFERENCES auth.users(id),
  kind          stable_item_kind NOT NULL,
  name          text NOT NULL,
  detail        text,
  vendor_id     uuid REFERENCES vendors(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stable_items_user_kind_idx ON public.stable_items (user_id, kind);

ALTER TABLE public.stable_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stable_items_own ON public.stable_items;
CREATE POLICY stable_items_own ON public.stable_items
  FOR ALL USING (user_id = auth.uid() OR (org_id = current_org() AND is_admin()))
  WITH CHECK (user_id = auth.uid() AND org_id = current_org());

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.vendors, public.stable_items
  TO authenticated;
