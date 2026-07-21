-- Addendum: the party contact details and the horse record are captured by the
-- system and appended to the contract as an addendum. Rather than thread extra
-- data into both PDF renderers, the addendum is composed into merged_body as a
-- final section, so it appears identically on screen and in the PDF/email copy.
-- Party name/address/phone/email import from the contacts (via
-- fill_party_fields_from_contacts); horse fields import from the horse record.

INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order, is_optional, guidance)
VALUES ('HORSE_LEASE_V2', 'ADDENDUM', 'Addendum — Party & Horse Details', 250, false,
        'Contact details for each party and the full horse record, captured by the system.');

-- party field tokens the addendum needs (materialized read-only by
-- fill_party_fields_from_contacts when the contact carries the value).
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'ADDENDUM', 'ADDENDUM.LESSOR', 'Lessor',
   'Name: {{LESSOR.FULL_NAME}}
Address: {{LESSOR.ADDRESS}}
Phone: {{LESSOR.PHONE}}
Email: {{LESSOR.EMAIL}}',
   'input', 10, false, NULL),
  ('HORSE_LEASE_V2', 'ADDENDUM', 'ADDENDUM.LESSEE', 'Lessee',
   'Name: {{LESSEE.FULL_NAME}}
Address: {{LESSEE.ADDRESS}}
Phone: {{LESSEE.PHONE}}
Email: {{LESSEE.EMAIL}}',
   'input', 20, false, NULL),
  ('HORSE_LEASE_V2', 'ADDENDUM', 'ADDENDUM.HORSE', 'Horse Record',
   'Registered name: {{HORSE.REGISTERED_NAME}}
Color: {{HORSE.COLOR}}
Markings: {{HORSE.MARKINGS}}
Breed: {{HORSE.BREED}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Sex: {{HORSE.SEX}}
Year foaled: {{HORSE.AGE_DOB}}
Current fair market value: {{HORSE.FAIR_MARKET_VALUE}}
Microchip: {{HORSE.MICROCHIP}}
Passport: {{HORSE.PASSPORT_NUMBER}}
Current location: {{HORSE.CURRENT_LOCATION}}',
   'input', 30, false, NULL);

-- the addendum needs LESSOR/LESSEE ADDRESS & PHONE & EMAIL field rows to exist so
-- fill_party_fields_from_contacts can populate them (it upserts, but only tokens
-- that appear somewhere). The party tokens are auto-fill (no field_def needed) —
-- fill_party_fields_from_contacts inserts them as SYSTEM rows on demand.
