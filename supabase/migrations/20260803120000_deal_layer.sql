/*
  # Stage 2 — the DEAL layer (deal plan L1, L2, L2a, L3, L12)

  A DEAL is the top-level object: its own uuid, its own page, its own display
  code. It OWNS one existing spine row (`contracts`), and documents keep
  attaching to that spine exactly as they do today — nothing about how documents
  are generated, filled, locked or signed changes (L13: the lease flow is
  additive-only in this work).

  Model:
    deals                  — the envelope: type, status, the owned spine row.
    deal_consideration     — what each side gives. At least one per party.
    contract_parties       — REUSED for party members (already unique per
                             (contract, contact, role), already many-per-role).
                             No new party table is invented.

  L2 configuration order is enforced by the RPCs, not by the schema: type is
  chosen FIRST (it labels the parties), then members, then consideration.

  L2a: nothing is created from the deal surface. Consideration of kind HORSE
  references an existing horses row; party members reference existing contacts.
  There is no create-a-record path here.
*/

-- ── deal code sequence (matches the CON-/HOR-/CLI- convention) ──────────────
CREATE SEQUENCE IF NOT EXISTS public.deal_code_seq;

-- ── deals ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code  text UNIQUE,
  org_id        uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id),
  -- the owned spine row: documents attach here (L12)
  contract_id   uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  -- chosen FIRST; drives the party designations and the required-document rules
  deal_type     text NOT NULL,
  -- pending until its requirements are met, then complete (L1)
  status        text NOT NULL DEFAULT 'pending',
  completed_at  timestamptz,
  notes         text,
  created_by_contact_id uuid REFERENCES public.contacts(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz,
  deleted_by    uuid,
  CONSTRAINT deals_deal_type_check CHECK (deal_type = ANY (ARRAY['SALE','LEASE'])),
  CONSTRAINT deals_status_check    CHECK (status    = ANY (ARRAY['pending','complete','void'])),
  CONSTRAINT deals_contract_unique UNIQUE (contract_id)
);

COMMENT ON TABLE public.deals IS
  'The deal envelope — the top-level object a transaction lives in. Owns one '
  '`contracts` spine row (documents attach there); party members live in '
  'contract_parties on that spine; what each side gives lives in '
  'deal_consideration. deal_type is chosen FIRST and labels the parties '
  '(SALE → seller/buyer, LEASE → lessor/lessee).';

CREATE INDEX IF NOT EXISTS deals_org_idx      ON public.deals (org_id);
CREATE INDEX IF NOT EXISTS deals_contract_idx ON public.deals (contract_id);
CREATE INDEX IF NOT EXISTS deals_status_idx   ON public.deals (status) WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS deals_assign_code ON public.deals;
CREATE TRIGGER deals_assign_code BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.assign_display_code('DEA-', 'deal_code_seq');

DROP TRIGGER IF EXISTS deals_set_updated_at ON public.deals;
CREATE TRIGGER deals_set_updated_at BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── deal_consideration ──────────────────────────────────────────────────────
-- One row per thing a side gives. `party_role` says WHOSE it is, using the same
-- role vocabulary the spine's parties use, so a SALE's rows are SELLER/BUYER and
-- a LEASE's are LESSOR/LESSEE.
CREATE TABLE IF NOT EXISTS public.deal_consideration (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT public.current_org() REFERENCES public.organizations(id),
  deal_id     uuid NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  party_role  text NOT NULL,
  kind        text NOT NULL,
  -- HORSE: the record given (L2a — selected, never typed)
  horse_id    uuid REFERENCES public.horses(id),
  -- PAYMENT: the amount. GOODS/SERVICES/PAYMENT: the party's own description.
  amount      numeric,
  detail      text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deal_consideration_party_role_check CHECK (party_role = ANY (ARRAY['SELLER','BUYER','LESSOR','LESSEE'])),
  CONSTRAINT deal_consideration_kind_check       CHECK (kind = ANY (ARRAY['PAYMENT','GOODS','SERVICES','HORSE'])),
  -- a HORSE entry names a horse; every other kind carries its own detail
  CONSTRAINT deal_consideration_shape_check CHECK (
    (kind = 'HORSE'  AND horse_id IS NOT NULL)
    OR (kind <> 'HORSE' AND horse_id IS NULL
        AND (nullif(btrim(coalesce(detail,'')), '') IS NOT NULL OR amount IS NOT NULL))
  )
);

COMMENT ON TABLE public.deal_consideration IS
  'What each side gives: PAYMENT / GOODS / SERVICES (category + the providing '
  'party''s own description or amount) or HORSE (a horses row, selected — never '
  'typed). At least one row per party before documents can be authored.';

CREATE INDEX IF NOT EXISTS deal_consideration_deal_idx  ON public.deal_consideration (deal_id);
CREATE INDEX IF NOT EXISTS deal_consideration_horse_idx ON public.deal_consideration (horse_id);

DROP TRIGGER IF EXISTS deal_consideration_set_updated_at ON public.deal_consideration;
CREATE TRIGGER deal_consideration_set_updated_at BEFORE UPDATE ON public.deal_consideration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Mirrors the contracts spine: staff see their org's rows; a party to the deal
-- sees their own deal (reciprocal visibility, L8). Writes are staff-only —
-- deals are authored by the company (H1 originator collapse).
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_consideration ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deals_read ON public.deals;
CREATE POLICY deals_read ON public.deals FOR SELECT TO authenticated
  USING (
    (public.has_staff_access() AND org_id = public.current_org())
    OR EXISTS (
      SELECT 1 FROM public.contract_parties cp
      WHERE cp.contract_id = deals.contract_id
        AND cp.contact_id = public.current_contact_id()
    )
  );

DROP POLICY IF EXISTS deals_write ON public.deals;
CREATE POLICY deals_write ON public.deals TO authenticated
  USING (public.has_staff_access() AND org_id = public.current_org())
  WITH CHECK (public.has_staff_access() AND org_id = public.current_org());

DROP POLICY IF EXISTS deal_consideration_read ON public.deal_consideration;
CREATE POLICY deal_consideration_read ON public.deal_consideration FOR SELECT TO authenticated
  USING (
    (public.has_staff_access() AND org_id = public.current_org())
    OR EXISTS (
      SELECT 1 FROM public.deals d
      JOIN public.contract_parties cp ON cp.contract_id = d.contract_id
      WHERE d.id = deal_consideration.deal_id
        AND cp.contact_id = public.current_contact_id()
    )
  );

DROP POLICY IF EXISTS deal_consideration_write ON public.deal_consideration;
CREATE POLICY deal_consideration_write ON public.deal_consideration TO authenticated
  USING (public.has_staff_access() AND org_id = public.current_org())
  WITH CHECK (public.has_staff_access() AND org_id = public.current_org());

GRANT SELECT ON public.deals, public.deal_consideration TO authenticated;

-- ── the role vocabulary a deal type uses ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deal_party_roles(p_deal_type text)
 RETURNS text[]
 LANGUAGE sql IMMUTABLE
AS $function$
  -- [party A (the giving/owning side), party B (the receiving side)]
  SELECT CASE p_deal_type
           WHEN 'SALE'  THEN ARRAY['SELLER','BUYER']
           WHEN 'LEASE' THEN ARRAY['LESSOR','LESSEE']
         END;
$function$;

COMMENT ON FUNCTION public.deal_party_roles(text) IS
  'The party designations a deal type uses. The type is chosen FIRST precisely '
  'so the two sides can be labelled before members are added (deal plan L2).';
