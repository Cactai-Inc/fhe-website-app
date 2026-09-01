/*
  # Lease v2 seed — Part 4: Expenses, Payment Terms, Insurance & Risk (ELS §14-16)

  Continues the ELS-faithful clause seed under template_key HORSE_LEASE_V2,
  following the PATTERN established in Part 1 (parties/horse):

    contract_section_defs  — one row per numbered section
    contract_clause_defs   — one row per clause; body carries {{TOKENS}}, guidance
                             carries the ELS definition as an always-available hint
    contract_field_defs    — one row per input, selection-first, with options

  Section 14 (Horse's Expenses) is entirely FINANCIAL responsibility allocation:
  every field is a 'party' field with responsibility_kind='financial' — Owner,
  Lessee, or a shared split (NO FHE option). Section 16 risk allocation is
  expressed as 'select' radio-style fields, not party fields.

  Part 1 did the DELETE for this template_key; this part only INSERTs.
*/

-- ── SECTIONS (this part: 14-16) ─────────────────────────────────────────────
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES
  ('HORSE_LEASE_V2','EXPENSES',      'Horse''s Expenses',                             140),
  ('HORSE_LEASE_V2','PAYMENT_TERMS', 'Payment Terms',                                 150),
  ('HORSE_LEASE_V2','INSURANCE_RISK','Insurance, Risk of Loss, and Indemnification',  160);

-- ── CLAUSES ─────────────────────────────────────────────────────────────────
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance, conditional_on) VALUES
  -- §14 Horse's Expenses ─────────────────────────────────────────────────────
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.INTRO','Horse''s Expenses',
    E'The parties agree to allocate responsibility for the Horse''s expenses as set out below. Where an expense is shared, each party shall bear the stated percentage. Except as otherwise provided, the party responsible for an expense shall pay it directly or reimburse the other party for it in accordance with the Payment Terms.',
    'prose', 10, NULL, NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.MORTALITY_INSURANCE','Mortality Insurance',
    E'Responsibility for the cost of mortality insurance on Horse: {{TXN.MORTALITY_INSURANCE_PARTY}}.',
    'input', 20, 'Who pays the premium for mortality insurance. Shown only when mortality insurance is required under §16.1.1.',
    '{"field_key":"TXN.MORTALITY_INSURANCE_REQ","equals":["YES"]}'::jsonb),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.MAJOR_MEDICAL_INSURANCE','Major Medical Insurance',
    E'Responsibility for the cost of major medical insurance on Horse: {{TXN.MAJOR_MEDICAL_INSURANCE_PARTY}}.',
    'input', 30, 'Who pays the premium for major medical insurance. Shown only when major medical insurance is required under §16.1.2.',
    '{"field_key":"TXN.MAJOR_MEDICAL_INSURANCE_REQ","equals":["YES"]}'::jsonb),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.LOSS_OF_USE_INSURANCE','Loss of Use Insurance',
    E'Responsibility for the cost of loss of use insurance on Horse: {{TXN.LOSS_OF_USE_INSURANCE_PARTY}}.',
    'input', 40, 'Who pays the premium for loss of use insurance. Shown only when loss of use insurance is required under §16.1.3.',
    '{"field_key":"TXN.LOSS_OF_USE_INSURANCE_REQ","equals":["YES"]}'::jsonb),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.BOARD','Board',
    E'Responsibility for the cost of boarding Horse: {{TXN.BOARD_COST}}.',
    'input', 50, 'Who pays for board (stabling, turnout, and basic daily care at the boarding facility).', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.TRAINING','Training',
    E'Responsibility for the cost of training Horse: {{TXN.TRAINING_COST}}.',
    'input', 60, 'Who pays for professional training of the Horse.', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.LESSONS','Lessons',
    E'Responsibility for the cost of riding lessons: {{TXN.LESSONS_COST}}.',
    'input', 70, 'Who pays for the Lessee''s riding lessons.', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.SUPPLEMENTS','Medications and Supplements',
    E'Responsibility for the cost of medications and supplements for Horse: {{TXN.SUPPLEMENTS_COST}}.',
    'input', 80, 'Who pays for the Horse''s routine medications and nutritional supplements.', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.FARRIER','Farrier',
    E'Responsibility for the cost of farrier services for Horse: {{TXN.FARRIER_COST}}.',
    'input', 90, 'Who pays for shoeing and trimming.', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.ROUTINE_VET','Routine Veterinary Care',
    E'Responsibility for the cost of routine veterinary care for Horse: {{TXN.ROUTINE_VET_COST}}.',
    'input', 100, 'Who pays for routine and preventative veterinary care (vaccinations, dentistry, deworming, and wellness exams).', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.NONROUTINE_VET','Non-Routine Veterinary Care',
    E'Responsibility for the cost of non-routine veterinary care for Horse: {{TXN.NONROUTINE_VET_COST}}. Notwithstanding the foregoing, Lessee shall be solely responsible for the cost of any veterinary or other care made necessary by Lessee''s negligence, misuse, or breach of this Agreement.',
    'input', 110, 'Who pays for emergency, illness, and injury veterinary care. Care needed because of the Lessee''s negligence is always the Lessee''s responsibility.', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.OTHER_CARE','Other Care',
    E'Responsibility for the cost of other care for Horse: {{TXN.OTHER_CARE_COST}}.',
    'input', 120, 'Who pays for other care not listed above (e.g. body work, chiropractic, or blanketing).', NULL),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.OTHER_EXPENSES','Other Expenses',
    E'Responsibility for any other expenses relating to Horse: {{TXN.OTHER_EXPENSES_COST}}.',
    'input', 130, 'Who pays for any other expenses not otherwise allocated above.', NULL),

  -- §15 Payment Terms ────────────────────────────────────────────────────────
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.DUE_DATES','Due Dates',
    E'Unless otherwise stated in this Agreement, each party shall pay any amount owed to the other party within {{TXN.INVOICE_DAYS}} days after receipt of an itemized invoice for that amount.',
    'input', 10, 'How many days a party has to pay an itemized invoice.', NULL),
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.OFFSET','Right of Offset',
    E'A party to whom money is owed under this Agreement may offset the amount owed against any amount that party owes to the other party, provided the offsetting party first delivers to the other party an itemized statement describing the amounts offset.',
    'prose', 20, NULL, NULL),
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.RECEIPTS','Receipts',
    E'A party seeking reimbursement for an expense paid on behalf of the other party shall provide a receipt or other reasonable documentation of the expense as a condition of reimbursement.',
    'prose', 30, NULL, NULL),
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.LATE','Late Payments',
    E'If a party fails to pay any amount owed under this Agreement when due, that party shall pay a late fee of {{TXN.LATE_FEE}}. Any amount that remains unpaid more than {{TXN.LATE_DAYS}} days past its due date shall accrue interest at the rate of {{TXN.LATE_INTEREST_RATE}}% per year until paid in full. In addition, the non-paying party shall reimburse the other party for any fees or charges incurred as a result of a dishonored check or other dishonored payment instrument.',
    'input', 40, 'Late fee, interest rate, and the grace period before interest begins to accrue.', NULL),

  -- §16 Insurance, Risk of Loss, and Indemnification ───────────────────────────
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.INSURANCE','Insurance Requirements',
    E'The parties agree that the following insurance shall be carried on Horse during the term of this Agreement, obtained and maintained as set out below.',
    'prose', 10, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','Mortality Insurance',
    E'Mortality insurance required on Horse: {{TXN.MORTALITY_INSURANCE_REQ}}. If required, the following party shall obtain and maintain it: {{TXN.MORTALITY_INSURANCE_OBTAINER}}. Any mortality insurance shall name the parties as their interests appear, and the proceeds of any mortality claim shall be paid to Owner as the beneficiary of the Horse''s Value unless the parties agree otherwise in writing.',
    'input', 20, 'Mortality insurance pays out if the Horse dies. Where required, decide who is responsible for obtaining and maintaining the policy.', NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','Major Medical Insurance',
    E'Major medical insurance required on Horse: {{TXN.MAJOR_MEDICAL_INSURANCE_REQ}}. If required, the following party shall obtain and maintain it: {{TXN.MAJOR_MEDICAL_OBTAINER}}.',
    'input', 30, 'Major medical insurance covers the cost of illness and injury treatment. Where required, decide who obtains and maintains the policy.', NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.LOSS_OF_USE','Loss of Use Insurance',
    E'Loss of use insurance required on Horse: {{TXN.LOSS_OF_USE_INSURANCE_REQ}}. If required, the following party shall obtain and maintain it: {{TXN.LOSS_OF_USE_OBTAINER}}.',
    'input', 40, 'Loss of use insurance pays out if the Horse becomes permanently unable to perform its intended use. Where required, decide who obtains and maintains the policy.', NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RISK_OF_LOSS','Risk of Loss of or Injury to Horse',
    E'The risk of loss of or injury to Horse is allocated as follows: {{TXN.RISK_ALLOCATION}}. This allocation governs which party bears the financial consequence if Horse is lost, dies, is stolen, or is injured during the term of this Agreement, subject to the sub-sections below.',
    'input', 50, 'Allocates the risk if the Horse is lost, dies, is stolen, or is injured while on lease.', NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RISK_OF_LOSS.LIQUIDATED','Liquidated Damages',
    E'The parties agree that Horse''s Value, as stated in this Agreement, is a reasonable pre-estimate of the parties'' damages in the event of the death, loss, theft, or permanent disability of Horse, and that Horse''s Value shall serve as liquidated damages and not as a penalty. The parties agree that Horse''s actual value is difficult to ascertain and that this liquidated amount is a fair measure of the loss.',
    'prose', 60, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RISK_OF_LOSS.DEATH','Death, Loss, or Theft',
    E'If Horse dies, is lost, or is stolen and the risk of that loss is allocated to a party under this Section, that party shall pay to the other party an amount equal to Horse''s Value (less any insurance proceeds actually received by the party owed) within {{TXN.LOSS_PAYMENT_DAYS}} days.',
    'input', 70, 'If a party bears the risk and the Horse is lost, how many days that party has to pay the Horse''s fair market value.', NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RISK_OF_LOSS.DISABILITY','Disability',
    E'If Horse becomes permanently disabled or otherwise permanently unable to perform its intended use, and the risk of that loss is allocated to a party under this Section, the parties shall treat the disability in the same manner as a loss of Horse, and the value of any loss of use insurance proceeds actually received shall be credited against the amount owed.',
    'prose', 80, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.INJURY_LESSEE','Risk of Injury to Lessee',
    E'Lessee understands and expressly acknowledges that horseback riding and handling of horses are inherently dangerous activities, and that equine activities carry a risk of serious injury or death. Lessee voluntarily assumes all risks of injury to Lessee arising out of Lessee''s riding, handling, care, and use of Horse, whether foreseeable or unforeseeable, except to the extent caused by the gross negligence or willful misconduct of Owner.',
    'prose', 90, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.INJURY_OWNER','Risk of Injury to Owner',
    E'Owner understands and expressly acknowledges that being in the presence of and handling horses carries a risk of injury, and Owner voluntarily assumes the risks of injury to Owner arising out of Owner''s own presence around and handling of Horse, except to the extent caused by the gross negligence or willful misconduct of Lessee.',
    'prose', 100, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.SAFETY_ATTIRE','Safety Attire',
    E'Lessee is strongly encouraged to wear proper safety attire at all times while mounted, including boots with a heel and a properly fitted, securely fastened equestrian helmet meeting or exceeding ASTM/SEI certification standards. Lessee acknowledges that riding without a certified helmet substantially increases the risk of serious head injury or death, and Lessee assumes that risk if Lessee chooses to ride without one.',
    'prose', 110, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.TRAIL_RIDING','Trail Riding Risks',
    E'Lessee acknowledges that riding outside an enclosed arena, including trail riding, exposes Lessee and Horse to additional risks, including uneven terrain, traffic, wildlife, water crossings, and other conditions that may cause Horse to spook or behave unpredictably. Lessee voluntarily assumes these additional risks.',
    'prose', 120, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.WAIVER_UNKNOWN','Waiver of Unknown Claims',
    E'Each party expressly waives any and all claims against the other that the waiving party does not know or suspect to exist at the time of this Agreement, and acknowledges that this waiver is a material term of this Agreement. Each party assumes the risk that claims presently unknown to it may later be discovered.',
    'prose', 130, NULL, NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.INDEMNIFICATION','Indemnification',
    E'Indemnification under this Agreement is allocated as follows: {{TXN.INDEMNIFICATION}}. The indemnifying party shall indemnify, defend, and hold harmless the indemnified party from and against any and all claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys'' fees) arising out of the indemnifying party''s use, handling, care, or possession of Horse, except to the extent caused by the gross negligence or willful misconduct of the indemnified party.',
    'input', 140, 'Which party protects the other against third-party claims arising from the lease.', NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.LIMITATION','Limitation of Liability',
    E'In no event shall either party be liable to the other for any special, incidental, indirect, consequential, or punitive damages arising out of or relating to this Agreement, whether in contract, tort, or otherwise, even if advised of the possibility of such damages. Except for a party''s indemnification obligations and its liability for the loss of or injury to Horse as provided in this Agreement, each party''s total aggregate liability to the other under this Agreement shall not exceed the total amounts paid and payable under this Agreement.',
    'prose', 150, NULL, NULL);

-- ── FIELDS (clause_key links each input to its clause) ───────────────────────
-- §14 Horse's Expenses — every field is FINANCIAL responsibility (who pays):
--   format_type='party', responsibility_kind='financial' (Owner / Lessee / Shared %, NO FHE)
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance, responsibility_kind) VALUES
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.MORTALITY_INSURANCE','TXN.MORTALITY_INSURANCE_PARTY','Mortality insurance — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of the mortality insurance premium.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.MAJOR_MEDICAL_INSURANCE','TXN.MAJOR_MEDICAL_INSURANCE_PARTY','Major medical insurance — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of the major medical insurance premium.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.LOSS_OF_USE_INSURANCE','TXN.LOSS_OF_USE_INSURANCE_PARTY','Loss of use insurance — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of the loss of use insurance premium.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.BOARD','TXN.BOARD_COST','Board — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of boarding Horse.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.TRAINING','TXN.TRAINING_COST','Training — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of training Horse.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.LESSONS','TXN.LESSONS_COST','Lessons — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of riding lessons.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.SUPPLEMENTS','TXN.SUPPLEMENTS_COST','Medications and supplements — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of medications and supplements.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.FARRIER','TXN.FARRIER_COST','Farrier — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of farrier services.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.ROUTINE_VET','TXN.ROUTINE_VET_COST','Routine vet — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of routine veterinary care.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.NONROUTINE_VET','TXN.NONROUTINE_VET_COST','Non-routine vet — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of non-routine veterinary care. Care needed due to Lessee''s negligence is always the Lessee''s responsibility.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.OTHER_CARE','TXN.OTHER_CARE_COST','Other care — who pays','DEAL','text','party','party',NULL,true,10,'Who bears the cost of other care.','financial'),
  ('HORSE_LEASE_V2','EXPENSES','EXPENSES.OTHER_EXPENSES','TXN.OTHER_EXPENSES_COST','Other expenses — who pays','DEAL','text','party','party',NULL,true,10,'Who bears any other expenses relating to Horse.','financial'),

  -- §15 Payment Terms
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.DUE_DATES','TXN.INVOICE_DAYS','Days to pay an itemized invoice','DEAL','number','number','number',NULL,true,10,'How many days a party has to pay after receiving an itemized invoice.',NULL),
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.LATE','TXN.LATE_FEE','Late fee','DEAL','currency','currency','currency',NULL,false,10,'A flat fee charged on a late payment.',NULL),
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.LATE','TXN.LATE_INTEREST_RATE','Interest rate (% per year)','DEAL','number','number','number',NULL,false,20,'Annual interest rate applied to overdue amounts.',NULL),
  ('HORSE_LEASE_V2','PAYMENT_TERMS','PAYMENT_TERMS.LATE','TXN.LATE_DAYS','Days past due before interest','DEAL','number','number','number',NULL,false,30,'Grace period, in days past the due date, before interest begins to accrue.',NULL),

  -- §16 Insurance Requirements (§16.1.x) — yesno gates the §14.1-3 cost fields
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','TXN.MORTALITY_INSURANCE_REQ','Mortality insurance required?','DEAL','select','yesno','yesno',NULL,true,10,'Is mortality insurance required on Horse during the lease?',NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MORTALITY','TXN.MORTALITY_INSURANCE_OBTAINER','Who obtains mortality insurance','DEAL','select','select','select',
     '[{"value":"LESSEE","label":"Lessee obtains and maintains it"},{"value":"OWNER","label":"Owner obtains and maintains it"}]'::jsonb,
     false,20,'Which party is responsible for obtaining and maintaining the mortality policy.',NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','TXN.MAJOR_MEDICAL_INSURANCE_REQ','Major medical insurance required?','DEAL','select','yesno','yesno',NULL,true,10,'Is major medical insurance required on Horse during the lease?',NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.MAJOR_MEDICAL','TXN.MAJOR_MEDICAL_OBTAINER','Who obtains major medical insurance','DEAL','select','select','select',
     '[{"value":"LESSEE","label":"Lessee obtains and maintains it"},{"value":"OWNER","label":"Owner obtains and maintains it"}]'::jsonb,
     false,20,'Which party is responsible for obtaining and maintaining the major medical policy.',NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.LOSS_OF_USE','TXN.LOSS_OF_USE_INSURANCE_REQ','Loss of use insurance required?','DEAL','select','yesno','yesno',NULL,true,10,'Is loss of use insurance required on Horse during the lease?',NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.LOSS_OF_USE','TXN.LOSS_OF_USE_OBTAINER','Who obtains loss of use insurance','DEAL','select','select','select',
     '[{"value":"LESSEE","label":"Lessee obtains and maintains it"},{"value":"OWNER","label":"Owner obtains and maintains it"}]'::jsonb,
     false,20,'Which party is responsible for obtaining and maintaining the loss of use policy.',NULL),

  -- §16.2 Risk of Loss — 'select' radio-style allocation, not a party field
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RISK_OF_LOSS','TXN.RISK_ALLOCATION','Risk of loss allocation','DEAL','select','select','select',
     '[{"value":"OWNER_ALL","label":"Owner assumes all risk"},{"value":"OWNER_EXCEPT_LESSEE_NEG","label":"Owner assumes all risk except loss caused by Lessee''s negligence"},{"value":"LESSEE_ALL","label":"Lessee assumes all risk"},{"value":"LESSEE_EXCEPT_OWNER_NEG","label":"Lessee assumes all risk except loss caused by Owner''s negligence"}]'::jsonb,
     true,10,'Who bears the financial risk if Horse is lost, dies, is stolen, or is injured during the lease.',NULL),
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.RISK_OF_LOSS.DEATH','TXN.LOSS_PAYMENT_DAYS','Days to pay Horse''s value','DEAL','number','number','number',NULL,false,10,'If a party bears the risk and Horse is lost, how many days that party has to pay Horse''s fair market value.',NULL),

  -- §16.8 Indemnification — 'select' allocation
  ('HORSE_LEASE_V2','INSURANCE_RISK','INSURANCE_RISK.INDEMNIFICATION','TXN.INDEMNIFICATION','Indemnification','DEAL','select','select','select',
     '[{"value":"LESSEE_INDEMNIFIES_OWNER","label":"Lessee indemnifies Owner"},{"value":"OWNER_INDEMNIFIES_LESSEE","label":"Owner indemnifies Lessee"},{"value":"MUTUAL","label":"Mutual — each party indemnifies the other"}]'::jsonb,
     true,10,'Which party protects the other against third-party claims arising from the lease.',NULL);
