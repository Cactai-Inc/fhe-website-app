-- p2 · set_horse_medications: one multi-row INSERT instead of a per-row loop.
--
-- The record editor autosaves medications on field exit (Part 2, item 2). The
-- function is replace-all: it soft-deletes the current set and re-inserts the
-- incoming rows. It did the inserts in a PL/pgSQL loop, one INSERT statement per
-- medication. The doc-sync triggers on horse_medications are STATEMENT-level
-- (disc_22), so a loop of N inserts recomposed every editable document N times.
-- Autosaving on blur made that the cost of every keystroke-exit.
--
-- A single set-based INSERT ... SELECT fires the statement trigger exactly once,
-- so a save is a constant two document syncs (one for the soft-delete UPDATE, one
-- for the insert) regardless of how many medications the horse has. Behaviour is
-- otherwise identical: blank blocks (no name) are dropped, row order is preserved
-- via WITH ORDINALITY (0-based, matching the old loop counter), and every column
-- is written the same way including the supplement/medication conditionals.

CREATE OR REPLACE FUNCTION public.set_horse_medications(p_horse_id uuid, p_items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_me uuid := current_contact_id(); v_staff boolean := has_staff_access();
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT coalesce(v_staff AND v_org = current_org(), false) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
  END IF;

  -- replace-all: soft-delete the current set, then insert the incoming rows in
  -- ONE statement. A per-row loop fired the statement-level doc-sync trigger once
  -- per row; this fires it once.
  UPDATE horse_medications SET deleted_at = now() WHERE horse_id = p_horse_id AND deleted_at IS NULL;

  IF jsonb_typeof(p_items) = 'array' THEN
    INSERT INTO horse_medications (
      org_id, horse_id, kind, sort_order, name, dosage, instructions, cost,
      supplier_website, supplier_phone, rx_info, order_units, days_supply,
      purpose, frequency, cost_per_dose, rx_required)
    SELECT
      v_org, p_horse_id,
      CASE WHEN upper(coalesce(e.item ->> 'kind','MEDICATION')) = 'SUPPLEMENT' THEN 'SUPPLEMENT' ELSE 'MEDICATION' END,
      (e.ord - 1)::int,
      nullif(btrim(e.item ->> 'name'),''), nullif(btrim(e.item ->> 'dosage'),''), nullif(btrim(e.item ->> 'instructions'),''),
      nullif(regexp_replace(coalesce(e.item ->> 'cost',''), '[$,\s]', '', 'g'), '')::numeric,
      nullif(btrim(e.item ->> 'supplier_website'),''), nullif(btrim(e.item ->> 'supplier_phone'),''),
      -- rx_info is meaningful only for medications
      CASE WHEN upper(coalesce(e.item ->> 'kind','MEDICATION')) = 'SUPPLEMENT' THEN NULL ELSE nullif(btrim(e.item ->> 'rx_info'),'') END,
      nullif(btrim(e.item ->> 'order_units'),''), nullif(btrim(e.item ->> 'days_supply'),''),
      nullif(btrim(e.item ->> 'purpose'),''), nullif(btrim(e.item ->> 'frequency'),''),
      nullif(btrim(e.item ->> 'cost_per_dose'),''),
      CASE WHEN e.item ? 'rx_required' THEN (e.item ->> 'rx_required')::boolean ELSE NULL END
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS e(item, ord)
    WHERE coalesce(nullif(btrim(e.item ->> 'name'),''),'') <> '';
  END IF;
END;
$function$;
