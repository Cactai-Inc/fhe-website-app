-- Release family: signer-side heirs/estate binding (owner file replacements,
-- RELEASE_FAMILY_SIGNER_SIDE_CHANGES pass, 2026-07-27/28)
--
-- Drift-checked per template first (live body vs pre-edit file):
--   * EVALUATION_LIABILITY_WAIVER, HUMAN_EMERGENCY_MEDICAL, RELEASE_GENERAL,
--     RELEASE_PARTICIPANT: identical -> full-body load from the updated file.
--   * HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE: live bodies carry owner-approved
--     July-14 features never backported to the files (COVERAGE EXTENSION
--     lessee clause; Height/FMV lines; two-option euthanasia election).
--     Applied as SENTENCE-LEVEL replaces so that drift is preserved; the
--     working-tree files are backported to match live in the same commit.
--   * RELEASE_HORSE_EXERCISE: retired + deactivated 2026-07-05 (matrix
--     repointed to RELEASE_HORSE_CARE); its stale inactive body is left alone.

BEGIN;

UPDATE contract_templates SET body = $FHEB$PRE-PURCHASE / LEASE EVALUATION LIABILITY WAIVER AND LIMITATION OF OPINION

This Pre-Purchase / Lease Evaluation Liability Waiver ("Waiver") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT") in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). It applies to any horse evaluation, assessment, trial ride, or opinion COMPANY provides to CLIENT in connection with a possible purchase or lease of a horse.

1. NATURE OF THE EVALUATION

CLIENT acknowledges that a horse evaluation is COMPANY's good-faith, subjective opinion formed from limited observation on a particular day and under particular conditions. It is NOT a veterinary examination, a soundness guarantee, a pre-purchase medical examination, or a warranty of any kind. COMPANY does not perform, and this evaluation does not include, radiographs, imaging, laboratory testing, drug screening, or any diagnostic procedure. CLIENT is solely responsible for arranging an independent veterinary pre-purchase examination and any diagnostic testing CLIENT deems appropriate before purchasing or leasing any horse.

2. NO GUARANTEE OF QUALITY, SUITABILITY, OR OUTCOME

COMPANY makes NO representation, warranty, or guarantee — express or implied — as to any horse's soundness, health, temperament, training level, suitability for CLIENT's intended use, future performance, value, or freedom from latent defects or vices. A horse's behavior, soundness, and suitability can change and may differ materially from what was observed during the evaluation. CLIENT assumes all risk associated with any decision to purchase, lease, ride, or handle any horse, and acknowledges that such decisions are CLIENT's own.

3. ASSUMPTION OF RISK — TRIAL RIDING AND HANDLING

Where the evaluation includes CLIENT riding, handling, or being near a horse, CLIENT acknowledges the inherent risks of equine activities, including the propensity of a horse to behave in ways that may result in injury, harm, or death, and CLIENT voluntarily assumes all such risks. An ASTM/SEI-certified riding helmet is required for all mounted activities without exception.

4. RELEASE, HOLD HARMLESS, AND INDEMNIFICATION

CLIENT, on behalf of CLIENT and CLIENT's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, releases, waives, and forever discharges COMPANY, its owners, employees, instructors, trainers, independent contractors, agents, and representatives from any and all claims, demands, losses, or damages arising out of or relating to the evaluation, the opinion provided, or CLIENT's decision to purchase, lease, ride, or handle any horse — including claims that the horse was not as evaluated or represented, and including claims arising from the ordinary negligence of the released persons. This release does not apply to gross negligence, reckless conduct, or intentional misconduct. CLIENT agrees to defend, indemnify, and hold harmless COMPANY and the released persons from any such claims brought by or on behalf of CLIENT.

5. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Waiver shall be resolved by binding arbitration in San Diego, California.

6. GOVERNING LAW

California law governs this Waiver.

7. SEVERABILITY

If any provision of this Waiver is held unenforceable, the remaining provisions remain in full force and effect.

CLIENT

Date: {{SIG.CLIENT.DATE}}
Printed Name: {{CLIENT.PRINTED_NAME}}
Signature: {{SIG.CLIENT.NAME}}
Phone: {{CLIENT.PHONE}}
Email: {{CLIENT.EMAIL}}
$FHEB$, version = version + 1, updated_at = now() WHERE template_key = 'EVALUATION_LIABILITY_WAIVER';

UPDATE contract_templates SET body = $FHEB$PARTICIPANT EMERGENCY INFORMATION AND TREATMENT AUTHORIZATION

This Emergency Information and Treatment Authorization ("Authorization") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT"), on CLIENT's own behalf and, where a minor is identified, on behalf of that minor ("PARTICIPANT"), in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). This Authorization may be used for riders, horsemanship participants, jumper training participants, visitors, contractors, volunteers, event attendees, and other individuals participating in or present for activities associated with COMPANY. By signing below, CLIENT acknowledges and agrees to the terms of this Authorization. Where no minor is identified, references to PARTICIPANT mean CLIENT.

For purposes of this Authorization, "Released Parties" means COMPANY, its owners, employees, instructors, assistant instructors, trainers, volunteers, independent contractors, agents, representatives, affiliates, property owners, facility owners, licensors, lessors, lessees, hosts, landowners, successors, assigns, heirs, and any person acting on behalf of COMPANY at any location where it is authorized to conduct business.

PARTICIPANT INFORMATION

Name: {{CLIENT.FULL_NAME}}
Date of Birth: {{CLIENT.DOB}}
Address: {{CLIENT.ADDRESS}}
Phone: {{CLIENT.PHONE}}
Email: {{CLIENT.EMAIL}}

<!-- CUT-START: MINOR_PARTICIPANT_INFO | condition: include only if PARTICIPANT is a minor -->
MINOR PARTICIPANT (IF APPLICABLE)

Name: {{PARTICIPANT.FULL_NAME}}
Date of Birth: {{PARTICIPANT.DOB}}
<!-- CUT-END: MINOR_PARTICIPANT_INFO -->

EMERGENCY CONTACT #1

Name: {{CLIENT.EMERGENCY_CONTACT_1_NAME}}
Relationship: {{CLIENT.EMERGENCY_CONTACT_1_RELATIONSHIP}}
Phone: {{CLIENT.EMERGENCY_CONTACT_1_PHONE}}

EMERGENCY CONTACT #2

Name: {{CLIENT.EMERGENCY_CONTACT_2_NAME}}
Relationship: {{CLIENT.EMERGENCY_CONTACT_2_RELATIONSHIP}}
Phone: {{CLIENT.EMERGENCY_CONTACT_2_PHONE}}

1. FIRST AID AUTHORIZATION

CLIENT authorizes COMPANY and its representatives to administer reasonable first aid and stabilizing care to CLIENT or an accompanying minor PARTICIPANT in the event of an apparent injury or medical emergency, pending the arrival of emergency medical personnel or other qualified medical care. CLIENT understands that COMPANY representatives are not medical professionals, and CLIENT, on behalf of CLIENT and CLIENT's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, and on behalf of any minor PARTICIPANT and the minor's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, releases, waives, and forever discharges the Released Parties from any claims arising from first aid or stabilizing care rendered, or decisions made, in good faith in response to an apparent emergency. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

2. EMERGENCY TREATMENT AUTHORIZATION

CLIENT authorizes COMPANY, its instructors, trainers, contractors, representatives, agents, facility operators, and emergency personnel to summon emergency medical services and to obtain emergency medical treatment for CLIENT or an accompanying minor PARTICIPANT when reasonable efforts to contact CLIENT or an emergency contact are unsuccessful or when immediate treatment is reasonably necessary.

3. NO MEDICAL SERVICES; COST RESPONSIBILITY

CLIENT understands that COMPANY is not providing medical services and is not responsible for the quality, availability, cost, or outcome of any medical treatment obtained. CLIENT agrees to be financially responsible for any medical expenses incurred on behalf of CLIENT or an accompanying minor PARTICIPANT.

<!-- CUT-START: MINOR_CONSENT_TO_TREAT | condition: append only if PARTICIPANT is a minor -->
CONSENT TO TREAT A MINOR (MINOR PARTICIPANTS ONLY)

Where a minor PARTICIPANT is identified above, CLIENT represents and warrants that CLIENT is the parent or legal guardian of the minor and has authority to execute this Authorization on the minor's behalf. CLIENT authorizes the adult representatives of COMPANY into whose care the minor has been entrusted to consent, on CLIENT's behalf, to x-ray examination, anesthetic, medical, surgical, or dental diagnosis or treatment, and hospital care, to be rendered to the minor under the general or special supervision and upon the advice of a physician, surgeon, or dentist licensed in the State of California, when CLIENT cannot be reached in a timely manner or when delay would endanger the minor. This consent remains effective until revoked by CLIENT in writing or superseded by a later executed version of this Authorization.
<!-- CUT-END: MINOR_CONSENT_TO_TREAT -->

4. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Authorization shall be resolved by binding arbitration in San Diego, California.

5. ATTORNEY'S FEES

Each party shall be required to cover their own attorney's fees and costs.

6. GOVERNING LAW

California law governs this Authorization.

7. SEVERABILITY

If any provision of this Authorization is determined to be invalid or unenforceable, the remaining provisions shall remain in full force and effect.

8. ENTIRE AGREEMENT

This Authorization contains the entire agreement concerning emergency information and treatment authorization and supplements, and does not supersede, any separate liability release or services contract between CLIENT and COMPANY.

9. ACKNOWLEDGMENT

CLIENT acknowledges that: CLIENT has carefully read this Authorization in its entirety. CLIENT understands its legal effect. CLIENT has had sufficient opportunity to ask questions before signing. CLIENT signs voluntarily and without coercion. CLIENT intends this Authorization to be binding upon CLIENT, any minor PARTICIPANT identified, and their heirs, successors, assigns, and personal representatives.

CLIENT

Date: {{SIG.CLIENT.DATE}}
Printed Name: {{CLIENT.PRINTED_NAME}}
Signature: {{SIG.CLIENT.NAME}}
Phone: {{CLIENT.PHONE}}
Email: {{CLIENT.EMAIL}}
$FHEB$, version = version + 1, updated_at = now() WHERE template_key = 'HUMAN_EMERGENCY_MEDICAL';

UPDATE contract_templates SET body = $FHEB$GENERAL LIABILITY RELEASE, ASSUMPTION OF RISK, HOLD HARMLESS & INDEMNIFICATION AGREEMENT

Effective from the Date of Signature until superseded by a later executed version of this Release

This General Liability Release, Assumption of Risk, Hold Harmless & Indemnification Agreement ("Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT"), on CLIENT's own behalf and, where a minor is identified, on behalf of that minor ("PARTICIPANT"), in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). By signing below, CLIENT acknowledges and agrees to the terms of this Agreement. Where no minor is identified, references to PARTICIPANT mean CLIENT.

For purposes of this Agreement, the term "Released Parties" means COMPANY, its owners, employees, instructors, assistant instructors, trainers, volunteers, independent contractors, agents, representatives, affiliates, property owners, facility owners, licensors, lessors, lessees, hosts, landowners, the owners, lessors, and lessees of any horse used in or present during COMPANY's activities, successors, assigns, heirs, and any person acting on behalf of COMPANY at any location where it is authorized to conduct business. This Agreement applies to any ranch, barn, arena, trail, pasture, tack room, stable, private property, leased premises, event venue, competition grounds, or other location where COMPANY conducts authorized business activities.

1. VISITOR ACKNOWLEDGEMENT

CLIENT acknowledges that CLIENT, and any accompanying minor, is voluntarily entering property where horses, livestock, equipment, vehicles, machinery, uneven terrain, and other potentially hazardous conditions may exist. CLIENT understands that merely being present at the property involves inherent risks that cannot be completely eliminated.

2. ACKNOWLEDGMENT OF INHERENT RISKS

CLIENT understands and acknowledges that risks include, but are not limited to:
Horses & Equipment:
Horses may kick, bite, buck, rear, bolt, stumble, fall, step sideways, spook, or otherwise behave unpredictably. Horses may react suddenly to people, animals, sounds, vehicles, weather, or other stimuli.
Persons present may be stepped on, struck, pinned, knocked down, or injured by horses or their equipment.
Property, Machinery & Other Equipment:
Gates, fences, trailers, tack, tools, machinery, and agricultural equipment may present hazards. Ground conditions may include mud, rocks, holes, uneven footing, irrigation, slippery surfaces, dust, and other natural hazards which may present natural or unforeseeable risks.
Additional Risks:
Risks may arise from the actions or omissions of other visitors, participants, horse owners, or third parties.
Medical Assistance:
Emergency medical assistance may not be immediately available.

3. ASSUMPTION OF RISK

CLIENT knowingly and voluntarily assumes, on CLIENT's own behalf and on behalf of any accompanying minor, all risks, whether known or unknown, foreseeable or unforeseeable, inherent or otherwise, arising from entering, remaining upon, or departing from any property where COMPANY conducts business. CLIENT accepts full personal responsibility for any injury, illness, death, property damage, or other loss that may occur.

4. PERSONAL RESPONSIBILITY AND CONDITION

CLIENT represents that: CLIENT, and any accompanying minor, is capable of safely being present on the property, or CLIENT has notified COMPANY of any condition, limitation, or circumstance requiring assistance or accommodation while on the property. CLIENT is not under the influence of alcohol, illegal drugs, or any medication that impairs judgment or physical ability, and will not remain on the property while so impaired. CLIENT is solely responsible for determining whether presence on the property is appropriate, for exercising care consistent with CLIENT's own condition and abilities, for remaining in designated visitor areas, and for supervising any accompanying minor at all times.

5. RULES AND CONDUCT AGREEMENT

CLIENT acknowledges receipt of the separately executed Property Rules, Safety Acknowledgment, and Equestrian Conduct Agreement. CLIENT agrees to read, understand, and comply with those rules at all times and to ensure any accompanying minor complies. CLIENT understands that failure to comply may result in immediate removal from the property without refund or compensation.

6. RELEASE OF LIABILITY

CLIENT, on behalf of CLIENT and CLIENT's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, and on behalf of any accompanying minor and the minor's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, voluntarily releases, waives, and forever discharges the Released Parties from any and all claims, demands, causes of action, damages, losses, liabilities, costs, expenses, or judgments arising out of or related to presence on the property, including claims arising from the ordinary negligence of the Released Parties. This release applies to bodily injury, personal injury, illness, property damage, wrongful death, emotional distress, and all other losses, whether known or unknown, including claims not known or suspected to exist at the time of signing. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

7. HOLD HARMLESS AND INDEMNIFICATION

CLIENT agrees to defend, indemnify, and hold harmless the Released Parties from and against any claims, liabilities, damages, judgments, costs, expenses, or attorney's fees arising from: CLIENT's or an accompanying minor's acts or omissions; violation of this Agreement or property rules; Claims brought by or on behalf of persons accompanying CLIENT, to the extent caused by CLIENT's conduct; or Damage to property caused by CLIENT or an accompanying minor.

8. PROPERTY DAMAGE

CLIENT accepts responsibility for any damage caused by CLIENT or an accompanying minor to horses, equipment, facilities, vehicles, buildings, or other property and agrees to reimburse the responsible party for repair or replacement costs.

9. MEDIA CONSENT

CLIENT acknowledges that photographs, video recordings, and other media may be captured during visits to, or activities at, any location where COMPANY conducts business. CLIENT grants COMPANY a perpetual, royalty-free license to use such media, including CLIENT's or an accompanying minor's name, image, and likeness, for instructional, promotional, and other lawful business purposes, without compensation. CLIENT may revoke this consent at any time by written notice via email to {{ORG.EMAIL}}; revocation is effective prospectively as to media captured after receipt of the notice.

10. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement or presence at any location where COMPANY conducts business shall be resolved by binding arbitration in San Diego, California.

11. ATTORNEY'S FEES

Each party shall be required to cover their own attorney's fees and costs.

12. GOVERNING LAW

California law governs this Agreement.

13. SEVERABILITY

If any provision of this Agreement is held unenforceable, the remaining provisions shall remain in full force and effect.

14. ENTIRE AGREEMENT

This Agreement constitutes the entire understanding between the parties concerning the subject matter herein and supersedes any prior oral or written representations regarding this subject.

15. ACKNOWLEDGMENT

CLIENT acknowledges that: This Agreement is legally binding. CLIENT has carefully read the entire Agreement. CLIENT understands its contents. CLIENT has had the opportunity to ask questions before signing. CLIENT signs voluntarily and without coercion.

CLIENT

Date: {{SIG.CLIENT.DATE}}
Printed Name: {{CLIENT.PRINTED_NAME}}
Signature: {{SIG.CLIENT.NAME}}
Phone: {{CLIENT.PHONE}}
Email: {{CLIENT.EMAIL}}

<!-- CUT-START: MINOR_PARTICIPANT | condition: append only if a minor accompanies CLIENT -->
MINOR (IF APPLICABLE)

Minor's Name: {{PARTICIPANT.FULL_NAME}}
Date of Birth: {{PARTICIPANT.DOB}}

Where a minor is identified above, CLIENT certifies that CLIENT is the parent or legal guardian of the minor and has authority to sign this Agreement on the minor's behalf, consents to the minor's presence on the property, and agrees to the release of liability, assumption of risk, hold harmless, and indemnification provisions both on CLIENT's own behalf, including as to any claims CLIENT may hold individually arising from the minor's presence or activities, and on behalf of the minor.
<!-- CUT-END: MINOR_PARTICIPANT -->
$FHEB$, version = version + 1, updated_at = now() WHERE template_key = 'RELEASE_GENERAL';

UPDATE contract_templates SET body = $FHEB$PARTICIPANT LIABILITY RELEASE, ASSUMPTION OF RISK, HOLD HARMLESS & INDEMNIFICATION AGREEMENT

Effective from the Date of Signature until superseded by a later executed version of this Release

This Participant Liability Release, Assumption of Risk, Hold Harmless & Indemnification Agreement ("Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT"), on CLIENT's own behalf and, where a minor participant is identified, on behalf of that minor ("PARTICIPANT"), in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). By signing below, CLIENT acknowledges and agrees to the terms of this Agreement. Where no minor is identified, CLIENT is the participant and references to PARTICIPANT mean CLIENT.

For purposes of this Agreement, "Released Parties" means COMPANY, its owners, employees, instructors, assistant instructors, trainers, volunteers, independent contractors, agents, representatives, affiliates, property owners, facility owners, licensors, lessors, lessees, hosts, landowners, the owners, lessors, and lessees of any horse used in or present during COMPANY's activities, successors, assigns, heirs, and any person acting on behalf of COMPANY at any location where it is authorized to conduct business.

This Agreement applies at any ranch, barn, arena, stable, tack room, trail, private property, leased premises, event venue, show grounds, or other location where COMPANY conducts authorized business.

1. PARTICIPATION

PARTICIPANT voluntarily elects to engage in equestrian and related activities offered, supervised, or conducted by COMPANY, including but not limited to: Riding lessons, Mounted instruction, Unmounted instruction, Horse handling, Grooming, Tacking and untacking, Leading horses, Groundwork, Lunging, Round pen work, Arena work, Trail riding, Clinics, Camps, Horse exercise, Assisting instructors, Educational demonstrations, Walking, trotting, cantering, galloping, jumping, cavaletti, conditioning, and training, and any other equestrian activity authorized by COMPANY.

2. ACKNOWLEDGMENT OF INHERENT RISKS

PARTICIPANT understands that equestrian activities are inherently dangerous and involve risks that cannot be eliminated, including but not limited to: Falls from horses. Horses kicking, biting, bucking, bolting, rearing, stumbling, spooking, striking, stepping on, or crushing persons. Tack or equipment failure. Collisions with horses, people, fences, gates, jumps, vehicles, or other objects. Uneven terrain, dust, mud, rocks, holes, water crossings, weather conditions, and natural hazards. Mistakes in judgment by riders or participants. Actions or omissions of other participants or third parties. Risks specific to jumping activities, including but not limited to: a horse refusing, stopping suddenly at, or running out from a jump; falls at speed; rotational falls in which the horse falls with or onto the rider; striking or displacing rails, standards, or other jump components; loss of balance or unseating on takeoff or landing; and injury severity greater than that associated with flatwork. Serious bodily injury, paralysis, permanent disability, or death. PARTICIPANT acknowledges that no amount of training, supervision, instruction, or protective equipment can eliminate every risk associated with equestrian activities.

3. ASSUMPTION OF RISK

PARTICIPANT knowingly and voluntarily assumes all inherent and ordinary risks associated with horses, equestrian activities, transportation to and from activities not provided by COMPANY, use of equipment, and participation at any facility where COMPANY conducts business. PARTICIPANT accepts full responsibility for any injury, illness, emotional distress, disability, death, property damage, or other loss arising from participation.

4. HEALTH, FITNESS, AND CAPACITY

PARTICIPANT represents and warrants that: PARTICIPANT is in good physical and mental health. PARTICIPANT is capable of safely participating in equestrian activities. PARTICIPANT is not impaired by alcohol, illegal drugs, or medication affecting judgment or coordination, and will not participate in any activity while so impaired. PARTICIPANT has no medical condition, injury, disability, or restriction that would create an unreasonable risk of harm to themselves or others. PARTICIPANT has disclosed any relevant medical conditions that could reasonably affect safe participation. PARTICIPANT accepts full responsibility for monitoring their own physical condition and will immediately stop participating if they believe continued participation would be unsafe. Where this Agreement is signed for a minor PARTICIPANT, CLIENT makes these representations to the best of CLIENT's knowledge.

5. SAFETY EQUIPMENT AND INSTRUCTION

PARTICIPANT agrees to: Follow all instructions given by COMPANY personnel. Use required safety equipment when directed. Immediately report unsafe conditions, damaged equipment, or injuries. Exercise reasonable care while around horses and other participants. PARTICIPANT understands that wearing a riding helmet or other protective equipment reduces, but does not eliminate, the risk of injury.

6. RULES AND CONDUCT AGREEMENT

PARTICIPANT acknowledges receipt of the separately executed Property Rules, Safety Acknowledgment, and Equestrian Conduct Agreement. PARTICIPANT agrees to read, understand, comply with, and ensure any accompanying minor complies with those rules at all times. PARTICIPANT understands that failure to comply may result in suspension or termination of participation without refund.

7. RELEASE OF LIABILITY

CLIENT, on CLIENT's own behalf and on behalf of CLIENT's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, and on behalf of any minor PARTICIPANT and the minor's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, releases, waives, and forever discharges the Released Parties from any and all claims, demands, causes of action, liabilities, damages, losses, costs, expenses, or judgments arising out of or relating to PARTICIPANT's involvement in equestrian activities, including claims arising from the ordinary negligence of the Released Parties. This release applies to claims involving bodily injury, illness, emotional distress, disability, death, property damage, loss of income, and any other damages, whether known or unknown, including claims CLIENT or PARTICIPANT does not know or suspect to exist at the time of signing. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

8. HOLD HARMLESS & INDEMNIFICATION

CLIENT agrees to defend, indemnify, and hold harmless the Released Parties from and against any claims, liabilities, damages, judgments, costs, expenses, and reasonable attorney's fees arising from: PARTICIPANT's acts or omissions; PARTICIPANT's failure to follow instructions or facility rules; Damage caused by PARTICIPANT to horses, equipment, facilities, or property; or Claims brought by third parties resulting from PARTICIPANT's conduct.

9. MEDIA CONSENT

CLIENT acknowledges that photographs, video recordings, and other media may be captured during visits to, or activities at, any location where COMPANY conducts business. CLIENT grants COMPANY a perpetual, royalty-free license to use such media, including CLIENT's or the minor PARTICIPANT's name, image, and likeness, for instructional, promotional, and other lawful business purposes, without compensation. CLIENT may revoke this consent at any time by written notice via email to {{ORG.EMAIL}}; revocation is effective prospectively as to media captured after receipt of the notice.

10. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement or PARTICIPANT's involvement in COMPANY activities shall be resolved by binding arbitration in San Diego, California.

11. ATTORNEY'S FEES

Each party shall be required to cover their own attorney's fees and costs.

12. GOVERNING LAW

California law governs this Agreement.

13. SEVERABILITY

If any provision of this Agreement is determined to be unenforceable, the remaining provisions shall remain in full force and effect.

14. ENTIRE AGREEMENT

This Agreement constitutes the complete agreement between the parties concerning PARTICIPANT's involvement in activities conducted by COMPANY and supersedes all prior discussions or understandings regarding its subject matter.

15. ACKNOWLEDGMENT

CLIENT acknowledges that: This Agreement contains important legal rights. CLIENT has carefully read and understands the entire Agreement. CLIENT has had the opportunity to ask questions before signing. CLIENT understands they are assuming substantial risks associated with equestrian activities on CLIENT's own behalf and, where applicable, on behalf of a minor PARTICIPANT. CLIENT signs voluntarily and without coercion. CLIENT intends this Agreement to be binding upon CLIENT, any minor PARTICIPANT, and their heirs, successors, assigns, and personal representatives.

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

Where a minor PARTICIPANT is identified above, CLIENT certifies that CLIENT is the parent or legal guardian of the minor and has authority to execute this Agreement on the minor's behalf, consents to the minor's participation in equestrian activities, and agrees to the release of liability, assumption of risk, hold harmless, and indemnification provisions both on CLIENT's own behalf, including as to any claims CLIENT may hold individually arising from the minor's participation, and on behalf of the minor.
<!-- CUT-END: MINOR_PARTICIPANT -->
$FHEB$, version = version + 1, updated_at = now() WHERE template_key = 'RELEASE_PARTICIPANT';

UPDATE contract_templates SET body = replace(body, $FO$CLIENT releases, waives, and forever discharges the Released Parties from claims arising from good-faith actions taken under this Agreement. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.$FO$, $FN$CLIENT, on behalf of CLIENT and CLIENT's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, releases, waives, and forever discharges the Released Parties from claims arising from good-faith actions taken under this Agreement. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.$FN$), version = version + 1, updated_at = now() WHERE template_key = 'HORSE_EMERGENCY_VET';

UPDATE contract_templates SET body = replace(body, $FO$CLIENT releases, waives, and forever discharges the Released Parties from any and all claims, demands, causes of action, liabilities, damages, losses, expenses, costs, or judgments arising out of or relating to: Handling the Horse; Riding, exercising, schooling, or training the Horse; Providing instruction involving the Horse; Grooming, clipping, and husbandry activities; Authorized routine care described in this Agreement; Temporary emergency stabilization; Decisions made in good faith regarding the Horse's care within the scope of this authorization; and Any injury, illness, death, escape, or property damage involving the Horse or persons interacting with the Horse, including claims arising from the ordinary negligence of the Released Parties. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.$FO$, $FN$CLIENT, on behalf of CLIENT and CLIENT's heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns, releases, waives, and forever discharges the Released Parties from any and all claims, demands, causes of action, liabilities, damages, losses, expenses, costs, or judgments arising out of or relating to: Handling the Horse; Riding, exercising, schooling, or training the Horse; Providing instruction involving the Horse; Grooming, clipping, and husbandry activities; Authorized routine care described in this Agreement; Temporary emergency stabilization; Decisions made in good faith regarding the Horse's care within the scope of this authorization; and Any injury, illness, death, escape, or property damage involving the Horse or persons interacting with the Horse, including claims arising from the ordinary negligence of the Released Parties. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.$FN$), version = version + 1, updated_at = now() WHERE template_key = 'RELEASE_HORSE_CARE';

DO $$
DECLARE k text; b text;
BEGIN
  FOREACH k IN ARRAY ARRAY['EVALUATION_LIABILITY_WAIVER','HUMAN_EMERGENCY_MEDICAL','RELEASE_GENERAL','RELEASE_PARTICIPANT','HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE'] LOOP
    SELECT body INTO b FROM contract_templates WHERE template_key = k;
    IF b NOT LIKE '%heirs, next of kin, estate, executors, administrators, legal representatives, successors, and assigns%' THEN
      RAISE EXCEPTION 'signer-side binding missing in %', k;
    END IF;
  END LOOP;
  SELECT body INTO b FROM contract_templates WHERE template_key='RELEASE_GENERAL';
  IF b NOT LIKE '%the owners, lessors, and lessees of any horse used in or present during COMPANY''s activities%' THEN
    RAISE EXCEPTION 'RELEASE_GENERAL horse-owners definition missing';
  END IF;
  SELECT body INTO b FROM contract_templates WHERE template_key='EVALUATION_LIABILITY_WAIVER';
  IF b NOT LIKE '%5. DISPUTE RESOLUTION%' OR b NOT LIKE '%6. GOVERNING LAW%' OR b NOT LIKE '%7. SEVERABILITY%' OR b LIKE '%5. SEVERABILITY%' THEN
    RAISE EXCEPTION 'EVALUATION waiver section rebuild/renumber wrong';
  END IF;
  -- July-14 live features preserved on the drifted pair
  FOREACH k IN ARRAY ARRAY['HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE'] LOOP
    SELECT body INTO b FROM contract_templates WHERE template_key = k;
    IF b NOT LIKE '%COVERAGE EXTENSION%' OR b NOT LIKE '%{{HORSE.FAIR_MARKET_VALUE}}%' THEN
      RAISE EXCEPTION 'July-14 live features lost in %', k;
    END IF;
  END LOOP;
  SELECT body INTO b FROM contract_templates WHERE template_key='HORSE_EMERGENCY_VET';
  IF b NOT LIKE '%{{HORSE.EUTHANASIA_A}}%' THEN
    RAISE EXCEPTION 'euthanasia election lost';
  END IF;
END $$;

COMMIT;
