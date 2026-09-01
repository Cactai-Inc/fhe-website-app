/*
  # Lease body — print the 10 captured-but-unprinted terms

  These fields were seeded (staff fill them) but had no token in the body, so the
  signed contract was silent on them. Weave each into its natural clause. The
  remerge strip-unfilled logic drops any line left blank, so partial/optional
  terms don't clutter a lease that doesn't use them.

    §5  Permitted Use      → EXCLUSIVITY_RULES
    §6  Partial Lease      → DAYS_USED, DAYS_UNAVAILABLE  (partial-only clause)
    §7  Payment            → PAYMENT_OPTIONS
    §11 Training & Lessons → LESSONS_BEGINNER/INTERMEDIATE/ADVANCED
    §15 Competition        → EVENTS_AUTHORIZED
    §22 Assignment         → SUBLEASE_ALLOWED, SHARED_LEASE_ALLOWED
*/

-- §5 Permitted Use
UPDATE contract_templates SET body = replace(body,
  E'Horse may be used by: {{TXN.AUTHORIZED_USERS}}',
  E'Horse may be used by: {{TXN.AUTHORIZED_USERS}}\nExclusivity and priority of Lessee''s use: {{TXN.EXCLUSIVITY_RULES}}')
 WHERE template_key='HORSE_LEASE' AND body NOT LIKE '%{{TXN.EXCLUSIVITY_RULES}}%';

-- §6 Partial Lease (inside the PARTIAL_LEASE cut → prints only for partial leases)
UPDATE contract_templates SET body = replace(body,
  E'Shared with: {{TXN.SHARED_WITH}}',
  E'Shared with: {{TXN.SHARED_WITH}}\nDays used by Lessee: {{TXN.DAYS_USED}}\nDays the Horse is unavailable to Lessee: {{TXN.DAYS_UNAVAILABLE}}')
 WHERE template_key='HORSE_LEASE' AND body NOT LIKE '%{{TXN.DAYS_USED}}%';

-- §7 Payment
UPDATE contract_templates SET body = replace(body,
  E'Late Payment Terms: {{TXN.LATE_PAYMENT_TERMS}}',
  E'Late Payment Terms: {{TXN.LATE_PAYMENT_TERMS}}\nAvailable payment options: {{TXN.PAYMENT_OPTIONS}}')
 WHERE template_key='HORSE_LEASE' AND body NOT LIKE '%{{TXN.PAYMENT_OPTIONS}}%';

-- §11 Training and Lessons
UPDATE contract_templates SET body = replace(body,
  E'Lesson or instruction requirements: {{TXN.LESSON_TERMS}}',
  E'Lesson or instruction requirements: {{TXN.LESSON_TERMS}}\nLessons permitted per day — Beginner: {{TXN.LESSONS_BEGINNER}}; Intermediate: {{TXN.LESSONS_INTERMEDIATE}}; Advanced: {{TXN.LESSONS_ADVANCED}}')
 WHERE template_key='HORSE_LEASE' AND body NOT LIKE '%{{TXN.LESSONS_BEGINNER}}%';

-- §15 Competition
UPDATE contract_templates SET body = replace(body,
  E'Prize money and winnings earned during the Lease Term belong to: {{TXN.COMPETITION_WINNINGS}}',
  E'Prize money and winnings earned during the Lease Term belong to: {{TXN.COMPETITION_WINNINGS}}\nSpecific events and competitions authorized: {{TXN.EVENTS_AUTHORIZED}}')
 WHERE template_key='HORSE_LEASE' AND body NOT LIKE '%{{TXN.EVENTS_AUTHORIZED}}%';

-- §22 Assignment (owner-discretion permissions)
UPDATE contract_templates SET body = replace(body,
  E'Neither party may assign or transfer this Agreement without the prior written consent of the other party.',
  E'Neither party may assign or transfer this Agreement without the prior written consent of the other party.\n\nSubleasing of the Horse by Lessee is permitted only as authorized here by Lessor: {{TXN.SUBLEASE_ALLOWED}}\nSharing of this lease with additional participants is permitted only as authorized here by Lessor: {{TXN.SHARED_LEASE_ALLOWED}}')
 WHERE template_key='HORSE_LEASE' AND body NOT LIKE '%{{TXN.SUBLEASE_ALLOWED}}%';

-- re-derive template_tokens for HORSE_LEASE
DELETE FROM template_tokens WHERE template_id = (SELECT id FROM contract_templates WHERE template_key='HORSE_LEASE');
INSERT INTO template_tokens (template_id, namespace, field, token, kind, required, party_scoped)
  SELECT (SELECT id FROM contract_templates WHERE template_key='HORSE_LEASE'),
         split_part(trim(both '{}' from tok), '.', 1),
         substr(trim(both '{}' from tok), position('.' in trim(both '{}' from tok)) + 1),
         tok,
         CASE split_part(trim(both '{}' from tok), '.', 1)
           WHEN 'SIG' THEN 'signature' WHEN 'DOC' THEN 'system' ELSE 'field' END,
         false,
         split_part(trim(both '{}' from tok), '.', 1) IN ('CLIENT','LESSEE','LESSOR','PARTICIPANT','SIG')
    FROM (SELECT DISTINCT unnest(regexp_matches(
            (SELECT body FROM contract_templates WHERE template_key='HORSE_LEASE'),
            '\{\{[A-Z0-9_.]+\}\}', 'g')) AS tok) t;
