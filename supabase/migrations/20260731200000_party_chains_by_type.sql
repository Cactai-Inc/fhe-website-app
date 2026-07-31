-- ─────────────────────────────────────────────────────────────────────────────
-- PARTY DEFINITIONS: THE ENTITY CHAIN NOW REACHES PEOPLE'S HEIRS (2026-07-31)
--
-- THE GAP THE OWNER FOUND, and it is a real drafting defect rather than a
-- wording preference.
--
-- The entity-side definition reached one layer and stopped:
--     "Lessor Parties" means Lessor and … employees, trainers, instructors,
--     agents, contractors … and each of THEIR respective heirs and assigns.
--
-- while the individual-side definition carried a full personal chain:
--     "Lessee Parties" means Lessee and Lessee's heirs, next of kin, estate,
--     executors, administrators, legal representatives, and assigns.
--
-- So a trainer employed by an entity Lessor was released and bound — but their
-- ESTATE was not clearly covered, whereas the identical person signing as an
-- individual Lessee would have brought their estate, executors and next of kin
-- with them. The protection was thinnest exactly where it matters most: a
-- wrongful-death claim is brought by the estate, not the deceased.
--
-- Each named individual in the entity chain now carries their OWN personal
-- chain, so a first-layer person is treated the same as if they had signed
-- personally.
--
-- AND IT IS NOW PER-SIDE. The template only had LESSEE.PARTY_TYPE — it could ask
-- what the Lessee was but never the Lessor, because the drafting assumed the barn
-- was always the Lessor. On this very contract that is inverted: the Lessor is a
-- person and the Lessee is a company. Both sides now have a PARTY_TYPE, both
-- populate automatically from contacts.is_company, and each side gets the
-- entity or individual wording independently.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. LESSOR.PARTY_TYPE, mirroring the Lessee's ────────────────────────────
-- Mirrors LESSEE.PARTY_TYPE exactly: same section, same clause, same shape, so
-- the two sit side by side in Parties rather than one being orphaned elsewhere.
INSERT INTO contract_field_defs
  (template_key, section, clause_key, field_key, label, input_kind, value_type,
   format_type, options, owner_role, sort_order, required, guidance)
SELECT 'HORSE_LEASE_V2', 'PARTIES', 'PARTIES.INTRO', 'LESSOR.PARTY_TYPE', 'Lessor is an',
       'select', 'select', 'select',
       '[{"label":"Individual","value":"INDIVIDUAL"},{"label":"Entity / organization","value":"ENTITY"}]'::jsonb,
       'LESSOR', 4, false,
       'Set from the Lessor''s contact record (company vs person) at creation; override if needed. Chooses which "Lessor Parties" definition applies.'
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_LEASE_V2' AND field_key='LESSOR.PARTY_TYPE');

-- ── 2. Derive it for BOTH roles, not just the Lessee ────────────────────────
DO $do$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='fill_party_fields_from_contacts';
  IF v_def IS NULL THEN RAISE EXCEPTION 'fill_party_fields_from_contacts not found'; END IF;
  IF position('r.party_role IN (''LESSEE'',''LESSOR'')' in v_def) > 0 THEN
    RAISE NOTICE 'party-type fill already covers both roles — skipping';
  ELSE
    EXECUTE replace(v_def,
      'CASE WHEN r.party_role = ''LESSEE''',
      'CASE WHEN r.party_role IN (''LESSEE'',''LESSOR'')');
    RAISE NOTICE 'party-type now derived for LESSOR as well as LESSEE';
  END IF;
END
$do$;

-- ── 3. Four conditional definition clauses, replacing the single fixed one ──
-- The old DEFINITIONS.MAIN carried both definitions in one block, so neither
-- could vary by party type. It is replaced by one clause per side per type.
DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.MAIN';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, body, sort_order, conditional_on)
VALUES
  -- LESSOR, individual: the personal chain.
  ('HORSE_LEASE_V2','DEFINITIONS','DEFINITIONS.LESSOR_IND',
   '"Lessor Parties" means Lessor and Lessor''s heirs, next of kin, estate, executors, administrators, legal representatives, and assigns.',
   10,
   '{"any":[{"field_key":"LESSOR.PARTY_TYPE","equals":["INDIVIDUAL",""]}]}'::jsonb),

  -- LESSOR, entity: the organisation, its people, AND each of those people's own
  -- personal chain — the layer that was missing.
  ('HORSE_LEASE_V2','DEFINITIONS','DEFINITIONS.LESSOR_ENT',
   '"Lessor Parties" means Lessor and, as applicable, Lessor''s owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers, together with the family members of any of the foregoing, and — as to each individual named above — that individual''s heirs, next of kin, estate, executors, administrators, legal representatives, and assigns, so that each such individual is protected and bound to the same extent as if they had entered into this Agreement personally.',
   11,
   '{"any":[{"field_key":"LESSOR.PARTY_TYPE","equals":["ENTITY"]}]}'::jsonb),

  -- LESSEE, individual.
  ('HORSE_LEASE_V2','DEFINITIONS','DEFINITIONS.LESSEE_IND',
   '"Lessee Parties" means Lessee and Lessee''s heirs, next of kin, estate, executors, administrators, legal representatives, and assigns.',
   12,
   '{"any":[{"field_key":"LESSEE.PARTY_TYPE","equals":["INDIVIDUAL",""]}]}'::jsonb),

  -- LESSEE, entity: same full chain as the entity Lessor.
  ('HORSE_LEASE_V2','DEFINITIONS','DEFINITIONS.LESSEE_ENT',
   '"Lessee Parties" means Lessee and, as applicable, Lessee''s owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers, together with the family members of any of the foregoing, and — as to each individual named above — that individual''s heirs, next of kin, estate, executors, administrators, legal representatives, and assigns, so that each such individual is protected and bound to the same extent as if they had entered into this Agreement personally.',
   13,
   '{"any":[{"field_key":"LESSEE.PARTY_TYPE","equals":["ENTITY"]}]}'::jsonb),

  -- The two statements that apply however the parties are constituted.
  ('HORSE_LEASE_V2','DEFINITIONS','DEFINITIONS.BINDING',
   'Each party enters into this Agreement on behalf of itself and all of its respective Lessor Parties or Lessee Parties, as applicable, and all releases, waivers, assumptions of risk, and covenants made by a party under this Agreement are made on behalf of all of that party''s Parties and bind each of them to the same extent as the party itself.',
   14, NULL),

  ('HORSE_LEASE_V2','DEFINITIONS','DEFINITIONS.BENEFICIARIES',
   'Each Lessor Party and each Lessee Party is an intended third-party beneficiary of the releases, waivers, assumptions of risk, and limitations of liability in this Agreement and may enforce them directly.',
   15, NULL);

-- ── 4. Backfill LESSOR.PARTY_TYPE onto contracts that already exist ─────────
-- The field definition is new, so live documents have no row for it. Without
-- this they would fall to the INDIVIDUAL branch by default — right for this
-- contract by luck, wrong for any entity Lessor. Derived from the same source
-- the fill function uses, so it cannot disagree with it.
INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value)
SELECT d.org_id, d.id, 'LESSOR.PARTY_TYPE', 'LESSOR',
       CASE WHEN coalesce(c.is_company, false) THEN 'ENTITY' ELSE 'INDIVIDUAL' END
  FROM documents d
  JOIN contract_parties cp ON cp.contract_id = d.contract_id AND cp.party_role = 'LESSOR'
  JOIN contacts c ON c.id = cp.contact_id
 WHERE d.deleted_at IS NULL
   AND d.contract_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM contract_fields x
                    WHERE x.document_id = d.id AND x.field_key = 'LESSOR.PARTY_TYPE');
