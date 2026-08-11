/*
  # LEASEFIX 2o — 13.2 / 13.3 rebuilt: both parties declare, CCC is a rider on GL

  Built to docs/tasks/TASK-LEASEFIX-insurance-rulings-2026-08-10.md, whose later
  sections supersede its earlier ones. Supersedes the thread's own candidate list
  and TASK-LEASEFIX-13.2-lessee-decline-option.md, both closed out.

  ── THE MODEL ───────────────────────────────────────────────────────────────

    13.2  GENERAL LIABILITY                                    every lease
          Lessor declares own GL   has / will obtain / does not carry   ALWAYS
          Lessor requires GL       require / do not require             ALWAYS
          Lessee declares own GL   has / will obtain / does not carry   ALWAYS
                                   └─ "does not carry" REMOVED when required

    13.3  CARE, CUSTODY AND CONTROL — a RIDER on the Lessee's GL
          individual Lessee              -> section ABSENT
          entity, Lessee carries no GL   -> heading + N/A line, nothing else
          entity, Lessee has/will obtain -> Lessor requires CCC  require / not
                                            Lessee declares CCC  has / will obtain
                                                                 / does not carry
                                            └─ "does not carry" REMOVED when required

  The requirement is a CONSTRAINT ON THE OPTION SET, not a question the other
  party answers. Both parties always declare their own position; requiring simply
  removes one choice from the other's menu. This is what kills the contradiction
  structurally: "does not carry" is ABSENT whenever a requirement is live, so the
  document can never assert a requirement and its non-fulfilment together, and
  GL_REQUIRED's material-breach language can never collide with the decline clause.

  CCC hangs off the LESSEE'S OWN GL DECLARATION, not off the Lessor's requirement.
  A rider needs a parent policy, and it is the Lessee who would hold it. An entity
  with no GL still gets the section and an N/A line naming the dependency — the
  MED_NA paradigm — because for an entity CCC is applicable in principle. An
  individual never sees it, because for them it could never apply.

  GL_AND_CCC is removed as a value: it made CCC impossible to require without also
  requiring GL, and bundled a question askable only of entities into an option that
  also served individuals.

  ── RULING 2: the acceptance checkboxes go, WITH their blocker ──────────────

  All four LESSEE certify fields are deleted, and contract_lock_blockers' D3
  (`insurance_acceptance_unchecked`) is deleted in the same statement — a blocker
  keyed on fields that no longer exist would reference nothing and could never be
  satisfied. The Lessee signs the contract; a separate acknowledgment of an
  allocated cost adds a control without adding consent. The generic required-fields
  rule is untouched and still blocks a blank declaration, gate-aware.

  This also dissolves the muted-preview render bug without touching ClauseDocument:
  no field, no caption with nothing under it.

  ── NOT IN THIS MIGRATION ───────────────────────────────────────────────────
    • the mortality/medical collapse (ruling 3) — same parent/rider machinery,
      next pass, so the pattern proven here is reused rather than reinvented
    • the $ or % control rebuild — ContractCascade work, and a rebuild of the
      existing currency/percent kinds rather than a new control

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ═══ ruling 2 — the acceptance checkboxes and their blocker ══════════════════
DELETE FROM contract_field_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND field_key IN ('TXN.GL_DED_LESSEE_ACCEPT', 'TXN.CCC_LESSEE_ACCEPT',
                     'TXN.MORT_LESSEE_ACCEPT',   'TXN.MED_LESSEE_ACCEPT');
DELETE FROM contract_clause_defs
 WHERE template_key IN (SELECT k FROM _lf)
   AND clause_key IN ('INSURANCE_RISK.GL_DED_ACCEPT', 'INSURANCE_RISK.CCC_ACCEPT',
                      'INSURANCE_RISK.MORT_ACCEPT',   'INSURANCE_RISK.MED_ACCEPT');


-- ═══ 13.2 — three declarations, always asked ═════════════════════════════════
UPDATE contract_field_defs
   SET label = 'Lessor requires of Lessee',
       options = '[{"label": "Requires Lessee to have or obtain general liability insurance", "value": "GL_ONLY"},
                   {"label": "Does not require general liability insurance of Lessee", "value": "NEITHER"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.GL_LESSOR_REQUIRES';

-- GL_AND_CCC disappears as a value; every gate that named it now names GL_ONLY
UPDATE contract_clause_defs
   SET conditional_on = replace(conditional_on::text, '"GL_ONLY", "GL_AND_CCC"', '"GL_ONLY"')::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND conditional_on::text LIKE '%GL_AND_CCC%';
UPDATE contract_field_defs
   SET conditional_on = replace(conditional_on::text, '"GL_ONLY", "GL_AND_CCC"', '"GL_ONLY"')::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND conditional_on::text LIKE '%GL_AND_CCC%';

-- The Lessee declares in EVERY lease. Not required is not the same as not having,
-- and which it is changes who bears an at-fault cost. "Does not carry" is present
-- only while no requirement is live.
UPDATE contract_field_defs
   SET conditional_on = NULL,
       options = '[{"label": "Has and will maintain general liability insurance", "value": "HAS"},
                   {"label": "Will obtain and will maintain general liability insurance", "value": "WILL_OBTAIN"},
                   {"label": "Does not carry general liability insurance", "value": "ACCEPTS_PERSONALLY",
                    "when": {"equals": ["NEITHER"], "field_key": "TXN.GL_LESSOR_REQUIRES"}}]'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.GL_LESSEE_STATUS';

UPDATE contract_clause_defs SET conditional_on = NULL
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.GL_LESSEE_PICK';


-- ═══ 13.3 — the rider ════════════════════════════════════════════════════════
-- The heading clause exists for EVERY entity Lessee, so the section holds its
-- position and 13.4/13.5 stop renumbering under the owner between documents.
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'INSURANCE_RISK', v.ck, v.heading, v.body, v.ctype, v.so, false, v.cond::jsonb, false
  FROM _lf CROSS JOIN (VALUES

  ('INSURANCE_RISK.CCC_PICK', 'Care, Custody and Control Insurance', 'input', 170, '',
   '{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}'),

  -- parent not in force: the MED_NA paradigm — say WHY it cannot be taken
  ('INSURANCE_RISK.CCC_NA', NULL, 'prose', 171,
   -- "component", never "rider" (owner, 2026-08-10): in a horse lease "rider" already
   -- means the person on the horse. MED_NA established "a component of a mortality
   -- policy on the Horse", so this matches vocabulary the document already uses.
   -- parent/rider stays in the docs and in these comments — only contract text is banned.
   'Not applicable. Care, custody and control coverage is available only as a component of a general liability policy carried by Lessee. Because Lessee does not carry general liability insurance under this Agreement, no care, custody and control coverage is available.',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["", "ACCEPTS_PERSONALLY"], "field_key": "TXN.GL_LESSEE_STATUS"}]}'),

  ('INSURANCE_RISK.CCC_NOT_REQUIRED', NULL, 'prose', 172,
   'Lessor does not require Lessee to carry care, custody and control coverage under this Agreement.',
   '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
             {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"},
             {"equals": ["NO"], "field_key": "TXN.CCC_REQUIRED"}]}')

  ) AS v(ck, heading, ctype, so, body, cond)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, options, conditional_on)
SELECT k, 'TXN.CCC_REQUIRED', 'Lessor requires of Lessee', 'INSURANCE_RISK',
       'INSURANCE_RISK.CCC_PICK', 'LESSOR', 'select', 'select', 'select', true, false, 170,
       '[{"label": "Requires Lessee to have or obtain care, custody and control coverage", "value": "YES"},
         {"label": "Does not require care, custody and control coverage of Lessee", "value": "NO"}]'::jsonb,
       '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                 {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}]}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

-- the negligence paragraph keeps its wording; only its gate moves
UPDATE contract_clause_defs
   SET heading = NULL, sort_order = 173,
       conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"},
                                  {"equals": ["YES"], "field_key": "TXN.CCC_REQUIRED"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_REQ';

UPDATE contract_clause_defs
   SET sort_order = 174,
       conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.CCC_STATUS';

-- the Lessee declares its CCC position whenever it could hold one, narrowed the
-- same way GL is: the decline option is absent while a requirement is live
UPDATE contract_field_defs
   SET label = 'Lessee', sort_order = 174,
       options = '[{"label": "has and will maintain", "value": "HAS"},
                   {"label": "will obtain and will maintain", "value": "WILL_OBTAIN"},
                   {"label": "does not carry", "value": "NONE",
                    "when": {"equals": ["NO"], "field_key": "TXN.CCC_REQUIRED"}}]'::jsonb,
       conditional_on = '{"all": [{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"},
                                  {"equals": ["HAS", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.CCC_LESSEE_STATUS';
CREATE OR REPLACE FUNCTION public.contract_lock_blockers(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  v_open int;
  v_vals jsonb := '{}'::jsonb;
  r record;
  v_missing text[];
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_is_onboarding boolean;
  v_unready text[];
  v_sec text;
  v_label text;
BEGIN
  SELECT horse_section_confirmed_at INTO v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  SELECT count(*) INTO v_open FROM contract_change_requests
   WHERE document_id = p_document_id
     AND parent_request_id IS NULL AND submitted_at IS NOT NULL AND resolved_at IS NULL;
  IF v_open > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_change_requests',
      'message', v_open || ' open change request(s) must be resolved'));
  END IF;

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_vals := v_vals || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT array_agg(coalesce(cf.label, cf.field_key) ORDER BY cf.sort_order, cf.field_key)
    INTO v_missing
    FROM contract_fields cf
    LEFT JOIN contract_clause_defs cd
      ON cd.template_key = (SELECT ct.template_key FROM documents d
                             JOIN contract_templates ct ON ct.id = d.template_id
                            WHERE d.id = p_document_id)
     AND cd.clause_key = cf.clause_key
   WHERE cf.document_id = p_document_id AND cf.required
     AND coalesce(cf.included, true) AND NOT coalesce(cf.is_na, false)
     AND nullif(trim(coalesce(cf.value, '')), '') IS NULL
     -- a clause gated on THIS field (a self-gating driver) counts as visible
     -- for the required check — an unanswered gate must block, never hide
     AND (clause_condition_met(cd.conditional_on, v_vals)
          OR (cd.conditional_on IS NOT NULL
              AND cd.conditional_on::text LIKE '%"' || cf.field_key || '"%'))
     AND clause_condition_met(cf.conditional_on, v_vals);
  IF v_missing IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'required_fields',
      'message', 'Required field(s) still empty: ' || array_to_string(v_missing, ', ')));
  END IF;

  IF EXISTS (
    SELECT 1 FROM contract_fields cf
      JOIN documents d2 ON d2.id = cf.document_id
      JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
      JOIN contacts c2 ON c2.id = cp2.contact_id
     WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
       AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
         OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
  ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'party_type_mismatch',
      'message', 'LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record'));
  END IF;

  v_needs_horse := EXISTS (
    SELECT 1 FROM contract_fields
    WHERE document_id = p_document_id
      AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
  IF v_needs_horse AND v_horse_confirmed IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'horse_unconfirmed',
      'message', 'The horse information has not been confirmed by the Lessor'));
  END IF;

  -- ── document-before-contract ───────────────────────────────────────────────
  SELECT coalesce(ct.wall_gating, false) INTO v_is_onboarding
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id;

  IF NOT coalesce(v_is_onboarding, false) THEN
    SELECT array_agg(DISTINCT nm ORDER BY nm) INTO v_unready
      FROM (
        SELECT coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                        c.email, 'A party') AS nm
          FROM document_parties dp
          JOIN contacts c ON c.id = dp.contact_id
         WHERE dp.document_id = p_document_id
           AND dp.is_signer AND dp.contact_id IS NOT NULL
           AND NOT coalesce(c.is_company, false)
           AND dp.party_role NOT IN ('FHE','COMPANY')
           AND (contact_document_wall_state(c.id)->>'gating')::int > 0
      ) x;

    IF v_unready IS NOT NULL THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'onboarding_documents',
        'message', 'Onboarding documents must be completed first by: '
                   || array_to_string(v_unready, ', ')));
    END IF;
  END IF;

  -- D3 REMOVED 2026-08-10 (owner ruling): the four LESSEE acceptance checkboxes it
  -- read -- TXN.{GL_DED,CCC,MORT,MED}_LESSEE_ACCEPT -- are deleted. The Lessee signs
  -- the contract; a separate acknowledgment of an allocated cost added a control
  -- without adding consent. A blocker keyed on fields that no longer exist could
  -- never be satisfied, so it goes in the same migration. The generic
  -- required-fields rule above is untouched and still blocks a blank declaration,
  -- gate-aware -- which is what enforces a live requirement.

  RETURN v_blockers;
END;
$function$;

