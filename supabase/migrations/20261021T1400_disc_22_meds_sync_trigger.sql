-- Disclosure rebuild, phase 22: medication edits reach open contracts live, via a
-- STATEMENT-LEVEL trigger that calls the shared sync core directly.
--
-- Medications/supplements live on horse_medications (a child table), so the
-- horses-row sync trigger never fired for a med change. This trigger fires ONCE per
-- statement (set_horse_medications replaces the whole set in one call), collects the
-- affected horses from the transition tables, and calls sync_horse_documents for
-- each with p_force=true — the force is required because a med change alters no
-- horses column, so the value-diff alone would detect nothing. It does NOT touch the
-- horses row or updated_at.

-- Separate INSERT / UPDATE / DELETE triggers: a single statement trigger cannot
-- declare both an OLD TABLE and a NEW TABLE across all three events, so each event
-- gets its own trigger with only the transition table that event provides.
DROP TRIGGER IF EXISTS horse_medications_sync_documents ON public.horse_medications;
DROP TRIGGER IF EXISTS horse_medications_sync_ins ON public.horse_medications;
DROP TRIGGER IF EXISTS horse_medications_sync_upd ON public.horse_medications;
DROP TRIGGER IF EXISTS horse_medications_sync_del ON public.horse_medications;

-- INSERT: only NEW TABLE exists.
CREATE OR REPLACE FUNCTION public.sync_documents_on_medication_insert()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE h record; v_horse horses%ROWTYPE;
BEGIN
  FOR h IN SELECT horse_id FROM new_rows WHERE horse_id IS NOT NULL GROUP BY horse_id LOOP
    SELECT * INTO v_horse FROM horses WHERE id = h.horse_id;
    IF FOUND THEN PERFORM sync_horse_documents(v_horse, v_horse, true); END IF;
  END LOOP;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.sync_documents_on_medication_delete()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE h record; v_horse horses%ROWTYPE;
BEGIN
  FOR h IN SELECT horse_id FROM old_rows WHERE horse_id IS NOT NULL GROUP BY horse_id LOOP
    SELECT * INTO v_horse FROM horses WHERE id = h.horse_id;
    IF FOUND THEN PERFORM sync_horse_documents(v_horse, v_horse, true); END IF;
  END LOOP;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.sync_documents_on_medication_update()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE h record; v_horse horses%ROWTYPE;
BEGIN
  FOR h IN
    SELECT horse_id FROM (SELECT horse_id FROM new_rows UNION SELECT horse_id FROM old_rows) s
     WHERE horse_id IS NOT NULL GROUP BY horse_id
  LOOP
    SELECT * INTO v_horse FROM horses WHERE id = h.horse_id;
    IF FOUND THEN PERFORM sync_horse_documents(v_horse, v_horse, true); END IF;
  END LOOP;
  RETURN NULL;
END $function$;

CREATE TRIGGER horse_medications_sync_ins
  AFTER INSERT ON public.horse_medications
  REFERENCING NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION sync_documents_on_medication_insert();

CREATE TRIGGER horse_medications_sync_upd
  AFTER UPDATE ON public.horse_medications
  REFERENCING OLD TABLE AS old_rows NEW TABLE AS new_rows
  FOR EACH STATEMENT EXECUTE FUNCTION sync_documents_on_medication_update();

CREATE TRIGGER horse_medications_sync_del
  AFTER DELETE ON public.horse_medications
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION sync_documents_on_medication_delete();
