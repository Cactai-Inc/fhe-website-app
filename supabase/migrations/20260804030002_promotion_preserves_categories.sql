-- K2 follow-up: promotion must ADD a category, never replace the person's set.
--
-- apply_category_documents() is a REPLACE operation by design (it deletes
-- requirements outside the categories it is given), which is correct when the
-- caller passes a contact's COMPLETE category list. The promotion trigger was
-- passing only the newly-derived one, so a guest who bought a lesson lost
-- RELEASE_GENERAL — the same requirement-stripping class as the GUEST re-invite
-- wipe fixed earlier. Pass the union of existing affiliations plus the new one.
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
  v_all     text[];
BEGIN
  SELECT p.buyer_contact_id, p.org_id INTO v_contact, v_org
    FROM purchases p WHERE p.id = NEW.purchase_id;
  IF v_contact IS NULL OR v_org IS NULL THEN RETURN NEW; END IF;

  SELECT o.segment, o.config_kind INTO v_segment, v_kind
    FROM offerings o WHERE o.id = NEW.offering_id;
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

  -- EVERY affiliation this person now holds, so the replace-semantics of
  -- apply_category_documents cannot strip an earlier category's documents.
  SELECT coalesce(array_agg(DISTINCT g.group_type), ARRAY[]::text[]) INTO v_all
    FROM groups g
   WHERE g.contact_id = v_contact
     AND g.group_type IN ('GUEST','RIDER','HORSE_OWNER');

  PERFORM apply_category_documents(v_contact, v_all);
  RETURN NEW;
END;
$function$;
