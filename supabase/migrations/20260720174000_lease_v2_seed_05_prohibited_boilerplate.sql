/*
  # Lease v2 seed — Part 5: Prohibited Activities → Boilerplate (ELS §17-25 + Signatures)

  Continues the ELS-faithful clause seed under template_key HORSE_LEASE_V2,
  following the PATTERN established in Part 1
  (20260720170000_lease_v2_seed_01_parties_horse.sql):

    contract_section_defs  — one row per numbered section
    contract_clause_defs   — one row per clause; body carries {{TOKENS}}, guidance
                             carries the ELS definition as an always-available hint
    contract_field_defs    — one row per input, selection-first, with options

  This part covers §17 Prohibited Activities, §18 Competitions (whole section
  gated on Competition being a permitted use), §19 Termination, §20 Notice,
  §21 Assignment, §22 Entire Agreement, §23 Governing Law and Venue,
  §24 Attorneys' Fees, §25 Severability, and the Signature block.

  §23 and §24 are transcribed as the ELS reads (governing-state / venue
  fill-in and prevailing-party fee recovery) — NOT substituted with
  arbitration or a "each party bears its own fees" clause.

  Part 1 performed the DELETE for this template_key; this part only INSERTs.
*/

-- ── SECTIONS (this part: 17-25 + signatures) ────────────────────────────────
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES
  ('HORSE_LEASE_V2','PROHIBITED',      'Prohibited Activities',    170),
  ('HORSE_LEASE_V2','COMPETITIONS',    'Competitions',             180),
  ('HORSE_LEASE_V2','TERMINATION',     'Termination',              190),
  ('HORSE_LEASE_V2','NOTICE',          'Notice',                   200),
  ('HORSE_LEASE_V2','ASSIGNMENT',      'Assignment or Transfer',   210),
  ('HORSE_LEASE_V2','ENTIRE_AGREEMENT','Entire Agreement',         220),
  ('HORSE_LEASE_V2','GOVERNING_LAW',   'Governing Law and Venue',  230),
  ('HORSE_LEASE_V2','ATTORNEYS_FEES',  'Attorneys'' Fees',         240),
  ('HORSE_LEASE_V2','SEVERABILITY',    'Severability',             250),
  ('HORSE_LEASE_V2','SIGNATURES',      'Signatures',               260);

-- ── CLAUSES ─────────────────────────────────────────────────────────────────
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance, conditional_on) VALUES
  -- §17 Prohibited Activities
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.REMOVAL','Removal from Premises',
    E'Lessee may take Horse off the premises where Horse is kept only for the following activities: {{TXN.REMOVAL_ALLOWED}}. Otherwise, Lessee shall not remove Horse from the premises without Owner''s prior written authorization.',
    'input', 10, 'The activities for which the Lessee may take the horse off the premises without asking the Owner each time.', NULL),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.OTHERS','Allowing Others to Ride',
    E'Only the following persons may ride or handle Horse without Owner''s prior permission: {{TXN.OTHERS_ALLOWED}}. No other person shall be permitted to ride or handle Horse without Owner''s permission.',
    'input', 20, 'Who besides the Lessee may ride or handle the horse without asking the Owner.', NULL),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMPING','Jumping',
    E'Jumping: {{TXN.JUMPING_ALLOWED}}.',
    'input', 30, 'Whether the Lessee may jump the horse, and any restrictions that apply.', NULL),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMP_RESTRICTIONS','Jumping Restrictions',
    E'If jumping is permitted with restrictions, the following apply: maximum height {{TXN.JUMP_MAX_HEIGHT}}; no more than {{TXN.JUMP_DAYS_PER_WEEK}} days per week; under trainer supervision only: {{TXN.JUMP_SUPERVISION}}.',
    'input', 40, 'The limits on jumping, if it is permitted with restrictions.', '{"field_key":"TXN.JUMPING_ALLOWED","equals":["RESTRICTED"]}'::jsonb),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.OTHER','Other Prohibited Activities',
    E'Lessee shall not engage in the following activities with Horse: {{TXN.OTHER_PROHIBITED}}.',
    'input', 50, 'Any additional activities the Owner wishes to prohibit.', NULL),

  -- §18 Competitions — WHOLE SECTION gated on Competition being a permitted use
  ('HORSE_LEASE_V2','COMPETITIONS','COMPETITIONS.INTRO','Competitions',
    E'With Owner''s prior written permission, Lessee may enter Horse in competitions, shows, or other events.',
    'prose', 10, 'Whether and on what terms the Lessee may compete on the horse.', '{"field_key":"TXN.PERMITTED_ACTIVITIES","contains":["COMPETITION"]}'::jsonb),
  ('HORSE_LEASE_V2','COMPETITIONS','COMPETITIONS.TERMS','Competition Expenses and Winnings',
    E'Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}. Any prize money or winnings earned in competition shall belong to: {{TXN.COMPETITION_WINNINGS}}.',
    'input', 20, 'Who pays competition expenses, and who keeps any winnings.', '{"field_key":"TXN.PERMITTED_ACTIVITIES","contains":["COMPETITION"]}'::jsonb),

  -- §19 Termination
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.LESSEE','Lessee''s Right to Terminate',
    E'Lessee may terminate this Agreement by giving Owner at least {{TXN.LESSEE_TERM_NOTICE_DAYS}} days'' prior written notice.',
    'input', 10, 'How much notice the Lessee must give to end the lease early.', NULL),
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.OWNER','Owner''s Right to Terminate',
    E'Owner may terminate this Agreement by giving Lessee at least {{TXN.OWNER_TERM_NOTICE_DAYS}} days'' prior written notice.',
    'input', 20, 'How much notice the Owner must give to end the lease early.', NULL),
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.CAUSE','Termination for Cause',
    E'Either party may terminate this Agreement for cause (including a material breach that remains uncured) by giving the other party at least {{TXN.CAUSE_TERM_NOTICE_DAYS}} days'' prior written notice.',
    'input', 30, 'Notice period for terminating because the other party is in breach.', NULL),
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.LOSS','Termination upon Loss or Injury',
    E'Either party may terminate this Agreement immediately, upon notice to the other party, if Horse is significantly injured, becomes seriously ill, or dies.',
    'prose', 40, NULL, NULL),

  -- §20 Notice (prose only; addresses auto-fill)
  ('HORSE_LEASE_V2','NOTICE','NOTICE.FORM','Form of Notice',
    E'Any notice required or permitted under this Agreement shall be in writing and delivered by a method that provides evidence of receipt. Notice by email is not effective unless the receiving party acknowledges receipt.',
    'prose', 10, NULL, NULL),
  ('HORSE_LEASE_V2','NOTICE','NOTICE.LESSEE_ADDRESS','Notice to Lessee',
    E'Notice to Lessee shall be sent to: {{LESSEE.ADDRESS}}.',
    'prose', 20, NULL, NULL),
  ('HORSE_LEASE_V2','NOTICE','NOTICE.LESSOR_ADDRESS','Notice to Owner',
    E'Notice to Owner shall be sent to: {{LESSOR.ADDRESS}}.',
    'prose', 30, NULL, NULL),
  ('HORSE_LEASE_V2','NOTICE','NOTICE.CHANGES','Changes in Contact Information',
    E'Each party shall promptly notify the other party in writing of any change in the party''s address or contact information.',
    'prose', 40, NULL, NULL),

  -- §21 Assignment or Transfer
  ('HORSE_LEASE_V2','ASSIGNMENT','ASSIGNMENT.NO_ASSIGN','Assignment or Transfer',
    E'Lessee shall not assign, sublease, or otherwise transfer this Agreement or any of Lessee''s rights or obligations under it without Owner''s prior written consent.',
    'prose', 10, NULL, NULL),

  -- §22 Entire Agreement
  ('HORSE_LEASE_V2','ENTIRE_AGREEMENT','ENTIRE_AGREEMENT.INTEGRATION','Entire Agreement',
    E'This Agreement contains the entire agreement between the parties with respect to its subject matter and supersedes all prior discussions and understandings. Any modification of this Agreement must be in writing and signed by all parties.',
    'prose', 10, NULL, NULL),

  -- §23 Governing Law and Venue (transcribed as ELS — state/county fill-in)
  ('HORSE_LEASE_V2','GOVERNING_LAW','GOVERNING_LAW.CHOICE','Governing Law and Venue',
    E'This Agreement shall be governed by the laws of {{TXN.GOVERNING_STATE}}. Any legal action must be brought in {{TXN.VENUE_COUNTY}} County, {{TXN.VENUE_STATE}}.',
    'input', 10, 'The state whose law governs the lease, and the county and state where any lawsuit must be filed.', NULL),

  -- §24 Attorneys' Fees (transcribed as ELS — prevailing party recovers fees)
  ('HORSE_LEASE_V2','ATTORNEYS_FEES','ATTORNEYS_FEES.PREVAILING','Attorneys'' Fees',
    E'In the event of any dispute arising out of this Agreement, the prevailing party shall be entitled to prompt payment from the other party of its expenses of enforcement, including reasonable attorneys'' fees, court costs, and other costs of collection.',
    'prose', 10, NULL, NULL),

  -- §25 Severability
  ('HORSE_LEASE_V2','SEVERABILITY','SEVERABILITY.SAVING','Severability',
    E'If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect, and the invalid or unenforceable provision shall be deemed modified to the minimum extent necessary to make it valid and enforceable.',
    'prose', 10, NULL, NULL),

  -- Signature block
  ('HORSE_LEASE_V2','SIGNATURES','SIGNATURES.BLOCK','Signatures',
    E'IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.\nLessee: {{SIG.LESSEE.NAME}}  Date: {{SIG.LESSEE.DATE}}\nOwner: {{SIG.LESSOR.NAME}}  Date: {{SIG.LESSOR.DATE}}',
    'prose', 10, NULL, NULL);

-- ── FIELDS (clause_key links each input to its clause) ───────────────────────
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance) VALUES
  -- §17 Prohibited Activities
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.REMOVAL','TXN.REMOVAL_ALLOWED','Removal permitted for','DEAL','checkbox','buttons','buttons',
     '[{"value":"TRAIL_RIDE","label":"Trail ride"},{"value":"COMPETITION","label":"Competition (agreed)"},{"value":"EMERGENCY_VET","label":"Emergency vet"},{"value":"LESSONS_NAMED_TRAINER","label":"Lessons with named trainer"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Select the activities for which the Lessee may take the horse off the premises without written authorization.'),

  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.OTHERS','TXN.OTHERS_ALLOWED','Others allowed to ride','DEAL','checkbox','buttons','buttons',
     '[{"value":"FAMILY","label":"Lessee''s family members"},{"value":"TRAINER","label":"The trainer/instructor"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Select who besides the Lessee may ride or handle the horse without the Owner''s permission.'),

  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMPING','TXN.JUMPING_ALLOWED','Jumping','DEAL','select','select','select',
     '[{"value":"NOT_PERMITTED","label":"Not permitted"},{"value":"RESTRICTED","label":"Permitted with restrictions"}]'::jsonb,
     false,10,'Whether the Lessee may jump the horse.'),

  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMP_RESTRICTIONS','TXN.JUMP_MAX_HEIGHT','Maximum height','DEAL','text','text','text',NULL,false,10,'e.g. max feet.'),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMP_RESTRICTIONS','TXN.JUMP_DAYS_PER_WEEK','Days per week','DEAL','number','number','number',NULL,false,20,NULL),
  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.JUMP_RESTRICTIONS','TXN.JUMP_SUPERVISION','Only under trainer supervision?','DEAL','select','yesno','yesno',NULL,false,30,NULL),

  ('HORSE_LEASE_V2','PROHIBITED','PROHIBITED.OTHER','TXN.OTHER_PROHIBITED','Other prohibited activities','DEAL','checkbox','buttons','buttons',
     '[{"value":"BREEDING","label":"Breeding"},{"value":"STABLING_NEAR_VICES","label":"Stabling near horses with vices"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Select any additional activities the Owner wishes to prohibit.'),

  -- §18 Competitions (both fields gated on Competition being a permitted use)
  ('HORSE_LEASE_V2','COMPETITIONS','COMPETITIONS.TERMS','TXN.COMPETITION_EXPENSES','Competition expenses','DEAL','select','select','select',
     '[{"value":"LESSEE","label":"Paid by Lessee"},{"value":"OWNER","label":"Paid by Owner"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Who pays the expenses of competing.'),
  ('HORSE_LEASE_V2','COMPETITIONS','COMPETITIONS.TERMS','TXN.COMPETITION_WINNINGS','Competition winnings','DEAL','select','select','select',
     '[{"value":"LESSEE","label":"Lessee"},{"value":"OWNER","label":"Owner"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,20,'Who keeps any prize money or winnings.'),

  -- §19 Termination
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.LESSEE','TXN.LESSEE_TERM_NOTICE_DAYS','Days notice','DEAL','number','number','number',NULL,false,10,'Days of notice the Lessee must give to terminate.'),
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.OWNER','TXN.OWNER_TERM_NOTICE_DAYS','Days notice','DEAL','number','number','number',NULL,false,10,'Days of notice the Owner must give to terminate.'),
  ('HORSE_LEASE_V2','TERMINATION','TERMINATION.CAUSE','TXN.CAUSE_TERM_NOTICE_DAYS','Days notice','DEAL','number','number','number',NULL,false,10,'Days of notice required to terminate for cause.'),

  -- §23 Governing Law and Venue
  ('HORSE_LEASE_V2','GOVERNING_LAW','GOVERNING_LAW.CHOICE','TXN.GOVERNING_STATE','Governing state','DEAL','text','text','text',NULL,false,10,'The state whose law governs this Agreement.'),
  ('HORSE_LEASE_V2','GOVERNING_LAW','GOVERNING_LAW.CHOICE','TXN.VENUE_COUNTY','Venue county','DEAL','text','text','text',NULL,false,20,'The county where any legal action must be brought.'),
  ('HORSE_LEASE_V2','GOVERNING_LAW','GOVERNING_LAW.CHOICE','TXN.VENUE_STATE','Venue state','DEAL','text','text','text',NULL,false,30,'The state where any legal action must be brought.');
