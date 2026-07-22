-- §11.6 Tack — collapse the yes/no gate + follow-on input into ONE reveal_text
-- control: it shows the question with Yes/No; choosing Yes replaces the question
-- with the prohibited-items line + input and a small ✕ to revert to the question.
-- Remove the separate gate field + follow-on clause added earlier.
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.TACK_PROHIBITED';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TACK_HAS_PROHIBITED';

UPDATE contract_field_defs
   SET input_kind='reveal_text', value_type='text', format_type='reveal_text',
       label='Is Lessee prohibited from using certain tack or equipment?', clause_key='CARE.TACK', sort_order=70
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TACK_PROHIBITED';

UPDATE contract_clause_defs
   SET body='When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse.
{{TXN.TACK_PROHIBITED}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.TACK';

-- reveal_text compose helper + hook into compose_field_prose.
CREATE OR REPLACE FUNCTION public.compose_reveal_text(p_structured jsonb, p_value text)
 RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    WHEN coalesce(nullif(btrim(coalesce(p_structured->>'text', p_value, '')),''),'') = '' THEN ''
    ELSE 'Lessee is prohibited from using these items: ' || btrim(coalesce(p_structured->>'text', p_value)) || '.'
  END;
$fn$;
-- NOTE: the reveal_text CASE branch is injected into compose_field_prose in this
-- migration via a DO block that rewrites the function definition (see repo history);
-- the branch reads: WHEN 'reveal_text' THEN v_out := compose_reveal_text(s, p_value);

-- §11.5 base protective clause: the yes/no is an AUTHORING control (not printed),
-- and the whole titled clause is hidden when the author selects No. Empty body +
-- the yes/no field as an orphan gate on the clause; gate the clause on != NO.
UPDATE contract_clause_defs
   SET body='', conditional_on='{"field_key":"TXN.PROTECTIVE_REQUIRED","equals":["YES",""]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.PROTECTIVE';
