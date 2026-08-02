-- U2.2 / U2.3 / U2.4 / U2.5 — labels, medications, EFFECTIVE_DATE, location
-- Verify-first: generate_document was rebuilt as a full CREATE OR REPLACE from
-- its LIVE pg_get_functiondef body captured 2026-08-01. Anchors confirmed live
-- before editing:
--   U2.2  HORSE.AGE_DOB label = 'Year foaled', stores 'April 12, 2016' (a FULL
--         date) on all three documents — the label/value mismatch the spec
--         describes, label-only fix.
--   U2.3  lines 177-179 hardcoded '' for MEDICATION_DOSAGE / _INSTRUCTIONS /
--         _ADDITIONAL.
--   U2.4  line 199 DOC.EFFECTIVE_DATE = to_char(now(), ...).
--   U2.5  lines 61-62 selected locations.name ALONE — no address.
--
-- U2.3 DEVIATION, evidence-backed: the plan says to wire each medication token
-- to horse_medications_prose "with its mode argument". THERE IS NO MODE
-- ARGUMENT. That function's p_kind filters horse_medications.kind (live values:
-- MEDICATION only) and it already emits the FULL composed line —
-- "name — dosage, instructions — units (day supply), $cost/order". Calling it
-- again for DOSAGE and INSTRUCTIONS would repeat the entire line three more
-- times in the document. The tokens name single components, so this adds
-- per-component resolvers instead. MEDICATION_NAME keeps the full composed
-- prose it renders today (templates rely on it).

BEGIN;

-- ============================================================================
-- U2.2 — "Year foaled" -> "Foaling date" (the stored value is a full date)
-- ============================================================================
UPDATE contract_field_defs
   SET label = 'Foaling date'
 WHERE field_key = 'HORSE.AGE_DOB' AND label = 'Year foaled';

-- ============================================================================
-- U2.3 — per-component medication resolvers
-- ============================================================================
-- Component accessors over the same rows horse_medications_prose reads, in the
-- same sort order, joined the same way. Each returns ONLY its own component so
-- the three tokens can never restate the whole medication line.
CREATE OR REPLACE FUNCTION public.horse_medication_component(p_horse_id uuid, p_component text)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT string_agg(part, '; ' ORDER BY sort_order)
  FROM (
    SELECT m.sort_order,
           btrim(CASE upper(p_component)
             WHEN 'DOSAGE'       THEN coalesce(nullif(btrim(m.dosage), ''), '')
             WHEN 'INSTRUCTIONS' THEN coalesce(nullif(btrim(m.instructions), ''), '')
             WHEN 'ADDITIONAL'   THEN
               -- everything that is neither name, dosage nor instructions:
               -- supply/cost/prescription detail, in the prose function's order
               coalesce(nullif(btrim(concat_ws(', ',
                 nullif(btrim(concat_ws(' ', nullif(m.order_units, ''),
                   CASE WHEN m.days_supply IS NOT NULL
                        THEN '(' || m.days_supply || ' day supply)' END)), ''),
                 CASE WHEN m.cost IS NOT NULL
                      THEN '$' || trim(to_char(m.cost, 'FM999999990.00')) || '/order' END,
                 nullif(btrim(m.rx_info), '')
               )), ''), '')
             ELSE '' END) AS part
      FROM horse_medications m
     WHERE m.horse_id = p_horse_id AND m.deleted_at IS NULL AND m.kind = 'MEDICATION'
  ) parts
  WHERE part <> ''
$function$;

COMMENT ON FUNCTION public.horse_medication_component(uuid, text) IS
  'U2.3: single medication component (DOSAGE | INSTRUCTIONS | ADDITIONAL) across a horse''s medications. horse_medications_prose renders the whole line; this renders one part of it.';

-- ============================================================================
-- U2.5 — location tokens compose name + address
-- ============================================================================
-- Live data note: locations.address_line1/city/state/postal are empty and the
-- freeform locations.address carries the whole thing ("Carmel Creek Ranch, San
-- Diego, CA"). Structured columns win when present; the freeform value is the
-- fallback; the name alone is the last resort. Format matches the existing
-- 'location' composer in compose_field_prose: "name — address".
CREATE OR REPLACE FUNCTION public.location_full_label(p_location_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    nullif(btrim(CASE
      -- structured address present: always "name — street, city, ST postal"
      WHEN nullif(compose_address(l.address_line1, NULL, l.city, l.state, l.postal), '') IS NOT NULL
        THEN concat_ws(' — ', nullif(btrim(l.name), ''),
                       compose_address(l.address_line1, NULL, l.city, l.state, l.postal))
      -- freeform address that already leads with the name: use it as-is.
      -- Live data does exactly this ("Carmel Creek Ranch, San Diego, CA"), and
      -- composing again yields "Carmel Creek Ranch — Carmel Creek Ranch, ...".
      WHEN nullif(btrim(l.address), '') IS NOT NULL
       AND lower(btrim(l.address)) LIKE lower(btrim(l.name)) || '%'
        THEN btrim(l.address)
      -- freeform address that does not name the facility: compose both
      WHEN nullif(btrim(l.address), '') IS NOT NULL
        THEN concat_ws(' — ', nullif(btrim(l.name), ''), btrim(l.address))
      ELSE btrim(coalesce(l.name, ''))
    END), ''),
    ''
  )
  FROM locations l WHERE l.id = p_location_id
$function$;

COMMENT ON FUNCTION public.location_full_label(uuid) IS
  'U2.5: a facility name plus its address. "FHE Main Barn Stall 12" is not an address on a legal instrument.';

COMMIT;
