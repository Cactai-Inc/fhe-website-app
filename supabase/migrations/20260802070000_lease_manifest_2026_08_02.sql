-- Lease manifest 2026-08-02 (M1-M24 + M25a section move), applied to live this date.
-- Guarded verify-first statements: each UPDATE carries its manifest VERIFY anchor in
-- the WHERE clause (0 rows when already applied); inserts are NOT EXISTS-guarded.
-- Authored from LEASE_MANIFEST_2026-08-02.md under CARRYOVER_AND_PROTOCOL.md §4.


UPDATE contract_clause_defs SET body = $B$"Lessor Parties" means Lessor; Lessor's spouse and family and household members, in each case when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Lessor's estate, executors, administrators, legal representatives, successors, and assigns.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.LESSOR_IND'
  AND body LIKE $A$"Lessor Parties" means Lessor and Lessor's heirs, next of kin, spouse,%$A$;

UPDATE contract_clause_defs SET body = $B$"Lessor Parties" means Lessor; Lessor's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Lessor and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.LESSOR_ENT'
  AND position('to the same extent as if that person had entered into this Agreement individually as Lessor' in body) > 0;

UPDATE contract_clause_defs SET body = $B$"Lessee Parties" means Lessee; Lessee's spouse and family and household members, in each case when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and Lessee's estate, executors, administrators, legal representatives, successors, and assigns.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.LESSEE_IND'
  AND body LIKE $A$"Lessee Parties" means Lessee and Lessee's heirs, next of kin, spouse,%$A$;

UPDATE contract_clause_defs SET body = $B$"Lessee Parties" means Lessee; Lessee's parent, subsidiary, and affiliated entities; the owners, principals, proprietors, partners, members, managers, officers, directors, employees, trainers, instructors, agents, contractors, and volunteers of Lessee and of each such entity, together with the family members of any such natural person when handling, caring for, transporting, riding, or otherwise involved with the Horse or the activities contemplated by this Agreement; and the successors and assigns of each of the foregoing.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.LESSEE_ENT'
  AND position('to the same extent as if that person had entered into this Agreement individually as Lessee' in body) > 0;

UPDATE contract_clause_defs SET body = $B$Each release, waiver, assumption of risk, and covenant made by a party under this Agreement is made by that party on its own behalf and, to the fullest extent permitted by law, binds anyone claiming by, through, or under that party, including that party's estate, executors, administrators, heirs, legal representatives, successors, assigns, insurers, and subrogees. Each party covenants that it will not permit any person who has not executed this Agreement or a release satisfying the Releases Required for Authorized Riders provision of this Agreement to ride, handle, or care for the Horse, and each party shall indemnify, defend, and hold harmless the other party's Lessor Parties or Lessee Parties, as applicable, from and against any claim brought by that party's family members, invitees, or authorized riders arising out of the Horse or the activities contemplated by this Agreement, except to the extent caused by the gross negligence, reckless conduct, or intentional misconduct of an indemnified party.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.BINDING'
  AND position('bind each of them to the same extent as the party itself' in body) > 0;

UPDATE contract_clause_defs SET body = $B$Each Lessor Party and each Lessee Party who is not a signatory to this Agreement is an intended third-party beneficiary of the releases, waivers, assumptions of risk, indemnities, and limitations of liability in this Agreement and may enforce them directly.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='DEFINITIONS.BENEFICIARIES'
  AND body LIKE 'Each Lessor Party and each Lessee Party is an intended third-party beneficiary%';


UPDATE contract_clause_defs SET body = $B$Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.$B$
WHERE template_key='HORSE_LEASE_V2' AND section_key='HORSE' AND heading='Disclaimer of Warranties'
  AND position('INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE' in body) > 0;

UPDATE contract_clause_defs SET body = body || E'\n' || $B$If no monetary lease fee is payable under this Agreement, the parties agree that Lessee's undertakings of care, exercise, and use of the Horse and Lessee's other obligations under this Agreement constitute good and adequate consideration for this Agreement.$B$
WHERE template_key='HORSE_LEASE_V2' AND section_key='LEASE_FEE' AND clause_key LIKE '%CHOICE'
  AND body NOT LIKE '%If no monetary lease fee is payable under this Agreement%';

UPDATE contract_clause_defs SET body = $B$All persons other than Lessee must, prior to handling or riding the Horse, have executed a liability release that names the Lessor Parties and the Lessee Parties as released parties, contains an express assumption of the inherent risks of equine activities, has been reviewed and approved by Lessor, and, for any rider under 18 years of age, is signed by the rider's parent or legal guardian. Lessee is responsible for ensuring this requirement is satisfied before permitting any authorized person to ride or handle the Horse.$B$
WHERE template_key='HORSE_LEASE_V2' AND section_key='PERMITTED_USE' AND heading='Releases Required for Authorized Riders';

UPDATE contract_clause_defs SET body = body || ' ' || $B$Where Competitions are a permitted activity under this Agreement, transport of the Horse to and from the competition venue for that competition is deemed consented, subject to any competition restrictions stated in this Agreement.$B$
WHERE template_key='HORSE_LEASE_V2' AND section_key='PERMITTED_USE' AND heading='Transport of the Horse'
  AND body NOT LIKE '%transport of the Horse to and from the competition venue%';

UPDATE contract_clause_defs SET body = $B$Lessor may inspect the Horse at any time, subject to the reasonable access rules of the facility where the Horse is kept. If Lessor reasonably determines that the Horse is not being properly cared for, Lessor may take possession of the Horse upon written notice to Lessee.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.INSPECTION';

UPDATE contract_clause_defs SET body =
  left(body, position('Pursuant to this binding legal precedent' in body) - 1)
  || $B$Consistent with this precedent, Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, expressly and voluntarily assumes all inherent risks associated with riding or handling the Horse, and acknowledges that no Lessor Party owes a duty to protect Lessee from these inherent risks.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.ASSUMPTION_INHERENT'
  AND position('Pursuant to this binding legal precedent, Lessee, on behalf of all Lessee Parties,' in body) > 0;

UPDATE contract_clause_defs SET body = $B$In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, completely releases, forever discharges, and agrees to hold harmless the Lessor Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessee's use, handling, or riding of the Horse, whether caused by the ordinary negligence of any Lessor Party or otherwise. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RELEASE'
  AND body LIKE 'In consideration for being permitted to handle or ride the Horse, Lessee, on behalf of Lessee and all Lessee Parties,%';

UPDATE contract_clause_defs SET body = replace(body,
  $O$Lessee, on behalf of all Lessee Parties, assumes all increased risk of injury or death resulting from any failure to wear the required attire.$O$,
  $N$Lessee, on behalf of Lessee and anyone claiming by, through, or under Lessee, assumes all increased risk of injury or death resulting from any failure to wear the required attire.$N$)
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.SAFETY_ATTIRE'
  AND position('Lessee, on behalf of all Lessee Parties, assumes all increased risk' in body) > 0;

UPDATE contract_clause_defs SET body = $B$Each party, on behalf of itself and anyone claiming by, through, or under it, expressly waives any and all claims released under this Agreement that the waiving party does not know or suspect to exist in its favor at the time of this Agreement. Each party acknowledges that it is familiar with, and expressly waives the protections of, California Civil Code Section 1542, which provides: "A general release does not extend to claims that the creditor or releasing party does not know or suspect to exist in his or her favor at the time of executing the release and that, if known by him or her, would have materially affected his or her settlement with the debtor or released party." Each party assumes the risk that claims presently unknown to it may later be discovered, and acknowledges that this waiver is a material term of this Agreement.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.WAIVER_UNKNOWN'
  AND body LIKE 'Each party, on behalf of itself and, respectively, the Lessor Parties or the Lessee Parties, expressly waives%';

UPDATE contract_clause_defs SET body =
  left(body, length(body) - length($O$This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.$O$))
  || $N$This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct, to either party's indemnification obligations for third-party claims for bodily injury or death, or to amounts actually covered by insurance available for the loss.$N$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.LIMITATION'
  AND body LIKE $O$%This limitation does not apply to gross negligence, reckless conduct, or intentional misconduct.$O$;

UPDATE contract_clause_defs SET body =
  left(body, length(body) - length($O$or a claim made to a policy is denied for any reason.$O$))
  || $N$or a claim made to a policy is denied for any reason, except as otherwise expressly allocated in this section or elsewhere in this Agreement.$N$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MED_TAIL'
  AND body LIKE $O$%or a claim made to a policy is denied for any reason.$O$;

UPDATE contract_clause_defs SET body = $B$This Agreement is governed by the laws of the State of California, without regard to conflict-of-laws principles. Any dispute arising out of or relating to this Agreement or the Horse shall be resolved by final and binding arbitration in San Diego County, California, before a single arbitrator administered by JAMS under its applicable rules, or another administrator the parties agree to in writing, with arbitrator fees and administrative costs allocated as those rules provide. Either party may bring a qualifying claim in small claims court, and either party may seek provisional or injunctive relief, including recovery of possession of the Horse, in a court of competent jurisdiction without waiving arbitration. Judgment on the award may be entered in any court having jurisdiction.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='GOVERNING_LAW.CHOICE'
  AND body = $O$This Agreement shall be governed by the laws of the State of California. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.$O$;

UPDATE contract_clause_defs SET body = replace(body,
  $O$By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.$O$,
  $N$By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and anyone claiming by, through, or under Lessee, including the right to sue the Lessor Parties.$N$)
WHERE template_key='HORSE_LEASE_V2' AND clause_key='LESSEE_REPS.MAIN_INDIVIDUAL'
  AND position('on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.' in body) > 0;

UPDATE contract_clause_defs SET body = replace(body,
  $O$By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.$O$,
  $N$By signing this Agreement, Lessee acknowledges that Lessee has read this Agreement, fully understands its terms, and understands that Lessee is giving up substantial legal rights on behalf of Lessee and anyone claiming by, through, or under Lessee, including the right to sue the Lessor Parties.$N$)
WHERE template_key='HORSE_LEASE_V2' AND clause_key='LESSEE_REPS.MAIN_ENTITY'
  AND position('on behalf of Lessee and all Lessee Parties, including the right to sue the Lessor Parties.' in body) > 0;


UPDATE contract_clause_defs SET body = $B$Lessee has elected to accept, and hereby accepts, financial responsibility for general liability insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, general liability insurance covering the Horse and the activities contemplated by this Agreement for the duration of this Agreement, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessee bears responsibility for liability claims for bodily injury or property damage to third parties arising from the Horse or the activities contemplated by this Agreement to the extent not covered by an in-force policy.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.GL_LESSEE_RESP'
  AND body LIKE '[PENDING LEGAL REVIEW%';

UPDATE contract_clause_defs SET body = $B$Lessee has elected to accept, and hereby accepts, financial responsibility for mortality insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, mortality insurance on the Horse for the duration of this Agreement in an amount not less than the Horse's current fair market value, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in this Agreement, Lessee bears responsibility for the loss of the Horse's value in the event of the Horse's death, theft, or humane destruction to the extent not covered by an in-force policy.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MORT_LESSEE_RESP'
  AND body LIKE '[PENDING LEGAL REVIEW%';

UPDATE contract_clause_defs SET body = $B$Lessee has elected to accept, and hereby accepts, financial responsibility for medical insurance under this Agreement. Lessee shall obtain and maintain, at Lessee's sole cost, medical insurance on the Horse for the duration of this Agreement, and shall provide proof of coverage to Lessor upon request. As between the parties, and except as otherwise expressly allocated in the Horse Care and Expenses section of this Agreement, Lessee bears responsibility for the costs of veterinary care arising from injury to or illness of the Horse to the extent not covered by an in-force policy.$B$
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MED_LESSEE_RESP'
  AND body LIKE '[PENDING LEGAL REVIEW%';

UPDATE contract_clause_defs SET body = replace(body, 'Year foaled: {{HORSE.AGE_DOB}}', 'Foaling date: {{HORSE.AGE_DOB}}')
WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.IDENTITY'
  AND position('Year foaled: {{HORSE.AGE_DOB}}' in body) > 0;

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.RELEASE_LESSOR', 'Release of Liability by Lessor',
$B$In consideration of the mutual promises in this Agreement, Lessor, on behalf of Lessor and anyone claiming by, through, or under Lessor, completely releases, forever discharges, and agrees to hold harmless the Lessee Parties, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Lessor's riding or handling of the Horse or Lessor's presence at any facility where the Horse is kept during the term of this Agreement, whether caused by the ordinary negligence of any Lessee Party or otherwise. Lessor expressly and voluntarily assumes all inherent risks of equine activities in connection with such riding, handling, or presence. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.$B$,
'prose', 961, NULL
WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RELEASE_LESSOR')
  AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND section_key='INSURANCE_RISK' AND sort_order=961);

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2', 'HORSE', 'HORSE.INJURY_HISTORY_NONE', 'No Serious Injury History',
$B$Lessor represents that, to Lessor's knowledge, no person has suffered serious injury proximately caused by the direct actions of the Horse, including biting, kicking, striking, bucking, rearing, bolting, crushing, or throwing a rider. This representation does not extend to any incident caused primarily by a third party or an external stimulus — such as another horse or rider being at fault, a loose dog, wildlife, a vehicle, or a similar external provocation — where the Horse's reaction was within the range of normal equine behavior.$B$,
'input', 43, '{"equals": ["NO"], "field_key": "TXN.INJURY_HISTORY"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.INJURY_HISTORY_NONE')
  AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND section_key='HORSE' AND sort_order IN (43,44,45));

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2', 'HORSE', 'HORSE.INJURY_HISTORY_DISCLOSED', 'Serious Injury History Disclosed',
$B$Lessor discloses that one or more persons have suffered serious injury involving the direct actions of the Horse, as follows, including for each incident the approximate date, the circumstances, the Horse's actions, and the nature of the injury: {{TXN.INJURY_HISTORY_DETAILS}}. Lessee acknowledges this disclosure and proceeds with knowledge of it.$B$,
'input', 44, '{"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.INJURY_HISTORY_DISCLOSED');

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2', 'HORSE', 'HORSE.INJURY_HISTORY_PENDING', NULL,
$B$[Pending — state whether anyone has been seriously injured by the Horse's direct actions. This placeholder is replaced by the applicable statement and blocks signing.]$B$,
'input', 45, '{"equals": [""], "field_key": "TXN.INJURY_HISTORY"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.INJURY_HISTORY_PENDING');

INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, options, conditional_on, required, clause_key, sort_order)
SELECT 'HORSE_LEASE_V2', 'TXN.INJURY_HISTORY', 'Has anyone been seriously injured by the Horse''s direct actions?', 'HORSE', 'LESSOR', 'select', 'select',
'[{"label": "Yes", "value": "YES"}, {"label": "No", "value": "NO"}]'::jsonb, NULL, true, 'HORSE.INJURY_HISTORY_NONE', 10
WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.INJURY_HISTORY');

INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, conditional_on, required, clause_key, sort_order)
SELECT 'HORSE_LEASE_V2', 'TXN.INJURY_HISTORY_DETAILS', 'Injury history details', 'HORSE', 'LESSOR', 'longtext', 'longtext',
'{"equals": ["YES"], "field_key": "TXN.INJURY_HISTORY"}'::jsonb, true, 'HORSE.INJURY_HISTORY_DISCLOSED', 20
WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.INJURY_HISTORY_DETAILS');

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2', 'SIGNATURES', 'SIGNATURES.LESSEE_CAPACITY', NULL,
E'By: {{LESSEE.ENTITY_SIGNER_NAME}}\nTitle: {{LESSEE.ENTITY_SIGNER_TITLE}}\nSigning on behalf of {{LESSEE.FULL_NAME}}',
'input', 11, '{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='SIGNATURES.LESSEE_CAPACITY')
  AND NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND section_key='SIGNATURES' AND sort_order IN (11,12));

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, conditional_on)
SELECT 'HORSE_LEASE_V2', 'SIGNATURES', 'SIGNATURES.LESSOR_CAPACITY', NULL,
E'By: {{LESSOR.ENTITY_SIGNER_NAME}}\nTitle: {{LESSOR.ENTITY_SIGNER_TITLE}}\nSigning on behalf of {{LESSOR.FULL_NAME}}',
'input', 12, '{"equals": ["ENTITY"], "field_key": "LESSOR.PARTY_TYPE"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='SIGNATURES.LESSOR_CAPACITY');

INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, conditional_on, required, clause_key, sort_order)
SELECT * FROM (VALUES
  ('HORSE_LEASE_V2', 'LESSEE.ENTITY_SIGNER_NAME',  'Signing individual — name',  'SIGNATURES', 'LESSEE', 'text', 'text', '{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}'::jsonb, true, 'SIGNATURES.LESSEE_CAPACITY', 10),
  ('HORSE_LEASE_V2', 'LESSEE.ENTITY_SIGNER_TITLE', 'Signing individual — title', 'SIGNATURES', 'LESSEE', 'text', 'text', '{"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}'::jsonb, true, 'SIGNATURES.LESSEE_CAPACITY', 20),
  ('HORSE_LEASE_V2', 'LESSOR.ENTITY_SIGNER_NAME',  'Signing individual — name',  'SIGNATURES', 'LESSOR', 'text', 'text', '{"equals": ["ENTITY"], "field_key": "LESSOR.PARTY_TYPE"}'::jsonb, true, 'SIGNATURES.LESSOR_CAPACITY', 30),
  ('HORSE_LEASE_V2', 'LESSOR.ENTITY_SIGNER_TITLE', 'Signing individual — title', 'SIGNATURES', 'LESSOR', 'text', 'text', '{"equals": ["ENTITY"], "field_key": "LESSOR.PARTY_TYPE"}'::jsonb, true, 'SIGNATURES.LESSOR_CAPACITY', 40)
) v(template_key, field_key, label, section, owner_role, input_kind, value_type, conditional_on, required, clause_key, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs f WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key=v.field_key);


-- M25(a): Definitions renders immediately after Parties (ordering is data-driven).
UPDATE contract_section_defs SET sort_order=12 WHERE template_key='HORSE_LEASE_V2' AND section_key='DEFINITIONS' AND sort_order=22;
