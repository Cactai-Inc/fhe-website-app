-- K1-K3 (owner directives 2026-08-04): GUEST becomes a real category, purchase
-- promotes the buyer to the category its offering implies, and the skill-match
-- fields are captured now so data accumulates before horse scheduling is built.

-- ── K1a: GUEST is a valid affiliation ────────────────────────────────────────
-- CHECK WIDENING, explicitly authorized by the owner this session. GUEST was
-- already an expected value downstream (suggested_category_for_contact returns
-- it, the TypeScript union declares it) but could not be STORED, so a visitor
-- resolved to no category at all and their document set had nothing to hang on.
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_group_type_check;
ALTER TABLE groups ADD CONSTRAINT groups_group_type_check
  CHECK (group_type = ANY (ARRAY['GUEST','RIDER','HORSE_OWNER','PARENT_GUARDIAN']));

-- ── K1b: the GUEST document set (owner-confirmed) ────────────────────────────
-- Visitors sign the general release, the policies and the rules. The earlier
-- "general release only" rule predates both the policies and rules documents
-- and assumed an accompanying offering contract carried them.
INSERT INTO category_document_requirements (org_id, category, template_key)
SELECT o.id, 'Guest', k
  FROM organizations o
  CROSS JOIN unnest(ARRAY['RELEASE_GENERAL','COMPANY_POLICIES','FACILITY_RULES']) k
 WHERE NOT EXISTS (
   SELECT 1 FROM category_document_requirements c
    WHERE c.org_id = o.id AND upper(replace(btrim(c.category),' ','_')) = 'GUEST'
      AND c.template_key = k);

-- ── K1c: my_standing_categories can return GUEST ─────────────────────────────
-- Previously hard-limited to RIDER/HORSE_OWNER, so a guest account reported no
-- categories whatsoever.
CREATE OR REPLACE FUNCTION public.my_standing_categories()
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_groups  text[];
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN RETURN ARRAY[]::text[]; END IF;
  SELECT coalesce(array_agg(DISTINCT g.group_type ORDER BY g.group_type), ARRAY[]::text[])
    INTO v_groups
    FROM groups g
   WHERE g.contact_id = v_contact AND g.group_type IN ('GUEST','RIDER','HORSE_OWNER');
  RETURN v_groups;
END;
$function$;

-- ── K2: promotion at purchase ────────────────────────────────────────────────
-- Category is a DOCUMENTS mechanism, never a permission one (owner ruling
-- 2026-08-04: nothing in the app is hidden from anyone — visibility drives
-- conversion). Buying a service derives the affiliation that service implies
-- and attaches its document set; the purchase itself is never blocked, and
-- fulfillment stays gated by the existing per-horse eligibility check.
CREATE OR REPLACE FUNCTION public.promote_buyer_from_offering()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_segment text;
  v_kind    text;
  v_cat     text;
BEGIN
  SELECT p.buyer_contact_id, p.org_id INTO v_contact, v_org
    FROM purchases p WHERE p.id = NEW.purchase_id;
  IF v_contact IS NULL OR v_org IS NULL THEN RETURN NEW; END IF;

  SELECT o.segment, o.config_kind INTO v_segment, v_kind
    FROM offerings o WHERE o.id = NEW.offering_id;
  -- pure enquiry rows imply nothing
  IF v_kind IS NULL OR v_kind = 'inquire' THEN RETURN NEW; END IF;

  v_cat := CASE lower(coalesce(v_segment,''))
             WHEN 'rider' THEN 'RIDER'
             WHEN 'horse' THEN 'HORSE_OWNER'
             ELSE NULL END;
  IF v_cat IS NULL THEN RETURN NEW; END IF;

  INSERT INTO groups (contact_id, group_type)
  SELECT v_contact, v_cat
   WHERE NOT EXISTS (SELECT 1 FROM groups g
                      WHERE g.contact_id = v_contact AND g.group_type = v_cat);

  -- attach that category's documents (idempotent; never strips existing ones)
  PERFORM apply_category_documents(v_contact, ARRAY[v_cat]);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS purchase_items_promote_buyer ON public.purchase_items;
CREATE TRIGGER purchase_items_promote_buyer
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.promote_buyer_from_offering();

-- ── K3: skill-match fields, captured now, used when horses land ──────────────
-- Fields only: no matching logic and no booking integration until real
-- lease-borne horses exist (owner, 2026-08-04). Capturing from today means no
-- backfill later.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS rider_skill_level text;
COMMENT ON COLUMN contacts.rider_skill_level IS
  'Internal staff assessment of the rider''s level; pairs with horses.rider_level_min/max for horse-rider matching.';
ALTER TABLE horses ADD COLUMN IF NOT EXISTS rider_level_min text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS rider_level_max text;
COMMENT ON COLUMN horses.rider_level_min IS 'Lowest rider level this horse suits (matching, not yet enforced).';
COMMENT ON COLUMN horses.rider_level_max IS 'Highest rider level this horse suits (matching, not yet enforced).';
