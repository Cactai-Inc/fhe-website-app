-- ─────────────────────────────────────────────────────────────────────────────
-- HORSE_LEASE_V2 INSURANCE REBUILD (owner-final, 2026-07-28).
--
-- General liability (13.3), Mortality (13.6), and Medical insurance are rebuilt
-- to ONE uniform design, replacing the crossed double-build (the posture
-- selector pair, hidden duplicate deductible blocks, and mortality's premium
-- provisioning):
--
--   1. First element — a "not required" checkbox per type. When checked,
--      everything below is gated off and an adapted risk-acceptance paragraph is
--      included (the medical section's existing paragraph is KEPT verbatim as the
--      medical variant).
--   2. Two party-status lines (always visible while not-required is unchecked):
--        Lessor: [Has and will maintain / Will obtain and will maintain /
--                 Does not have and will not obtain]
--        Lessee: (identical)
--   3. Deductible responsibility — the GL clause pattern, reused in all three:
--        "If a claim is made under any such policy arising from events for which
--         Lessee bears responsibility, whether directly or indirectly,
--         responsibility for any deductible shall be borne by:
--         [Lessor / Lessee / Split / Other]"
--      Lessor/Lessee → split + other detail clauses gated off; Split → the two
--      split fields; Other → the other-arrangement field.
--   4. Removed: GL posture selector + policy description (GL_MAIN), mortality's
--      elected toggle / policy-detail line (MORT_MAIN) / premium provisioning
--      (MORT_PREM_*) / $-vs-% split-mode selectors / MORT_TAIL advance sentence
--      (deductible handling now follows the GL pattern), and medical's coverage
--      selector / policy-detail line / premium / excess-costs machinery.
--
--   • INSURANCE_RISK.MED_TAIL keeps its (owner-replaced, 20260729010000) body
--     VERBATIM — only its gate moves to the new not-required checkbox.
--   • INSURANCE_RISK.COORDINATION re-gates from the removed TXN.MORT_ELECTED to
--     "mortality not disclaimed AND entity lessee".
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ══ shared bits ═══════════════════════════════════════════════════════════════
-- party-status option set (closed): used by all six status fields.
-- (inline in each INSERT below)

-- ══ 1) GENERAL LIABILITY ═════════════════════════════════════════════════════

-- remove the duplicated first build
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.GL_POSTURE', 'TXN.GL_DESCRIPTION');
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.GL_MAIN';

-- the not-required checkbox + the two party-status fields
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order,
   clause_key, closed)
VALUES
  ('HORSE_LEASE_V2', 'TXN.GL_NOT_REQUIRED',
   'General liability insurance is not required for or by either party under this Agreement.',
   'INSURANCE_RISK', 'LESSOR', 'certify', 'checkbox', 'certify',
   NULL, NULL, false, false, 5, 'INSURANCE_RISK.GENERAL_LIABILITY', false),
  ('HORSE_LEASE_V2', 'TXN.GL_LESSOR_STATUS', 'Lessor', 'INSURANCE_RISK', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"HAS_WILL_MAINTAIN","label":"Has and will maintain"},{"value":"WILL_OBTAIN","label":"Will obtain and will maintain"},{"value":"NONE","label":"Does not have and will not obtain"}]'::jsonb,
   '{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]}'::jsonb,
   true, false, 10, 'INSURANCE_RISK.GL_STATUS', true),
  ('HORSE_LEASE_V2', 'TXN.GL_LESSEE_STATUS', 'Lessee', 'INSURANCE_RISK', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"HAS_WILL_MAINTAIN","label":"Has and will maintain"},{"value":"WILL_OBTAIN","label":"Will obtain and will maintain"},{"value":"NONE","label":"Does not have and will not obtain"}]'::jsonb,
   '{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]}'::jsonb,
   true, false, 20, 'INSURANCE_RISK.GL_STATUS', true);

-- re-home + re-gate the deductible machinery (kept, single build)
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.GL_DED_SIMPLE',
    conditional_on = '{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.GL_DED_RESP';
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.GL_DED_SPLITC',
    conditional_on = '{"all":[{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.GL_DED_RESP","equals":["SPLIT"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.GL_DED_RESP_SPLIT_LESSOR','TXN.GL_DED_RESP_SPLIT_LESSEE');
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.GL_DED_OTHERC',
    conditional_on = '{"all":[{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.GL_DED_RESP","equals":["OTHER"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.GL_DED_RESP_OTHER';

-- clauses: the status lines, the (single) deductible clause, its detail
-- sub-clauses, and the not-required risk-acceptance paragraph
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, render_as_subitem, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.GL_STATUS', NULL,
   E'Lessor: {{TXN.GL_LESSOR_STATUS}} general liability insurance covering the Horse and the activities contemplated by this Agreement.\nLessee: {{TXN.GL_LESSEE_STATUS}} general liability insurance covering the Horse and the activities contemplated by this Agreement.',
   'input', 155, false, false,
   '{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]}'::jsonb)
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_clause_defs SET
    render_as_subitem = false,
    conditional_on = '{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.GL_DED_SIMPLE';

UPDATE contract_clause_defs SET
    body = 'The deductible shall be split between the parties: {{TXN.GL_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.GL_DED_RESP_SPLIT_LESSEE}} paid by Lessee.',
    conditional_on = '{"all":[{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.GL_DED_RESP","equals":["SPLIT"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.GL_DED_SPLITC';

UPDATE contract_clause_defs SET
    body = 'The deductible shall be handled as follows: {{TXN.GL_DED_RESP_OTHER}}.',
    conditional_on = '{"all":[{"field_key":"TXN.GL_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.GL_DED_RESP","equals":["OTHER"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.GL_DED_OTHERC';

UPDATE contract_clause_defs SET
    body = 'Lessor has elected not to require general liability insurance under this Agreement. Lessor accepts full risk and responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement, except as otherwise expressly allocated in this Agreement.',
    conditional_on = '{"field_key":"TXN.GL_NOT_REQUIRED","equals":["YES"]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.GL_NONE';

-- ══ 2) MORTALITY ═════════════════════════════════════════════════════════════

DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.MORT_ELECTED','TXN.MORT_LIMIT','TXN.MORT_DEDUCTIBLE',
                     'TXN.MORT_EFFECTIVE_DATE','TXN.MORT_PREM_RESP',
                     'TXN.MORT_PREM_RESP_SPLIT_LESSOR','TXN.MORT_PREM_RESP_SPLIT_LESSEE',
                     'TXN.MORT_PREM_RESP_OTHER','TXN.MORT_DED_RESP_MODE');
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND clause_key IN ('INSURANCE_RISK.MORT_MAIN','INSURANCE_RISK.MORT_PREM_SIMPLE',
                      'INSURANCE_RISK.MORT_PREM_SPLITC','INSURANCE_RISK.MORT_PREM_OTHERC',
                      'INSURANCE_RISK.MORT_TAIL');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order,
   clause_key, closed)
VALUES
  ('HORSE_LEASE_V2', 'TXN.MORT_NOT_REQUIRED',
   'Mortality insurance is not required for or by either party under this Agreement.',
   'INSURANCE_RISK', 'LESSOR', 'certify', 'checkbox', 'certify',
   NULL, NULL, false, false, 5, 'INSURANCE_RISK.MORTALITY', false),
  ('HORSE_LEASE_V2', 'TXN.MORT_LESSOR_STATUS', 'Lessor', 'INSURANCE_RISK', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"HAS_WILL_MAINTAIN","label":"Has and will maintain"},{"value":"WILL_OBTAIN","label":"Will obtain and will maintain"},{"value":"NONE","label":"Does not have and will not obtain"}]'::jsonb,
   '{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]}'::jsonb,
   true, false, 10, 'INSURANCE_RISK.MORT_STATUS', true),
  ('HORSE_LEASE_V2', 'TXN.MORT_LESSEE_STATUS', 'Lessee', 'INSURANCE_RISK', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"HAS_WILL_MAINTAIN","label":"Has and will maintain"},{"value":"WILL_OBTAIN","label":"Will obtain and will maintain"},{"value":"NONE","label":"Does not have and will not obtain"}]'::jsonb,
   '{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]}'::jsonb,
   true, false, 20, 'INSURANCE_RISK.MORT_STATUS', true);

UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.MORT_DEDR_SIMPLE', required = true,
    conditional_on = '{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.MORT_DED_RESP';
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC',
    conditional_on = '{"all":[{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MORT_DED_RESP","equals":["SPLIT"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.MORT_DED_RESP_SPLIT_LESSOR','TXN.MORT_DED_RESP_SPLIT_LESSEE');
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.MORT_DEDR_OTHERC',
    conditional_on = '{"all":[{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MORT_DED_RESP","equals":["OTHER"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.MORT_DED_RESP_OTHER';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, render_as_subitem, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.MORT_STATUS', NULL,
   E'Lessor: {{TXN.MORT_LESSOR_STATUS}} mortality insurance on the Horse.\nLessee: {{TXN.MORT_LESSEE_STATUS}} mortality insurance on the Horse.',
   'input', 205, false, false,
   '{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]}'::jsonb)
ON CONFLICT (template_key, clause_key) DO NOTHING;

UPDATE contract_clause_defs SET
    body = 'If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.MORT_DED_RESP}}.',
    render_as_subitem = false,
    conditional_on = '{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SIMPLE';

UPDATE contract_clause_defs SET
    body = 'The deductible shall be split between the parties: {{TXN.MORT_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MORT_DED_RESP_SPLIT_LESSEE}} paid by Lessee.',
    conditional_on = '{"all":[{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MORT_DED_RESP","equals":["SPLIT"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MORT_DEDR_SPLITC';

UPDATE contract_clause_defs SET
    body = 'The deductible shall be handled as follows: {{TXN.MORT_DED_RESP_OTHER}}.',
    conditional_on = '{"all":[{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MORT_DED_RESP","equals":["OTHER"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MORT_DEDR_OTHERC';

UPDATE contract_clause_defs SET
    body = 'Lessor has elected not to require mortality insurance under this Agreement. Lessor accepts full risk and responsibility for the loss of the Horse''s value in the event of the Horse''s death, theft, or humane destruction, except as otherwise expressly allocated in this Agreement.',
    conditional_on = '{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["YES"]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MORT_NONE';

-- Coordination of Coverage: re-gate off the removed TXN.MORT_ELECTED →
-- "mortality not disclaimed AND entity lessee".
UPDATE contract_clause_defs SET
    conditional_on = '{"all":[{"field_key":"TXN.MORT_NOT_REQUIRED","equals":["NO",""]},{"field_key":"LESSEE.PARTY_TYPE","equals":["ENTITY"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.COORDINATION';

-- ══ 3) MEDICAL ═══════════════════════════════════════════════════════════════

DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.MED_COVERAGE','TXN.MED_EFFECTIVE_DATE','TXN.MED_LIMIT',
                     'TXN.MED_DEDUCTIBLE','TXN.MED_PREM_RESP',
                     'TXN.MED_PREM_RESP_SPLIT_LESSOR','TXN.MED_PREM_RESP_SPLIT_LESSEE',
                     'TXN.MED_PREM_RESP_OTHER','TXN.MED_DED_RESP_MODE',
                     'TXN.MED_EXCESS_RESP','TXN.MED_EXCESS_RESP_SPLIT_LESSOR',
                     'TXN.MED_EXCESS_RESP_SPLIT_LESSEE','TXN.MED_EXCESS_RESP_OTHER');
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND clause_key IN ('INSURANCE_RISK.MED_MAIN','INSURANCE_RISK.MED_PREM_SIMPLE',
                      'INSURANCE_RISK.MED_PREM_SPLITC','INSURANCE_RISK.MED_PREM_OTHERC',
                      'INSURANCE_RISK.MED_EXC_SIMPLE','INSURANCE_RISK.MED_EXC_SPLITC',
                      'INSURANCE_RISK.MED_EXC_OTHERC');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order,
   clause_key, closed)
VALUES
  ('HORSE_LEASE_V2', 'TXN.MED_NOT_REQUIRED',
   'Medical insurance is not required for or by either party under this Agreement.',
   'INSURANCE_RISK', 'LESSOR', 'certify', 'checkbox', 'certify',
   NULL, NULL, false, false, 5, 'INSURANCE_RISK.MEDICAL', false),
  ('HORSE_LEASE_V2', 'TXN.MED_LESSOR_STATUS', 'Lessor', 'INSURANCE_RISK', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"HAS_WILL_MAINTAIN","label":"Has and will maintain"},{"value":"WILL_OBTAIN","label":"Will obtain and will maintain"},{"value":"NONE","label":"Does not have and will not obtain"}]'::jsonb,
   '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]}'::jsonb,
   true, false, 10, 'INSURANCE_RISK.MED_STATUS', true),
  ('HORSE_LEASE_V2', 'TXN.MED_LESSEE_STATUS', 'Lessee', 'INSURANCE_RISK', 'LESSOR',
   'select', 'select', 'select',
   '[{"value":"HAS_WILL_MAINTAIN","label":"Has and will maintain"},{"value":"WILL_OBTAIN","label":"Will obtain and will maintain"},{"value":"NONE","label":"Does not have and will not obtain"}]'::jsonb,
   '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]}'::jsonb,
   true, false, 20, 'INSURANCE_RISK.MED_STATUS', true);

UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.MED_DEDR_SIMPLE', required = true,
    conditional_on = '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.MED_DED_RESP';
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC',
    conditional_on = '{"all":[{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MED_DED_RESP","equals":["SPLIT"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.MED_DED_RESP_SPLIT_LESSOR','TXN.MED_DED_RESP_SPLIT_LESSEE');
UPDATE contract_field_defs SET
    clause_key = 'INSURANCE_RISK.MED_DEDR_OTHERC',
    conditional_on = '{"all":[{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MED_DED_RESP","equals":["OTHER"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.MED_DED_RESP_OTHER';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, render_as_subitem, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.MED_STATUS', NULL,
   E'Lessor: {{TXN.MED_LESSOR_STATUS}} medical insurance on the Horse.\nLessee: {{TXN.MED_LESSEE_STATUS}} medical insurance on the Horse.',
   'input', 308, false, false,
   '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]}'::jsonb)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- keep the medical not-required paragraph's EXISTING body; only re-gate it
UPDATE contract_clause_defs SET
    conditional_on = '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["YES"]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_NONE';

UPDATE contract_clause_defs SET
    body = 'If a claim is made under any such policy arising from events for which Lessee bears responsibility, whether directly or indirectly, responsibility for any deductible shall be borne by: {{TXN.MED_DED_RESP}}.',
    render_as_subitem = false,
    conditional_on = '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_DEDR_SIMPLE';

UPDATE contract_clause_defs SET
    body = 'The deductible shall be split between the parties: {{TXN.MED_DED_RESP_SPLIT_LESSOR}} paid by Lessor and {{TXN.MED_DED_RESP_SPLIT_LESSEE}} paid by Lessee.',
    conditional_on = '{"all":[{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MED_DED_RESP","equals":["SPLIT"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_DEDR_SPLITC';

UPDATE contract_clause_defs SET
    body = 'The deductible shall be handled as follows: {{TXN.MED_DED_RESP_OTHER}}.',
    conditional_on = '{"all":[{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]},{"field_key":"TXN.MED_DED_RESP","equals":["OTHER"]}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_DEDR_OTHERC';

-- the insurance-cost paragraph (owner-replaced text — body untouched here):
-- shows whenever medical insurance is not disclaimed.
UPDATE contract_clause_defs SET
    conditional_on = '{"field_key":"TXN.MED_NOT_REQUIRED","equals":["NO",""]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MED_TAIL';

-- ══ 4) live (non-executed) documents: carry over what maps cleanly ═══════════
-- GL: posture MAINTAINS/REQUIRES_WILL → Lessor "Has and will maintain".
-- MORT: elected YES + a future effective date → Lessor "Will obtain and will
-- maintain"; elected YES without one → "Has and will maintain".
-- (MED_COVERAGE=COVERED has no unambiguous status mapping — left for staff.)
INSERT INTO contract_fields
  (org_id, document_id, field_key, label, section, clause_key, owner_role,
   value_type, input_kind, format_type, options, conditional_on, closed, guidance,
   required, is_optional, sort_order, value)
SELECT d.org_id, d.id, fd.field_key, fd.label, fd.section, fd.clause_key, fd.owner_role,
       fd.value_type, nullif(fd.input_kind,''), fd.format_type, fd.options, fd.conditional_on,
       fd.closed, fd.guidance, fd.required, fd.is_optional, fd.sort_order,
       CASE fd.field_key
         WHEN 'TXN.GL_LESSOR_STATUS' THEN
           CASE WHEN v.gl_posture IN ('MAINTAINS','REQUIRES_WILL') THEN 'HAS_WILL_MAINTAIN' ELSE '' END
         WHEN 'TXN.MORT_LESSOR_STATUS' THEN
           CASE WHEN v.mort_elected = 'YES' AND v.mort_date <> '' THEN 'WILL_OBTAIN'
                WHEN v.mort_elected = 'YES' THEN 'HAS_WILL_MAINTAIN' ELSE '' END
       END
FROM documents d
JOIN contract_templates ct ON ct.id = d.template_id AND ct.template_key = 'HORSE_LEASE_V2'
CROSS JOIN LATERAL (
  SELECT
    (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.GL_POSTURE')          AS gl_posture,
    (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.MORT_ELECTED')        AS mort_elected,
    (SELECT coalesce(value,'') FROM contract_fields WHERE document_id = d.id AND field_key = 'TXN.MORT_EFFECTIVE_DATE') AS mort_date
) v
JOIN contract_field_defs fd
  ON fd.template_key = 'HORSE_LEASE_V2'
 AND fd.field_key IN ('TXN.GL_LESSOR_STATUS','TXN.MORT_LESSOR_STATUS')
WHERE d.deleted_at IS NULL
  AND d.workflow_state NOT IN ('executed','void','terminated')
  AND ((fd.field_key = 'TXN.GL_LESSOR_STATUS'   AND v.gl_posture IN ('MAINTAINS','REQUIRES_WILL'))
    OR (fd.field_key = 'TXN.MORT_LESSOR_STATUS' AND v.mort_elected = 'YES'))
ON CONFLICT (document_id, field_key) DO NOTHING;

COMMIT;
