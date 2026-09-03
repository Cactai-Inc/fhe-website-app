# TASK-SIGNFLOW-G — the last three contact writers normalize on blur

**Spec by `FHE-TASK-SIGNFLOW-F` (DSNR profile), 2026-09-02. Change order: `CR-100` (follow-up), authorised by
`docs/reports/TASK-SIGNFLOW-B-VERIFICATION.md` §"three remaining writers".**
**Thread name: `FHE-TASK-SIGNFLOW-G`.** *(F is the authoring thread; letters continue.)*

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **Not repeated here.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-G-LEDGER.md` FIRST.
> - `CLAUDE.md` **D22** (`:421`) — the contact record is the source of truth for party fields.
> - `CLAUDE.md` **D18** (`:376`) — improve the incumbent; never a second normalizer.
> - `CLAUDE.md` **D39** (`:942`) — the unit of work is the outcome.
> - `src/lib/normalize.ts` — **read the whole file. You will not edit it.** Its header and the
>   `normalizeKindForField` docstring are the design and the owner's own words.
> - `src/lib/formState.ts:345-378` — `useFieldNormalizer`, the hook you wire. **You will not edit it.**
> - `src/components/app/ContactDossierModal.tsx:515-528` — **the idiom**, verbatim, that this task copies.
> - `docs/reports/TASK-SIGNFLOW-B-REPORT.md` §3 (the ten-door reach table) and §5 — where these three
>   surfaces were found and why they were left for a follow-up.

---

## 1. THE OWNER'S WORDS

> *"we need the address fields to normalize the inputs, when i enter my address, 752 windemere ct san
> diego ca 92109, it stays looking like that it should normalize to capitalize and it should make sure
> its a valid address somehow."* — owner, `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-100

> *"just normalize the inputs dont want to setup google api for paid lookup functionality."* — owner,
> 2026-09-01. 🔒 **Format-level shaping only. Still locked. Not re-askable.**

And the ruling that puts STAFF surfaces inside CR-100 — TASK-FIX4 §4, quoted at
`ContactDossierModal.tsx:516-517`:
> *"yes staff-entered inputs normalize too"* — owner, 2026-08-31

**ORCH's routing** (`TASK-SIGNFLOW-B-VERIFICATION.md`): *"The three remaining unnormalised writers
(ProvisionClientForm:558, ContractIntake:193, ContractPage:1973): FOLLOW-UP TASK, not an amendment."*

## 2. WHAT WAS MEASURED — by DSNR on 2026-09-02, on `main` @ `b846b227`

| Fact | How it was measured |
|---|---|
| **None of the three files imports the normalizer at all** — not for name, phone or email either | `grep -n "useFieldNormalizer\|normalize(" src/components/app/ProvisionClientForm.tsx src/pages/app/ContractIntake.tsx src/pages/app/ContractPage.tsx` → **0 hits** (ContractPage's `:82 .toUpperCase()` is a section-name compare, not an input) |
| `ProvisionClientForm.tsx` — 8 contact inputs, all `onChange` only | email `:529` · first `:549` · last `:551` · phone `:556` · address_line1 `:558` · city `:560` · state `:563` · postal_code `:565`. State: `ident` `:158-161`, `setIdentField(k)` `:162`; `email` is its own state |
| …and where they go | first/last → the provisioning call `:448-449` (trimmed) · email `:443` (trimmed) · phone + 4 address fields → `updateContactRecord` `:471-478` (trimmed), i.e. `update_contact_record`, **the contact record** (D22) |
| `ContractIntake.tsx` — 9 contact inputs, `onChange={set(k)}` | first `:167` · last `:171` · email `:179` · phone `:186` · address_line1 `:194` · address_line2 `:196` · city `:199` · state `:201` · postal_code `:204`. State `form: Record<string,string>` `:48`; `set` `:50-51` |
| …and where they go | `submit` `:74-90` trims → `captureContactInfo` (`src/lib/contracts.ts:846`) → `contacts` update **then `regenerate_contract_document`** — the contract the person is about to read re-composes from what was just stored |
| `ContractIntake.tsx` ALSO has 4 **vet** inputs | `:238-246`, keys `vet_address_line1/vet_city/vet_state/vet_postal` → `captureHorseRecord` — **the HORSE record, not a contact. Out of scope (§5).** |
| `ContractPage.tsx` — the co-buyer hand-entry grid, 8 inputs from one mapped array | `:1977-1985`: `first_name, last_name, email, phone, address_line1, city, state, postal_code` → `coBuyerEntry` (`:392`, `Record<string,string>`) → `addCoBuyer` `:1201-1222` → `setDocumentCoBuyer` (`src/lib/api.ts:2324`) **untrimmed** |
| The grid only renders for staff on an editable, non-void contract whose `TXN.CO_BUYER_ENABLED` is `YES` with < 2 BUYER parties, and only when no existing contact is picked | `:1955-1957`, `:1976` |
| Every key above already resolves to a kind | `normalizeKindForField` (`normalize.ts`): exact arms → `address_line1/address_line2`=street · `city` · `state`=region · `postal_code`=postal; substring arms → `email` · `phone` · `first_name/last_name`=name. **`vet_*` keys → `null`, by design.** |
| The hook | `formState.ts:367-378` — `normalize(key, kind, current, apply)` returns an `onBlur`; remembers `lastOutput` per `key` |
| `react-hooks` lint is on | `eslint.config.js:17` — a hook call inside a conditional or a `.map` fails lint |
| Unit tests | `src/lib/normalize.test.ts` **42/42** (`npx vitest run src/lib/normalize.test.ts`). **You add none — no transform changes.** |
| `ContractPage.tsx` ownership | Was `TASK-SIGNFLOW-C`'s; **C merged 2026-09-02** (`56be160a`). Free. |

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE. Zero library changes.

`src/lib/normalize.ts` + `useFieldNormalizer` **is** the system, and since SIGNFLOW-B it has every kind
these fields need. **This task is wiring only: one hook call per component, one `onBlur` per input.**
⚠️ **If your diff touches anything under `src/lib/`, you have misread the task.** A new helper, a
`useEffect`, a normalise-on-submit, a "clean the address" function — each is the second implementation
D18 exists to prevent.

### 🔒 3a. THE SHAPE — decided. This is the HOW; do not re-open it.

**One idiom, the dossier's** (`ContactDossierModal.tsx:521-527`): the KIND is **derived from the field key**
with `normalizeKindForField(k)`, so the input's own key decides the transform and nobody can mis-pick
`region` for a ZIP. Two of the three surfaces are already keyed by field name; the third keys its setter.

1. **`src/pages/app/ContractPage.tsx`** — the grid maps `[k, label]`. Hoist `const normalize =
   useFieldNormalizer();` to the component's hook block **beside `coBuyerEntry` at `:392`** (⚠️ NOT
   inside the `{allowsCoBuyer && …}` branch — that is a conditional hook and lint will refuse it). On the
   input at `:1982`, add, in the dossier's IIFE form:
   `onBlur={(() => { const kind = normalizeKindForField(k); return kind ? normalize(\`cobuyer-${k}\`, kind, coBuyerEntry[k] ?? '', (v) => setCoBuyerEntry((s) => ({ ...s, [k]: v }))) : undefined; })()}`
2. **`src/pages/app/ContractIntake.tsx`** — same derivation, key `intake-<k>`, apply
   `(v) => setForm((p) => ({ ...p, [k]: v }))`. ⚠️ **Only the 9 contact inputs (§2).** The 4 vet inputs
   derive to `null` and must be left exactly as they are — do not "fix" that by adding `vet_*` keys to
   `normalize.ts` (§5).
3. **`src/components/app/ProvisionClientForm.tsx`** — the inputs are explicit, so the key IS the field
   name: `onBlur={normalize('prov-address_line1', 'street', ident.address_line1, setIdentField('address_line1'))}`
   and so on for all 7 `ident` fields, plus `onBlur={normalize('prov-email', 'email', email, setEmail)}` on
   `:529`. Explicit kinds here, one per line, read straight off `normalizeKindForField`'s arms — this is
   `CaptureInfoModal.tsx:159-236`'s idiom for explicit inputs and it is fine.

⚠️ **The `key` must be unique per input within a component** — it is what `lastOutput` is keyed on
(`formState.ts:368`). The prefixes above (`cobuyer-`, `intake-`, `prov-`) make that true by construction.

### 🔒 3b. EVERY CONTACT FIELD, NOT ONLY THE ADDRESS ONES — a DSNR decision, stated
ORCH's routing names the three files by their address lines. **Measured, none of the three normalises
name, phone or email either** (§2). The outcome (D39) is *the contact record is shaped the same whichever
door wrote it*; wiring four address boxes and leaving the phone box beside them raw would be the half-built
pattern again. **Wire all of them.** Report it under its own heading so ORCH sees it was authorised here.

## 4. THE TRAPS
- **T1 — hook placement.** One `useFieldNormalizer()` per component, at top level. `ContractPage` is
  ~2,400 lines with its hooks near `:380-400`; put it there, not near the JSX.
- **T2 — click-without-tab.** A person types in ZIP and clicks *Save* / *Add co-buyer* directly. The
  button's `mousedown` blurs the field first; React flushes that state update before `click` runs, so the
  handler reads the normalised value. ⚠️ **Do not reason this — prove it (§8 item 4).** If it ever fails
  the fix is NOT a normalise-on-submit; it is a question to ORCH.
- **T3 — saved must equal shown.** All three submit from state (§2). `ContractPage` sends `coBuyerEntry`
  **untrimmed** — normalisation trims what it recognises, and a value it returns unchanged is what the
  person typed; do not add a trim there, that is a different change.
- **T4 — `required` on ContractIntake.** A whitespace-only value normalises to `''` and `required` then
  blocks submit. **Correct and intended** — say so if you notice it; do not work around it.
- **T5 — never normalise a loaded value** (`normalize.ts:19-21`). `ProvisionClientForm` prefills
  `first_name`/`last_name` from props (`:159`). The hook only runs on blur, so a prefilled `LaBuzetta`
  is untouched until someone edits and leaves the box. **Free — as long as you use the hook.**
- **T6 — D22 is the consequence and it is the point.** `ContractIntake`'s submit regenerates the
  contract from the contact record, so a lowercase address typed here prints capitalised on the document
  the person opens next. That is the intended outcome. **It is not a licence to touch `compose_address`,
  templates, or any migration.**
- **T7 — no `.toUpperCase()` on change, anywhere.** None of the three has one today. Do not add one to
  the State box "to help" — CR-83, and it is exactly what SIGNFLOW-B removed from two other doors.
- **T8 — `RANCHWORD`.** A later build renames barn → ranch app-wide (D43); `ContractPage.tsx` has 3
  `barn` hits. **Change nothing cosmetic or textual.** ORCH sequences the collision; you avoid it.

## 5. OUT OF SCOPE — do not touch
- 🔒 **Any address verification, lookup, autocomplete, "did you mean".** Locked NO (§1).
- **`src/lib/normalize.ts`, `src/lib/formState.ts`, `src/lib/normalize.test.ts`** — zero edits. No new kinds,
  no new keys. ⚠️ **In particular no `vet_*` keys** — the vet premises are a horse-record field on
  `ContractIntake.tsx:238-246` and `HorseIntakeForm.tsx`; a different record, a different decision, not
  made here. Report them as unwired in your reach inventory and stop.
- **`AccountInfoCard.tsx:138-153`** — the TENANT's own address; its `onBlur` already commits, so wiring it
  is normalise-then-commit in one handler, a different shape. Not this task.
- **The five doors SIGNFLOW-B wired** (`Onboarding`, `SignStart`, `ContactDossierModal`,
  `CaptureInfoModal`) — done, merged, not yours.
- **Any DB write, migration, backfill of existing rows. Any colour or copy.**

## 6. THE REACH — what a person clicks

| Door | Path | Who |
|---|---|---|
| 1a | `/app/ops/accounts/new` (`AccountInvitePage.tsx:30`, `source="new"`) → *Their details* | staff |
| 1b | Records → a person → **Contact dossier** → the invitation section (`ContactDossierModal.tsx:798` → `ClientInvitationSection.tsx:126`, `source="contact"`) | staff |
| 1c | the lead inbox / dashboard lead panel → **LeadWorkDrawer** (`DashboardPanel.tsx:546`, `IntakePage.tsx:167` → `LeadWorkDrawer.tsx:600`, `source="submission"`) | staff |
| 2 | `/app/contracts/:id/start` — reached from `/app/documents` → *Read* (`DocumentsContent.tsx:335`), from onboarding (`Onboarding.tsx:909`, `:1364`), or carried through registration (`Register.tsx:49`) — when the contract still needs the person's address | a party, signed in |
| 3 | `/app/contracts/:id` as staff, on a sale contract with co-buyer elected and unnamed → **Co-Buyer** card → leave the picker empty → the hand-entry grid | staff |

**Is that the only way?** The one `ProvisionClientForm` serves three hosts (1a–1c) — one edit covers all
three, **and your report must say which of the three you opened to prove it**. ⚠️ Re-run SIGNFLOW-B's
grep (`grep -rn 'address_line1\|address_street\|postal_code\|address_zip\|address_city\|address_state\|address_line2' src`)
and reproduce its ten-row table with today's states: **rows 5, 6, 7 → WIRED; rows 8 (deleted with
SIGNFLOW-D — confirm), 9, 10 → still not wired, with the reason from §5.**

## 7. THE TELL (D19)
The person watches the correction happen on blur; the undo is typing over it, and the `lastOutput`
guard guarantees it stays (`normalize.ts:116`). **Door 2 has a second tell:** the contract they open
next prints the address they just watched being corrected — that is D22 working, and §8 item 5 proves it.

## 8. THE TEST THIS MUST PASS
Using the owner's example, typed lowercase: `752 windemere ct` / `san diego` / `ca` / `92109`, plus a
lowercase name `pamela godde`, phone `6195551234`, email `Pamela@Example.COM`.

1. **Door 1** (any of 1a/1b/1c — name which): blur each → `752 Windemere Ct` · `San Diego` · `CA` ·
   `92109` · `Pamela Godde` · `(619) 555-1234` · `pamela@example.com`. Save, open the contact dossier, and
   **the stored value equals the shown value** on every field.
2. **Door 2**: same results on the 9 contact fields. The 4 **vet** fields do NOT normalise — report
   what you saw.
3. **Door 3**: same results on all 8 grid fields; after *Add co-buyer*, the party's dossier holds the
   normalised values.
4. 🔒 **Click-without-tab (T2):** on each door, type the ZIP last and click the submit button without
   leaving the field. The saved value is the normalised one. **Three doors, three observations.**
5. **D22 on door 2:** after submit, the contract body that opens prints `752 Windemere Ct, San Diego, CA
   92109` (via `compose_address`) — not the lowercase you typed.
6. 🔒 **The no-refight guard:** correct `Ct` back to `ct`, blur → stays `ct`. On all three doors.
7. **Must not change**, one blur each on a State box: `California` · `Baja California`; on a ZIP box:
   `SW1A 1AA`; on a city box: `SAN DIEGO`. Report each by its observed value.
8. `git diff --stat` shows **exactly three files** — the three named in §3a. `npx tsc --noEmit` 0 ·
   `npm run typecheck:api` 0 · `npm run lint` no new warnings (baseline 45w/0e at `b846b227`, and the
   `react-hooks` rule is the one that bites) · `npm run build` clean · `npm run test:api` 7/7 ·
   `npx vitest run src/lib/normalize.test.ts` still 42/42. ⚠️ `test:db` is red at baseline — do not report it.
9. **The reach inventory (§6) in your report as a table.**
10. **§3b reported under its own heading.**

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-G-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-G-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
