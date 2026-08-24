-- TASK-OFFERINGDOCS — a requirement must point at a template that EXISTS.
--
-- ⚠️ THIS FIXES A BUG THIS TASK INTRODUCED, ONE HOUR EARLIER.
--
-- 20260824T1200 seeded service_type_document_requirements and folded in three
-- rules that had been hardcoded in function bodies. Two of them
-- (RELEASE_JUMPER_ADDENDUM, EVALUATION_LIABILITY_WAIVER) point at live
-- templates. The third, RELEASE_HORSE_EXERCISE, was SOFT-DELETED on 2026-07-05 —
-- inactive and deleted_at set — and folding it in created a requirement that can
-- never be satisfied and is invisible on every surface, because the wall, the
-- onboarding page and the generator all join ACTIVE templates. Buying any horse
-- exercise service would have written a permanent, unsignable obligation.
--
-- Caught by sweeping retired templates for code that still names them, which is
-- the sweep the owner asked for after MEDIA_RELEASE. Nobody was affected: zero
-- contact_required_documents rows point at an unsatisfiable template.
--
-- The seed row goes, and then the class goes: both requirement tables get the
-- guard the RPC already had. A CHECK cannot subquery, so it is a trigger.

DELETE FROM service_type_document_requirements r
 WHERE NOT EXISTS (SELECT 1 FROM contract_templates ct
                    WHERE ct.template_key = r.template_key
                      AND ct.active AND ct.deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.assert_template_is_satisfiable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contract_templates ct
                  WHERE ct.template_key = NEW.template_key
                    AND ct.active AND ct.deleted_at IS NULL) THEN
    RAISE EXCEPTION
      'no active template "%" — a requirement pointing at a retired template can '
      'never be signed and never appears on any surface', NEW.template_key;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS stdr_template_must_be_satisfiable ON service_type_document_requirements;
CREATE TRIGGER stdr_template_must_be_satisfiable
  BEFORE INSERT OR UPDATE OF template_key ON service_type_document_requirements
  FOR EACH ROW EXECUTE FUNCTION assert_template_is_satisfiable();

DROP TRIGGER IF EXISTS spdr_template_must_be_satisfiable ON sign_path_document_requirements;
CREATE TRIGGER spdr_template_must_be_satisfiable
  BEFORE INSERT OR UPDATE OF template_key ON sign_path_document_requirements
  FOR EACH ROW EXECUTE FUNCTION assert_template_is_satisfiable();

-- NOT added to contact_required_documents: a template can be retired AFTER
-- somebody was legitimately asked for it, and that history is evidence (D32).
-- The guard belongs where requirements are AUTHORED, not where they are recorded.
