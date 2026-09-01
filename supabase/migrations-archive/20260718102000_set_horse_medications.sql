-- Replace-all a horse's medications + supplements from the form. Authorized like the
-- other horse writes (staff, or the horse's owner/lessee). p_items is an array of
-- { kind, name, dosage, instructions, cost, supplier_website, supplier_phone, rx_info,
--   order_units, days_supply }.
CREATE OR REPLACE FUNCTION public.set_horse_medications(p_horse_id uuid, p_items jsonb)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_org uuid; v_me uuid := current_contact_id(); v_staff boolean := has_staff_access();
  it jsonb; i int := 0;
BEGIN
  SELECT org_id INTO v_org FROM horses WHERE id = p_horse_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown horse'; END IF;
  IF NOT (v_staff AND v_org = current_org()) THEN
    IF v_me IS NULL OR v_me NOT IN (
      (SELECT current_owner_contact_id FROM horses WHERE id = p_horse_id),
      (SELECT lessee_contact_id FROM horses WHERE id = p_horse_id)
    ) THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;
  END IF;

  -- replace-all: soft-delete the current set, then insert the incoming rows
  UPDATE horse_medications SET deleted_at = now() WHERE horse_id = p_horse_id AND deleted_at IS NULL;

  IF jsonb_typeof(p_items) = 'array' THEN
    FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      -- skip blank blocks (no name)
      CONTINUE WHEN coalesce(nullif(btrim(it ->> 'name'),''),'') = '';
      INSERT INTO horse_medications (
        org_id, horse_id, kind, sort_order, name, dosage, instructions, cost,
        supplier_website, supplier_phone, rx_info, order_units, days_supply)
      VALUES (
        v_org, p_horse_id,
        CASE WHEN upper(coalesce(it ->> 'kind','MEDICATION')) = 'SUPPLEMENT' THEN 'SUPPLEMENT' ELSE 'MEDICATION' END,
        i,
        nullif(btrim(it ->> 'name'),''), nullif(btrim(it ->> 'dosage'),''), nullif(btrim(it ->> 'instructions'),''),
        nullif(regexp_replace(coalesce(it ->> 'cost',''), '[$,\s]', '', 'g'), '')::numeric,
        nullif(btrim(it ->> 'supplier_website'),''), nullif(btrim(it ->> 'supplier_phone'),''),
        -- rx_info is meaningful only for medications
        CASE WHEN upper(coalesce(it ->> 'kind','MEDICATION')) = 'SUPPLEMENT' THEN NULL ELSE nullif(btrim(it ->> 'rx_info'),'') END,
        nullif(btrim(it ->> 'order_units'),''), nullif(btrim(it ->> 'days_supply'),''));
      i := i + 1;
    END LOOP;
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.set_horse_medications(uuid, jsonb) TO authenticated;

-- read: a horse's active meds + supplements, ordered
CREATE OR REPLACE FUNCTION public.horse_medications_list(p_horse_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'kind', kind, 'name', name, 'dosage', dosage, 'instructions', instructions,
    'cost', cost, 'supplier_website', supplier_website, 'supplier_phone', supplier_phone,
    'rx_info', rx_info, 'order_units', order_units, 'days_supply', days_supply)
    ORDER BY kind, sort_order), '[]'::jsonb)
  FROM horse_medications
  WHERE horse_id = p_horse_id AND deleted_at IS NULL
    AND (has_staff_access() OR caller_owns_horse(horse_id));
$function$;
GRANT EXECUTE ON FUNCTION public.horse_medications_list(uuid) TO authenticated;
