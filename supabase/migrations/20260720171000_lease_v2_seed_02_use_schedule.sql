/*
  # Lease v2 seed — Part 2: Representations, Evaluation, Term, Use & Schedule (ELS §4-9)

  Second slice of the ELS-faithful clause seed, under template_key HORSE_LEASE_V2.
  Continues the PATTERN established in part 1 (20260720170000):

    contract_section_defs  — one row per numbered section
    contract_clause_defs   — one row per clause; body carries {{TOKENS}}, guidance
                             carries the ELS definition as an always-available hint;
                             conditional_on gates a clause on an earlier field value
    contract_field_defs    — one row per input, selection-first, with options

  Part 1 already ran the delete-then-insert for this template_key; this part ONLY
  inserts. It must run AFTER part 1. Section sort_order continues at 40-90.
*/

-- ── SECTIONS (this part: 4-9) ───────────────────────────────────────────────
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES
  ('HORSE_LEASE_V2','LESSEE_REPS',  'Lessee''s Representations',      40),
  ('HORSE_LEASE_V2','EVALUATION',   'Evaluation Period',             50),
  ('HORSE_LEASE_V2','TERM',         'Agreement Term',                60),
  ('HORSE_LEASE_V2','PERMITTED_USE','Permitted Use(s) of Horse',     70),
  ('HORSE_LEASE_V2','SHARED_USE',   'Shared Usage',                  80),
  ('HORSE_LEASE_V2','SCHEDULE',     'Schedule for Lessee''s Usage',  90);

-- ── CLAUSES ─────────────────────────────────────────────────────────────────
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance, conditional_on) VALUES
  -- §4 Lessee's Representations
  ('HORSE_LEASE_V2','LESSEE_REPS','LESSEE_REPS.MAIN',NULL,
    E'Lessee represents and warrants that Lessee is at least 18 years of age and has full authority to enter into this Agreement; that Lessee has no physical or mental condition that would prevent Lessee from safely participating in the activities contemplated by this Agreement; and that Lessee has the requisite knowledge and experience to handle and ride Horse, and will use reasonable care in doing so and follow Owner''s instructions.',
    'prose', 10, 'Lessee''s baseline promises: age of majority, authority, fitness to participate, and competence to handle the horse.', NULL),

  -- §5 Evaluation Period
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.CHOICE','Evaluation Period',
    E'Evaluation period: {{TXN.EVALUATION_ENABLED}}.',
    'choice', 10, 'An optional trial window at the start of the lease during which either party may end the arrangement.', NULL),
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.DATES','Evaluation Dates',
    E'Lessee shall have an evaluation period beginning {{TXN.EVALUATION_START}} and ending {{TXN.EVALUATION_END}}. All terms of this Agreement apply during the evaluation period. During the evaluation period, either party may terminate this Agreement for any reason upon notice to the other party.',
    'input', 20, 'The trial window runs under the full terms of the lease; either party can walk away during it.',
    '{"field_key":"TXN.EVALUATION_ENABLED","equals":["ENABLED"]}'::jsonb),

  -- §6 Agreement Term
  ('HORSE_LEASE_V2','TERM','TERM.MAIN','Agreement Term',
    E'Term of this Agreement: {{TXN.LEASE_TERM_TYPE}}. This Agreement begins on {{TXN.LEASE_START}} and continues until {{TXN.LEASE_END}}.',
    'input', 10, 'How long the lease runs. A fixed period has a set end date; an open-ended lease continues until terminated.', NULL),
  ('HORSE_LEASE_V2','TERM','TERM.RENEWAL','Renewal and Other Terms',
    E'Additional term details: {{TXN.RENEWAL_TERMS}}.',
    'input', 20, 'Any renewal, extension, or other term arrangement not covered by a simple start and end date.',
    '{"field_key":"TXN.LEASE_TERM_TYPE","equals":["OTHER"]}'::jsonb),
  ('HORSE_LEASE_V2','TERM','TERM.TERMINATION_XREF',NULL,
    E'Notwithstanding the term stated above, this Agreement may be terminated earlier as provided in the Termination section of this Agreement.',
    'prose', 30, NULL, NULL),

  -- §7 Permitted Use(s) of Horse
  ('HORSE_LEASE_V2','PERMITTED_USE','PERMITTED_USE.MAIN','Permitted Use(s)',
    E'Owner grants Lessee the right to use Horse for the following purpose(s): {{TXN.PERMITTED_ACTIVITIES}}. Lessee shall not use Horse for any other purpose without Owner''s prior written consent.',
    'input', 10, 'Check every activity Lessee is allowed to use the horse for. Any use not checked requires the Owner''s written consent.', NULL),

  -- §8 Shared Usage
  ('HORSE_LEASE_V2','SHARED_USE','SHARED_USE.MAIN','Shared Usage',
    E'This is a partial lease. Lessee shares use of Horse with: {{TXN.SHARED_WITH}}. Details: {{TXN.SHARED_WITH_NAMES}}.',
    'input', 10, 'A partial lease means the horse''s use is shared. Identify who else uses the horse during the lease term.', NULL),

  -- §9 Schedule for Lessee's Usage
  ('HORSE_LEASE_V2','SCHEDULE','SCHEDULE.MAIN','Schedule for Lessee''s Usage',
    E'Lessee''s usage schedule: {{TXN.SCHEDULE_TYPE}}. Days of the week reserved for Lessee''s use: {{TXN.DAYS_USED}}.',
    'input', 10, 'When Lessee may use the horse. Pick a schedule type, and mark specific days on the grid where applicable.', NULL),
  ('HORSE_LEASE_V2','SCHEDULE','SCHEDULE.CARE_DUTY','Lessee''s Responsibility for Care and Exercise',
    E'Lessee''s scheduled use of Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to Horse''s health and wellbeing. If Lessee regularly fails to use and care for Horse as scheduled, Owner may terminate this Agreement. If Lessee is unable to use or care for Horse on a scheduled day, Lessee shall notify Owner at least 24 hours in advance so that Owner can arrange for Horse''s care.',
    'prose', 20, 'The lease schedule carries a duty of consistent care; 24 hours'' notice is required if Lessee cannot make a scheduled day.', NULL);

-- ── FIELDS (clause_key links each input to its clause) ───────────────────────
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance, responsibility_kind) VALUES
  -- §5 Evaluation Period
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.CHOICE','TXN.EVALUATION_ENABLED','Evaluation period','DEAL','select','select','select',
     '[{"value":"DISABLED","label":"No evaluation period"},{"value":"ENABLED","label":"Evaluation period required"}]'::jsonb,
     true,10,'Whether the lease starts with a trial window.',NULL),
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.DATES','TXN.EVALUATION_START','Evaluation start date','DEAL','date','date','date',NULL,false,10,NULL,NULL),
  ('HORSE_LEASE_V2','EVALUATION','EVALUATION.DATES','TXN.EVALUATION_END','Evaluation end date','DEAL','date','date','date',NULL,false,20,NULL,NULL),

  -- §6 Agreement Term
  ('HORSE_LEASE_V2','TERM','TERM.MAIN','TXN.LEASE_TERM_TYPE','Term type','DEAL','select','select','select',
     '[{"value":"FIXED","label":"Fixed period"},{"value":"OPEN_ENDED","label":"Open-ended"},{"value":"OTHER","label":"Other"}]'::jsonb,
     true,10,'A fixed period ends on a set date; an open-ended lease continues until either party terminates it.',NULL),
  ('HORSE_LEASE_V2','TERM','TERM.MAIN','TXN.LEASE_START','Lease start date','DEAL','date','date','date',NULL,true,20,NULL,NULL),
  ('HORSE_LEASE_V2','TERM','TERM.MAIN','TXN.LEASE_END','Lease end date','DEAL','date','date','date',NULL,false,30,'Leave blank for an open-ended lease.',NULL),
  ('HORSE_LEASE_V2','TERM','TERM.RENEWAL','TXN.RENEWAL_TERMS','Renewal / other term details','DEAL','longtext','longtext','longtext',NULL,false,10,'Describe any renewal, extension, or other arrangement.',NULL),

  -- §7 Permitted Use(s) of Horse
  ('HORSE_LEASE_V2','PERMITTED_USE','PERMITTED_USE.MAIN','TXN.PERMITTED_ACTIVITIES','Permitted activities','DEAL','checkbox','buttons','buttons',
     '[{"value":"RECREATIONAL","label":"Recreational riding"},{"value":"TRAIL","label":"Trail riding"},{"value":"COMPETITION","label":"Show or competition"},{"value":"4H","label":"4-H project"},{"value":"LESSONS","label":"Lessons"},{"value":"TURNOUT","label":"Turnout"}]'::jsonb,
     true,10,'Select every purpose Lessee may use the horse for. Selecting "Show or competition" enables the Competitions section.',NULL),

  -- §8 Shared Usage
  ('HORSE_LEASE_V2','SHARED_USE','SHARED_USE.MAIN','TXN.SHARED_WITH','Shared with','DEAL','checkbox','buttons','buttons',
     '[{"value":"OWNER","label":"Owner"},{"value":"OTHER_LESSEES","label":"Other lessees"}]'::jsonb,
     false,10,'Who else uses the horse during the lease term.',NULL),
  ('HORSE_LEASE_V2','SHARED_USE','SHARED_USE.MAIN','TXN.SHARED_WITH_NAMES','Names / specifics','DEAL','text','text','text',NULL,false,20,'Names of the other people who share use of the horse, if known.',NULL),

  -- §9 Schedule for Lessee's Usage
  ('HORSE_LEASE_V2','SCHEDULE','SCHEDULE.MAIN','TXN.SCHEDULE_TYPE','Schedule type','DEAL','select','select','select',
     '[{"value":"SPECIFIC_DAYS","label":"Specific days of week"},{"value":"N_PER_WEEK","label":"N days per week by agreement"},{"value":"N_PER_MONTH","label":"N days per month by agreement"},{"value":"AS_AGREED","label":"As mutually agreed"},{"value":"OTHER","label":"Other"}]'::jsonb,
     true,10,'How Lessee''s usage days are set.',NULL),
  ('HORSE_LEASE_V2','SCHEDULE','SCHEDULE.MAIN','TXN.DAYS_USED','Days reserved for Lessee','DEAL','text','week_grid','week_grid',NULL,false,20,'Mark the days of the week reserved for Lessee''s use (applies when the schedule is specific days).',NULL);
