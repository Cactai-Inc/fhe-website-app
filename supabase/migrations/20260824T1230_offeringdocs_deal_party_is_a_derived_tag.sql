-- TASK-OFFERINGDOCS §9 — DEAL_PARTY, derived from holding a contract role.
--
-- Owner, 2026-08-24: "I add a horse and a contract and the deal party and horse
-- owner tags are applied to them."
--
-- The horse half already worked (trigger horses_apply_affiliations). The contract
-- half could not exist: groups_group_type_check admitted four values and
-- derive_affiliations had no contract-party branch at all.
--
-- ⚠️ D31 warns against adding tokens to this list, having watched GUEST → RIDER →
-- HORSE_OWNER → 'Deal client' each arrive that way. THIS ONE IS ADMISSIBLE FOR
-- D31'S OWN REASON: it is DERIVED from holding a contract role, never picked at
-- account creation — which is exactly the shape D31 said the deal-party badge
-- should have. It obligates nothing; documents come from the service or the door.
ALTER TABLE groups DROP CONSTRAINT groups_group_type_check;
ALTER TABLE groups ADD CONSTRAINT groups_group_type_check
  CHECK (group_type = ANY (ARRAY['GUEST'::text,'RIDER'::text,'HORSE_OWNER'::text,
                                 'PARENT_GUARDIAN'::text,'DEAL_PARTY'::text]));

DO $mig$
DECLARE v_src text; v_old text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'derive_affiliations';
  IF v_src IS NULL THEN RAISE EXCEPTION 'derive_affiliations not found'; END IF;
  IF position('DEAL_PARTY' IN v_src) > 0 THEN
    RAISE NOTICE 'DEAL_PARTY already derived — nothing to do'; RETURN;
  END IF;

  v_old := $q$      UNION
      SELECT 'PARENT_GUARDIAN' WHERE EXISTS ($q$;
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'derive_affiliations is not the shape this migration expected';
  END IF;

  v_src := replace(v_src, v_old, $q$      UNION
      -- DEAL_PARTY: they are named on a contract. A description, not an
      -- obligation — it says "this person has a deal with us" and assigns
      -- nothing. The company itself is never tagged: on every lease FHE writes,
      -- one of the parties IS French Heritage Equestrian.
      SELECT 'DEAL_PARTY' WHERE EXISTS (
        SELECT 1 FROM document_parties dp
          JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
          JOIN contacts c2 ON c2.id = dp.contact_id
         WHERE dp.contact_id = p_contact_id
           AND dp.party_role IN ('BUYER','SELLER','LESSEE','LESSOR')
           AND NOT coalesce(c2.is_company, false))
      UNION
      SELECT 'PARENT_GUARDIAN' WHERE EXISTS ($q$);
  EXECUTE v_src;
END
$mig$;

-- Placing somebody on a contract recomputes their tags, through the sole writer.
CREATE OR REPLACE FUNCTION public.trg_apply_affiliations_on_party()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM apply_affiliations(coalesce(NEW.contact_id, OLD.contact_id));
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- A tag is a description. It must never be able to refuse a party placement.
  RAISE WARNING 'apply_affiliations after party change failed: %', SQLERRM;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS document_parties_apply_affiliations ON document_parties;
CREATE TRIGGER document_parties_apply_affiliations
  AFTER INSERT OR UPDATE OF contact_id ON document_parties
  FOR EACH ROW EXECUTE FUNCTION trg_apply_affiliations_on_party();
