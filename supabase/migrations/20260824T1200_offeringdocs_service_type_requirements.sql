-- TASK-OFFERINGDOCS §1/§2 — the SERVICE decides the paperwork, not the tag.
--
-- Owner, 2026-08-24: "the onboarding should be informed by the offerings not a tag."
--
-- Today the only mapping in the database is category -> document, so an offering
-- has to launder itself through a tag to decide anything, and a ticked box
-- carries the same weight as a purchase. This is the mapping that replaces it,
-- keyed on service_type (14 rows) rather than offering (23) so a new SKU inherits
-- its paperwork instead of arriving with none.
--
-- D13/D21: it is a TABLE, editable by the owner, not a list in a function body.
-- Three service->document rules were already hardcoded inside
-- generate_my_onboarding_documents / my_onboarding_state / release_preview /
-- sign_release (RELEASE_HORSE_EXERCISE, RELEASE_JUMPER_ADDENDUM,
-- EVALUATION_LIABILITY_WAIVER); they are folded in here as data.

CREATE TABLE IF NOT EXISTS service_type_document_requirements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  service_type  text NOT NULL REFERENCES service_types(code),
  template_key  text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  retired_reason text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_type_document_requirements_key
  ON service_type_document_requirements (org_id, service_type, template_key);

ALTER TABLE service_type_document_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stdr_org_boundary ON service_type_document_requirements;
CREATE POLICY stdr_org_boundary ON service_type_document_requirements
  AS RESTRICTIVE TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS stdr_read ON service_type_document_requirements;
CREATE POLICY stdr_read ON service_type_document_requirements
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS stdr_admin_write ON service_type_document_requirements;
CREATE POLICY stdr_admin_write ON service_type_document_requirements
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

GRANT SELECT ON service_type_document_requirements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON service_type_document_requirements TO authenticated;

-- ── THE SEED — faithful to what the app assigns TODAY, plus the three that were
--    hardcoded in function bodies. Nothing new is invented here: rider-segment
--    services get what 'Rider' got, horse-segment services what 'Horse owner'
--    got, acquisition services what 'Deal client' resolved to (Guest's three).
INSERT INTO service_type_document_requirements (org_id, service_type, template_key)
SELECT o.id, x.service_type, x.template_key
  FROM organizations o
  CROSS JOIN (VALUES
    -- rider segment == the old 'Rider' set
    ('RIDING_LESSON','COMPANY_POLICIES'), ('RIDING_LESSON','FACILITY_RULES'),
    ('RIDING_LESSON','HUMAN_EMERGENCY_MEDICAL'), ('RIDING_LESSON','RELEASE_PARTICIPANT'),
    ('HORSEMANSHIP_TRAINING','COMPANY_POLICIES'), ('HORSEMANSHIP_TRAINING','FACILITY_RULES'),
    ('HORSEMANSHIP_TRAINING','HUMAN_EMERGENCY_MEDICAL'), ('HORSEMANSHIP_TRAINING','RELEASE_PARTICIPANT'),
    -- jumper == rider + the addendum that was hardcoded
    ('JUMPER_TRAINING','COMPANY_POLICIES'), ('JUMPER_TRAINING','FACILITY_RULES'),
    ('JUMPER_TRAINING','HUMAN_EMERGENCY_MEDICAL'), ('JUMPER_TRAINING','RELEASE_PARTICIPANT'),
    ('JUMPER_TRAINING','RELEASE_JUMPER_ADDENDUM'),
    -- horse segment == the old 'Horse owner' set
    ('HORSE_CLIPPING','COMPANY_POLICIES'), ('HORSE_CLIPPING','FACILITY_RULES'),
    ('HORSE_CLIPPING','HORSE_EMERGENCY_VET'), ('HORSE_CLIPPING','RELEASE_HORSE_CARE'),
    ('HORSE_CLIPPING','RELEASE_PARTICIPANT'),
    ('HORSE_TRAINING','COMPANY_POLICIES'), ('HORSE_TRAINING','FACILITY_RULES'),
    ('HORSE_TRAINING','HORSE_EMERGENCY_VET'), ('HORSE_TRAINING','RELEASE_HORSE_CARE'),
    ('HORSE_TRAINING','RELEASE_PARTICIPANT'),
    -- exercise == horse owner + the exercise release that was hardcoded
    ('HORSE_EXERCISE','COMPANY_POLICIES'), ('HORSE_EXERCISE','FACILITY_RULES'),
    ('HORSE_EXERCISE','HORSE_EMERGENCY_VET'), ('HORSE_EXERCISE','RELEASE_HORSE_CARE'),
    ('HORSE_EXERCISE','RELEASE_PARTICIPANT'), ('HORSE_EXERCISE','RELEASE_HORSE_EXERCISE'),
    -- acquisition == what 'Deal client' resolved to (Guest's three): they come here
    ('HORSE_FINDER','COMPANY_POLICIES'), ('HORSE_FINDER','FACILITY_RULES'), ('HORSE_FINDER','RELEASE_GENERAL'),
    ('HORSE_PURCHASE_ASSISTANCE','COMPANY_POLICIES'), ('HORSE_PURCHASE_ASSISTANCE','FACILITY_RULES'),
    ('HORSE_PURCHASE_ASSISTANCE','RELEASE_GENERAL'),
    ('HORSE_SALE_ASSISTANCE','COMPANY_POLICIES'), ('HORSE_SALE_ASSISTANCE','FACILITY_RULES'),
    ('HORSE_SALE_ASSISTANCE','RELEASE_GENERAL'),
    ('HORSE_LEASE_IN_ASSISTANCE','COMPANY_POLICIES'), ('HORSE_LEASE_IN_ASSISTANCE','FACILITY_RULES'),
    ('HORSE_LEASE_IN_ASSISTANCE','RELEASE_GENERAL'),
    ('HORSE_LEASE_OUT_ASSISTANCE','COMPANY_POLICIES'), ('HORSE_LEASE_OUT_ASSISTANCE','FACILITY_RULES'),
    ('HORSE_LEASE_OUT_ASSISTANCE','RELEASE_GENERAL'),
    -- evaluation == acquisition + the waiver that was hardcoded
    ('HORSE_EVALUATION','COMPANY_POLICIES'), ('HORSE_EVALUATION','FACILITY_RULES'),
    ('HORSE_EVALUATION','RELEASE_GENERAL'), ('HORSE_EVALUATION','EVALUATION_LIABILITY_WAIVER')
    -- ONBOARDING and INDEPENDENT_CONTRACTOR carry nothing, deliberately.
  ) AS x(service_type, template_key)
 WHERE o.deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- ── THE WRITER — what a person owes because of what they BOUGHT.
--    Purely additive, exactly like apply_category_documents: it inserts, it never
--    deletes (NOSTRIP). Narrowing stays narrow_contact_required_documents.
CREATE OR REPLACE FUNCTION public.apply_offering_documents(p_contact_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_n integer;
BEGIN
  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'contact % not found', p_contact_id; END IF;

  INSERT INTO contact_required_documents (contact_id, template_key, org_id)
  SELECT DISTINCT p_contact_id, r.template_key, v_org
    FROM purchases p
    JOIN purchase_items pi ON pi.purchase_id = p.id AND pi.voided_at IS NULL
    JOIN offerings o       ON o.id = pi.offering_id
    JOIN service_type_document_requirements r
      ON r.org_id = v_org AND r.service_type = o.service_type AND r.active
   WHERE p.buyer_contact_id = p_contact_id
     AND coalesce(p.status, '') <> 'void'
     AND p.deleted_at IS NULL
     AND coalesce(o.config_kind, '') <> 'inquire'
  ON CONFLICT DO NOTHING;

  SELECT count(*) INTO v_n FROM contact_required_documents WHERE contact_id = p_contact_id;
  RETURN v_n;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.apply_offering_documents(uuid) TO service_role;

-- ── THE PURCHASE TRIGGER now asks the SERVICE, not the tag.
--    apply_affiliations still runs — tags stay derived and stay accurate; they
--    just no longer decide the paperwork.
CREATE OR REPLACE FUNCTION public.promote_buyer_from_offering()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_org     uuid;
  v_kind    text;
BEGIN
  SELECT p.buyer_contact_id, p.org_id INTO v_contact, v_org
    FROM purchases p WHERE p.id = NEW.purchase_id;
  IF v_contact IS NULL OR v_org IS NULL THEN RETURN NEW; END IF;

  SELECT o.config_kind INTO v_kind FROM offerings o WHERE o.id = NEW.offering_id;
  IF v_kind IS NULL OR v_kind = 'inquire' THEN RETURN NEW; END IF;

  -- Tags stay derived and stay correct — they describe the relationship.
  PERFORM apply_affiliations(v_contact);

  -- ⚠️ OFFERINGDOCS — THE PAPERWORK COMES FROM THE SERVICE, NOT THE TAG.
  -- This used to call apply_category_documents with whatever affiliations the
  -- person now held, so a lesson purchase assigned documents by way of the RIDER
  -- tag. The service the line actually sold is the fact; the tag was a detour
  -- that let a hand-ticked box reach the same outcome.
  PERFORM apply_offering_documents(v_contact);
  RETURN NEW;
END;
$function$;
