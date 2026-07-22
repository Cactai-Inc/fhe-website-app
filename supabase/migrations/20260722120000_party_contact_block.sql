-- CONTACT INFORMATION in the Notice section.
--
-- The lease previously said only "Notice to Lessee/Lessor shall be sent to
-- {ADDRESS}." The parties asked for a full contact block — name, address, phone,
-- email — for each party. The Notice section is the correct legal home for this
-- (it is what "notice … to the address on file" refers to), so we replace the two
-- bare address lines with a labeled contact block per party.
--
-- Composer behavior we rely on (remerge_contract_from_clauses): a line whose only
-- token is empty is stripped, so a party with no phone/email on file simply drops
-- that line rather than printing "Phone: ". The name line always renders (party
-- name is materialized from the contact record), so the clause never vanishes.

-- Lessee contact block (replaces NOTICE.LESSEE_ADDRESS, keeps its sort_order)
UPDATE contract_clause_defs SET
  heading = 'Lessee',
  body = 'Name: {{LESSEE.FULL_NAME}}' || E'\n'
      || 'Address: {{LESSEE.ADDRESS}}' || E'\n'
      || 'Phone: {{LESSEE.PHONE}}' || E'\n'
      || 'Email: {{LESSEE.EMAIL}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.LESSEE_ADDRESS';

-- Lessor contact block (replaces NOTICE.LESSOR_ADDRESS, keeps its sort_order)
UPDATE contract_clause_defs SET
  heading = 'Lessor',
  body = 'Name: {{LESSOR.FULL_NAME}}' || E'\n'
      || 'Address: {{LESSOR.ADDRESS}}' || E'\n'
      || 'Phone: {{LESSOR.PHONE}}' || E'\n'
      || 'Email: {{LESSOR.EMAIL}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.LESSOR_ADDRESS';

-- Lead-in clause so the block reads as a contact directory, not loose lines.
UPDATE contract_clause_defs
   SET body = 'Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt to the party at the contact information below. Notice by email is not effective unless the receiving party acknowledges receipt.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='NOTICE.FORM';

-- Retitle the section so it reads as the contact directory it now is.
UPDATE contract_section_defs
   SET heading = 'Notice and Contact Information'
 WHERE template_key='HORSE_LEASE_V2' AND section_key='NOTICE';
