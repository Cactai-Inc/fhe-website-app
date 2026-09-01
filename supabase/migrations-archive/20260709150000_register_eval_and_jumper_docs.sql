-- SLICE 6 — register the two remaining documents (C5) and wire them to their
-- service_types via contract_requirements.
--   RELEASE_JUMPER_ADDENDUM      → JUMPER_TRAINING (rider ability attestation + jump eligibility)
--   EVALUATION_LIABILITY_WAIVER  → HORSE_EVALUATION (pre-purchase/lease opinion limitation + waiver)
-- Templates are GLOBAL (contract_templates has no org_id); contract_requirements is org-scoped.
-- Tokens are copied from RELEASE_PARTICIPANT, which already models every namespace/field these use.

-- ── 1. RELEASE_JUMPER_ADDENDUM template ──
INSERT INTO contract_templates (template_key, title, service_type, party_namespaces, body, version, active)
VALUES (
  'RELEASE_JUMPER_ADDENDUM',
  'Jumper Training Addendum — Rider Ability Attestation',
  'JUMPER_TRAINING',
  ARRAY['CLIENT','PARTICIPANT']::text[],
  $body$JUMPER TRAINING ADDENDUM — RIDER ABILITY ATTESTATION AND JUMPING ELIGIBILITY

This Jumper Training Addendum ("Addendum") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT"), on CLIENT's own behalf and, where a minor participant is identified, on behalf of that minor ("PARTICIPANT"), in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). This Addendum supplements, and is incorporated into, the separately executed Participant Liability Release, Assumption of Risk, Hold Harmless & Indemnification Agreement between CLIENT and COMPANY. It applies only where PARTICIPANT engages, or seeks to engage, in jumping or jumper-training activities under COMPANY's instruction or supervision. Where no minor is identified, CLIENT is the participant and references to PARTICIPANT mean CLIENT.

1. RIDER ABILITY ATTESTATION

PARTICIPANT attests that the riding experience information provided to COMPANY is true and complete, including:

Years of riding experience: {{CLIENT.RIDING_EXPERIENCE_YEARS}}

Prior jumping experience and maximum height schooled: {{CLIENT.JUMP_EXPERIENCE}}

Prior instruction or show experience: {{CLIENT.RIDING_BACKGROUND}}

Misrepresentation of riding experience materially increases risk to PARTICIPANT and others, and PARTICIPANT assumes all risks arising from any inaccuracy in the experience information provided.

2. JUMPING AUTHORIZATION AND SUPERVISION

PARTICIPANT acknowledges and agrees that: During any lesson, instruction, or session supervised by COMPANY, PARTICIPANT is under COMPANY's supervision and may not jump, school over fences, or attempt any jumping activity without COMPANY's prior authorization and approval, which for jumper training requires completion of this Addendum after COMPANY assesses PARTICIPANT's ability. COMPANY may, in its sole discretion, decline, limit, modify, or discontinue any jumping activity, or restrict PARTICIPANT to flatwork, at any time based on COMPANY's assessment of PARTICIPANT's ability, the horse, or conditions. An ASTM/SEI-certified riding helmet is required for all mounted activities without exception.

3. SCOPE

This jumping authorization requirement applies to activities conducted under COMPANY's instruction or supervision. It does not govern a person's independent use of a horse that person owns or leases when that person is not participating in a COMPANY lesson, instruction, or session, and COMPANY assumes no liability for such independent activity solely by reason of providing lessons or other services to that person.

4. INCORPORATION

The risk acknowledgments, assumption of risk, release, hold harmless, and indemnification obligations set forth in the separately executed Participant Liability Release, Assumption of Risk, Hold Harmless & Indemnification Agreement apply in full to the jumping activities addressed by this Addendum and are incorporated herein by reference. This Addendum supplements and does not supersede that Agreement.

CLIENT

Date: {{SIG.CLIENT.DATE}}
Printed Name: {{CLIENT.PRINTED_NAME}}
Signature: {{SIG.CLIENT.NAME}}
Phone: {{CLIENT.PHONE}}
Email: {{CLIENT.EMAIL}}

<!-- CUT-START: MINOR_PARTICIPANT | condition: append only if PARTICIPANT is a minor -->
MINOR PARTICIPANT (IF APPLICABLE)

Minor's Name: {{PARTICIPANT.FULL_NAME}}
Date of Birth: {{PARTICIPANT.DOB}}

Where a minor PARTICIPANT is identified above, CLIENT certifies that CLIENT is the parent or legal guardian of the minor and has authority to execute this Addendum on the minor's behalf, consents to the minor's participation in jumping and jumper-training activities, and agrees to the terms of this Addendum both on CLIENT's own behalf and on behalf of the minor.
<!-- CUT-END: MINOR_PARTICIPANT -->$body$,
  1, true
)
ON CONFLICT (template_key) DO UPDATE
  SET title = EXCLUDED.title, service_type = EXCLUDED.service_type,
      party_namespaces = EXCLUDED.party_namespaces, body = EXCLUDED.body, active = true,
      updated_at = now();

-- ── 2. EVALUATION_LIABILITY_WAIVER template ──
INSERT INTO contract_templates (template_key, title, service_type, party_namespaces, body, version, active)
VALUES (
  'EVALUATION_LIABILITY_WAIVER',
  'Pre-Purchase / Lease Evaluation Liability Waiver',
  'HORSE_EVALUATION',
  ARRAY['CLIENT']::text[],
  $body$PRE-PURCHASE / LEASE EVALUATION LIABILITY WAIVER AND LIMITATION OF OPINION

This Pre-Purchase / Lease Evaluation Liability Waiver ("Waiver") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT") in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). It applies to any horse evaluation, assessment, trial ride, or opinion COMPANY provides to CLIENT in connection with a possible purchase or lease of a horse.

1. NATURE OF THE EVALUATION

CLIENT acknowledges that a horse evaluation is COMPANY's good-faith, subjective opinion formed from limited observation on a particular day and under particular conditions. It is NOT a veterinary examination, a soundness guarantee, a pre-purchase medical examination, or a warranty of any kind. COMPANY does not perform, and this evaluation does not include, radiographs, imaging, laboratory testing, drug screening, or any diagnostic procedure. CLIENT is solely responsible for arranging an independent veterinary pre-purchase examination and any diagnostic testing CLIENT deems appropriate before purchasing or leasing any horse.

2. NO GUARANTEE OF QUALITY, SUITABILITY, OR OUTCOME

COMPANY makes NO representation, warranty, or guarantee — express or implied — as to any horse's soundness, health, temperament, training level, suitability for CLIENT's intended use, future performance, value, or freedom from latent defects or vices. A horse's behavior, soundness, and suitability can change and may differ materially from what was observed during the evaluation. CLIENT assumes all risk associated with any decision to purchase, lease, ride, or handle any horse, and acknowledges that such decisions are CLIENT's own.

3. ASSUMPTION OF RISK — TRIAL RIDING AND HANDLING

Where the evaluation includes CLIENT riding, handling, or being near a horse, CLIENT acknowledges the inherent risks of equine activities, including the propensity of a horse to behave in ways that may result in injury, harm, or death, and CLIENT voluntarily assumes all such risks. An ASTM/SEI-certified riding helmet is required for all mounted activities without exception.

4. RELEASE, HOLD HARMLESS, AND INDEMNIFICATION

To the fullest extent permitted by law, CLIENT releases, waives, and discharges COMPANY, its owners, employees, and agents from any and all claims, demands, losses, or damages arising out of or relating to the evaluation, the opinion provided, or CLIENT's decision to purchase, lease, ride, or handle any horse — including claims that the horse was not as evaluated or represented. CLIENT agrees to hold harmless and indemnify COMPANY from any such claims brought by CLIENT or any third party.

5. SEVERABILITY

If any provision of this Waiver is held unenforceable, the remaining provisions remain in full force and effect.

CLIENT

Date: {{SIG.CLIENT.DATE}}
Printed Name: {{CLIENT.PRINTED_NAME}}
Signature: {{SIG.CLIENT.NAME}}
Phone: {{CLIENT.PHONE}}
Email: {{CLIENT.EMAIL}}$body$,
  1, true
)
ON CONFLICT (template_key) DO UPDATE
  SET title = EXCLUDED.title, service_type = EXCLUDED.service_type,
      party_namespaces = EXCLUDED.party_namespaces, body = EXCLUDED.body, active = true,
      updated_at = now();

-- ── 3. Copy token rows from RELEASE_PARTICIPANT for the tokens each new doc uses ──
-- Jumper addendum: all tokens except the ORD.* it doesn't use — it uses the same
-- CLIENT.*/PARTICIPANT.*/DOC.*/ORG.*/SIG.* set as RELEASE_PARTICIPANT.
INSERT INTO template_tokens (template_id, namespace, field, token, kind, source_table, source_column, computed, required, party_scoped)
SELECT jt.id, tt.namespace, tt.field, tt.token, tt.kind, tt.source_table, tt.source_column, tt.computed, tt.required, tt.party_scoped
FROM template_tokens tt
JOIN contract_templates rp ON rp.id = tt.template_id AND rp.template_key = 'RELEASE_PARTICIPANT'
CROSS JOIN (SELECT id FROM contract_templates WHERE template_key = 'RELEASE_JUMPER_ADDENDUM') jt
WHERE tt.token IN (
  '{{DOC.EFFECTIVE_DATE}}','{{ORG.LEGAL_NAME}}',
  '{{CLIENT.RIDING_EXPERIENCE_YEARS}}','{{CLIENT.JUMP_EXPERIENCE}}','{{CLIENT.RIDING_BACKGROUND}}',
  '{{CLIENT.PRINTED_NAME}}','{{CLIENT.PHONE}}','{{CLIENT.EMAIL}}',
  '{{PARTICIPANT.FULL_NAME}}','{{PARTICIPANT.DOB}}',
  '{{SIG.CLIENT.DATE}}','{{SIG.CLIENT.NAME}}'
)
AND NOT EXISTS (
  SELECT 1 FROM template_tokens x WHERE x.template_id = jt.id AND x.token = tt.token
);

-- Eval waiver: the CLIENT.*/DOC.*/ORG.*/SIG.* subset it uses (no PARTICIPANT/experience tokens).
INSERT INTO template_tokens (template_id, namespace, field, token, kind, source_table, source_column, computed, required, party_scoped)
SELECT et.id, tt.namespace, tt.field, tt.token, tt.kind, tt.source_table, tt.source_column, tt.computed, tt.required, tt.party_scoped
FROM template_tokens tt
JOIN contract_templates rp ON rp.id = tt.template_id AND rp.template_key = 'RELEASE_PARTICIPANT'
CROSS JOIN (SELECT id FROM contract_templates WHERE template_key = 'EVALUATION_LIABILITY_WAIVER') et
WHERE tt.token IN (
  '{{DOC.EFFECTIVE_DATE}}','{{ORG.LEGAL_NAME}}',
  '{{CLIENT.PRINTED_NAME}}','{{CLIENT.PHONE}}','{{CLIENT.EMAIL}}',
  '{{SIG.CLIENT.DATE}}','{{SIG.CLIENT.NAME}}'
)
AND NOT EXISTS (
  SELECT 1 FROM template_tokens x WHERE x.template_id = et.id AND x.token = tt.token
);

-- ── 4. Wire contract_requirements (org-scoped) for every org that already requires
--    the base doc for that service_type. Idempotent. ──
INSERT INTO contract_requirements (org_id, service_type, template_key)
SELECT DISTINCT cr.org_id, 'JUMPER_TRAINING', 'RELEASE_JUMPER_ADDENDUM'
FROM contract_requirements cr
WHERE cr.service_type = 'JUMPER_TRAINING'
  AND NOT EXISTS (
    SELECT 1 FROM contract_requirements x
    WHERE x.org_id = cr.org_id AND x.service_type = 'JUMPER_TRAINING' AND x.template_key = 'RELEASE_JUMPER_ADDENDUM'
  );

INSERT INTO contract_requirements (org_id, service_type, template_key)
SELECT DISTINCT cr.org_id, 'HORSE_EVALUATION', 'EVALUATION_LIABILITY_WAIVER'
FROM contract_requirements cr
WHERE cr.service_type = 'HORSE_EVALUATION'
  AND NOT EXISTS (
    SELECT 1 FROM contract_requirements x
    WHERE x.org_id = cr.org_id AND x.service_type = 'HORSE_EVALUATION' AND x.template_key = 'EVALUATION_LIABILITY_WAIVER'
  );
