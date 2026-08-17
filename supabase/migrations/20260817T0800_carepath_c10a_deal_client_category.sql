-- CAREPATH §C10a — THE DEAL CLIENT. Their onboarding is ONE document.
--
-- Owner, 2026-08-16: "a person coming to us for help finding a horse is a client
-- but they are not a horse owner if their horse isnt in our system during
-- onboarding… for them there is only a general liability waiver to complete and
-- then we go do the evaluation or help with the contract or whatever they are
-- seeking our services for."
--
-- Owner, 2026-08-17 (the correction): "we grant horse owner to someone without a
-- horse so it triggers the intake form and auth/liability docs related to horses
-- when they onboard if there are purchases related to the horse or lessons with
-- their horse in the initial order. if not they should be skipping the docs
-- related to horse ownership."
--
-- ⚠️ DOCUMENTS FOLLOW THE ORDER, NOT A HORSE RECORD. The HORSE_OWNER grant is a
-- DOCUMENT TRIGGER, and granting it to someone with no horse yet is correct and
-- deliberate. What §C10a needs is the OTHER half: a category for the client
-- whose order carries no horse-related purchase, which must summon NEITHER the
-- horse intake NOR any horse document.
--
-- ⚠️ THE WAIVER IS `RELEASE_GENERAL` — "General Visitor Liability Release",
-- active, wall-gating. It is the existing general liability waiver and no new
-- document is authored here. It is NOT `EVALUATION_LIABILITY_WAIVER`, which is
-- the per-evaluation waiver the acquisition lane attaches to an actual
-- evaluation — a different document for a different moment, and that lane is a
-- later task.
--
-- ⚠️ THE RULE THAT CHANGES IS DATA, NOT CODE (D13). Document assignment runs
-- through `apply_category_documents`, which reads
-- `category_document_requirements`. Adding the category there is all that is
-- required, and the barn can change what a deal client signs without a
-- developer — which is the whole point of that table existing.
--
-- ⚠️ EXACTLY ONE DOCUMENT, deliberately. The `Guest` category carries three
-- (COMPANY_POLICIES, FACILITY_RULES, RELEASE_GENERAL). The owner said "only a
-- general liability waiver", so `Deal client` is not a copy of Guest. If the
-- barn wants the policies back, that is one row in this table.

-- The category vocabulary is a CHECK constraint, so the new value is admitted
-- there first. Widened, never rewritten: Guest / Rider / Horse owner are
-- untouched and every existing row still validates.
ALTER TABLE category_document_requirements
  DROP CONSTRAINT IF EXISTS category_document_requirements_onboarding_check;
ALTER TABLE category_document_requirements
  ADD CONSTRAINT category_document_requirements_onboarding_check
  CHECK (category = ANY (ARRAY['Guest', 'Rider', 'Horse owner', 'Deal client']));

INSERT INTO category_document_requirements (org_id, category, template_key)
SELECT o.id, 'Deal client', 'RELEASE_GENERAL'
  FROM organizations o
 WHERE EXISTS (SELECT 1 FROM category_document_requirements c WHERE c.org_id = o.id)
ON CONFLICT DO NOTHING;
