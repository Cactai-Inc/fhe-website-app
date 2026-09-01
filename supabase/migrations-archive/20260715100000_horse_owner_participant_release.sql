-- Horse-owner release defaults were backwards. The General Visitor Liability
-- Release is for NON-RIDING visitors only. A horse owner rides (→ Participant
-- Liability Release) and handles their own horse (→ Horse Handling & Routine
-- Care Liability Release). Swap General → Participant and add Horse Care for the
-- 'Horse owner' category's auto-selected onboarding documents.
--
-- Data-only, org-scoped. Idempotent. Applied live 2026-07-15 against
-- org e656f20b-ef43-4725-9029-19e7f0190d9c; written org-agnostic here so it
-- holds for every org that has these three templates registered.

DELETE FROM category_document_requirements cdr
 WHERE cdr.category = 'Horse owner'
   AND cdr.template_key = 'RELEASE_GENERAL';

INSERT INTO category_document_requirements (org_id, category, template_key)
SELECT DISTINCT cdr.org_id, 'Horse owner', v.template_key
  FROM category_document_requirements cdr
  CROSS JOIN (VALUES ('RELEASE_PARTICIPANT'), ('RELEASE_HORSE_CARE')) AS v(template_key)
 WHERE cdr.category = 'Horse owner'
   AND EXISTS (
     SELECT 1 FROM contract_templates t
      WHERE t.template_key = v.template_key
   )
ON CONFLICT (org_id, category, template_key) DO NOTHING;
