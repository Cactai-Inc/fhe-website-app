-- Add the three-location section to the HORSE_LEASE body, with the clause order
-- the owner specified: the obligation-to-update clause is stated FIRST, then the
-- statement that the current location is updated in accordance with the lease terms.
--
-- New tokens:
--   {{HORSE.HOME_LOCATION}}       — Home Location (owner's normal boarding site)
--   {{TXN.CONTRACT_LOCATIONS}}    — Contract Location(s), one or more w/ optional dates
--   {{HORSE.CURRENT_LOCATION}}    — already exists (Current Location)

INSERT INTO template_tokens (template_id, namespace, field, token, kind, computed, required, party_scoped)
SELECT id, 'HORSE', 'HOME_LOCATION', '{{HORSE.HOME_LOCATION}}', 'field', false, false, false
  FROM contract_templates WHERE template_key = 'HORSE_LEASE'
ON CONFLICT DO NOTHING;

INSERT INTO template_tokens (template_id, namespace, field, token, kind, computed, required, party_scoped)
SELECT id, 'TXN', 'CONTRACT_LOCATIONS', '{{TXN.CONTRACT_LOCATIONS}}', 'field', false, false, false
  FROM contract_templates WHERE template_key = 'HORSE_LEASE'
ON CONFLICT DO NOTHING;

-- Replace the lone "Current Location:" identification line with the full location
-- section. The obligation-to-update clause comes BEFORE the accordance statement.
UPDATE contract_templates
SET body = replace(
  body,
  E'Current Location: {{HORSE.CURRENT_LOCATION}}\n',
  E'\nHORSE LOCATION\n\n'
  || E'Home Location (normal boarding residence): {{HORSE.HOME_LOCATION}}\n\n'
  || E'Contract Location(s) — where the Horse will reside during the Lease Term: {{TXN.CONTRACT_LOCATIONS}}\n\n'
  || E'Lessee''s Obligation to Update Location. Lessee shall keep the Horse''s location'
  || E' current and accurate at all times and shall promptly notify Lessor and French'
  || E' Heritage Equestrian of any change to the Horse''s boarding or residing location,'
  || E' so the Horse can be located and every party who needs to know its whereabouts has'
  || E' accurate information at all times.\n\n'
  || E'The Current Location of the Horse is updated in accordance with the terms of this'
  || E' Lease. Current Location: {{HORSE.CURRENT_LOCATION}}\n'
)
WHERE template_key = 'HORSE_LEASE';
