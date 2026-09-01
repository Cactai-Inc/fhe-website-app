-- Stage 3 verification fix — PRODUCTION BLOCKER (S3.6d):
--
-- apply_document_supersession passed a jsonb to log_status_event's p_detail,
-- which is TEXT. Postgres finds no matching signature and the trigger raises,
-- so ANY re-signing of a template family already on file would have failed at
-- execution time. The detail is now a text sentence naming the superseding
-- document (the same shape other detail strings use).
--
-- Caller sweep (pg_proc, whole schema): apply_document_supersession was the
-- ONLY caller passing a non-text p_detail — every other call site either omits
-- the argument or passes text. No other type mismatch exists.

CREATE OR REPLACE FUNCTION public.apply_document_supersession()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  -- The just-executed document supersedes every prior executed document of
  -- the SAME template family (any version) for the SAME person.
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
  LOOP
    UPDATE documents SET current_status = 'superseded' WHERE id = r.id;
    PERFORM log_status_event('document', r.id, 'superseded',
      'Superseded by document ' || NEW.id::text, NEW.org_id);
  END LOOP;
  RETURN NEW;
END;
$function$;
