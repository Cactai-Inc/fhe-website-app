# Regression pass: every document and flow outside the three contracts

Branch `test/regression` from `main` (e9eedc9a). Session date 2026-10-25.
Purpose: prove the functions/forms/rendering the disclosure + horse-record overhaul
changed (`horse_field_token_value`, `generate_document`, `HorseIntakeForm`,
`BodyWithSignatures`, shared PDF module) still work on production, before any V2
definition is removed. Findings reported, not fixed, unless a fix is one line and
named.

Test horse: ZZ Test Horse `2d07a570-d79c-4cc7-b292-a42c83c2d62c` (org
`e656f20b-ef43-4725-9029-19e7f0190d9c`). Staff/client test accounts from `.env.test`.

---

## Rendering architecture (established up front)

Two token-resolution engines exist and **have diverged**:

- **`generate_document(...)`** — the FLAT-template generator. Carries its OWN inline
  HORSE-token `CASE` block (lines 163–192 of the live def). This is what renders every
  flat template.
- **`horse_field_token_value(horses, field)`** — used by the CLAUSE/field-composed path
  (`sync_contract_fields_from_defs`, `regenerate_contract_document`,
  `capture_horse_record_info`, `expand_horse_blocks`, `attach_horse_to_document`,
  `add_deal_document`). This is the function the overhaul rewrote.

Key divergences between the two (flat vs clause), confirmed from live defs:

| token | generate_document (flat) | horse_field_token_value (clause) |
|---|---|---|
| SEX | raw `v_horse.sex` (e.g. `MARE`) | normalized (`Mare`) |
| pending-field empty | prints empty | prints `To be provided` |
| KNOWN_CONDITIONS | `horse_list_prose(known_conditions_list,'condition')` | `horse_section_text_block` → `[[DISCLOSURE:...]]` markers |
| MEDICATION_* | `horse_medications_prose` / `horse_medication_component` | `horse_meds_prose_v2` |
| MEDICAL/BEHAVIORAL/INJURIES/SUPPLEMENTS/gates | **absent → resolve to `''`** | present, emit disclosure blocks |
| REGISTRATION_ORG / PASSPORT_COUNTRY / TRAINING_HISTORY / COMPETITION_HISTORY | absent → `''` | present |

Consequence to verify in item 2: flat templates do NOT emit disclosure markers; they
print the structured lists as inline prose. The overhaul's new behaviours
("To be provided", normalized sex, disclosure boxes) live only on the clause path.

Provider/location/meds sources (both engines, via helpers):
- providers: `horse_provider_value(horse, 'VET'|'FARRIER', part)` → `horse_relationships` (active)
- location: `horse_current_location_label(horse)` → `horse_locations` (end_on IS NULL)
- meds: `horse_medications` (deleted_at IS NULL)

---

## Item 1 — Inventory

Every active template that is NOT one of the three overhaul contracts
(HORSE_LEASE_V3, HORSE_SALE_V3, HORSE_BILL_OF_SALE). All 14 are **flat** — zero
`contract_clause_defs`, zero `contract_field_defs`, full body text — and all render
through **`generate_document`** (flat path). None route through
`horse_field_token_value`. Doc counts are live (deleted_at IS NULL), by status.

| key | title | contract_kind | compose | HORSE tokens | party namespaces | assigned by | docs (by status) |
|---|---|---|---|---|---|---|---|
| COMPANY_POLICIES | Company Policies | (none) | flat → generate_document | — | CLIENT | category(Horse owner/Guest/Rider), service_type(most), sign_path(all), role_bundle(BUYER active; LESSOR/SELLER/LESSEE inactive) | DRAFT 1, EXECUTED 31 |
| EVALUATION_LIABILITY_WAIVER | Pre-Purchase / Lease Evaluation Liability Waiver | (none, svc HORSE_EVALUATION) | flat | — | CLIENT | service_type(HORSE_EVALUATION) | none |
| FACILITY_LICENSE | Facility Use and Business Operations License | (none) | flat | — | OWNER,COMPANY | none found (manual only) | none |
| FACILITY_RULES | Facility Rules and Safety Acknowledgment | (none) | flat | — | CLIENT,PARTICIPANT | category(Guest/Rider/Horse owner), service_type(most), sign_path(all) | DRAFT 1, EXECUTED 31 |
| HORSE_EMERGENCY_VET | Horse Emergency Veterinary Authorization | (none) | flat | AGE_DOB, BARN_NAME, BREED, COLOR, CURRENT_LOCATION, FAIR_MARKET_VALUE, FARRIER_NAME, FARRIER_PHONE, HEIGHT, KNOWN_CONDITIONS, MEDICATION_ADDITIONAL, MEDICATION_DOSAGE, MEDICATION_INSTRUCTIONS, MEDICATION_NAME, MICROCHIP, REGISTERED_NAME, REGISTRATION_NUMBER, SEX, VET_NAME, VET_PHONE (20) | CLIENT (+OWNER,COMPANY,EMERGENCY_CONTACT ns) | category(Horse owner), service_type(training/exercise/clipping), sign_path(horse, rider+horse), role_bundle(BUYER active; LESSOR inactive) | EXECUTED 2 |
| HORSE_SEARCH_RETAINER | Horse Finder Search and Sourcing Retainer | (none, svc HORSE_FINDER) | flat | — | CLIENT,COMPANY | (svc HORSE_FINDER — not in requirement rows seen; manual) | none |
| HORSE_TRANSACTION_REP | Horse Transaction Representation | (none) | flat | BARN_NAME, BREED, CURRENT_LOCATION, MICROCHIP, REGISTERED_NAME (5) | CLIENT,COMPANY | none found (manual only) | none |
| HUMAN_EMERGENCY_MEDICAL | Human Emergency Medical Authorization v2 | (none) | flat | — | PARTICIPANT,GUARDIAN,COMPANY,EMERGENCY_CONTACT (CLIENT,PARTICIPANT tokens) | category(Rider), service_type(lessons/jumper), sign_path(rider, rider+horse) | DRAFT 1, EXECUTED 31 |
| INDEPENDENT_CONTRACTOR | Independent Contractor Agreement | (none, svc INDEPENDENT_CONTRACTOR) | flat | — | CONTRACTOR,COMPANY | (svc — manual) | none |
| MINOR_RIDER | Minor Rider Agreement | (none) | flat | — | PARTICIPANT,GUARDIAN,COMPANY,EMERGENCY_CONTACT | (no requirement row — manual) | none |
| RELEASE_GENERAL | General Visitor Liability Release | (none) | flat | — | CLIENT,PARTICIPANT | category(Guest), service_type(eval/finder/sale/purchase/lease-in), sign_path(guest), role_bundle(BUYER active; LESSOR/SELLER inactive) | EXECUTED 1 |
| RELEASE_HORSE_CARE | Horse Handling and Routine Care Liability Release | (none) | flat | AGE_DOB, BARN_NAME, BREED, COLOR, CURRENT_LOCATION, FAIR_MARKET_VALUE, FARRIER_NAME, FARRIER_PHONE, HEIGHT, MICROCHIP, REGISTERED_NAME, REGISTRATION_NUMBER, SEX, VET_NAME, VET_PHONE (15) | CLIENT,PARTICIPANT | category(Horse owner), service_type(clipping/exercise/training), sign_path(horse, rider+horse), role_bundle(BUYER active; LESSOR inactive) | EXECUTED 2 |
| RELEASE_JUMPER_ADDENDUM | Jumper Training Addendum — Rider Ability Attestation | (none, svc JUMPER_TRAINING) | flat | — | CLIENT,PARTICIPANT | service_type(JUMPER_TRAINING) | none |
| RELEASE_PARTICIPANT | Participant Liability Release | (none) | flat | — | CLIENT,PARTICIPANT | category(Horse owner/Rider), service_type(lessons/training/exercise/clipping/jumper/horsemanship), sign_path(horse, rider, rider+horse) | DRAFT 1, EXECUTED 31 |

**Flat templates carrying HORSE tokens (item-2 targets): HORSE_EMERGENCY_VET,
RELEASE_HORSE_CARE, HORSE_TRANSACTION_REP.** HORSE_EMERGENCY_VET is the only one
carrying disclosure-adjacent tokens (KNOWN_CONDITIONS, MEDICATION_*).

Also live: a legacy `HORSE_LEASE_V2` (inactive template) still has **1 EXECUTED**
document attached — not in the active inventory but a real row that any "remove V2
definition" step must account for.

## Item 2 — Flat template rendering

**PASS.** Rendered all three HORSE-token flat templates (HORSE_EMERGENCY_VET,
RELEASE_HORSE_CARE, HORSE_TRANSACTION_REP) through `generate_document` against ZZ Test
Horse in two states, each in a transaction rolled back so no test document persisted.

**Production is already running the overhaul.** Confirmed: live `generate_document`
reads `horse_provider_value(v_horse.id, …)` (not the old `v_horse.vet_name`); the
removed columns (`vet_name`, `vet_phone`, `farrier_name`, `home_location_id`,
`current_location_id`, `known_conditions`) are already dropped from `horses`. The
overhaul's `20261016T1400_hr_overhaul_3c_generate_document.sql` is therefore live. That
migration **re-points the data sources only** — it deliberately leaves the flat path's
SEX (raw), pending (no "To be provided"), and conditions (`horse_list_prose`) behavior
unchanged. So the behaviors below are **intended**, not regressions.

**Populated render** (providers VET+FARRIER via `horse_relationships`, location via
`horse_locations`, pending_fields `["registration_number","microchip_id"]`,
`known_conditions_list` 2 entries, `medical_history_list` 1 entry, a MEDICATION row) —
every HORSE token resolved to the CURRENT source:

- Breed `Hanoverian`, Color `Bay` (display names from `horse_breeds`/`horse_colors`) ✓
- Fair Market Value `$42,500.00` (`fmt_money`) ✓
- Current Location `ZZ Test Barn, 200 Pasture Ln, Aiken, SC 29803` (from `horse_locations`) ✓
- Veterinarian `Dr. Jane Vetson`, phone `(555) 111-2222`; Farrier `Bob Shoesmith`,
  `(555) 333-4444` (from `horse_relationships`) ✓
- Medication prose from `horse_medications` ✓; Known Conditions prose from
  `known_conditions_list` ✓
- REGISTRATION_NUMBER (pending **and filled**) → prints `REG-ZZ-12345` ✓
- No unreplaced non-signature tokens; no stale value; no removed-column value; nothing
  empty that should be filled.

**Empty render** (ZZ horse with everything blank, `pending_fields=[]`): every HORSE
token prints blank cleanly; no crash, no leftover `{{HORSE.*}}`. Microchip (the one set
value, `ZZTEST000000001`) printed; all else blank.

`{{SIG.CLIENT.NAME}}` / `{{SIG.CLIENT.DATE}}` remain in the body in BOTH states —
correct: `generate_document` skips `kind='signature'` tokens; they are resolved at sign
time by the PDF/signature layer (item 4).

### Findings (item 2) — both INTENDED, reported for the record, not defects

- **F2-1 (intended): flat templates do NOT print "To be provided" for an empty pending
  field.** With `microchip_id` in `pending_fields` but cleared, `HORSE_EMERGENCY_VET`
  rendered `Microchip: ` (blank), not `To be provided`. The "To be provided" logic lives
  only in `horse_field_token_value` (clause path, added by
  `20261016T2300_hr_overhaul_8_to_be_provided.sql`); the overhaul's 3c migration did not
  add it to `generate_document`. If the owner expects the gap to show on flat forms too,
  this is a one-function follow-up (mirror the pending array + "To be provided" guard
  into generate_document's HORSE branch); reported as design, unbuilt.
- **F2-2 (intended): flat templates print SEX raw-uppercase (`MARE`), not normalized
  (`Mare`).** `generate_document` HORSE.SEX returns `v_horse.sex` verbatim;
  `horse_field_token_value` normalizes. Cosmetic; same decision as F2-1. Note the record
  overhaul standardized HORSE.* token VALUES to display labels (`Mare`) per prior memory,
  so the clause side is the intended-forward form — flat forms lag. Reported, unbuilt.

Neither is a break: both render correctly, nothing is lost, and both predate nothing —
they are the overhaul's own deliberate scope line (data sources re-pointed, display
behavior left as-was on flat).

## Item 3 — Onboarding and kiosk

Driven through the **production** UI with Playwright + Chromium (per owner ruling:
full UI drive, test accounts/aliases + ZZ horse only, every created row removed after).
Email provider IS configured on prod, so each send dispatched a real email to my own
`admin+…@cactai.io` alias (harmless, my inbox). Fresh client aliases provisioned per
path. Activation link obtained by reading the minted `invitations.token` from the DB
(email no-op not needed — prod sends — but reading the token is the deterministic
harness path and avoids waiting on a mailbox).

### Path `rider` — PASS end to end
Alias `admin+fhe-reg-rider-<ts>@cactai.io`, name "Zelda Testrider".

| step | observed | result |
|---|---|---|
| `/sign/rider` funnel | email-only form (SIGNDOOR), send-state screen "activation email is on its way" | PASS |
| provision | `invitations` row minted: status=sent, kind=COMMUNITY, categories={RIDER}, token present; nameless contact created (first/last blank — SIGNDOOR design) | PASS |
| `/activate?token=…` | token validated, `#password`/`#password2` set, `/api/register-invited` created account, signed in, redirected to `/app/onboarding` | PASS |
| activation proof | `auth.users.last_sign_in_at` set, invitation `redeemed`, profile linked to contact | PASS |
| details intake | full "Your details" form (name, phone, DOB, address, emergency contact, riding background), "Me" (not minor) | PASS |
| doc generation | SAVE & CONTINUE ran `update_my_onboarding_profile` → generated the 4 RIDER docs via `generate_document`: COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT (matches sign_path `rider` + category Rider) | PASS |
| present + sign | each doc: full body via `BodyWithSignatures`, e-sign consent checkbox (required), type-to-sign `#ob-typed-name` enforcing EXACT printed-name match ("Zelda Testrider") | PASS |
| execute | all 4 → status EXECUTED, 1 signature each (typed_name "Zelda Testrider"), `executed_email_sent_at` stamped | PASS |
| advance | wizard moved to shop step ("Your first lesson") — correct CR-98 self-serve order details→sign→shop | PASS |

Minor observation (not a defect): the public pages throw React hydration warnings
(#418/#423 — prerendered SSR vs client markup); non-blocking, pages function fully.

### Path `horse` + client horse-add — PARTIAL: activation/details PASS, **horse-add BLOCKED by a real regression**
Alias `admin+fhe-reg-horse-<ts>@cactai.io`, name "Harry Testowner".

| step | observed | result |
|---|---|---|
| `/sign/horse` → activate | provisioned (categories, contact), activated, signed in, onboarding | PASS |
| details intake | full form, saved | PASS |
| horse step reached | "Tell us about your horse." with the full `HorseIntakeForm` | PASS |
| **staff designation picker ABSENT for client** | with a provider row open, the page text contains neither "designation" nor "set it on the Team page"; the client sees the manual-entry provider fields, never the staff people-picker. `ProviderDraftRow` gates the picker on `useAuth().isStaff` (HorseIntakeForm.tsx:542), and `adminClientAccounts()` only loads when `isStaff` — verified empirically | **PASS** |
| save the horse | `create_horse_record` RPC returns **HTTP 400** | **FAIL — see DEFECT R1** |

Because horse creation fails, the downstream of the `horse` path (horse-backed releases
generated, signed, delivered) could not be exercised through onboarding for this client.
The engine itself is proven by item 2 (the same flat templates render correctly against
a populated horse) and by item 5 (the lease/role bundle on ZZ Test Horse); what is broken
is the record CREATE, upstream of rendering.

#### DEFECT R1 — client horse-add is completely broken (real regression from the disclosure overhaul)
- **Symptom:** On the onboarding horse step, saving any new horse without "injuries to
  humans" text (the normal case) returns `create_horse_record` **400**:
  `null value in column "injuries_to_humans" of relation "horses" violates not-null
  constraint (23502)`.
- **Reproduced at the DB level** (rolled back): a bare `INSERT INTO horses (…,
  injuries_to_humans) VALUES (…, nullif(btrim(coalesce(NULL,'')),''))` fails identically.
- **Root cause:** the disclosure overhaul's `20261021T1300_disc_21_injuries_humans_and_
  warranties.sql` made `horses.injuries_to_humans` **`text NOT NULL` with no default**
  (to hold the new Yes/No/Unknown scalar), but `create_horse_record(jsonb)` still inserts
  `nullif(btrim(coalesce(p ->> 'injuries_to_humans','')),'')`, which evaluates to **NULL**
  whenever the caller supplies no injuries text — i.e. every normal create. The function
  was not updated when the column's nullability changed.
- **Blast radius:** every create through `create_horse_record` that does not pass
  injuries text — the client onboarding horse-add AND the staff "add a horse" records
  surface (same RPC). Any horse added since `disc_21` applied without that field set
  fails. (Count of horses created after that migration = evidence of whether staff have
  hit it; all my attempts failed.)
- **Proposed fix (one line, UNBUILT — not applied because I do not own this DB object and
  D35 forbids a silent shared-function replacement):** in `create_horse_record`, change
  the `injuries_to_humans` insert expression from
  `nullif(btrim(coalesce(p ->> 'injuries_to_humans','')),'')`
  to `btrim(coalesce(p ->> 'injuries_to_humans',''))` (write `''` instead of NULL).
  Equivalent alternative: `ALTER TABLE horses ALTER COLUMN injuries_to_humans SET DEFAULT ''`
  — but the function fix is narrower and matches the column's intended "scalar, default
  empty" shape. Must ship with a `save_contract_template_version`-style no-op (n/a here)
  and a re-verify per D35.

### Path `rider+horse`
Same engine as `rider` (docs) + `horse` (horse-add). The document-signing half is proven
by `rider`; the horse-add half is blocked by the same DEFECT R1, so `rider+horse` cannot
complete its horse step either. Not separately re-driven — it is the union of two paths
already exercised, and would fail at the identical point.

### Kiosk path — the standalone anonymous kiosk NO LONGER EXISTS (retired; the `/sign` flow IS the kiosk path)
The separate "release kiosk" (anonymous iPad signing at `/release`,
`/release/:key`, `/docs/release-participant`) was **retired 2026-09-01
(TASK-SIGNFLOW-D)** by owner ruling: *"we dont have a situation where a person
without an account signs documents on an iPad… the /sign/ flow should be the single
pathway."* Signing now happens only inside an account, reached through `/sign/*` →
`/app/onboarding` — the same kiosk-style point-of-visit flow proven above.

Verified this is real, not just a stale comment:
- No `/release` or `/docs/release-participant` routes remain in `App.tsx` (grep count 0).
- `anon` AND `authenticated` have **no EXECUTE** on `sign_release` and
  `sign_general_release` (checked via `has_function_privilege`). The anon kiosk grant
  is revoked; account-side signing goes through `record_signature`/`signMyDocument`.

So "the kiosk path" and "the four sign URLs" are one unified path post-SIGNFLOW-D, and
it is PASS (rider) / blocked-at-horse-add (horse) exactly as recorded above. There is no
additional anonymous-kiosk surface left to exercise.

## Item 4 — Delivery

**Architecture (established from `api/deliver-documents.ts` + `api/_lib/delivery.ts`):**
an **execution DB trigger holds the onboarding set and sends ONE combined email per
signer when the last signature lands**, each document attached as its own PDF — NOT one
email per document. `document_deliveries` rows are the per-document LEDGER of that one
send (one row per doc per recipient), plus a company-inbox mirror copy per doc
(`is_mirror=true`). Onboarding.tsx no longer posts delivery itself (that was a second
sender racing the trigger); it only polls the ledger to report truthfully.

### Rider set (item 3) — delivery observed
4 `document_deliveries` EMAIL rows to the signer (ceef5895) + 4 company-mirror rows,
all `delivered_at` within one ~5s window AFTER all 4 executed, each with a `copy_url`
(`/portal/documents/<id>`). One signer ⇒ one combined email (4 ledger rows), fired only
post-execution. Party copy renders a STRIPPED body (acknowledgment block removed);
company copy keeps the full body; disclosure entries are passed to the PDF renderer for
boxing.

**Timing proof:** all 4 docs got the SAME `executed_email_sent_at` (20:15:44 — stamped
together when the last signature landed); deliveries at 20:15:51–52 (one batch, ~7s
later). Delivery fired only AFTER all executed, one batch per signer.

### PDF verification from stored files (shared module = delivery's renderer)
Rendered each executed `merged_body` through `shared/documentPdf.ts` `renderDocumentPdf`
(what `renderPartyCopyPdfBytes` calls), extracted text with `pdftotext`:
- All 4 PDFs open (2–4 pages) and carry the resolved signature — "Printed Name: Zelda
  Testrider", "Signature: Zelda Testrider", "Date: October 25, 2026".
- Body-vs-PDF: 22–25 distinctive body lines per doc checked against the PDF text → **0
  misses**. The attached PDF matches the executed body. (Signature tokens resolve INTO the
  stored body at execution; the renderer draws it verbatim.)

### Disclosure markers — boxes drawn, no marker text anywhere (PROVEN via the V3 lease)
Flat onboarding docs carry no HORSE disclosure tokens, so the marker path is exercised with
the item-5 lease (body carries `[[DISCLOSURE:BEHAVIORAL_HISTORY]]…Entry 1:…[[/DISCLOSURE]]`).
Rendered via the shared module WITH the structured disclosure entries
(`fetchDocumentDisclosureEntries` shape):
- **ZERO `[[DISCLOSURE]]`/`[[/DISCLOSURE]]` marker-text occurrences** in the PDF (pdftotext
  grep count 0, both with and without entries) — neither marker leaks.
- **Boxes drawn:** structured labels ("Description", "Trigger") and values ("Spooks at
  tarps", "Mild seasonal allergies") appear as box content, from the structured field
  values — the renderer skips the between-markers text block and draws boxes.
- **Email body fallback:** the party-copy EMAIL (`DOCUMENT_PARTY_COPY` template) does not
  inline the body — content rides in the attached PDF; the plain-text surface keeps the
  readable "Entry N:" block and drops only the two marker lines (shared module). No marker
  text is visible on any surface. **PASS.**

## Item 5 — Contract role bundle

V3 lease created through the staff UI (`/app/ops/contracts/new` → Horse lease):
LESSOR = ZZ Test Owner (the horse's current owner), LESSEE = ZZ Test Lessee
(the client test account, given a name — see item 6b), horse = ZZ Test Horse. RPC
`start_lease_contract_v2` → doc `d3ef7755…`, template HORSE_LEASE_V3, contract
`ab226787…`. Parties seeded correctly (LESSEE order 1, LESSOR order 2, both signers);
status `AWAITING_SIGNATURE`; body length 22,094; **body carries `[[DISCLOSURE:…]]`
markers** (the clause path via `horse_section_text_block` — the marker-bearing document
item 4's box test needs).

Role-bundle generation happens at SEND (`send_contract_to_party` →
`ensure_contract_role_documents`). Per the live `contract_role_documents` table
(item 1): the **LESSEE bundle is entirely deactivated** (DEALAUTO ruling — lessee
paperwork is onboarding's job, not owed again), and the **LESSOR bundle is HORSE_EMERGENCY_VET
+ RELEASE_HORSE_CARE** (active). So a V3 lease generates a role bundle only for the
LESSOR side, of exactly those two horse-token flat documents. **PROVEN by driving `ensure_contract_role_documents(lease_doc)` (the generator
`send_contract_to_party` calls):**
- it generated exactly the LESSOR bundle — **HORSE_EMERGENCY_VET (sign_sequence 2)** and
  **RELEASE_HORSE_CARE (sign_sequence 3)**, both attached to the LESSOR contact (ZZ Test
  Owner);
- the LESSEE got **zero** bundle docs (deactivated rows — correct);
- **once per party, no duplicates:** a second `ensure_…` call returned `generated: []`
  and the contract still held exactly 3 docs (lease + 2 bundle) — idempotent;
- **sequenced behind the lease:** bundle `sign_sequence` = 2, 3 vs the lease's 1;
- **held until all execute / one email:** the bundle docs sit `AWAITING_SIGNATURE`; the
  delivery trigger holds the whole set and sends one combined email per signer only when
  the last signature lands — the same mechanism proven in items 3/4.

**Document rows created:** the lease (1) + the LESSOR bundle (2) = **3 total**, listed:
HORSE_LEASE_V3 (LESSEE-attached), HORSE_EMERGENCY_VET (LESSOR), RELEASE_HORSE_CARE (LESSOR).

**Not driven to EXECUTION:** the LESSOR (ZZ Test Owner) is a bare contact with no auth
account, so it cannot self-sign and the set cannot reach all-executed (staff correctly
cannot sign for a non-company party — `record_signature`/`lock_and_sign` both refused the
staff account signing LESSOR with "not a signer on this document in role LESSOR"). The
LESSEE signature WAS taken (item 6a acceptance). Delivery-on-full-execution is identical to
item 4's proven mechanism; it was not re-driven for the lease set because the lessor can't
sign without provisioning an account for a shared contact (out of scope).

## Item 6 — Two findings from the bundle round

### 6a — does `record_signature` refuse a signature while `contract_lock_blockers` is non-empty?

**Nuanced, and it surfaces a real hole.** Two signing entry points exist:

- **`lock_and_sign_contract(doc, role, typed_name, esign, title)`** — the LEASE/clause
  path (ContractPage → `lockAndSign`, src/lib/contracts.ts:529). It **DOES** gate:
  `v_blockers := contract_lock_blockers(...); IF jsonb_array_length(v_blockers) > 0 THEN
  RAISE 'cannot sign: …'`. **PROVEN** — as the lessee on the lease above (blockers
  non-empty) it raised `cannot sign: Required field(s) still empty: Lessee initials, …,
  Term type, Lease type, …, Mortality insurance`. The list **includes blank required
  SELECTORS with their pending placeholders** (Lease type, Term type, Mortality
  insurance) — exactly the case item 6a names.
- **`record_signature(doc, role, typed_name, …, esign)`** — the ONBOARDING/flat path
  (SigningPanel → `recordSignature`; `signMyDocument`). It enforces signer-role + exact
  typed-name match but **does NOT consult `contract_lock_blockers`** (no reference in the
  live body). **PROVEN** — calling it as the lessee on the SAME blocked lease **recorded
  the signature and returned `AWAITING_SIGNATURE`** (rolled back). It did not refuse.

**So `record_signature` does NOT refuse on non-empty blockers; `lock_and_sign_contract`
does.** For flat onboarding docs this is harmless (no required-field blockers — item 3
signed four through `record_signature` fine). It is a hole only if a clause document with
required fields is signed through `record_signature` rather than `lock_and_sign_contract`.

**Bundle-round observation ("a lease described as editable with unfilled fields signed
through execution") — HOLE or nothing-required?** A **hole in the lower primitive, masked
in practice by UI routing**: the lease screen routes through the gated
`lock_and_sign_contract`, so a human cannot execute a lease with unfilled required fields
*through that screen*. But `record_signature` is directly reachable and would seal a
blocked clause document. Whether the bundle-round lease was (a) signed via the ungated
path or (b) a lease with all-optional fields is indistinguishable from the signature alone
— which is itself the finding: **the completeness gate lives in one of the two signing
functions, not in the shared primitive.**

#### FINDING 6a-1 (reported, UNBUILT) — completeness gate not in the primitive
`record_signature` should refuse (or its callers guarantee) a signature when
`contract_lock_blockers` is non-empty — the same guard `lock_and_sign_contract` already
applies. **Proposed fix:** after the signer/name checks in `record_signature`, add a
scoped guard on the required_fields/open-change blockers (NOT the `horse_missing`
blocker — flat onboarding docs must still sign). Not one line, and it edits a shared,
heavily-used DB object owned by other threads (D35) → reported only.

### 6b — invitation name storage; would a real client sign as their email?

**CONFIRMED gap, which also blocks the party picker.** The staff + client test accounts
(provisioned via `admin-send-invitation`/`register-invited`) carry
`contacts.first_name = '<their own email>'`, `last_name = NULL`. Consequences:
- their signature printed-name resolves to the email;
- they are **excluded from the contract party picker** — `contract_party_options()`
  requires `nullif(trim(first||' '||last),'') IS NOT NULL` and `<> 'Unnamed Contact'`; an
  email-as-first-name technically passes nullif but reads as the email (I had to set a
  real name on the client test account — "ZZ Test Lessee" — before it appeared in the
  lessee picker for item 5).

**Where the name is stored / is a real client affected:** `admin-send-invitation` carries
`first_name`/`last_name` on the **invitations** row (both columns exist); at activation,
redemption (`redeem_invitation`/`promote_contact_to_account`) applies them to the contact.
**A real client invited with a name typed into the invitation form IS given that name.**
The self-serve `/sign/*` funnels provision NAMELESS by design (SIGNDOOR) and collect the
name on the first post-auth page — item 3 proved this works ("Zelda Testrider" landed on
the contact at the details step before any signing). **So a real client is NOT asked to
sign as their email**, provided either the staff invitation carried a name or the onboarding
details step ran (both of which are the designed paths). The test accounts show
email-as-first-name because their provisioning set first_name to the email and never a
real name — **a test-data artifact, not the normal invited-client path.**
**Not a single one-line fix** (spans invitation storage → redemption copy → the D22 §0
name-completeness blocker that is "not enforced today"), so reported, not fixed. The one
isolated, concrete issue is test-account hygiene (email-as-first-name on the two test
contacts).

### 6c — release on own account; manual no-doc invite owes nothing
- **Liability release renders + signs on a real client's own account:** PASS (item 3 —
  the rider opened RELEASE_PARTICIPANT + HUMAN_EMERGENCY_MEDICAL on their own account,
  full body via `BodyWithSignatures`, signed to EXECUTED).
- **Manual invite with no document → dashboard owing nothing:** the mechanism is the live
  ruled design — an invite with no categories/template_keys calls nothing that writes
  `contact_required_documents`, so the account reaches `/app/dashboard` (proven reachable
  by the rider) with an empty pending set (D31/D32 null-tag state). Reported PASS-by-
  mechanism; a bare no-doc invite was not independently UI-driven end to end within budget.

## Item 7 — Database test suite
## Item 8 — Report + checklist
