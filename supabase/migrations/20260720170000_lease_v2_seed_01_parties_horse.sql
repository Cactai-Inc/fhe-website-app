/*
  # Lease v2 seed — Part 1: Parties, Purpose, Horse (ELS §1-3)

  First slice of the ELS-faithful clause seed, under template_key HORSE_LEASE_V2
  (built alongside the live HORSE_LEASE so nothing in production breaks until we
  cut over). Establishes the seeding PATTERN the remaining parts follow:

    contract_section_defs  — one row per numbered section
    contract_clause_defs   — one row per clause; body carries {{TOKENS}}, guidance
                             carries the ELS definition as an always-available hint
    contract_field_defs    — one row per input, selection-first, with options

  Sections are seeded idempotently (delete-then-insert for this template_key so
  re-running is safe during development).
*/

DELETE FROM contract_field_defs   WHERE template_key = 'HORSE_LEASE_V2';
DELETE FROM contract_clause_defs  WHERE template_key = 'HORSE_LEASE_V2';
DELETE FROM contract_section_defs WHERE template_key = 'HORSE_LEASE_V2';

-- ── SECTIONS (this part: 1-3) ───────────────────────────────────────────────
INSERT INTO contract_section_defs (template_key, section_key, heading, sort_order) VALUES
  ('HORSE_LEASE_V2','PARTIES','Parties',                10),
  ('HORSE_LEASE_V2','PURPOSE','Purpose and Lease Grant', 20),
  ('HORSE_LEASE_V2','HORSE',  'The Horse',              30);

-- ── CLAUSES ─────────────────────────────────────────────────────────────────
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, guidance) VALUES
  ('HORSE_LEASE_V2','PARTIES','PARTIES.INTRO', NULL,
    E'This Horse Lease Agreement (the "Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} by and between {{LESSOR.FULL_NAME}} of {{LESSOR.ADDRESS}} ("Owner" or "Lessor") and {{LESSEE.FULL_NAME}} of {{LESSEE.ADDRESS}} ("Lessee").',
    'input', 10, 'The parties to the lease. Owner (Lessor) leases the horse to the Lessee.'),

  ('HORSE_LEASE_V2','PURPOSE','PURPOSE.RECREATION','Purpose of Agreement',
    E'For recreational purposes, Lessee wishes to ride and/or handle Owner''s horse, and Owner agrees to allow Lessee to ride and/or handle Owner''s horse in exchange for the consideration described herein.',
    'prose', 10, NULL),
  ('HORSE_LEASE_V2','PURPOSE','PURPOSE.GRANT','Lease Grant',
    E'Subject to the terms and conditions of this Agreement, Owner agrees to lease to Lessee and Lessee agrees to lease from Owner the horse described below.',
    'prose', 20, NULL),

  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','Horse',
    E'This Agreement applies to the following horse (the "Horse"):\nRegistered name: {{HORSE.REGISTERED_NAME}}\nColor and markings: {{HORSE.COLOR}} {{HORSE.MARKINGS}}\nBreed and registration no.: {{HORSE.BREED}} {{HORSE.REGISTRATION_NUMBER}}\nSex: {{HORSE.SEX}}\nYear foaled: {{HORSE.AGE_DOB}}\nCurrent fair market value: {{HORSE.FAIR_MARKET_VALUE}} ("Horse''s Value")\nMicrochip: {{HORSE.MICROCHIP_HAS}} {{HORSE.MICROCHIP}}\nPassport: {{HORSE.PASSPORT_HAS}} {{HORSE.PASSPORT_NUMBER}}',
    'input', 10, 'Identity of the leased horse. Most of this auto-fills from the horse''s record.'),
  ('HORSE_LEASE_V2','HORSE','HORSE.CONDITION','Physical Condition',
    E'Horse''s physical condition: {{HORSE.CONDITION_BASIS}}. Exceptions: {{TXN.CONDITION_EXCEPTIONS}}.',
    'input', 20, 'Whether the Lessee relies on their own knowledge of the horse''s condition, or the Owner warrants it is sound except as noted.'),
  ('HORSE_LEASE_V2','HORSE','HORSE.BEHAVIOR','Behavior',
    E'Horse''s behavioral history: {{HORSE.BEHAVIOR_BASIS}}. Exceptions: {{TXN.BEHAVIOR_EXCEPTIONS}}.',
    'input', 30, 'Whether the Lessee relies on their own knowledge of the horse''s behavior, or the Owner warrants no history of dangerous behavior except as noted.'),
  ('HORSE_LEASE_V2','HORSE','HORSE.OWNERSHIP','Ownership of Horse',
    E'Owner warrants that Owner is the sole lawful and registered owner of Horse, owns Horse free of liens and encumbrances, and has all requisite rights and powers to enter into this Agreement. Limitations on ownership, if any: {{TXN.OWNERSHIP_LIMITATIONS}}.',
    'input', 40, 'e.g. a lease, community-property spouse, installment purchase, or a prior seller''s right of first refusal.'),
  ('HORSE_LEASE_V2','HORSE','HORSE.WARRANTY','Disclaimer of Warranties',
    E'Except for the representations expressly stated in this Agreement, OWNER MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE. Owner recommends that Lessee retain a professional trainer to evaluate the suitability of Horse for Lessee''s intended purposes prior to entering into this Agreement.',
    'prose', 50, NULL);

-- ── FIELDS (clause_key links each input to its clause) ───────────────────────
-- Horse identity (auto-fills from the horse record; selection-first where sensible)
INSERT INTO contract_field_defs (template_key, section, clause_key, field_key, label, owner_role, value_type, input_kind, format_type, options, required, sort_order, guidance) VALUES
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.REGISTERED_NAME','Registered name','LESSOR','text','text','text',NULL,true,10,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.COLOR','Color','LESSOR','select','select','select',
     '[{"value":"BAY","label":"Bay"},{"value":"CHESTNUT","label":"Chestnut"},{"value":"GRAY","label":"Gray"},{"value":"BLACK","label":"Black"},{"value":"BROWN","label":"Brown"},{"value":"ROAN","label":"Roan"},{"value":"PALOMINO","label":"Palomino"},{"value":"PINTO","label":"Pinto / Paint"},{"value":"BUCKSKIN","label":"Buckskin"},{"value":"DUN","label":"Dun"},{"value":"WHITE","label":"White / Cremello"}]'::jsonb,
     false,20,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.MARKINGS','Markings','LESSOR','text','text','text',NULL,false,25,'e.g. blaze, socks, snip'),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.BREED','Breed','LESSOR','select','select','select',
     '[{"value":"WARMBLOOD","label":"Warmblood"},{"value":"THOROUGHBRED","label":"Thoroughbred"},{"value":"QUARTER_HORSE","label":"Quarter Horse"},{"value":"ARABIAN","label":"Arabian"},{"value":"PONY","label":"Pony"},{"value":"DRAFT","label":"Draft"},{"value":"APPALOOSA","label":"Appaloosa"},{"value":"MORGAN","label":"Morgan"},{"value":"FRIESIAN","label":"Friesian"},{"value":"ANDALUSIAN","label":"Andalusian"},{"value":"MUSTANG","label":"Mustang"},{"value":"CROSSBRED","label":"Crossbred / Grade"}]'::jsonb,
     false,30,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.REGISTRATION_NUMBER','Registration number','LESSOR','text','text','text',NULL,false,35,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.SEX','Sex','LESSOR','select','select','select',
     '[{"value":"MARE","label":"Mare"},{"value":"GELDING","label":"Gelding"},{"value":"STALLION","label":"Stallion"},{"value":"COLT","label":"Colt"},{"value":"FILLY","label":"Filly"}]'::jsonb,
     false,40,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.AGE_DOB','Year foaled','LESSOR','text','text','text',NULL,false,50,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.FAIR_MARKET_VALUE','Fair market value','LESSOR','currency','currency','currency',NULL,false,60,'Used to compute liquidated damages if the horse is lost or injured.'),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.MICROCHIP_HAS','Has a microchip?','LESSOR','select','yesno','yesno',NULL,false,70,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.MICROCHIP','Microchip #','LESSOR','text','text','text',NULL,false,72,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.PASSPORT_HAS','Has a passport?','LESSOR','select','yesno','yesno',NULL,false,80,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.IDENTITY','HORSE.PASSPORT_NUMBER','Passport #','LESSOR','text','text','text',NULL,false,82,NULL),

  ('HORSE_LEASE_V2','HORSE','HORSE.CONDITION','HORSE.CONDITION_BASIS','Condition basis','LESSOR','select','select','select',
     '[{"value":"OWN_KNOWLEDGE","label":"Lessee relies on their own knowledge of the horse''s condition"},{"value":"WARRANTED","label":"Owner warrants the horse is sound and in good condition except as noted"}]'::jsonb,
     false,10,'How the horse''s physical condition is represented.'),
  ('HORSE_LEASE_V2','HORSE','HORSE.CONDITION','TXN.CONDITION_EXCEPTIONS','Condition exceptions','DEAL','longtext','longtext','longtext',NULL,false,20,'Any known illnesses, lamenesses, or physical conditions.'),

  ('HORSE_LEASE_V2','HORSE','HORSE.BEHAVIOR','HORSE.BEHAVIOR_BASIS','Behavior basis','LESSOR','select','select','select',
     '[{"value":"OWN_KNOWLEDGE","label":"Lessee relies on their own knowledge of the horse''s behavior"},{"value":"WARRANTED","label":"Owner warrants no history of dangerous behavior except as noted"}]'::jsonb,
     false,10,NULL),
  ('HORSE_LEASE_V2','HORSE','HORSE.BEHAVIOR','TXN.BEHAVIOR_EXCEPTIONS','Behavior exceptions','DEAL','longtext','longtext','longtext',NULL,false,20,'e.g. biting, kicking, bucking, rearing, bolting, trailer-loading or farrier issues.'),

  ('HORSE_LEASE_V2','HORSE','HORSE.OWNERSHIP','TXN.OWNERSHIP_LIMITATIONS','Ownership limitations','LESSOR','longtext','longtext','longtext',NULL,false,10,NULL);
