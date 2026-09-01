/*
  # Horse documents — add Height + Fair Market Value everywhere (owner decision)

  The core horse identity should be consistent across all horse documents.
    - Vet Authorization gains Height + Fair Market Value (had neither).
    - Horse-Care Release gains Fair Market Value (already had Height).
    - Lease gains Height (already had FMV).
  Both tokens are already mapped in generate_document; this only weaves them into
  the bodies and re-registers template_tokens so they render.
*/

-- ── Vet Authorization: + Height (after Age), + FMV (after Registration) ──
UPDATE contract_templates SET body = replace(
    body,
    E'Age: {{HORSE.AGE_DOB}}',
    E'Age: {{HORSE.AGE_DOB}}\nHeight: {{HORSE.HEIGHT}}')
 WHERE template_key = 'HORSE_EMERGENCY_VET'
   AND body LIKE '%Age: {{HORSE.AGE_DOB}}%' AND body NOT LIKE '%Height: {{HORSE.HEIGHT}}%';

UPDATE contract_templates SET body = replace(
    body,
    E'Registration / Identification Number: {{HORSE.REGISTRATION_NUMBER}}',
    E'Registration / Identification Number: {{HORSE.REGISTRATION_NUMBER}}\nCurrent Fair Market Value: {{HORSE.FAIR_MARKET_VALUE}}')
 WHERE template_key = 'HORSE_EMERGENCY_VET'
   AND body NOT LIKE '%{{HORSE.FAIR_MARKET_VALUE}}%';

-- ── Horse-Care Release: + FMV (after Registration Number) ──
UPDATE contract_templates SET body = replace(
    body,
    E'Registration Number: {{HORSE.REGISTRATION_NUMBER}}',
    E'Registration Number: {{HORSE.REGISTRATION_NUMBER}}\nCurrent Fair Market Value: {{HORSE.FAIR_MARKET_VALUE}}')
 WHERE template_key = 'RELEASE_HORSE_CARE'
   AND body NOT LIKE '%{{HORSE.FAIR_MARKET_VALUE}}%';

-- ── Lease: + Height (after Age / Date of Birth) ──
UPDATE contract_templates SET body = replace(
    body,
    E'Age / Date of Birth: {{HORSE.AGE_DOB}}',
    E'Age / Date of Birth: {{HORSE.AGE_DOB}}\nHeight: {{HORSE.HEIGHT}}')
 WHERE template_key = 'HORSE_LEASE'
   AND body NOT LIKE '%Height: {{HORSE.HEIGHT}}%';

-- ── Re-register template_tokens for all three (so the new tokens render) ──
DO $tok$
DECLARE k text;
BEGIN
  FOREACH k IN ARRAY ARRAY['HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE','HORSE_LEASE'] LOOP
    DELETE FROM template_tokens
     WHERE template_id = (SELECT id FROM contract_templates WHERE template_key = k);
    INSERT INTO template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
      SELECT (SELECT id FROM contract_templates WHERE template_key = k),
             split_part(trim(both '{}' from tok), '.', 1),
             substr(trim(both '{}' from tok), position('.' in trim(both '{}' from tok)) + 1),
             tok,
             CASE split_part(trim(both '{}' from tok), '.', 1)
               WHEN 'SIG' THEN 'signature' WHEN 'DOC' THEN 'system' ELSE 'field' END,
             false,
             split_part(trim(both '{}' from tok), '.', 1) IN ('CLIENT','LESSEE','LESSOR','PARTICIPANT','SIG')
        FROM (SELECT DISTINCT unnest(regexp_matches(
                (SELECT body FROM contract_templates WHERE template_key = k),
                '\{\{[A-Z0-9_.]+\}\}', 'g')) AS tok) t;
  END LOOP;
END;
$tok$;
