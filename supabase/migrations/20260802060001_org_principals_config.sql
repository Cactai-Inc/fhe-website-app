-- ORG.PRINCIPALS — the named principals in the Released Parties definitions
-- of the 2026-08-02 onboarding document bodies ("including without limitation
-- {{ORG.PRINCIPALS}}"). Resolved by generate_document's generic ORG EAV
-- fallback (config_values ns ORG). Required: a missing value renders as an
-- empty string inside executed legal text. Owner ruling 2026-08-02: both
-- principals, Charles Zigmund and Claire Bourdon.

INSERT INTO config_keys (namespace, key, expected_type, required, description)
SELECT 'ORG', 'PRINCIPALS', 'text', true,
       'Named principals for Released Parties clauses (EAV: config_values ns ORG)'
 WHERE NOT EXISTS (
   SELECT 1 FROM config_keys WHERE namespace = 'ORG' AND key = 'PRINCIPALS');

INSERT INTO config_values (org_id, namespace, key, value_text, category)
SELECT o.id, 'ORG', 'PRINCIPALS', 'Charles Zigmund and Claire Bourdon', 'legal'
  FROM organizations o
 WHERE NOT EXISTS (
   SELECT 1 FROM config_values c
    WHERE c.org_id = o.id AND c.namespace = 'ORG' AND c.key = 'PRINCIPALS');
