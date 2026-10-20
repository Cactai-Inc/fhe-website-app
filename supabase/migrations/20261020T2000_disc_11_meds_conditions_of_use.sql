-- Disclosure reciprocity, phase 11: persist the medications/supplements conditions-of-
-- use note through set_horse_medications.

DO $m$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.set_horse_medications(uuid,jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    'supplier_website, supplier_phone, rx_info, order_units, days_supply)',
    'supplier_website, supplier_phone, rx_info, order_units, days_supply, conditions_of_use)');
  v_def := replace(v_def,
    $old$        nullif(btrim(it ->> 'order_units'),''), nullif(btrim(it ->> 'days_supply'),''));$old$,
    $new$        nullif(btrim(it ->> 'order_units'),''), nullif(btrim(it ->> 'days_supply'),''),
        nullif(btrim(it ->> 'conditions_of_use'),''));$new$);
  EXECUTE v_def;
END $m$;

-- horse_medications_list returns conditions_of_use so the form round-trips it.
CREATE OR REPLACE FUNCTION public.horse_medications_list(p_horse_id uuid)
 RETURNS jsonb
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'kind', kind, 'name', name, 'dosage', dosage, 'instructions', instructions,
    'cost', cost, 'supplier_website', supplier_website, 'supplier_phone', supplier_phone,
    'rx_info', rx_info, 'order_units', order_units, 'days_supply', days_supply,
    'conditions_of_use', conditions_of_use)
    ORDER BY kind, sort_order), '[]'::jsonb)
  FROM horse_medications
  WHERE horse_id = p_horse_id AND deleted_at IS NULL
    AND (has_staff_access() OR caller_owns_horse(horse_id));
$function$;
