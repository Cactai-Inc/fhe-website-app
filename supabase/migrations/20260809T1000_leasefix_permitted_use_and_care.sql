/*
  # LEASEFIX batch 1 — Permitted Use (11.x) and Horse Care (12.x) corrections

  Owner-specified fixes, 2026-08-09. Applied to ALL FOUR lease templates
  (HORSE_LEASE_V2 + the STANDARD / FULL / SIMPLE forks) while they are still
  byte-identical, so a single guarded statement corrects every version. Every
  UPDATE carries an "expected current value" guard: it is a no-op rather than a
  clobber if a fork has already diverged. Verify the row counts are 4.

    1.  11.6 Allowing Others to Ride — drop the "The trainer/instructor" option.
    1b. 11.6 "Other" free-text is present but UNREADABLE: the clause body line
        `Other persons allowed to ride or handle the Horse: {{TOKEN}}` parses as a
        MATRIX_LINE, which lays out as a compact grid cell with a `whitespace-nowrap`
        bold label. A label that long leaves the <input> a few pixels wide. Routing
        the field to `longtext` puts it through the R4 two-line layout (label on its
        own line, control full width beneath) — the same fix R4 applied to squeezed
        long-text cells in 2026-08-04. Owner reports the same symptom, so the OTHER
        explanations in 12.4 and 12.6 use longtext from the start.
    2.  11.8 Transport — add the notify-in-writing election.
    3.  12.4 Protective Equipment — "Other" had NO explanation field at all, so the
        document printed "Lessor will provide the following equipment for the Horse:
        Other." Adds TXN.PROTECTIVE_EQUIPMENT_OTHER + its clause.
    4.  12.6 Rider Aids — the list was ungated, so an empty list either printed a
        dangling "The following rider aids are prohibited:" or (being is_optional)
        dropped out of the contract entirely, leaving it silent on the subject.
        CARE.RIDER_AIDS becomes a header clause hosting a Yes/No, with the two
        outcomes as gated headingless continuations. Yes requires >= 1 aid.

  NOT replay-safe against a fresh database: the guarded UPDATEs match on current
  content and would no-op. That matches the hand-maintained-journal convention.

  Requires PGCLIENTENCODING=UTF8.
*/

-- ── the four keys this batch targets ──────────────────────────────────────────
CREATE TEMP TABLE _leasefix_keys(k text) ON COMMIT DROP;
INSERT INTO _leasefix_keys VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ═══ 1. 11.6 — remove "The trainer/instructor" ═══════════════════════════════
-- The trainer does not need naming here: 11.7 (Releases Required for Authorized
-- Riders) already governs every non-Lessee rider, and the trainer's role is set
-- in PERMITTED_USE.TRAINER / SCHEDULE.TRAINER_CARE.
UPDATE contract_field_defs
   SET options = '[{"label": "None", "value": "NONE"},
                   {"label": "Lessee''s family members", "value": "FAMILY"},
                   {"when": {"any": [{"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"},
                                     {"equals": ["YES"], "field_key": "TXN.LESSONS_ENTITY_PERMITTED"}]},
                    "label": "Riding Lesson Participants", "value": "LESSON_PARTICIPANTS"},
                   {"label": "Other", "value": "OTHER"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND field_key = 'TXN.OTHERS_ALLOWED'
   AND options @> '[{"value": "TRAINER"}]'::jsonb;

-- Any document already carrying TRAINER keeps a value that is no longer offered.
-- sync_contract_fields_from_defs() deliberately skips multi-select CSVs, so strip
-- the code here instead of leaving a value the picker cannot render.
UPDATE contract_fields cf
   SET value = nullif(array_to_string(
                 array_remove(string_to_array(cf.value, ','), 'TRAINER'), ','), ''),
       updated_at = now()
  FROM documents d
 WHERE d.id = cf.document_id
   AND d.deleted_at IS NULL
   AND d.workflow_state <> 'executed'
   AND cf.field_key = 'TXN.OTHERS_ALLOWED'
   AND 'TRAINER' = ANY(string_to_array(coalesce(cf.value, ''), ','));


-- ═══ 1b. 11.6 — make the "Other" explanation actually usable ═════════════════
UPDATE contract_field_defs
   SET label = 'Other persons allowed',
       input_kind = 'longtext',
       format_type = 'longtext'
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND field_key = 'TXN.OTHERS_ALLOWED_OTHER'
   AND input_kind = 'text';

-- The clause line carried the long label that squeezed the control. With the
-- field on its own two-line layout the prose label is redundant.
UPDATE contract_clause_defs
   SET body = 'Other persons allowed to ride or handle the Horse:
{{TXN.OTHERS_ALLOWED_OTHER}}'
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND clause_key = 'PROHIBITED.OTHERS_OTHER'
   AND body = 'Other persons allowed to ride or handle the Horse: {{TXN.OTHERS_ALLOWED_OTHER}}';


-- ═══ 2. 11.8 Transport — add the notify-in-writing election ══════════════════
UPDATE contract_field_defs
   SET options = '[{"label": "Lessor grants permission to transport offsite", "value": "GRANTED"},
                   {"label": "Lessor requires Lessee to notify Lessor in writing of any need to transport the Horse offsite prior to offsite transport", "value": "NOTIFY_IN_WRITING"},
                   {"label": "Lessor prohibits offsite transport without written consent", "value": "PROHIBITED"}]'::jsonb
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND field_key = 'TXN.OFFSITE_TRANSPORT'
   AND NOT (options @> '[{"value": "NOTIFY_IN_WRITING"}]'::jsonb);


-- ═══ 3. 12.4 Protective Equipment — the missing "Other" explanation ══════════
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'CARE', 'CARE.PROTECTIVE_EQUIP_OTHER', NULL,
       'Other protective equipment provided:
{{TXN.PROTECTIVE_EQUIPMENT_OTHER}}',
       'input', 63, false,
       '{"all": [{"equals": ["YES"], "field_key": "TXN.PROTECTIVE_REQUIRED"},
                 {"contains": ["OTHER"], "field_key": "TXN.PROTECTIVE_EQUIPMENT"}]}'::jsonb,
       false
  FROM _leasefix_keys
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, format_type, required, is_optional, sort_order, conditional_on)
SELECT k, 'TXN.PROTECTIVE_EQUIPMENT_OTHER', 'Other protective equipment',
       'CARE', 'CARE.PROTECTIVE_EQUIP_OTHER', 'LESSOR',
       'longtext', 'text', 'longtext', false, false, 63,
       '{"all": [{"equals": ["YES"], "field_key": "TXN.PROTECTIVE_REQUIRED"},
                 {"contains": ["OTHER"], "field_key": "TXN.PROTECTIVE_EQUIPMENT"}]}'::jsonb
  FROM _leasefix_keys
ON CONFLICT (template_key, field_key) DO NOTHING;


-- ═══ 4. 12.6 Rider Aids — Yes/No gate over the prohibited list ═══════════════
-- CARE.RIDER_AIDS keeps the heading (and therefore the 12.6 number) and hosts the
-- Yes/No control with an EMPTY body, so the control is authoring-only and never
-- prints as "Rider aids prohibited: Yes." The two outcomes are headingless
-- continuations under it — the same shape as CARE.PROTECTIVE / CARE.PROTECTIVE_EQUIP.
UPDATE contract_clause_defs
   SET body = '',
       is_optional = false
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND clause_key = 'CARE.RIDER_AIDS'
   AND body = 'The following rider aids are prohibited: {{TXN.RIDER_AIDS}}';

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order)
SELECT k, 'TXN.RIDER_AIDS_PROHIBITED', 'Lessor prohibits the use of rider aids',
       'CARE', 'CARE.RIDER_AIDS', 'LESSOR', 'yesno', 'text', true, false, 90
  FROM _leasefix_keys
ON CONFLICT (template_key, field_key) DO NOTHING;

-- NO → a positive statement, so the executed contract is never silent on the point.
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'CARE', 'CARE.RIDER_AIDS_NONE', NULL,
       'Lessor does not prohibit the use of rider aids.',
       'prose', 91, false,
       '{"equals": ["NO"], "field_key": "TXN.RIDER_AIDS_PROHIBITED"}'::jsonb,
       false
  FROM _leasefix_keys
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- YES → the list, which is now REQUIRED (at least one aid) and gated.
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on, render_as_subitem)
SELECT k, 'CARE', 'CARE.RIDER_AIDS_LIST', NULL,
       'Lessor prohibits the use of the following rider aids: {{TXN.RIDER_AIDS}}',
       'input', 92, false,
       '{"equals": ["YES"], "field_key": "TXN.RIDER_AIDS_PROHIBITED"}'::jsonb,
       false
  FROM _leasefix_keys
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_field_defs
   SET clause_key = 'CARE.RIDER_AIDS_LIST',
       required = true,
       conditional_on = '{"equals": ["YES"], "field_key": "TXN.RIDER_AIDS_PROHIBITED"}'::jsonb,
       sort_order = 92
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND field_key = 'TXN.RIDER_AIDS'
   AND clause_key = 'CARE.RIDER_AIDS';

-- The "Other" explanation moves under the list and gets the readable layout.
UPDATE contract_clause_defs
   SET body = 'Other prohibited rider aid:
{{TXN.RIDER_AIDS_OTHER}}',
       sort_order = 93,
       is_optional = false,
       conditional_on = '{"all": [{"equals": ["YES"], "field_key": "TXN.RIDER_AIDS_PROHIBITED"},
                                  {"contains": ["OTHER"], "field_key": "TXN.RIDER_AIDS"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND clause_key = 'CARE.RIDER_AIDS_OTHER'
   AND body = 'Other prohibited rider aid: {{TXN.RIDER_AIDS_OTHER}}';

UPDATE contract_field_defs
   SET input_kind = 'longtext',
       format_type = 'longtext',
       sort_order = 93,
       conditional_on = '{"all": [{"equals": ["YES"], "field_key": "TXN.RIDER_AIDS_PROHIBITED"},
                                  {"contains": ["OTHER"], "field_key": "TXN.RIDER_AIDS"}]}'::jsonb
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND field_key = 'TXN.RIDER_AIDS_OTHER'
   AND input_kind = 'text';


-- ═══ 5. An "Other" selection must be explained ═══════════════════════════════
-- Each of these fields is already GATED on its "Other" option being chosen, so
-- required=true cannot block a contract that never offered the choice. Without it
-- the document prints a bare "Other." (12.4 did exactly that) or a dangling label.
UPDATE contract_field_defs
   SET required = true
 WHERE template_key IN (SELECT k FROM _leasefix_keys)
   AND field_key IN ('TXN.OTHERS_ALLOWED_OTHER', 'TXN.RIDER_AIDS_OTHER',
                     'TXN.PROTECTIVE_EQUIPMENT_OTHER')
   AND required = false;
