/*
  # Lease v2 seed — Part 3: Fee, Location, Training & Lessons, Care of Horse (ELS §10-13)

  Third slice of the ELS-faithful clause seed, under template_key HORSE_LEASE_V2.
  Continues the PATTERN established in parts 1-2 (20260720170000, 20260720171000):

    contract_section_defs  — one row per numbered section
    contract_clause_defs   — one row per clause; body carries {{TOKENS}}, guidance
                             carries the ELS definition as an always-available hint;
                             conditional_on gates a clause on an earlier field value
    contract_field_defs    — one row per input, selection-first, with options

  Part 1 already ran the delete-then-insert for this template_key; this part ONLY
  inserts. It must run AFTER parts 1 and 2. Section sort_order continues at 100-130.

  CARE/HANDLING responsibility fields (who arranges / does it) use
  format_type='party' with responsibility_kind='care', so the party picker offers
  Owner / Lessee / FHE / Shared. Financial (who-pays) responsibility lives in a
  later part, not here.
*/

-- ── SECTIONS (this part: 10-13) ─────────────────────────────────────────────
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES
  ('HORSE_LEASE_V2','LEASE_FEE',        'Lease Fee',            100),
  ('HORSE_LEASE_V2','LOCATION',         'Location of Horse',    110),
  ('HORSE_LEASE_V2','TRAINING_LESSONS', 'Training and Lessons', 120),
  ('HORSE_LEASE_V2','CARE',             'Care of Horse',        130);

-- ── CLAUSES ─────────────────────────────────────────────────────────────────
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance, conditional_on) VALUES
  -- §10 Lease Fee
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.CHOICE','Lease Fee',
    E'Lease fee: {{TXN.LEASE_FEE_TYPE}}.',
    'choice', 10, 'Whether Lessee pays Owner a fee for the lease, or the lease carries no fee.', NULL),
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.PAYMENTS','Lease Fee Payments',
    E'Lessee shall pay Owner an initial payment of {{TXN.INITIAL_PAYMENT}}, due on {{TXN.INITIAL_PAYMENT_DATE}}. In addition, Lessee shall pay Owner {{TXN.MONTHLY_PAYMENT}} per month, due on the {{TXN.PAYMENT_DAY}} day of each month during the term of this Agreement.',
    'input', 20, 'The initial payment and the recurring monthly amount, with the day of the month each monthly payment is due.',
    '{"field_key":"TXN.LEASE_FEE_TYPE","equals":["FEE"]}'::jsonb),

  -- §11 Location of Horse
  ('HORSE_LEASE_V2','LOCATION','LOCATION.MAIN','Location of Horse',
    E'Location of Horse: {{TXN.LOCATION_TYPE}}. Facility: {{HORSE.CURRENT_LOCATION}}.',
    'input', 10, 'Where Horse is kept during the lease. Choose the Owner''s home address or another facility.', NULL),
  ('HORSE_LEASE_V2','LOCATION','LOCATION.INSPECTION',NULL,
    E'Owner may inspect Horse at any time. If Owner determines that Horse is not being properly cared for, Owner may take possession of Horse.',
    'prose', 20, NULL, NULL),

  -- §12 Training and Lessons
  ('HORSE_LEASE_V2','TRAINING_LESSONS','TRAINING_LESSONS.TRAINING','Training',
    E'Professional training: {{TXN.TRAINING_TYPE}}. Trainer: {{HORSE.TRAINER}}.',
    'input', 10, 'Whether Horse is in professional training during the lease, and with whom.', NULL),
  ('HORSE_LEASE_V2','TRAINING_LESSONS','TRAINING_LESSONS.LESSONS','Lessons',
    E'Lessee required to take lessons: {{TXN.LESSONS_REQUIRED}}. Instructor: {{HORSE.INSTRUCTOR}}.',
    'input', 20, 'Whether Lessee must take riding lessons as a condition of the lease, and with whom.', NULL),

  -- §13 Care of Horse
  ('HORSE_LEASE_V2','CARE','CARE.SUPPLEMENTS','Medication and Supplements',
    E'Horse requires the following medications and supplements: {{TXN.SUPPLEMENTS}}. Responsibility for administering them: {{TXN.SUPPLEMENTS_ADMIN}}.',
    'input', 10, 'Supplements means any medication, vitamin, mineral, or other feed additive Horse regularly receives. List them and identify who administers them.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.FARRIER','Farrier Care',
    E'Responsibility for arranging farrier care: {{TXN.FARRIER_ARRANGE}}. Preferred farrier: {{HORSE.FARRIER}}.',
    'input', 20, 'Who arranges routine hoof care (trimming and shoeing), and Horse''s preferred farrier.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.ROUTINE_VET','Routine Veterinary Care',
    E'Responsibility for arranging routine veterinary care: {{TXN.ROUTINE_VET_ARRANGE}}. Preferred veterinarian: {{HORSE.VET}}.',
    'input', 30, 'Routine Veterinary Care means vaccinations, de-worming, dental care, and other regular preventive treatments provided on a normal schedule. Identify who arranges it and Horse''s preferred veterinarian.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.NONROUTINE_VET','Non-Routine Veterinary Care',
    E'Responsibility for arranging non-routine veterinary care: {{TXN.NONROUTINE_VET_ARRANGE}}.',
    'input', 40, 'Non-Routine Veterinary Care means any veterinary care that is not routine, including illness, injury, and emergencies. The party arranging care should contact Horse''s preferred veterinarian first whenever possible.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.OTHER','Other Care',
    E'Other care Horse receives: {{TXN.OTHER_CARE_TYPES}}. Responsibility for arranging it: {{TXN.OTHER_CARE_ARRANGE}}.',
    'input', 50, 'Any additional care Horse receives beyond farrier and veterinary care, such as bodywork therapies.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.PROTECTIVE','Protective Equipment',
    E'During the following activities: {{TXN.PROTECTIVE_ACTIVITIES}}, Horse shall wear the following protective equipment: {{TXN.PROTECTIVE_EQUIPMENT}}. Responsibility for providing the equipment: {{TXN.PROTECTIVE_PROVIDER}}.',
    'input', 60, 'Protective equipment (such as boots or wraps) required for particular activities, and who provides it.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.TACK','Tack',
    E'Required tack: {{TXN.TACK_REQUIRED}}. Responsibility for providing it: {{TXN.TACK_PROVIDER}}.',
    'input', 70, 'Any saddle, bit, bridle, or other tack that must be used with Horse, and who provides it.', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.RESTRAINTS','Restraints',
    E'Approved restraints for handling Horse: {{TXN.RESTRAINTS}}.',
    'input', 80, 'Any restraint that may be used when handling Horse (for example, for the farrier or veterinarian).', NULL),
  ('HORSE_LEASE_V2','CARE','CARE.RIDER_AIDS','Rider Aids',
    E'Approved rider aids for use with Horse: {{TXN.RIDER_AIDS}}.',
    'input', 90, 'Artificial aids Lessee may use when riding Horse.', NULL);

-- ── FIELDS (clause_key links each input to its clause) ───────────────────────
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance, responsibility_kind) VALUES
  -- §10 Lease Fee
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.CHOICE','TXN.LEASE_FEE_TYPE','Lease fee','DEAL','select','select','select',
     '[{"value":"NO_FEE","label":"No lease fee"},{"value":"FEE","label":"Lessee pays a lease fee"}]'::jsonb,
     true,10,'Whether Lessee pays a fee for the lease.',NULL),
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.PAYMENTS','TXN.INITIAL_PAYMENT','Initial payment','DEAL','currency','currency','currency',NULL,false,10,'A one-time payment due at the start of the lease.',NULL),
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.PAYMENTS','TXN.INITIAL_PAYMENT_DATE','Initial payment due date','DEAL','date','date','date',NULL,false,20,NULL,NULL),
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.PAYMENTS','TXN.MONTHLY_PAYMENT','Monthly payment','DEAL','currency','currency','currency',NULL,false,30,'The recurring amount due each month during the term.',NULL),
  ('HORSE_LEASE_V2','LEASE_FEE','LEASE_FEE.PAYMENTS','TXN.PAYMENT_DAY','Day of month due','DEAL','number','number','number',NULL,false,40,'The day of each month the monthly payment is due (1-31).',NULL),

  -- §11 Location of Horse
  ('HORSE_LEASE_V2','LOCATION','LOCATION.MAIN','TXN.LOCATION_TYPE','Location','DEAL','select','select','select',
     '[{"value":"OWNER_HOME","label":"At Owner''s home address"},{"value":"OTHER_FACILITY","label":"Other facility"}]'::jsonb,
     true,10,'Where Horse is kept during the lease.',NULL),
  ('HORSE_LEASE_V2','LOCATION','LOCATION.MAIN','HORSE.CURRENT_LOCATION','Facility','LESSOR','text','location','location',NULL,false,20,'The barn or facility where Horse is kept.',NULL),

  -- §12 Training and Lessons
  ('HORSE_LEASE_V2','TRAINING_LESSONS','TRAINING_LESSONS.TRAINING','TXN.TRAINING_TYPE','Professional training','DEAL','select','select','select',
     '[{"value":"NOT_IN_TRAINING","label":"Not in professional training"},{"value":"IN_TRAINING","label":"In professional training"}]'::jsonb,
     true,10,'Whether Horse is in professional training during the lease.',NULL),
  ('HORSE_LEASE_V2','TRAINING_LESSONS','TRAINING_LESSONS.TRAINING','HORSE.TRAINER','Trainer','LESSOR','text','contact','contact',NULL,false,20,'The professional trainer working with Horse.',NULL),
  ('HORSE_LEASE_V2','TRAINING_LESSONS','TRAINING_LESSONS.LESSONS','TXN.LESSONS_REQUIRED','Lessee required to take lessons?','DEAL','select','yesno','yesno',NULL,true,10,'Whether Lessee must take riding lessons as a condition of the lease.',NULL),
  ('HORSE_LEASE_V2','TRAINING_LESSONS','TRAINING_LESSONS.LESSONS','HORSE.INSTRUCTOR','Instructor','LESSOR','text','contact','contact',NULL,false,20,'The instructor Lessee takes lessons from.',NULL),

  -- §13.1 Medication and Supplements
  ('HORSE_LEASE_V2','CARE','CARE.SUPPLEMENTS','TXN.SUPPLEMENTS','Medications / supplements','DEAL','text','text','text',NULL,false,10,'List the medications, vitamins, minerals, or feed additives Horse regularly receives.',NULL),
  ('HORSE_LEASE_V2','CARE','CARE.SUPPLEMENTS','TXN.SUPPLEMENTS_ADMIN','Who administers them','DEAL','text','responsibility','party',NULL,false,20,'Who is responsible for administering Horse''s medications and supplements.','care'),

  -- §13.2 Farrier Care
  ('HORSE_LEASE_V2','CARE','CARE.FARRIER','TXN.FARRIER_ARRANGE','Who arranges farrier care','DEAL','text','responsibility','party',NULL,false,10,'Who is responsible for arranging Horse''s farrier care.','care'),
  ('HORSE_LEASE_V2','CARE','CARE.FARRIER','HORSE.FARRIER','Preferred farrier','LESSOR','text','contact','contact',NULL,false,20,'Horse''s preferred farrier.',NULL),

  -- §13.3 Routine Veterinary Care
  ('HORSE_LEASE_V2','CARE','CARE.ROUTINE_VET','TXN.ROUTINE_VET_ARRANGE','Who arranges routine vet care','DEAL','text','responsibility','party',NULL,false,10,'Who is responsible for arranging Horse''s routine veterinary care.','care'),
  ('HORSE_LEASE_V2','CARE','CARE.ROUTINE_VET','HORSE.VET','Preferred veterinarian','LESSOR','text','contact','contact',NULL,false,20,'Horse''s preferred veterinarian.',NULL),

  -- §13.4 Non-Routine Veterinary Care
  ('HORSE_LEASE_V2','CARE','CARE.NONROUTINE_VET','TXN.NONROUTINE_VET_ARRANGE','Who arranges non-routine vet care','DEAL','text','responsibility','party',NULL,false,10,'Who is responsible for arranging Horse''s non-routine veterinary care.','care'),

  -- §13.5 Other Care
  ('HORSE_LEASE_V2','CARE','CARE.OTHER','TXN.OTHER_CARE_TYPES','Other care','DEAL','checkbox','buttons','buttons',
     '[{"value":"ACUPUNCTURE","label":"Acupuncture"},{"value":"MASSAGE","label":"Massage Therapy"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Any additional care Horse receives beyond farrier and veterinary care.',NULL),
  ('HORSE_LEASE_V2','CARE','CARE.OTHER','TXN.OTHER_CARE_ARRANGE','Who arranges other care','DEAL','text','responsibility','party',NULL,false,20,'Who is responsible for arranging Horse''s other care.','care'),

  -- §13.6 Protective Equipment
  ('HORSE_LEASE_V2','CARE','CARE.PROTECTIVE','TXN.PROTECTIVE_ACTIVITIES','Activities requiring equipment','DEAL','checkbox','buttons','buttons',
     '[{"value":"TURNOUTS","label":"Turnouts"},{"value":"LONGEING","label":"Longeing / ground work"},{"value":"RIDING","label":"Riding"},{"value":"JUMPING","label":"Jumping"},{"value":"CATTLE_WORK","label":"Cattle work"},{"value":"SPEED_EVENTS","label":"Speed events"}]'::jsonb,
     false,10,'The activities for which protective equipment is required.',NULL),
  ('HORSE_LEASE_V2','CARE','CARE.PROTECTIVE','TXN.PROTECTIVE_EQUIPMENT','Protective equipment','DEAL','checkbox','buttons','buttons',
     '[{"value":"FRONT_BOOTS","label":"Front boots / wraps"},{"value":"HIND_BOOTS","label":"Hind boots / wraps"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,20,'The protective equipment Horse must wear during those activities.',NULL),
  ('HORSE_LEASE_V2','CARE','CARE.PROTECTIVE','TXN.PROTECTIVE_PROVIDER','Who provides the equipment','DEAL','text','responsibility','party',NULL,false,30,'Who is responsible for providing the protective equipment.','care'),

  -- §13.7 Tack
  ('HORSE_LEASE_V2','CARE','CARE.TACK','TXN.TACK_REQUIRED','Required tack','DEAL','longtext','longtext','longtext',NULL,false,10,'Any required saddle, bit, bridle, or other tack that must be used with Horse.',NULL),
  ('HORSE_LEASE_V2','CARE','CARE.TACK','TXN.TACK_PROVIDER','Who provides the tack','DEAL','text','responsibility','party',NULL,false,20,'Who is responsible for providing the required tack.','care'),

  -- §13.8 Restraints
  ('HORSE_LEASE_V2','CARE','CARE.RESTRAINTS','TXN.RESTRAINTS','Approved restraints','DEAL','checkbox','buttons','buttons',
     '[{"value":"STUD_CHAIN","label":"Stud chain"},{"value":"HUMANE_TWITCH","label":"Humane twitch"},{"value":"CHAIN_TWITCH","label":"Chain twitch"},{"value":"HOBBLES","label":"Hobbles"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Any restraint that may be used when handling Horse.',NULL),

  -- §13.9 Rider Aids
  ('HORSE_LEASE_V2','CARE','CARE.RIDER_AIDS','TXN.RIDER_AIDS','Approved rider aids','DEAL','checkbox','buttons','buttons',
     '[{"value":"SPURS","label":"Spurs"},{"value":"CROP","label":"Crop or bat"},{"value":"LONGE_WHIP","label":"Longe whip"},{"value":"DRESSAGE_WHIP","label":"Dressage whip"},{"value":"OTHER","label":"Other"}]'::jsonb,
     false,10,'Artificial aids Lessee may use when riding Horse.',NULL);
