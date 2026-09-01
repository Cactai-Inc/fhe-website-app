-- Seed the HORSE_LEASE 'Horse Care' subject as the proven cascading pattern.
-- Everything about a care item lives together: the item (parent), its responsibility
-- (dropdown Owner/Lessee/Care Provider/Shared), a provider contact revealed only when
-- 'Care Provider', and its cost (responsibility). Costs are folded INTO the subject
-- (not a separate Cost Allocation section). Each field carries ⓘ guidance.
--
-- These are template DEFAULTS in contract_field_defs; a contract instance is seeded
-- from them into contract_fields, where the per-document values live.

INSERT INTO contract_field_defs
  (template_key, field_key, parent_field_key, label, section, owner_role, input_kind, value_type, options, conditional_on, guidance, required, is_optional, sort_order)
VALUES
-- ── Medications & Supplements ─────────────────────────────────────────────
('HORSE_LEASE','CARE.MED.NAME', NULL,
  'Medication or supplement', 'Horse Care', 'DEAL', 'text', 'text', NULL, NULL,
  'Name each medication or supplement the Horse receives. Add one per line item. If none, mark N/A.',
  false, true, 100),
('HORSE_LEASE','CARE.MED.RESPONSIBILITY', 'CARE.MED.NAME',
  'Who administers it', 'Horse Care', 'DEAL', 'responsibility', 'text',
  '[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"CARE_PROVIDER","label":"Care Provider"},{"value":"SHARED","label":"Shared"}]'::jsonb,
  NULL,
  'Who is responsible for administering this. Choose Shared to split by day/party; Care Provider to name a facility or professional.',
  false, false, 110),
('HORSE_LEASE','CARE.MED.PROVIDER', 'CARE.MED.RESPONSIBILITY',
  'Care provider details', 'Horse Care', 'DEAL', 'contact', 'longtext', NULL,
  '{"field_key":"CARE.MED.RESPONSIBILITY","equals":["CARE_PROVIDER"]}'::jsonb,
  'Contact name, phone, email, and company for the provider administering this.',
  false, false, 115),
('HORSE_LEASE','CARE.MED.COST', 'CARE.MED.NAME',
  'Who pays for it', 'Horse Care', 'DEAL', 'responsibility', 'text',
  '[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"SHARED","label":"Shared (split %)"}]'::jsonb,
  NULL,
  'Who bears the cost. Shared reveals an Owner/Lessee percentage split that must total 100%.',
  false, false, 120),

-- ── Farrier ───────────────────────────────────────────────────────────────
('HORSE_LEASE','CARE.FARRIER.RESPONSIBILITY', NULL,
  'Farrier care — who arranges it', 'Horse Care', 'DEAL', 'responsibility', 'text',
  '[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"CARE_PROVIDER","label":"Care Provider"},{"value":"SHARED","label":"Shared"}]'::jsonb,
  NULL,
  'Who schedules and arranges farrier visits. The owner''s preferred farrier is used when reasonably possible.',
  false, true, 200),
('HORSE_LEASE','CARE.FARRIER.PROVIDER', 'CARE.FARRIER.RESPONSIBILITY',
  'Preferred farrier', 'Horse Care', 'DEAL', 'contact', 'longtext', NULL,
  '{"field_key":"CARE.FARRIER.RESPONSIBILITY","equals":["CARE_PROVIDER","OWNER","LESSEE","SHARED"]}'::jsonb,
  'Business name, farrier name, phone, and email of the preferred farrier.',
  false, false, 210),
('HORSE_LEASE','CARE.FARRIER.COST', 'CARE.FARRIER.RESPONSIBILITY',
  'Farrier cost — who pays', 'Horse Care', 'DEAL', 'responsibility', 'text',
  '[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"SHARED","label":"Shared (split %)"}]'::jsonb,
  NULL,
  'Who bears farrier costs. Shared reveals an Owner/Lessee percentage split.',
  false, false, 220),

-- ── Routine Veterinary Care ───────────────────────────────────────────────
('HORSE_LEASE','CARE.ROUTINE_VET.RESPONSIBILITY', NULL,
  'Routine vet care — who arranges it', 'Horse Care', 'DEAL', 'responsibility', 'text',
  '[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"CARE_PROVIDER","label":"Care Provider"},{"value":"SHARED","label":"Shared"}]'::jsonb,
  NULL,
  'Vaccinations, de-worming, dental and other regular treatments. The owner''s preferred vet is used when reasonably possible.',
  false, true, 300),
('HORSE_LEASE','CARE.ROUTINE_VET.PROVIDER', 'CARE.ROUTINE_VET.RESPONSIBILITY',
  'Preferred veterinarian', 'Horse Care', 'DEAL', 'contact', 'longtext', NULL,
  '{"field_key":"CARE.ROUTINE_VET.RESPONSIBILITY","equals":["CARE_PROVIDER","OWNER","LESSEE","SHARED"]}'::jsonb,
  'Clinic name, veterinarian name, phone, and email.',
  false, false, 310),
('HORSE_LEASE','CARE.ROUTINE_VET.COST', 'CARE.ROUTINE_VET.RESPONSIBILITY',
  'Routine vet cost — who pays', 'Horse Care', 'DEAL', 'responsibility', 'text',
  '[{"value":"OWNER","label":"Owner"},{"value":"LESSEE","label":"Lessee"},{"value":"SHARED","label":"Shared (split %)"}]'::jsonb,
  NULL,
  'Who bears routine vet costs. Shared reveals an Owner/Lessee percentage split.',
  false, false, 320)
ON CONFLICT (template_key, field_key) DO UPDATE SET
  parent_field_key=excluded.parent_field_key, label=excluded.label, section=excluded.section,
  input_kind=excluded.input_kind, options=excluded.options, conditional_on=excluded.conditional_on,
  guidance=excluded.guidance, is_optional=excluded.is_optional, sort_order=excluded.sort_order;
