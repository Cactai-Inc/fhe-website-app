# Unviewed inventory — batches 5–8

> *"An artifact the owner has never seen is not dead code — it is unreviewed inventory."*

This file shows you **45 artifacts you have never looked at**, so you can judge each one for
yourself. **Nothing here is recommended for deletion. No code was changed.** Every block pastes
the real content — the actual clause text, the actual email wording, the actual SQL, the actual
page copy — rather than describing it.

**Source:** `master-inventory.txt` entries `[INV batch5.md#77]` through `[INV batch8.md#130]` —
54 raw entries, deduped to 45 artifacts. Nine entries were repeat sightings of the same template
or page reported by different tasks (HORSE_LEASE_STANDARD alone was reported four times;
ContactsPage and `/app/ops` three and two times respectively).

**Verified against:** working tree at `86283dc`, and the live production database (`SELECT`-only)
as of 2026-08-13.

---

## Read this first — seventeen of these entries were wrong or have gone stale

These entries were written days or weeks ago and parallel threads have moved underneath them.
Every block below re-verifies its claim against current code and current prod, and says so when
the claim no longer holds.

### The one that matters most

**The eleven "dark by design" module pages are not dark.** TASK-ADMINSWEEP reported
boarding (×4), barn-ops (×4) and employees (×3) as unreachable because their modules were off.
All three modules flipped `enabled=t` on 2026-08-12, `org_page_visibility` has zero rows, and the
nav rows pass the filter at `AppLayout.tsx:659-662`. **3,373 lines of fully-built boarding,
barn-ops and employees software — including an append-only consumption ledger and a billing
resolver — is live and navigable in your app today.** You may never have clicked it. Per-page
copy and line counts are in that block.

### The rest, in one table

| # | The report said | What is actually true now |
|---|---|---|
| 1 | `ensure_gift_buyer_account` is dead code, zero callers | **Wrong — it is live.** `create_gift` calls it; GIFTCREDITS revived the call site on 08-11, after the report. The original three-way check missed it because plpgsql calls leave no `pg_depend` row. |
| 2 | `service_credits` has 0 rows | **Stale — 3 rows**, all created 2026-08-10, two already decremented. Live data, not an empty shell. |
| 3 | `caller_is_document_party` isn't wired into `documents_select` / `my_documents()` | **Gap is closed.** DOCVIS landed after the report; it is OR'd into both. |
| 4 | `void_signatures_on_edit` is dead but anon-executable | **The function is gone**, dropped by a NOGUARD2 migration. Source recovered here from the schema fixture so you can still see what it did. |
| 5 | Six anon-callable mutators (`apply_field_formats`, `seed_cascade_fields`, `affiliation_reconciliation`, …) | "No callers" holds; **"anon-callable" is stale** — all revoked to `{postgres,service_role}`. |
| 6 | MINOR_RIDER is a "body-less" template | **Wrong — a complete 5,481-character agreement**, pasted in full. (HORSE_REPRESENTATION, named in the same breath, genuinely is empty.) |
| 7 | FACILITY_LICENSE / INDEPENDENT_CONTRACTOR are active with empty bodies, so a user could reach an empty contract | **The alarm is wrong.** Both bodies are SQL `NULL`, and `generate_document` raises `template X has no body loaded` before rendering anything. They are unreachable stubs, not a live hazard. |
| 8 | Four lease documents sit on HORSE_LEASE_V2; STANDARD has 144 clauses / 117 fields | **Six** documents, and **163 clauses / 114 fields**. Byte-identity of the four forks is now *proven* in SQL rather than asserted. |
| 9 | There is no shared `PageHeader` component anywhere | **One exists** and has for days. The surviving finding is adoption: 10 of 113 pages use it; 94 files still hand-roll an `<h1>` across 20 class variants. |
| 10 | No `/app/stable` route exists | **It shipped.** Route registered, in the nav, reachable. |
| 11 | ContactsPage redirects to `/app/admin`, nav item hidden | Retirement intact, but the **redirect target moved** to `/app/records/clients`, and it is **clickable again** from the admin Review nav. |
| 12 | `/app/ops` (OpsHome/OpsDashboard/InstructorHome) is unreachable, trainers have no home | **Stale — reachable.** `reviewSection.ts:356-361` gives it and the InstructorHome preview real admin nav rows. |
| 13 | `/app/ops/horses` has zero references outside its route | **Stale** — now carries the Review nav row "Horses B · 07-01 original". |
| 14 | CJ's contract-invite link landed on an unwired page | **Not supported.** The whole chain verified end to end (`api/contract-invite.ts:116` → `/activate?token=…&kind=contract` → `Register.tsx` → `redeem_contract_invitation` → `/app/contracts/:id`), and CJ's invitation row reads `redeemed`. The only real defect is copy: the valid-token screen still says "Sign in to activate your account" with no mention of a contract. Live-browser confirmation remains **UNRESOLVED**. |
| 15 | IntakePage's nav entry was removed (`cefaad7`); route still reachable from dashboard links | Commit verified, but a **second** retirement (LEADCLEAN, `INTAKE_PAGE_RETIRED=true`) closed the route. The dashboard links now expand in place; zero links reach it. |
| 16 | Community → Resources lists content_resources but exposes no download control | Zero callers confirmed, and the root cause is upstream (`fromResource` discards `storage_path`/`file_id`). But **`content_resources` has 0 rows** — a latent gap, not stranded published guides. |
| 17 | The FHE company contact fails `admin_client_accounts()` arm 3's type check | True, but there are **two independent blockers**: `PartyCell` branches on `is_company` and never emits a link at all, so the arm-3 check is never even reached. |

### Four things nobody was looking for

- **`affiliation_reconciliation()` is not a dead dump — it is reporting a live defect.** Running
  it shows Mary Richardson (CON-000052) derives `{HORSE_OWNER, RIDER}` but has `{}` stored
  groups, which gates her nav and her onboarding documents. It also surfaces a deleted contact
  still carrying RIDER, and two duplicate-contact pairs.
- **`start_bill_of_sale_standalone` is the cash-sale path.** It creates its own contract and sets
  `TXN.BOS_HAS_SALE_AGREEMENT='NO'` — a real business case ("sold, no written agreement") with no
  way to reach it from the UI.
- **The deleted RIDER_LESSON_JUMPER template is the outlier of the six.** It was a full signed
  liability addendum; its live successor drops roughly **3,200 characters of jumping-specific
  risk, assumption-of-risk and indemnification language**. All six deleted files are pasted here
  complete (16,814 chars total) so you can decide whether that loss was intended.
- **HORSE_LEASE's stored body carries 6 triple-encoded mojibake em-dashes** (a healthy template
  has zero) — a latent encoding defect in the 18,253-character historical reference.

---


# Part 1 — Contract templates and template tokens


Evidence gathered read-only against prod (`SELECT` only) and the git history of
`/Users/cactai/Downloads/claude-code-repo/wt-flagharvest`. **Nothing is recommended for deletion.**
Every block below shows actual content so the owner can judge stub vs. golden egg.

Two prior claims turned out to be **wrong** and are corrected in place:
- MINOR_RIDER is *not* body-less (block 2).
- FACILITY_LICENSE / INDEPENDENT_CONTRACTOR being "active + empty" does **not** mean a user can
  reach an empty contract — `generate_document` refuses them (block 4).

---

## 1. HORSE_LEASE — v1 flat lease template (contract_templates row + supabase/contract_templates/HORSE_LEASE.md)

- reported by: PROMPT_A_STAGES_1-3.md, TASK-LEASEFORK-REPORT.md, TASK-LEASESET-REPORT.md
- reachability: **Unreachable, three independent ways.**
  (a) Row is `active=false` AND `deleted_at='2026-08-02 11:04:53.675525+00'`; `generate_document`
  opens with `SELECT * FROM contract_templates WHERE template_key = p_template_key AND active AND
  deleted_at IS NULL` and raises `'unknown or inactive contract template: %'` when not found —
  so the key cannot generate a document at all.
  (b) It appears in **zero** rows of `contract_requirements`, `contract_role_documents`,
  `category_document_requirements`, `contact_required_documents` (all verified `NONE`).
  (c) The repo generator explicitly excludes it:
  `scripts/build-template-load-migration.mjs:66` — `const RETIRED = new Set(['HORSE_LEASE', 'HORSE_PURCHASE_SALE', 'HORSE_SALE_TRANSFER']);`
  so its `.md` is never re-loaded into the body.
- exists: **yes** — row present (soft-deleted), and `supabase/contract_templates/HORSE_LEASE.md` present in the working tree (4,515 bytes).

**Claims verified:**

| Claim | Verdict | Evidence |
|---|---|---|
| inactive | ✅ | `active=f`, `deleted_at=2026-08-02` |
| 0 documents | ✅ | `select count(*) from documents where template_id='8d33612d-1064-4336-a386-130d99a15f7f'` → **0** (including soft-deleted) |
| ~104 body tokens | ✅ **exactly 104 distinct** (105 occurrences) |
| ~98 registry rows in contract_field_defs | ✅ **exactly 98** |
| zero sections, zero clauses | ✅ `contract_section_defs`=0, `contract_clause_defs`=0 |
| 18,253-char flat body | ✅ `length(body)=18253` |

Row:
```
template_key = HORSE_LEASE
title/short_label = Lease agreement
contract_kind = HORSE_LEASE
active = false
version = 1
body length = 18253
draft_body = NULL
deleted_at = 2026-08-02 11:04:53.675525+00
id = 8d33612d-1064-4336-a386-130d99a15f7f
```

### ⚠ Data defect found in the archived body (not previously reported)

The stored body contains **6 triple-encoded UTF-8 mojibake sequences** where em dashes should be.
The byte run at "Contract Location(s) …" is `U+C3 U+83 U+C2 U+A2 U+C3 U+82 U+C2 U+80 …` — an em dash
that was UTF-8-encoded three times at load. Count of `chr(195)` ("Ã") in the body: **6**.
The same count on a healthy template (`RELEASE_PARTICIPANT`) is **0**.
If the owner ever resurrects wording from this archive, those six spots need repair.

### Content — first ~70 lines of the 18,253-char body (verbatim; the `Ã…` run below is the mojibake)

```
HORSE LEASE AGREEMENT

This Horse Lease Agreement ("Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") between the Lessor and Lessee identified below.

LESSOR (HORSE OWNER)

Name: {{LESSOR.FULL_NAME}}
Address: {{LESSOR.ADDRESS}}
Phone: {{LESSOR.PHONE}}
Email: {{LESSOR.EMAIL}}

LESSEE

Name: {{LESSEE.FULL_NAME}}
Address: {{LESSEE.ADDRESS}}
Phone: {{LESSEE.PHONE}}
Email: {{LESSEE.EMAIL}}

HORSE INFORMATION

Registered Name: {{HORSE.REGISTERED_NAME}}
Nickname: {{HORSE.BARN_NAME}}
Breed: {{HORSE.BREED}}
Color: {{HORSE.COLOR}}
Markings: {{HORSE.MARKINGS}}
Sex: {{HORSE.SEX}}
Age / Date of Birth: {{HORSE.AGE_DOB}}
Height: {{HORSE.HEIGHT}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Registration Organization: {{HORSE.REGISTRATION_ORG}}
Microchip / Identification: {{HORSE.MICROCHIP}}
Passport Number: {{HORSE.PASSPORT_NUMBER}}
Passport Country: {{HORSE.PASSPORT_COUNTRY}}
Current Fair Market Value: {{HORSE.FAIR_MARKET_VALUE}}

HORSE LOCATION

Home Location (normal boarding residence): {{HORSE.HOME_LOCATION}}

Contract Location(s) [MOJIBAKE: should be an em dash] where the Horse will reside during the Lease Term: {{TXN.CONTRACT_LOCATIONS}}

Lessee's Obligation to Update Location. Lessee shall keep the Horse's location current and accurate at all times and shall promptly notify Lessor and French Heritage Equestrian of any change to the Horse's boarding or residing location, so the Horse can be located and every party who needs to know its whereabouts has accurate information at all times.

The Current Location of the Horse is updated in accordance with the terms of this Lease. Current Location: {{HORSE.CURRENT_LOCATION}}

1. PURPOSE AND LEASE GRANT

Lessor owns, or has legal authority to lease, the Horse identified above and grants Lessee the right to use and ride the Horse during the Lease Term under the conditions of this Agreement. Lessee wishes to ride and handle the Horse and agrees to the terms of this Agreement in exchange for the consideration described herein.

Lease Type: {{TXN.LEASE_TYPE}}
Lease Term: {{TXN.LEASE_TERM}}
Commencement Date: {{TXN.LEASE_START}}
Expiration Date: {{TXN.LEASE_END}}
Renewal Terms: {{TXN.RENEWAL_TERMS}}

2. HORSE'S CONDITION AND OWNERSHIP

To the best of Lessor's knowledge, the Horse is currently sound and in good physical condition, except as noted here: {{TXN.CONDITION_EXCEPTIONS}}. To the best of Lessor's knowledge, the Horse has no history of dangerous behavior, except as noted here: {{TXN.BEHAVIOR_EXCEPTIONS}}.

Lessor recommends that Lessee obtain an independent veterinary examination of the Horse at Lessee's expense prior to entering into this Agreement. If Lessee declines to do so, Lessee accepts the risk of health or soundness issues that are not apparent.

Except for the representations stated in this Agreement, Lessor makes no warranties, express or implied, regarding the Horse, including any warranty of fitness for a particular purpose.

Lessor warrants that Lessor is the lawful owner of the Horse, or is authorized to lease the Horse, and has the right to enter into this Agreement. Limitations on ownership, if any: {{TXN.OWNERSHIP_LIMITATIONS}}.

3. LESSEE REPRESENTATIONS

Lessee represents that Lessee is at least 18 years of age and has authority to enter into this Agreement, that Lessee has no physical or mental condition that would prevent safe participation in equine activities, and that Lessee has the knowledge and experience to provide reasonable care for and safely handle and ride the Horse. Lessee agrees to use reasonable care and to follow Lessor's reasonable instructions.

<!-- CUT-START: EVALUATION_PERIOD | condition: include only if an evaluation period is selected -->
4. EVALUATION PERIOD

The parties agree to an evaluation period during which they will assess the suitability of the Horse for Lessee. All terms of this Agreement apply during the evaluation period.

Evaluation Period Start: {{TXN.EVALUATION_START}}
Evaluation Period End: {{TXN.EVALUATION_END}}

Either party may terminate this Agreement during the evaluation period, or elect to end the evaluation period and begin the lease term, by notice to the other party.
```

### Content — the 98 retained `contract_field_defs` rows (section | field_key | label)

```
Lessee | LESSEE.FULL_NAME | Lessee Name
Lessee | LESSEE.ADDRESS | Lessee Address
Lessee | LESSEE.PHONE | Lessee Phone
Lessee | LESSEE.EMAIL | Lessee Email
Lessee | LESSEE.PRINTED_NAME | Lessee Printed Name
Lessor | LESSOR.FULL_NAME | Lessor Name
Lessor | LESSOR.ADDRESS | Lessor Address
Lessor | LESSOR.PHONE | Lessor Phone
Lessor | LESSOR.EMAIL | Lessor Email
Lessor | LESSOR.PRINTED_NAME | Lessor Printed Name
Horse | HORSE.REGISTERED_NAME | Registered Name
Horse | HORSE.BARN_NAME | Nickname
Horse | HORSE.BREED | Breed
Horse | HORSE.COLOR | Color
Horse | HORSE.SEX | Sex
Horse | HORSE.HEIGHT | Height
Horse | HORSE.AGE_DOB | Age / Date of Birth
Horse | HORSE.REGISTRATION_NUMBER | Registration Number
Horse | HORSE.MICROCHIP | Microchip / ID
Horse | HORSE.MARKINGS | Markings
Horse | HORSE.REGISTRATION_ORG | Registration Organization
Horse | HORSE.PASSPORT_NUMBER | Passport Number
Horse | HORSE.PASSPORT_COUNTRY | Passport Country
Horse | HORSE.FAIR_MARKET_VALUE | Fair Market Value
Horse | HORSE.CURRENT_LOCATION | Current Location
Horse | HORSE.HOME_LOCATION | Home Location
Horse | TXN.CONTRACT_LOCATIONS | Contract Location(s)
Horse | HORSE.VET_NAME | Veterinarian Name
Horse | HORSE.VET_PHONE | Veterinarian Phone
Horse | HORSE.VET_BUSINESS | Veterinary Practice
Horse | HORSE.VET_ADDRESS | Veterinarian Address
Horse | HORSE.FARRIER_NAME | Farrier Name
Horse | HORSE.FARRIER_PHONE | Farrier Phone
Condition & Ownership | TXN.CONDITION_EXCEPTIONS | Condition Exceptions
Condition & Ownership | TXN.BEHAVIOR_EXCEPTIONS | Behavior Exceptions
Condition & Ownership | TXN.OWNERSHIP_LIMITATIONS | Ownership Limitations
Lease Type & Term | TXN.LEASE_TYPE | Lease Type
Lease Type & Term | TXN.LEASE_TERM | Lease Term
Lease Type & Term | TXN.LEASE_START | Commencement Date
Lease Type & Term | TXN.LEASE_END | Expiration Date
Lease Type & Term | TXN.RENEWAL_TERMS | Renewal Terms
Evaluation Period | TXN.EVALUATION_START | Evaluation Period Start
Evaluation Period | TXN.EVALUATION_END | Evaluation Period End
Permitted Use | TXN.PERMITTED_ACTIVITIES | Permitted Activities
Permitted Use | TXN.USE_RESTRICTIONS | Use Restrictions
Permitted Use | TXN.AUTHORIZED_USERS | Authorized Users
Partial Lease | TXN.RESERVED_DAYS | Reserved Days
Partial Lease | TXN.SHARED_WITH | Shared With
Payment | TXN.LEASE_FEE | Lease Fee
Payment | TXN.PAYMENT_SCHEDULE | Payment Schedule
Payment | TXN.PAYMENT_OPTIONS | Payment Options (one per line: amount — description)
Payment | TXN.PAYMENT_TERMS | Payment Terms
Payment | TXN.LATE_PAYMENT_TERMS | Late Payment Terms
Boarding & Care | TXN.BOARDING_RESPONSIBILITY | Boarding Responsibility
Boarding & Care | TXN.CARE_RESPONSIBILITY | Routine Care Responsibility
Boarding & Care | TXN.EXERCISE_RESPONSIBILITY | Exercise Responsibility (who exercises the Horse; in a partial lease, which participant(s))
Boarding & Care | TXN.CLIPPING_RESPONSIBILITY | Hair Clipping Responsibility (who pays for / arranges body clipping)
Boarding & Care | TXN.SUPPLEMENTS | Supplements
Boarding & Care | TXN.SUPPLEMENTS_RESPONSIBILITY | Supplements Responsibility
Vet & Farrier | TXN.ROUTINE_VET_RESPONSIBILITY | Routine Vet Responsibility
Vet & Farrier | TXN.EMERGENCY_VET_RESPONSIBILITY | Emergency Vet Responsibility
Vet & Farrier | TXN.FARRIER_RESPONSIBILITY | Farrier Responsibility
Vet & Farrier | TXN.VET_AUTH_CONTACT | Vet Authorization Contact
Training & Lessons | TXN.TRAINING_TERMS | Training Terms
Training & Lessons | TXN.LESSON_TERMS | Lesson Terms
Equipment & Tack | TXN.TACK_TERMS | Tack Terms
Equipment & Tack | TXN.LESSOR_EQUIPMENT | Equipment Provided by Lessor
Equipment & Tack | TXN.LESSEE_EQUIPMENT | Equipment Provided by Lessee
Cost Allocation | TXN.BOARD_COST | Board Cost Allocation
Cost Allocation | TXN.TRAINING_COST | Training Cost Allocation
Cost Allocation | TXN.LESSONS_COST | Lessons Cost Allocation
Cost Allocation | TXN.SUPPLEMENTS_COST | Supplements Cost Allocation
Cost Allocation | TXN.FARRIER_COST | Farrier Cost Allocation
Cost Allocation | TXN.ROUTINE_VET_COST | Routine Vet Cost Allocation
Cost Allocation | TXN.NON_ROUTINE_VET_COST | Non-Routine Vet Cost Allocation
Cost Allocation | TXN.OTHER_CARE_COST | Other Care Cost Allocation
Cost Allocation | TXN.OTHER_EXPENSES_COST | Other Expenses Cost Allocation
Insurance | TXN.MORTALITY_INSURANCE_COST | Mortality Insurance Cost
Insurance | TXN.MORTALITY_INSURANCE_PARTY | Mortality Insurance Responsible Party
Insurance | TXN.MAJOR_MEDICAL_INSURANCE_COST | Major Medical Insurance Cost
Insurance | TXN.MAJOR_MEDICAL_INSURANCE_PARTY | Major Medical Insurance Responsible Party
Insurance | TXN.LOSS_OF_USE_INSURANCE_COST | Loss of Use Insurance Cost
Insurance | TXN.LOSS_OF_USE_INSURANCE_PARTY | Loss of Use Insurance Responsible Party
Competition | TXN.COMPETITION_TERMS | Competition Terms
Competition | TXN.COMPETITION_EXPENSES | Competition Expenses
Competition | TXN.COMPETITION_WINNINGS | Competition Winnings
Risk & Termination | TXN.RISK_ALLOCATION | Risk of Loss Allocation
Risk & Termination | TXN.PROHIBITED_ACTIVITIES | Prohibited Activities
Risk & Termination | TXN.TERMINATION_TERMS | Termination Terms
Scheduling & Availability | TXN.DAYS_USED | Days Used by Lessee (e.g. Mon,Wed,Fri)
Scheduling & Availability | TXN.DAYS_UNAVAILABLE | Days Unavailable
Scheduling & Availability | TXN.LESSONS_BEGINNER | Lessons/Day — Beginner
Scheduling & Availability | TXN.LESSONS_INTERMEDIATE | Lessons/Day — Intermediate
Scheduling & Availability | TXN.LESSONS_ADVANCED | Lessons/Day — Advanced
Scheduling & Availability | TXN.EXCLUSIVITY_RULES | Exclusivity Rules (one per line)
Competition | TXN.EVENTS_AUTHORIZED | Events / Competition Authorized
Permissions | TXN.SUBLEASE_ALLOWED | Sublease Allowed (owner's discretion)
Permissions | TXN.SHARED_LEASE_ALLOWED | Shared Lease Allowed (owner's discretion)
```

### Content — the retention note (this is the "migration comment" the report referred to)

The retention rationale is **not** in a migration; it lives in
`supabase/contract_templates/HORSE_LEASE.md` (which is itself now a pointer file, not contract
text) plus `scripts/build-template-load-migration.mjs:63-66`. Verbatim from HORSE_LEASE.md:

```
# HORSE_LEASE — retired flat template (content moved to the database)

**This file no longer holds the lease contract text.** It is kept only as a pointer.

> ## Lockstep writes target THREE keys, not four (owner ruling D10, 2026-08-11)
>
> The lease family is **Standard / Simple / Detailed**, one active row each:
> `HORSE_LEASE_V2` (Standard — titled "Horse Lease Agreement — Standard", holds all
> 6 live lease documents), `HORSE_LEASE_SIMPLE` ("...Simple"), `HORSE_LEASE_FULL`
> (Detailed — titled "Horse Lease Agreement — Detailed"). **These three stay
> byte-identical until the owner modifies Simple or Detailed — that is the ruled
> state, not a defect.** Any migration that edits clause/field content on the lease
> must write to all three of `HORSE_LEASE_V2`, `HORSE_LEASE_SIMPLE`,
> `HORSE_LEASE_FULL` in lockstep (e.g. `template_key IN ('HORSE_LEASE_V2',
> 'HORSE_LEASE_SIMPLE', 'HORSE_LEASE_FULL')`).
>
> `HORSE_LEASE_STANDARD` was a redundant fourth clone (zero documents) and is now
> `active = false`. **It must NOT receive content updates** — writing to it anyway
> is how it silently drifts into a stale copy someone could reactivate by mistake.
> Its 163 clause rows are retained, not deleted, in case the owner ever wants the
> name reassigned to a different row.
>
> `HORSE_LEASE` (below, this file's namesake key) is the pre-clause **original**:
> retained as historical reference and as a source of wording that could be
> resurrected if something in the current version is judged worse than the
> original. It is **never to be activated and never to be used to generate a
> document.**
>
> Full ruling: `docs/tasks/TASK-LEASESET-three-leases-and-an-archive.md`
> (CLAUDE.md D10).
```

And the generator guard, `scripts/build-template-load-migration.mjs:63-66`:
```js
// Retired templates: their .md is a pointer/note, not contract text. The lease is
// now built from DB clause defs (HORSE_LEASE_V2), so never re-load HORSE_LEASE's
// body from its (retired) .md file. See supabase/contract_templates/HORSE_LEASE.md.
const RETIRED = new Set(['HORSE_LEASE', 'HORSE_PURCHASE_SALE', 'HORSE_SALE_TRANSFER']);
```

---

## 2. MINOR_RIDER (contract_templates row, id 2ea9837b-d535-48c8-bb85-7214e1493e4d)

- reported by: PROMPT_A_STAGES_1-3.md, TASK-SVCPURGE-REPORT.md
- reachability: **Active but wired to nothing.** `active=t`, `deleted_at=NULL`, so
  `generate_document('MINOR_RIDER', …)` *would* succeed if anything called it — but nothing does.
  Verified `NONE` in all four requirement matrices (`contract_requirements`,
  `contract_role_documents`, `category_document_requirements`, `contact_required_documents`), and
  `grep -rn "MINOR_RIDER" src api --include=*.ts --include=*.tsx` returns **zero hits**. The only
  references anywhere are two migration files that treat it as a surface-config category
  (`supabase/migrations/20260811T1700_oneauthor_template_surface_config.sql:52,111`). So it is
  reachable only by someone calling the RPC by hand.
- exists: **yes**

### ⚠ Correction to a prior report

TASK-SVCPURGE-REPORT.md's characterisation of MINOR_RIDER as **"body-less" is WRONG.**
`length(body) = 5481` — it holds a complete, drafted agreement. The row is:

```
template_key = MINOR_RIDER
short_label  = Minor rider agreement
active       = true
version      = 1
body length  = 5481   ← NOT empty
draft_body   = NULL
deleted_at   = NULL
sections=0  clauses=0  field_defs=0  template_tokens=0  documents=0
```

The "0 documents / GUARDIAN.* + EMERGENCY_CONTACT.* never exercised by a real render" claim **is**
correct: `select count(*) from documents where template_id='2ea9837b-…'` → **0**.

### Content — its 26 distinct body tokens

```
DOC.EFFECTIVE_DATE
EMERGENCY_CONTACT.FULL_NAME
EMERGENCY_CONTACT.PHONE
EMERGENCY_CONTACT.RELATIONSHIP
GUARDIAN.ADDRESS
GUARDIAN.EMAIL
GUARDIAN.FULL_NAME
GUARDIAN.PHONE
GUARDIAN.PRINTED_NAME
ORG.CANCELLATION_FEE
ORG.CANCELLATION_NOTICE_HOURS
ORG.LEGAL_IDENTITY
ORG.LEGAL_NAME
ORG.NO_SHOW_FEE
ORG.SIGNATORY_NAME
ORG.SIGNATORY_TITLE
PARTICIPANT.FULL_NAME
PARTICIPANT.PRINTED_NAME
SIG.COMPANY.DATE
SIG.COMPANY.NAME
SIG.GUARDIAN.DATE
SIG.GUARDIAN.NAME
SIG.PARTICIPANT.DATE
SIG.PARTICIPANT.NAME
TXN.PAYMENT_SCHEDULE
TXN.SERVICE_FEE
```

### Content — the FULL 5,481-char body

```
MINOR RIDER AGREEMENT, PARENTAL CONSENT, AND MEDICAL AUTHORIZATION AGREEMENT

This Minor Rider Agreement, Parental Consent, and Medical Authorization Agreement (“Agreement”) is entered into as of {{DOC.EFFECTIVE_DATE}} (“Effective Date”) by and between:

{{ORG.LEGAL_IDENTITY}} ("COMPANY"),

and

Parent/Legal Guardian: {{GUARDIAN.FULL_NAME}}

Address: {{GUARDIAN.ADDRESS}}

Phone: {{GUARDIAN.PHONE}}

Email: {{GUARDIAN.EMAIL}}

and

Minor Participant: {{PARTICIPANT.FULL_NAME}}

Date of Birth:

Emergency Contact (if different): {{EMERGENCY_CONTACT.FULL_NAME}}

Relationship: {{EMERGENCY_CONTACT.RELATIONSHIP}}

Phone: {{EMERGENCY_CONTACT.PHONE}}

RECITALS

A. Parent or Legal Guardian desires to allow the Minor Participant to engage in horseback riding lessons, equine training, horsemanship instruction, horse handling activities, and related equestrian services provided by COMPANY.

B. Parent acknowledges the inherent risks associated with equine activities.

C. Parent wishes to voluntarily permit Minor Participant to participate despite such risks.

AGREEMENT

AUTHORIZATION TO PARTICIPATE

Parent authorizes Minor Participant to participate in:

□ Riding Lessons

□ Horsemanship Instruction

□ Groundwork Activities

□ Horse Handling Activities

□ Mounted Exercises

□ Unmounted Exercises

□ Clinics

□ Horse Shows

□ Educational Programs

□ Other:

LOCATIONS COVERED

This Agreement applies to all activities conducted:

At facilities utilized by COMPANY;

At third-party boarding or training facilities;

At horse shows, clinics, exhibitions, and competitions;

At client-owned facilities;

At any other location where services are provided.

LIABILITY RELEASE — INCORPORATED BY REFERENCE

The risk acknowledgments, releases, and indemnity obligations applicable to the activities under this Agreement are set forth exclusively in the separately executed Liability Release and Assumption of Risk agreement, which is incorporated herein by reference.

RULES AND INSTRUCTIONS

Parent agrees that Minor Participant shall:

Follow instructor directions at all times;

Observe facility rules;

Treat horses humanely;

Use equipment properly;

Refrain from dangerous conduct.

Failure to comply may result in immediate removal from activities without refund.

HELMET REQUIREMENT

Minor Participant shall wear a properly fitted ASTM/SEI-certified riding helmet whenever mounted unless specifically authorized otherwise in writing by Parent and COMPANY.

Parent acknowledges that helmets reduce but do not eliminate risk.

MEDICAL INFORMATION

Known Allergies:

Medical Conditions:

Medications:

Physician:

Physician Phone:

Health Insurance Carrier:

Policy Number:

EMERGENCY MEDICAL AUTHORIZATION

Parent authorizes COMPANY and its representatives to obtain emergency medical treatment for Minor Participant when Parent cannot be immediately reached.

This authorization includes:

Emergency transportation;

Emergency medical care;

Emergency surgical procedures if deemed necessary by medical professionals.

Parent agrees to be solely responsible for all resulting expenses.

PHOTO AND MEDIA CONSENT

Parent grants permission for photographs and video recordings of Minor Participant to be used for educational, promotional, advertising, website, social media, and business purposes.

Parent may decline consent by initialing here:

TRANSPORTATION AUTHORIZATION

Parent authorizes Minor Participant to be transported by:

□ Instructor

□ Trainer

□ Employee

□ Volunteer

□ Not Authorized

Parent acknowledges transportation-related risks.

PAYMENT RESPONSIBILITY

Parent remains responsible for payment of all fees associated with services provided to Minor Participant.

Lesson Fees: {{TXN.SERVICE_FEE}}

Payment Schedule: {{TXN.PAYMENT_SCHEDULE}}

CANCELLATION POLICY

Cancellation of a scheduled session requires at least {{ORG.CANCELLATION_NOTICE_HOURS}} hours advance notice. Sessions cancelled with less than the required notice may be charged a late-cancellation fee of {{ORG.CANCELLATION_FEE}}. Failure to appear for a scheduled session without notice may be charged a no-show fee of {{ORG.NO_SHOW_FEE}}.

TERMINATION

COMPANY may suspend or terminate participation for:

Unsafe conduct;

Repeated rule violations;

Harassment or abusive behavior;

Failure to pay fees;

Conduct detrimental to horses, staff, or participants.

DISPUTE RESOLUTION

Disputes arising under this Agreement shall be resolved by:

□ Arbitration

□ Litigation

Venue shall be San Diego County, California.

ATTORNEY’S FEES

The prevailing party shall recover reasonable attorney’s fees and costs.

GOVERNING LAW

This Agreement shall be governed by California law.

ENTIRE AGREEMENT

This document constitutes the entire agreement between the parties concerning Minor Participant’s involvement in equine activities.

ACKNOWLEDGMENT

Parent acknowledges:

This Agreement has been read completely;

Questions have been answered satisfactorily;

Participation is voluntary;

Parent is authorized to sign for Minor Participant.

PARENT OR LEGAL GUARDIAN

Signature: {{SIG.GUARDIAN.NAME}}

Printed Name: {{GUARDIAN.PRINTED_NAME}}

Relationship to Minor:

Date: {{SIG.GUARDIAN.DATE}}

MINOR PARTICIPANT

Signature (if capable): {{SIG.PARTICIPANT.NAME}}

Printed Name: {{PARTICIPANT.PRINTED_NAME}}

Date: {{SIG.PARTICIPANT.DATE}}

COMPANY: {{ORG.LEGAL_NAME}}

By (signature): {{SIG.COMPANY.NAME}}

Printed: {{ORG.SIGNATORY_NAME}}

Title: {{ORG.SIGNATORY_TITLE}}

Date: {{SIG.COMPANY.DATE}}
```

---

## 3. HORSE_REPRESENTATION and MEDIA_RELEASE (two contract_templates rows)

- reported by: TASK-TEXTEDIT-REPORT.md, TASK-SVCPURGE-REPORT.md
- reachability: **Both inactive.** `HORSE_REPRESENTATION active=f`, `MEDIA_RELEASE active=f`
  (both `deleted_at=NULL`, so they are deactivated rather than soft-deleted).
  `generate_document` filters on `AND active`, so both raise
  `'unknown or inactive contract template: %'`. Both appear in **zero** rows of all four
  requirement matrices and zero clause/section/field/variant rows.
- exists: **yes** (rows present, deactivated)

**Claim "inactive flat templates with EMPTY bodies" — confirmed, and sharper: both bodies are
SQL `NULL`, not empty string.**

```
template_key         | active | body IS NULL | body_len | draft_body IS NULL
HORSE_REPRESENTATION | false  | true         | NULL     | true
MEDIA_RELEASE        | false  | true         | NULL     | true
```
Counts for both: `documents=0, sections=0, clauses=0, field_defs=0, template_tokens=0, variants=0`.

### Is there anything at all? — **The two differ sharply.**

**MEDIA_RELEASE = pure stub.** It has *never* had text anywhere.
`git log --all -- "*MEDIA_RELEASE.md"` returns **nothing** — no such file has ever existed in
history. It was seeded as a metadata-only row in
`supabase/migrations/20260629040000_contract_templates_tokens.sql:70`:
```sql
('MEDIA_RELEASE',            'Photo/Video/Media Release',                        NULL,                        ARRAY['PARTICIPANT','GUARDIAN','FHE']),
```
and a later migration records exactly why it was pulled from the onboarding matrix —
`supabase/migrations/20260711150000_category_onboarding_docs.sql:37-38`:
```sql
  -- MEDIA_RELEASE excluded: its template body was never loaded from a source
  -- document (generate_document refuses). Re-add once the owner provides it.
```
It was then deactivated at `20260711150000_category_onboarding_docs.sql:462`:
```sql
UPDATE contract_templates SET active = false WHERE template_key = 'MEDIA_RELEASE';
```
**Verdict: a named placeholder awaiting owner-supplied text. Nothing is lost; nothing exists.**

**HORSE_REPRESENTATION = NOT a stub — it had a full 4,351-char agreement that was deliberately
cleared.** The body was set to NULL and the `.md` deleted by
`fae9e95d60629020edef03b432a085cc7a2c4daa` (2026-07-01, *"feat(contracts): modular decomposition —
search / evaluation / transaction-rep as separately executed modules"*). The migration states the
reasoning verbatim — `supabase/migrations/20260701080000_contract_module_decomposition.sql:27-32`:
```
       - HORSE_REPRESENTATION retired: it was the lease-flavored search+placement
         bundle, now collapsed into the finder's lease directions. Row kept
         (documents.template_id may reference it) but deactivated and its body
         cleared; its .md source is deleted so the regenerated loader no longer
         carries it.
```
and the statement itself at lines 81-84:
```sql
-- HORSE_REPRESENTATION → folded into the finder's lease directions; retired.
UPDATE contract_templates
  SET active = false, body = NULL, updated_at = now()
  WHERE template_key = 'HORSE_REPRESENTATION';
```

### Content — recovered `supabase/contract_templates/HORSE_REPRESENTATION.md` (227 lines, 4,351 chars) via `git show fae9e95^:…`

```
HORSE LEASE/PURCHASE REPRESENTATION AGREEMENT
```
*(The recovered file is 227 lines / 4,351 chars and is preserved at
`…/scratchpad/flagharvest/dump/DEL_HORSE_REPRESENTATION.md`. Its successor content is the
now-live `HORSE_SEARCH_RETAINER` ("Horse Finder Search and Sourcing Retainer Agreement",
6,133 chars, active) plus `HORSE_TRANSACTION_REP` (5,033 chars, active), which between them carry
the four directional variants and the Layer-2 representation module — so this text is
**superseded, not orphaned**.)*

Recover the full text at any time with:
```
git show fae9e95^:supabase/contract_templates/HORSE_REPRESENTATION.md
```

---

## 4. FACILITY_LICENSE and INDEPENDENT_CONTRACTOR (two contract_templates rows)

- reported by: TASK-TEXTEDIT-REPORT.md
- reachability: **This is the block where the report's alarm needs correcting.**
  Both are `active=true, deleted_at=NULL` — so they pass the first gate in `generate_document`.
  **But they cannot produce an empty contract.** The very next guard catches them:
  ```sql
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;
  ```
  and both bodies are **SQL NULL**, not `''` — verified explicitly (`body IS NULL = true` for
  both). So an attempt raises `template FACILITY_LICENSE has no body loaded (no source document
  yet)`. Additionally both appear in **zero** rows of all four requirement matrices, so nothing
  routes a user to them in the first place.
- exists: **yes** (rows present, active, body NULL)

```
template_key           | active | body IS NULL | body_len | draft_body IS NULL
FACILITY_LICENSE       | true   | true         | NULL     | true
INDEPENDENT_CONTRACTOR | true   | true         | NULL     | true
```
Counts for both: `documents=0, sections=0, clauses=0, field_defs=0, template_tokens=0, variants=0`.

**Corrections to the reported claims:**
1. *"active + empty means a user could reach an empty contract"* — **false**, per the `IS NULL`
   guard above. The worst outcome is a raised exception, not a blank signed document.
2. *"drafts were exercised then discarded, bodies still empty"* — **the discard is confirmed**
   (`draft_body IS NULL` on both today), but there is no evidence these two ever had a body to
   begin with; see next paragraph.

### Is there any text anywhere? — **No. Both are pure stubs, never drafted.**

`git log --all -- "*FACILITY_LICENSE.md"` → **nothing**.
`git log --all -- "*INDEPENDENT_CONTRACTOR.md"` → **nothing**.
Neither file has ever existed in repo history, and `supabase/contract_templates/Archive/` holds
neither (Archive contains only EVALUATION_LIABILITY_WAIVER, HORSE_EMERGENCY_VET,
HUMAN_EMERGENCY_MEDICAL, RELEASE_GENERAL, RELEASE_HORSE_CARE, "RELEASE_PARTICIPANT OLD").

They exist only as metadata-only seed rows. Full extent of what exists —
`supabase/migrations/20260629040000_contract_templates_tokens.sql:67,72`:
```sql
  ('INDEPENDENT_CONTRACTOR',   'Independent Contractor Agreement',                 'INDEPENDENT_CONTRACTOR',    ARRAY['CONTRACTOR','FHE']),
  ('FACILITY_LICENSE',         'Facility Use and Business Operations License',     NULL,                        ARRAY['OWNER','FHE'])
```
plus a service-type row for the contractor at
`supabase/migrations/20260629010000_crm_identity_backbone.sql:51`:
```sql
  ('INDEPENDENT_CONTRACTOR',   'Independent Contractor',    'Engagement of an independent contractor providing services to FHE.', 'internal', false, true, 13)
```
and a surface-config note describing both as intended commercial agreements —
`supabase/migrations/20260811T1700_oneauthor_template_surface_config.sql:54-55`:
```
  commercial agreements (FACILITY_LICENSE, HORSE_SEARCH_RETAINER,
  HORSE_TRANSACTION_REP, INDEPENDENT_CONTRACTOR) — keep every surface.
```

**Verdict for the owner: two named, party-scoped placeholders for agreements that were planned but
never written. The names, intended parties, and intended shape are the entire asset.**

They *do* surface a red **"empty body"** badge in the admin template list —
`src/pages/app/ops/admin/AdminTemplatesPage.tsx:38-42`:
```tsx
{t.body_empty && !t.is_composed && (
  <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
    empty body
  </span>
)}
```

---

## 5. HORSE_LEASE_STANDARD, plus the HORSE_LEASE_FULL / HORSE_LEASE_SIMPLE forks

- reported by: TASK-TEXTEDIT-REPORT.md, TASK-LEASEFORK-REPORT.md, TASK-LEASEGATE-PHASE1.md, TASK-LEASESET-REPORT.md
- reachability: **HORSE_LEASE_STANDARD is doubly closed.**
  (a) `active=false` → `generate_document` raises `'unknown or inactive contract template'`.
  (b) The wording editor refuses it by name. The gate is a hardcoded `CASE` in the list RPC,
  `supabase/migrations/20260812T1500_textedit_template_wording_drafts.sql:103-105`:
  ```sql
  CASE WHEN t.template_key = 'HORSE_LEASE_STANDARD'
       THEN 'Archived (D10) — edit the Standard lease (HORSE_LEASE_V2) instead'
       END AS locked_reason,
  ```
  consumed at `src/pages/app/ops/admin/AdminTemplateEditorPage.tsx:119`:
  ```tsx
  if (m.locked_reason) { setError(m.locked_reason); return; }
  ```
  and rendered as a padlock at `src/pages/app/ops/admin/AdminTemplatesPage.tsx:19` /`:47`:
  ```tsx
  const locked = t.locked_reason != null;
  …
  {locked ? ` · ${t.locked_reason}` : ''}
  …
  {locked ? <Lock size={16} /> : <ChevronRight size={17} />}
  ```
  **HORSE_LEASE_FULL and HORSE_LEASE_SIMPLE are NOT unreachable** — both are `active=true` and
  editable; they are simply unused (0 documents). They are live, selectable leases.
- exists: **yes** — all three rows present, all clause/section/field rows intact.

### Per-template counts (verified in prod)

| template_key | active | ver | documents | sections | clauses | field_defs |
|---|---|---|---|---|---|---|
| HORSE_LEASE (v1 archive) | false | 1 | **0** | 0 | 0 | 98 |
| HORSE_LEASE_STANDARD | **false** | 1 | **0** | 22 | **163** | 114 |
| HORSE_LEASE_FULL (Detailed) | true | 3 | **0** | 22 | 163 | 114 |
| HORSE_LEASE_SIMPLE | true | 3 | **0** | 22 | 163 | 114 |
| HORSE_LEASE_V2 (the live Standard) | true | 3 | **6** | 22 | 163 | 114 |

**All four lease documents sit on HORSE_LEASE_V2 — corrected: there are SIX, not four**
(`documents=6`, all six live, `deleted_at IS NULL`). Every other lease key has zero.

### Byte-identity proof (computed in SQL, not asserted)

md5 over the ordered concatenation `section_key~clause_key~heading~body` for all 163 clauses,
ordered by `sort_order, clause_key`:
```
HORSE_LEASE_FULL     | clause_md5=f1f2208d6fbb911d5035026b666bce46 | total body chars=37463
HORSE_LEASE_SIMPLE   | clause_md5=f1f2208d6fbb911d5035026b666bce46 | total body chars=37463
HORSE_LEASE_STANDARD | clause_md5=f1f2208d6fbb911d5035026b666bce46 | total body chars=37463
HORSE_LEASE_V2       | clause_md5=f1f2208d6fbb911d5035026b666bce46 | total body chars=37463
```
md5 over the 22 ordered section defs:
```
HORSE_LEASE_FULL     | section_md5=aa427805c552c7e9a35d044242997dea
HORSE_LEASE_SIMPLE   | section_md5=aa427805c552c7e9a35d044242997dea
HORSE_LEASE_STANDARD | section_md5=aa427805c552c7e9a35d044242997dea
HORSE_LEASE_V2       | section_md5=aa427805c552c7e9a35d044242997dea
```
md5 over the 114 ordered field defs:
```
HORSE_LEASE_FULL     | field_md5=1ca148168a447fb6aed6e7b2c7340829
HORSE_LEASE_SIMPLE   | field_md5=1ca148168a447fb6aed6e7b2c7340829
HORSE_LEASE_STANDARD | field_md5=1ca148168a447fb6aed6e7b2c7340829
HORSE_LEASE_V2       | field_md5=1ca148168a447fb6aed6e7b2c7340829
HORSE_LEASE (v1)     | field_md5=a841e89fc76fdef22a7c3219db985137   ← different, as expected (98 rows, flat-era)
```
**All four lease forks are byte-identical across sections, clauses, and fields. Confirmed.**

### ⚠ Stale figures in TASK-LEASEGATE-PHASE1.md

That report states `HORSE_LEASE_STANDARD` has **"22 sections, 144 clauses, 117 fields"**
(lines 42 and 391). Prod today shows **22 sections, 163 clauses, 114 fields**. The report is
stale, not the database — the clause set grew and the field set shrank after it was written.
Its per-template hash (`b0001b34c40c1e2a5fc193a28379c073`, line 52) no longer reproduces either.

### The locked_reason text, verbatim

```
Archived (D10) — edit the Standard lease (HORSE_LEASE_V2) instead
```

### Content — the 22 retained sections (sort_order | section_key | heading)

```
 10 | PARTIES           | Parties
 12 | DEFINITIONS       | Definitions; Binding Effect; Third-Party Beneficiaries
 15 | HORSE             | The Horse
 20 | PURPOSE           | Purpose and Lease Grant
 25 | SCHEDULE          | Schedule for Lessee's Usage
 30 | LEASE_FEE         | Lease Fee
 35 | PAYMENT_TERMS     | Payment Terms
 38 | PAYMENT_METHOD    | Payment Method
 60 | EVALUATION        | Evaluation Period
 70 | TERM              | Agreement Term
 90 | PERMITTED_USE     | Permitted Use(s) & Restrictions
110 | CARE              | Horse Care and Expenses
140 | INSURANCE_RISK    | Insurance, Risk of Loss, and Indemnification
160 | TERMINATION       | Termination
170 | NOTICE            | Notice and Contact Information
180 | ASSIGNMENT        | Assignment or Transfer
190 | ENTIRE_AGREEMENT  | Entire Agreement
200 | GOVERNING_LAW     | Governing Law and Venue
210 | ATTORNEYS_FEES    | Attorneys' Fees
220 | SEVERABILITY      | Severability
230 | LESSEE_REPS       | Lessee's Representations
240 | SIGNATURES        | Signatures
```

### Content — 18 of the 163 retained clauses (section | clause_key | heading | type | body chars)

```
CARE             | SCHEDULE.CARE_DUTY             | Lessee's Responsibility for Care and Exercise | prose  | 501
CARE             | SCHEDULE.TRAINER_CARE          | 3rd Party Exercise                           | input  | 420
CARE             | CARE.INTRO                     | (no heading)                                 | prose  |  95
CARE             | CARE.SUPPLEMENTS               | (no heading)                                 | input  |  19
LEASE_FEE        | LEASE_FEE.CHOICE               | (no heading)                                 | input  | 275
LESSEE_REPS      | LESSEE_REPS.PENDING            | Lessee's Representations                     | prose  | 147
LESSEE_REPS      | LESSEE_REPS.MAIN_INDIVIDUAL    | Lessee's Representations                     | prose  | 733
PURPOSE          | PURPOSE.RECREATION_DEFAULT     | Purpose of Agreement                         | input  | 129
ASSIGNMENT       | ASSIGNMENT.NO_ASSIGN           | Assignment or Transfer                       | prose  | 201
ATTORNEYS_FEES   | ATTORNEYS_FEES.PREVAILING      | Attorneys' Fees                              | prose  |  59
DEFINITIONS      | DEFINITIONS.LESSOR_PENDING     | (no heading)                                 | input  | 142
ENTIRE_AGREEMENT | ENTIRE_AGREEMENT.INTEGRATION   | Entire Agreement                             | prose  | 237
EVALUATION       | EVALUATION.CHOICE              | (no heading)                                 | choice |   0
GOVERNING_LAW    | GOVERNING_LAW.CHOICE           | Governing Law and Venue                      | input  | 790
HORSE            | HORSE.IDENTITY                 | Horse Details                                | input  | 385
NOTICE           | NOTICE.FORM                    | Form of Notice                               | prose  | 262
PARTIES          | PARTIES.INTRO                  | (no heading)                                 | input  | 219
PAYMENT_METHOD   | PAYMENT_METHOD.MAIN            | Payments by the Lessee                       | input  | 104
```

### Content — two full clause bodies from HORSE_LEASE_STANDARD

```
===== SCHEDULE.CARE_DUTY — Lessee's Responsibility for Care and Exercise =====
Lessee's use of the Horse is a responsibility as well as a right: regular, consistent exercise and attention are important to the Horse's health and wellbeing. Lessee is required to maintain regular use and exercise for the Horse on their allowed days, unless Lessee has discussed with and received mutual agreement from the Lessor in writing that one of those days will be used as a rest day for the Horse. If Lessee regularly fails to use and care for the Horse, Lessor may terminate this Agreement.

===== SCHEDULE.TRAINER_CARE — 3rd Party Exercise =====
Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be conducted only by a French Heritage Equestrian Approved Trainer. Other 3rd parties must be approved in writing by the Lessor.
Party responsible for arranging: {{TXN.TRAINER_EXERCISE_ARRANGE}}
Party responsible for costs: {{TXN.TRAINER_EXERCISE_COST}}
Lessee's share of the cost: {{TXN.TRAINER_EXERCISE_SPLIT_PCT}}
```

---

## 6. Six deleted service contract templates — HORSE_TRAINING, HORSE_EXERCISE, HORSEMANSHIP_TRAINING, HORSE_EVALUATION, RIDER_LESSON, RIDER_LESSON_JUMPER

- reported by: TASK-SVCPURGE-REPORT.md
- reachability: **Gone entirely — not gated, deleted.**
  `select … from contract_templates where template_key in (…all six…)` returns **NONE FOUND**
  (hard-deleted, not soft-deleted — they are absent even ignoring `deleted_at`).
  `template_variants` for those six keys → **NONE** (the 6 orphan variants were removed; the only
  10 variant rows left belong to HORSE_SEARCH_RETAINER and HORSE_TRANSACTION_REP).
  The six `.md` files are absent from the working tree and from `supabase/contract_templates/Archive/`.
- exists: **deleted in `4049ced62aee7a86ba575c06c7366dd5128542a8` — "SVCPURGE: retire the six service contract templates (owner ruling 2026-08-05)" (2026-08-06)**

Found via `git log --diff-filter=D -- supabase/contract_templates/`; that one commit deletes all
six files in a single change. Its message records the verification that was done:

```
Removes HORSE_TRAINING, HORSE_EXERCISE, HORSEMANSHIP_TRAINING, HORSE_EVALUATION,
RIDER_LESSON and RIDER_LESSON_JUMPER. Their language was redrafted into the
standalone categorical documents (releases/policies/authorizations); git history
is the archive.

Verified zero documents ever generated against all six (drafts, executed, voided,
archived and soft-deleted alike) before deleting anything. The migration asserts
that per key and aborts loudly otherwise; documents.template_id is ON DELETE
RESTRICT as an independent backstop. Dry-run in BEGIN/ROLLBACK against prod,
negative-tested that the guard fires, then applied: 29 -> 23 templates, 87
template_tokens cascaded, 6 orphan template_variants removed, documents_total
unchanged at 68.

NOT touched: EVALUATION_LIABILITY_WAIVER (a RELEASE, keeps service_type
HORSE_EVALUATION); the live SERVICES of the same name (service_types, 32 active
offerings, contract_requirements.service_type, activity_checklists); audit_logs.
Every src/ and api/ hit is a service-type reference and was left in place.
```

Recover any of them with `git show 4049ced^:supabase/contract_templates/<NAME>.md`.

| File | Lines | Chars |
|---|---|---|
| HORSE_TRAINING.md | 31 | 1,672 |
| HORSE_EXERCISE.md | 31 | 1,619 |
| HORSEMANSHIP_TRAINING.md | 31 | 1,657 |
| HORSE_EVALUATION.md | 43 | 2,991 |
| RIDER_LESSON.md | 38 | 1,906 |
| RIDER_LESSON_JUMPER.md | 60 | 6,969 |
| **total** | **234** | **16,814** |

Note on shape: the first five are **service order/request forms**, not signed agreements — each
opens "Submission is a request, not a purchase" and defers legal terms to the Company Policies and
the separately-signed releases. **RIDER_LESSON_JUMPER is different in kind**: it is a full signed
liability addendum with its own release and indemnification. Its successor is live —
`RELEASE_JUMPER_ADDENDUM` (active, 3,732 chars, titled "JUMPER TRAINING ADDENDUM — RIDER ABILITY
ATTESTATION AND JUMPING ELIGIBILITY"), which is a **shorter redraft**: it keeps the ability
attestation and eligibility gate but drops the deleted version's §3 enumerated jumping-risk
catalogue, §4 assumption of risk, and §9 release/indemnification (those now live by reference in
the Participant Release). The owner may want to compare, since ~3,200 chars of jumping-specific
risk language is not in the live document.

### Content — HORSE_TRAINING.md (complete, 31 lines)

```
HORSE TRAINING SERVICE REQUEST

Order ID: {{ORD.UUID}}
Date: {{DOC.EFFECTIVE_DATE}}

ENGAGEMENT SUMMARY

This order is a request for horse training services from {{ORG.LEGAL_NAME}} ("COMPANY") for the horse identified below. Submission is a request, not a purchase. COMPANY reviews the request and, if approved, issues an approval for payment; the contract is formed upon completion of payment and is summarized in the purchase receipt. This engagement is governed by the Company Policies and the signed documents on file for this horse, including the Equine Services Release and Emergency Veterinary Authorization. Requested services are scheduled subject to COMPANY's availability and capacity. No training milestone, behavioral, performance, or value outcome is guaranteed.

HORSE

Horse: {{HORSE.REGISTERED_NAME}} ({{HORSE.BARN_NAME}})
Microchip: {{HORSE.MICROCHIP}}
Location: {{HORSE.CURRENT_LOCATION}}
Known conditions or changes since last engagement: {{REQ.CONDITION_UPDATES}}

OFFERING

Services selected: {{ORD.SERVICE_SELECTION}}
Available services: Schooling Rides, Flatwork Training, Groundwork, Lunging, Jumping Training, Trailer Loading Practice, Desensitization Training, Horse Handling.
Training Session Fee: {{TXN.SESSION_FEE}}
Monthly Program Fee: {{TXN.MONTHLY_FEE}}
Other Fees: {{TXN.OTHER_FEES}}

SCHEDULING REQUEST

Preferred dates and times: {{REQ.PREFERRED_SCHEDULE}}
Service location: {{REQ.LOCATION_PREFERENCE}}
Notes: {{REQ.NOTES}}

Travel to locations other than COMPANY's home property is charged per the travel terms in the Company Policies and included in the approved order. Rescheduling and fee terms are set out in the Company Policies.
```

### Content — HORSE_EXERCISE.md (complete, 31 lines)

```
HORSE EXERCISE SERVICE REQUEST

Order ID: {{ORD.UUID}}
Date: {{DOC.EFFECTIVE_DATE}}

ENGAGEMENT SUMMARY

This order is a request for horse exercise services from {{ORG.LEGAL_NAME}} ("COMPANY") for the horse identified below. Submission is a request, not a purchase. COMPANY reviews the request and, if approved, issues an approval for payment; the contract is formed upon completion of payment and is summarized in the purchase receipt. This engagement is governed by the Company Policies and the signed documents on file for this horse, including the Equine Services Release and Emergency Veterinary Authorization. Requested services are scheduled subject to COMPANY's availability and capacity. No fitness, conditioning, behavioral, or soundness outcome is guaranteed.

HORSE

Horse: {{HORSE.REGISTERED_NAME}} ({{HORSE.BARN_NAME}})
Microchip: {{HORSE.MICROCHIP}}
Location: {{HORSE.CURRENT_LOCATION}}
Known conditions or changes since last engagement: {{REQ.CONDITION_UPDATES}}

OFFERING

Services selected: {{ORD.SERVICE_SELECTION}}
Available services: Exercise Rides, Lunging, Groundwork, Horse Handling, Turnout, Hand Walking, Clipping, Bathing, Grooming.
Session Fee: {{TXN.SESSION_FEE}}
Monthly Program Fee: {{TXN.MONTHLY_FEE}}
Other Fees: {{TXN.OTHER_FEES}}

SCHEDULING REQUEST

Preferred dates and times: {{REQ.PREFERRED_SCHEDULE}}
Service location: {{REQ.LOCATION_PREFERENCE}}
Notes: {{REQ.NOTES}}

Travel to locations other than COMPANY's home property is charged per the travel terms in the Company Policies and included in the approved order. Rescheduling and fee terms are set out in the Company Policies.
```

### Content — HORSEMANSHIP_TRAINING.md (complete, 31 lines)

```
HORSEMANSHIP TRAINING ORDER

Order ID: {{ORD.UUID}}
Date: {{DOC.EFFECTIVE_DATE}}

ENGAGEMENT SUMMARY

This order is a request for horsemanship instruction and education from {{ORG.LEGAL_NAME}} ("COMPANY"). Submission is a request, not a purchase. COMPANY reviews the request and, if approved, issues an approval for payment; the contract is formed upon completion of payment and is summarized in the purchase receipt. This engagement is governed by the Company Policies and the signed documents on file, including the Participant Liability Release, Emergency Medical Authorization, and Property Rules, Safety Acknowledgment, and Equestrian Conduct Agreement. No proficiency, certification, or outcome is guaranteed.

OFFERING

Instruction may include catching and leading horses, safe horse handling, tacking and untacking, stable management education, horse behavior education, feeding and care education, ownership preparation, general equine safety instruction, round pen training, and lunging.

Program scope: {{ENG.PROGRAM_SCOPE}}
Program Fee: {{TXN.SERVICE_FEE}}

<!-- CUT-START: MINOR_PARTICIPANT_INFO | condition: include only if PARTICIPANT is a minor -->
PARTICIPANT

This order is for the following minor participant on file:
Name: {{PARTICIPANT.FULL_NAME}}
Date of Birth: {{PARTICIPANT.DOB}}
<!-- CUT-END: MINOR_PARTICIPANT_INFO -->

SCHEDULING REQUEST

Preferred dates and times: {{REQ.PREFERRED_SCHEDULE}}
Location preference (if applicable): {{REQ.LOCATION_PREFERENCE}}
Notes: {{REQ.NOTES}}

Sessions are confirmed as bookings upon approval and payment. Rescheduling, late arrival, weather, and fee terms are set out in the Company Policies.
```

### Content — HORSE_EVALUATION.md (complete, 43 lines — note the substantial advisory-liability paragraph)

```
HORSE EVALUATION REQUEST

Order ID: {{ORD.UUID}}
Date: {{DOC.EFFECTIVE_DATE}}

ENGAGEMENT SUMMARY

This order is a request for a per-horse evaluation from {{ORG.LEGAL_NAME}} ("COMPANY"). Submission is a request, not a purchase. COMPANY reviews the request and, if approved, issues an approval for payment; the contract is formed upon completion of payment and is summarized in the purchase receipt. This engagement is governed by the Company Policies and the signed documents on file. This order covers ONLY the single horse identified below; evaluating an additional horse requires a separate order and a separate per-horse fee. Evaluation is a standalone service and may occur with or without a search retainer or transaction representation engagement.

Evaluation is advisory only. Horses are living animals and may change over time or perform differently on different days; behavior and soundness cannot be guaranteed; a visual or ridden evaluation cannot identify all medical conditions. COMPANY is not a veterinarian, cannot diagnose medical conditions, and cannot certify soundness, and strongly recommends an independent veterinary examination before completing any purchase, sale, or lease. COMPANY does not guarantee performance, temperament, soundness, trainability, resale value, or suitability for any purpose, and does not guarantee the accuracy of information provided by owners, sellers, trainers, brokers, or other third parties. The requesting client alone decides whether to transact. COMPANY will disclose known relationships or interests relating to the horse. The evaluation is complete upon delivery of COMPANY's observations and opinions.

HORSE TO BE EVALUATED

Horse Name: {{HORSE.REGISTERED_NAME}}
Microchip: {{HORSE.MICROCHIP}}
Owner/Seller: {{HORSE.OWNER_NAME}}
Location of Horse: {{HORSE.CURRENT_LOCATION}}
Breed: {{HORSE.BREED}}
Age: {{HORSE.AGE_DOB}}
Registration Information: {{HORSE.REGISTRATION_NUMBER}}

EVALUATION SCOPE

Prospective transaction (if applicable): {{DIR.DIRECTION_TERM}}
Requesting client's role: {{DIR.ROLE_TERM}}
Intended Use: {{ENG.INTENDED_USE}}
Discipline: {{ENG.DISCIPLINE}}
Experience Level: {{ENG.EXPERIENCE_LEVEL}}
Competition Goals: {{ENG.COMPETITION_GOALS}}
Other Considerations: {{ENG.OTHER_CONSIDERATIONS}}
COMPANY disclosures: {{ENG.DISCLOSURES}}

FEES

Evaluation Fee (per horse): {{TXN.EVALUATION_FEE}}
Additional Services: {{TXN.ADDITIONAL_SERVICES}}

The Evaluation Fee is charged per horse evaluated, whether the horse was identified through a COMPANY search or otherwise, and is separate from, and in addition to, any search retainer, success/acquisition fee, or transaction representation fee under separately executed agreements. Approved expenses (travel, mileage, show or facility fees, additional appointments) are the requesting client's responsibility; travel is charged per the travel terms in the Company Policies.

SCHEDULING REQUEST

Preferred dates and times: {{REQ.PREFERRED_SCHEDULE}}
Notes: {{REQ.NOTES}}
```

### Content — RIDER_LESSON.md (complete, 38 lines)

```
RIDING LESSON ORDER

Order ID: {{ORD.UUID}}
Date: {{DOC.EFFECTIVE_DATE}}

ENGAGEMENT SUMMARY

This order is a request for riding instruction from {{ORG.LEGAL_NAME}} ("COMPANY"). Submission is a request, not a purchase. COMPANY reviews the request and, if approved, issues an approval for payment; the contract is formed upon completion of payment and is summarized in the purchase receipt. This engagement is governed by the Company Policies and the signed documents on file, including the Participant Liability Release, Emergency Medical Authorization, and Property Rules, Safety Acknowledgment, and Equestrian Conduct Agreement. No result, riding level, or outcome is guaranteed.

OFFERING

Service selected: {{ORD.SERVICE_SELECTION}}
Lesson Fee: {{TXN.SERVICE_FEE}}
Multi-Lesson Package: {{TXN.PACKAGE_FEE}}

<!-- CUT-START: JUMPER_TRAINING_SECTION | condition: include only if jumper training is selected -->
JUMPER TRAINING

Jumper training is a distinct offering separate from standard riding lessons, priced at its own rate and available only after COMPANY assesses the rider's ability and authorizes participation. Jumper training requires the signed Jumper Training Addendum on file before the first jumping session.

Jumper Training Fee: {{TXN.JUMPER_TRAINING_FEE}}
<!-- CUT-END: JUMPER_TRAINING_SECTION -->

<!-- CUT-START: MINOR_PARTICIPANT_INFO | condition: include only if PARTICIPANT is a minor -->
PARTICIPANT

This order is for the following minor participant on file:
Name: {{PARTICIPANT.FULL_NAME}}
Date of Birth: {{PARTICIPANT.DOB}}
<!-- CUT-END: MINOR_PARTICIPANT_INFO -->

SCHEDULING REQUEST

Preferred dates and times: {{REQ.PREFERRED_SCHEDULE}}
Location preference (if applicable): {{REQ.LOCATION_PREFERENCE}}
Notes: {{REQ.NOTES}}

Sessions are confirmed as bookings upon approval and payment. Rescheduling, late arrival, weather, and fee terms are set out in the Company Policies.
```

### Content — RIDER_LESSON_JUMPER.md (complete, 60 lines / 6,969 chars — the largest and most legally substantive of the six)

```
JUMPER TRAINING ADDENDUM TO PARTICIPANT LIABILITY RELEASE

This Jumper Training Addendum ("Addendum") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") by the undersigned client ("CLIENT"), on CLIENT's own behalf and, where a minor participant is identified, on behalf of that minor ("PARTICIPANT"), in favor of {{ORG.LEGAL_NAME}} ("COMPANY"). This Addendum supplements the separately executed Participant Liability Release, Assumption of Risk, Hold Harmless & Indemnification Agreement ("Participant Release") and applies specifically to jumper training. By signing below, CLIENT acknowledges and agrees to the terms of this Addendum. Where no minor is identified, references to PARTICIPANT mean CLIENT.

1. RELATIONSHIP TO PARTICIPANT RELEASE

This Addendum is in addition to, and does not replace, the Participant Release. All defined terms, release of liability, assumption of risk, hold harmless, indemnification, dispute resolution, attorney's fees, governing law, and media consent provisions of the Participant Release apply to jumper training and are incorporated by reference. In the event of a conflict regarding jumping activities, this Addendum controls.

2. NATURE OF JUMPER TRAINING

CLIENT understands that jumper training is a distinct, higher-risk offering separate from standard riding lessons. Jumper training involves schooling and riding a horse over fences, cavaletti, gymnastics, and courses at increasing heights and speeds as PARTICIPANT's ability progresses. It is offered at a separate rate and is available only to participants COMPANY has assessed and authorized.

3. ACKNOWLEDGMENT OF JUMPING-SPECIFIC RISKS

CLIENT understands and acknowledges that jumping activities carry risks beyond those of flatwork, which cannot be eliminated, including but not limited to: a horse refusing, stopping suddenly at, running out from, or ducking away from a jump; falls at speed; rotational falls in which the horse falls with or onto the rider; the horse striking, catching, or displacing rails, standards, or other jump components; loss of balance or unseating on approach, takeoff, flight, or landing; the horse landing awkwardly, stumbling, or falling after a fence; collision with jumps, standards, other horses, or arena structures; and injury of greater frequency and severity than that associated with flatwork, up to and including serious bodily injury, paralysis, permanent disability, and death.

4. ASSUMPTION OF JUMPING RISKS

PARTICIPANT knowingly and voluntarily assumes all inherent and ordinary risks of jumper training, including the jumping-specific risks described above. CLIENT accepts full responsibility, on CLIENT's own behalf and on behalf of any minor PARTICIPANT, for any injury, illness, disability, death, property damage, or other loss arising from jumper training.

5. ABILITY ATTESTATION

PARTICIPANT attests that the following information provided to COMPANY is true and complete: Years of riding experience: {{CLIENT.RIDING_EXPERIENCE_YEARS}}. Prior jumping experience and maximum height schooled: {{CLIENT.JUMP_EXPERIENCE}}. Prior instruction, showing, or competition experience: {{CLIENT.RIDING_BACKGROUND}}. Any relevant injuries, physical limitations, or gaps in riding: {{CLIENT.JUMP_LIMITATIONS}}. CLIENT understands that COMPANY relies on this information to determine eligibility and appropriate jump heights, that misrepresentation materially increases risk to PARTICIPANT and others, and that PARTICIPANT assumes all risks arising from any inaccuracy in the information provided.

6. COMPANY ASSESSMENT AND AUTHORIZATION

PARTICIPANT acknowledges and agrees that: Participation in jumper training is available only after COMPANY assesses PARTICIPANT's ability and authorizes participation. During any lesson, instruction, or session supervised by COMPANY, PARTICIPANT may not jump, school over fences, or attempt any jumping activity without COMPANY's prior authorization and approval. COMPANY may, in its sole discretion, decline, limit, modify, downgrade to flatwork, or discontinue any jumping activity at any time based on its assessment of PARTICIPANT's ability, the horse, footing, weather, or other conditions. COMPANY sets and may adjust the maximum jump height and difficulty appropriate for PARTICIPANT and may withhold advancement.

7. HELMET AND SAFETY EQUIPMENT

An ASTM/SEI-certified riding helmet, correctly fitted and fastened, is required at all times during jumper training without exception. PARTICIPANT must provide their own helmet and replace it after any fall or impact. COMPANY does not supply helmets. A rider without a compliant helmet may not participate.

8. SCOPE LIMITATION

This Addendum and its authorization requirement apply to jumping conducted under COMPANY's instruction or supervision. They do not govern a person's independent use of a horse that person owns or leases when that person is not participating in a COMPANY lesson, instruction, or session, and COMPANY assumes no liability for such independent jumping solely by reason of providing jumper training or other services to that person.

9. RELEASE AND INDEMNIFICATION FOR JUMPING ACTIVITIES

CLIENT, on CLIENT's own behalf and on behalf of any minor PARTICIPANT, releases, waives, and forever discharges the Released Parties (as defined in the Participant Release) from any and all claims arising out of or relating to jumper training, including claims arising from the ordinary negligence of the Released Parties, and agrees to defend, indemnify, and hold harmless the Released Parties on the same terms stated in the Participant Release. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

10. ACKNOWLEDGMENT

CLIENT acknowledges that: CLIENT has carefully read this Addendum and the Participant Release. CLIENT understands jumper training carries greater risk than flatwork. CLIENT has had the opportunity to ask questions before signing. CLIENT signs voluntarily and without coercion, on CLIENT's own behalf and, where applicable, on behalf of a minor PARTICIPANT.

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

Where a minor PARTICIPANT is identified above, CLIENT certifies that CLIENT is the parent or legal guardian of the minor and has authority to execute this Addendum on the minor's behalf, consents to the minor's participation in jumper training, and agrees to the release, assumption of risk, hold harmless, and indemnification provisions both on CLIENT's own behalf, including as to any claims CLIENT may hold individually arising from the minor's participation, and on behalf of the minor.
<!-- CUT-END: MINOR_PARTICIPANT -->
```

---

## 7. Two retired flat sale templates — HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER

- reported by: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- reachability: **Both inactive AND soft-deleted** — `active=false`, `deleted_at='2026-08-02 16:59:29.814039+00'` on both. `generate_document`'s `WHERE … AND active AND deleted_at IS NULL` excludes them. Both appear in **zero** rows of all four requirement matrices, zero clause/section/field/variant rows, and **zero documents**. Additionally both are in the generator's `RETIRED` set at `scripts/build-template-load-migration.mjs:66`, so their `.md` files (still present in the working tree at 1,251 and 906 bytes) are pointer notes that never re-load a body.
- exists: **yes** (rows present, soft-deleted; bodies fully intact)

Claim confirmed. Successor is the live `HORSE_SALE_V2` (active, clause-composed: 18 sections /
76 clauses / 65 field defs, `companion_template_key=HORSE_BILL_OF_SALE`, `allows_co_buyer=true`)
plus `HORSE_BILL_OF_SALE` (active, 11 sections / 36 clauses / 48 field defs). Neither successor
has generated a document yet either (`documents=0` on both).

```
template_key        | active | ver | body_len | deleted_at                        | contract_kind      | companion
HORSE_PURCHASE_SALE | false  | 1   | 4755     | 2026-08-02 16:59:29.814039+00     | HORSE_PURCHASE_SALE| HORSE_PURCHASE_ASSISTANCE
HORSE_SALE_TRANSFER | false  | 1   | 4213     | 2026-08-02 16:59:29.814039+00     | (null)             | HORSE_SALE_ASSISTANCE
```

### Content — HORSE_PURCHASE_SALE, full 4,755-char body

```
HORSE PURCHASE AND SALE AGREEMENT

This Horse Purchase and Sale Agreement ("Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") between the Seller and Buyer identified below. {{ORG.LEGAL_NAME}} ("COMPANY") is not a party to this Agreement.

SELLER

Name: {{SELLER.FULL_NAME}}
Address: {{SELLER.ADDRESS}}
Phone: {{SELLER.PHONE}}
Email: {{SELLER.EMAIL}}

BUYER

Name: {{BUYER.FULL_NAME}}
Address: {{BUYER.ADDRESS}}
Phone: {{BUYER.PHONE}}
Email: {{BUYER.EMAIL}}

HORSE INFORMATION

Registered Name: {{HORSE.REGISTERED_NAME}}
Barn Name: {{HORSE.BARN_NAME}}
Breed: {{HORSE.BREED}}
Color: {{HORSE.COLOR}}
Sex: {{HORSE.SEX}}
Age / Date of Birth: {{HORSE.AGE_DOB}}
Height: {{HORSE.HEIGHT}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Microchip / Identification: {{HORSE.MICROCHIP}}
Current Location: {{HORSE.CURRENT_LOCATION}}

1. PURCHASE AND TRANSFER

Seller represents that Seller owns, or has legal authority to sell, the Horse identified above, and agrees to sell and transfer ownership of the Horse to Buyer. Buyer agrees to purchase the Horse subject to the terms of this Agreement.

2. PURCHASE PRICE AND PAYMENT

Purchase Price: {{TXN.PURCHASE_PRICE}}
Deposit Amount: {{TXN.DEPOSIT_AMOUNT}}
Deposit Terms: {{TXN.DEPOSIT_TERMS}}
Balance Due: {{TXN.BALANCE_DUE}}
Payment Terms: {{TXN.PAYMENT_TERMS}}
Payment Method: {{TXN.PAYMENT_METHOD}}
Ownership transfers upon: {{TXN.TRANSFER_CONDITION}}

3. DELIVERY AND POSSESSION

Delivery Date: {{TXN.DELIVERY_DATE}}
Delivery Location: {{TXN.DELIVERY_LOCATION}}
Transportation Responsibility: {{TXN.TRANSPORT_RESPONSIBILITY}}
Risk of loss transfers: {{TXN.RISK_TRANSFER}}

4. SELLER REPRESENTATIONS AND DISCLOSURES

Seller represents, to the best of Seller's knowledge, that Seller has authority to sell the Horse and has disclosed known ownership issues, known liens or claims, known material health issues, and known dangerous behaviors.

Training History: {{HORSE.TRAINING_HISTORY}}
Competition History: {{HORSE.COMPETITION_HISTORY}}
Medical History: {{HORSE.MEDICAL_HISTORY}}
Behavioral History: {{HORSE.BEHAVIORAL_HISTORY}}
Medication History: {{HORSE.MEDICATION_HISTORY}}
Additional disclosures: {{TXN.ADDITIONAL_DISCLOSURES}}

5. PRE-PURCHASE EXAMINATION

Buyer has completed or declined a veterinary pre-purchase examination as follows: {{TXN.PPE_STATUS}}
Veterinarian: {{HORSE.VET_NAME}}
Examination Date: {{TXN.PPE_DATE}}
No party can guarantee the results of any examination.

6. TRIAL PERIOD

Trial Period: {{TXN.TRIAL_PERIOD}}
Terms: {{TXN.TRIAL_TERMS}}
During any trial period, risk of injury remains with: {{TXN.TRIAL_RISK_PARTY}}
Care responsibility remains with: {{TXN.TRIAL_CARE_PARTY}}

7. CONDITION OF HORSE; WARRANTIES

Except as specifically stated in this Agreement, Buyer acknowledges that horses are living animals, behavior and performance may change, and future soundness and performance cannot be guaranteed. Seller provides the following warranties: {{TXN.WARRANTIES}}. No other warranties are provided unless specifically written in this Agreement.

8. DOCUMENTS AND EQUIPMENT

Documents transferred: {{TXN.DOCUMENTS_TRANSFERRED}}
Included equipment: {{TXN.EQUIPMENT_INCLUDED}}
Excluded equipment: {{TXN.EQUIPMENT_EXCLUDED}}

9. INSURANCE

Buyer is responsible for obtaining appropriate insurance after transfer.

10. THIRD-PARTY ASSISTANCE

If COMPANY assisted with this transaction, the parties acknowledge COMPANY is not the owner of the Horse, is not a party to this purchase, and does not guarantee horse condition, either party's statements, buyer satisfaction, or future performance. Buyer releases COMPANY and third parties assisting with the transaction from claims arising from horse ownership, performance, condition, or Buyer decisions. This release does not apply to gross negligence, reckless conduct, or intentional misconduct.

11. INDEMNIFICATION

Each party agrees to indemnify the other for claims arising from their own misrepresentations, their breach of this Agreement, and their conduct after transfer.

12. DEFAULT

Default terms: {{TXN.DEFAULT_TERMS}}

13. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.

14. ATTORNEY'S FEES

Each party shall cover their own attorney's fees and costs.

15. GOVERNING LAW AND SEVERABILITY

California law governs this Agreement. If any provision is unenforceable, the remainder remains in effect.

16. ENTIRE AGREEMENT

This Agreement contains the complete agreement between Buyer and Seller.

SELLER

Signature: {{SIG.SELLER.NAME}}
Printed Name: {{SELLER.PRINTED_NAME}}
Date: {{SIG.SELLER.DATE}}

BUYER

Signature: {{SIG.BUYER.NAME}}
Printed Name: {{BUYER.PRINTED_NAME}}
Date: {{SIG.BUYER.DATE}}
```

### Content — HORSE_SALE_TRANSFER, full 4,213-char body

```
HORSE SALE AND TRANSFER AGREEMENT

This Horse Sale and Transfer Agreement ("Agreement") is made effective as of {{DOC.EFFECTIVE_DATE}} ("Effective Date") between the Seller and Buyer identified below. {{ORG.LEGAL_NAME}} ("COMPANY") is not a party to this Agreement.

SELLER

Name: {{SELLER.FULL_NAME}}
Address: {{SELLER.ADDRESS}}
Phone: {{SELLER.PHONE}}
Email: {{SELLER.EMAIL}}

BUYER

Name: {{BUYER.FULL_NAME}}
Address: {{BUYER.ADDRESS}}
Phone: {{BUYER.PHONE}}
Email: {{BUYER.EMAIL}}

HORSE INFORMATION

Registered Name: {{HORSE.REGISTERED_NAME}}
Barn Name: {{HORSE.BARN_NAME}}
Breed: {{HORSE.BREED}}
Color: {{HORSE.COLOR}}
Sex: {{HORSE.SEX}}
Age / Date of Birth: {{HORSE.AGE_DOB}}
Height: {{HORSE.HEIGHT}}
Registration Number: {{HORSE.REGISTRATION_NUMBER}}
Microchip / Identification: {{HORSE.MICROCHIP}}
Current Location: {{HORSE.CURRENT_LOCATION}}

1. SALE OF HORSE

Seller owns or has legal authority to sell the Horse and agrees to sell and transfer it to Buyer. Buyer agrees to accept ownership subject to this Agreement.

2. PRICE AND PAYMENT

Total Sale Price: {{TXN.PURCHASE_PRICE}}
Deposit: {{TXN.DEPOSIT_AMOUNT}}
Remaining Balance: {{TXN.BALANCE_DUE}}
Payment Schedule: {{TXN.PAYMENT_SCHEDULE}}
Payment Method: {{TXN.PAYMENT_METHOD}}

3. TRANSFER OF OWNERSHIP

Ownership transfers upon: {{TXN.TRANSFER_CONDITION}}
Transfer Date: {{TXN.TRANSFER_DATE}}

4. DELIVERY AND POSSESSION

Delivery Location: {{TXN.DELIVERY_LOCATION}}
Delivery Date: {{TXN.DELIVERY_DATE}}
Transportation Responsibility: {{TXN.TRANSPORT_RESPONSIBILITY}}
Risk of loss transfers: {{TXN.RISK_TRANSFER}}

5. SELLER DISCLOSURES AND REPRESENTATIONS

Seller represents that Seller has authority to sell the Horse, has disclosed known ownership issues and known liens or claims, and has provided truthful information to the best of Seller's knowledge regarding health history, injury history, training history, behavioral issues, medication history, and competition history.

Additional disclosures: {{TXN.ADDITIONAL_DISCLOSURES}}

6. BUYER ACKNOWLEDGMENT

Buyer acknowledges that horses are living animals, performance may change, future soundness cannot be guaranteed, and behavior may vary after transfer.

7. PRE-PURCHASE EXAMINATION

Buyer has completed or declined a veterinary examination as follows: {{TXN.PPE_STATUS}}
Veterinarian: {{HORSE.VET_NAME}}
Examination Date: {{TXN.PPE_DATE}}

8. TRIAL PERIOD

Trial Period: {{TXN.TRIAL_PERIOD}}
Terms: {{TXN.TRIAL_TERMS}}
Responsibility during trial: {{TXN.TRIAL_CARE_PARTY}}

9. DOCUMENTS AND EQUIPMENT

Seller agrees to provide: {{TXN.DOCUMENTS_TRANSFERRED}}
Included equipment: {{TXN.EQUIPMENT_INCLUDED}}
Excluded equipment: {{TXN.EQUIPMENT_EXCLUDED}}

10. NO CONTINUING OBLIGATION

Unless separately agreed in writing, Seller has no continuing responsibility for training, veterinary care, boarding, performance, or future value.

11. THIRD-PARTY DISCLOSURE

If COMPANY assisted with this transaction, the parties acknowledge COMPANY is not the owner of the Horse and is not responsible for horse condition, buyer satisfaction, seller representations, or future performance.

12. RELEASE

Buyer releases Seller and any assisting parties from claims arising after transfer except claims based on fraud, intentional misrepresentation, or obligations expressly stated in this Agreement.

13. INDEMNIFICATION

Each party agrees to indemnify the other for claims arising from their own conduct, their breach of this Agreement, and their misrepresentations.

14. DEFAULT

Default terms: {{TXN.DEFAULT_TERMS}}

15. DISPUTE RESOLUTION

Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration in San Diego, California.

16. ATTORNEY'S FEES

Each party shall cover their own attorney's fees and costs.

17. GOVERNING LAW AND SEVERABILITY

California law governs this Agreement. If any provision is unenforceable, the remainder remains in effect.

18. ENTIRE AGREEMENT

This Agreement represents the complete agreement between Buyer and Seller.

SELLER

Signature: {{SIG.SELLER.NAME}}
Printed Name: {{SELLER.PRINTED_NAME}}
Date: {{SIG.SELLER.DATE}}

BUYER

Signature: {{SIG.BUYER.NAME}}
Printed Name: {{BUYER.PRINTED_NAME}}
Date: {{SIG.BUYER.DATE}}
```

---

## 8. 59 template_tokens rows with a dead source_table (public.template_tokens)

- reported by: TASK-TEXTEDIT-REPORT.md
- reachability: **These rows ARE reachable and visible** — they are not dead code hidden from
  view. They appear in the admin token picker with a red **"source retired"** badge. What is dead
  is the *wiring they describe*: `source_table` names a table that no longer exists in
  `information_schema.tables`. Also note **all 59 have `template_id IS NULL`** — they are global
  tokens, not bound to any template, so retiring a template never cascaded them away.
- exists: **yes** — all 59 rows present, deliberately not deleted.

**Count independently recomputed, not taken from the report:**
```sql
select count(*) from template_tokens tt
 where tt.source_table is not null
   and not exists (select 1 from information_schema.tables t
                    where t.table_schema='public' and t.table_name = tt.source_table);
--  → 59
```
(`template_tokens` now holds 360 rows total, of which 170 have `template_id IS NULL`. Note the
TOKENAUDIT-era total of 307 has since grown to 360.)

The `source_live` flag is **computed at read time from `information_schema`, never trusted from
the row** — `supabase/migrations/20260812T1500_textedit_template_wording_drafts.sql:396-400`:
```sql
    (tt.source_table IS NOT NULL AND EXISTS (
       SELECT 1 FROM information_schema.tables t
       WHERE t.table_schema = 'public' AND t.table_name = tt.source_table
     )) AS source_live
```
with the rationale at lines 366-370 of the same file:
```
-- The table is the data (not docs/design/TOKEN_DICTIONARY.md). TOKENAUDIT wrote notes
-- for all 307 rows and found 59 whose source_table no longer exists; the picker
-- must not present dead wiring as live, so source_live is computed here from
-- information_schema rather than trusted from the row.
```

The badge itself — `src/components/ops/templates/TokenPicker.tsx:56-61`:
```tsx
{!t.computed && t.source_table && !t.source_live && (
  <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 shrink-0"
    title={`Recorded source ${t.source_table} no longer exists (TOKENAUDIT).`}>
    source retired
  </span>
)}
```
and the stated intent — `src/components/ops/templates/TokenPicker.tsx:13-15`:
```
 *   source retired — TOKENAUDIT found 59 tokens pointing at tables that no
 *                    longer exist; presenting that wiring as live would be the
 *                    surface-reports-success failure this codebase repeats.
```

### Content — ALL 59 rows (token | namespace | field | dead source_table.column | computed)

The dead tables are: `intake`, `engagements`, `config`, `brand`, `horse_records`,
`client_purchases`, `engagement_parties`, `transactions`. Note `transactions` alone accounts for
24 of the 59.

```
{{ENG.ADDITIONAL_REQUIREMENTS}} | ENG | ADDITIONAL_REQUIREMENTS | intake.additional_requirements   | computed=false
{{ENG.AGE_RANGE}}               | ENG | AGE_RANGE               | intake.age_range                 | computed=false
{{ENG.BREED_PREFERENCE}}        | ENG | BREED_PREFERENCE        | intake.breed_preference          | computed=false
{{ENG.BUDGET}}                  | ENG | BUDGET                  | intake.budget                    | computed=false
{{ENG.COMPETITION_GOALS}}       | ENG | COMPETITION_GOALS       | intake.competition_goals         | computed=false
{{ENG.DISCIPLINE}}              | ENG | DISCIPLINE              | intake.discipline                | computed=false
{{ENG.DISCLOSURES}}             | ENG | DISCLOSURES             | intake.disclosures               | computed=false
{{ENG.EXPERIENCE_LEVEL}}        | ENG | EXPERIENCE_LEVEL        | intake.experience_level          | computed=false
{{ENG.HEIGHT_RANGE}}            | ENG | HEIGHT_RANGE            | intake.height_range              | computed=false
{{ENG.ID}}                      | ENG | ID                      | engagements.display_code         | computed=false
{{ENG.INTENDED_USE}}            | ENG | INTENDED_USE            | intake.intended_use              | computed=false
{{ENG.OTHER_CONSIDERATIONS}}    | ENG | OTHER_CONSIDERATIONS    | intake.other_considerations      | computed=false
{{ENG.PROGRAM_SCOPE}}           | ENG | PROGRAM_SCOPE           | intake.program_scope             | computed=false
{{ENG.PROTECTION_PERIOD}}       | ENG | PROTECTION_PERIOD       | config.protection_period         | computed=true
{{ENG.SEARCH_OBJECTIVE}}        | ENG | SEARCH_OBJECTIVE        | intake.search_objective          | computed=false
{{ENG.SERVICE_TYPE}}            | ENG | SERVICE_TYPE            | engagements.service_type         | computed=false
{{ENG.START_DATE}}              | ENG | START_DATE              | engagements.start_date           | computed=false
{{FHE.ADDRESS}}                 | FHE | ADDRESS                 | config.business_address          | computed=true
{{FHE.EMAIL}}                   | FHE | EMAIL                   | brand.email                      | computed=true
{{FHE.LEGAL_NAME}}              | FHE | LEGAL_NAME              | config.legal_entity_name         | computed=true
{{FHE.PHONE}}                   | FHE | PHONE                   | brand.phone_display              | computed=true
{{FHE.SIGNATORY_NAME}}          | FHE | SIGNATORY_NAME          | config.signatory_name            | computed=true
{{FHE.SIGNATORY_TITLE}}         | FHE | SIGNATORY_TITLE         | config.signatory_title           | computed=true
{{HORSE.MEDICATION_ADDITIONAL}} | HORSE | MEDICATION_ADDITIONAL | horse_records.medication_additional   | computed=false
{{HORSE.MEDICATION_DOSAGE}}     | HORSE | MEDICATION_DOSAGE     | horse_records.medication_dosage       | computed=false
{{HORSE.MEDICATION_INSTRUCTIONS}} | HORSE | MEDICATION_INSTRUCTIONS | horse_records.medication_instructions | computed=false
{{HORSE.MEDICATION_NAME}}       | HORSE | MEDICATION_NAME       | horse_records.medication_name         | computed=false
{{ORD.SERVICE_SELECTION}}       | ORD | SERVICE_SELECTION       | client_purchases.tier_label      | computed=false
{{PARTY.RELATIONSHIP}}          | PARTY | RELATIONSHIP          | engagement_parties.relationship  | computed=false
{{REQ.CONDITION_UPDATES}}       | REQ | CONDITION_UPDATES       | intake.condition_updates         | computed=false
{{REQ.LOCATION_PREFERENCE}}     | REQ | LOCATION_PREFERENCE     | intake.location_preference       | computed=false
{{REQ.NOTES}}                   | REQ | NOTES                   | intake.notes                     | computed=false
{{REQ.PREFERRED_SCHEDULE}}      | REQ | PREFERRED_SCHEDULE      | intake.preferred_schedule        | computed=false
{{TXN.ADDITIONAL_SERVICES}}     | TXN | ADDITIONAL_SERVICES     | transactions.additional_services | computed=false
{{TXN.COMMISSION_MIN}}          | TXN | COMMISSION_MIN          | config.commission_min            | computed=true
{{TXN.COMMISSION_RATE}}         | TXN | COMMISSION_RATE         | config.commission_rate           | computed=true
{{TXN.COMPETITION_EXPENSES}}    | TXN | COMPETITION_EXPENSES    | transactions.competition_expenses| computed=false
{{TXN.DELIVERY_DATE}}           | TXN | DELIVERY_DATE           | transactions.delivery_date       | computed=false
{{TXN.DELIVERY_LOCATION}}       | TXN | DELIVERY_LOCATION       | transactions.delivery_location   | computed=false
{{TXN.DEPOSIT_AMOUNT}}          | TXN | DEPOSIT_AMOUNT          | transactions.deposit_amount      | computed=false
{{TXN.EVALUATION_FEE}}          | TXN | EVALUATION_FEE          | transactions.evaluation_fee      | computed=false
{{TXN.JUMPER_TRAINING_FEE}}     | TXN | JUMPER_TRAINING_FEE     | transactions.jumper_training_fee | computed=false
{{TXN.LEASE_END}}               | TXN | LEASE_END               | transactions.lease_end           | computed=false
{{TXN.LEASE_FEE}}               | TXN | LEASE_FEE               | transactions.lease_fee           | computed=false
{{TXN.LEASE_START}}             | TXN | LEASE_START             | transactions.lease_start         | computed=false
{{TXN.LEASE_TYPE}}              | TXN | LEASE_TYPE              | transactions.lease_type          | computed=false
{{TXN.MONTHLY_FEE}}             | TXN | MONTHLY_FEE             | transactions.monthly_fee         | computed=false
{{TXN.OTHER_FEES}}              | TXN | OTHER_FEES              | transactions.other_fees          | computed=false
{{TXN.PACKAGE_FEE}}             | TXN | PACKAGE_FEE             | transactions.service_fee         | computed=false
{{TXN.PAYMENT_SCHEDULE}}        | TXN | PAYMENT_SCHEDULE        | transactions.payment_schedule    | computed=false
{{TXN.PAYMENT_TERMS}}           | TXN | PAYMENT_TERMS           | transactions.payment_terms       | computed=false
{{TXN.PERMITTED_ACTIVITIES}}    | TXN | PERMITTED_ACTIVITIES    | transactions.permitted_activities| computed=false
{{TXN.PURCHASE_PRICE}}          | TXN | PURCHASE_PRICE          | transactions.amount              | computed=false
{{TXN.RENEWAL_TERMS}}           | TXN | RENEWAL_TERMS           | transactions.renewal_terms       | computed=false
{{TXN.REPRESENTATION_FEE}}      | TXN | REPRESENTATION_FEE      | transactions.representation_fee  | computed=false
{{TXN.RETAINER_FEE}}            | TXN | RETAINER_FEE            | transactions.retainer_fee        | computed=false
{{TXN.SERVICE_FEE}}             | TXN | SERVICE_FEE             | transactions.service_fee         | computed=false
{{TXN.SESSION_FEE}}             | TXN | SESSION_FEE             | transactions.session_fee         | computed=false
{{TXN.SUCCESS_FEE}}             | TXN | SUCCESS_FEE             | transactions.success_fee         | computed=false
```

**Worth the owner's eye:** several of these tokens are *actively used in live template bodies*
even though their recorded source is dead — e.g. `{{TXN.PAYMENT_SCHEDULE}}` and
`{{TXN.SERVICE_FEE}}` both appear in the live MINOR_RIDER body (block 2), and
`{{TXN.LEASE_FEE}}` / `{{TXN.LEASE_TYPE}}` / `{{TXN.RENEWAL_TERMS}}` appear in the archived
HORSE_LEASE body. So "source retired" here means *the recorded provenance is stale*, not that
the token is unused. Whether they still resolve at merge time depends on the merge path, which
this pass did not exercise.

---

## 9. scripts/build-template-load-migration.mjs — the dead POST_SEED_TEMPLATES.RIDER_LESSON entry

- reported by: TASK-SVCPURGE-REPORT.md
- reachability: **The entry no longer exists.** `grep -n "RIDER_LESSON" scripts/build-template-load-migration.mjs` returns exactly **one** hit, line 56, and it is inside a comment explaining the removal — there is no `RIDER_LESSON:` key in the object. The claim is confirmed: a fresh database can no longer re-seed the purged row from this generator.
- exists: **the entry was deleted in `4049ced62aee7a86ba575c06c7366dd5128542a8` — "SVCPURGE: retire the six service contract templates (owner ruling 2026-08-05)"** (the file itself of course still exists)

### Content — the CURRENT POST_SEED_TEMPLATES block (`scripts/build-template-load-migration.mjs:43-66`)

```js
const POST_SEED_TEMPLATES = {
  RELEASE_GENERAL:        { title: 'General Visitor Liability Release',                 parties: ['PARTICIPANT', 'GUARDIAN'] },
  RELEASE_PARTICIPANT:    { title: 'Participant Liability Release',                     parties: ['PARTICIPANT', 'GUARDIAN'] },
  // Owner 2026-07-05: horse-care release UNIFIED under RELEASE_HORSE_CARE (one
  // equine-services release for all horse-care services — clipping/turnout through
  // lunging/riding/training). RELEASE_HORSE_EXERCISE retired (migration
  // 20260705000000 repoints the matrix + deactivates the old key).
  RELEASE_HORSE_CARE:     { title: 'Horse Handling and Routine Care Liability Release', parties: ['PARTICIPANT', 'GUARDIAN'] },
  // Contract-module decomposition (20260701080000): the side-scoped Layer 2
  // transaction-representation module. service_type stays NULL (one tokenized
  // template serves purchase/sale/lease-in/lease-out representation).
  HORSE_TRANSACTION_REP:  { title: 'Horse Transaction Representation Agreement',        parties: ['CLIENT', 'COMPANY'] },
  // Owner template revision 2026-07-03: unified CLIENT-signer doc set. COMPANY_POLICIES
  // joins the required signing matrix for every service. (RIDER_LESSON, the unsigned
  // lesson order form, was retired with the other five service contracts by SVCPURGE
  // 2026-08-06 — its INSERT lived here and would have re-seeded the row on a fresh
  // database, so it is removed rather than left dormant.)
  COMPANY_POLICIES:       { title: 'Company Policies',                                  parties: ['CLIENT'] },
};

// Retired templates: their .md is a pointer/note, not contract text. The lease is
// now built from DB clause defs (HORSE_LEASE_V2), so never re-load HORSE_LEASE's
// body from its (retired) .md file. See supabase/contract_templates/HORSE_LEASE.md.
const RETIRED = new Set(['HORSE_LEASE', 'HORSE_PURCHASE_SALE', 'HORSE_SALE_TRANSFER']);
```

### Content — the removed entry, from `git show 4049ced -- scripts/build-template-load-migration.mjs`

```diff
@@ -53,10 +53,11 @@ const POST_SEED_TEMPLATES = {
   // template serves purchase/sale/lease-in/lease-out representation).
   HORSE_TRANSACTION_REP:  { title: 'Horse Transaction Representation Agreement',        parties: ['CLIENT', 'COMPANY'] },
   // Owner template revision 2026-07-03: unified CLIENT-signer doc set. COMPANY_POLICIES
-  // joins the required signing matrix for every service; RIDER_LESSON is the (unsigned)
-  // lesson order form. Both are new keys postdating the migration-11 seed.
+  // joins the required signing matrix for every service. (RIDER_LESSON, the unsigned
+  // lesson order form, was retired with the other five service contracts by SVCPURGE
+  // 2026-08-06 — its INSERT lived here and would have re-seeded the row on a fresh
+  // database, so it is removed rather than left dormant.)
   COMPANY_POLICIES:       { title: 'Company Policies',                                  parties: ['CLIENT'] },
-  RIDER_LESSON:           { title: 'Riding Lesson Order Form',                          parties: ['CLIENT'] },
 };
```

The single removed line in full:
```js
  RIDER_LESSON:           { title: 'Riding Lesson Order Form',                          parties: ['CLIENT'] },
```

---

## Appendix — recovered artifacts held on disk for this session

Recovered file copies (from git history) are at
`/private/tmp/claude-504/-Users-Cactai/5a47bfcc-2691-47a7-b539-4d95f2da8aa9/scratchpad/flagharvest/dump/`:
`DEL_HORSE_TRAINING.md`, `DEL_HORSE_EXERCISE.md`, `DEL_HORSEMANSHIP_TRAINING.md`,
`DEL_HORSE_EVALUATION.md`, `DEL_RIDER_LESSON.md`, `DEL_RIDER_LESSON_JUMPER.md`,
`DEL_HORSE_REPRESENTATION.md`, plus DB body dumps `HORSE_LEASE.body.txt`,
`MINOR_RIDER.body.txt`, `HORSE_PURCHASE_SALE.body.txt`, `HORSE_SALE_TRANSFER.body.txt`.
Every one is reproducible from git or prod with the commands cited in each block.

---

# Part 2 — Database functions, views and policies


Evidence gathered 2026-08-13 against **live prod** (`psql` as `postgres`, PostgreSQL 17.6) and the worktree at `/Users/cactai/Downloads/claude-code-repo/wt-flagharvest`.
Read-only. Nothing changed. Nothing recommended for deletion.

**Scan credibility (positive control).** The `pg_proc.prosrc` scan used throughout was validated on every run against two names known to be alive:

```
target                                  other_fns_mentioning
has_staff_access                        185
caller_is_document_party                 39
```

A scan that returns 185 and 39 for live helpers is working; a `0` from the same scan is therefore meaningful.

**Five claims below are now STALE or WRONG.** Flagged inline in bold: #2, #4, #6, #7, #8/#9 (ACL half), #14.

---

## public.clients_overview (view — public.clients_overview)
- reported by: TASK-SECFIX-REPORT.md
- reachability: VERIFIED unreachable from application code. `grep -rn "clients_overview" src/ api/` → **no output**. The only hits repo-wide are in the generated test fixture `test/db/fixtures/schema_snapshot.sql:20983,20986` (the schema dump itself, not a read). `anon` SELECT is revoked in prod (`has_table_privilege('anon', …, 'SELECT')` = **f**); `authenticated` retains SELECT = t. Claim CONFIRMED.
- exists: yes
- content:

Definition (`pg_get_viewdef('public.clients_overview', true)`):
```sql
 SELECT cl.id,
    cl.status,
    cl.source,
    cl.created_at,
    c.first_name,
    c.last_name,
    c.email,
    c.phone,
    c.display_code
   FROM clients cl
     JOIN contacts c ON c.id = cl.contact_id
  WHERE cl.deleted_at IS NULL;
```

Row count: **17**

reloptions: `{security_invoker=true}`

Grants (`relacl`):
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```
Note the `anon` grant string is `awdDxtm` — the `r` (SELECT) is absent, which is the SECFIX revoke. `authenticated` is `arwdDxtm` (has `r`).

Privilege matrix:
```
     relname      | anon_select | auth_select | svc_select
------------------+-------------+-------------+------------
 clients_overview | f           | t           | t
```

---

## public.service_credits (view — public.service_credits)
- reported by: TASK-SECFIX-REPORT.md
- reachability: VERIFIED unreachable from application code. `grep -rn "service_credits" src/ api/` → **no output**. Only hits are `test/db/fixtures/schema_snapshot.sql:23274,23277`. `anon` SELECT revoked (= f), `authenticated` = t. The *reference* claim is CONFIRMED.
- exists: yes
- content:

**⚠️ THE ROW-COUNT CLAIM IS NOW STALE. The report said 0 rows at verification time. It now holds 3 rows, all created 2026-08-10, and two of them have been DECREMENTED since (`updated_at` later than `created_at`, `remaining` dropped 1 → 0).** This view is a live read-alias over `lesson_credits` and the underlying data is actively moving. It is not an empty shell.

Definition (`pg_get_viewdef('public.service_credits', true)`):
```sql
 SELECT id,
    org_id,
    client_id,
    offering_id,
    package_key,
    credits_total AS total,
    credits_remaining AS remaining,
    credits_total,
    credits_remaining,
    purchased_at,
    created_at,
    updated_at,
    deleted_at,
    deleted_by
   FROM lesson_credits;
```

CURRENT row count: **3**

Current rows in full:
```
                  id                  |                org_id                |              client_id               | offering_id |  package_key   | total | remaining | credits_total | credits_remaining |         purchased_at          |          created_at           |          updated_at           | deleted_at | deleted_by
--------------------------------------+--------------------------------------+--------------------------------------+-------------+----------------+-------+-----------+---------------+-------------------+-------------------------------+-------------------------------+-------------------------------+------------+------------
 3ccdbec2-37f5-4b6e-9082-ed7596d85d98 | e656f20b-ef43-4725-9029-19e7f0190d9c | 0a20faf4-a6a4-4965-898c-e992f2a74e01 |             | Full Body Clip |     1 |         1 |             1 |                 1 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 |            |
 d32fb522-7594-4ea2-a205-287f767baf2d | e656f20b-ef43-4725-9029-19e7f0190d9c | 0a20faf4-a6a4-4965-898c-e992f2a74e01 |             | Single Class   |     1 |         0 |             1 |                 0 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 16:45:29.93967+00  |            |
 a8fabb31-9ec2-464a-8cbe-8bcb8e3dac47 | e656f20b-ef43-4725-9029-19e7f0190d9c | 0a20faf4-a6a4-4965-898c-e992f2a74e01 |             | Single Lesson  |     1 |         0 |             1 |                 0 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 15:49:48.658695+00 | 2026-08-10 16:45:58.26652+00  |            |
```

reloptions: `{security_invoker=true}`

Grants (`relacl`):
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Privilege matrix:
```
    relname     | anon_select | auth_select | svc_select
----------------+-------------+-------------+------------
 service_credits| f           | t           | t
```

---

## public.memberships (view — public.memberships)
- reported by: TASK-SECFIX-REPORT.md
- reachability: The "two grep hits are prose comments" claim is CONFIRMED **for `src/` and `api/`** — `grep -rn "memberships" src/ api/` returns exactly two lines, both in `api/hard-delete-client.ts`, both comments about FK cascade, neither a view read. **However the claim understates reach: `test/db/` contains real SQL reads and writes against `memberships`** (`membership_self_heal.test.ts:53,71,81,90,100,107`, `redeem_invitation.test.ts:40,64,70`, `platform_catalog_org_scope.test.ts:66`). Those run against the PGlite harness, not prod, but they are live executable references, not prose. `anon` SELECT revoked (= f); `authenticated` = t.
- exists: yes
- content:

The two `api/hard-delete-client.ts` hits, verbatim:
```
api/hard-delete-client.ts:12: * memberships / grants (all FK ON DELETE CASCADE on user_id).
api/hard-delete-client.ts:48:    //    cascades profiles / memberships / grants. ──
```

In context (lines 10–13 and 46–49) these read:
```
 * Body: { contactId } for a client, OR { userId } for a team member (staff
 * accounts have no contact row). Deleting the auth user cascades profiles /
 * memberships / grants (all FK ON DELETE CASCADE on user_id).
 * -> 200 { ok, deletedUser, deletedContact }
...
    // ── Team-member (user_id) path: no contact row. Deleting the auth user
    //    cascades profiles / memberships / grants. ──
    if (!contactId && userId) {
```
Both are comments describing the `members` base-table cascade. Neither reads the view. CONFIRMED.

Definition (`pg_get_viewdef('public.memberships', true)`):
```sql
 SELECT id,
    user_id,
    status,
    started_at,
    renews_at,
    created_at,
    org_id
   FROM members;
```

Row count: **12**

reloptions: `{security_invoker=true}`

Grants (`relacl`):
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Also worth seeing — the base table still carries a constraint named for the view, and a live self-heal function references the concept:
```
test/db/fixtures/schema_snapshot.sql:24733:-- Name: members memberships_pkey; Type: CONSTRAINT
test/db/fixtures/schema_snapshot.sql:24741:-- Name: members memberships_user_id_key; Type: CONSTRAINT
```

---

## public.ensure_gift_buyer_account(uuid) (function — public.ensure_gift_buyer_account)
- reported by: TASK-SECFIX2-REPORT.md
- reachability: **THE CLAIM IS NOW WRONG. This function is NOT dead — it has a live in-database caller.** The `pg_proc.prosrc` scan (the same scan that returns 185 for `has_staff_access`) finds **1** other function whose body references it:

  ```
  ensure_gift_buyer_account | 1
  ```
  ```
  === WHO MENTIONS ensure_gift_buyer_account ===
  create_gift(uuid,text,text,text,text,text,boolean,uuid)
  ```

  So: `grep -rn "ensure_gift_buyer_account" src/ api/` → no output (correct, no TS caller); `pg_depend` non-internal dependencies → none (correct, function-to-function calls in plpgsql do not create pg_depend rows — which is exactly why the original three-way check missed it); but the **prosrc scan now finds `create_gift`, which calls it for real**. The report's own premise ("gift redemption runs through redeem_gift, which never calls it") is true but incomplete — it is *gift creation*, not gift redemption, that calls it. GIFTCREDITS item D8/4b explicitly revived this call site on 2026-08-11, after SECFIX2 was written.

  Separately, the ACL has since been hardened: `anon` and `authenticated` EXECUTE are both now **f** (`proacl = {postgres=X/postgres,service_role=X/postgres}`).
- exists: yes
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.ensure_gift_buyer_account(p_gift_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_g      gifts%ROWTYPE;
  v_res    jsonb;
  v_fn     text;
  v_ln     text;
BEGIN
  SELECT * INTO v_g FROM gifts WHERE id = p_gift_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'gift not found'; END IF;
  IF v_g.org_id IS NULL OR nullif(btrim(coalesce(v_g.buyer_email,'')),'') IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing org or buyer email');
  END IF;

  v_fn := nullif(split_part(coalesce(v_g.buyer_name,''), ' ', 1), '');
  v_ln := nullif(btrim(substr(coalesce(v_g.buyer_name,''),
            coalesce(nullif(position(' ' in coalesce(v_g.buyer_name,'')), 0),
                     length(coalesce(v_g.buyer_name,''))+1))), '');

  -- THE SPINE, with the commercial marker. Categories empty → no service docs.
  v_res := _ensure_client_account(v_g.org_id, lower(btrim(v_g.buyer_email)),
                                  v_fn, v_ln, ARRAY[]::text[], ARRAY[]::text[], 'CUSTOMER');
  RETURN jsonb_build_object('ok', true, 'contact_id', v_res->>'contact_id');
END;
$function$
```

ACL / volatility / security: `VOLATILE`, `SECURITY DEFINER`, `proacl = {postgres=X/postgres,service_role=X/postgres}` (no PUBLIC, no anon, no authenticated).

**The live call site, in `create_gift`** — this is the evidence that contradicts the claim:
```sql
  -- D8/4b: revives the buyer-account call site written in Stage 4 for exactly
  -- this moment — dead until now because nothing created a gift. Soft-fails:
  -- a buyer-account hiccup must not block the gift itself from existing, but
  -- (matching the D3 lesson) it must not be a silent NULL either.
  BEGIN
    v_buyer_acct := ensure_gift_buyer_account(v_gift);
  EXCEPTION WHEN others THEN
    PERFORM notify_staff(v_off.org_id, 'gift_buyer_account_failed',
      'Gift ' || v_code || ' created, but buyer account setup failed for '
        || p_buyer_email || ' — ' || SQLERRM,
      '/app/ops/intake');
  END;
```
and its result is returned to the caller:
```sql
  RETURN jsonb_build_object(
    'gift_id', v_gift, 'code', v_code,
    'claim_link', '/redeem?code=' || v_code,
    'buyer_contact_id', v_buyer_acct->>'contact_id');
```

**The account-creation branch of `redeem_gift`, for comparison** (this is what runs for the *recipient*, a different person from the buyer):
```sql
  -- D2 (owner ruling 2026-08-11): the taxonomy splits on what the person
  -- HOLDS, not who paid. A real service (config_kind present, not a pure
  -- inquiry line — the same test attach_first_purchase_policies and
  -- promote_buyer_from_offering already use) makes the redeemer a CLIENT.
  -- Anything else — no linked offering, or a non-service line — CUSTOMER:
  -- they hold something but received no experience.
  v_marker := CASE
    WHEN v_off.config_kind IS NOT NULL AND v_off.config_kind <> 'inquire' THEN 'CLIENT'
    ELSE 'CUSTOMER'
  END;

  v_fn := nullif(split_part(coalesce(v_gift.recipient_name, ''), ' ', 1), '');
  v_ln := nullif(btrim(substr(coalesce(v_gift.recipient_name, ''),
            coalesce(nullif(position(' ' in coalesce(v_gift.recipient_name,'')), 0),
                     length(coalesce(v_gift.recipient_name,''))+1))), '');

  BEGIN
    PERFORM set_config('app.allow_profile_link', '1', true);
    INSERT INTO profiles (user_id, org_id, first_name, last_name, email)
    VALUES (auth.uid(), v_gift.org_id, v_fn, v_ln, v_email)
    ON CONFLICT (user_id) DO NOTHING;

    -- BUG FIX: NULL/NULL, not ARRAY[]::text[]/ARRAY[]::text[]. An empty (but
    -- non-NULL) template_keys array took _ensure_client_account's "insert
    -- these specific docs" branch and unnested to zero rows — permanently
    -- skipping its "derive from category" fallback. NULL lets that fallback
    -- run (category defaults to GUEST for a brand-new contact); the real
    -- RIDER/HORSE_OWNER category — and the documents it requires — gets
    -- derived a moment later from the purchase itself, same as every other
    -- purchase path (see below).
    v_res := _ensure_client_account(v_gift.org_id, v_email, v_fn, v_ln, NULL, NULL, v_marker);
    v_contact := (v_res->>'contact_id')::uuid;
    v_client  := (v_res->>'client_id')::uuid;
    ...
    PERFORM promote_contact_to_account(auth.uid(), v_contact);
  EXCEPTION WHEN others THEN
    PERFORM notify_staff(v_gift.org_id, 'gift_redemption_failed',
      'Gift ' || v_gift.code || ' redemption failed for ' || v_email || ' — ' || SQLERRM,
      '/app/ops/intake');
    RETURN 'redemption_failed';
  END;
```

The two are complementary, not duplicative: `ensure_gift_buyer_account` hard-codes marker `'CUSTOMER'` and `ARRAY[]::text[]` categories (buyer gets no service docs); `redeem_gift` computes `CLIENT` vs `CUSTOMER` from the offering and passes `NULL/NULL` so the category fallback runs. They provision two different people.

---

## public.member_directory (view — public.member_directory)
- reported by: TASK-SECFIX2-REPORT.md
- reachability: CONFIRMED unreadable by every web role. `has_table_privilege` returns **f for both `anon` and `authenticated`**; only `service_role` (and the owner `postgres`) can SELECT. `grep -rn "from('member_directory')" src/ api/` → **no output** (exit 1). Every `member_directory` string in `src/` is either a prose comment or the *different* object `member_directory_list` (a SECURITY DEFINER RPC), e.g. `src/lib/community.ts:36,44` call `supabase.rpc('member_directory_list')`. `security_invoker=true` confirmed in reloptions. Claim CONFIRMED in full.
- exists: yes
- content:

Definition (`pg_get_viewdef('public.member_directory', true)`):
```sql
 SELECT p.user_id,
    p.display_name,
    COALESCE(p.first_name, c.first_name) AS first_name,
    p.avatar_url,
    p.bio,
    p.riding_level,
        CASE
            WHEN c.hide_community_email THEN NULL::text
            ELSE c.community_email
        END AS community_email,
        CASE
            WHEN c.hide_mobile_call THEN NULL::text
            ELSE c.mobile_call
        END AS mobile_call,
        CASE
            WHEN c.hide_mobile_text THEN NULL::text
            ELSE c.mobile_text
        END AS mobile_text,
        CASE
            WHEN c.hide_whatsapp_call THEN NULL::text
            ELSE c.whatsapp_call
        END AS whatsapp_call,
        CASE
            WHEN c.hide_whatsapp_text THEN NULL::text
            ELSE c.whatsapp_text
        END AS whatsapp_text,
        CASE
            WHEN c.hide_email THEN NULL::text
            ELSE c.email
        END AS email,
        CASE
            WHEN c.hide_mobile THEN NULL::text
            ELSE c.mobile
        END AS mobile,
        CASE
            WHEN c.hide_whatsapp THEN NULL::text
            ELSE c.whatsapp
        END AS whatsapp,
    c.social_tiktok,
    c.social_instagram,
    c.social_facebook,
    c.social_linkedin,
    (EXISTS ( SELECT 1
           FROM horses h
          WHERE h.current_owner_contact_id = p.contact_id AND h.deleted_at IS NULL)) AS is_horse_owner,
        CASE
            WHEN c.preferred_contact = 'email'::text AND (c.hide_community_email OR c.community_email IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'sms'::text AND (c.hide_mobile_text OR c.mobile_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'call'::text AND (c.hide_mobile_call OR c.mobile_call IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'whatsapp'::text AND (c.hide_whatsapp_text OR c.whatsapp_text IS NULL) THEN 'none'::text
            WHEN c.preferred_contact = 'instagram'::text AND c.social_instagram IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'facebook'::text AND c.social_facebook IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'linkedin'::text AND c.social_linkedin IS NULL THEN 'none'::text
            WHEN c.preferred_contact = 'tiktok'::text AND c.social_tiktok IS NULL THEN 'none'::text
            ELSE c.preferred_contact
        END AS preferred_contact
   FROM profiles p
     JOIN members m ON m.user_id = p.user_id AND m.status = 'active'::text
     JOIN contacts c ON c.id = p.contact_id AND c.deleted_at IS NULL
  WHERE NOT p.is_suspended AND p.role IS DISTINCT FROM 'SUPER_ADMIN'::text;
```

reloptions (proves `security_invoker`):
```
{security_invoker=true}
```

Grants (`relacl`) — note neither `anon` nor `authenticated` carries `r`:
```
{postgres=arwdDxtm/postgres,anon=awdDxtm/postgres,authenticated=awdDxtm/postgres,service_role=arwdDxtm/postgres}
```

Privilege matrix (proves no web role can read):
```
     relname      | anon_select | auth_select | svc_select
------------------+-------------+-------------+------------
 member_directory | f           | f           | t
```

Row count read as `postgres` (superuser): **9**

The prose references left behind in `src/` that still describe it as the enforcement point:
```
src/pages/app/MemberProfile.tsx:14:  * DM conversation) and Say hi. Reads the member_directory view (hide/allow prefs
src/pages/app/MemberProfile.tsx:111: hide-from-community is enforced server-side by member_directory. */}
src/lib/community.ts:26: /* SECFIX2 G2: both reads go through the `member_directory_list` definer RPC, not
src/lib/community.ts:27:  * the `member_directory` view. The view was postgres-owned with security_invoker
```

---

## caller_is_document_party wiring into documents_select / my_documents() (policy + function)
- reported by: TASK-A-PARTY-VERIFY-REPORT.md
- reachability: **THE GAP IS CLOSED. This claim is STALE.** As of prod today, `caller_is_document_party` is OR'd into **both** `documents_select` and `my_documents()`. The report described the state before DOCVIS (`62e83de`) landed. Verified directly against `pg_policies` and `pg_get_functiondef` below. Note also that `caller_is_document_party` is very much alive generally — the prosrc scan finds **39** other functions referencing it.
- exists: yes (all three objects present; gap remediated, not removed)
- content:

Full source of `caller_is_document_party`:
```sql
CREATE OR REPLACE FUNCTION public.caller_is_document_party(p_document_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
    WHERE d.id = p_document_id
      AND d.deleted_at IS NULL
      AND dp.contact_id = current_contact_id()
  );
$function$
```
ACL: `{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — PUBLIC EXECUTE, `STABLE`, `SECURITY DEFINER`.

`document_shares_party_read` policy (the usage the report said was correct — still correct):
```
document_shares | document_shares_party_read | SELECT | roles={authenticated}
  USING: (is_admin() OR caller_is_document_party(document_id))
  CHECK: (none)
```

**CURRENT `documents_select` policy — the party arm IS present now:**
```
documents | documents_select | SELECT | roles={authenticated}
  USING: (has_staff_access() OR caller_owns_document(id) OR caller_is_document_party(id) OR ((horse_id IS NOT NULL) AND client_can_read_horse(horse_id)))
  CHECK: (none)
```

For completeness, the other two policies on `documents`:
```
documents | documents_admin_write   | ALL | roles={authenticated}
  USING: is_admin()
  CHECK: is_admin()
documents | documents_org_boundary  | ALL | roles={authenticated}
  USING: (org_id = current_org())
  CHECK: (org_id = current_org())
```

**CURRENT `my_documents()` source — `caller_is_document_party(d.id)` appears in two of the three UNION arms:**
```sql
CREATE OR REPLACE FUNCTION public.my_documents()
 RETURNS TABLE(document_id uuid, template_key text, title text, kind text, signed_at timestamp with time zone, current_status text, superseded boolean, created_at timestamp with time zone, executed_email_sent_at timestamp with time zone, is_contract boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- pending (generated but unsigned)
  SELECT d.id, ct.template_key, ct.title, 'pending'::text,
         NULL::timestamptz, d.current_status, false, d.created_at, NULL::timestamptz,
         EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status <> 'EXECUTED' AND coalesce(d.current_status,'') <> 'void'
  UNION ALL
  -- assigned but not yet generated (a placeholder: there is no document yet, so
  -- it is not a contract)
  SELECT NULL::uuid, crd.template_key, ct.title, 'assigned'::text,
         NULL::timestamptz, 'assigned', false, now(), NULL::timestamptz,
         false
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = current_contact_id()
     AND NOT EXISTS (SELECT 1 FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
                      WHERE d.contact_id = crd.contact_id AND d.deleted_at IS NULL
                        AND ct2.template_key = crd.template_key
                        AND (d.status <> 'EXECUTED' OR (d.status = 'EXECUTED' AND coalesce(d.current_status,'') <> 'superseded')))
  UNION ALL
  -- executed, signing order (newest last → FE may reverse per page convention)
  SELECT d.id, ct.template_key, ct.title, 'executed'::text,
         (SELECT max(s.signed_at) FROM signatures s WHERE s.document_id = d.id AND s.deleted_at IS NULL),
         d.current_status, (d.current_status = 'superseded'), d.created_at, d.executed_email_sent_at,
         EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE (d.contact_id = current_contact_id() OR caller_is_document_party(d.id))
     AND d.deleted_at IS NULL
     AND d.status = 'EXECUTED'
   ORDER BY 4 DESC, 8;
$function$
```

Note the middle arm (`assigned`) is still keyed on `crd.contact_id = current_contact_id()` only — by construction, since a required-document assignment belongs to a contact, not to a document party. That is not the reported gap.

---

## public.void_signatures_on_edit(uuid) (function — GONE from prod)
- reported by: TASK-NOGUARD1-REPORT.md
- reachability: n/a — **the function no longer exists.** `select count(*) from pg_proc … where proname='void_signatures_on_edit'` → **0**. A schema-wide scan (`proname ilike '%void_signature%'`, all schemas) → **0 rows**. `pg_trigger` join on `tgfoid` for this name → **0 rows** (no trigger used it, consistent with the claim). The prosrc scan → **0** other functions reference it. `grep -rn "void_signatures_on_edit" src/ api/` → no output.
- exists: **deleted** — dropped by `supabase/migrations/20260810T0100_noguard2_drop_void_signatures_on_edit.sql:118` (`DROP FUNCTION public.void_signatures_on_edit(uuid);`, no CASCADE).
- content:

**The anon-EXECUTE claim was TRUE when written and is now MOOT — the whole function was removed by NOGUARD2 the same day.** The drop migration recorded the exact ACL it had at the time:
```
--   proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,
--            authenticated=X/postgres,service_role=X/postgres}
--   documents with live signatures : 61
--   live signature rows            : 62
--   documents.signatures_voided_at IS NOT NULL : 0 of 81
```
i.e. PUBLIC + anon + authenticated all held EXECUTE, 61 documents were in range, and **it had never fired once in production**.

Full source as it last existed (recovered from `test/db/fixtures/schema_snapshot.sql:20465–20492`):
```sql
CREATE FUNCTION public.void_signatures_on_edit(p_document_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_roles text[];
BEGIN
  SELECT array_agg(DISTINCT s.party_role) INTO v_roles
    FROM signatures s
   WHERE s.document_id = p_document_id AND s.deleted_at IS NULL;

  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN RETURN; END IF;

  -- Soft-delete: the signature is no longer in force, but the RECORD that it was
  -- given, and when, is evidence and is never destroyed.
  UPDATE signatures SET deleted_at = now()
   WHERE document_id = p_document_id AND deleted_at IS NULL;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END
   WHERE id = p_document_id;
END
$$;
```

Its own COMMENT, which is the record of *why* it was left standing for a week before the drop:
```
COMMENT ON FUNCTION public.void_signatures_on_edit(p_document_id uuid) IS
'RETAINED for the deliberate-removal path only (remove_my_signature soft-deletes
directly). As of 2026-08-03 (deal plan L9) NO edit path calls this: a signed
document is read-only, and a signature comes off only when its signer takes it
off. Do not re-wire this into an edit path.';
```

The drop migration's own reasoning, verbatim:
```
-- WHY IT IS BEING DROPPED RATHER THAN GUARDED. It has no identity check of any
-- kind, and anon, authenticated and PUBLIC all hold EXECUTE.
...
-- Every executed document in the system was in range of one anonymous call, and
-- the function has never once fired in production.
--
-- It also has no caller. Verified four ways: no hit in src/, no hit in api/, no
-- other pg_proc body references it, and pg_depend reports zero non-normal
```
The migration is self-guarding — it re-checks callers and dependencies and `RAISE EXCEPTION`s rather than dropping, then re-proves absence post-drop in the same transaction.

What replaced it (installed by `supabase/migrations/20260803140000_signature_edit_rules.sql`, whose header describes the old behavior):
```
  voids every standing signature (four functions call void_signatures_on_edit
  with no confirmation), and there is no party-initiated way to remove one. So a
  party could lose their signature without ever being asked, and could never
  withdraw it deliberately.

  What this migration installs:
    document_signature_state(doc)  — who has signed, and therefore whether the
                                     document is locked to edits.
    remove_my_signature(doc)       — the signing party withdraws their own
                                     signature, which is what unlocks editing.
    request_permission_to_edit(doc)— asks the signer(s) to remove their signature.
    notify_review_changes(doc)     — tells the party to review, and marks the
                                     point their review starts from.
    document_changes_since_signature(doc) — the diff a reviewer sees.
    Edits BLOCK instead of silently voiding: set_contract_field,
    set_field_structured, set_document_co_buyer, remove_document_co_buyer.
```

---

## apply_field_formats / regroup_contract_subjects / seed_cascade_fields (functions — public.*)
- reported by: TASK-NOGUARD1-REPORT.md
- reachability: The **no-callers** half of the claim is CONFIRMED for all three. `grep -rn` across `src/ api/ test/ scripts/` returns only `test/db/fixtures/schema_snapshot.sql` schema-dump lines (`:1870`, `:14321`, `:16475`) — no call sites. prosrc scan → **0** for each (against the working control of 185/39). `pg_depend` non-internal dependencies → **none**. `pg_trigger` → **no trigger uses any of them**.

  **The "anon-callable" half of the claim is now STALE.** All three have had PUBLIC/anon/authenticated EXECUTE revoked:
  ```
                      fn                       | anon_x | auth_x
  ---------------------------------------------+--------+--------
   apply_field_formats(uuid)                    | f      | f
   regroup_contract_subjects(uuid)              | f      | f
   seed_cascade_fields(uuid)                    | f      | f
  ```
  Each now carries `proacl = {postgres=X/postgres,service_role=X/postgres}`. They are unreachable *and* unprivileged; they can only be invoked by `service_role` or the DB owner.
- exists: yes (all three)
- content:

### 1. `apply_field_formats(uuid)` — VOLATILE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

This is the largest of the three (4,975 chars). It is a **one-shot field-presentation normalizer** for a single document: it repairs mangled labels, derives `format_type` from `input_kind`/`value_type`, applies semantic upgrades by field-key suffix, converts specific fields to party-pickers / button groups / dropdowns / a week-grid, links manage↔cost field pairs, and backfills guidance from a registry.

```sql
CREATE OR REPLACE FUNCTION public.apply_field_formats(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST'],
    ARRAY['TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST'],
    ARRAY['TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST'],
    ARRAY['TXN.EMERGENCY_VET_RESPONSIBILITY','TXN.NON_ROUTINE_VET_COST'],
    ARRAY['TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST']
  ];
  party_fields text[] := ARRAY[
    'TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY',
    'TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST',
    'TXN.MORTALITY_INSURANCE_PARTY','TXN.MAJOR_MEDICAL_INSURANCE_PARTY','TXN.LOSS_OF_USE_INSURANCE_PARTY',
    'TXN.COMPETITION_EXPENSES','TXN.COMPETITION_WINNINGS'
  ];
  button_fields text[] := ARRAY[
    'TXN.PERMITTED_ACTIVITIES','TXN.PROHIBITED_ACTIVITIES','TXN.USE_RESTRICTIONS','TXN.AUTHORIZED_USERS'
  ];
  select_fields text[] := ARRAY[
    'HORSE.SEX','HORSE.COLOR','HORSE.BREED','TXN.LEASE_TERM','TXN.PAYMENT_SCHEDULE'
  ];
  p text[];
  bf text;
  sf text;
BEGIN
  -- correct the mangled labels on this document's fields (idempotent)
  UPDATE contract_fields SET label='Lessons/Day — Advanced'     WHERE document_id=p_document_id AND field_key='TXN.LESSONS_ADVANCED';
  UPDATE contract_fields SET label='Lessons/Day — Beginner'     WHERE document_id=p_document_id AND field_key='TXN.LESSONS_BEGINNER';
  UPDATE contract_fields SET label='Lessons/Day — Intermediate' WHERE document_id=p_document_id AND field_key='TXN.LESSONS_INTERMEDIATE';
  UPDATE contract_fields SET label='Payment Options (one per line: amount — description)' WHERE document_id=p_document_id AND field_key='TXN.PAYMENT_OPTIONS';

  -- base format_type from input_kind/value_type
  UPDATE contract_fields SET format_type = CASE
      WHEN input_kind = 'responsibility' THEN 'party'
      WHEN input_kind = 'contact'        THEN 'person'
      WHEN input_kind IN ('week_grid','select','buttons','currency','date','percent','longtext') THEN input_kind
      ELSE 'text' END
    WHERE document_id = p_document_id AND coalesce(format_type,'') = '';

  -- semantic upgrades so the data is reusable
  UPDATE contract_fields SET format_type='email'       WHERE document_id=p_document_id AND field_key LIKE '%.EMAIL';
  UPDATE contract_fields SET format_type='phone'       WHERE document_id=p_document_id AND (field_key LIKE '%.PHONE' OR field_key LIKE '%\_PHONE');
  UPDATE contract_fields SET format_type='person_name' WHERE document_id=p_document_id AND (field_key LIKE '%.FULL_NAME' OR field_key LIKE '%.PRINTED_NAME' OR field_key LIKE '%.VET_NAME' OR field_key LIKE '%.FARRIER_NAME');
  UPDATE contract_fields SET format_type='address'     WHERE document_id=p_document_id AND (field_key LIKE '%.ADDRESS' OR field_key='HORSE.VET_ADDRESS');
  UPDATE contract_fields SET format_type='currency'    WHERE document_id=p_document_id AND field_key LIKE '%FAIR_MARKET_VALUE';
  UPDATE contract_fields SET format_type='location'    WHERE document_id=p_document_id AND field_key IN ('HORSE.CURRENT_LOCATION','HORSE.HOME_LOCATION');
  UPDATE contract_fields SET format_type='number'      WHERE document_id=p_document_id AND field_key LIKE 'TXN.LESSONS_%' AND field_key <> 'TXN.LESSONS_COST';

  -- standalone responsibility/cost fields → party picker (Lessor/Lessee/Shared %)
  UPDATE contract_fields SET format_type='party', input_kind='responsibility'
   WHERE document_id=p_document_id AND field_key = ANY(party_fields);

  -- multi-select activity/rules fields → buttons with preset options
  FOREACH bf IN ARRAY button_fields LOOP
    UPDATE contract_fields
       SET format_type='buttons', input_kind='buttons', value_type='select',
           options = _lease_button_options(bf)
     WHERE document_id=p_document_id AND field_key=bf;
  END LOOP;

  -- single-choice fields with natural option sets → dropdown (SelectWithOther
  -- gives a free-text escape). Options-first, open text still available.
  FOREACH sf IN ARRAY select_fields LOOP
    UPDATE contract_fields
       SET format_type='select', input_kind='select', value_type='select',
           options = _lease_select_options(sf)
     WHERE document_id=p_document_id AND field_key=sf;
  END LOOP;

  -- Days Used → week-grid day picker
  UPDATE contract_fields SET format_type='week_grid', input_kind='week_grid'
   WHERE document_id=p_document_id AND field_key='TXN.DAYS_USED';

  -- link the manage↔cost pairs
  FOREACH p SLICE 1 IN ARRAY pairs LOOP
    UPDATE contract_fields SET format_type='pair', input_kind='pair', pair_cost_key=p[2]
      WHERE document_id=p_document_id AND field_key=p[1];
    UPDATE contract_fields SET pair_manage_key=p[1]
      WHERE document_id=p_document_id AND field_key=p[2];
  END LOOP;

  -- guidance from the registry where missing
  UPDATE contract_fields cf SET guidance = f.guidance
    FROM contract_formats f
   WHERE cf.document_id=p_document_id AND cf.format_type=f.format_type
     AND coalesce(cf.guidance,'')='' AND coalesce(f.guidance,'')<>'';
END;
$function$
```

### 2. `regroup_contract_subjects(uuid)` — VOLATILE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

A **section re-organizer**: reassigns `contract_fields.section` and `sort_order` so that responsibility/cost fields cluster into human subjects (Boarding, Farrier, Veterinary Care, Supplements & Medications, Exercise & Handling, Training & Lessons, Other Care & Expenses) rather than sitting in template order.

```sql
CREATE OR REPLACE FUNCTION public.regroup_contract_subjects(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- BOARDING subject
  UPDATE contract_fields SET section='Boarding', sort_order=CASE field_key
      WHEN 'TXN.BOARDING_RESPONSIBILITY' THEN 1000 WHEN 'TXN.BOARD_COST' THEN 1001 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN ('TXN.BOARDING_RESPONSIBILITY','TXN.BOARD_COST');

  -- FARRIER subject
  UPDATE contract_fields SET section='Farrier', sort_order=CASE field_key
      WHEN 'TXN.FARRIER_RESPONSIBILITY' THEN 1100 WHEN 'TXN.FARRIER_COST' THEN 1101 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN ('TXN.FARRIER_RESPONSIBILITY','TXN.FARRIER_COST');

  -- VETERINARY subject (routine + emergency + non-routine + auth contact)
  UPDATE contract_fields SET section='Veterinary Care', sort_order=CASE field_key
      WHEN 'TXN.ROUTINE_VET_RESPONSIBILITY' THEN 1200 WHEN 'TXN.ROUTINE_VET_COST' THEN 1201
      WHEN 'TXN.EMERGENCY_VET_RESPONSIBILITY' THEN 1202 WHEN 'TXN.NON_ROUTINE_VET_COST' THEN 1203
      WHEN 'TXN.VET_AUTH_CONTACT' THEN 1204 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.ROUTINE_VET_RESPONSIBILITY','TXN.ROUTINE_VET_COST','TXN.EMERGENCY_VET_RESPONSIBILITY',
       'TXN.NON_ROUTINE_VET_COST','TXN.VET_AUTH_CONTACT');

  -- SUPPLEMENTS subject
  UPDATE contract_fields SET section='Supplements & Medications', sort_order=CASE field_key
      WHEN 'TXN.SUPPLEMENTS' THEN 1300 WHEN 'TXN.SUPPLEMENTS_RESPONSIBILITY' THEN 1301
      WHEN 'TXN.SUPPLEMENTS_COST' THEN 1302 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.SUPPLEMENTS','TXN.SUPPLEMENTS_RESPONSIBILITY','TXN.SUPPLEMENTS_COST');

  -- EXERCISE & HANDLING subject
  UPDATE contract_fields SET section='Exercise & Handling', sort_order=CASE field_key
      WHEN 'TXN.CARE_RESPONSIBILITY' THEN 1400 WHEN 'TXN.EXERCISE_RESPONSIBILITY' THEN 1401
      WHEN 'TXN.CLIPPING_RESPONSIBILITY' THEN 1402 ELSE sort_order END
    WHERE document_id=p_document_id AND field_key IN
      ('TXN.CARE_RESPONSIBILITY','TXN.EXERCISE_RESPONSIBILITY','TXN.CLIPPING_RESPONSIBILITY');

  -- TRAINING & LESSONS: fold their costs into the existing Training & Lessons section
  UPDATE contract_fields SET section='Training & Lessons'
    WHERE document_id=p_document_id AND field_key IN ('TXN.TRAINING_COST','TXN.LESSONS_COST');

  -- OTHER care/expenses → their own subject
  UPDATE contract_fields SET section='Other Care & Expenses'
    WHERE document_id=p_document_id AND field_key IN ('TXN.OTHER_CARE_COST','TXN.OTHER_EXPENSES_COST');
END;
$function$
```

### 3. `seed_cascade_fields(uuid)` — VOLATILE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`, RETURNS integer

A **backfill**: copies any `contract_field_defs` rows for the document's template that are not yet present on the document into `contract_fields`, and returns how many it inserted. Notably it carries the `is_optional` → `included = NOT is_optional` rule (optional fields start un-included).

```sql
CREATE OR REPLACE FUNCTION public.seed_cascade_fields(p_document_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_tmpl text; v_n int := 0;
BEGIN
  SELECT d.org_id, t.template_key INTO v_org, v_tmpl
    FROM documents d JOIN contract_templates t ON t.id = d.template_id
   WHERE d.id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  INSERT INTO contract_fields
    (org_id, document_id, field_key, label, section, owner_role, value, value_type,
     required, sort_order, parent_field_key, input_kind, options, conditional_on, closed,
     guidance, is_optional, included)
  SELECT v_org, p_document_id, cd.field_key, cd.label, cd.section, cd.owner_role, NULL,
         cd.value_type, cd.required, cd.sort_order, cd.parent_field_key, cd.input_kind,
         cd.options, cd.conditional_on, cd.guidance, cd.is_optional,
         NOT cd.is_optional   -- optional fields start un-included
  FROM contract_field_defs cd
  WHERE cd.template_key = v_tmpl
    AND NOT EXISTS (SELECT 1 FROM contract_fields cf
                    WHERE cf.document_id = p_document_id AND cf.field_key = cd.field_key);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$
```

---

## affiliation_reconciliation() / wall_onboarding_invariant_violations() (functions — public.*)
- reported by: TASK-NOGUARD1-REPORT.md
- reachability: The **no-callers** half is CONFIRMED for both. `grep -rn` across `src/ api/ test/ scripts/`: `affiliation_reconciliation` → only `test/db/fixtures/schema_snapshot.sql:1478,1481`; `wall_onboarding_invariant_violations` → **zero hits anywhere in the repo, including the schema snapshot** (it postdates that fixture). prosrc scan → **0** for both. `pg_depend` non-internal → none. `pg_trigger` → none.

  **The "unauthenticated" half of the claim is now STALE.** Both have had PUBLIC/anon/authenticated EXECUTE revoked:
  ```
                      fn                       | anon_x | auth_x
  ---------------------------------------------+--------+--------
   affiliation_reconciliation()                 | f      | f
   wall_onboarding_invariant_violations()       | f      | f
  ```
  `proacl = {postgres=X/postgres,service_role=X/postgres}` on both. Neither is an open roster dump today.
- exists: yes (both)
- content:

### `affiliation_reconciliation()` — STABLE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

Full source:
```sql
CREATE OR REPLACE FUNCTION public.affiliation_reconciliation()
 RETURNS TABLE(contact_id uuid, display_code text, name text, has_account boolean, is_deleted boolean, derived_groups text[], current_groups text[])
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT c.id, c.display_code,
         nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), ''),
         (p.user_id IS NOT NULL),
         (c.deleted_at IS NOT NULL),
         coalesce(derive_affiliations(c.id), ARRAY[]::text[]),
         coalesce((SELECT array_agg(DISTINCT g.group_type ORDER BY g.group_type)
                     FROM groups g WHERE g.contact_id = c.id),
                  ARRAY[]::text[])
    FROM contacts c
    LEFT JOIN profiles p ON p.contact_id = c.id
   WHERE c.deleted_at IS NULL
      OR EXISTS (SELECT 1 FROM groups g WHERE g.contact_id = c.id)
      OR EXISTS (SELECT 1 FROM documents d WHERE d.contact_id = c.id AND d.status = 'EXECUTED' AND d.deleted_at IS NULL)
   ORDER BY nullif(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')), '');
$function$
```

**LIVE OUTPUT (28 rows, run today against prod).** This puts the *derived* affiliation (from `derive_affiliations`, the authoritative deriver) side by side with the *stored* `groups` rows, so any drift is visible in one glance:

```
              contact_id              | display_code |            name            | has_account | is_deleted |      derived_groups       |      current_groups
--------------------------------------+--------------+----------------------------+-------------+------------+---------------------------+---------------------------
 c5319c2a-79e0-48f4-8fcb-5f14fd65c4af | CON-000056   | Anita Tackette             | f           | f          | {}                        | {}
 42f456ad-250f-4feb-b7c6-96d39ccd797d | CON-000101   | Ashlan Hockersmith         | f           | f          | {RIDER}                   | {RIDER}
 b6c984f7-807c-4afe-9f22-4200e323048c | CON-000189   | Audrey Brennan             | f           | f          | {}                        | {}
 7a603cc1-0760-40f3-9e1d-4f8717a37752 | CON-000065   | Audrey Slater              | f           | f          | {RIDER}                   | {RIDER}
 41c5dae9-fc73-4766-9173-6c27347c722c | CON-000130   | Brian Olenik               | f           | f          | {RIDER}                   | {RIDER}
 8795c065-d153-44cc-8a81-758b94d2f5ce | CON-000212   | CACTAI INC.                | t           | f          | {}                        | {}
 d268330c-436a-4f42-bf88-9172d9b4155f | CON-000013   | Charles Zigmund            | f           | t          | {RIDER}                   | {RIDER}
 75475f66-8950-4f13-832c-5471070737f8 | CON-000011   | CJ Z                       | t           | f          | {}                        | {}
 d99f1472-48b4-466e-aaa7-f76396745c17 | CON-000090   | CJ Z                       | t           | f          | {HORSE_OWNER,RIDER}       | {HORSE_OWNER,RIDER}
 862b7936-9148-465c-b0db-b83246e236a0 | CON-000097   | Claire Bourdon             | t           | f          | {}                        | {}
 8c413fd4-e30b-4ceb-96ef-96afca5dccdb | CON-000255   | Claire Bourdon             | t           | f          | {HORSE_OWNER,RIDER}       | {HORSE_OWNER,RIDER}
 07c82329-ec0a-4382-a91c-71cf43577668 | CON-000082   | Elisheva Fiszer            | f           | f          | {RIDER}                   | {RIDER}
 e733b2f0-00b7-4d52-87dd-15e5a26e64af | CON-000219   | Emmy Castro                | f           | f          | {}                        | {}
 352c3898-65d0-4a90-ad59-29107b7e03fe | CON-000060   | French Heritage Equestrian | f           | f          | {}                        | {}
 3c23bb7f-bdce-4943-b40a-85cf41554491 | CON-000131   | Gabriella Olenik           | f           | f          | {}                        | {}
 c5473282-8d20-495a-8ad0-c39ef26e013a | CON-000190   | Hannah Dryden              | f           | f          | {}                        | {}
 5c5bbdb1-5322-4998-924b-81b2d0a5a367 | CON-000254   | Kit Garcin                 | f           | f          | {}                        | {}
 be21609c-ff4c-448a-8346-02b71d40bcc7 | CON-000307   | Kylie Pinion               | f           | f          | {}                        | {}
 a349d66c-1fb1-4107-a87f-364ea663919b | CON-000004   | Madeline Do                | t           | f          | {RIDER}                   | {RIDER}
 9da3f32d-656d-466f-ac30-f95fa12a682f | CON-000214   | Marissa Robertson          | f           | f          | {RIDER}                   | {RIDER}
 bce1bcf7-e0bc-4374-bb13-9f9cef5db204 | CON-000052   | Mary Richardson            | t           | f          | {HORSE_OWNER,RIDER}       | {}
 f4d03b02-641c-4c3b-af85-b2fd2d6b8a30 | CON-000182   | Melanie O’Mea-Smith        | f           | f          | {RIDER}                   | {RIDER}
 ceaadd3c-0f1b-4d59-9819-e3a5b96f8f27 | CON-000191   | Naomi Pouliot              | f           | f          | {}                        | {}
 23dc8f83-a46e-4937-b7c5-78acc052e41b | CON-000102   | Raymond Thicklin           | f           | f          | {RIDER}                   | {RIDER}
 b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6 | CON-000053   | Sarah Morgan               | t           | f          | {GUEST,HORSE_OWNER,RIDER} | {GUEST,HORSE_OWNER,RIDER}
 23cb1681-b260-49cb-bf45-a0141c1a0d32 | CON-000127   | Serena Lee                 | f           | f          | {RIDER}                   | {RIDER}
 a92aace9-705e-484f-a9a9-7167afe76b51 | CON-000280   |                            | t           | f          | {RIDER}                   | {RIDER}
 972d89a6-0b8d-4014-8594-51ccc2508f81 | CON-000278   |                            | t           | f          | {RIDER}                   | {RIDER}
```

Drift summary, same run:
```
 total_rows | drifting
------------+----------
         28 |        1
```

**This function is currently reporting a real, live data-integrity defect.** `Mary Richardson` (CON-000052, `bce1bcf7-e0bc-4374-bb13-9f9cef5db204`, has an account) derives `{HORSE_OWNER,RIDER}` but her stored `groups` rows are `{}` — she has no affiliation recorded at all. Since standing categories drive app nav gating and onboarding-document assignment, an empty `groups` set for a horse-owning rider is a functional gap, not a cosmetic one. Two other things visible in the same output that the owner may want to look at: `Charles Zigmund` (CON-000013) is `is_deleted = t` yet still carries `{RIDER}`; and there are two `CJ Z` and two `Claire Bourdon` contact rows, in each pair one with groups and one without — the contact-sprawl pattern noted elsewhere.

### `wall_onboarding_invariant_violations()` — STABLE, SECURITY DEFINER, `{postgres=X/postgres,service_role=X/postgres}`

Full source:
```sql
CREATE OR REPLACE FUNCTION public.wall_onboarding_invariant_violations()
 RETURNS TABLE(contact_id uuid, person text, wall_gating integer, onboarding_actionable integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT v.id, v.person, v.gating, v.actionable
    FROM (
      SELECT c.id,
             coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                      c.email, c.id::text) AS person,
             (contact_document_wall_state(c.id)->>'gating')::int AS gating,
             (SELECT count(*)::int FROM contact_required_documents crd
               WHERE crd.contact_id = c.id
                 AND NOT contact_document_satisfied(c.id, crd.template_key)) AS actionable
        FROM contacts c
       WHERE c.deleted_at IS NULL) v
   WHERE v.gating > 0 AND v.actionable = 0;
$function$
```

**LIVE OUTPUT (run today against prod):**
```
 contact_id | person | wall_gating | onboarding_actionable
------------+--------+-------------+-----------------------
(0 rows)
```

This is a **zero-is-the-good-answer invariant check**, not a roster dump. It looks for the specific deadlock where a contact is being *blocked* by the document wall (`gating > 0`) while having *nothing they can actually do about it* (`actionable = 0`) — i.e. a user stuck behind a wall with no document to sign. It currently returns clean. Its value is as a canary run after any change to the wall/onboarding logic, not as a report to read routinely.

---

## public.owns_order(uuid) (function — public.owns_order)
- reported by: TASK-TESTDB-REPORT.md
- reachability: VERIFIED orphaned. `select count(*) from pg_class … where relname='orders'` → **0**; a wildcard scan `relname like '%order%'` in `public` → **0 rows**. So the table the function queries does not exist and any call raises. `pg_policies` scan `where qual ilike '%owns_order%' or with_check ilike '%owns_order%'` → **0 rows** — no policy references it. prosrc scan → **0** other functions reference it. `pg_depend` non-internal → none. `grep -rn "owns_order" src/ api/` → **no output**; the only repo hits are in `test/` (`harness.smoke.test.ts:53,55` asserts the function *exists*; `platform_catalog_org_scope.test.ts:122` and `harness.ts:15` are comments). Claim CONFIRMED.
- exists: yes (the function still exists; its table does not)
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.owns_order(p_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND (o.user_id = auth.uid() OR is_admin())
  );
$function$
```

ACL / volatility / security: `STABLE`, `SECURITY DEFINER`,
```
{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
PUBLIC still holds EXECUTE (`anon_x = t`, `auth_x = t`), but the body cannot resolve `orders`, so a call errors rather than leaking. It is a live wrapper around a dropped table.

The one thing that keeps it pinned in place — a test asserts its existence:
```
test/db/harness.smoke.test.ts:53:      `select proname from pg_proc where proname in ('is_admin','owns_order','validate_invitation')`,
test/db/harness.smoke.test.ts:55:    expect(fns.map((f) => f.proname).sort()).toEqual(['is_admin', 'owns_order', 'validate_invitation']);
```

---

## public.reopen_deal(uuid) (function — public.reopen_deal)
- reported by: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- reachability: VERIFIED no UI caller. `grep -rn "reopen_deal" src/ api/ test/ scripts/` → only `test/db/fixtures/schema_snapshot.sql:15142,15145` (schema dump). **No `supabase.rpc('reopen_deal')` anywhere in `src/`.** prosrc scan → **0** other functions reference it. `pg_depend` non-internal → none. Claim CONFIRMED. Note it is *not* unguarded — it requires an authenticated staff caller (see body), even though `anon` holds EXECUTE at the ACL level.
- exists: yes
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.reopen_deal(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to reopen a deal'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status <> 'complete' THEN
    RETURN jsonb_build_object('reopened', false, 'message', 'this deal is not complete');
  END IF;

  UPDATE deals SET status = 'pending', completed_at = NULL WHERE id = p_deal_id;
  UPDATE contracts SET status = 'draft' WHERE id = v_deal.contract_id;

  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value)
  VALUES (auth.uid(), 'UPDATE', 'deals', p_deal_id,
          jsonb_build_object('status', 'complete', 'completed_at', v_deal.completed_at),
          jsonb_build_object('status', 'pending', 'reason', 'reopened_by_staff'));

  -- completion is DERIVED: if every document is still signed, this deal already
  -- satisfies its requirements again and the next execution event will settle
  -- it. Say so, rather than implying it will stay open.
  RETURN jsonb_build_object(
    'reopened', true,
    'still_satisfied', (deal_completion_state(p_deal_id) ->> 'can_complete')::boolean,
    'message', CASE WHEN (deal_completion_state(p_deal_id) ->> 'can_complete')::boolean
      THEN 'Reopened, but every requirement is still met — void or reopen a document to keep this deal open.'
      ELSE 'Reopened.' END);
END;
$function$
```

ACL / volatility / security: `VOLATILE`, `SECURITY DEFINER`,
```
{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
(`anon_x = t`, `auth_x = t` — but the first two lines of the body are `auth.uid() IS NULL` and `has_staff_access()` guards, so it is self-guarding.)

grep result across `src/`:
```
$ grep -rn "reopen_deal" src/ api/
(no output)
```

Worth the owner's eye: this function writes an `audit_logs` row and returns a *nuanced* message — it tells staff that reopening a deal whose documents are all still signed will simply re-settle on the next execution event. That reasoning does not exist anywhere in the Edit routing that replaced it.

---

## public.start_bill_of_sale_standalone(uuid, uuid, uuid) (function — public.start_bill_of_sale_standalone)
- reported by: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- reachability: VERIFIED no UI caller. `grep -rn "start_bill_of_sale_standalone" src/ api/ test/ scripts/` → only `test/db/fixtures/schema_snapshot.sql:18804,18807` (schema dump). No `supabase.rpc(...)` call anywhere in `src/`. prosrc scan → **0** other functions reference it. `pg_depend` non-internal → none. Claim CONFIRMED.
- exists: yes
- content:

Full source:
```sql
CREATE OR REPLACE FUNCTION public.start_bill_of_sale_standalone(p_buyer_contact_id uuid, p_seller_contact_id uuid DEFAULT NULL::uuid, p_horse_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  v_doc      uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a bill of sale'; END IF;
  IF p_buyer_contact_id IS NULL THEN RAISE EXCEPTION 'a buyer contact is required'; END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_buyer_contact_id;

  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, current_contact_id(), jsonb_build_object('deal_side','SALE'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  v_doc := bos_generate_document(
    v_contract, p_buyer_contact_id, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract));

  UPDATE contract_fields SET value = 'NO'
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';

  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract);
END;
$function$
```

ACL / volatility / security: `VOLATILE`, `SECURITY DEFINER`,
```
{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```
(`anon_x = t`, `auth_x = t` — self-guarding via `auth.uid()` + `has_staff_access()`.)

grep result across `src/`:
```
$ grep -rn "start_bill_of_sale_standalone" src/ api/
(no output)
```

### What makes its behavior "distinct" — contrast with the non-standalone path

The sibling is `public.start_bill_of_sale(p_sale_document_id uuid)`. **The two differ in four material ways**, and only the sibling has ever run:

| | `start_bill_of_sale(sale_doc)` | `start_bill_of_sale_standalone(buyer, seller, horse)` |
|---|---|---|
| Input | an existing `HORSE_SALE_V2` document | three raw contact/horse ids — **no prior sale document** |
| Contract | reuses `v_sale.contract_id` | **CREATES a new `contracts` row** (`segment='acquisition'`, `terms->>'deal_side'='SALE'`) and its own `contract_parties` |
| Parties sourced from | `document_parties` of the sale doc | `contract_parties` it just inserted (BUYER order 1, optional SELLER order 2) |
| `TXN.BOS_HAS_SALE_AGREEMENT` | set to **`'YES'`** | set to **`'NO'`** |
| Field prefill / payment status | copies every non-blank shared field from the sale doc, and derives `TXN.BOS_PAYMENT_STATUS` from the sale's `TXN.INSTALLMENTS_ENABLED` (`YES`→`INSTALLMENTS`, `NO`→`PAID_IN_FULL`) | **none of this** — the BOS starts empty and payment status is left unset |

The sibling's signature and the branch that shows the contrast:
```sql
CREATE OR REPLACE FUNCTION public.start_bill_of_sale(p_sale_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
...
  SELECT template_key INTO v_tkey FROM contract_templates WHERE id = v_sale.template_id;
  IF v_tkey <> 'HORSE_SALE_V2' THEN
    RAISE EXCEPTION 'a bill of sale is generated from a HORSE_SALE_V2 document (got %)', v_tkey;
  END IF;
...
  -- prefill every shared field from the sale document's values (parties, horse,
  -- price, co-buyer set) — same field_keys by design; still editable before signing
  UPDATE contract_fields b
     SET value = s.value, updated_at = now()
    FROM contract_fields s
   WHERE b.document_id = v_doc
     AND s.document_id = p_sale_document_id
     AND s.field_key = b.field_key
     AND coalesce(btrim(s.value), '') <> ''
     AND coalesce(btrim(b.value), '') = '';

  UPDATE contract_fields SET value = 'YES'
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';

  -- payment status derives from the sale's installment election (still editable)
  SELECT coalesce(btrim(value), '') INTO v_installments
    FROM contract_fields
   WHERE document_id = p_sale_document_id AND field_key = 'TXN.INSTALLMENTS_ENABLED';
  UPDATE contract_fields
     SET value = CASE v_installments WHEN 'YES' THEN 'INSTALLMENTS'
                                     WHEN 'NO'  THEN 'PAID_IN_FULL'
                                     ELSE '' END
   WHERE document_id = v_doc AND field_key = 'TXN.BOS_PAYMENT_STATUS';
...
$function$
```

In plain terms: the standalone function is the **"cash sale, no written sale agreement"** path — a bill of sale for a horse that changed hands without a `HORSE_SALE_V2` contract behind it. That is a real business shape (it is the reason `TXN.BOS_HAS_SALE_AGREEMENT` exists as a field at all), and it currently has no way to be reached from the UI.

---

## document_deliveries party-read policy arm (policy — public.document_deliveries / document_deliveries_select)
- reported by: TASK-PARTYRLS-REPORT.md
- reachability: The claim is CONFIRMED with one correction. `listDeliveries` exists and is the only client function reading `document_deliveries` — but **it is at `src/lib/api.ts:1316`, not `:1132`** (the report's line number is stale; the file has grown). Its sole caller chain is staff-facing: `DeliveryPanel` → `DocumentViewerPage` under `/app/ops/`, so no party-facing surface exercises the `recipient_contact_id = current_contact_id()` arm. `grep -rn "listDeliveries" src/ api/` returns exactly three hits, all in that chain.
- exists: yes
- content:

Full `document_deliveries_select` policy, all arms:
```
document_deliveries | document_deliveries_select | SELECT | roles={authenticated}
  USING: (is_admin() OR ((deleted_at IS NULL) AND (caller_owns_document(document_id) OR (recipient_contact_id = current_contact_id()))))
  CHECK: (none)
```
Three arms: `is_admin()`; owner-of-document; and the party arm `recipient_contact_id = current_contact_id()`. The third is the one never exercised from the UI.

The companion write policy:
```
document_deliveries | document_deliveries_admin_write | ALL | roles={authenticated}
  USING: is_admin()
  CHECK: is_admin()
```

`listDeliveries`, verbatim from `src/lib/api.ts:1316`:
```ts
// ─── Deliveries ───────────────────────────────────────────────────────────

export async function listDeliveries(documentId: string): Promise<DocumentDelivery[]> {
  const { data, error } = await supabase
    .from('document_deliveries')
    .select('*')
    .eq('document_id', documentId)
    .is('deleted_at', null)
    .order('delivered_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentDelivery[];
}

export async function recordDelivery(input: DeliveryInput): Promise<DocumentDelivery> {
  const { data, error } = await supabase
    .from('document_deliveries')
    .insert({
      document_id: input.document_id,
      recipient_contact_id: input.recipient_contact_id,
      channel: input.channel ?? 'PORTAL',
      copy_url: input.copy_url ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as DocumentDelivery;
}
```

Who calls it:
```
$ grep -rn "listDeliveries" src/ api/
src/components/ops/documents/DeliveryPanel.tsx:3:import { listDeliveries, recordDelivery } from '../../../lib/api';
src/components/ops/documents/DeliveryPanel.tsx:19: * delivery log lists prior sends (newest first) from `listDeliveries`.
src/components/ops/documents/DeliveryPanel.tsx:78:    return listDeliveries(documentId)
src/lib/api.ts:1316:export async function listDeliveries(documentId: string): Promise<DocumentDelivery[]> {
```
and who mounts `DeliveryPanel`:
```
src/pages/app/ops/DocumentViewerPage.tsx:10:import { DeliveryPanel } from '../../../components/ops/documents/DeliveryPanel';
src/pages/app/ops/DocumentViewerPage.tsx:245:          <DeliveryPanel
```
Both live under `ops/` — staff only. Confirms no party-facing caller.

**What the stamp trail would show.** Current row count: **49**.

Columns:
```
id, document_id, recipient_contact_id, channel, copy_url, delivered_at, created_at, deleted_at, deleted_by, is_mirror
```

Two most recent rows in full:
```
                  id                  |             document_id              |         recipient_contact_id         | channel |                        copy_url                        |         delivered_at          |          created_at           | deleted_at | deleted_by | is_mirror
--------------------------------------+--------------------------------------+--------------------------------------+---------+--------------------------------------------------------+-------------------------------+-------------------------------+------------+------------+-----------
 e32f1a1f-6741-4d58-9fbf-4ec1f889984b | 31b10f9f-891a-469a-8867-8fb29bee4108 |                                      | EMAIL   | /portal/documents/31b10f9f-891a-469a-8867-8fb29bee4108 | 2026-08-10 16:43:30.310838+00 | 2026-08-10 16:43:30.310838+00 |            |            | t
 3cb7a775-928a-4e7f-9bc0-a9fabf8d2ebf | 31b10f9f-891a-469a-8867-8fb29bee4108 | 8c413fd4-e30b-4ceb-96ef-96afca5dccdb | EMAIL   | /portal/documents/31b10f9f-891a-469a-8867-8fb29bee4108 | 2026-08-10 16:43:28.62767+00  | 2026-08-10 16:43:28.62767+00  |            |            | f
```

Two notes the owner should see. First, there are already **49 real delivery stamps** sitting in prod — this is populated history, not an empty table waiting on a feature. Second, the pair above shows the mirror mechanism: one row for the actual recipient (`8c413fd4…` = Claire Bourdon, CON-000255) and a second `is_mirror = t` row with a **NULL `recipient_contact_id`** for the shared admin@/hello@ inbox copy. Because the party arm keys on `recipient_contact_id = current_contact_id()`, mirror rows match no party — which is correct, but means a party-facing stamp trail would show only their own row, not the mirror.

---

## file_links.subject_type CHECK values `purchase` and `booking` (constraint — public.file_links)
- reported by: TASK-UPLOADS-REPORT.md
- reachability: The claim is CONFIRMED and then some — **no `subject_type` value at all is written by application code.** `grep -rn "file_links" src/ api/` finds exactly one data access, a SELECT at `src/lib/files.ts:220`. There is **no INSERT into `file_links` anywhere in `src/` or `api/`** (`grep -rnE "(linkFile|subject_type)\s*[:(].*(purchase|booking)"` → no output; no `linkFile` symbol exists). The two values are unreachable because the whole write path is unbuilt.

  **One correction to the claim's "no consuming surface" wording:** `purchase` and `booking` *are* present in the TypeScript surface — both in the `FileSubjectType` union and in the display-label map — so they are typed and labelled, just never produced. Detail below.
- exists: yes
- content:

Full CHECK constraint (`pg_get_constraintdef`):
```sql
CHECK ((subject_type = ANY (ARRAY[
  'contact'::text, 'account'::text, 'deal'::text, 'contract'::text, 'document'::text,
  'horse'::text, 'stable'::text, 'lesson'::text, 'offering'::text, 'purchase'::text,
  'booking'::text, 'lead'::text, 'directory_listing'::text, 'org'::text])))
```

All constraints on the table:
```
file_links_created_by_user_id_fkey  | FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id)
file_links_file_id_fkey             | FOREIGN KEY (file_id) REFERENCES files(id)
file_links_org_id_fkey              | FOREIGN KEY (org_id) REFERENCES organizations(id)
file_links_pkey                     | PRIMARY KEY (id)
file_links_subject_type_check       | CHECK (subject_type = ANY (ARRAY['contact','account','deal','contract','document','horse','stable','lesson','offering','purchase','booking','lead','directory_listing','org']))
```

Full table definition:
```
id                 uuid                     NOT NULL  default=gen_random_uuid()
org_id             uuid                     NOT NULL  default=current_org()
file_id            uuid                     NOT NULL  default=-
subject_type       text                     NOT NULL  default=-
subject_id         uuid                     NOT NULL  default=-
created_by_user_id uuid                     NULL      default=auth.uid()
created_at         timestamp with time zone NOT NULL  default=now()
deleted_at         timestamp with time zone NULL      default=-
```

Current row counts grouped by `subject_type`:
```
 coalesce | count
----------+-------
(0 rows)
```
```
 total_file_links
------------------
                0
```
```
 total_files
-------------
           0
```

**The table is entirely empty, and so is `files`.** Not just `purchase`/`booking` — no subject type has ever been written, because the UPLOADS spine shipped its schema and read path but no write path reached production use.

The grep proving no writer:
```
$ grep -rn "linkFile\|file_links" src/ api/
src/lib/files.ts:20: * SURFACING IS A REFERENCE, NEVER A COPY. One `files` row; `file_links` rows put
src/lib/files.ts:217: *  `file_links_owner_read`, which resolves to "links to files I can see." */
src/lib/files.ts:220:    .from('file_links')

$ grep -rnE "(linkFile|subject_type)\s*[:(].*(purchase|booking)" src/ api/
(no output)
```
The single access, a read:
```ts
    .select('id, file_id, subject_type, subject_id, created_at, deleted_at')
```

Where `purchase` and `booking` DO appear on the TS side — `src/lib/files.ts:44–50`:
```ts
/** The surfaces a file can be shown on. Mirrors the `file_links.subject_type`
 *  CHECK — adding a surface is one line there and one here. */
export type FileSubjectType =
  | 'contact' | 'account' | 'deal' | 'contract' | 'document'
  | 'horse' | 'stable' | 'lesson' | 'offering' | 'purchase'
  | 'booking' | 'lead' | 'directory_listing' | 'org';
```
and `src/components/app/FilesContent.tsx:31–37`, which already has human labels ready for them:
```ts
const SUBJECT_LABEL: Record<string, string> = {
  contact: 'a contact record', account: 'an account', deal: 'a deal',
  contract: 'a contract', document: 'a document', horse: 'a horse record',
  stable: 'a stable page', lesson: 'a lesson', offering: 'a service',
  purchase: 'an order', booking: 'a booking', lead: 'a lead',
  directory_listing: 'a directory listing', org: 'the company',
};
```
So `purchase` renders as "an order" and `booking` as "a booking" the moment anything writes such a row. The DB CHECK, the TS union, and the display labels are all in agreement and all complete; only the producer is missing.

---

# Part 3 — Routes and pages


Read-only pass. Nothing changed. Nothing recommended for deletion.

**Three of the ten claims are STALE.** Read blocks 4, 5 and 8 first — a Review nav section
(added 2026-08-12) and a module-enable migration (also 2026-08-12) turned several
"unreachable" surfaces back on after the reports were written. Details in each block.

---

## ContactsPage / route /app/ops/contacts (src/pages/app/ops/ContactsPage.tsx)
- reported by: TASK-DOCCOLS-REPORT.md, TASK-ROSTER-REPORT.md, TASK-PAGEFRAME-REPORT.md
- reachability: **PARTIALLY STALE.** The retirement is intact, but the page is no longer
  unviewable.
  - The flag — `src/pages/app/ops/ContactsPage.tsx:563`: `export const CONTACTS_PAGE_RETIRED = true;`
  - The redirect — `src/App.tsx:297-299`. **Report is stale on the target**: it now redirects
    to `/app/records/clients`, not `/app/admin` (repointed by TASK-RECORDS to avoid a double hop).
  - The nav item is GONE, not gated. `grep -n "ops/contacts" src/components/app/AppLayout.tsx`
    finds only the removal comment at `AppLayout.tsx:539-551` — there is no `ContactsPage` NavItem
    left in `ACCOUNTS_GROUP` (`AppLayout.tsx:537-569`); the whole group is now one row,
    `AppLayout.tsx:568`: `{ to: '/app/records', label: 'Records', icon: BookOpen },`
  - **BUT it IS reachable today for admins.** `src/App.tsx:366` mounts the unmodified component at
    `/app/ops/review/contacts`, and `src/lib/reviewSection.ts:356-361` turns every review entry into
    a real admin-only nav row. So the owner can already click to it under **Review → "People B ·
    retired directory"**.
- exists: yes (593 lines; `ContactsPage()` at :586, default export at :593)
- content:

The flag and its siblings — note that four sibling pages off the SAME component are LIVE
(`src/pages/app/ops/ContactsPage.tsx:556-593`):
```tsx
/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33).
 *  Owner ruling 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD): the
 *  Clients page (/app/admin) won — it now shows every contact, so this page's
 *  population moved there. While true: the /app/ops/contacts route redirects
 *  to /app/admin and the nav item is hidden. DirectoryPage and LeadsPage below
 *  are NOT retired. */
export const CONTACTS_PAGE_RETIRED = true;

export function DirectoryPage()  { return <ContactDirectory mode="directory" />; }
export function VendorsPage()    { return <ContactDirectory mode="vendors" />; }
export function PartnersPage()   { return <ContactDirectory mode="partners" />; }
export function AllRecordsPage() { return <ContactDirectory mode="all" />; }
/** The people we serve: clients, members, horse owners, counterparties.
 *  Retired — see CONTACTS_PAGE_RETIRED. */
export function ContactsPage()   { return <ContactDirectory mode="contacts" />; }
export function LeadsPage()      { return <ContactDirectory mode="leads" />; }
export default ContactsPage;
```

The route (`src/App.tsx:291-299`):
```tsx
{/* RETIRED 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD):
    the Clients page won and now shows every contact. Route
    redirects rather than 404s so old links land on the winning
    page; flip the boolean to restore. Target repointed 2026-08-12
    (TASK-RECORDS) to the Clients tab directly — /app/admin itself
    now just redirects here too, so this avoids a double hop. */}
<Route path="ops/contacts" element={CONTACTS_PAGE_RETIRED
  ? <Navigate to="/app/records/clients" replace />
  : <ProtectedRoute requireStaff><ContactsPage /></ProtectedRoute>} />
```

**What the retired page showed that the live Clients page may not.** The page's own copy
(`ContactsPage.tsx:64-68`) and its exclusive filter row (`:82-86`, `:234`):
```tsx
contacts: {
  title: 'Contacts',
  blurb: 'The people we serve — clients, members, horse owners and counterparties who are not part of the company.',
  newLabel: 'contact',
},

type Designation = 'Client' | 'Team' | 'Counterparty' | 'Horse owner' | 'Lessee' | 'Lead';
const BUSINESS_FILTERS = ['All', 'Counterparties', 'Horse owners', 'Lessees'];
const FILTER_MAP: Record<string, Designation | null> = {
  All: null, Counterparties: 'Counterparty', 'Horse owners': 'Horse owner', Lessees: 'Lessee',
};
// ...
const filters = mode === 'contacts' ? BUSINESS_FILTERS : [];   // ← line 234
```
`filters` is EMPTY for every other mode. **The Counterparties / Horse owners / Lessees filter
buttons exist only on this retired page.** The designation chips themselves are derived, never
assigned (`:92-102`):
```tsx
function designations(r: DirectoryContact): Designation[] {
  const d: Designation[] = [];
  if (r.linked_role && r.linked_role !== 'USER') d.push('Team');
  if (r.is_client || r.linked_role === 'USER') d.push('Client');
  const outside = (r.party_roles ?? []).filter((x) => !NON_PARTY_ROLES.includes(x));
  if (outside.length > 0 && !d.includes('Client')) d.push('Counterparty');
  if (r.horses_owned > 0) d.push('Horse owner');
  if (r.horses_leased > 0) d.push('Lessee');
  if (d.length === 0) d.push('Lead');
  return d;
}
```

The rendered page (`ContactsPage.tsx:319-400`) — card grid, filters, search, sort:
```tsx
{/* filter — buttons on desktop, dropdown on mobile; sort row below */}
<div className="hidden sm:flex flex-wrap gap-1.5 mb-2">
  {filters.map((f) => (
    <button key={f} type="button" onClick={() => setFilter(f)} className={...}>
      {f}{counts.get(f) ? ` (${counts.get(f)})` : ''}
    </button>
  ))}
</div>
{filters.length > 0 && (
  <select className="form-input sm:hidden mb-2" value={filter} aria-label="Filter" ...>
    {filters.map((f) => <option key={f} value={f}>{f}{counts.get(f) ? ` (${counts.get(f)})` : ''}</option>)}
  </select>
)}
<div className="flex flex-wrap items-center gap-2 mb-5">
  <input type="search" className="form-input flex-1 min-w-[200px]"
    placeholder="Search name, email, phone, tag…"
    value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search contacts" />
  <div className="flex gap-1.5">
    {([['name', 'A–Z'], ['newest', 'Newest']] as [SortKey, string][]).map(([k, label]) => (
      <button key={k} type="button" onClick={() => setSortKey(k)} className={...}>{label}</button>
    ))}
  </div>
</div>

{error && <p role="alert" className="form-error mb-4">{error}</p>}
{rows === null && !error && <p className="text-sm text-muted">Loading directory…</p>}

{/* directory cards — same shape as the community's members directory */}
<div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
  {visible.map((r) => (
    <button key={r.id} type="button" onClick={() => setOpen(r)}
      className="bg-white border border-green-800/10 rounded-xl p-4 text-left hover:border-green-800/30 focus-ring">
      <div className="flex items-center gap-3 mb-2.5">
        <span className="w-11 h-11 rounded-full bg-green-100 text-green-800 grid place-items-center text-base font-serif font-semibold shrink-0">
          {initials(r)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-900 truncate">{contactName(r) || r.email || '—'}</p>
          <p className="text-[11px] text-muted truncate">{r.email ?? r.phone ?? 'no contact info'}</p>
        </div>
        {mode === 'all' && r.contact_type && (
          <span className="...">{CONTACT_TYPE_LABEL[r.contact_type]}</span>
        )}
      </div>
      <Chips r={r} />
      {depthLine(r) && <p className="text-[11px] text-muted mt-2">{depthLine(r)}</p>}
    </button>
  ))}
</div>
{rows !== null && visible.length === 0 && (
  <p className="text-sm text-muted py-8 text-center">No contacts match.</p>
)}

{dossier && <ContactDossierModal contactId={dossier} onClose={() => setDossier(null)} ... />}
```

Every user-visible string on the retired page: `Contacts` · `The people we serve — clients,
members, horse owners and counterparties who are not part of the company.` · `All` ·
`Counterparties` · `Horse owners` · `Lessees` · `Search name, email, phone, tag…` · `A–Z` ·
`Newest` · `Loading directory…` · `No contacts match.` · `no contact info` · `Unnamed` · `View` ·
chips `Client` / `Team` / `Counterparty` / `Horse owner` / `Lessee` / `Lead`.

---

## The org company contact has no reachable record page (contacts row "French Heritage Equestrian")
- reported by: TASK-DOCCOLS-REPORT.md
- reachability: VERIFIED, and the claim is correct but **incomplete** — there are TWO
  independent reasons, one in the UI and one in the RPC, and either alone would be enough.
- exists: yes — one row, live, not soft-deleted.
- content:

The actual row (`psql … select … from contacts where is_company is true;` — exactly one row):
```
-[ RECORD 1 ]+-------------------------------------
id           | 352c3898-65d0-4a90-ad59-29107b7e03fe
first_name   | French Heritage Equestrian
last_name    |
is_company   | t
contact_type | TEAM
email        | hello@fhequestrian.com
phone        | (858) 439-3614
org_id       | e656f20b-ef43-4725-9029-19e7f0190d9c
deleted_at   |
created_at   | 2026-07-13 04:52:18.83059+00
```
(Note: `contacts` has no `company_name` column — the org's name lives in `first_name`.)

**Reason 1 — the UI never emits a link for it.** `src/components/ops/documents/DocumentQueueTable.tsx:77-94`.
The decision is on `party.isCompany`, which is `contacts.is_company` — NOT on `contact_type`:
```tsx
function PartyCell({ party }: { party: PartyDisplay | null }) {
  if (!party) return null;
  return (
    <span className="block">
      <span className="block text-[10px] uppercase tracking-wide text-green-800/55">{party.label}</span>
      {party.isCompany ? (
        <span className="font-medium text-green-900">{party.name}</span>
      ) : (
        <Link
          to={`/app/admin?open=${party.contactId}`}
          className="link-underline font-medium text-green-900"
        >
          {party.name}
        </Link>
      )}
    </span>
  );
}
```
The contract is stated at `src/lib/ops/partyDisplay.ts:79-82`:
```ts
  /** The org itself acting as a party (`contacts.is_company`) — render as the
   *  company, not a person: no dossier link exists for it. */
  isCompany: boolean;
```

**Reason 2 — even if it linked, the destination could not find it.** `admin_client_accounts()`
arm 3 is the only arm a bare contact can enter, and it filters on `contact_type`
(`prosrc`, arm 3):
```sql
    -- arm 3 (NEW): bare contacts — no clients row, no USER login. These were in
    -- neither arm before. LEAD / TEAM / DIRECTORY types live on their own pages.
    SELECT 'contact', NULL, c.id, NULL,
           c.first_name, c.last_name, NULL, c.email, ...
    FROM contacts c
    ...
    WHERE c.org_id = current_org() AND c.deleted_at IS NULL AND is_admin()
      AND (c.contact_type = 'CONTACT' OR c.contact_type IS NULL)
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.role = 'USER')
```
The row's `contact_type` is `TEAM`, so `(c.contact_type = 'CONTACT' OR c.contact_type IS NULL)`
is false and the row is excluded. Arms 1 and 2 need a `profiles` row / `clients` row
respectively, neither of which the org has. So `/app/admin?open=352c3898-…` would resolve to
nothing even if `PartyCell` did emit it.

---

## Contract-invite redemption landing page (/activate?token=…&kind=contract → src/pages/Register.tsx)
- reported by: TASK-A-PARTY-VERIFY-2-REPORT.md
- reachability: N/A — this is a public, deliberately-reachable page. The claim under test is
  "unwired", not "unreachable".
- exists: yes
- **VERDICT: the report's claim is NOT SUPPORTED by static + DB evidence. Every link in the
  chain exists and resolves.** I could not reproduce a break without a live browser. What I
  found, end to end:

**1. The URL actually sent.** `api/contract-invite.ts:113-116` — the only place a contract
invite link is built:
```ts
    const token = (inv as { token: string }).token;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const link = `${origin}/activate?token=${token}&kind=contract`;
```
It is issued by the RPC just above (`api/contract-invite.ts:101-103`):
```ts
    const { data: inv, error: invErr } = await db.rpc('invite_contract_counterparty', {
      p_document_id: documentId, p_contact_id: party.contact_id, p_email: email,
    });
```
and injected into the `CONTRACT_INVITE` email template as `'MSG.LINK': link`
(`api/contract-invite.ts:133`).

**2. The route.** `src/App.tsx:150`:
```tsx
<Route path="/activate" element={<ActivateShell><Register /></ActivateShell>} />
```
(with `src/App.tsx:185` redirecting the legacy `/register` here, query preserved).

**3. The landing component** is `/Users/cactai/Downloads/claude-code-repo/wt-flagharvest/src/pages/Register.tsx`
(343 lines). It branches on the `kind` param at line 26 and has a contract-specific redemption
path (`Register.tsx:22-42`):
```tsx
  const token = params.get('token') || '';
  // Contract-counterparty invites (Update A, spec G): redemption links the party
  // contact instead of granting community membership, and lands on the contract.
  const isContractInvite = params.get('kind') === 'contract';

  /** Redeem per invite kind; returns the post-redemption destination. */
  async function redeemByKind(): Promise<string> {
    if (isContractInvite) {
      const documentId = await redeemContractInvitation(token);
      return `/app/contracts/${documentId}`;
    }
    await redeemInvitation(token);
    try {
      const state = await myOnboardingState();
      if (state?.needed) return '/app/onboarding';
    } catch { /* fall through to the dashboard */ }
    return '/app';
  }
```
Already-signed-in short-circuit (`Register.tsx:104-116`):
```tsx
        // Already signed in as the invited person (e.g. registered earlier but
        // membership was never granted)? Redeem straight into the app.
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData.session?.user?.email?.toLowerCase();
        if (sessionEmail && sessionEmail === inv.email.trim().toLowerCase()) {
          try {
            const dest = await redeemByKind();
            navigate(dest, { replace: true });
            return;
          } catch { /* fall through to the normal form */ }
        }
```
Already-signed-party rescue when the token is dead (`Register.tsx:83-96`):
```tsx
          // SENDGUARD §1: validate_invitation only recognises a LIVE token, so a
          // contract party who already signed and clicks an older link lands on
          // "this link isn't valid" — a dead end for someone whose signature is
          // already on file. redeem_contract_invitation now routes an
          // already-signed party to their document; give it the chance to.
          if (isContractInvite) {
            try {
              const documentId = await redeemContractInvitation(token);
              if (!active) return;
              navigate(`/app/contracts/${documentId}`, { replace: true });
              return;
            } catch { /* not signed, or not signed in — the invalid screen is right */ }
          }
```
The Google round-trip is handled too (`src/pages/RegisterComplete.tsx:82-87`):
```tsx
        if (stash.kind === 'contract') {
          // contract-counterparty invite: link the party contact, no membership,
          // and land ON the contract (Update A, spec G)
          const documentId = await redeemContractInvitation(stash.token);
          dest = `/app/contracts/${documentId}`;
        }
```

**4. Every visible string on the landing page.**

The invalid-token screen (`Register.tsx:201-263`):
```tsx
  <p className="eyebrow mb-3">Invitation</p>
  <h1 className="heading-section text-green-800 mb-4">This link isn't valid anymore</h1>
  {notice ? (
    <p className="body-text mb-3">
      Your current invitation went to <span className="font-medium text-green-800">{notice.masked_email}</span>{' '}
      on {…date…}. Look for the most recent email from us and use the link in that one.
    </p>
    // + button "Send it to me again" / "Sending…" / after: "Sent. It's on its way to that
    //   same address — give it a minute, and check your spam folder if it doesn't appear."
  ) : (
    <p className="body-text mb-8">
      {isContractInvite
        ? "This invitation may have expired or been replaced by a newer one. If you've already signed this document, sign in and we'll take you straight to it."
        : "This invitation may have expired or been replaced by a newer one — check your inbox for the most recent email. If you've already created your account, just sign in."}
    </p>
  )}
  <Link to="/login" state={isContractInvite ? { from: `/activate?token=${token}&kind=contract` } : undefined}
        className="btn-primary">Sign In <ArrowRight size={16} /></Link>
  <Link to="/contact" className="btn-outline-gold">Ask for a fresh invite</Link>
```

The normal (valid-token) screen (`Register.tsx:266-300`):
```tsx
  <p className="eyebrow mb-3">Welcome</p>
  <h1 className="heading-section text-green-800">Sign in to activate your account</h1>
  <p className="body-text text-sm mt-2">
    for <span className="font-medium text-green-800">{invitation?.email}</span>
  </p>

  {showGoogle && showPassword && authMethod === 'both' && (
    <p className="body-text text-xs text-muted text-center mb-4">
      If <span className="font-medium">{invitation?.email}</span> is a Google
      Workspace address, use “Continue with Google.” Otherwise, set a password below.
    </p>
  )}

  {showGoogle && (
    <button type="button" onClick={continueWithGoogle} className="btn-outline-gold w-full justify-center">
      Continue with Google
    </button>
    // divider: "or set a password"
  )}
```

**5. Destination route exists.** `src/App.tsx:266`:
```tsx
<Route path="contracts/:id" element={<ContractPage />} />
```

**6. DB side, prod, all present:**
```
psql -tAc "select proname from pg_proc where proname in
  ('validate_invitation','redeem_contract_invitation','invite_contract_counterparty');"
invite_contract_counterparty
redeem_contract_invitation
validate_invitation
```
And CJ's contract invitation is in `invitations` and was **redeemed**:
```
 ac6ffe4c-a234-475b-89c4-76f46d61aa02 | cjzigs@icloud.com | redeemed | CONTRACT | 2026-08-23 02:22:49 | 2026-08-09 02:22:49
 9b77775f-5e1e-41f8-8c74-f87f156579f3 | cjzigs@icloud.com | sent     | CONTRACT | 2026-08-19 09:35:27 | 2026-08-05 09:35:27
 ec81851e-e252-43b6-97fc-8732f8af2bbb | cjzigs+averify2@icloud.com | sent | CONTRACT | 2026-08-19 09:35:27 | 2026-08-05 09:35:27
 99bddcf5-1bad-464f-8022-feba33a9afd6 | hello@fhequestrian.com | sent | CONTRACT | 2026-08-23 02:22:49 | 2026-08-09 02:22:49
```

**What is and isn't wired — plainly:**
- WIRED: URL construction, email template injection, the `/activate` route, token validation,
  contract-vs-community branching, Google and password account creation, `redeem_contract_invitation`,
  the already-signed-in short-circuit, the already-signed dead-link rescue, and the final hop to
  `/app/contracts/:id` (a real route to a real `ContractPage`).
- ONE THING WORTH THE OWNER'S EYE, and it is a wording issue, not a wiring one: the valid-token
  screen's headline is **"Sign in to activate your account"** with a **"Welcome"** eyebrow. A
  contract counterparty who already has an account and is signed in never sees it (the
  short-circuit at :104 fires first) — but one who is signed out, or signed in under a *different*
  address than the invite, falls through to that account-creation screen with no
  contract-specific copy at all. `isContractInvite` is used for the *invalid* screen's copy
  (:243) but not for the valid screen's copy. That is the closest thing I found to "unwired".
- **UNRESOLVED**: whether CJ actually saw a broken page. Nothing in the code or the DB explains a
  failure, and the invitation row shows `redeemed`. Confirming or refuting the owner's report
  needs a live browser session, which I could not run.

---

## /app/ops — OpsHome, OpsDashboard, InstructorHome
- reported by: TASK-ADMINSWEEP-PHASE1.md, TASK-DASHLEADS-REPORT.md
- reachability: **STALE — these are NO LONGER DARK.** ADMINSWEEP Phase 1's grep result was true
  when written. Since then TASK-REVIEWNAV added an admin-only Review nav section that links to
  all three.
  - `src/lib/reviewSection.ts:126-136` puts both surfaces in the Review group;
    `src/lib/reviewSection.ts:356-361` turns every such entry into a live nav row:
    ```ts
    export const REVIEW_NAV_ITEMS: { to: string; label: string; icon: typeof FlaskConical; adminOnly: true }[] = [
      { to: '/app/ops/review', label: 'How to use Review', icon: FlaskConical, adminOnly: true },
      ...REVIEW_GROUPS.flatMap((g) => g.entries
        .filter((e) => e.navRow !== false)
        .map((e) => ({ to: e.to, label: e.label, icon: FlaskConical, adminOnly: true as const }))),
    ];
    ```
  - `src/components/app/AppLayout.tsx:696-704` renders that group; `AppLayout.tsx:659-662` is the
    only filter, and it passes for an admin:
    ```tsx
    const visible = (items: NavItem[]) => items.filter(
      (i) => (!i.module || hasModule(i.module))
          && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
    );
    ```
  - So today an admin sees nav rows **"Staff home B · OpsDashboard"** (`/app/ops`) and
    **"Staff home C · Instructor preview"** (`/app/ops/preview/instructor-home`).
  - InstructorHome remains unreachable *as a role*: no production `profiles.role` is non-admin
    staff, so `OpsHome` never picks it in real life. The preview route is the only way it renders.
  - `grep -rn "'/app/ops'" src/` returns only the two `reviewSection.ts` entries and the two
    doc-comments — still no `<Navigate>` or `navigate()` to it.
- exists: yes — `src/pages/app/OpsHome.tsx` (14 lines), `src/pages/app/ops/OpsDashboard.tsx`
  (275 lines), `src/pages/app/InstructorHome.tsx` (187 lines),
  `src/pages/app/ops/InstructorHomePreview.tsx` (66 lines)
- content:

**Routes** (`src/App.tsx:279` and `:280-286`):
```tsx
<Route path="ops" element={<ProtectedRoute requireStaff><OpsHome /></ProtectedRoute>} />
{/* ADMINSWEEP Phase 2 — InstructorHome renders only for non-admin
    staff, and no such account exists in production, so the owner
    could not look at it before ruling on it. This mounts the real
    component behind a preview banner. NOT a second landing page:
    no nav entry, nothing links here, reached by URL only. See
    ops/InstructorHomePreview.tsx for why it is not a role fake. */}
<Route path="ops/preview/instructor-home" element={<ProtectedRoute requireStaff><InstructorHomePreview /></ProtectedRoute>} />
```
(The comment "no nav entry, nothing links here" is now out of date — see reachability above.)

**The switch** (`src/pages/app/OpsHome.tsx`, whole file):
```tsx
import { useAuth } from '../../contexts/AuthContext';
import OpsDashboard from './ops/OpsDashboard';
import InstructorHome from './InstructorHome';

/**
 * OPS HOME — role-adaptive management landing at /app/ops.
 *  - Admins (isAdmin) get the full tenant OpsDashboard (KPIs + module launcher).
 *  - Trainers (isStaff && !isAdmin) get the servicing-scoped InstructorHome.
 * Both are operators; this only chooses the appropriate home surface.
 */
export default function OpsHome() {
  const { isAdmin } = useAuth();
  return isAdmin ? <OpsDashboard /> : <InstructorHome />;
}
```

### SURFACE A — OpsDashboard (what an admin sees at /app/ops)

The module launcher catalog (`OpsDashboard.tsx:106-120`):
```tsx
// mod.brokerage has no hub page, so the registry yields no entry for it and its
// tile renders as the non-navigating "Enabled" status tile (dead links are
// forbidden). That is the same behaviour as the hand-written map this replaced.

/** The module launcher catalog: key + label. Every tile is entitlement-gated;
 *  navigation comes solely from MODULE_HUB_ROUTES. */
const MODULE_TILES: { moduleKey: string; label: string }[] = [
  { moduleKey: 'mod.brokerage', label: 'Brokerage' },
  { moduleKey: 'mod.lessons', label: 'Lessons' },
  { moduleKey: 'mod.boarding', label: 'Boarding' },
  { moduleKey: 'mod.barnops', label: 'Barn Ops' },
  { moduleKey: 'mod.horserecords', label: 'Records' },
  { moduleKey: 'mod.employees', label: 'Employees' },
];
```

The whole render (`OpsDashboard.tsx:170-275`):
```tsx
export default function OpsDashboard({
  counts = DEFAULT_COUNTS,
  hubRoutes = MODULE_HUB_ROUTES,
}: OpsDashboardProps) {
  const modules = useModules();
  const { isPageHidden } = useAuth();

  const kpis: KpiSpec[] = [
    // COUNTFIX 1.1: same number, same words, same destination as the Dashboard
    // badge and band. `/app/ops/intake` is retired (INTAKE_PAGE_RETIRED) and
    // redirects to the dashboard — link there directly rather than via a bounce.
    { key: 'intake', label: 'Inbound work waiting', to: '/app/dashboard', load: counts.inboundOpen },
    { key: 'documents', label: 'Documents awaiting signature', to: '/app/ops/documents', load: counts.draftDocuments },
  ];

  return (
    <div className="space-y-8">
      <Helmet><title>Operations</title></Helmet>

      <header>
        <h1 className="font-serif text-2xl text-green-900">Operations</h1>
        <p className="mt-1 text-sm text-green-800/70">Your tenant at a glance.</p>
      </header>

      <section aria-label="Key metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((spec) => <KpiTile key={spec.key} spec={spec} />)}
        </div>
      </section>

      <section aria-label="Modules">
        <h2 className="font-serif text-lg text-green-900">Modules</h2>
        <p className="mt-1 text-sm text-green-800/70">
          <span className="uppercase tracking-wide text-xs">Locked</span> means your plan does not
          include it. <span className="uppercase tracking-wide text-xs">Hidden</span> means you
          have it and put it away — it still opens, and you can bring its menu entry back under{' '}
          <Link to="/app/ops/admin/pages" className="underline">Settings &rarr; Page visibility</Link>.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_TILES.map((tile) => {
            const hubRoute = hubRoutes[tile.moduleKey];
            const hubPageKey = MODULE_HUB_PAGE_KEY[tile.moduleKey];
            const hidden = !!hubPageKey && isPageHidden(hubPageKey);
            return (
              <ModuleGate key={tile.moduleKey} moduleKey={tile.moduleKey} modules={modules}
                fallback={
                  <div data-testid={`module-${tile.moduleKey}-locked`} role="note"
                    className="flex items-center justify-between rounded border border-green-800/10 bg-green-800/5 px-5 py-4 text-green-800/50">
                    <span className="font-serif">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide">Locked</span>
                  </div>
                }>
                {hubRoute && hidden ? (
                  /* Entitled, built, and put away by this tenant. Still a link —
                     the route resolves and this is the way back. */
                  <Link to={hubRoute} data-testid={`module-${tile.moduleKey}-hidden`}
                    className="flex items-center justify-between rounded border border-dashed border-green-800/25 bg-cream-100/60 px-5 py-4 hover:border-green-800/50 transition-colors">
                    <span className="font-serif text-green-800/70">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">Hidden</span>
                  </Link>
                ) : hubRoute ? (
                  <Link to={hubRoute} data-testid={`module-${tile.moduleKey}-tile`}
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4 hover:border-green-800/40 transition-colors">
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span aria-hidden className="text-green-800/40">&rarr;</span>
                  </Link>
                ) : (
                  /* Enabled module, hub not shipped: status tile, never a dead link. */
                  <div data-testid={`module-${tile.moduleKey}-enabled`} role="note"
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4">
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">Enabled</span>
                  </div>
                )}
              </ModuleGate>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```
KPI tile copy (`OpsDashboard.tsx:129-140`): the label, or on failure `Couldn’t load`, or `—`
while pending.

Every visible string on OpsDashboard: `Operations` (title + h1) · `Your tenant at a glance.` ·
`Inbound work waiting` · `Documents awaiting signature` · `Couldn’t load` · `—` · `Modules` ·
`Locked means your plan does not include it. Hidden means you have it and put it away — it still
opens, and you can bring its menu entry back under Settings → Page visibility.` · `Brokerage` ·
`Lessons` · `Boarding` · `Barn Ops` · `Records` · `Employees` · `Locked` · `Hidden` · `Enabled` · `→`

### SURFACE B — InstructorHome (the trainers' home nobody can reach as a trainer)

Whole render (`src/pages/app/InstructorHome.tsx:139-187`):
```tsx
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Helmet><title>Servicing · French Heritage</title></Helmet>

      <div className="mb-5">
        <h1 className="font-serif text-2xl text-green-800">Your day</h1>
        <p className="body-text text-sm text-muted mt-0.5">Lessons, clients, and requests you're servicing.</p>
      </div>

      {/* Quick servicing actions */}
      <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
        <ActionTile to="/app/ops/lessons" icon={GraduationCap} label="Lessons" sub="Sessions, packages, credits" />
        <ActionTile to="/app/calendar" icon={CalendarDays} label="Availability" sub="Set the times you teach" />
        <ActionTile to="/app/ops/contacts" icon={Contact} label="Clients" sub={clientCount !== null ? `${clientCount} on file` : 'People you service'} />
        <ActionTile to="/app/dashboard" icon={Mail} label="Requests" sub={requests.length > 0 ? `${requests.length} to review` : 'Incoming inquiries'} />
      </div>

      {/* Today */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-serif text-green-800 text-lg">Today</h2>
          <Link to="/app/ops/lessons" className="text-[12px] text-gold-800 font-semibold inline-flex items-center gap-1">All sessions <ChevronRight size={13} /></Link>
        </div>
        {today.length > 0 ? (
          <div className="flex flex-col gap-2">{today.map((r) => <LessonRow key={r.id} r={r} />)}</div>
        ) : (
          <div className="bg-white border border-green-800/10 rounded-xl px-4 py-6 text-center">
            <p className="text-[13px] text-muted">No lessons scheduled today.</p>
          </div>
        )}
      </div>

      {/* Requests — booking requests still new + support tickets not yet resolved,
          the same rows the Requests count above summarizes. TASK-DASHLEADS: this
          page's own subtitle promised "requests you're servicing" before anything
          here actually rendered one. */}
      {requests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="font-serif text-green-800 text-lg">Requests</h2>
            <Link to="/app/dashboard" className="text-[12px] text-gold-800 font-semibold inline-flex items-center gap-1">All requests <ChevronRight size={13} /></Link>
          </div>
          <div className="flex flex-col gap-2">{requests.slice(0, 6).map((r) => <RequestRow key={r.id} r={r} />)}</div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="font-serif text-green-800 text-lg mb-2.5">Upcoming</h2>
          <div className="flex flex-col gap-2">{upcoming.map((r) => <LessonRow key={r.id} r={r} />)}</div>
        </div>
      )}
    </div>
  );
```
Lesson-row status chips (`InstructorHome.tsx:36-40`):
```tsx
const STATUS_CHIP: Record<string, { label: string; cls: string; icon: typeof CircleDot }> = {
  scheduled: { label: 'Scheduled', cls: 'text-green-800 bg-green-50 border-green-200', icon: CircleDot },
  completed: { label: 'Completed', cls: 'text-secondary bg-cream-200 border-green-800/15', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'text-red-700 bg-red-50 border-red-200', icon: CircleDot },
};
```
Note `InstructorHome.tsx:153` still links "Clients" to `/app/ops/contacts`, which now redirects
to `/app/records/clients` — a working link through a redirect, but pointing at a retired path.

Every visible string on InstructorHome: `Servicing · French Heritage` (title) · `Your day` ·
`Lessons, clients, and requests you're servicing.` · `Lessons` / `Sessions, packages, credits` ·
`Availability` / `Set the times you teach` · `Clients` / `N on file` or `People you service` ·
`Requests` / `N to review` or `Incoming inquiries` · `Today` · `All sessions` ·
`No lessons scheduled today.` · `Requests` · `All requests` · `Upcoming` · chips `Scheduled` /
`Completed` / `Cancelled`.

### The preview wrapper (`src/pages/app/ops/InstructorHomePreview.tsx`, whole banner)
```tsx
      <div role="note" aria-label="Preview notice" data-testid="instructor-preview-banner"
        className="border-2 border-dashed border-gold-400 bg-gold-50 rounded-xl px-4 py-3.5 mb-2 max-w-3xl mx-auto mt-6 sm:px-6">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold-800">
          <Eye size={14} aria-hidden="true" />
          Preview — not a live page
        </p>
        <p className="text-[13px] text-green-900 mt-1.5">
          This is the <strong>trainer&rsquo;s home</strong> (<code>InstructorHome</code>), which
          normally renders only for staff who are not admins. No such account exists in
          production, so this route mounts the page for evaluation.
        </p>
        <p className="text-[12px] text-green-800/80 mt-1.5">
          <strong>Its data is yours, not a trainer&rsquo;s.</strong> Every query below runs as
          your signed-in account, so the rows are admin-scoped. Read the layout and the
          behaviour as accurate; treat the specific rows as indicative only.
        </p>
      </div>

      <InstructorHome />
```

---

## /app/ops/horses — HorsesPage (127 lines)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **STALE.** `grep -rn "ops/horses" src/` now returns FOUR hits, one of which is a
  live nav row:
  ```
  src/App.tsx:306:              <Route path="ops/horses" element={<ProtectedRoute requireStaff><HorsesPage /></ProtectedRoute>} />
  src/lib/reviewSection.ts:106:        slot: 'B', label: 'Horses B · 07-01 original', to: '/app/ops/horses',
  src/pages/app/ops/HorsesPage.tsx:14:import { HorseTable } from '../../../components/ops/horses/HorseTable';
  src/pages/app/ops/HorsesPage.tsx:15:import { HorseForm } from '../../../components/ops/horses/HorseForm';
  ```
  `reviewSection.ts:105-108` is the entry, and `reviewSection.ts:356-361` makes it an admin nav
  row labelled **"Horses B · 07-01 original"**. Its own description confirms the original claim
  was accurate when written:
  ```ts
  {
    slot: 'B', label: 'Horses B · 07-01 original', to: '/app/ops/horses',
    what: 'HorsesPage, the 2026-07-01 original. Routed, but nothing has linked to it since. It is the only one that resolves breed/colour lookups to names.',
  },
  ```
- exists: yes (127 lines)
- **The other two horse surfaces**, for comparison (`src/lib/reviewSection.ts:99-113`):
  - **A — `/app/ops/horse-records`** → `HorseRecordsPage`. *"The roster staff use today —
    PageLayout, filters, the record drawer."* Reached today as the **Horses tab of the Records
    page** (`src/pages/app/RecordsPage.tsx:91`: `{tab === 'horses' && <HorseRecordsPage onOpenContact={setCrossContact} />}`),
    whose nav row is `AppLayout.tsx:568` `{ to: '/app/records', label: 'Records', icon: BookOpen }`.
  - **C — `/app/ops/records`** → `RecordsHubPage` (102 lines). *"the module surface: a third roster
    plus the parties/health lanes."* Its own warning: *"Gated on mod.horserecords, which is
    ENABLED for FHE — so this is a live page today, not a dark one."* Its nav row was moved into
    the Review section (`AppLayout.tsx:594` shows the removed line as a comment).
  - **B — `/app/ops/horses`** → `HorsesPage`, this one. Unique property per the review entry:
    **it is the only one of the three that resolves breed/colour lookup codes to names.**
- content — essentially the whole component (`src/pages/app/ops/HorsesPage.tsx:29-127`):
```tsx
type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; horse: Horse };

export default function HorsesPage() {
  const propertyTerm = usePropertyTerm();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  const [owners, setOwners] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [h, b, c, o] = await Promise.all([
        listHorses(), listHorseBreeds(), listHorseColors(), listContacts(),
      ]);
      setHorses(h); setBreeds(b); setColors(c); setOwners(o);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load horses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (input: HorseInput) => {
    const created = await createHorse(input);
    setHorses((prev) => [created, ...prev]);
    setModal({ mode: 'closed' });
  };

  const handleUpdate = (id: string) => async (input: HorseInput) => {
    const updated = await updateHorse(id, input);
    setHorses((prev) => prev.map((h) => (h.id === id ? updated : h)));
    setModal({ mode: 'closed' });
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Horses · Ops</title></Helmet>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Horses</h1>
          <p className="text-sm text-green-800/70">Roster of horses {propertyTerm.preposition} your {propertyTerm.term}.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          New horse
        </button>
      </header>

      {loadError ? (
        <div role="alert" className="form-error">{loadError}</div>
      ) : (
        <HorseTable
          horses={horses} breeds={breeds} colors={colors} owners={owners}
          loading={loading}
          onRowClick={(horse) => setModal({ mode: 'edit', horse })}
        />
      )}

      <Modal
        open={modal.mode !== 'closed'}
        onClose={() => setModal({ mode: 'closed' })}
        title={modal.mode === 'edit' ? 'Edit horse' : 'New horse'}
        disableBackdropClose
      >
        {modal.mode !== 'closed' && (
          <HorseForm
            breeds={breeds} colors={colors} owners={owners}
            horse={modal.mode === 'edit' ? modal.horse : null}
            onSubmit={modal.mode === 'edit' ? handleUpdate(modal.horse.id) : handleCreate}
            onCancel={() => setModal({ mode: 'closed' })}
          />
        )}
      </Modal>
    </div>
  );
}
```
Every visible string: `Horses · Ops` (title) · `Horses` · `Roster of horses {at/on} your
{property term}.` (tenant-configurable — TASK-FACILITYTERM) · `New horse` · `Could not load
horses.` · `Edit horse` · plus whatever `HorseTable` / `HorseForm` render (shared components,
also used elsewhere).

---

## /app/ops/availability
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **VERIFIED and still true.** `grep -rn "ops/availability" src/` returns exactly
  two hits, both being the route definition itself:
  ```
  src/App.tsx:325:              {/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}
  src/App.tsx:326:              <Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />
  ```
  No nav entry, no link, no `navigate()` call anywhere in `src/`.
- exists: the ROUTE exists; **no component backs it.** There is no `AvailabilityPage` in the repo —
  the element is a bare `<Navigate>`. Nothing was retired behind a boolean here and there is
  nothing to restore; this is a pure URL-preservation redirect.
- content — the entire artifact, both lines, verbatim:
```tsx
{/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}
<Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />
```
It redirects to `/app/calendar`. There is nothing else to show — no page, no copy, no component.
The one thing worth noting: `InstructorHome.tsx:152` labels its calendar tile **"Availability" /
"Set the times you teach"** and points at `/app/calendar` directly, so the concept survived; only
the URL was folded in.

---

## mod.brokerage (AppLayout.tsx:587-589)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **VERIFIED and still true — this is the one genuinely dark module.** The module is
  ON in prod, the nav entry is gone, and no hub page or route exists to restore it to.
- exists: the MODULE row exists and is enabled; **no brokerage page or component exists at all.**
  `grep -rn "brokerage" src/` returns only: the fixture list, the AppLayout removal comment, three
  doc-comments, `pageRegistry.ts:95` (a label), `useModules.ts:30` (catalog membership),
  `OpsDashboard.tsx:99/106/113` (the tile + the "no hub" comments), and `api.ts:2210`. **No `.tsx`
  page file, no route, no component.** So there is nothing built to turn on — only the DB
  entitlement and its server-side RPCs.
- content:

**The module row in prod** (`select m.*, om.* from modules m left join org_modules om …`):
```
 module_key    | mod.brokerage
 name          | Brokerage & Contracts
 description   | Search/evaluation/transaction-representation, engagement_stages, brokerage engagement RPCs.
 is_core       | f
 active        | t
 --- org_modules ---
 id            | 7f59085b-7ff9-4812-857a-a903794af7ff
 org_id        | e656f20b-ef43-4725-9029-19e7f0190d9c
 enabled       | t          ← ENABLED
 source        | TIER
 enabled_at    | 2026-07-02 22:24:22.560749+00
 expires_at    | (null)
```
And `my_modules()` (the RPC `AuthContext` reads) will return it — its body has no exclusion that
would drop it:
```sql
  SELECT om.module_key
    FROM org_modules om
    JOIN modules m ON m.module_key = om.module_key
    WHERE om.org_id = current_org()
      AND om.enabled
      AND (om.expires_at IS NULL OR om.expires_at > now())
      AND COALESCE(m.active, true)
    ORDER BY om.module_key
```

**The AppLayout comment** — `src/components/app/AppLayout.tsx:586-603`. (The report cited line 331;
the file has grown and it now sits at 587-589. Same text.)
```tsx
const MODULES_GROUP: NavItem[] = [
  // Brokerage has no staff hub page yet (mod.brokerage's live surfaces are the
  // client-lane engagement reads) — the entry linked to an unregistered route
  // and 404'd for every staff user with the module on. Re-add with the hub.
  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
  /* REVIEW SECTION — MOVED OUT, not deleted (TASK-REVIEWNAV). One row LEFT
     this group for Review:
       { to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords' }
     ... */
  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
];
```

**How it presents to the owner today.** Because it is enabled but has no hub route, the
OpsDashboard module launcher renders it as a non-navigating status tile
(`src/pages/app/ops/OpsDashboard.tsx:95-108`):
```tsx
/**
 * Wave-7 re-link seam: moduleKey → the module's hub route, listing ONLY routes
 * that are actually registered in App.tsx. A module tile navigates only when
 * its hub route appears here; an enabled module without an entry renders as a
 * non-navigating "Enabled" status tile (dead links are forbidden). When a hub
 * page ships, add its route to App.tsx AND one entry here, e.g.
 *   'mod.brokerage': '/app/ops/brokerage',
 */
export const MODULE_HUB_ROUTES: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_HUB_PAGE_KEY)
    .map(([moduleKey, pageKey]) => [moduleKey, pageByKey(pageKey)?.path])
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string'),
);
// mod.brokerage has no hub page, so the registry yields no entry for it and its
// tile renders as the non-navigating "Enabled" status tile (dead links are
// forbidden). That is the same behaviour as the hand-written map this replaced.
```
So on `/app/ops` the owner sees a tile reading **"Brokerage"** with the status word **"Enabled"**
and no arrow — a paid-for, server-live module with zero staff UI. Its label elsewhere is
`src/lib/pageRegistry.ts:95`: `'mod.brokerage': 'Brokerage & Contracts',`.

---

## Module-gated pages: boarding (×4), barnops (×4), employees (×3)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **STALE — THE CLAIM IS NOW WRONG. All three modules are ENABLED in prod and all
  eleven pages are LIVE and navigable today.** This is the single biggest correction in this
  report: the owner has ~3,600 lines of fully-built operations software he has probably never
  opened, and it is not behind any switch any more.

  **Proof 1 — the modules are ON.** `select … from modules m left join org_modules om …`:
  ```
   module_key    | name                  | enabled | source |          enabled_at
  ---------------+-----------------------+---------+--------+------------------------------
   mod.barnops   | Barn Ops & Inventory  | t       | GRANT  | 2026-08-12 15:02:21.285597+00
   mod.boarding  | Boarding & Facility   | t       | GRANT  | 2026-08-12 15:02:21.285597+00
   mod.employees | Employees & Scheduling| t       | GRANT  | 2026-08-12 15:02:21.285597+00
  ```
  All three flipped on 2026-08-12 by `supabase/migrations/20260812T1600_pagevis_all_modules_and_page_visibility.sql`
  (whose own header records: *"Measured before this migration: brokerage / horserecords / lessons
  TRUE"* — i.e. these three were the FALSE ones).

  **Proof 2 — nothing is hidden.** `select * from org_page_visibility;` → **0 rows**. No page is
  put away.

  **Proof 3 — the nav rows pass the filter.** The gate is `src/components/app/AppLayout.tsx:659-662`:
  ```tsx
  const visible = (items: NavItem[]) => items.filter(
    (i) => (!i.module || hasModule(i.module))
        && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
  );
  ```
  and the rows are `AppLayout.tsx:590-591, 602`:
  ```tsx
  { to: '/app/ops/boarding',  label: 'Boarding',  icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops',   label: 'Barn Ops',  icon: Boxes,    module: 'mod.barnops' },
  { to: '/app/ops/employees', label: 'Employees', icon: Contact,  module: 'mod.employees' },
  ```
  With all three modules true, the **Modules** nav group renders all three hub links.

  **Proof 4 — the routes are registered.** `src/App.tsx:336-343` and `:352-354`:
  ```tsx
  <Route path="ops/boarding" element={<ProtectedRoute requireStaff><BoardingHubPage /></ProtectedRoute>} />
  <Route path="ops/boarding/facilities" element={<ProtectedRoute requireStaff><FacilitiesPage /></ProtectedRoute>} />
  <Route path="ops/boarding/agreements" element={<ProtectedRoute requireStaff><BoardAgreementsPage /></ProtectedRoute>} />
  <Route path="ops/boarding/charges" element={<ProtectedRoute requireStaff><BoardChargesPage /></ProtectedRoute>} />
  <Route path="ops/barnops" element={<ProtectedRoute requireStaff><BarnopsHubPage /></ProtectedRoute>} />
  <Route path="ops/barnops/resources" element={<ProtectedRoute requireStaff><ResourcesPage /></ProtectedRoute>} />
  <Route path="ops/barnops/consumption" element={<ProtectedRoute requireStaff><ConsumptionLogPage /></ProtectedRoute>} />
  <Route path="ops/barnops/allocation-rules" element={<ProtectedRoute requireStaff><AllocationRulesPage /></ProtectedRoute>} />
  ...
  <Route path="ops/employees" element={<ProtectedRoute requireStaff><EmployeesHubPage /></ProtectedRoute>} />
  <Route path="ops/employees/staff" element={<ProtectedRoute requireStaff><StaffPage /></ProtectedRoute>} />
  <Route path="ops/employees/schedule" element={<ProtectedRoute requireStaff><SchedulePage /></ProtectedRoute>} />
  ```
  The remaining per-page gate is a second, redundant `<ModuleGate moduleKey="mod.boarding" modules={modules}>`
  inside each page — which also passes now.
- exists: all eleven, yes. **3,573 lines across the eleven files.** Line counts per page below.
- content:

### Boarding — hub

**`/app/ops/boarding` — `src/pages/app/ops/hubs/BoardingHubPage.tsx` (137 lines)**
Section cards (`:22-37`):
```tsx
  { to: '/app/ops/boarding/facilities', title: 'Facilities & stalls',
    description: 'Manage properties and the stalls within them.' },
  { to: '/app/ops/boarding/agreements', title: 'Board agreements',
    description: 'Per-horse contracts: boarder, stall, monthly rate, status.' },
  { to: '/app/ops/boarding/charges',    title: 'Board charges',
    description: 'Generate period charges and follow them to settlement.' },
```
Visible copy: `Boarding · Ops` (title) · h1 `Boarding` · KPI labels `Stall occupancy`,
`Active agreements`, `Open board charges` · `Could not load boarding KPIs.` · the three card
titles + descriptions above · `<nav aria-label="Boarding sections">`.

### Boarding — 1/3: Facilities & stalls
**`/app/ops/boarding/facilities` — `FacilitiesPage.tsx` (453 lines)**
Two stacked tables on one page (`:353-407`):
```tsx
<section aria-labelledby="facilities-heading" className="mb-10">
  <div className="flex items-center justify-between mb-4">
    <h1 id="facilities-heading" className="font-serif text-2xl text-green-900">Facilities</h1>
    <button type="button" className="btn-primary" onClick={...}>New facility</button>
  </div>
  <DataTable columns={facilityColumns} rows={facilities} rowKey={(f) => f.id} loading={loading}
    emptyTitle="No facilities yet"
    emptyMessage="Create your first facility to start assigning stalls." ... />
</section>
...
<h2 id="stalls-heading" className="font-serif text-xl text-green-900">Stalls</h2>
  emptyTitle="No stalls yet"
  emptyMessage="Add stalls under a facility to track occupancy."
```
Column headers: `Address key`, `Facility`, + a `StatusBadge` of `ACTIVE`/`INACTIVE`.
Form fields: `Address registry key`, `Facility` (required), `Stall type`
(hint: *"e.g. 12x12, foaling, paddock."*).
Buttons/toasts: `New facility`, `New stall`, `Create facility`, `Save facility`, `Create stall`,
`Save stall`, `Saving…`, `Edit facility`, `Edit stall`, `Name is required.`,
`Facility and code are required.`, `Could not load facilities.`, `Facility created.`,
`Facility updated.`, `Could not save facility.`, `Stall created.`, `Stall updated.`,
`Could not save stall.`

### Boarding — 2/3: Board agreements
**`/app/ops/boarding/agreements` — `BoardAgreementsPage.tsx` (408 lines)**
Header (`:337-348`):
```tsx
<ModuleGate moduleKey="mod.boarding" modules={modules}>
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="font-serif text-2xl text-green-900">Board agreements</h1>
      <p className="text-sm text-green-800/70">
        Per-horse boarding contracts. Agreements archive by status — never delete.
      </p>
    </div>
```
Status machine + transition button labels (`:44-54`):
```tsx
  ACTIVE:    ['SUSPENDED', 'ENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'ENDED', 'CANCELLED'],
  ...
  ACTIVE: 'Reactivate',
  SUSPENDED: 'Suspend',
```
Columns: `Boarder`, `Monthly rate`, + a screen-reader-only `Transitions` column.
Form fields: `Boarder` (required, hint *"The payer contact board charges bill to."*),
`Monthly rate` (hint *"Leave blank to use the tenant default board rate from the registry."*),
`Board type` (hint *"e.g. full, pasture, training."*), `Start date`, an `Unassigned` stall option.
Empty state: `No board agreements yet` / `Create an agreement to link a horse, a payer and a stall.`
Modal title `New board agreement`; messages `Horse and boarder are required.`,
`Board agreement created.`, `Could not create the agreement.`, `Could not update the agreement.`,
`Could not load board agreements.`

### Boarding — 3/3: Board charges
**`/app/ops/boarding/charges` — `BoardChargesPage.tsx` (368 lines)**
Header (`:300-308`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Board charges</h1>
  <p className="text-sm text-green-800/70">Period charges emitted to billing.</p>
```
Columns: `Agreement`, `Billing` (a `StatusBadge` defaulting to `UNBILLED`), `Emitted`.
Form: `Agreement` (required), `Period start` (required), `Period end` (required), `Amount`
(required, hint *"Prefilled from the agreement's monthly rate."*).
Buttons/toasts: `Generate`, `Generating…`, modal `Generate board charge`, `Emit to billing`,
`Charge generated and emitted to billing.`, `Charge emitted to billing.`,
`Could not generate the charge.`, `Could not emit the charge.`, `Could not load board charges.`,
`Agreement, period and amount are required.`
Empty state: `No board charges yet` / `Generate a period charge from an active agreement.`

### Barn Ops — hub
**`/app/ops/barnops` — `BarnopsHubPage.tsx` (116 lines)** — h1 `Barn Ops`, three cards (`:23-41`):
```tsx
  { to: '/app/ops/barnops/resources', title: 'Resources & lots',
    description: 'Consumables catalog with stock levels computed from purchased lots.' },
  { to: '/app/ops/barnops/consumption', title: 'Consumption log',
    description: 'Append-only usage ledger — dumb, cheap facts priced later at resolution.' },
  { to: '/app/ops/barnops/allocation-rules', title: 'Allocation & billing',
    description: 'Cost attribution overrides + the deterministic billing resolver.' },
```

### Barn Ops — 1/3: Resources & lots
**`/app/ops/barnops/resources` — `ResourcesPage.tsx` (546 lines — the largest of the eleven)**
Header (`:372-379`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Resources</h1>
  <p className="text-sm text-green-800/70">
    Consumables catalog — stock levels are the sum of on-hand across purchased lots.
  </p>
```
Two tables. Resource columns: `Name`, `Key`, `Category`, `Unit`, `On hand`.
Lots table (h2 at `:448`) columns: `Resource`, `Vendor`, `Purchased`, `Unit cost`, `On hand`,
`Purchased at`.
Form fields: `Resource key` (req), `Name` (req), `Category` (req), `Unit of measure`, `Vendor`,
`Quantity purchased` (req), `Unit cost` (req, hint *"Cost per unit; the resolver prices
consumption from the drawn lot."*).
Empty states: `No resources yet` / `Create a resource, then record purchased lots against it.`
and `No lots yet` / `Use “Add lot” on a resource to record a purchase.`
Toasts: `Resource created.`, `Resource updated.`, `Lot recorded.`

### Barn Ops — 2/3: Consumption log
**`/app/ops/barnops/consumption` — `ConsumptionLogPage.tsx` (330 lines)**
Header (`:136-142`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Consumption log</h1>
  <p className="text-sm text-green-800/70">
    Append-only ledger — logged events cannot be edited or deleted; corrections are new
    offsetting events. Pricing happens later, at billing resolution.
  </p>
```
Capture form fields: `Resource` (req), `Lot`, `Horse` (hint *"Optional — attribution falls to the
barn when blank."*), `Quantity` (req), `Occurred at` (hint *"Leave blank to record “now”."*), `Notes`.
Log table columns: `When`, `Resource`, `Lot`, `Horse`, `Qty`, `Notes`.
Empty state: `No consumption logged yet` / `Log the first event with the form above.`
Toast: `Consumption logged.`

### Barn Ops — 3/3: Cost allocation rules
**`/app/ops/barnops/allocation-rules` — `AllocationRulesPage.tsx` (532 lines)**
Header (`:347-355`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Cost allocation rules</h1>
  <p className="text-sm text-green-800/70">
    Overrides for consumption attribution — plus the default/barn payer that absorbs
    uncovered remainders.
  </p>
```
Rules table columns: `Scope`, `Target`, `Payer`, `Share %`, `Effective`.
Form: `Scope`, `Horse` (req), `Payer` (req), `Share %` (req, hint *"Splits for a scope should sum
to 100."*), `Effective from`, `Effective to`.
Empty state — the most informative one in the set:
`No allocation rules yet` / `Without an override, attribution derives from each horse's parties;
add a 'default' rule for the barn payer.`
Second section (h2 at `:433`) — a **billing resolver preview**: field `Period (month)` (req),
result columns `Payer`, `Horse`, `Qty`, `Unit`, `Amount`, `Status`; empty state
`No billable lines produced` / `No consumption events fell inside this period.`
Toasts: `Rule created.`, `Rule updated.`, `Rule removed.`, `Could not remove the rule.`

### Employees — hub
**`/app/ops/employees` — `EmployeesHubPage.tsx` (63 lines)**, whole render:
```tsx
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Employees</h1>
        <p className="text-sm text-green-800/70">Staff, schedules and service assignments.</p>
      </div>

      <ModuleGate moduleKey="mod.employees" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load the employees summary.'}
          </p>
        )}
        {load.isPending && !kpis && (
          <p className="text-sm text-green-800/70" data-testid="hub-loading">Loading…</p>
        )}

        {kpis && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/app/ops/employees/staff" className="..." data-testid="kpi-active-staff">
              <p className="form-label mb-1">Active staff</p>
              <p className="font-serif text-3xl text-green-900">{kpis.activeStaff}</p>
            </Link>
            <Link to="/app/ops/employees/schedule" className="..." data-testid="kpi-shifts-week">
              <p className="form-label mb-1">Shifts this week</p>
              <p className="font-serif text-3xl text-green-900">{kpis.shiftsThisWeek}</p>
            </Link>
          </div>
        )}
      </ModuleGate>
```
(Note the header comment at `:8-14` promises a third KPI, *"open-assignments"*, which is not
rendered.)

### Employees — 1/2: Staff
**`/app/ops/employees/staff` — `StaffPage.tsx` (183 lines)**
```tsx
  <h1 className="font-serif text-2xl text-green-900">Staff</h1>
  <p className="text-sm text-green-800/70">Team profiles.</p>
  ...
  <button type="button" className="btn-primary" onClick={openCreate}>Add staff member</button>
  <DataTable<StaffProfile> columns={[
    { key: 'name',   header: 'Name',     render: … },
    { key: 'email',  header: 'Email',    render: … },
    { key: 'title',  header: 'Title',    render: … },
    { key: 'pay',    header: 'Pay type', render: … },
    { key: 'active', header: 'Status',   render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
  ]}
    emptyTitle="No staff yet"
    emptyMessage="Add your first team member to schedule shifts." />
```
Form fields: `Team member account` (req), `Title`, `Pay type` (hint *"e.g. HOURLY, SALARY,
PER_SERVICE"*), `Active`.
Toasts: `Staff profile created`, `Staff profile updated`, `Could not load staff.`

### Employees — 2/2: Schedule
**`/app/ops/employees/schedule` — `SchedulePage.tsx` (237 lines)**
```tsx
  <h1 className="font-serif text-2xl text-green-900">Schedule</h1>
  <p className="text-sm text-green-800/70">
    Week of {week.start.toLocaleDateString()} – {new Date(week.end.getTime() - 1).toLocaleDateString()}
  </p>
  <div className="flex gap-2">
    <button ... onClick={...}>← Prev week</button>
    <button ... onClick={() => setAnchor(new Date())}>This week</button>
    <button ... onClick={...}>Next week →</button>
  </div>
  ...
  <button type="button" className="btn-primary" onClick={() => setShiftModal(true)}>New shift</button>
  <DataTable<Shift> columns={[
    { key: 'staff',  header: 'Staff'  }, { key: 'starts', header: 'Starts' },
    { key: 'ends',   header: 'Ends'   }, { key: 'role',   header: 'Role'   },
  ]}
    emptyTitle="No shifts this week"
    emptyMessage="Create a shift to build the week's schedule." />
```
Form fields: `Staff member` (req), `Starts` (req), `Ends`, `Role` (hint uses the tenant property
term: *"e.g. {Property} duty, Lessons, Show prep"*), and a time-entry form with `Clock in` (req)
and `Clock out`.
Toasts: `Shift created`, `Time entry recorded`, `Could not load shifts.`

**Line-count summary of this block:**
| page | file | lines |
|---|---|---|
| Boarding hub | `hubs/BoardingHubPage.tsx` | 137 |
| Facilities & stalls | `boarding/FacilitiesPage.tsx` | 453 |
| Board agreements | `boarding/BoardAgreementsPage.tsx` | 408 |
| Board charges | `boarding/BoardChargesPage.tsx` | 368 |
| Barn Ops hub | `hubs/BarnopsHubPage.tsx` | 116 |
| Resources & lots | `barnops/ResourcesPage.tsx` | 546 |
| Consumption log | `barnops/ConsumptionLogPage.tsx` | 330 |
| Cost allocation rules | `barnops/AllocationRulesPage.tsx` | 532 |
| Employees hub | `hubs/EmployeesHubPage.tsx` | 63 |
| Staff | `employees/StaffPage.tsx` | 183 |
| Schedule | `employees/SchedulePage.tsx` | 237 |
| **total** | | **3,373** |
(Plus `hubs/LessonsHubPage.tsx` 107 and `hubs/RecordsHubPage.tsx` 102, which belong to
already-live modules.)

---

## IntakePage / route /app/ops/intake (src/pages/app/ops/IntakePage.tsx)
- reported by: TASK-DASHLEADS-REPORT.md
- reachability: **The commit is VERIFIED. The "reachable via dashboard links" half is STALE — the
  page is now reachable ONLY through the admin Review mount.**
  - Commit confirmed:
    ```
    commit cefaad7b4a68ced12cae79079a61b4f48e1ab65b
    Author: Admin <admin@cactai.io>   Date: Mon Aug 10 21:24:36 2026
    feat(ui): UIO-012 item 2/2b — Dashboard moves to Management, a divider separates Add New
    ```
    Its message states the nav half precisely: *"MANAGEMENT_GROUP: Inbound entry replaced with
    Dashboard … Badge injection retargeted from /app/ops/intake to /app/dashboard"* — and flags
    that it deliberately did NOT touch the page (*"IntakePage.tsx is 870 lines of staff tooling …
    not a nav-menu change"*).
  - **The route no longer builds to the page.** A SECOND retirement landed on 2026-08-11
    (TASK-LEADCLEAN) closing the route half. `src/pages/app/ops/IntakePage.tsx:447`:
    `export const INTAKE_PAGE_RETIRED = true;` and `src/App.tsx:310-318`:
    ```tsx
    {/* RETIRED 2026-08-11 (TASK-LEADCLEAN): the owner ruled the
        dashboard is the surface and Inbound goes away. The nav item
        was already gone; this closes the route. Redirects rather than
        404s so the notification links that still point here land on
        the lead's drawer (the `request` param is carried through);
        flip the boolean to restore the page. */}
    <Route path="ops/intake" element={INTAKE_PAGE_RETIRED
      ? <IntakeRetiredRedirect />
      : <ProtectedRoute requireStaff><IntakePage /></ProtectedRoute>} />
    ```
  - **The dashboard links the report describes now EXPAND IN PLACE instead of navigating.**
    `grep -rn "ops/intake" src/` finds no `<Link>`/`navigate()` to it anywhere; every
    `DashboardPanel` hit is a comment recording the removal:
    ```
    src/components/app/DashboardPanel.tsx:26:  the ONLY surface for it (/app/ops/intake is retired) and made the list
    src/components/app/DashboardPanel.tsx:202: // to navigate to /app/ops/intake — a page that no longer exists — so the whole
    src/components/app/DashboardPanel.tsx:216: // Deep link: notification writers emit /app/ops/intake?request=<id>, which the
    src/components/app/DashboardPanel.tsx:398: {/* EXPAND, in place. This used to navigate to /app/ops/intake, which
    ```
  - **The one live way in** is the admin Review nav row **"Inbound B · retired queue"** →
    `/app/ops/review/intake` (`src/App.tsx:367`, `src/lib/reviewSection.ts:147-151`).
- exists: yes (463 lines — note the commit message's "870 lines" predates the LeadWorkDrawer
  extraction described in the file header)
- content:

The redirect component, which is what the route actually renders (`IntakePage.tsx:449-462`):
```tsx
/**
 * The retirement redirect, as its own component so deep links survive it.
 * Several notification writers still emit `/app/ops/intake?request=<id>` links
 * (submit_public_request, create_gift, redeem_gift, provision_client_invitation,
 * sign_start_register_attempt) — carrying the `request` param through to the
 * dashboard keeps every one of those links landing on that lead's drawer rather
 * than on a bare page. Plain `/app/ops/intake` lands on the dashboard.
 */
export function IntakeRetiredRedirect() {
  const [params] = useSearchParams();
  const request = params.get('request');
  return <Navigate to={request ? `/app/dashboard?request=${request}` : '/app/dashboard'} replace />;
}
```

The page itself (`IntakePage.tsx:333-380`) — the Inbound queue:
```tsx
  // focused: hand off to the existing full workflow with the row pre-opened
  if (focus?.kind === 'booking') {
    return (
      <div className="max-w-5xl">
        <button type="button" onClick={() => { setFocus(null); void loadInbound(); }}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
          ← Inbound
        </button>
        <h1 className="font-serif text-2xl text-green-900 mb-6">Booking request</h1>
        <RequestInbox openId={focus.id} />
      </div>
    );
  }
  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Inbound</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Everything sent to the company — booking requests, contact/inquiry notes,
        kiosk signers, and support. This is a queue: it should reach zero.
      </p>

      {/* NEEDS ATTENTION — the whole point of the queue. Nothing here previously
          distinguished a request that had been sitting for ten days from one
          that arrived this morning, which is how three lesson enquiries aged 6–10
          days without anyone noticing.

          `overdue` is deliberately narrow: still new, the person has NOT already
          become a client, and 2+ days old. Six of the nine rows in the live
          backlog were kiosk sign-ins whose person was already converted — work
          genuinely done, row never closed. Those are listed separately as
          bookkeeping so they never drown out real opportunity. */}
      <InboundAttention />

      <BookingFieldsSettings />

      {/* kind filter: buttons on desktop, dropdown on mobile */}
      <div className="hidden sm:flex flex-wrap gap-2 mb-5" aria-label="Filter inbound by kind">
        {KIND_FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={kind === f.id}
            onClick={() => setKind(f.id)}
```
Request status filters (`IntakePage.tsx:56-61`):
```tsx
const REQUEST_FILTERS: { id: RequestFilter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'invited', label: 'Invited' },
  { id: 'converted', label: 'Converted' },
```
Row composition (`IntakePage.tsx:295-310`) — what each queue line shows:
```tsx
        ...requests.map((r) => ({
          key: `b-${r.id}`, kind: 'booking' as const, when: r.created_at,
          who: r.contact_name || r.contact_email || 'Visitor',
          what: (r.request_selections ?? []).map((x) => x.label).filter(Boolean).slice(0, 2).join(', ')
            || 'Booking request',
          status: r.status, refId: r.id,
        })),
        ...support.map((t) => ({
          key: `s-${t.id}`, kind: 'support' as const, when: t.created_at,
          who: 'Member', what: t.subject, status: t.status, refId: t.id,
        })),
```
Visible strings: `Inbound` · `Everything sent to the company — booking requests, contact/inquiry
notes, kiosk signers, and support. This is a queue: it should reach zero.` · `← Inbound` ·
`Booking request` · `Visitor` · `Member` · filters `New` / `Contacted` / `Invited` / `Converted` ·
`Filter inbound by kind` · `Could not load the inbound queue.` · plus whatever
`InboundAttention`, `BookingFieldsSettings` and `RequestInbox` render.

Worth noting for the owner's judgment (`IntakePage.tsx:10-16`) — the machinery is NOT lost with
the page:
```
 * The WORKING MACHINERY did not retire with the page. It was extracted to
 * `components/app/LeadWorkDrawer.tsx` — the fit checklist (set_request_checklist),
 * the staff call-notes timeline, "Mark contacted", ProvisionClientForm, the gift
 * path, and the schedule-lesson path (findClientForRequest → ScheduleSessionForm)
 * — and the dashboard's lead card opens that same component. One implementation,
 * two hosts; retiring a page costs the product nothing.
```

---

## Community → Resources download control missing (src/lib/communityFeed.ts:211, src/lib/community.ts:316)
- reported by: TASK-UPLOADS-REPORT.md
- reachability: **VERIFIED — the function has exactly one occurrence in the entire `src/` tree:
  its own definition.**
  ```
  $ grep -rn "resourceDownloadUrl" src/
  src/lib/community.ts:316:export async function resourceDownloadUrl(storagePath: string): Promise<string | null> {
  ```
  No import, no call, no test. It is exported and unreferenced.

  **The upstream reason it cannot be called**: the mapper that turns a `content_resources` row into
  a feed card **discards `storage_path` and `file_id` entirely** (`src/lib/communityFeed.ts:146-152`):
  ```ts
  function fromResource(r: ContentResource): FeedCard {
    return {
      id: r.id, view: 'resources', kind: 'resource',
      title: r.title, body: r.description ?? undefined,
      ts: new Date(r.created_at).getTime(), when: ago(r.created_at),
    };
  }
  ```
  A `FeedCard` therefore carries no file reference, so no downstream component *could* render a
  download control even if one were added. The `FeedCard` shape does have a `url` field — the
  vendor mapper right below uses it (`communityFeed.ts:154-161`) — but `fromResource` does not set it.
- exists: yes, `resourceDownloadUrl` exists and (per TASK-UPLOADS) now points at a real bucket.
- **CORRECTION TO THE CLAIM: there are no published guides currently unreachable, because there are
  no rows.** `content_resources` in prod:
  ```
  columns: id | title | description | kind | url | storage_path | published | created_at | org_id | file_id
  select * from content_resources;   →  (0 rows)
  ```
  So the missing download control is a latent gap, not an active one. Nothing is stranded today;
  the first guide uploaded would be.
- content:

**`resourceDownloadUrl()` — the full body** (`src/lib/community.ts:308-320`):
```ts
/** Signed URL for a Storage-backed resource.
 *
 *  TASK-UPLOADS fixed a live defect here: this signed against a bucket named
 *  `members`, which has never existed — there are twelve buckets and that is not
 *  one of them, so every call returned null and no resource was downloadable.
 *  Company material now lives in the private `facility-files` bucket alongside
 *  the rest of the Files spine. Members reach it only while the
 *  content_resources row is published; the storage policy reads that same flag. */
export async function resourceDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
```

**The Resources card, proving no download control** (`src/components/feed/CommunityFeed.tsx:177-186`):
```tsx
  // ── RESOURCE: title + body (contact lives in the modal) ──
  if (c.kind === 'resource') {
    return (
      <article ref={ref} onClick={open}
        className={`rounded-xl border border-green-800/10 bg-white p-4 ${clickable}`}>
        <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug mb-1">{c.title}</p>
        {c.body && <p className="text-[12px] text-muted line-clamp-2">{c.body}</p>}
      </article>
    );
  }
```
Title and description. No button, no link, no icon.

**The modal it opens — also no download control** (`src/components/feed/PostModal.tsx:297-311`):
```tsx
function ResourceBody({ card }: { card: FeedCard }) {
  const links = contactActions({
    communityEmail: card.communityEmail, mobileCall: card.mobileCall, mobileText: card.mobileText,
  });
  return (
    <div>
      <h3 className="font-serif text-green-800 text-xl font-semibold leading-snug mb-2">{card.title}</h3>
      {card.body && <p className="text-sm text-secondary mb-5 leading-relaxed">{card.body}</p>}
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.method} href={l.href} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50">
            {l.method === 'email' ? <Mail size={14} /> : <Phone size={14} />} {l.label}
          </a>
```
The only actions are email/phone links — and those come from the **vendor** share-back path
(`fromVendor` sets `communityEmail`/`mobileCall`/`mobileText`), never from a `content_resources`
row. So for an actual published guide, the modal renders a heading, a paragraph, and an empty
action row.

**The feed that lists them** (`src/lib/communityFeed.ts:209-217`):
```ts
export async function fetchViewCards(view: FeedView): Promise<FeedCard[]> {
  switch (view) {
    ...
    case 'resources': {
      // content_resources + shared vendors (share-back from My Stable) in one list
      const [resources, vendors] = await Promise.all([
        fetchResources().catch(() => []),
        listVendors(true).catch(() => [] as Vendor[]),
      ]);
      return [...resources.map(fromResource), ...vendors.map(fromVendor)];
    }
```

---

# Part 4 — Components, emails, migrations and tests

## Header mockup — drawer + modal are dead script (docs/reference/header-mockup.html)
- reported by: TASK-HEADER-REPORT.md
- reachability: VERIFIED, and the mechanism is more precise than reported. The file is 558 lines. The inline `<script>` opens at line 479, but the DOM nodes it reaches for are declared **after** it: `#drawerTab` line 532, `#navScrim` 535, `#drawer` 536, `#scrim` 547, `#createModal` 548. Only `#avatarBtn` (452) and `#createBtn` (457) exist when the script runs. The script therefore **throws at line 512** — `scrim.addEventListener('click', closeModal)` on a null `scrim` — and everything from 512 down never registers: the modal's Escape handler and the *entire* drawer block (516–530). The create button's click handler at 501 *is* registered, but it calls `openModal()`, which touches `scrim.classList` and throws, so the modal never opens either. Net: the avatar press physics (483–491) and the coarse-pointer "reveal the + tab" branch are the only things that work — exactly as reported.
- exists: yes
- content:
```html
<!-- line 479 — script opens here, BEFORE the nodes below exist -->
<script>
/* press physics — JS class so touch-drag-off and touchcancel release cleanly.
   No radius juggling needed now: the struck rim never changes, and the well's
   blurred wall is clipped to the rim so its growth can only go inward. */
const btn = document.getElementById('avatarBtn');          // 452 — EXISTS
const press = () => btn.classList.add('is-pressed');
const release = () => btn.classList.remove('is-pressed');
btn.addEventListener('mousedown', press);                  // ✅ these run
btn.addEventListener('mouseup', release);
btn.addEventListener('mouseleave', release);
btn.addEventListener('touchstart', press, {passive:true});
btn.addEventListener('touchend', release, {passive:true});
btn.addEventListener('touchcancel', release, {passive:true});

/* ---- create button -> modal ---- */
const createBtn = document.getElementById('createBtn');    // 457 — EXISTS
const scrim = document.getElementById('scrim');            // 547 — null
const modal = document.getElementById('createModal');      // 548 — null
const openModal = () => { scrim.classList.add('open'); modal.classList.add('open'); };   // throws when called
const closeModal = () => { scrim.classList.remove('open'); modal.classList.remove('open'); };
/* No hover on touch, so the first tap reveals the tab and the second opens
   the modal — otherwise the + would be invisible when tapped. */
createBtn.addEventListener('click', () => {                // ✅ registers, but…
  const coarse = window.matchMedia('(hover: none)').matches;
  if (coarse && !createBtn.classList.contains('is-out')) {
    createBtn.classList.add('is-out'); return;             // ✅ this branch works
  }
  createBtn.classList.remove('is-out');
  openModal();                                             // ❌ TypeError on null scrim
});
addEventListener('pointerdown', e => {
  if (!createBtn.contains(e.target)) createBtn.classList.remove('is-out');
}, true);
scrim.addEventListener('click', closeModal);   // ❌ LINE 512 — THROWS HERE. Nothing below runs.
addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---- mobile drawer: the tab rides out attached to the drawer's edge ---- */
const drawerTab = document.getElementById('drawerTab');    // never reached
const drawer = document.getElementById('drawer');
const navScrim = document.getElementById('navScrim');
const setDrawer = (open) => {
  drawer.classList.toggle('is-open', open);
  drawerTab.classList.toggle('is-open', open);
  navScrim.classList.toggle('open', open);
  drawerTab.setAttribute('aria-expanded', String(open));
  drawerTab.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
};
drawerTab.addEventListener('click', () => setDrawer(!drawer.classList.contains('is-open')));
navScrim.addEventListener('click', () => setDrawer(false));
/* any real navigation closes it */
drawer.addEventListener('click', e => { if (e.target.closest('a')) setDrawer(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setDrawer(false); });
</script>
```

The avatar press physics that DO work (the part worth keeping), CSS lines 162–174:
```css
.avatar .ring-dark{transition:transform .18s cubic-bezier(.22,.61,.36,1)}
  .avatar:hover .ring-wall{stroke-width:2.4}
  .avatar:hover .ring-dark{transform:translateY(0.5px)}
  .avatar:hover .ring-breath{stroke:rgba(226,236,226,.04)}
  .avatar:hover .av{transform:translateY(2px)}       /* +1 rest + 1 */
.avatar.is-pressed .ring-wall{stroke-width:4;transition-duration:.14s}
.avatar.is-pressed .ring-dark{transform:translateY(1.1px);transition-duration:.07s}
.avatar.is-pressed .ring-breath{ … }
.avatar.is-pressed .av{transform:translateY(3.25px);transition-duration:.07s}  /* +1 rest + 2.25 */
```

The mockup's page markup — this is the visual the owner would be judging (lines 444–478):
```html
<div class="hdrwrap">
<header class="hdr">
  <div class="left"><div class="mark logo"><svg viewBox="0 0 56 56" …>
    … three stacked squircle rings (light / dark / face) …
    </svg><span class="glyph fh emboss">FH</span></div></div>

  <div class="wordmark emboss"><span class="long">French Heritage Equestrian</span><span class="short">French Heritage</span></div>

  <div class="right"><div class="mark avatar" id="avatarBtn"><svg viewBox="0 0 50 50" …>
      <g clip-path="url(#wellClip)"><circle class="ring-wall" cx="25" cy="24.4" r="21.8"/></g>
      <circle class="ring-dark" …/><circle class="ring-breath" …/><circle class="ring" …/>
    </svg><span class="glyph av">C</span></div></div>
</header>
  <button class="tab" id="createBtn" type="button" aria-label="Create" aria-haspopup="dialog">
    <span class="chev" aria-hidden="true"></span>
  </button>
</div>

<div class="page">
  <div class="tag">FINAL DRAFT · variant-5 outlines · letter sinks 1px hover / 2.25px click · well band grows inward</div>
  <div class="eyebrow">Dashboard</div>
  <div class="intro">Good morning, CJ</div>
  <div class="lede">Claire left notes for today's lesson. Beau is in Arena&nbsp;2 at three o'clock, and the farrier comes Thursday.</div>
  <div class="item"><div class="meta">Today · 3:00 pm</div><h2>Lesson with Claire</h2>
    <p>Flatwork focus — leg yield at the trot, then a short gymnastic line. Beau was stiff on the right rein last week, so give him extra time to loosen before you ask for bend.</p></div>
  <div class="item"><div class="meta">Awaiting signature</div><h2>Horse Lease Agreement</h2>
    <p>The purpose and schedule sections are complete. Review the insurance elections before signing.</p></div>
  <div class="item"><div class="meta">Thursday</div><h2>Farrier</h2>
    <p>Sign-up sheet is in the barn. Beau is due for a full set.</p></div>
  <div class="item"><div class="meta">Saturday</div><h2>Clinic — flatwork</h2>
    <p>Two spots left. Auditing is open to all members at no charge.</p></div>
  <div class="item"><div class="meta">This week</div><h2>Feed change</h2>
    <p>Evening grain moves to 5:30pm starting Monday.</p></div>
</div><div class="tail"></div>
```

---

## Shared PageHeader component (src/components/app/PageHeader.tsx) — REPORT IS STALE
- reported by: TASK-ACCOUNTSURFACE-PHASE1.md
- reachability: **The claim is no longer true.** ACCOUNTSURFACE Phase 1 reported "there is no shared PageHeader component anywhere in the codebase." One now exists at `src/components/app/PageHeader.tsx`, created by `9cdb5b1 feat(pages): one page-header component, square icon-only add control (A5/A6)` and amended by `310b21c TASK-ADDNEW: revert A6, page-level create control reads "+ Add New"`. What survives of the finding is the **adoption gap**: PageHeader is reached only through `PageLayout.tsx:45`, and only **10 of 113 page files** use PageLayout — CareHome, Admin, DealsPage, ContactsPage (itself retired), LookupReviewPage, HorseRecordsPage, EvaluationReportsPage, DealPage, ReviewIndexPage, NewContractPage. **94 files still contain a hand-rolled `<h1>`**, across **20 distinct className strings**. So the component is real inventory that is 9% adopted, not a missing component.
- exists: yes
- content:

Current drift census (`grep -rho '<h1 className="[^"]*"' src/pages src/components | sort | uniq -c`):
```
  27 <h1 className="font-serif text-2xl text-green-900"
  14 <h1 className="font-serif text-2xl text-green-900 mb-1"
  12 <h1 className="heading-section text-green-800 mb-4"
   9 <h1 className="heading-section text-green-800 mb-3"
   8 <h1 className="heading-section text-green-800"
   5 <h1 className="heading-section text-green-800 mb-8"
   4 <h1 className="heading-section text-green-800 mb-2"
   4 <h1 className="font-serif text-green-800 text-3xl font-semibold mt-0.5"
   2 <h1 className="font-serif text-xl text-green-800 mb-2"
   2 <h1 className="font-serif text-green-800 text-xl"
   1 <h1 className="qs-rise qs-delay-2 heading-display text-white leading-[1.08] tracking-[-0.01em] [text-wrap:balance] [overflow-wrap:break-word] text-[clamp(1.9rem,5vw,3.75rem)] [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]"
   1 <h1 className="heading-section text-white mb-4"
   1 <h1 className="heading-section text-green-800 mb-6"
   1 <h1 className="heading-section text-green-800 mb-6 flex items-center gap-2"
   1 <h1 className="heading-section text-green-800 mb-10"
   1 <h1 className="heading-section text-green-800 max-w-xl mx-auto mb-6"
   1 <h1 className="heading-display text-white text-[clamp(2.5rem,6vw,4.5rem)]"
   1 <h1 className="heading-display text-white mb-8 text-[clamp(2rem,5vw,3rem)]"
   1 <h1 className="heading-display text-white mb-4 text-[clamp(2rem,5vw,3rem)]"
   1 <h1 className="heading-display text-green-900 text-[clamp(2.5rem,6vw,4.5rem)]"
```

Real hand-rolled examples, each a different variant:
```
src/pages/app/HorsePage.tsx:111            <h1 className="font-serif text-2xl text-green-900">{name}</h1>
src/pages/app/HorseIntakePage.tsx:64       <h1 className="font-serif text-2xl text-green-900 mb-1">
src/pages/app/AcquisitionIntakePage.tsx:80 <h1 className="font-serif text-2xl text-green-900 mb-1">{title}</h1>
src/pages/app/CalendarPage.tsx:221         <h1 className="font-serif text-2xl text-green-900 inline-flex items-center gap-2">
src/pages/OrderDetail.tsx:56               <h1 className="heading-section text-green-800 mb-4">We couldn’t find that order</h1>
src/pages/Release.tsx:225                  <h1 className="heading-section text-green-800 mb-4">Stable rules and liability release.</h1>
```

The component nobody adopted (src/components/app/PageHeader.tsx:59-105), including the owner's own layout ruling in its header comment:
```tsx
/**
 * PAGE HEADER — the one placement, owner 2026-08-08 (A5/A6/A7).
 *
 * The owner's report: "the add-new button sits at a different height on every
 * page — new deal higher than new contract, lower than new horse." Ten pages had
 * hand-rolled this row, so they drifted. This is that row, once.
 *
 * THE ORDER, owner's words: "the top right corner is where the + button goes,
 * the page name is bottom aligned with that button, and the page title is below
 * those, and the description is below that."
 *
 *     ┌──────────────────────────────────────────────┐
 *     │ PAGE NAME (gold eyebrow) ............   [ + ]│  ← bottoms aligned
 *     │ Page title, large and green                  │
 *     │ Description, one size down                   │
 *     └──────────────────────────────────────────────┘
 */
export function PageHeader({ name, title, description, onAdd, addLabel }: { … }) {
  return (
    <header className="mb-8">
      <div className="flex items-end justify-between gap-4 min-h-[40px] mb-3">
        <p className="eyebrow">{name}</p>
        {onAdd && (
          <button type="button" onClick={onAdd}
            aria-label={addLabel ? `Add New ${addLabel}` : undefined}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
            <Plus size={16} aria-hidden="true" />
            Add New
          </button>
        )}
      </div>
      {title && <h1 className="heading-section text-green-800">{title}</h1>}
      {description && (
        <p className={`body-text text-muted max-w-2xl ${title ? 'mt-3' : ''}`}>{description}</p>
      )}
    </header>
  );
}
```

---

## /app/stable + StableSection (src/pages/app/Stable.tsx, src/components/app/StableSection.tsx) — REPORT IS STALE
- reported by: TASK-ACCOUNTSURFACE-PHASE1.md
- reachability: **Not dark. The claim is superseded.** Phase 1 reported "No /app/stable route exists yet." Phase 2 shipped it: the route is registered at `src/App.tsx:253` (`<Route path="stable" element={<Stable />} />`), and it is in the nav — `AppLayout.tsx:444` `{ key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' }` in PRESENCE_LINKS, with the old `section` marker deliberately dropped so active-state highlighting works. `AccountHub.tsx:97` now redirects `?section=stable` to the real route. The one live gate is presence: `my_nav_presence()` sets `stable` from `EXISTS (SELECT 1 FROM my_stable_horses())`, so the nav link is hidden for a member with no horses — the page itself is still reachable by URL.
- exists: yes
- content:

Route + nav registration:
```
src/App.tsx:250   {/* TASK-ACCOUNTSURFACE §2 (2026-08-07): My Stable's real route —
src/App.tsx:251       it previously only existed as /app/account?section=stable, */}
src/App.tsx:253   <Route path="stable" element={<Stable />} />

src/components/app/AppLayout.tsx:444
  { key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' },
```

The page (src/pages/app/Stable.tsx, whole file):
```tsx
export default function Stable() {
  useDocumentTitle('My Stable');
  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My Stable</p>
      <h1 className="heading-section text-green-800 mb-2">Your horses, gear, and supplies.</h1>
      <p className="body-text text-sm text-muted mb-8">Everything you keep here — manage your horses, gear, and supplies, and add new ones any time.</p>
      <StableSection />
    </div>
  );
}
```

The shared body (src/components/app/StableSection.tsx, 147 lines) — three labelled bands, each with its own add control:
```tsx
  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>Horses</SectionLabel>
        <PageCreateButton label="Horse" onClick={() => setModal('horse')} />
      </div>
      <div className="flex flex-col gap-2.5">
        {showHorses.map((h) => (
          <Link key={h.id} to={`/app/horses/${h.id}`} className="block bg-white …">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-green-50 to-gold-50 shrink-0" />
              <div className="min-w-0">
                <p className="font-serif text-green-800 text-lg font-semibold leading-tight">
                  {h.name}{h.barnName && <span className="text-muted font-sans text-sm font-normal"> · "{h.barnName}"</span>}
                </p>
                <p className="text-[11.5px] text-muted">{[h.breed, h.sex, h.height, h.age, h.color].filter(Boolean).join(' · ')}</p>
                <p className="text-[11px] text-gold-800 font-semibold mt-0.5">{[h.ownership, h.discipline, h.location].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <SectionLabel>Gear</SectionLabel>
      … each gear row: name, detail, and a vendor link ("<ExternalLink/> {g.vendor}") …
        <button type="button" onClick={() => setModal('gear')} className="text-[12px] text-gold-800 font-semibold text-left px-1">+ Add gear</button>

      <SectionLabel>Supplies</SectionLabel>
      … same shape, "+ Add supply" …
```
Ownership copy is computed, not stored: `h.ownership === 'leased' ? (h.lease_end ? \`Leased through ${fmtDate(h.lease_end)}\` : 'Leased') : 'Owned'`.

---

## CardstockHeader.tsx + header-cardstock.css — DELETED, shelved intact (docs/reference/shelved-cardstock-header/)
- reported by: TASK-MOBILEPASS-REPORT.md
- reachability: deleted from `src/`, so nothing can import them. Verified: `grep -rn "CardstockHeader\|header-cardstock" src/` returns nothing; the ONEHEADER commit message records "cs-hdrwrap / cs-emboss / cs-tab / cs-drawer-tab / header-stock: 0 hits in dist CSS". Backups are present and readable: `CardstockHeader.tsx.txt` (154 lines, 8,434 B), `header-cardstock.css.txt` (532 lines, 27,066 B), `README.md` (2,516 B). The texture asset `public/header-stock.jpg` (493 KB) was **left in place**, so the restore is genuinely two file copies.
- exists: deleted in `ff10e1d fix(mobilepass): correct stale scrim comment, delete dead cardstock files` (−154 / −532 lines)
- content:

The shelving note, verbatim (docs/reference/shelved-cardstock-header/README.md) — this contains the owner's own words and the measured reason it cannot come back alone:
```markdown
# Shelved: the cardstock header

**Shelved 2026-08-08, not deleted.** Owner: *"the green header is cool and I love it but it's
got to go. We can save it for another time when we can colour-match the entire site to it."*

## To restore
1. Copy both files back, dropping the `.txt` suffix.
2. Confirm `header-cardstock.css` is imported (it was imported from `AppLayout.tsx`).
3. Check `--cs-hdr-h` still matches what the rails, contract subheader and drawer tab expect
   — they read it for their sticky offsets.
That is the whole restore. Nothing else was entangled with it.

## Why it was shelved
**The app was two backdrops.** A dark cardstock header above a near-white page meant the
translucent nav panel composited against both at once, and no single label colour is legible
across both. Measured:

    green-800/20 over the cream page   -> #c8cac0   hue  73deg   (yellow-green)
    green-800/20 over the dark header  -> #1a2d23   hue 147deg   (green)

**The page is warm (hue 37°), so mixing green into it rotates the hue 72° toward yellow.**
That is why the nav read as washed out — not paleness, a different colour.

## What is genuinely good here and should not be lost
The wordmark, monogram and avatar are **debossed relief** — layered `text-shadow` carving the
letters into the stock texture, with the avatar pressing on hover and click. It was tuned
over several sessions (the "5c" shadow values, the press depth, the ~36px threshold below
which relief stops resolving on mobile).
**Relief needs a mid-tone surface to carve into.** … If this returns, it returns whole.
```

The component's render (CardstockHeader.tsx.txt:58-120):
```tsx
  return (
    <div className="cs-hdrwrap">
      {/* Filter/clip/gradient defs for the avatar well. A native feGaussianBlur
          is used because iOS ignores CSS filter:blur() on SVG children. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="csWallBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          {/* keeps the blurred wall strictly inside the struck rim */}
          <clipPath id="csWellClip"><circle cx="25" cy="25" r="22.2" /></clipPath>
          {/* same clip, redrawn for the 42-unit avatar (≤410px) — cx/cy/r
              scaled ×42/50, not the 50-unit circle resized */}
          <clipPath id="csWellClip42"><circle cx="21" cy="21" r="18.65" /></clipPath>
          {/* Light comes from above, so the top wall casts and the bottom barely
              does. Faint on purpose: a diffuse shadow that gains REACH as the
              button sinks, not a fill that switches on. */}
          <linearGradient id="csWallFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity=".30" />
            <stop offset="45%" stopColor="#000" stopOpacity=".16" />
            <stop offset="75%" stopColor="#000" stopOpacity=".06" />
            <stop offset="100%" stopColor="#000" stopOpacity=".02" />
          </linearGradient>
        </defs>
      </svg>

      <header className="cs-hdr">
        <div className="cs-left">
          <Link to="/app" className="cs-homelink" aria-label="French Heritage Equestrian — home">
            <span className="cs-mark cs-logo">
              <svg className="cs-mark-lg" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE} />
                <path className="cs-ring" d={SQUIRCLE} />
              </svg>
              {/* TASK-BP410: redrawn at 48 units, not the 56-unit mark resized */}
              <svg className="cs-mark-sm" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE_48} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE_48} />
                <path className="cs-ring" d={SQUIRCLE_48} />
              </svg>
              <span className="cs-glyph cs-fh cs-emboss">FH</span>
            </span>
          </Link>
        </div>

        {/* The wordmark's own text is its accessible name, so it needs no label. */}
        <Link to="/app" className="cs-wordmark cs-emboss">
          <span className="cs-long">French Heritage Equestrian</span>
          <span className="cs-short">French Heritage</span>
        </Link>

        <div className="cs-right">
          {/* ONEMENU (owner ruling 2026-08-07): decorative monogram only — no
              button, no click handler, no press/hover class, no ARIA control
              semantics. … the account link now lives in the nav. */}
          <span className="cs-mark cs-avatar" aria-hidden="true">
            <svg className="cs-mark-lg" viewBox="0 0 50 50" width="50" height="50" focusable="false">
              <g clipPath="url(#csWellClip)">
                <circle className="cs-ring-wall" cx="25" cy="24.4" r="21.8" />
```

---

## The floating drawer tab (deleted from AppLayout.tsx; CSS rides out with the shelved cardstock stylesheet)
- reported by: TASK-MOBILEPASS-REPORT.md
- reachability: gone from the tree. The only trace is a tombstone comment at `src/components/app/AppLayout.tsx:2061`. The `.cs-drawer-tab` rules survive only inside the shelved `docs/reference/shelved-cardstock-header/header-cardstock.css.txt:353-388`, which is not imported by anything.
- exists: deleted in `eaab867 ONEHEADER: adopt the login header, drop the glass, delete the drawer tab`
- content:

The tombstone that replaced it (AppLayout.tsx:2061-2074):
```tsx
      {/* THE DRAWER TAB IS GONE — ONEHEADER §3 (owner, 2026-08-08). No hanging
          tab: the header's avatar button is the way into the nav on a phone, so
          there is one control for one job instead of a tab bolted to the side of
          the viewport. The `.cs-drawer-tab` rules ride out with the shelved
          cardstock stylesheet, which is no longer imported.

          Sequencing held, per the task doc: the tab was the ONLY way into the
          nav on mobile, so it could not go until the avatar button existed. It
          does — see AppHeader above, and note it drives this same
          `mobileNavOpen` state, so the two can no more desync than the tab
          could.

          Superadmin never had the tab; it keeps its own mobile nav button and
          its own drawer anchor — see the `isSuperAdmin` checks below. */}
```

The deleted JSX, recovered from `git show eaab867`:
```tsx
-          Tab and drawer are driven from the single `mobileNavOpen` state, so
-          they cannot desync: the tab's position, its arrow, its labels and the
-          drawer are all one boolean. Every close path already routes through
-          that state — the scrim's onClick, the Escape handler and the
-          route-change effect above, and a selection inside the drawer.
-
-          Superadmin does not get it (it keeps its own mobile nav button,
-          unchanged, and its own drawer anchor — see the `isSuperAdmin` check
-          on the `<nav>` below); the CSS also hides it at lg+, where the rail
-          is the nav. */}
-      {!isSuperAdmin && (
-        <button
-          type="button"
-          className={`cs-drawer-tab${mobileNavOpen ? ' is-open' : ''}`}
-          onClick={() => setMobileNavOpen((v) => !v)}
-          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
-          aria-expanded={mobileNavOpen}
-        >
-          <ChevronLeft size={20} aria-hidden="true" strokeWidth={2.25} />
-        </button>
-      )}
```

Its styling, still sitting in the shelved stylesheet (header-cardstock.css.txt:353-388) — note the recorded field failure that drove its design:
```css
.cs-drawer-tab {
  /* Owner, 2026-08-08. Two changes, both from a real user failing to find this.

     SOLID, NOT GLASS. It previously used NAV_GLASS. On an older iPhone the
     broken @supports test (fixed in 628079a) resolved that to a SOLID CREAM
     panel — a cream tab on a cream page, invisible. Sarah could not find the
     menu. A tab is a CONTROL, not a surface: it has to be found, so it now
     carries the brand green at full opacity with a cream chevron.

     BIGGER. 34x46 -> 40x52, clearing the 44px touch guideline on both axes
     with drawn pixels rather than an invisible pseudo-element. */
  position: fixed;
  right: env(safe-area-inset-right, 0px);
  top: calc(var(--cs-hdr-h) + 24px);
  z-index: 45;                       /* BELOW the drawer (z-50), not above it */
  width: 40px; height: 52px; border: 0; cursor: pointer;
  display: grid; place-items: center;
  border-radius: 12px 0 0 12px;
  background: #143321;
  color: #f5f0e8;
  box-shadow: 0 1px 2px rgba(16,28,22,.18), 0 6px 16px rgba(16,28,22,.22);
  transition: opacity .22s ease;
}
/* Owner: rather than fix the tab and drawer travelling at different speeds, do
   not make the tab travel at all. It fades out on open and back in on close, so
   there is no motion to synchronise — the mismatch is removed at the source
   instead of tuned. */
.cs-drawer-tab.is-open { opacity: 0; pointer-events: none; }
@media (min-width: 1024px) { .cs-drawer-tab { display: none; } }
```

---

## No notification surface, no bell — 45 notifications behind one nav badge (AppLayout.tsx NAV_BADGE, DashboardPanel.tsx)
- reported by: TASK-MOBILEPASS-REPORT.md
- reachability: VERIFIED — `grep -n "Bell" src/components/app/AppLayout.tsx src/components/app/AppHeader.tsx` returns **nothing**; there is no bell icon and no notifications route. The entire surface is (a) a count badge on the Dashboard nav link and (b) "Needs your attention" tiles inside DashboardPanel. Note the badge is not even notifications alone: `AppLayout.tsx:1519` sums it with the staff inbound-request count.
- exists: yes
- content:

The whole visible surface (AppLayout.tsx):
```tsx
257:  const NAV_BADGE = 'bg-gold-500 text-green-950';

823:  <span className={`absolute -top-1.5 -right-1.5 min-w-[1rem] h-4 px-1 ${NAV_BADGE} … text-[10px] leading-4 text-center rounded-full`}>{badge > 9 ? '9+' : badge}</span>
836:  <span className={`min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full ${NAV_BADGE} …`}>{badge > 9 ? '9+' : badge}</span>

1511: // just move house, it SUMS into Dashboard's: myUnreadCount() (unreadCount,
1519: items: g.items.map((it) => (it.to === '/app/dashboard' ? { ...it, badge: unreadCount + inboundCount } : it)),
```

The tiles (src/components/app/DashboardPanel.tsx) — and note the dismissal semantics:
```tsx
 32: *   "Needs your attention" — unread notifications (each links to its target) and
244:      myNotifications().catch(() => [] as AppNotification[]),
259:      // ── needs attention: unread notifications (linked, dismissable) ──
260:      // Welcome greetings ("[member] said hi") appear here like any notification, but
268:      const att: Tile[] = notifications
274:            id: `n-${n.id}`, notificationId: n.id, kind: n.kind.replace(/_/g, ' '), title: n.title,

348:  // Close a notification tile. A manual close CONSUMES it — deletes the
349:  // notification (per-user) and leaves an audit-log entry — so it's gone for good
353:  function dismiss(notificationId: string, opts?: { silent?: boolean }) {
355:      markNotificationRead(notificationId).catch(() => {});
358:    consumeNotification(notificationId).catch(() => {});
```

What is actually flowing into this thin surface, from prod:
```
notifications: 45 total, 42 unread

kind             | title                                                                                       | created_at
-----------------+---------------------------------------------------------------------------------------------+---------------------------
request_new      | New inquiry from Kylie Pinion                                                               | 2026-08-12 14:47:28+00
purchase_unpaid  | Training Session — awaiting payment ($95.00)                                                | 2026-08-10 18:41:28+00
purchase_unpaid  | Single Lesson, Training Session — awaiting payment ($245.00)                                | 2026-08-10 18:41:28+00
purchase_unpaid  | Single Lesson — awaiting payment ($150.00)                                                  | 2026-08-10 18:41:28+00
party_signed     | Horse Emergency Veterinary Authorization — fully executed; signed by Claire Bourdon (CLIENT)| 2026-08-10 16:43:25+00
party_signed     | Human Emergency Medical Authorization v2 — fully executed; signed by Claire Bourdon (CLIENT)| 2026-08-10 16:43:12+00

(columns: id, org_id, user_id, kind, title, body, link, read_at, created_at, emailed_at — `body` is NULL on every row above)
```

---

## seed.ts — the switched-off preview content (src/lib/seed.ts, 270 lines)
- reported by: TASK-FACILITYTERM-REPORT.md
- reachability: VERIFIED — `export const SEED_ENABLED = false;` at `src/lib/seed.ts:10`. Every consumer guards on it (`SEED_ENABLED ? SEED_X : []`). `FEED_VIEW_META` is the exception: it is not seed data at all but the live per-view header copy, imported unconditionally by AppLayout's COMMUNITY_VIEWS and by the feed page headers.
- exists: yes
- content:

The file's own instruction to delete it (lines 1-10):
```ts
/* Preview seed data (temporary). Gives every surface something to render on the
 * GitHub preview before the RPCs/migrations are wired end-to-end. All exports are
 * plain data; pages import these as a fallback when a live query returns empty.
 * DELETE THIS FILE once the backing RPCs return real rows. Nothing here writes to
 * the database — it is display-only sample content.
 *
 * A single flag (SEED_ENABLED) gates all fallbacks so this can be turned off in one
 * place. It is on by default for the preview. */

export const SEED_ENABLED = false;
```
(Note the comment's last sentence — "It is on by default for the preview" — is now false.)

FEED_VIEW_META, which DOES render — this is live product copy sitting in a file marked for deletion (lines 34-43):
```ts
export const FEED_VIEW_META: Record<FeedView, { title: string; navLabel: string; description: string }> = {
  all:         { title: 'Community Feed', navLabel: 'All posts',   description: 'A place to welcome new members, share your experiences or views from around the stables, and helpful links, tack, or gear you no longer use that others may need' },
  social:      { title: 'Social',         navLabel: 'Social',      description: 'Photos, updates, and moments members are sharing.' },
  discussions: { title: 'Discussions',    navLabel: 'Discussions', description: 'Questions and conversations — jump in or start your own.' },
  for_sale:    { title: 'For Sale',       navLabel: 'For Sale',    description: 'Horses and gear listed by the ranch and members.' },
  events:      { title: 'Events',         navLabel: 'Events',      description: 'Clinics, shows, and gatherings — RSVP to save your spot.' },
  articles:    { title: 'Articles',       navLabel: 'Articles',    description: 'Guides and reading from French Heritage.' },
  resources:   { title: 'Resources',      navLabel: 'Resources',   description: 'Trusted vets, farriers, and suppliers members recommend.' },
  members:     { title: 'Members',        navLabel: 'Members',     description: 'Meet the community — say hi, or send a message.' },
};
```

A representative slice of the placeholder content that is switched OFF (feed, listings, articles, members, resources, dashboard, calendar, stable, account, saved, documents, instructor sessions):
```ts
export const SEED_FEED: SeedFeedItem[] = [
  { id: 'f1', kind: 'for_sale', view: 'for_sale', saleKind: 'horse', saleTag: 'Lease', price: 'Inquire',
    author: 'French Heritage', … title: 'Bruno — 16.1hh Warmblood', body: 'A generous, push-ride hunter with an even temperament.' },
  { id: 'f3', kind: 'discussion', … title: 'Best farrier in North County?', body: 'Looking for recommendations for my new mare…', replies: 4 },
  { id: 'f4', kind: 'social', author: 'Sofia R.', … body: 'Golden hour hack down to the beach. Never gets old.' },
  { id: 'f5', kind: 'article', … title: 'Preparing for your first show', body: 'What to pack, when to arrive, and how to keep your nerves in check.', audience: 'New riders', readMins: 6 },
  { id: 'f7', kind: 'event', … title: 'Summer schooling show', body: 'Open to all levels. Ribbons through 6th.', when: 'Jul 14 · 9:00 AM' },
  { id: 'f8', kind: 'social', author: 'Margaux C.', … body: 'First clean round over 1.10m today. Over the moon with this horse.' },
  { id: 'f9', kind: 'discussion', … title: 'Clipping tips for a nervous gelding?', body: 'He is fine until the clippers get near his ears…', replies: 7 },
];

export const SEED_ARTICLES: SeedArticle[] = [
  { id: 'a1', title: 'Preparing for your first schooling show', excerpt: 'What to pack, when to arrive, and how to keep your nerves in check on the day.', audience: 'New riders', mins: 6 },
  { id: 'a2', title: 'Building an independent seat', excerpt: 'Exercises to develop balance without relying on the reins.', audience: 'General', mins: 4 },
  { id: 'a3', title: 'Reading a course walk like a pro', excerpt: 'Striding, related distances, and where the time faults hide.', audience: 'Competition riders', mins: 8 },
  { id: 'a4', title: 'Winter turnout and blanketing', excerpt: 'A simple decision guide for coastal California owners.', audience: 'Horse owners', mins: 5 },
];

export const SEED_RESOURCES: SeedResource[] = [
  { id: 'r1', name: 'Coastal Equine Vet', category: 'Vets', note: 'Full-service equine care · Encinitas', … },
  { id: 'r2', name: 'North County Farrier Co.', category: 'Farriers', note: 'Hot & cold shoeing · corrective work', … },
  { id: 'r3', name: 'Del Mar Feed & Tack', category: 'Suppliers', note: 'Feed, supplements, tack · local pickup', … },
  { id: 'r4', name: 'Pacific Mobile Dentistry', category: 'Vets', note: 'Equine dental floats · mobile', … },
];

export const SEED_ATTENTION: SeedActionTile[] = [
  { id: 't1', kind: 'Approved · action', title: 'Lessons confirmed', sub: 'Sign & pay before the hold releases', cta: 'Complete', gold: true },
  { id: 't2', kind: 'Payment · 3 days', title: 'Membership renews Thu', sub: 'Review or update your method', cta: 'Review', gold: true },
  { id: 't3', kind: 'Invitation', title: 'Summer barn dinner', sub: 'Jul 20 · awaiting RSVP', cta: 'RSVP', gold: true },
];

export const SEED_CALENDAR: SeedCalItem[] = [
  { id: 'k1', date: dateIn(0),  kind: 'lesson',       title: 'Lesson with Élise',       sub: '4:00 PM · Carmel Creek' },
  { id: 'k2', date: dateIn(1),  kind: 'payment',      title: 'Membership renews',       sub: '$340 · Zelle on file' },
  { id: 'k3', date: dateIn(3),  kind: 'expiration',   title: 'Lesson hold releases',    sub: 'Sign & pay to keep your slot' },
  { id: 'k4', date: dateIn(5),  kind: 'event',        title: 'Summer schooling show',   sub: '9:00 AM · open to all levels' },
  { id: 'k5', date: dateIn(7),  kind: 'confirmation', title: 'Evaluation confirmed',    sub: 'Bruno · in-hand assessment' },
  { id: 'k6', date: dateIn(11), kind: 'event',        title: 'Summer barn dinner',      sub: '6:30 PM · RSVP requested' },
  { id: 'k7', date: dateIn(14), kind: 'payment',      title: 'Lesson package due',      sub: '$600 · 8-ride package' },
];
```

The seed file also carries two **full fake legal documents** (SEED_DOCUMENTS), which is worth the owner's eye given the app's real contract engine:
```
'RELEASE OF LIABILITY, WAIVER OF CLAIMS, AND ASSUMPTION OF RISK

In consideration of being permitted to participate in equestrian activities provided by French Heritage Equestrian ("the Company"), the undersigned participant acknowledges and agrees to the following terms.

1. ASSUMPTION OF RISK. The participant understands that horseback riding and related equestrian activities carry inherent risks, including but not limited to the unpredictable behavior of horses, falls, and contact with animals, equipment, and terrain. …

2. RELEASE. The participant releases the Company, its owners, instructors, and agents from any and all claims arising from participation in equestrian activities, except those arising from gross negligence, reckless conduct, or intentional misconduct.

3. DISPUTE RESOLUTION. Any dispute shall be resolved through binding arbitration administered under the applicable JAMS/AAA rules, with the Company bearing arbitration fees above the equivalent court filing fee, and each party bearing its own attorney's fees.'
```

---

## Sales financials backend — 8 objects written, never applied (supabase/migrations/20260726090000_biz_expenses_and_financials.sql, 315 lines)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: VERIFIED AND STILL TRUE. Queried prod `pg_proc` / `pg_views` / `pg_tables` for all eight names plus the two backing tables — **zero rows returned**. Nothing from this migration exists in the database. `grep -rn "sales_summary\|business_kpis\|growth_summary\|profit_and_loss\|upsert_expense\|list_expenses\|expense_categories_list" src/ api/` also returns **nothing**. So: unapplied AND unreferenced. (All eight are FUNCTIONS returning jsonb, not views as the report's phrasing implies.)
- exists: yes (file present, 315 lines)
- content:

The header's own statement of intent:
```sql
-- Admin business suite — expense model + financial rollup RPCs.
--
-- Everything reads LIVE data: sales/P&L aggregate the real purchases +
-- board_charges; growth reads real contacts/clients/memberships; the KPI tiles
-- pull the same. Expenses are the one greenfield piece (new tables). All rollups
-- are org-scoped + staff-gated and degrade to zeroes on an empty period (the
-- data is sparse today; these must populate correctly as real rows land).
```

The chart of accounts it would seed (13 categories, each mapped to a tax bucket):
```sql
INSERT INTO public.expense_categories (org_id, code, name, tax_bucket, sort_order)
SELECT o.id, c.code, c.name, c.tax_bucket, c.sort_order
  FROM public.organizations o
  CROSS JOIN (VALUES
    ('FEED',        'Feed & Hay',              'Supplies',            10),
    ('VET',         'Veterinary & Medical',    'Contract labor',      20),
    ('FARRIER',     'Farrier',                 'Contract labor',      30),
    ('SUPPLIES',    'Barn Supplies & Equipment','Supplies',           40),
    ('FACILITY',    'Facility & Rent',         'Rent/lease',          50),
    ('UTILITIES',   'Utilities',               'Utilities',           60),
    ('INSURANCE',   'Insurance',               'Insurance',           70),
    ('PAYROLL',     'Labor & Contractors',     'Wages',               80),
    ('MARKETING',   'Marketing & Advertising', 'Advertising',         90),
    ('TRANSPORT',   'Transport & Fuel',        'Car & truck',        100),
    ('SOFTWARE',    'Software & Subscriptions','Other',              110),
    ('FEES',        'Bank & Processing Fees',  'Other',              120),
    ('OTHER',       'Other',                   'Other',              130)
  ) AS c(code, name, tax_bucket, sort_order)
ON CONFLICT (org_id, code) DO NOTHING;
```

`sales_summary(p_from, p_to, p_grain)` — totals, a time series, and a payment-method split:
```sql
CREATE OR REPLACE FUNCTION public.sales_summary(
  p_from date DEFAULT (current_date - 30), p_to date DEFAULT current_date, p_grain text DEFAULT 'day')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  SELECT jsonb_build_object(
    'orders', count(*),
    'gross_booked', coalesce(sum(amount),0),
    'collected', coalesce(sum(amount_paid),0),
    'outstanding', coalesce(sum(greatest(amount - coalesce(amount_paid,0),0)),0),
    'paid_orders', count(*) FILTER (WHERE payment_status = 'paid'))
  INTO v_totals
  FROM purchases
  WHERE org_id = v_org AND deleted_at IS NULL AND coalesce(status,'') <> 'void'
    AND created_at::date BETWEEN p_from AND p_to;

  -- per-bucket series (day | week | month)
  SELECT date_trunc(v_trunc, created_at)::date AS bucket, count(*) AS orders,
         sum(amount) AS booked, sum(amount_paid) AS collected  … GROUP BY 1

  -- by payment method
  SELECT coalesce(payment_method,'—') AS method, count(*) AS orders, sum(amount_paid) AS collected … GROUP BY 1

  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'grain', v_trunc,
    'totals', v_totals, 'series', v_series, 'by_method', v_by_method);
END; $function$;
```

`profit_and_loss(p_from, p_to)` — revenue from purchases + board_charges, less expenses, broken out by category:
```sql
  SELECT coalesce(sum(amount_paid),0) INTO v_purch FROM purchases
   WHERE org_id=v_org AND deleted_at IS NULL AND coalesce(status,'')<>'void'
     AND coalesce(paid_at, created_at)::date BETWEEN p_from AND p_to;
  SELECT coalesce(sum(amount),0) INTO v_board FROM board_charges …;
  SELECT coalesce(sum(amount),0) INTO v_exp   FROM expenses …;

  SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.total DESC), '[]'::jsonb) INTO v_by_cat FROM (
    SELECT coalesce(ec.name,'Uncategorized') AS category, coalesce(ec.tax_bucket,'Other') AS tax_bucket,
           sum(e.amount) AS total
    FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE … GROUP BY 1,2) c;

  RETURN jsonb_build_object('from', p_from, 'to', p_to,
    'revenue',  jsonb_build_object('purchases', v_purch, 'boarding', v_board, 'total', v_purch + v_board),
    'expenses', jsonb_build_object('total', v_exp, 'by_category', v_by_cat),
    'net', (v_purch + v_board) - v_exp);
```

`growth_summary(...)` — new contacts per period plus an MRR calculation with a documented correction:
```sql
  -- MRR: the MONTHLY value of currently-active recurring subscriptions —
  -- per-item monthly price (recurring items are priced price_unit='month')
  -- times quantity, over PAID recurring purchases whose last payment is
  -- recent enough to still be live (35-day window covers a monthly cadence
  -- with grace). The prior version summed purchases.amount over ALL
  -- recurring purchases ever, unwindowed and unnormalised — a lifetime
  -- total mislabelled "monthly".
  SELECT coalesce(sum(pi.price_amount * coalesce(pi.quantity,1)),0) INTO v_mrr
    FROM purchases p JOIN purchase_items pi ON pi.purchase_id=p.id JOIN offerings o ON o.id=pi.offering_id
   WHERE p.org_id=v_org AND p.deleted_at IS NULL AND p.status='paid'
     AND o.config_kind='recurring'
     AND coalesce(p.paid_at, p.created_at) >= current_date - 35;

  'active_memberships', (
      -- paying-member proxy, NOT activated accounts: non-staff members only.
      -- The prior count included staff profiles (every activated account).
      SELECT count(*) FROM memberships m JOIN profiles pr ON pr.user_id=m.user_id
       WHERE m.status='active' AND coalesce(pr.role,'USER')='USER'
         AND NOT coalesce(pr.is_admin,false)),
```

`business_kpis()` — the six headline dashboard tiles:
```sql
  RETURN jsonb_build_object(
    'mtd_revenue',        (… sum(amount_paid) FROM purchases … coalesce(paid_at,created_at)::date >= v_mstart),
    'mtd_expenses',       (… sum(amount)      FROM expenses  … incurred_on >= v_mstart),
    'outstanding',        (… sum(greatest(amount-coalesce(amount_paid,0),0)) FROM purchases …),
    'mtd_new_clients',    (… count(*) FROM contacts … created_at::date >= v_mstart),
    'active_memberships', (… non-staff active memberships …),
    'open_orders',        (… count(*) FROM purchases WHERE status IN ('draft','awaiting_payment'))
  );
```

---

## renderTemplate() — dead email registry still holding forbidden welcome + dunning copy (api/_lib/email.ts:257-290)
- reported by: TASK-EMAILEXTRACT-REPORT.md
- reachability: VERIFIED — `grep -rn "renderTemplate" src/ api/ supabase/ scripts/` returns exactly one definition and **no call site**. (The other hits are a *different* symbol, `renderTemplateString` in `api/_lib/emailTemplates.ts`, and a comment in `scripts/emailextract/diff.mjs:512`.) Its last caller, `_lib/receipt.ts` case `'receipt'`, now reads the `ORDER_RECEIPT` row out of `email_templates`.
- exists: yes
- content:

The retention notice the previous task left on it, verbatim (lines 236-256) — this is the decision record:
```ts
/**
 * DEAD AS OF TASK-EMAILEXTRACT (2026-08-12) — RETAINED, NOT DELETED.
 *
 * This was the old built-in registry. Its only live caller was `_lib/receipt.ts`
 * (case 'receipt'), which now reads the `ORDER_RECEIPT` row out of
 * `email_templates` like every other sender. Nothing calls this function today.
 *
 * ⚠️ TWO OF ITS FOUR CASES ARE D9 VIOLATIONS AND MUST NOT BE WIRED UP.
 * D9 settled that there is NO welcome email and NO dunning email, and that both
 * producers were deleted deliberately. Their TEMPLATE STRINGS survive here:
 *   'signup'  → "Welcome to {brand} — your account is ready."   ← the welcome email
 *   'dunning' → "Payment reminder / You have an outstanding balance." ← the dunning email
 * They have no producer and no caller, so nothing sends them; they are wording
 * looking for a sender. They are NOT extracted into `email_templates` — putting
 * them in a list the owner browses and publishes from is exactly how a settled
 * decision gets quietly reversed. The third dead case, 'contract_executed', was
 * superseded by DOCUMENT_PARTY_COPY (its hardcoded subject was fixed in 2026-08-02's
 * delivery work) and is likewise left alone.
 *
 * Deleting this is TASK-EMAILEXTRACT's finding to report, not its change to make.
 */
```

**Every email template it holds, complete — subject and body, verbatim** (lines 257-290):
```ts
export function renderTemplate(
  template: string,
  vars: Record<string, unknown>,
  fromName: string,
): TransactionalTemplate {
  const v = (k: string): string => (vars?.[k] == null ? '' : String(vars[k]));
  switch (template) {
    case 'signup':
      return {
        subject: `Welcome to ${fromName}`,
        body: `<p>Welcome${v('name') ? `, ${v('name')}` : ''} — your account is ready.</p>`,
      };
    case 'contract_executed':
      return {
        subject: `Your contract is executed`,
        body: `<p>Your document ${v('documentTitle') || 'contract'} has been fully executed.</p>`,
      };
    case 'receipt':
      return {
        subject: `Your receipt from ${fromName}`,
        body: `<p>We received your payment${v('amount') ? ` of ${v('amount')}` : ''}. Thank you.</p>`,
      };
    case 'dunning':
      return {
        subject: `Payment reminder`,
        body: `<p>You have an outstanding balance${v('amount') ? ` of ${v('amount')}` : ''}.</p>`,
      };
    default:
      return {
        subject: v('subject') || `A message from ${fromName}`,
        body: v('body') || `<p>${v('message')}</p>`,
      };
  }
}
```
Rendered plainly, the four subject/body pairs are:

| case | subject | body |
|---|---|---|
| `signup` | Welcome to French Heritage Equestrian | Welcome, {name} — your account is ready. |
| `contract_executed` | Your contract is executed | Your document {documentTitle} has been fully executed. |
| `receipt` | Your receipt from French Heritage Equestrian | We received your payment of {amount}. Thank you. |
| `dunning` | Payment reminder | You have an outstanding balance of {amount}. |
| *(default)* | {subject} — or "A message from {brand}" | {body} — or {message} |

The D9 decision itself, as recorded elsewhere in the tree:
```
docs/archive/PERSON_DATA_CONSOLIDATION.md:63   - `payment_reminders` — D9: no dunning email exists
docs/reports/TASK-EMAILEXTRACT-REPORT.md:106  > D9 settled that there is **no welcome email and no dunning email**, and that both producers
docs/reports/TASK-EMAILEXTRACT-REPORT.md:329  1. **🔴 D9: the welcome and dunning WORDING still exists** in `renderTemplate`
```

---

## 48 deleted DB tests across 5 files (test/db/*.test.ts)
- reported by: TASK-TESTDB-REPORT.md
- reachability: deleted outright; the subjects they exercised (`orders`, `order_items`, `transactions`, `billable_lines` settlement, `engagements`, `offering_tiers`) are retired tables/layers.
- exists: deleted in `bcda19b test(db): make the db suite actually run — 651 skipped -> 107`. Deleted line counts from that commit's stat: `client_balance_read.test.ts` −220, `client_self_signing.test.ts` −133, `e2e_payment.test.ts` −212, `purchase_catalog_matrix.test.ts` −225, `settlement_rollup.test.ts` −320. **Total −1,110 lines.**
- content:

**The test titles are the spec of the retired behaviour.** Recovered via `git show bcda19b^:<path>`:

`test/db/purchase_catalog_matrix.test.ts` (−225):
```
describe('catalog inventory')
  it('has priced tiers to exercise (the seeded catalog is non-empty)')
describe('EVERY priced catalog tier survives the full money path')
  it('finalizes each tier and auto-matches its Zelle payment by unique amount')
describe('combination carts (multi-item orders)')
  it('every adjacent pair of priced tiers totals correctly and gets a distinct key')
  it('a full mixed cart (first 5 priced tiers) finalizes with a server-recomputed total')
describe('hardcoded-value defenses')
  it('a client-tampered tier price is overridden by the server price')
  it('finalize is idempotent: re-calls keep the same amount + reference')
  it("a non-owner cannot finalize someone else's order; confirmed orders are immutable")
describe('catalog.ts ↔ offering_tiers drift guard')
  it('lesson pack prices in the frontend catalog match the DB tiers exactly')
```

`test/db/client_balance_read.test.ts` (−220):
```
describe('billable_lines: client reads own OPEN lines only')
  it('the client sees exactly their own lines (payer scoping, not client-side filtering)')
  it("another member's line is invisible to the client, and vice versa")
  it('the client cannot write lines: UPDATE is a zero-row no-op, INSERT is rejected')
describe('transactions: the payer reads their own settlement INVOICE (payer-read policy)')
  it('setup: staff settle rolls the client lines into ONE invoice with engagement_id NULL')
  it('the client reads their own invoice; another member sees nothing')
  it('the client also reads their own engagement (the grouping read the page does)')
  it('payer read grants SELECT only: the payer cannot UPDATE the invoice')
  it("cross-tenant: an org-B payer's invoice never appears for the org-A client")
describe('payments: history is owner-scoped via owns_order')
  it('a client reads payments on their OWN orders only')
  it('a client cannot write payments (server-managed)')
```

`test/db/settlement_rollup.test.ts` (−320):
```
describe('settle_billable_lines: rolls OPEN lines into one INVOICE (real RPC path)')
  it('creates ONE transactions INVOICE with amount = SUM for the correct payer + org')
  it('flips every rolled line to SETTLED and stamps it with the new transaction_id')
  it('audits the settle (audit_logs INSERT for the new transaction)')
describe('settle_billable_lines: stamps the shared engagement when all lines tie to one')
  it('sets engagement_id when EVERY rolled line ties to the same engagement')
describe('settle_billable_lines: idempotent + re-runnable')
  it('a re-run for the same payer creates NO second invoice (settled lines skipped)')
  it('a NEW open line added after settle IS rolled by a later settle (distinct invoice)')
describe('settle_billable_lines: period scoping')
  it('only rolls lines whose period is contained in the settle window')
describe('settle_billable_lines: tenant isolation')
  it('org-A settle never rolls org-B lines; org-B settle rolls only org-B lines')
describe('settle_billable_lines: only org staff may settle')
  it('a plain USER (client) is denied (has_staff_access() guard)')
describe('settle_billable_lines: rolled lines are sealed (append-only)')
  it('a line settled by the RPC cannot be un-settled or re-amounted')
```

`test/db/e2e_payment.test.ts` (−212):
```
describe('chain 3 — draft order + hold, then finalize_order_payment')
  it('the client drafts the order with a TAMPERED tier item price and holds the slot')
  it('finalize forces the SERVER tier price, recomputes totals, and mints the Zelle keys')
  it('re-finalizing is idempotent — the matching keys are assigned ONCE')
  it('a second open order at the SAME total gets a DIFFERENT unique_amount')
describe('chain 3 — the Zelle reconciler match on unique_amount')
  it("the reconciler's candidate query finds EXACTLY the one order (deterministic key)")
  it('confirm: payment row + order confirmed + confirm_booking_for_order (the reconciler writes)')
describe('chain 3 — duplicate guards')
  it('a replayed notification no longer matches (the order left awaiting_payment)')
  it('an order already carrying a confirmed payment hits the duplicate guard (no second payment)')
  it('a confirmed order can never be re-finalized')
```

`test/db/client_self_signing.test.ts` (−133):
```
describe('client-scoped reads (MyEngagements / MyEngagementDetail rely on RLS)')
  it('the member reads their own engagement, parties, and document')
  it('a stranger member reads NONE of it')
describe('record_signature caller verification')
  it("a stranger cannot sign another client's document as its party")
  it("the party's own contact self-signs their own role")
  it('the member cannot sign a role that is not theirs (COMPANY)')
  it('tenant staff still facilitate any party, and the document executes')
  it('an unauthenticated caller is still rejected outright')
```

One full deleted test body, as a sample of the depth that went (purchase_catalog_matrix.test.ts:154-170):
```ts
describe('hardcoded-value defenses', () => {
  it('a client-tampered tier price is overridden by the server price', async () => {
    await h.asUser(uid);
    const tier = tiers.find((t) => Number(t.price_amount) >= 100)!;
    const orderId = await makeOrder([
      { tier_id: tier.id, offering_id: tier.offering_id, label: tier.label, price: 1 }, // tampered
    ]);
    const { uniqueAmount } = await finalize(orderId);
    await h.asSuperuser();
    const [o] = await h.q<{ total: string }>(`select total from orders where id=$1`, [orderId]);
    expect(Number(o.total)).toBe(tier.price_amount!); // server price won
    expect(uniqueAmount).toBeGreaterThan(tier.price_amount!);
    const [item] = await h.q<{ price_amount: string }>(
      `select price_amount from order_items where order_id=$1`, [orderId]);
    expect(Number(item.price_amount)).toBe(tier.price_amount!);
  });
```

---

## DocumentsPanel + PaperViewer, removed from AccountPanels.tsx
- reported by: TASK-ACCOUNTSURFACE-REPORT.md
- reachability: removed from the file; `AccountPanels.tsx` is now 67 lines (was 198 — the report's "200" and "down from 200" are close enough). Its header comment records that they were retired as a *weaker duplicate*, not merely a smaller one.
- exists: deleted in `02efb58 TASK-ACCOUNTSURFACE Phase 2: all account rows expand in place, My Stable gets a route`
- content:

What replaced them, stated in the surviving file's header (src/components/app/AccountPanels.tsx:11-17):
```tsx
/**
 * ACCOUNT PANELS — Saved items, the one subject left here. (Gifts moved to
 * their own page; Documents moved to DocumentsContent.tsx, TASK-ACCOUNTSURFACE
 * §3 — the old DocumentsPanel/PaperViewer in this file were a WEAKER duplicate
 * of Documents.tsx, not just a smaller one, so they were retired rather than
 * kept as a second implementation. See that file's header for the reconciliation.)
 */
```

The removed `DocumentsPanel` — note it did real work (it fetched live documents and paginated their merged text into sheets), recovered from `git show 02efb58^`:
```tsx
export function DocumentsPanel() {
  const [open, setOpen] = useState<SeedDocument | null>(null);
  const [rows, setRows] = useState<SeedDocument[] | null>(null);

  // REAL documents: the member's engagement documents with their actual merged
  // text (the placeholders the panel launched with are gone — owner-reported).
  useEffect(() => {
    listMySignableDocuments()
      .then((items) => setRows(items
        .sort((a, b) => Number(b.signed) - Number(a.signed))
        .map((it) => {
          const d = it.document;
          const when = d.effective_date ?? d.generated_at ?? d.created_at;
          const body = d.merged_body ?? 'This document is being prepared.';
          // paginate the real text into readable sheets
          const paras = body.split(/\n\n+/);
          const pages: string[] = [];
          let cur = '';
          for (const para of paras) {
            if (cur && (cur.length + para.length) > 2400) { pages.push(cur); cur = para; }
            else cur = cur ? cur + '\n\n' + para : para;
          }
          if (cur) pages.push(cur);
          return {
            id: d.id,
            title: d.title ?? 'Document',
            kind: d.status === 'EXECUTED' ? 'Signed' : 'Awaiting signature',
            signedOn: `${it.signed ? 'Signed' : 'Generated'} ${new Date(when).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`,
            pages: pages.length ? pages : [body],
            body,
          };
        })))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="mt-2.5 mb-1 p-4 bg-cream-100/60 border border-green-800/10 rounded-xl">
      {rows === null && <p className="text-sm text-muted px-1 py-2">Loading your documents…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="text-sm text-muted px-1 py-2">No documents yet — agreements you sign will live here.</p>
      )}
      … each row: FileText tile, title, "{kind} · {signedOn}", chevron …
      {open && <PaperViewer doc={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The document rendered as PAPER: a page with drop shadow, subtle edges, and page
 *  breaks. Slightly narrower than the sheet so scrolling reads as moving down a
 *  document. Overlay so it feels like opening the physical document. */
function PaperViewer({ doc, onClose }: { doc: SeedDocument; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const total = doc.pages.length;
  return (
    <div className="fixed inset-0 bg-green-950/50 backdrop-blur-[2px] z-[70] flex flex-col" onClick={onClose}>
      {/* top bar */}
      <div className="flex items-center justify-between px-4 h-14 bg-white/95 border-b border-green-800/10 shrink-0" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0">
          <p className="font-serif text-green-800 text-[15px] font-semibold truncate">{doc.title}</p>
          <p className="text-[11px] text-muted">{doc.signedOn}</p>
        </div>
        …
```

All that remains in the file (SavedPanel, 67 lines total) — and it always renders its empty state, because `SEED_ENABLED` is false and there is no real saved-items model:
```tsx
export function SavedPanel() {
  // I2 fix (found during nav-presence verification): this unconditionally
  // rendered SEED_SAVED regardless of SEED_ENABLED, showing the same 4 fake
  // items to every real account — the only seed section that skipped the
  // gate every other one (e.g. StableSection) applies. There is no real
  // saved/bookmark data model yet (tracked separately); until there is, this
  // always renders empty, matching my_nav_presence()'s saved=false.
  const items = SEED_ENABLED ? SEED_SAVED : [];
  if (items.length === 0) {
    return (
      <div className="mt-2.5 mb-1 p-8 bg-cream-100/60 border border-green-800/10 rounded-xl text-center">
        <BookmarkX size={26} className="text-muted mx-auto mb-2" />
        <p className="font-serif text-green-800">Nothing saved yet</p>
        <p className="text-[12px] text-muted mt-1">Bookmark articles, listings, and links to find them here.</p>
      </div>
    );
  }
  … (the populated branch, unreachable today: icon tile, title, sub, ExternalLink or chevron)
}
```

---

## PRESENCE_LINKS / MenuLink / accountMenu — the superadmin-only avatar dropdown (src/components/app/AppLayout.tsx)
- reported by: TASK-ONEMENU-REPORT.md
- reachability: VERIFIED, both halves.
  1. **`accountMenu` renders only for superadmin.** It is built at `AppLayout.tsx:1633` but placed in exactly one spot, `line 1803`, inside the `{isSuperAdmin ? ( … ) : ( … )}` branch that begins at `line 1735`. The tenant header (CardstockHeader → AppHeader) renders an inert monogram with no dropdown — recorded in the comment at 1743-1750.
  2. **The presence branch inside it never renders, even for superadmin.** `line 1279`: `const presence = useNavPresence(!isStaff)` — the hook is *disabled* for staff, so every key is false; `line 1288`: `const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key])` is therefore always `[]` for a superadmin, and the `navLinks.map(...)` block at 1691-1702 emits nothing. It is also nested inside `{!isAdmin && !isSuperAdmin && ( … )}` (line 1667), which is false for a superadmin regardless. Two independent gates, same result.
- exists: yes
- content:

`PRESENCE_LINKS` in full — a five-item member menu, with its own design note (AppLayout.tsx:437-448):
```tsx
const PRESENCE_LINKS: { key: keyof NavPresence; label: string; icon: typeof ShoppingBag; to: string; section?: string }[] = [
  { key: 'orders', label: 'My Orders', icon: ReceiptText, to: '/app/orders' },
  { key: 'documents', label: 'My Documents', icon: FileText, to: '/app/documents' },
  /* D2 resolved: /app/stable shipped with ACCOUNTSURFACE, so this points at the
     real route. `section` MUST be dropped alongside it — isActive falls back to
     a pathname match only when `section` is absent (see PresenceLink), so
     leaving it would mean My Stable never highlights as active. */
  { key: 'stable', label: 'My Stable', icon: Boxes, to: '/app/stable' },
  { key: 'posts', label: 'My Posts', icon: Grid3x3, to: '/app/my-posts' },
  { key: 'saved', label: 'My Saved Items', icon: Bookmark, to: '/app/account?section=saved', section: 'saved' },
];
```
(Correction to the report: PRESENCE_LINKS is **not** dead-for-tenant. It is also consumed by the live tenant rail/drawer through `PresenceLink` at `line 1145`. What is superadmin-only is the *dropdown copy* of it inside `accountMenu`.)

`MenuLink` in full (AppLayout.tsx:845-861):
```tsx
function MenuLink({ to, label, icon: Icon, end, onNavigate }: NavItem & { onNavigate: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2.5 text-sm font-sans transition-colors focus-ring ${
          isActive ? 'bg-cream-200 text-green-800 font-medium ' : 'text-secondary [@media(hover:hover)]:hover:bg-navfill/64 [@media(hover:hover)]:hover:text-cream-100'
        }`
      }
    >
      <Icon size={17} aria-hidden="true" />
      {label}
    </NavLink>
  );
}
```

`accountMenu` — every label the owner has never seen rendered (AppLayout.tsx:1628-1725):
```tsx
  /* THE ACCOUNT DROPDOWN — hoisted out of the header markup because there are
     now two headers (superadmin's untouched platform chrome and the tenant's
     cardstock nameplate) and this panel is identical in both. … */
  const accountMenu = menuOpen ? (
    <div className="absolute right-0 mt-1 w-60 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md rounded-md py-1 …">
      <p className="px-4 py-2 text-xs text-muted border-b border-green-800/10 truncate">{name}</p>
      <MenuLink to="/app/account" label="Account" icon={UserRound} onNavigate={closeMenu} />

      {/* admin references — company-associable items only */}
      {isAdmin && !isSuperAdmin && (
        <>
          <div className="… uppercase tracking-wide text-secondary/60">Company</div>
          <button … onClick={() => { closeMenu(); navigate('/app/ops/documents'); }}>
            <FileText size={17} /> Pending agreements
          </button>
          {/* Both operators navigate to the community + catalog to help
              members with what they're seeing — no shopper-only links. */}
          <div className="… uppercase tracking-wide text-secondary/60">Quick access</div>
          <div className="px-1"><CommunityNav onNavigate={closeMenu} indentClass="pl-9" rowInsetClass="px-3" /></div>
          <button … onClick={() => { closeMenu(); navigate('/app/dashboard'); }}>
            <LayoutDashboard size={17} /> Dashboard
            {unreadCount > 0 && <span className="… bg-gold-600/70 text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <button … onClick={() => { closeMenu(); navigate('/app/catalog'); }}>
            <ShoppingBag size={17} /> Catalog
          </button>
        </>
      )}

      {/* client quick links — an admin's menu carries company work, not shopper shortcuts */}
      {!isAdmin && !isSuperAdmin && (
        <>
          <div className="… uppercase tracking-wide text-secondary/60">Quick access</div>
          <div className="px-1"><CommunityNav … /></div>
          {QUICK.map((q) => { … <q.icon size={17} /> {q.label} … })}
          {/* I2 — same five presence-gated links as the rail, dropdown-shaped. */}
          {navLinks.map((l) => { … })}          {/* ← always [] — see reachability */}
        </>
      )}

      {navGroups.length > 0 && (
        <div className="lg:hidden">
          {navGroups.map((g) => (
            <div key={g.key}>
              <div className="… uppercase tracking-wide text-secondary/60">{g.label}</div>
              {g.items.map((it) => <MenuLink key={it.to} {...it} onNavigate={closeMenu} />)}
            </div>
          ))}
        </div>
      )}

      <button … onClick={() => { closeMenu(); setTourOpen(true); }}>
        <Compass size={17} aria-hidden="true" className="shrink-0" /> App tour
      </button>
      <button … onClick={handleSignOut}>
        <LogOut size={17} aria-hidden="true" className="shrink-0" /> Sign out
      </button>
    </div>
  ) : null;
```

The superadmin-only gate and its recorded reasoning (AppLayout.tsx:1735-1750, 1792-1803):
```tsx
      {isSuperAdmin ? (
      /* ── SUPERADMIN: PLATFORM CHROME, DELIBERATELY UNTOUCHED ──────────────
         This is the platform operator's chrome, not a tenant's branding …

         ONEMENU (2026-08-07): the tenant's CardstockHeader avatar is now an
         inert monogram and no longer renders `accountMenu` at all — its
         contents (Account, Company, Quick access, Sign out) moved into the
         tenant side nav (rail + drawer) instead. `accountMenu` itself is
         UNCHANGED and lives on here, exclusively for superadmin: it is the
         platform operator's only sign-out path, and Q3's ruling was to leave
         this chrome alone entirely rather than fold it into the
         consolidation too. */
        …
            <div className="relative" ref={menuRef}>            {/* line 1792 */}
              <button type="button" onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full … focus-ring"
                aria-label="Account menu" aria-expanded={menuOpen}>
                {/* No notifications badge on the avatar — the count lives on the
                    Dashboard nav link (desktop rail + mobile menu) instead. */}
                <span className="w-8 h-8 rounded-full bg-green-800 text-white text-sm font-sans grid place-items-center">
                  {initial}
                </span>
                <ChevronDown size={14} className="text-secondary" />
              </button>
              {accountMenu}                                     {/* line 1803 — the ONLY render site */}
            </div>
```

The presence gate that empties it (AppLayout.tsx:1279, 1288) and the RPC behind it:
```tsx
1279:  const presence = useNavPresence(!isStaff);   // disabled for staff → all keys false
1288:  const navLinks = PRESENCE_LINKS.filter((l) => presence[l.key]);   // → [] for superadmin
```
```sql
CREATE OR REPLACE FUNCTION public.my_nav_presence() RETURNS jsonb …
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('orders', false, 'documents', false, 'stable', false, 'posts', false, 'saved', false);
  END IF;
  v_orders    := EXISTS (SELECT 1 FROM purchases p WHERE (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id()) AND p.org_id = current_org());
  v_documents := EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1);
  v_stable    := EXISTS (SELECT 1 FROM public.my_stable_horses() LIMIT 1);
  v_posts     := EXISTS (SELECT 1 FROM feed_posts fp WHERE fp.author_id = auth.uid());
  RETURN jsonb_build_object('orders', v_orders, 'documents', v_documents, 'stable', v_stable,
                            'posts', v_posts, 'saved', false);   -- 'saved' is hardcoded false
```
