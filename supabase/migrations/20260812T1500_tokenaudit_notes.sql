-- TOKENAUDIT (2026-08-12): a plain-language description for every template_tokens row.
--
-- Writes ONLY template_tokens.notes. One canonical description per (namespace, field);
-- the same text lands on the dictionary row and every template-scoped row of that token,
-- so the picker shows the same explanation wherever the token appears.
--
-- The 93 pre-existing notes were reviewed against the live merge path (generate_document,
-- remerge_contract_from_clauses, fill_party_fields_from_contacts, record_signature) and
-- are superseded by these: several were wrong about live behavior (ENG.ID is CTR-…, not
-- ENG-YYYY-NNNNNN; ORD.SERVICE_SELECTION reads purchase_items.label, not client_purchases;
-- HORSE.AGE_DOB prints the DOB, never an age). source_table/source_column are NOT touched:
-- they are documentation, read by no code path (established in TASK-TOKENAUDIT-REPORT.md).
--
-- Applied with psql single-transaction mode; no self-contained COMMIT (repo convention).

WITH d(ns, f, note) AS (
  VALUES
  -- ───────────────────────── CLIENT — the signed-in member the document was generated for ─────────────────────────
  ('CLIENT','ADDRESS','The client''s mailing address on one line, e.g. 12 Main St, Carmel, CA 93923. Comes from the client''s contact record; blank if no address is on file or the document has no CLIENT party.'),
  ('CLIENT','DOB','The client''s date of birth written out, e.g. March 31, 1990. Blank if not on file.'),
  ('CLIENT','EMAIL','The client''s email address. Blank if none is on file.'),
  ('CLIENT','PHONE','The client''s phone number as recorded on their contact record. Blank if none is on file.'),
  ('CLIENT','FULL_NAME','The client''s full name — first plus last, e.g. Mary Richardson. Renders the SAME value as CLIENT.PRINTED_NAME; use FULL_NAME in body text and PRINTED_NAME under signature lines.'),
  ('CLIENT','PRINTED_NAME','The client''s name printed under a signature line. Identical output to CLIENT.FULL_NAME — the two names exist so signature blocks read as intended. Use this one in signature blocks.'),
  ('CLIENT','EMERGENCY_CONTACT_1_NAME','Primary emergency contact''s name from the client''s profile. Blank until the client fills in emergency contacts.'),
  ('CLIENT','EMERGENCY_CONTACT_1_PHONE','Primary emergency contact''s phone. Blank until filled in.'),
  ('CLIENT','EMERGENCY_CONTACT_1_RELATIONSHIP','How the primary emergency contact is related to the client, e.g. Spouse. Blank until filled in.'),
  ('CLIENT','EMERGENCY_CONTACT_2_NAME','Backup (second) emergency contact''s name. Blank until filled in — a document generated before the client adds one will show an empty line.'),
  ('CLIENT','EMERGENCY_CONTACT_2_PHONE','Backup emergency contact''s phone. Blank until filled in.'),
  ('CLIENT','EMERGENCY_CONTACT_2_RELATIONSHIP','Backup emergency contact''s relationship to the client. Blank until filled in.'),
  ('CLIENT','HORSE_CAPACITY','A computed phrase for the client''s authority over the document''s horse: ''owns'', ''leases'' or ''is an authorized agent of'', checked against the horse''s recorded owner and lessee at generation. With no horse (or no recorded owner) it prints the broad ''owns, leases, manages, or otherwise has authority over''.'),
  ('CLIENT','JUMP_EXPERIENCE','The jumping experience and maximum height the client attested on their profile. Blank if never provided. Only meaningful on riding/jumper documents.'),
  ('CLIENT','JUMP_LIMITATIONS','Injuries, physical limitations or riding gaps the client disclosed on their profile. Blank if none entered.'),
  ('CLIENT','RIDING_BACKGROUND','The client''s prior instruction, showing or competition background as entered on their profile. Blank if never provided.'),
  ('CLIENT','RIDING_EXPERIENCE_YEARS','Years of riding experience the client attested, e.g. 12. Blank if never provided.'),

  -- ───────────────────────── DIR — direction wording resolved from the contract''s deal side ─────────────────────────
  ('DIR','DIRECTION_TERM','The transaction word — purchase, sale or lease — picked from the template''s direction variants by who retained us and which side of the deal the contract records. Blank when the document has no contract behind it.'),
  ('DIR','ROLE_TERM','The client''s role word — buyer, seller, owner, lessee or lessor — picked from the contract''s direction (who retained us + deal side). Blank without a contract.'),
  ('DIR','COUNTERPARTY_TERM','The other side''s role word — seller, buyer, lessor or lessee — picked from the contract''s direction. Blank without a contract.'),
  ('DIR','TARGET_TERM','What the search is looking for — a horse, a buyer, a lessee — picked from the contract''s direction. Used by the search retainer. Blank without a contract.'),

  -- ───────────────────────── DOC — this document instance ─────────────────────────
  ('DOC','EFFECTIVE_DATE','The date the document takes effect, written out — e.g. August 12, 2026. Uses the document''s effective date once set at execution; before that, the date it was created. Always prints a date.'),
  ('DOC','GENERATED_DATE','The date the document was generated, e.g. August 12, 2026. Always fills.'),
  ('DOC','ID','The document''s human reference number, e.g. DOC-000123. Always fills. This is the one to use anywhere a person will read or quote the reference.'),
  ('DOC','UUID','The document''s internal system id — a long UUID for tracing, not for reading. Always fills. Prefer DOC.ID in anything human-facing.'),

  -- ───────────────────────── ENG — contract scope. ID/SERVICE_TYPE/START_DATE read the contract; the rest were never wired ─────────────────────────
  ('ENG','ID','The contract''s reference number, e.g. CTR-000101. Despite the ENG name this reads the CONTRACT behind the document (engagements were retired). Blank when the document has no contract.'),
  ('ENG','SERVICE_TYPE','The service type behind the document, e.g. JUMPER_TRAINING — from the start request or the contract''s segment. Blank without one.'),
  ('ENG','START_DATE','The contract''s effective date, written out. Blank when there is no contract.'),
  ('ENG','DISCIPLINE','Meant to carry the riding discipline from a client intake that was never built — ALWAYS RENDERS BLANK today. Do not place until intake capture exists.'),
  ('ENG','INTENDED_USE','Meant to carry the horse''s intended use from client intake — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','EXPERIENCE_LEVEL','Meant to carry the rider''s experience level from client intake — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','COMPETITION_GOALS','Meant to carry competition goals from evaluation intake — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','OTHER_CONSIDERATIONS','Meant to carry other evaluation considerations from intake — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','DISCLOSURES','Meant to carry company conflict/relationship disclosures — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','SEARCH_OBJECTIVE','Meant to carry the search objective statement on the search retainer — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','BREED_PREFERENCE','Search parameter (breed preference) from intake that was never built — ALWAYS RENDERS BLANK today.'),
  ('ENG','AGE_RANGE','Search parameter (age range) from intake that was never built — ALWAYS RENDERS BLANK today.'),
  ('ENG','HEIGHT_RANGE','Search parameter (height range) from intake that was never built — ALWAYS RENDERS BLANK today.'),
  ('ENG','BUDGET','Search parameter (budget) from intake that was never built — ALWAYS RENDERS BLANK today.'),
  ('ENG','ADDITIONAL_REQUIREMENTS','Search parameter (additional requirements) from intake that was never built — ALWAYS RENDERS BLANK today.'),
  ('ENG','PROTECTION_PERIOD','Meant to be the non-circumvention window in months on the retainer/representation agreements — never wired, ALWAYS RENDERS BLANK today.'),
  ('ENG','PROGRAM_SCOPE','Meant to carry the horsemanship program scope from an order form that no longer exists — ALWAYS RENDERS BLANK today.'),

  -- ───────────────────────── FHE — older twins of ORG.*; no live template uses them ─────────────────────────
  ('FHE','LEGAL_NAME','Older twin of {{ORG.LEGAL_NAME}} — renders the same value (French Heritage Equestrian). No live template uses FHE.*; pick the ORG token.'),
  ('FHE','ADDRESS','Older twin of {{ORG.ADDRESS}} — same value (currently blank until the owner supplies the business address). Pick the ORG token.'),
  ('FHE','EMAIL','Older twin of {{ORG.EMAIL}} — same value (Hello@FHEquestrian.com). Pick the ORG token.'),
  ('FHE','PHONE','Older twin of {{ORG.PHONE}} — same value (858-439-3614). Pick the ORG token.'),
  ('FHE','URL','Older twin of {{ORG.URL}} — same value (www.frenchheritageequestrian.com). Pick the ORG token.'),
  ('FHE','SIGNATORY_NAME','Older twin of {{ORG.SIGNATORY_NAME}} — same value (Charles Zigmund). Pick the ORG token.'),
  ('FHE','SIGNATORY_TITLE','Older twin of {{ORG.SIGNATORY_TITLE}} — same value (Owner, Sole Proprietor). Pick the ORG token.'),

  -- ───────────────────────── HORSE — the horse named on the document ─────────────────────────
  ('HORSE','REGISTERED_NAME','The horse''s registered name, e.g. Beaumont de Cactai. Blank when the document names no horse. On multi-horse documents the horse block repeats once per horse.'),
  ('HORSE','BARN_NAME','The horse''s barn name (nickname), e.g. Beau. Blank if none recorded or no horse on the document.'),
  ('HORSE','BREED','The breed as its display name (looked up from the breed list), not the code. Blank if not recorded.'),
  ('HORSE','COLOR','The color as its display name (looked up from the color list). Blank if not recorded.'),
  ('HORSE','SEX','The horse''s sex as recorded, e.g. GELDING. Blank if not recorded.'),
  ('HORSE','AGE_DOB','The horse''s date of birth written out, e.g. April 12, 2016. It prints the DOB, never a computed age. Blank if no DOB recorded.'),
  ('HORSE','HEIGHT','The horse''s height as recorded, e.g. 16.2 hh. Blank if not recorded.'),
  ('HORSE','REGISTRATION_NUMBER','The registry/identification number. Blank if not recorded.'),
  ('HORSE','MICROCHIP','The microchip id. Blank if not recorded.'),
  ('HORSE','CURRENT_LOCATION','Where the horse is now — the linked location''s full label when one is set, otherwise the free-text location on the horse record.'),
  ('HORSE','VET_NAME','The horse''s designated veterinarian''s name. Blank if not recorded.'),
  ('HORSE','VET_PHONE','The designated veterinarian''s phone. Blank if not recorded.'),
  ('HORSE','FARRIER_NAME','The horse''s farrier''s name. Blank if not recorded.'),
  ('HORSE','FARRIER_PHONE','The farrier''s phone. Blank if not recorded.'),
  ('HORSE','FAIR_MARKET_VALUE','The horse''s fair market value as money, e.g. $25,000.00. Blank if not recorded.'),
  ('HORSE','KNOWN_CONDITIONS','Disclosed medical/behavioral conditions from the horse record. Blank if none recorded.'),
  ('HORSE','MEDICATION_NAME','The horse''s authorized medication name(s), composed from the horse''s medication schedule. Blank if no medications are recorded.'),
  ('HORSE','MEDICATION_DOSAGE','The dosage component of the horse''s medication schedule. Blank if none recorded.'),
  ('HORSE','MEDICATION_INSTRUCTIONS','The administration-instructions component of the medication schedule. Blank if none recorded.'),
  ('HORSE','MEDICATION_ADDITIONAL','Additional medication notes from the schedule. Blank if none recorded.'),
  ('HORSE','EUTHANASIA_A','Checkbox mark for euthanasia election A on the vet authorization: prints X when the horse''s record elects A, a space otherwise. Pair with HORSE.EUTHANASIA_B — exactly one prints X once the election is recorded.'),
  ('HORSE','EUTHANASIA_B','Checkbox mark for euthanasia election B on the vet authorization: prints X when the horse''s record elects B, a space otherwise. Pair with HORSE.EUTHANASIA_A.'),
  ('HORSE','OWNER_NAME','Meant to name the owner/seller of a third-party horse being evaluated — NOT WIRED: no template uses it and the merge renders nothing for it today (the horses.owner_name column it points at does not exist).'),

  -- ───────────────────────── ORD — the purchase behind the document ─────────────────────────
  ('ORD','SERVICE_SELECTION','The purchased item''s label from the most recent purchase line on the document''s contract, e.g. Riding Lesson — Single. Blank when no purchase is linked to the contract. (Live source is purchase_items.label; the old client_purchases pointer is dead.)'),
  ('ORD','UUID','WARNING (flagged 2026-08-12, awaiting owner ruling): despite the ORD name this prints the DOCUMENT''s internal UUID, not a purchase id — the recorded mapping and the merge code both point at documents.id. Do not place it expecting an order number; use DOC.ID for a readable document reference. The real order number lives on the purchase (PUR-000001 style) and has no token today.'),

  -- ───────────────────────── ORG — business identity and terms from Business Settings ─────────────────────────
  ('ORG','LEGAL_NAME','The business''s legal/trade name: French Heritage Equestrian. Always fills, from Business Settings.'),
  ('ORG','ADDRESS','The business address from Business Settings — CURRENTLY BLANK until the owner supplies it; the document will show an empty space where it is placed.'),
  ('ORG','ENTITY_FORMATION','How the entity is formed, e.g. Sole proprietorship (California). From Business Settings.'),
  ('ORG','REGISTERED_AGENT','The registered agent from Business Settings — currently blank until the owner supplies it.'),
  ('ORG','SIGNATORY_NAME','Who signs for the company: Charles Zigmund. From Business Settings.'),
  ('ORG','SIGNATORY_TITLE','The company signer''s title: Owner, Sole Proprietor. From Business Settings.'),
  ('ORG','CANCELLATION_FEE','The cancellation fee as money, e.g. $50.00 — CURRENTLY BLANK until the owner sets it in Business Settings.'),
  ('ORG','LATE_FEE','The late fee as money — CURRENTLY BLANK until the owner sets it in Business Settings.'),
  ('ORG','NO_SHOW_FEE','The no-show fee as money — CURRENTLY BLANK until the owner sets it in Business Settings.'),
  ('ORG','PHONE','The public contact phone: 858-439-3614. From org settings (CONTACT / PHONE).'),
  ('ORG','EMAIL','The public contact email: Hello@FHEquestrian.com. From org settings (CONTACT / EMAIL).'),
  ('ORG','URL','The public website: www.frenchheritageequestrian.com. From org settings (CONTACT / URL).'),
  ('ORG','LEGAL_IDENTITY','The full legal-identity clause used in party blocks (seeded in org settings; attorney wording pending). Fills from settings key ORG / LEGAL_IDENTITY.'),
  ('ORG','PRINCIPALS','The named principals/owners line used in the releases. Fills from org settings key ORG / PRINCIPALS (seeded).'),
  ('ORG','CANCELLATION_NOTICE_HOURS','A number of hours'' cancellation notice from org settings — NOT SEEDED, renders blank until the owner fills it in.'),
  ('ORG','INVOICE_DUE_DAYS','Invoice due days from org settings — NOT SEEDED, renders blank until the owner fills it in.'),
  ('ORG','TERMINATION_NOTICE_DAYS','Termination notice days from org settings — NOT SEEDED, renders blank until the owner fills it in.'),

  -- ───────────────────────── PARTICIPANT — the minor named on the document ─────────────────────────
  ('PARTICIPANT','FULL_NAME','The minor participant''s full name, from the PARTICIPANT party attached to the document. Blank when the document has no minor participant.'),
  ('PARTICIPANT','DOB','The minor participant''s date of birth, written out. Blank when the document has no minor participant.'),

  -- ───────────────────────── PARTY — generic any-party tokens; nothing uses them today ─────────────────────────
  ('PARTY','FULL_NAME','Generic any-party name — NO live template uses PARTY.*; bodies use the role-named namespaces (CLIENT, PARTICIPANT, LESSOR, LESSEE, BUYER, SELLER). Renders the same value as PARTY.PRINTED_NAME. Prefer the role-named token for the person you mean.'),
  ('PARTY','PRINTED_NAME','Generic any-party signature-line name — identical output to PARTY.FULL_NAME, and like it unused by any live template. Prefer the role-named token (e.g. CLIENT.PRINTED_NAME).'),
  ('PARTY','ADDRESS','Generic any-party one-line address. Unused by any live template — prefer the role-named token (e.g. CLIENT.ADDRESS, LESSEE.ADDRESS).'),
  ('PARTY','EMAIL','Generic any-party email. Unused by any live template — prefer the role-named token.'),
  ('PARTY','PHONE','Generic any-party phone. Unused by any live template — prefer the role-named token.'),
  ('PARTY','DOB','Generic any-party date of birth (was meant for the minor sections). Unused by any live template — prefer PARTICIPANT.DOB.'),
  ('PARTY','RELATIONSHIP','How a party is related to the client, e.g. parent of participant — from the document''s party record. Unused by any live template today.'),

  -- ───────────────────────── REQ — order-request inputs; the capture was never built ─────────────────────────
  ('REQ','PREFERRED_SCHEDULE','Meant to carry the client''s preferred dates/times submitted with an order — the order-form capture was never wired, so it ALWAYS RENDERS BLANK today.'),
  ('REQ','LOCATION_PREFERENCE','Meant to carry the requested service location from an order — never wired, ALWAYS RENDERS BLANK today.'),
  ('REQ','NOTES','Meant to carry free-text notes submitted with an order — never wired, ALWAYS RENDERS BLANK today.'),
  ('REQ','CONDITION_UPDATES','Meant to carry client-reported horse condition changes since the last engagement — never wired, ALWAYS RENDERS BLANK today.'),

  -- ───────────────────────── SIG — signature stamps, filled at signing, never at generation ─────────────────────────
  ('SIG','CLIENT.NAME','Signature stamp: stays visible as a placeholder until the client signs, then is replaced with the signer''s name. Never filled at generation — a draft still showing {{SIG.CLIENT.NAME}} is correct behavior, not a defect.'),
  ('SIG','CLIENT.DATE','Signature stamp: replaced with the date the client signs. Stays as a visible placeholder until then — that is correct behavior on drafts.'),

  -- ───────────────────────── TXN — money and deal terms ─────────────────────────
  ('TXN','COMMISSION_RATE','The commission percentage from Business Settings, picked by deal type — sale 15%, purchase 15% (lease rate unset). Prints like 15%. Blank when the rate for that deal type is not set.'),
  ('TXN','COMMISSION_MIN','The minimum commission as money: $500.00, from Business Settings.'),
  ('TXN','LEASE_FEE','The lease fee as entered on the deal''s working copy, printed as money, e.g. $1,200.00. Fills on clause-built lease contracts; blank anywhere there is no working-copy value.'),
  ('TXN','LEASE_START','The lease start date from the deal''s working copy. Fills on clause-built lease contracts.'),
  ('TXN','LEASE_END','The lease end date from the deal''s working copy. Fills on clause-built lease contracts.'),
  ('TXN','LEASE_TYPE','Full or partial lease, from the deal''s working copy. Fills on clause-built lease contracts.'),
  ('TXN','RENEWAL_TERMS','Lease renewal terms from the deal''s working copy. Fills on clause-built lease contracts.'),
  ('TXN','PERMITTED_ACTIVITIES','The permitted-use activities chosen on the lease working copy. Fills on clause-built lease contracts.'),
  ('TXN','COMPETITION_EXPENSES','Competition cost allocation from the lease working copy. Fills on clause-built lease contracts.'),
  ('TXN','PURCHASE_PRICE','The total purchase price from the sale working copy, printed as money. Fills on clause-built sale contracts.'),
  ('TXN','DEPOSIT_AMOUNT','The deposit from the sale working copy, printed as money. Fills on clause-built sale contracts.'),
  ('TXN','DELIVERY_DATE','The delivery date from the sale working copy. Fills on clause-built sale contracts.'),
  ('TXN','DELIVERY_LOCATION','The delivery location from the sale working copy. Fills on clause-built sale contracts.'),
  ('TXN','PAYMENT_TERMS','Payment timing/terms wording. NOTHING FEEDS IT TODAY — on the retainer/representation agreements it renders blank; a working-copy field must be added before those templates are used for a real engagement.'),
  ('TXN','RETAINER_FEE','The flat search-retainer fee. RENDERS BLANK TODAY — no working-copy field feeds the HORSE_SEARCH_RETAINER template; wire the fee before using that template for a real retainer.'),
  ('TXN','SUCCESS_FEE','The contingent success/acquisition fee on the search retainer. RENDERS BLANK TODAY — no working-copy field feeds it yet.'),
  ('TXN','REPRESENTATION_FEE','The flat representation fee on the transaction-representation agreement. RENDERS BLANK TODAY — no working-copy field feeds it yet.'),
  ('TXN','SERVICE_FEE','Old order-form fee token (flat lesson/placement fee). Nothing feeds it — renders blank; only the retired MINOR_RIDER body still references it. Historically shared one source with TXN.PACKAGE_FEE — owner to rule which name survives.'),
  ('TXN','PACKAGE_FEE','Old order-form token for a multi-lesson package price. No live template references it and nothing feeds it — renders blank. Historically shared one source with TXN.SERVICE_FEE — owner to rule which name survives.'),
  ('TXN','PAYMENT_SCHEDULE','Old installment-schedule token. Only the retired MINOR_RIDER body references it and nothing feeds it — renders blank. Do not place.'),
  ('TXN','SESSION_FEE','Old order-form per-session fee token. No live template references it and nothing feeds it — renders blank.'),
  ('TXN','MONTHLY_FEE','Old order-form monthly program fee token. No live template references it and nothing feeds it — renders blank.'),
  ('TXN','OTHER_FEES','Old order-form itemized-fees token. No live template references it and nothing feeds it — renders blank.'),
  ('TXN','EVALUATION_FEE','Old order-form per-horse evaluation fee token. No live template references it and nothing feeds it — renders blank.'),
  ('TXN','ADDITIONAL_SERVICES','Old order-form token for extra evaluation services and pricing. No live template references it and nothing feeds it — renders blank.'),
  ('TXN','JUMPER_TRAINING_FEE','Old order-form jumper-training rate token. No live template references it and nothing feeds it — renders blank.')
)
UPDATE template_tokens t
SET notes = d.note
FROM d
WHERE t.namespace = d.ns AND t.field = d.f;
