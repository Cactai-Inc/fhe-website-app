-- Disclosure reciprocity, phase 10: new contracts use the v3 templates. Repoint every
-- creation and grouping path to HORSE_LEASE_V3 / HORSE_SALE_V3 (BOS keeps its key).
-- Deactivate the old lease/sale templates so no new document is built on them; their
-- rows remain intact so the existing in-flight v2 documents keep composing unchanged.

-- 1. start_lease_contract_v2 default key -> v3
DO $a$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.start_lease_contract_v2(uuid,uuid,uuid,text,text)'::regprocedure) INTO v_def;
  v_def := replace(v_def, $old$DEFAULT 'HORSE_LEASE_V2'::text$old$, $new$DEFAULT 'HORSE_LEASE_V3'::text$new$);
  EXECUTE v_def;
END $a$;

-- 2. start_sale_contract hardcoded key -> v3
DO $b$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.start_sale_contract(uuid,uuid,uuid,numeric,numeric)'::regprocedure) INTO v_def;
  v_def := replace(v_def, 'HORSE_SALE_V2', 'HORSE_SALE_V3');
  EXECUTE v_def;
END $b$;

-- 3. start_bill_of_sale references the sale key for the companion sale -> v3
DO $c$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.start_bill_of_sale(uuid)'::regprocedure) INTO v_def;
  v_def := replace(v_def, 'HORSE_SALE_V2', 'HORSE_SALE_V3');
  EXECUTE v_def;
END $c$;

-- 4. generate_lease_availability: look at v3 (the forks are retired)
DO $d$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.generate_lease_availability(uuid,integer)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $old$IN ('HORSE_LEASE_V2','HORSE_LEASE_SIMPLE','HORSE_LEASE_FULL')$old$,
    $new$IN ('HORSE_LEASE_V3')$new$);
  EXECUTE v_def;
END $d$;

-- 5. deal_template_options (hardcoded VALUES list) -> v3 keys + title "Horse Sale Agreement"
CREATE OR REPLACE FUNCTION public.deal_template_options(p_deal_type text)
 RETURNS TABLE(template_key text, title text, required boolean, sort_order integer)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT t.template_key, t.title, t.required, t.sort_order
    FROM (VALUES
      ('SALE',  'HORSE_BILL_OF_SALE', 'Bill of Sale',          true,  10),
      ('SALE',  'HORSE_SALE_V3',      'Horse Sale Agreement',  false, 20),
      ('LEASE', 'HORSE_LEASE_V3',     'Horse Lease Agreement', true,  10)
    ) AS t(deal_type, template_key, title, required, sort_order)
   WHERE t.deal_type = p_deal_type;
$function$;

-- 6. Deactivate the old lease/sale templates (rows kept for in-flight v2 docs).
UPDATE contract_templates SET active = false
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_SIMPLE','HORSE_LEASE_FULL','HORSE_LEASE_STANDARD','HORSE_LEASE',
                        'HORSE_SALE_V2','HORSE_PURCHASE_SALE','HORSE_SALE_TRANSFER');
-- v3 are active; BOS stays active.
UPDATE contract_templates SET active = true WHERE template_key IN ('HORSE_LEASE_V3','HORSE_SALE_V3');
