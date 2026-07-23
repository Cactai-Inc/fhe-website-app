-- §7 Ownership — support outright / financed-without-lease-restrictions /
-- co-owned-with-authority owners, and capture co-owner name + phone when the
-- Lessor is not the sole owner.

-- contacts_list composer: { coOwners:[{name,phone}] } → "Jane Doe (555-1234);
-- John Smith (555-9876)". Rows with no name are skipped.
CREATE OR REPLACE FUNCTION public.compose_contacts_list(p jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT coalesce(string_agg(
           btrim(r->>'name')
           || CASE WHEN coalesce(nullif(btrim(r->>'phone'),''),'') <> ''
                   THEN ' (' || btrim(r->>'phone') || ')' ELSE '' END,
           '; ' ORDER BY ord), '')
    FROM jsonb_array_elements(coalesce(p->'coOwners','[]'::jsonb)) WITH ORDINALITY AS t(r, ord)
   WHERE coalesce(nullif(btrim(r->>'name'),''),'') <> '';
$function$;

-- add the 'contacts_list' case to compose_field_prose
DO $mig$
DECLARE v_def text;
BEGIN
  v_def := pg_get_functiondef('compose_field_prose'::regproc);
  v_def := replace(v_def,
$old$    WHEN 'week_grid' THEN v_out := compose_week_grid(s);$old$,
$new$    WHEN 'week_grid' THEN v_out := compose_week_grid(s);
    WHEN 'contacts_list' THEN v_out := compose_contacts_list(s);$new$);
  IF v_def NOT LIKE '%compose_contacts_list(s)%' THEN RAISE EXCEPTION 'compose_field_prose: week_grid case not found'; END IF;
  EXECUTE v_def;
END $mig$;

-- ── rewrite the ownership warranty to cover the three ownership situations ────
UPDATE contract_clause_defs
   SET body = 'Lessor warrants that Lessor lawfully owns the Horse — whether owned outright, financed without any restriction that prohibits or limits leasing the Horse, or owned jointly with one or more other owners — and that Lessor has all requisite rights, authority, and (where there are co-owners) permission to enter into this Agreement and lease the Horse.'
           || E'\n' || 'I am the sole owner of the Horse: {{TXN.IS_SOLE_OWNER}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.OWNERSHIP';

-- ── co-owner capture: name + phone, shown only when NOT the sole owner ────────
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'HORSE', 'HORSE.COOWNERS', NULL,
   'Name and phone number for each other owner of the Horse: {{TXN.CO_OWNERS}}',
   23,   -- after the cert (22), before the limitations question (which shifts to 24+)
   '{"equals": ["NO"], "field_key": "TXN.IS_SOLE_OWNER"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body,
      sort_order = EXCLUDED.sort_order, conditional_on = EXCLUDED.conditional_on;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2', 'TXN.CO_OWNERS', 'HORSE.COOWNERS', 'HORSE',
   'Co-owner(s)', 'contacts_list', 'text', 'contacts_list',
   'LESSOR', 1, 'Add another co-owner')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key,
      owner_role = EXCLUDED.owner_role, sort_order = EXCLUDED.sort_order, guidance = EXCLUDED.guidance;

-- shift the limitations question + input down so the co-owner list slots in after
-- the cert. (cert=22, coowners=23, limits-question=25, limits-input=26)
UPDATE contract_clause_defs SET sort_order = 25
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.OWNERSHIP_LIMITS_Q';
UPDATE contract_clause_defs SET sort_order = 26
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.OWNERSHIP_LIMITS';
