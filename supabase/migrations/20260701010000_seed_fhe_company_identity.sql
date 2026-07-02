/*
  # FHE Suite — Seed COMPANY identity for tenant #1 (Contracts Legal Pass, migration 43)

  OWNER FACTS: the business is a SOLE PROPRIETORSHIP doing business as "French
  Heritage Equestrian"; the signor is Charles Zigmund. Exact attorney wording is
  PENDING, so every identity value below is a best-known placeholder routed through
  config (see ATTORNEY_FILLIN_CHECKLIST.md at the repo root).

  Idempotent, ONLY-FILL-OR-FIX semantics:
    - contacts: find-or-create the Charles Zigmund signatory contact for tenant #1
      (tagged 'signatory'); business_config.signatory_contact_id points at it (only
      when currently NULL).
    - business_config.signatory_name: 'Charles Zigmund' — this EXPLICITLY overwrites
      the known-bad migration-20 value 'French Heritage Equestrian' (a business name
      is not a person and cannot sign); any other owner-set value is preserved.
    - business_config.signatory_title: 'Owner, Sole Proprietor' (placeholder pending
      attorney), fill-only.
    - business_config.entity_formation: 'Sole proprietorship (California)'
      (placeholder pending attorney), fill-only.
    - config_values ORG.LEGAL_IDENTITY: the party-block identity clause (placeholder
      pending attorney), fill-only (ON CONFLICT DO NOTHING).
    - contract_templates.party_namespaces: 'FHE' -> 'COMPANY' everywhere (the defined
      term for the business side is now COMPANY); the six templates gaining
      {{EMERGENCY_CONTACT.*}} tokens also gain the EMERGENCY_CONTACT namespace.

  DELIBERATELY OUT OF SCOPE (checklist): provision_tenant does NOT yet populate
  signatory_contact_id or ORG.LEGAL_IDENTITY for future tenants — until it does, a
  new tenant's documents omit the COMPANY signing party and render a blank identity
  clause. ORG.INVOICE_DUE_DAYS / CANCELLATION_NOTICE_HOURS / TERMINATION_NOTICE_DAYS
  stay UNSEEDED (owner fills; go-live visibility via config_keys).
*/

-- ============================================================
-- Tenant #1 identity seed. Runs as superuser (auth.uid() IS NULL), so org_id is set
-- explicitly from the first org rather than via current_org() (same posture as the
-- migration-29 BRAND/CONTACT seed).
-- ============================================================
DO $$
DECLARE
  v_org     uuid;
  v_contact uuid;
BEGIN
  SELECT id INTO v_org FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RETURN;  -- no tenant seeded yet (shouldn't happen; migration 24 seeds one)
  END IF;

  -- Charles Zigmund — the company signatory contact, org-scoped, tagged 'signatory'.
  SELECT id INTO v_contact FROM contacts
    WHERE org_id = v_org AND full_name = 'Charles Zigmund' AND deleted_at IS NULL
    ORDER BY created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, full_name, first_name, last_name, tags, notes)
      VALUES (v_org, 'Charles Zigmund', 'Charles', 'Zigmund', ARRAY['signatory'],
              'Company signatory (sole proprietor) — seeded by the Contracts Legal Pass.')
      RETURNING id INTO v_contact;
  ELSE
    -- fix-only: ensure the existing contact carries the signatory tag
    UPDATE contacts SET tags = array_append(tags, 'signatory')
      WHERE id = v_contact AND NOT ('signatory' = ANY(tags));
  END IF;

  UPDATE business_config SET
    signatory_contact_id = COALESCE(signatory_contact_id, v_contact),
    -- explicit overwrite of the known-bad migration-20 value; owner edits preserved
    signatory_name = CASE
      WHEN signatory_name IS NULL OR signatory_name = 'French Heritage Equestrian'
        THEN 'Charles Zigmund'
      ELSE signatory_name END,
    signatory_title  = COALESCE(signatory_title,  'Owner, Sole Proprietor'),
    entity_formation = COALESCE(entity_formation, 'Sole proprietorship (California)')
  WHERE org_id = v_org;

  -- The party-block identity clause ({{ORG.LEGAL_IDENTITY}}); resolves through the
  -- v5 generic ORG EAV fallback. Placeholder pending attorney wording.
  INSERT INTO config_values (org_id, namespace, key, value_text, category)
    VALUES (v_org, 'ORG', 'LEGAL_IDENTITY',
      'Charles Zigmund, an individual doing business as French Heritage Equestrian, a sole proprietorship',
      'legal')
  ON CONFLICT (org_id, namespace, key) DO NOTHING;
END $$;

-- ============================================================
-- contract_templates.party_namespaces — the business side's defined term is COMPANY.
-- (Global metadata table; the Assemble stage regenerates per-template token rows.)
-- ============================================================
UPDATE contract_templates
  SET party_namespaces = array_replace(party_namespaces, 'FHE', 'COMPANY')
  WHERE 'FHE' = ANY(party_namespaces);

-- The six templates whose emergency-contact blanks become {{EMERGENCY_CONTACT.*}}
-- party tokens (resolved via the engagement party role EMERGENCY_CONTACT).
UPDATE contract_templates
  SET party_namespaces = array_append(party_namespaces, 'EMERGENCY_CONTACT')
  WHERE template_key IN (
    'HORSE_EMERGENCY_VET','HORSE_EXERCISE','HORSE_TRAINING',
    'HUMAN_EMERGENCY_MEDICAL','MINOR_RIDER','RIDER_LESSON_JUMPER')
    AND NOT ('EMERGENCY_CONTACT' = ANY(party_namespaces));
