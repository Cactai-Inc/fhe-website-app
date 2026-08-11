-- SUPERSEDE: apply_document_supersession must not cross horses.
--
-- The old predicate matched contact + template_key only, so executing one
-- horse's document marked a DIFFERENT horse's executed document of the same
-- template superseded (armed today on CJ Z's Beaumont/Peep Show pairs).
--
-- Owner ruling 2026-08-10 on the NULL side: a horse-bound execution DOES
-- supersede a blank-horse prior (an untargeted authorization replaced by a
-- targeted one — Sarah Morgan's retained pair). A blank execution never
-- revokes horse-bound priors. Hence:
--
--   d.horse_id IS NULL            -> superseded by any execution of the family
--   d.horse_id = NEW.horse_id     -> superseded (same horse, plain replacement)
--   d.horse_id <> NEW.horse_id    -> retained (different obligation)
--
-- NOTE: no BEGIN/COMMIT in this file — it is applied inside the standard
-- dry-run/apply wrapper.

CREATE OR REPLACE FUNCTION public.apply_document_supersession()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  -- The just-executed document supersedes every prior executed document of
  -- the SAME template family (any version) for the SAME person, scoped to
  -- the SAME horse. A blank-horse prior (no horse_id) is superseded by any
  -- execution of the family; a horse-bound prior is only superseded by a
  -- replacement for that same horse.
  FOR r IN
    SELECT d.id FROM documents d
    JOIN contract_templates ct_old ON ct_old.id = d.template_id
    JOIN contract_templates ct_new ON ct_new.id = NEW.template_id
   WHERE d.contact_id = NEW.contact_id
     AND d.id <> NEW.id
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
     AND coalesce(d.current_status, '') <> 'superseded'
     AND ct_old.template_key = ct_new.template_key
     AND (d.horse_id IS NULL OR d.horse_id = NEW.horse_id)
  LOOP
    UPDATE documents SET current_status = 'superseded' WHERE id = r.id;
    PERFORM log_status_event('document', r.id, 'superseded',
      'Superseded by document ' || NEW.id::text, NEW.org_id);
  END LOOP;
  RETURN NEW;
END;
$function$;
