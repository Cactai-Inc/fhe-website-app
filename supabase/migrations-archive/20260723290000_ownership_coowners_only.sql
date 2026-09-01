-- §7 Ownership — simplify: drop the sole-owner Yes/No and the certification
-- checkbox entirely. The warranty already covers the ownership situations; the
-- only remaining input is an optional "Add Co-Owner" list (first, last, phone,
-- email). Co-owners are listed when there are any; nothing to answer otherwise.

-- remove the sole-owner question and the certification (fields + clause).
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.IS_SOLE_OWNER', 'TXN.SOLE_OWNER_CERT');
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.SOLE_OWNER_CERT';

-- warranty clause: drop the "I am the sole owner? …" line; keep just the warranty.
UPDATE contract_clause_defs
   SET body = 'Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.OWNERSHIP';

-- co-owners clause: no longer gated (always available via the Add Co-Owner button).
-- "Co-owners:" is a clean label so its line strips cleanly when none are listed.
UPDATE contract_clause_defs
   SET body = 'Co-owners: {{TXN.CO_OWNERS}}',
       conditional_on = NULL,
       sort_order = 22
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.COOWNERS';

-- co-owner field: relabel the add button.
UPDATE contract_field_defs
   SET guidance = 'Add Co-Owner'
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.CO_OWNERS';

-- compose the co-owner list from first/last/phone/email → prose, e.g.
-- "Jane Doe, 555-123-4567, jane@x.com; John Smith, 555-987-6543".
CREATE OR REPLACE FUNCTION public.compose_contacts_list(p jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(string_agg(entry, '; ' ORDER BY ord), '')
    FROM (
      SELECT ord, btrim(concat_ws(', ',
               nullif(btrim(concat_ws(' ', nullif(btrim(r->>'first'),''), nullif(btrim(r->>'last'),''))), ''),
               nullif(btrim(r->>'phone'),''),
               nullif(btrim(r->>'email'),'')
             )) AS entry
        FROM jsonb_array_elements(coalesce(p->'coOwners','[]'::jsonb)) WITH ORDINALITY AS t(r, ord)
    ) q
   WHERE coalesce(nullif(entry,''),'') <> '';
$function$;
