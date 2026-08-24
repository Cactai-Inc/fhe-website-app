# TASK-PAMELA — REPORT

**Branch** `task/pamela` · **Commits** `cafa52c` (§B), `618c673` (§A) · **Not pushed.**
**Migrations applied to prod:** 3 (listed in §0.3). **typecheck 0 · typecheck:api 0 · lint 0 errors**
(46 warnings, all pre-existing — identical count on `main`).

Pamela Godde (`f80e944a-0043-4358-9488-fa73c1eff43b`) was used as the live case throughout.
Her state at the start of this thread, queried directly: `contact_type = 'CONTACT'`, **no
`clients` row, no invitation, no documents, no horse, no phone, no address.** She is a bare
contact — arm 3 of `admin_client_accounts` — which is why the client-detail page showed her the
full from-scratch provisioning form.

---

## 0. THE HEADLINES

### 0.1 Part B — the fourth path was found, and it was deleted

`src/pages/app/ops/NewContractPage.tsx`, the **`horseMode === 'record'` ("Record it now") branch**
on the lease. It rendered **exactly eight bare text inputs**:

```
registered_name · nickname (labelled "Barn name") · breed · color · sex · height
· microchip_id · registration_number
```

It matches the owner's report line for line: eight fields, all plain text, no farrier, no vet, and
a **"Barn name" label writing the `nickname` column** — the exact word he has now rejected twice.
Two of those free-text fields (`breed`, `color`) are **foreign keys** (`horses_breed_fkey`,
`horses_color_fkey`), so a typed value could not be stored at all.

**It has been deleted, not repaired.** The mode is gone from the type union, the state, the
`ready` gate, the `create()` branch and the JSX.

### 0.2 Part A — the defect is that account state had nowhere to live but the invitation

`ProvisionClientForm`'s only submit path was `adminSendInvitation`. Everything it collected was
discarded unless staff also emailed the person in the same click. `_ensure_client_account`'s own
comment says it: *"groups are DERIVED — provisioning writes none"* — so the **staff category
decision is stored nowhere except `invitations.categories`**, and `derive_affiliations` reads it
from there. The invitation row was already the config store; it was just being minted and mailed
in one breath.

The fix is a **draft** state on that same row, not a second store.

### 0.3 Migrations applied to production

| File | What | Dry-run | Applied | Verified |
|---|---|---|---|---|
| `20260823T1000_pamela_horse_sex_renders_its_label.sql` | `{{HORSE.SEX}}` printed the raw code | ✅ `BEGIN…ROLLBACK` | ✅ | ✅ `horse_field_token_value(h,'SEX')` → `Mare` |
| `20260823T1100_pamela_account_exists_before_it_is_sent.sql` | `invitations.status` gains `draft`; `account_status_code` maps it to a new `account/provisioned` vocab code | ⚠️ see below | ✅ | ✅ constraint + vocab + `account_status_code('draft')` → `provisioned` |
| `20260823T1110_pamela_provision_can_save_without_sending.sql` | `provision_client_invitation` gains `p_send` | ⚠️ see below | ✅ | ✅ single signature, no overload; full lifecycle test in §1.5 |

⚠️ **Disclosure — the second and third migrations were not dry-run cleanly.** The `1100` file
contains its own `BEGIN; … COMMIT;`, and that inner `COMMIT` closed the wrapping transaction I had
opened for the dry run, so both files committed for real instead of rolling back. Their *content*
was correct and both are verified above, and `p_send` defaults to `true` so every pre-existing
caller is byte-identical — but the discipline was not followed and I am saying so rather than
implying a clean `BEGIN…ROLLBACK`. The lesson: a migration file that manages its own transaction
cannot be wrapped in one.

---

## 1. PART A — SAVE AND SEND

### 1.1 The activation audit, in full — and why nothing was renamed

The spec asked for every `activate` / `activation` / `activated_at`-shaped thing to be found and
each one attributed to one of the owner's two events. Queried live:

```
columns named 'activ*' in public   → 24 rows, ALL of them `active boolean` on
                                     lookup/catalog tables, plus profiles.staff_active
                                     and bookings.activity_log. ZERO in the invitation domain.
functions named 'activ*'           → 7, all `activity_*` / `is_active_member` / `horse_active_lease_doc`.
                                     ZERO invitation-related.
`activated_at` anywhere            → does not exist.
```

**There is no schema-level conflation. The word "activation" exists only in UI copy and the
`/activate` route**, and every one of those uses means **event (2), the client's own first-time
password/token claim**:

| Site | Which event | Verdict |
|---|---|---|
| `App.tsx:156` `/activate`, `/activate/complete` → `Register.tsx` | (2) client claim | correct |
| `ActivateShell.tsx`, `ActivationOrderPanel.tsx` | (2) client claim | correct |
| `InviteResultPanel`, `InvitationHistoryPanel` — "activation link/URL" | (2) client claim | correct |
| `ProvisionClientForm` — "what they'll review and sign when they activate" | (2) client claim | correct |
| `Admin.tsx:377` — "send the activation invite" | (2) client claim | correct wording, wrong *framing* — it was the only button, so it also had to carry event (1). **Reworded.** |
| `Admin.tsx:891` "Deactivates the account" / "Reactivate" | a **third**, unrelated meaning: suspension | out of scope, flagged, left alone |

**So: don't rename blind was the right instruction, and the answer is nothing needed renaming.**
Event (1) — staff creating the account, the one the owner calls the true activation — had no name
in the schema **because it had no separate existence**. It was a side effect of minting an
invitation. This task gives it one: `invitations.status = 'draft'`, surfacing through
`account_status_code` as the new status-vocabulary code **`provisioned` — "Account created"**, so
the timeline now reads *Account created → Invited → Redeemed* instead of starting at *Invited*.

### 1.2 What `provisionClient: true` actually does — the question the spec required answering first

`provision_client_invitation` is **one transaction** that does, in order: resolve org → resolve or
create the contact (via `_ensure_client_account`) → create the `clients` row → assign
`contact_required_documents` → confirm or create the order → book the agreed lesson →
**mint the `invitations` row** → `supersede_invitations` → `apply_affiliations`.

**Everything except the last three steps already happens without reference to an email.** The
email is sent by `api/admin-send-invitation.ts` *after* the RPC returns. So the account was never
technically hostage to the mailer — it was hostage to the fact that the handler ran both with
nothing between them, and that the invitation row was minted as `'sent'` unconditionally.

That answer is what made a **branch** possible instead of a second RPC.

### 1.3 What was built

**`p_send boolean DEFAULT true`** on `provision_client_invitation`, changing exactly two
statements:

- `p_send = false` → the invitation is written as **`draft`**, and `supersede_invitations` is
  **not** called (a save must never kill a link somebody is already holding).
- `p_send = true` **on a contact who has a draft** → that draft is **promoted in place**: same
  row, same token, status → `sent`. The link staff saved is the link the client receives, and one
  row carries the whole lifecycle instead of the history filling with one entry per save.

Applied by reading the live function body back with `pg_get_functiondef` and string-editing it, so
the other ~280 lines cannot drift. The old signature is dropped and re-created (appending a
defaulted parameter would otherwise leave two overloads, which PostgREST cannot choose between by
name) and `EXECUTE` is re-granted to `service_role, authenticated`.

**`api/admin-send-invitation.ts`** gains `sendInvitation` (default true). When false it passes
`p_send => false` and **returns before the mailer** — before `sendInvitationEmail`, before
`recordInvitationDelivery`, with `registerUrl: null` and `inviteStatus: 'draft'`. There is no URL
to hand over, because nothing has been issued.

**`ProvisionClientForm`** now has **two real buttons**: **Save the account** (primary) and
**Send invitation**. A saved-but-unsent contact re-opens this same form, prefilled from its own
draft, under a banner that says plainly *"This account exists — the invitation has not been
sent."* `AdminInviteResult.registerUrl` became `string | null`; the three send-only call sites
(`Admin.tsx`, `TeamPage.tsx`, `LeadWorkDrawer.tsx`) coalesce it.

**`Admin.tsx`'s `InvitePanel`** gets a third state. `neverInvited || isDraft` renders the editable
form; the resend / regenerate / expire controls stay for `sent`, because those are about a link
somebody is holding and a draft is not one.

**`LeadWorkDrawer`** no longer toasts *"Confirmation sent"* or flips the lead to `invited` on a
save — that would be a false statement about an email that deliberately did not happen.

### 1.4 The scheduling gate — the owner's exact rule, not a judgement call

The scheduling-heavy content is `AgreedLessonSection` / `AgreedLessonPanel`, which all four hosts
passed as `children` and which therefore rendered **unconditionally**. It is now passed through a
new `scheduling` prop and rendered only when:

- **(A)** `categories.includes('Rider')` **or** the contact already carries the `RIDER` group
  (read from `contact_dossier().standing.groups` — so a rider already on file gets it without
  anyone re-ticking a box), **or**
- **(B)** a selected offering's `config_kind` is **`scheduled`** or **`recurring`**. Those are the
  two of the six catalog kinds that schedule anything; `intake_finder`, `intake_evaluation`,
  `document_transaction` and `inquire` do not.

Neither true → **it does not render at all.** Not collapsed, not present-but-empty.

Hosts updated: `Admin.tsx`, `ContactDossierModal.tsx`, `AccountInvitePage.tsx`,
`LeadWorkDrawer.tsx`.

### 1.5 THE TEST — run live against production, in rolled-back transactions, as the tenant owner

```
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '<admin@fhequestrian.com>';
```

| Assertion | Result |
|---|---|
| Save (`p_send => false`) creates a real account | ✅ `clients` row created for Pamela |
| …persists the category | ✅ `invitations.categories = {RIDER}`, `status = draft`, `current_status = provisioned` |
| …persists the paperwork | ✅ 4 rows in `contact_required_documents` (COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT) |
| …persists the phone onto the contact | ✅ `contacts.phone = (619) 555-0147` |
| …derives affiliations | ✅ `groups` gains `RIDER` |
| **…sends no email** | ✅ **zero `email_sent` / `email_failed` rows in `status_events`** for that invitation — only `provisioned` |
| Save again with different values | ✅ **same row, same token, one row total**; categories updated |
| Send afterwards | ✅ **same row, same token**, `status → sent`, timeline reads `provisioned → invited` |

⚠️ **A trap worth recording.** My first check of `contact_required_documents` returned **0 rows**
and I nearly reported the document assignment as broken. It was RLS filtering the *read* — the
rows were there all along, visible after `RESET ROLE`. This is exactly the silent-zero failure
CLAUDE.md's working rule exists for, in its read direction rather than its write direction. The
app never hits it because it reads that table through `getContactRequiredDocumentsState`.

### 1.6 The three field sets — where they agree, where they diverge, and what was reconciled

**The three surfaces**, found as the spec directed:

1. **Staff provisioning** — `ProvisionClientForm` (+ `AgreedLessonSection`).
2. **Staff-invited intake** — `adminSendInvitation` → `/activate?token=` → `Register.tsx` →
   `Onboarding.tsx`.
3. **Self-service** — `/sign/:path` → `SignStart.tsx` (`guest` · `rider` · `horse` · `rider+horse`
   · `deal`), routed at `App.tsx:186`.

| Field | Staff provisioning (before) | Staff provisioning (now) | Invited intake | `/sign/*` |
|---|---|---|---|---|
| Email | ✅ | ✅ | from the invitation | ✅ + confirm |
| First / last name | ❌ (props only, never asked) | ✅ | ✅ | ✅ |
| Phone | ❌ | ✅ | ✅ | ✅ |
| Street / city / state / ZIP | ❌ | ✅ | ✅ | ✅ (required on `/sign/deal` only — D22 §0) |
| Date of birth | ❌ | ❌ | ✅ | ❌ |
| Rider is a minor (name + DOB) | ❌ | ❌ | ✅ | ❌ |
| Emergency contacts ×2 | ❌ | ❌ | ✅ | ❌ |
| Riding background (years, jumping, prior instruction) | ❌ | ❌ | ✅ | ❌ |
| Password | n/a | n/a | ✅ (`Register.tsx` — this is the whole page) | n/a |
| Account category | ✅ | ✅ | derived | derived from the path |
| Onboarding documents | ✅ | ✅ | signed, not chosen | signed, not chosen |
| Offerings / payment | ✅ | ✅ | ✅ (order + payment steps) | ✅ (catalog by `PATH_SEGMENTS`) |
| Internal notes | ✅ | ✅ | n/a | n/a |
| Agreed lesson slot | ✅ unconditional | ✅ **gated** (§1.4) | n/a | ranges, not a slot |
| Horse | ❌ | ❌ | ✅ `HorseIntakeForm` | ❌ |

**The divergence that mattered, and is fixed:** the staff form asked for **none** of name, phone or
address. D22 §0's standard is *name + email + phone are the minimum on every path, and the address
is required where a contract prints it* — and the one person who reliably has all three, the staff
member who just had them on the phone, had nowhere to put any of it. Pamela is the case: a deal
party with an email address and nothing else, whose `PARTY.*` contract tokens would print blanks.
The form now collects all of it, prefilled from `contact_dossier` and written back through
**`update_contact_record`** — the incumbent staff writer — so it reaches every document she is on,
not just this screen (D22).

**Deliberately NOT copied into the staff form, and why:** date of birth, minor details, emergency
contacts and riding background. These belong to the rider onboarding, are asked once there, and
duplicating them here would create a *fourth* disagreeing copy of the same questions — the thing
this reconciliation exists to stop. **Flagged, not fixed:** `/sign/*` asks none of them either,
so a self-service rider reaches the barn with no emergency contact until they complete onboarding.
That is a real gap in the self-service path and it is named here rather than patched blind.

**Also flagged, not fixed:** `/sign/*` asks for a **confirm-email** field that neither other
surface has. Harmless duplication; a deliberate anti-typo measure on the only path with no staff
member watching.

### 1.7 A second defect found and fixed on the way — the automatic "Guest"

`suggested_category_for_contact` returns **`'GUEST'` as its `ELSE` branch** — that is, for any
contact with no executed documents, which is *every fresh one*. `ProvisionClientForm` read that as
a decision and ticked **Guest**, which unfolds the paperwork, offerings and payment sections.

**This is a large part of why the owner met "a huge section" on Pamela.** It also silently
contradicted STABILIZE ITEM 2 (owner, 2026-08-22: *"select ZERO categories, not a new one"*) — the
form's own copy explains that leaving every box unticked is a real choice, while the code was
making that choice for staff on every fresh contact. It now preselects only when
`executed_templates` is non-empty, i.e. only from actual evidence.

---

## 2. PART B — THE HORSE FIELDS

### 2.1 Reproduction — which component, which route

| | |
|---|---|
| **Route** | `/app/ops/contracts/new` (`<ProtectedRoute requireStaff>`, `App.tsx:369`) |
| **Component** | `src/pages/app/ops/NewContractPage.tsx` |
| **Path** | contract type **Horse lease** → Horse section → the **"Record it now"** pill |
| **Status** | **DELETED** — commit `cafa52c` |

The spec's three checked places were all correct and are all untouched: `HorseGate`,
`HorseIntakeForm`, and `contract_field_defs` for `HORSE_LEASE_V2`. The fourth path was a **sale-vs-
lease asymmetry**: the purchase branch of the very same page had already been given the right
shape (a dropdown + an "Add a new horse" modal containing the real intake form), and the lease
branch was never brought across.

Re-verified live while here: `contract_field_defs` for `HORSE_LEASE_V2` holds **17 `HORSE.*`
fields**, `BREED`/`COLOR`/`SEX` are `input_kind='select'` with real options, all six farrier/vet
fields exist, and **there is no `HORSE.BARN_NAME`, no nickname token and no `HORSE.HEIGHT` token
at all.**

### 2.2 What replaced it

**`src/components/app/AddHorseModal.tsx`** — one modal, wrapping `HorseIntakeForm` exactly as it
exists everywhere else. Not a trimmed variant, not a second implementation. Used from **three**
doors:

| Door | Before | After |
|---|---|---|
| New-contract page, **lease** | 8 bare inputs | **"Add a new horse"** → modal |
| New-contract page, **sale** | its own inline modal | the shared modal |
| Contract page, **`HorseGate`** | `<Link>` **navigating away** to `/app/horse-intake?contract=…` | modal, attaches on save, never leaves the contract |
| Contract page, **Parties & Horse card** | picker of existing records only — nowhere to put a new horse | picker **+ "Add a new horse"** |

**Lessor ↔ horse, both directions**, exactly as specified:

- Lessor/Seller already chosen → passed as `ownerContactId`; the modal never asks again.
- Not chosen → `HorseIntakeForm`'s own **staff "Assign this horse to an account" picker** (which
  already existed and is already required for staff) is the ask, and `onDone` now reports that
  choice back as a second argument. The caller sets it as the contract's Lessor/Seller.
- On save the modal closes, the horse becomes the contract's selected horse, and the owner-side
  party shows on the card above. **No reload, no second step.**

**Save on the name alone**: a new `createEarly` prop relaxes the answer-or-N/A completeness gate to
name + account. It is **not a second save discipline** — the record is created by the same
`create_horse_record` call (whose only hard requirement has always been *"a horse name is
required"*), and the autosave-on-blur path the form already runs in edit mode takes over the
instant the record exists. The full gate still applies on every other caller, where that submit is
also the moment the horse's onboarding documents are generated.

### 2.3 The save path, traced end to end against the live database

Run as the tenant owner inside `BEGIN … ROLLBACK`:

| Link in the chain | Evidence |
|---|---|
| Name-only create makes a real row | `create_horse_record('{"registered_name":"…","owner_contact_id":"<Pamela>"}')` → `outcome: created`, `horses` row `HOR-000113` |
| …owned by the right person | `current_owner_contact_id = f80e944a…` (Pamela), `org_id` = FHE |
| …and the ownership derives the affiliation | `horses_apply_affiliations` trigger → `groups` gains `HORSE_OWNER` |
| Attaching binds it to the contract | `attach_horse_to_document(doc, horse)` → `documents.horse_id` set |
| …and fills the contract from the record | all **17** `HORSE.*` `contract_fields` refilled; `HORSE.REGISTERED_NAME = 'PAMELA TEST HORSE'` |
| …and the parties are right | `document_parties` → `LESSOR` = Pamela, `LESSEE` = the counterparty |
| Completing the record afterwards reaches the contract | `update_horse_record(...)` → `horses_sync_contract_fields` → `HORSE.BREED = 'Warmblood (unspecified)'`, `HORSE.COLOR = 'Bay'`, `HORSE.FARRIER_NAME = 'Joe Smith'`, `HORSE.FARRIER_PHONE = '(619) 555-1212'`, `HORSE.VET_NAME`, `HORSE.VET_PHONE` — **without a re-attach** |
| The medication picker has something to read | `set_horse_medications` → `horse_medications_list` returns both rows with `kind`, `name`, `dosage`, `instructions` |

**The chain was already sound.** Nothing in it was thin or missing; the only thing wrong was that
the lease branch never entered it. That is reported as found, per the spec's instruction to say so
and move on.

**One real defect surfaced by the trace**, and fixed: **`{{HORSE.SEX}}` printed the raw code.**
`horse_field_token_value` resolves BREED, COLOR, MARKINGS, REGISTRATION_ORG and PASSPORT_COUNTRY
through their vocabularies and returned `horses.sex` verbatim — so a signed lease read **"MARE"**,
not "Mare". Migration `20260823T1000`, applied and verified. Zero live documents carried a stale
value, so the accompanying repair `UPDATE` touched 0 rows; it is the guard, not the fix.

### 2.4 The field-by-field audit — against the matching test, not against a blanket rule

The rule applied is the owner's corrected one: **does the system need this value to MATCH
something?** If yes, a list is not optional. If no, it is a judgement about whether a picklist is
genuinely faster and better as the *primary* input.

| Field | Needs to match? | Verdict | Action |
|---|---|---|---|
| `breed` | **Yes** — `horses_breed_fkey` → `horse_breeds.code` | already a list | **already correct, left alone** |
| `color` | **Yes** — `horses_color_fkey` → `horse_colors.code` | already a list | **already correct, left alone** |
| `sex` | **Yes** — `HORSE.SEX` is `input_kind='select'` with fixed option values | already a closed select | **already correct.** But the *contract* printed the code — fixed in the DB (§2.3) |
| `markings` | soft — resolved via `lookup_options` when it matches | already `SelectOrOther` | left alone |
| `registration_org` | soft — same | already `SelectOrOther` | left alone |
| `passport_country` | soft — same | already `SelectOrOther` | left alone |
| **`location.name`** (home / current / lease / temporary) | **Yes** — `set_horse_locations` → `_resolve_location` matches the typed name against `locations` and **CREATES a row on a miss** | it was a `<datalist>`: a hint, not a control. "Carmel Creek Ranch" and "Carmel Creek ranch " become two places and the horse is filed at the one nobody else uses — **a match failure that never raises**, which is worse than the breed FK error, not better | **CONVERTED** — a select of known locations + an explicit free-text escape, and picking a known one now brings its address with it |
| **`height`** | **No** — there is no `HORSE.HEIGHT` token; it is a record display value | judgement: a hand is four inches, so the only valid fractions are .0–.3 and the range is 8–19 — a closed **unit** vocabulary. Free text was producing "16.2hh", "16.2 hands", "16'2" and "1.68m" for one fact | **CONVERTED** — a generated hands list with free text as the named fallback. Deliberately **not** a fourth `lookup_options` key: nothing about the definition of a hand is a tenant's to edit (D13) |
| `registered_name`, `nickname`, `registration_number`, `microchip_id`, `passport_number` | No | free text is correct | **left alone** |
| `fair_market_value` | No — display only | free text with currency formatting | left alone |
| **`farrier_name` / `farrier_phone`** | **No** | **no fixed taxonomy of farriers exists.** Free text is correct and was never the problem | **left alone, as ruled** |
| **`vet_name` / `vet_business_name` / `vet_phone` / vet address parts** | **No** | same | **left alone, as ruled** |
| `medical_history`, `behavioral_history`, `known_conditions`, `training_history`, `competition_history` | No — narrative | free text is correct | left alone |
| medication/supplement `name`, `dosage`, `instructions`, supplier fields | No — displayed as typed on the **record** | free text is correct on the record; the **contract** is where the picker was needed (§2.5) | left alone |
| `barn` / `stall` on a location | No | already a prefix-select composite (Barn/Stable, Stall/Pen) + typed value — list-primary already | left alone |
| location `trainer` / `care_giver` / `groom` / `other` | No | judgement: these are people at a *third-party* property, with no roster to pick from | **left free text** |
| **`state`** (vet address, location address) | No — but it is a 2-letter code | judgement: a US-state select would be defensible, **but no state-list mechanism exists anywhere in this codebase** and inventing one here would be a second mechanism for a field nobody complained about | **left free text — flagged, not fixed** |
| `euthanasia_authorization` | Yes — CHECK constraint `A`/`B` | already a two-button choice | left alone |

**Two fields were converted. Nothing was converted for being "not name/microchip/registration."**

### 2.5 Medications and supplements — the picker the owner asked for

The clause and field already existed and were found rather than invented: **`TXN.MEDICATIONS`**,
`input_kind = 'med_schedule'`, clause `CARE.SUPPLEMENTS`, section `CARE`, `owner_role = LESSOR`,
rendered by `MedicationBuilder` in `ContractCascade.tsx`. Every item was hand-typed:
name / dose / schedule, plus three responsible-party selects.

It now offers **the horse's own `horse_medications` rows first**, labelled *"From this horse's
record"*, showing name + dosage and marking supplements. Picking one seeds name, dose and schedule
(from `instructions`); every field stays editable, because a contract obligation may legitimately
differ from the standing regimen — hand-typing is the fallback, not the default.

`kind` values confirmed live: **`MEDICATION`** and **`SUPPLEMENT`** on the one table; there is no
separate supplements table.

The document's horse is published through a small **`ContractHorseProvider`** context rather than
threading an optional `horseId` through `ClauseDocument → InlineFieldControl → FieldControl →
MedicationBuilder` — four signatures that have nothing else to do with horses. A document with no
horse reads `null` and the picker does not render.

### 2.6 Nickname, barn name, `home_barn`, `current_barn` — which column each label writes

The spec asked for the literal string **"Barn name"** to be grepped. **One occurrence**, at
`NewContractPage.tsx:382`, in the deleted block. It wrote **`horses.nickname`** — so the label was
wrong and the column was right, exactly the confusion the owner named.

The other three are correct and were **not** merged:

- **`horses.nickname`** — the everyday name. `HorseIntakeForm` labels it **"Nickname"** with the
  placeholder *"Everyday name (e.g. Beau)"*. Already correct. Two stale error strings still said
  *"registered or barn name"*; both now say nickname.
- **`horses.home_barn` / `horses.current_barn`** — a **physical barn or stable at a location**
  ("Barn A", "Stable B"), written by `LocationEntry`'s prefix composite and labelled **"Barn"**.
  These are not nicknames and are not each other: a horse can board somewhere other than its home
  barn, which is precisely why both columns exist.

**No nickname or barn-name token reaches contract text**, verified against the live field defs.
`ClauseDocument.tsx:234` still *reads* `valueByKey['HORSE.BARN_NAME']` as the first term of a
tooltip fallback — harmless dead lookup against a token no template defines, left in place.

---

## 3. THE REACH

- **Save vs Send** — `/app/admin` → a client row → the **Provision/Account** panel. Also
  `ContactDossierModal` (Records → a person → Account tab) and `/app/ops/accounts/new`. All three
  render the same `ProvisionClientForm`; the two buttons are at its foot, with the saved-but-unsent
  banner at its head.
- **Adding a horse from inside a contract** — three doors, all now the same modal:
  `/app/ops/contracts/new` (lease **and** sale) → Horse → **"Add a new horse"**;
  `/app/contracts/:id` → the horse gate → **"+ Add a new horse"**;
  `/app/contracts/:id` → **Parties & Horse** → Edit → **"Add a new horse"**.

## 4. THE TELL

- A saved account shows **`invite_status = 'draft'`**, a green *"This account exists — the
  invitation has not been sent"* banner on the form, a **"Not sent"** chip in the invitation
  history, and a `status_events` timeline that opens with **"Account created"** and contains **no
  `email_sent` row**.
- A horse added from a contract shows immediately in the Horse picker **and** as the contract's
  selected horse, with the Lessor/Seller filled in on the card above, with no reload.

---

## 5. FLAGGED, NOT FIXED

1. **`/sign/*` collects no emergency contact and no riding background** (§1.6). A self-service
   rider reaches the property with neither until they finish onboarding. Real gap, named rather
   than patched blind.
2. **`state` stays free text** in the vet and location address blocks (§2.4) — there is no
   state-list mechanism anywhere in this codebase to reuse, and building one for a field nobody
   raised would be a second mechanism.
3. **`lookup_options` has no editor at all.** Its three live vocabularies (`horse_markings`,
   `horse_registration_org`, `horse_passport_country`, 33 rows) can only be changed by SQL, and the
   `lookup_suggestions` review queue has no page either. **A standing D13 gap, pre-existing.** It
   is why `height` was built as a generated list rather than a fourth un-editable key.
4. **Re-saving a draft does not update an existing purchase's payment status.** The RPC's
   duplicate-order guard reuses the matching purchase and does not re-apply
   `p_mark_paid` / `p_partial_amount`. Pre-existing; only now reachable more often because saving
   is repeatable.
5. **A Save on a contact who already has a *live sent* invitation** would leave a draft alongside
   it, and `admin_client_accounts` picks the newest. Unreachable through the UI (the editable form
   only renders for never-invited or draft) but the shape exists.
6. **`markings` is a single-select** while a horse usually has several. Not the complaint; noted.
7. **`Admin.tsx`'s "Deactivate / Reactivate"** is a third, unrelated meaning of "activate"
   (suspension). Correct in itself, but it shares a word with two other concepts on the same page.
8. **`ClauseDocument.tsx:234`'s dead `HORSE.BARN_NAME` lookup** (§2.6) — harmless, retained.
9. **The `1100`/`1110` migrations were committed rather than rolled back during the dry run**
   (§0.3). Content correct, verified, and behaviour-preserving by default — but the discipline was
   broken and is recorded here rather than glossed.
