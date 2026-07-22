-- §10.4: "Other Prohibited Activities" → "Other Allowed Activities" (permitted).
UPDATE contract_field_defs
   SET label='Other allowed activities',
       options='[{"label":"Breeding","value":"BREEDING"},{"label":"Emotional Support","value":"EMOTIONAL_SUPPORT"},{"label":"Film / Television / Advertising","value":"FILM_TV_AD"},{"label":"Other","value":"OTHER"}]'::jsonb,
       guidance='Select any additional activities the Lessee is permitted to engage in with the Horse.'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.OTHER_PROHIBITED';
UPDATE contract_clause_defs
   SET body='Lessee is permitted to engage in the following activities with the Horse: {{TXN.OTHER_PROHIBITED}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER';
UPDATE contract_field_defs SET label='Other allowed activity'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.OTHER_PROHIBITED_NOTE';
UPDATE contract_clause_defs
   SET body='Other allowed activity: {{TXN.OTHER_PROHIBITED_NOTE}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER_NOTE';

-- §11.5 Protective Equipment: keep a titled, numbered clause always (removed only
-- when "No"). Give the base clause a heading + the yes/no gate inline, and gate the
-- whole clause on the answer being non-empty so it only fully disappears when the
-- author explicitly answers No... but the user wants it to KEEP the title/number
-- until No is chosen. So: base clause is titled "Protective Equipment" and always
-- shows the yes/no; the equipment detail clause shows on Yes; on No, hide the base.
UPDATE contract_clause_defs
   SET heading='Protective Equipment',
       body='Horse must wear protective equipment: {{TXN.PROTECTIVE_REQUIRED}}',
       conditional_on=NULL, is_optional=false
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.PROTECTIVE';
-- the equipment detail clause: shown on Yes; the "provided by Lessor" wording.
UPDATE contract_clause_defs
   SET body='Lessor will provide the following equipment for the Horse: {{TXN.PROTECTIVE_EQUIPMENT}}
Lessee must ensure equipment is used and properly secured to the Horse prior to all activities.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.PROTECTIVE_EQUIP';

-- §11.6 Tack: a yes/no question, and on Yes the prohibited-items line + input. The
-- yes/no gate lives on the (titled) base clause; the input line is a gated
-- follow-on. The X-to-revert is a client affordance (clearing the yes/no).
UPDATE contract_field_defs
   SET label='Is Lessee prohibited from using certain tack or equipment?'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TACK_PROHIBITED';
-- add the yes/no gate field on the tack clause
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, guidance,
   required, is_optional, sort_order, format_type, clause_key)
VALUES
  ('HORSE_LEASE_V2', 'TXN.TACK_HAS_PROHIBITED', 'Is Lessee prohibited from using certain tack or equipment?',
   'CARE', 'LESSOR', 'yesno', 'text', NULL, false, false, 70, 'yesno', 'CARE.TACK');
UPDATE contract_clause_defs
   SET heading='Tack', is_optional=false,
       body='When riding and handling the Horse, Lessee shall use only tack in good condition that is properly fitted to the Horse. Is Lessee prohibited from using certain tack or equipment? {{TXN.TACK_HAS_PROHIBITED}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='CARE.TACK';
-- the prohibited-items line becomes a gated follow-on on its own field's clause
UPDATE contract_field_defs SET clause_key='CARE.TACK_PROHIBITED', label='Prohibited tack and equipment', sort_order=72
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TACK_PROHIBITED';
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.TACK_PROHIBITED', NULL,
   'Lessee is prohibited from using these items: {{TXN.TACK_PROHIBITED}}.',
   'input', 72, false, '{"field_key":"TXN.TACK_HAS_PROHIBITED","equals":["YES"]}'::jsonb);

-- Unify the defined term to "the Horse" throughout the prose. Blanket-insert the
-- article before " Horse", then repair the cases where it must not appear:
--   • the "Horse Lease Agreement" title
--   • the "(the "Horse")" definition
--   • double articles created by the blanket pass
UPDATE contract_clause_defs SET body =
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          replace(body, ' Horse', ' the Horse'),
        'the the Horse', 'the Horse', 'g'),
      'The the Horse', 'The Horse', 'g'),
    'the Horse Lease Agreement', 'Horse Lease Agreement', 'g'),
  '\(the "the Horse"\)', '(the "Horse")', 'g')
 WHERE template_key='HORSE_LEASE_V2' AND body LIKE '% Horse%';
