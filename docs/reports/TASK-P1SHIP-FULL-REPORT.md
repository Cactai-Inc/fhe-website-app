# TASK-P1SHIP — FULL BRANCH REPORT

**Branch** `task/p1ship` · **base** `origin/main @ 0b1b2bbe` · **9 commits, unpushed**
**32 files changed (+3,592 / −114)** — 19 code files, 12 migrations, 2 reports
**12 migrations APPLIED to production** (`lrstswfxfsezdmvkvukc`)
**Written 2026-08-25 for the orchestrator thread; §8 corrected ~21:00 — see the note there.** Companion:
`docs/reports/P1-CONTRACT-SHIP-REPORT.md` (the deep dive on the three P1 blockers).

> **READ §7 BEFORE MERGING.** There is exactly one merge conflict and its resolution
> is known and stated. There is also one point where I **disagree with the reviewer's
> findings in `docs/reports/P1-REVIEW-2026-08-25.md`** and did not make the change it
> recommends — §2.

---

## 1. COMMITS

| | commit | what |
|---|---|---|
| 1 | `d6372cc0` | P1 ITEM 1 — one invitation carries the contract, so one email goes out |
| 2 | `0c148427` | P1 ITEM 2 — ask only for what this contract needs, then open it |
| 3 | `22f9fc4c` | P1 ITEM 3 — a party reads the document, not the authoring surface |
| 4 | `e48a53fc` | docs: the P1 contract-ship report |
| 5 | `ddc144ba` | Close the 23-character wipe at its source (the drift report was wrong) |
| 6 | `1a01b783` | Fix the one-character-per-click bug on the horse record editor |
| 7 | `7ef51ce6` | "Other — enter manually" adds to the menu, and Haflinger is spelled right |
| 8 | `28e2ecb3` | Menus: every dropdown in the app, and its contents, in one editable place |
| 9 | `8f4a3bb3` | Forms version on change too, so fields can be edited, added and removed |

Commits 1–4 are the P1 assignment. 5–9 are the follow-up round.

---

## 2. ⚠️ WHERE I DISAGREE WITH THE REVIEW — THE DRIFT GUARD IS NOT BROKEN

`docs/reports/P1-REVIEW-2026-08-25.md` says `regenerate_contract_document`'s
template-drift guard "protects the value it RETURNS and destroys the value it
STORES", and recommends fixing it before pushing. **I did not, because it cannot
happen, and I have the run to show it.**

Both mergers end their write the same way:

```sql
-- remerge_contract_from_fields, step 7 "never rewrite an executed body"
UPDATE documents SET merged_body = v_body
 WHERE id = p_document_id AND workflow_state <> 'executed';
-- remerge_contract_from_clauses, same clause
UPDATE documents SET merged_body = v_body WHERE id = … AND workflow_state <> 'executed';
```

The drift guard only evaluates **when the document is executed**. The destructive
write only lands **when it is not**. The two conditions are mutually exclusive by
construction.

**Armed all three stated conditions on the live lease** (executed · clause-composed ·
`signed_template_version` 1 vs template version 3) and ran the exact call the contract
page makes on open:

```
regenerate_contract_document      returned 25739, STORED 25739   ← body intact
remerge_contract_from_fields      returned    23, STORED 25739   ← the write is filtered out
fill_party_fields_from_contacts   (alone)         STORED 25739
```

The review read the **return value** and took it for the stored value. Changing a
function that runs on every contract open, to fix a defect that does not exist, is
the actual risk — so the drift guard is untouched.

**Two smaller corrections to the same section.** It says ten database functions call
`fill_party_fields_from_contacts`; it is **nine** — the tenth
(`sync_contract_fields_from_defs`) only names it in a comment. And all nine
recompose safely afterwards in the same transaction, so none was ever exposed.

**The underlying concern was still right, and §3 acts on it.**

---

## 3. THE 23-CHARACTER WIPE, FIXED AT SOURCE — `20260825T1700`

`remerge_contract_from_fields` composes from `contract_templates.body`, which is
`(composed from clauses)` — 23 characters — for every clause-composed template
(`HORSE_LEASE_V2/_FULL/_SIMPLE/_STANDARD`, `HORSE_SALE_V2`, `HORSE_BILL_OF_SALE`).
The other 20 templates carry a real body of 3,732–18,253 characters.

Two functions **ended** on that call. Nothing was ever lost, but by luck: every
database caller happens to recompose immediately afterwards. That is a property of
nine call sites, not of the function.

- `fill_party_fields_from_contacts` now leaves a clause-composed document alone (its
  fields are updated; the caller recomposes) and still merges flat templates, where
  `remerge_contract_from_fields` is the correct composer.
- `capture_horse_record_info` goes through `remerge_contract_body`, the dispatcher.
  It has **no** database caller — only `captureHorseRecord` in the app, across two
  transactions, so its repairing re-merge could not roll back with it. **That was the
  one genuinely reachable window.**
- The two TypeScript callers (`captureContactInfo`, `captureHorseRecord`) now make a
  single `regenerate_contract_document` call instead of a two-RPC fill-then-repair.

**Verified after applying:** fill alone, `capture_horse_record_info` alone, and a full
regenerate all leave the live lease at 25,739 characters.

---

## 4. THE P1 BLOCKERS (detail in `P1-CONTRACT-SHIP-REPORT.md`)

**ITEM 1 — one email.** `/api/contract-invite` branches on whether the counterparty
has an account. No account → `invite_contract_party_account` reuses their COMMUNITY
invitation (**including Pamela's saved draft — same token, nothing superseded**),
stamps `document_id`, and sends one extended `INVITATION` email.
`redeem_contract_invitation` and the `CONTRACT` kind untouched for the case they serve.

**ITEM 2 — the intake gate.** `contract_intake_requirements` reads the tokens *this
template actually prints* and reports only those whose record is empty.
`/app/contracts/:id/start` shows only those fields and forwards straight to the
document when nothing is missing. `my_onboarding_state` gained `contracts_waiting`,
now the fourth condition on "Nothing to do here" (CR-64).

**ITEM 3 — the party's view.** `PartyDocumentView` renders `merged_body` through
`ContractBody`. **Required widening the item**: `reviewOnly` used to strip every
control the moment the last required question was answered, which makes "changing a
selection changes the text immediately" unreachable as written.

---

## 5. THE FOLLOW-UP ROUND

### 5.1 Focus bug — one character per click (`1a01b783`)

`RecordEditor` defined its field components **inside its own body**. A function
expression in a component body is a new function every render, and React identifies
an element by its `type` — a reference compare — so a new function is a *different
component*: it unmounts the subtree and mounts a fresh one. Typing set state →
re-render → new `T`/`L` → the real `<input>` DOM node destroyed and rebuilt → focus
went with it. Hoisted to module scope as `RecordField`/`RecordSelect`. `useCallback`
would not work: its deps must include the state that changes every keystroke.

**Swept all of `src/` for every way focus dies** — nested definitions, value-derived
`key`s on inputs, components built with `useMemo`, `autoFocus` inside a map.
**Exactly one real instance.** Three more nested definitions in `HorseIntakeForm` are
the same anti-pattern but were **not** stealing focus: they wrap the *label*, and the
input is a *sibling*, so React remounts the label and leaves the input alone. Hoisted
anyway.

### 5.2 Why contracts only printed list values — it is a FOREIGN KEY (`7ef51ce6`)

Not the document engine. `horses.breed` and `horses.color` reference their lookup
tables' `code`, so a typed-in value has no matching row, the FK rejects the whole
patch, and nothing is saved for the document to import. `horse_field_token_value`
already does `coalesce((SELECT display_name … WHERE code = …), v_horse.breed)` — it
would print free text happily if a column could hold it, which is exactly why farrier
and vet (plain text, no key) have always worked.

`add_lookup_value` makes the typed value a real menu entry and returns the **code**.
Proven end to end: "Rocky Mountain Horse" → entry created → FK satisfied →
`horse_field_token_value` prints "Rocky Mountain Horse". Allowlisted to the five
horse-intake vocabularies, which is what *"only apply this to horse intake for now"*
means in code rather than in a comment. Callable by any signed-in user deliberately —
the person filling a horse intake is usually a client, and the alternative is a save
that fails with nothing on screen to fix.

**Case-insensitive dedupe is the point.** `lookup_suggestions` held
`horse_breeds/Haflinger` **seen 3× and dismissed** beside `horse_breeds/Halfinger`
seen once and **promoted** — the typo became the official breed while the correct
spelling was thrown away three times.

**Spelling** (`20260825T1710`): both code and display name corrected; the FK is
`ON UPDATE CASCADE` so the one horse carrying it followed automatically.
**Duplicate "Other"**: `OTHER / "Other / Crossbred"` switched off (FK target, zero
horses reference it); the control's own escape moved to the top of the dropdown.
`PONY / "Pony (other)"` left alone — a real classification, not a duplicate.
**Alphabetical** by display name, replacing the curated `sort_order` that had
Warmblood at 1 and Haflinger at 900; `NONE` codes pinned first, because "No passport"
is the absence of a value, not a value filed under N.

### 5.3 Menus — 124, not 5 (`28e2ecb3`)

| kind | count | had an editor? |
|---|---|---|
| shared vocabularies (breed, colour, markings, registration org, passport country) | 5 | no — `/app/ops/lookups` is the **suggestion queue**, not the lists |
| form option lists inside `form_definitions.schema` | **119** | **none at all** |

A vocabularies-only editor would have missed 96% of the menus. New page at
**Settings → Menus** (`/app/ops/admin/menus`) covers both from one `menu_inventory()`.
Renaming moves the **words** and never the code (records point at it); retiring is
switching **off**, never deleting (FK targets); switched-off values stay visible,
because an editor that cannot see what it turned off cannot turn it back on.

### 5.4 Forms version on change (`8f4a3bb3`) — **you were right, it just was not built**

> *"we established that changes create versions of the file they are changing for
> forms and docs, so nothing can be orphaned."*

True for **documents**: 67 rows pinned to `signed_template_version`, supersede-and-retain,
the drift guard, `template_version_events`. **Never built for forms:**
`form_definitions` held 28 rows / 28 distinct `form_key` (UNIQUE) and
**`max(version)` = 1 — never incremented once.** No history table.
`booking_forms.answers` keyed by field `key`, pointing at that one mutable row.
`set_form_required` had been writing schemas and leaving `version` alone, which is why.

Built: `form_definition_versions` (shaped after `content_block_versions`, the incumbent
idiom; seeded v1 ×28), `booking_forms.form_version` (stamped in `_ensure_booking_form`,
backfilled ×47), and `snapshot_form_definition` called at the **top** of every mutator.
Then `edit_form_field` (label, type, **and the key**), `add_form_field`,
`remove_form_field`, with per-field edit/remove and a per-section add row on the Forms
page.

**Proven against production data, rolled back** — removed a field carrying real answers:

```
live form      → v2, field gone
v1             → RETAINED, all 4 sections
the answer set → still names v1, answers intact
removed field  → "Instructor notes (the rider sees this)" — still resolvable against v1
```

**Prod now: 28 versions retained · 47 answer sets stamped · 0 unstamped.**

---

## 6. VERIFICATION

```
npm run typecheck      0 errors
npm run typecheck:api  0 errors
npm run lint           0 errors, 48 warnings  ← identical to origin/main's 48
npm run build          ✓ clean, prerender + sitemap
```

The one warning this work introduced (a non-component export from
`PartyDocumentView`) was removed rather than accepted.

**`npm run test:db` — red at baseline, unchanged by this branch.**

| | files | tests |
|---|---|---|
| `origin/main` | 51 failed / 27 passed | 193 failed / 608 passed / 107 skipped |
| `task/p1ship` | 51 failed / 27 passed | 193 failed / 608 passed / 107 skipped |

Byte-identical. The harness loads a committed schema snapshot rather than replaying
migrations, so it does not observe function-body changes at all. Production behaviour
was verified directly against the live database instead.

**All 12 migrations** were dry-run in `BEGIN; … ROLLBACK;`, applied, and verified with
a query. The two that rewrite existing functions (`redeem_invitation`,
`my_onboarding_state`) are written as full `CREATE OR REPLACE` bodies generated from
the live definitions, so they are replayable on a fresh database — unlike the ~31
pre-existing in-place rewrite migrations CLAUDE.md flags.

---

## 7. ⚠️ MERGING — ONE CONFLICT, KNOWN RESOLUTION

`origin/main` has moved **23 commits** since this branched. A trial merge produces
**exactly one conflict**:

```
UU src/pages/app/HorsePage.tsx
```

**Cause.** Main's `1b90dc79` renamed one label:
`"Registered name"` → `"Full Name (registered name, if registered)"` — on the very
line this branch deleted when it replaced 22 hand-placed elements with a map over the
`TEXT_FIELDS` table (the focus fix, §5.1).

**Resolution.** Keep this branch's hoisted structure; carry main's new label into the
table:

```ts
const TEXT_FIELDS = [
  { k: 'nickname', label: 'Nickname' },
  { k: 'registered_name', label: 'Full Name (registered name, if registered)' },  // ← main's wording
  …
```

⚠️ **Do not resolve by taking main's side of the hunk** — that restores the nested
`T`/`L` components and brings the one-character-per-click bug back.

`src/components/app/HorseIntakeForm.tsx` merges clean (main's edit is on a `Field`
line this branch did not touch). No migration conflicts — all 12 filenames are new.

I did not merge, because the merge is the orchestrator's call.

---

## 8. NOT BUILT / NOT VERIFIED — the honest list

> ⚠️ **CORRECTION, 2026-08-25 ~21:00.** Items 1 and 2 below originally said Pamela had
> no lease. **That was stale, and the staleness was mine.** I gathered her data at
> ~16:20 and wrote the report at ~20:00 without re-reading it. The owner assigned the
> lease to her at **19:45** and made Sundance hers at **19:40**. The corrected state
> and a full rehearsal on her real records are in §8.0. This is the exact failure mode
> my own notes warn about — verify before asserting, and re-verify before reporting.

### 8.0 ✅ PAMELA IS SET UP — rehearsed end to end on her real records

| | |
|---|---|
| contact | `f80e944a…` Pamela Godde · `pgodde@earthlink.net` · phone on file · **address blank** |
| account | **none yet** — no `profiles` row, no `auth.users` row. Correct: that is what the invitation is for. |
| lease | `7adcd08f…` *Horse Lease Agreement — Standard*, `editable` — **Pamela is LESSOR**, FHE is LESSEE |
| horse | **Sundance** `19ece013…` — attached to the lease, `current_owner_contact_id` = Pamela |
| invitation | one row, still `draft`, `document_id` NULL — nobody has pressed send yet, which is the act that stamps it |

**Rehearsed against production inside `BEGIN; … ROLLBACK;`** — the real send, then a
simulated claim, then the gate:

```
STEP 1  staff send the contract to the Lessor
        → {"reused": true, "invitation_id": "2735fd45…", "document_id": "7adcd08f…"}
        → her invitation rows: 1 · now sent: 1 · carrying the lease: 1 · superseded: 0
          (her SAVED DRAFT is promoted in place — the link staff already hold is the
           link she receives)

STEP 3  what she is actually asked for, as LESSOR on this lease:
        contact.missing → [ Mailing address ]
        horse.missing   → [ Veterinarian — address ]   (Sundance's record)
        …and nothing else. Name, email and phone are on file and are not asked;
        Sundance's farrier and vet name/phone are on file and are not asked.
```

That is the owner's acceptance criterion, on the real data: *"she is prompted with an
intake page to add the missing information we need for the contract, this applies to
both her account and her horse record."*

**None of this was written by my rehearsals.** Every one rolled back, and the two
changes that define the new state — `documents.horse_id` and
`horses.current_owner_contact_id` — are columns **no command I ran ever touched**.

1. ❌ **Nobody has clicked the link in a browser.** Every seam is now proven at the
   data layer, on Pamela's own records, and the build compiles — but no end-to-end
   walk has been done, and pressing send emails a real client. **This is the one
   remaining thing.** Steps are at the end of `P1-CONTRACT-SHIP-REPORT.md`.
2. ✅ *(was: "Pamela has no lease document")* — **superseded by §8.0.**
3. ⚠️ **Horse IDENTITY fields are not on the contract intake page** (breed, colour,
   sex, microchip). It writes through `capture_horse_record_info`, the one existing
   path, which covers farrier and vet only. Identity comes from the horse record via
   the contract page's own `HorseGate`. Building a second horse writer is the
   duplicate-implementation defect this codebase keeps removing.
4. ⚠️ **No horse-attach on the intake page** — same reason; `HorseGate` owns it, and
   `Continue` lands where it runs.
5. ⚠️ **Alphabetical — the ruling arrived, and half of it is outstanding.**
   Owner, 2026-08-25: *"the alphabetical was only relative to things like menus and
   pages that show content like client lists horses etc… documents should probably be
   chronological or grouped by client or type or filtered based on status."*

   | | state |
   |---|---|
   | menu vocabularies | ✅ done — the only ordering this branch changed |
   | content lists (clients, horses, …) | ❌ **not done** — in scope per the ruling, not built |
   | documents | ✅ correctly untouched — and per the ruling should be chronological / grouped / filtered, which is a separate design task |
   | deliberately ordered lists (workflow steps, `onboarding_order`, role rank, signing order) | ✅ untouched, and must stay that way |

   Audited: this branch contains exactly three ordering changes, all three in the menu
   vocabulary readers (`listHorseBreeds`, `listHorseColors`, `listLookupOptions`), plus
   `pinNone`. No client, horse or document list was reordered.
6. ⚠️ **Form section editing** (add/rename/reorder sections) is not built; fields
   within existing sections are.
7. ⚠️ **`test:db` is 51 files red on `main`** and out of this branch's scope, but it
   means the DB suite is not currently a safety net for anyone.
8. ⚠️ **`add_lookup_value` is callable by any signed-in user** (allowlisted to the
   five horse-intake keys). Deliberate — see §5.2 — but it is a real widening: a
   client can add a breed. The Menus editor is the control for it.
9. ℹ️ **`horse_breeds` / `horse_colors` have no `org_id`.** They are global, not
   tenant-scoped. Single-tenant today; worth knowing before a second tenant exists.

---

## 9. STANDING RULES OBSERVED

Migrations dry-run then applied then verified · no tenant facts hardcoded ·
`invitations.token` never rendered on a non-staff surface or logged · every new
function `REVOKE`d from `PUBLIC`/`anon` (Postgres grants it by default here and this
schema has no `ALTER DEFAULT PRIVILEGES`) · `.env`, `.env.db` and the `node_modules`
symlink removed before every commit — verified absent from all 9 commits · no
subagents used.
