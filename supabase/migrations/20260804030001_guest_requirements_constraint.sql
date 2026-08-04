-- K1b follow-up: category_document_requirements carried its OWN CHECK limiting
-- categories to Rider / Horse owner, so the GUEST rows were rejected. Widening
-- it is the same owner-authorized exception as the groups constraint. (The
-- earlier migration's INSERT ... WHERE NOT EXISTS silently produced zero rows
-- rather than erroring, which is why this needed a verification pass to catch.)
ALTER TABLE category_document_requirements
  DROP CONSTRAINT IF EXISTS category_document_requirements_onboarding_check;
ALTER TABLE category_document_requirements
  ADD CONSTRAINT category_document_requirements_onboarding_check
  CHECK (category = ANY (ARRAY['Guest','Rider','Horse owner']));

INSERT INTO category_document_requirements (org_id, category, template_key)
SELECT o.id, 'Guest', k
  FROM organizations o
  CROSS JOIN unnest(ARRAY['RELEASE_GENERAL','COMPANY_POLICIES','FACILITY_RULES']) k
ON CONFLICT (org_id, category, template_key) DO NOTHING;
