# TASK-RANCHWORD-A — every rendered "barn" says what it actually means: the ranch, or the program

**Spec by `FHE-TASK-RANCHWORD` (DSNR profile), 2026-09-02. Owner directive CR-108, same day — see §1.**
**Thread name: `FHE-TASK-RANCHWORD-A`.**
**Applies D43. Supersedes the open items SITECOPY-B's report left (§6b, §7). Independent of every
live thread — see §5 for the one directory it must not touch.**

🔒 **THIS IS A COPY SWEEP WITH TWO SMALL DB MIGRATIONS INSIDE IT. IT ADDS NO MECHANISM.** ⚠️ **The
headline finding is that the word "barn" is used in TWO SENSES in this app, and only ONE of them
is the ranch. Read §3 before you touch anything — substituting "ranch" into the other sense
restates the exact misnomer the owner called out.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` §3 · `docs/method/THE-RUNNING-RECORD.md`
>   (open `docs/reports/FHE-TASK-RANCHWORD-A-LEDGER.md` FIRST).
> - `CLAUDE.md` **D43** (`:983`) — the ruling this applies. **D38** (`:934`) — the business is a
>   PROGRAM, never "the barn". **D13** (`:273`) — owner-editable text stays owner-editable.
>   **D17** (`:365`) — reachable or not done. **D18** (`:376`) — converge on the existing mechanism.
>   **D32** (`:780`) — nothing is removed from the database; **executed documents are never rewritten.**
> - `docs/reference/CHANGE-ORDER-LEDGER.md` **CR-108** (`:4380`) and **CR-109** (`:4391`) — the
>   ruling and the review that holds the Barn Ops name.
> - `src/lib/propertyTerm.ts` — **whole file, 75 lines.** The shape and the sentence builders.
> - `docs/reports/TASK-SITECOPY-B-REPORT.md` §6–§7 — the open items this task closes, and the
>   probe (`test/browser/probe-sitecopy-b.mjs`) whose `noBarn()` assertion you will extend.
> - `docs/tasks/TASK-SITECOPY-B-the-app-stops-calling-itself-the-barn.md` §4 (THE TRAPS) — every one
>   still applies to any sentence you rebuild from the term shape.
> - 🔒 **The two ACL traps, before you write a migration:** memory/CLAUDE.md — *"DROP+CREATE resets
>   function ACLs"* and *"REVOKE FROM PUBLIC is not enough — default privileges re-grant anon on
>   fresh functions."* **Use `CREATE OR REPLACE`. Never `DROP FUNCTION`. Assert the ACL after.**
> - `scripts/emailextract/bodies.mjs:1-15` — it is the SOURCE that `diff.mjs` proves the database
>   against. **A description changed in the DB and not there fails the proof.**

---

## 1. THE OWNER'S WORDS

> *"We refer to our location as Ranch not barn. rename everywhere, this is FHE v1 specific and thats
> ok. For the v2 build the setup onboarding for a tenant will ask them to choose their own
> terminology for things like this. We technically dont have 'barn ops' we dont own or run the
> ranch, we board there and rent a tackroom and run our business from there with permission from the
> owner."* — owner, 2026-09-02 (CR-108)

**Two things are said here, and the second governs the first.** The location is the ranch. **AND
FHE does not own or run it.** So a sentence about the LOCATION takes the ranch word; a sentence
about the BUSINESS — what "runs", what "has requested", who "gets a copy" — must not, because
"the ranch has requested to terminate this contract" is false in exactly the way "Barn Ops" is.

## 2. WHAT WAS MEASURED — by DSNR on 2026-09-02, `main` at `b846b227`, and prod read-only

`grep -rn -i "\bbarn" src --include='*.tsx' --include='*.ts' | grep -v -i "barnops\|barn_ops\|BarnOps"`
→ **109 lines in 48 files.** Every line was read. **Re-run it; the classification below is the
spec, the count is the tell that nothing moved.**

### 2a. RENDERED, FHE speaking about ITSELF — **IN SCOPE** (the work)

| # | Where | Rendered today | Sense | Replacement |
|---|---|---|---|---|
| 1 | `src/App.tsx:509` | `description="Configuration for how the barn runs."` (Settings hub, `/app/ops/settings`) | BUSINESS | `Configuration for how the program runs.` — a literal edit. **SITECOPY-B's §5 held this back because a router prop cannot call a hook; it does not need one.** |
| 2 | `src/pages/app/ops/ContactsPage.tsx:607` | `placeholder="Left the barn, duplicate record, test identity…"` (archive-reason field) | BUSINESS | `Left the program, duplicate record, test identity…` |
| 3 | prod fn `feed_seed_welcome` (`test/db/fixtures/schema_snapshot.sql:12403-12420` mirrors it) | `'… new horses, gear, and moments from the barn land here. …'` | **LOCATION** | compose from `resolve_property_term(v_org)`: `'… moments from ' \|\| (t->>'article') \|\| ' ' \|\| (t->>'term') \|\| ' land here. …'` → *"moments from the ranch land here"* |
| 4 | prod `email_templates` `CALENDAR_DAY_SHEET` — `title` **and** `subject` | `Today at the barn (ops inbox)` / `Today at the barn — {{MSG.COUNT}} session(s)` | **LOCATION** | `Today at the ranch (ops inbox)` / `Today at the ranch — {{MSG.COUNT}} session(s)`. **A data `UPDATE`, FHE-v1-specific by the owner's own words.** No `ORG.PROPERTY` email token exists (`api/_lib/emailTemplates.ts` knows `ORG.BRAND_NAME` only) and inventing one is a mechanism — out of scope, recorded as v2 debt in §7 of the handoff. |
| 5 | prod fn `dash_activity_readback` (source: `supabase/migrations/20260822T0940_dashboardbuild_5_…sql:316`) | `CASE WHEN dd.is_mirror THEN 'copy to the barn' ELSE 'to the recipient' END` | BUSINESS | `'copy to the ops inbox'` — that is literally where a mirror delivery goes. |
| 6 | prod fn `request_contract_termination` (snapshot `:22160-22198`) | `'The barn has requested to terminate this contract. …'` (notification body the CLIENT reads) | BUSINESS | `(SELECT o.name FROM organizations o WHERE o.id = v_org) \|\| ' has requested to terminate this contract. …'` → *"French Heritage Equestrian has requested …"* |
| 7 | prod fn `void_document` (snapshot `:29471-29496`) | `'The barn'` ×2 — the actor label when a staff voider has no contact name | BUSINESS | the same `organizations.name` lookup. |
| 8 | prod `email_templates.description` for `SUPPORT_RECEIVED`, `CALENDAR_OPS_DIGEST`, `REQUEST_RECEIVED` **and** `template_tokens.notes` for `ORG.FOOTER_HTML` | *"so the barn hears about it"* · *"so the barn sees everything coming up"* · *"mailed to the barn immediately so the owners see"* · *"the two barn-facing emails"* | BUSINESS (editor-only meta text the owner reads) | *"so the owners hear about it"* · *"so the owners see everything coming up"* · *"mailed to the ops inbox immediately so the owners see"* · *"the two inbound, staff-facing emails"*. ⚠️ **`description` is not owner-editable** (`email_template_save_draft(p_email_key, p_subject, p_body)` — measured) **so this is ours to fix, by migration, AND in `scripts/emailextract/bodies.mjs:346,359,389` so `diff.mjs` still proves.** |

**Horse "barn name" — the NICKNAME sense.** A third sense, already ruled: the owner rejected the
label "Barn name" for the horse's nickname twice (`git show 3b46419f`, 2026-08-24, "the label is
Nickname"). Two survivors still RENDER and are reachable:

| # | Where | Rendered today | Replacement |
|---|---|---|---|
| 9 | `src/pages/app/CareHome.tsx:90` (`/app/care`, `App.tsx:317`) | `Barn: {h.nickname}` | `Nickname: {h.nickname}` |
| 10 | `src/lib/horses.ts:386` → rendered by `HorseIntakeForm.tsx:854` in the "missing" list | `'Name (registered or barn)'` | `'Name (registered or nickname)'` |

### 2b. RENDERED, but NOT FHE's location and NOT FHE's business — **LEAVE, and say so in the report**

| Where | Rendered | Why it stays |
|---|---|---|
| `HorseIntakeForm.tsx:435-438` (`Barn (blank if outdoor)`, prefixes `['Barn','Stable']`) + `:1110` (`show, vet, another barn`) + `:319` (`123 Barn Rd`) | a BUILDING at whatever property the horse stands on; `home_barn`/`current_barn` columns | a barn is a structure; the ranch has barns. Not the location word. |
| `src/lib/acquisition.ts:64`, `src/pages/Checkout.tsx:258` (`Barn / property address`), `src/lib/questionSets.ts:462` (`City, or the barn it is kept at`) | asks where the CLIENT's horse is | the client's place, not ours. |
| `ContactsPage.tsx:77` (`affiliated barns`) | other businesses | industry shorthand for other people's operations. **Listed in the handoff as an optional owner call; do not guess a word.** |
| `src/pages/About.tsx:88` (`the best barns are not really about the riding`) | generic, public | SITECOPY-A read it and left it (its report §4). Same call. |
| `ProvisionTenantPage.tsx:285`, `AdminBrandingPage.tsx:186` | *"Barn, ranch, stables, grounds, facility — …"* | the vocabulary list the mechanism offers. |
| prod `contract_templates` (10 bodies) / `contract_clause_defs` (2) | *"any ranch, barn, arena, stable, tack room, trail …"*, *"barn aisles"*, and `Barn Name: {{HORSE.BARN_NAME}}` | generic lists, and the equine-document label for a horse's nickname. Owner-editable in the wording editor (D13); executed bodies are evidence (D32/D33). **Optional ASK-OWNER in the handoff.** |
| `property_terms` row `BARN`, `template_tokens` `HORSE.BARN_NAME` (4 rows) | vocabulary and a token | data, not copy. |
| `src/lib/seed.ts:153,172` (`Summer barn dinner`) | `SEED_ENABLED = false` (`seed.ts:10`) | never renders. |

### 2c. HELD FOR CR-109 — **DO NOT OPEN THESE FILES** (§5)

Every "barn" under the Barn Ops module, name AND sentence copy alike:
`src/components/app/AppLayout.tsx:639` · `src/lib/pageRegistry.ts:115,298` ·
`src/pages/app/AccountHub.tsx:235` · `src/pages/app/ops/OpsDashboard.tsx:117` ·
`src/pages/app/ops/hubs/BarnopsHubPage.tsx:81,86,88` · `src/pages/app/ops/barnops/ResourcesPage.tsx:369` ·
`…/ConsumptionLogPage.tsx:133,210,218,311` · `…/AllocationRulesPage.tsx:102,290,344,352,413,478` ·
prod fn `resolve_consumption_billing` (RAISE text *"no default/barn payer"*).
**Why whole and not just the name:** CR-109 is a layout/inclusion review of these exact pages, and
their "barn payer" means the BUSINESS payer — a finding CR-109 must rule on. Renaming their copy
twice is waste; renaming it wrong is worse.

### 2d. NOT RENDERED — comments, identifiers, tests — **LEAVE**

`barnToday()` and `BARN_TZ` (`src/lib/recordedDate.ts`, `api/orders-mark-paid.ts:85`) and every
`--`/`//`/`/* */` line — 60-odd lines. **Renaming identifiers or rewriting comments inflates the diff
and hides the ten real edits.** Test fixtures that say "barn" (`test/db/creditgrant_…:171`) are test
data and stay.

### 2e. The mechanism, re-measured
- `usePropertyTerm()` — `src/contexts/BrandProvider.tsx:135-140`; **19 consumer files today**
  (`grep -rln usePropertyTerm src`). Falls back to `DEFAULT_PROPERTY_TERM` = RANCH (`propertyTerm.ts:28-34`).
- DB side: `resolve_property_term(p_org uuid) → jsonb {key, term, article, plural, preposition}`,
  reads `config_values(namespace='PROPERTY', key='TERM_KEY')`, falls back to FACILITY. `my_property_term()`
  wraps it for the caller. **`feed_seed_welcome` already has `v_org` in hand — it is one expression.**
- Prod `property_terms`: BARN · FACILITY · GROUNDS · RANCH · STABLES.
- `email_templates` triggers on UPDATE: `audit_email_templates`, `email_templates_set_updated_at`. **No
  versioning trigger — a migration `UPDATE` of `title`/`subject`/`description` is the same act the
  original seed migration performed (`20260826T1710_the_start_of_day_email.sql` upserts the row).**

## 3. THE INCUMBENT, NAMED (D18) — convergence, three ways, and one deliberate non-adoption

- **Location sense → the existing term mechanism.** Client: `usePropertyTerm()` + the builders in
  `propertyTerm.ts`. DB: `resolve_property_term(v_org)`. **Nothing new.** ⚠️ **Only #3 and #4 are this
  sense. There are no location-sense strings left in `src/` — SITECOPY-B took all five. Do not
  manufacture adoptions to make the sweep look bigger.**
- **Business sense → the D38 word "program" in prose (#1, #2), the org's own `organizations.name`
  where a sentence names a PARTY (#6, #7), and the plain fact where one exists (#5, #8).** ⚠️ **NOT
  the property term.** "Configuration for how the ranch runs" says FHE runs the ranch. It does not.
- **Nickname sense → the word the owner already chose, "Nickname" (#9, #10).** Fixed word, no hook.
- **#4's title/subject is a hardcoded "ranch" on purpose** — the owner said FHE v1 may be; the
  tenant-neutral fix is an `ORG.PROPERTY` email token, which is a mechanism for v2. Say so in the report.

## 4. THE TRAPS

1. ⚠️ **The sense trap — the reason this spec exists.** `s/barn/ranch/` on #1, #2, #5, #6, #7, #8
   produces sentences that are FALSE ("the ranch has requested to terminate this contract"). Each
   row in §2a names its sense; **use the replacement column, not a regex.**
2. 🔒 **`DROP FUNCTION` resets the ACL.** #3, #5, #6, #7 are `CREATE OR REPLACE FUNCTION` with the
   IDENTICAL signature. Then assert, in the migration itself:
   `SELECT has_function_privilege('anon', 'feed_seed_welcome()', 'EXECUTE')` (and the other three,
   with their real argument lists) — **each must equal what it equals on prod TODAY. Measure that
   before you write the migration and put both numbers in the report.**
3. ⚠️ **`feed_seed_welcome` writes a row; the wording change must not change WHEN it writes.** Change
   the string expression only. Its idempotence guard (whatever it is — read it) is untouched.
4. ⚠️ **`request_contract_termination` and `void_document` are SECURITY DEFINER paths on documents.**
   You are changing one string expression in each. **If the diff of `pg_get_functiondef` before/after
   is more than the string lines, stop and say why.**
5. ⚠️ **`bodies.mjs` and the DB must not disagree** (`scripts/emailextract/bodies.mjs:1-8`). #8's
   three descriptions change in the migration AND in `bodies.mjs`, same commit, and `node
   scripts/emailextract/diff.mjs` (read its header for how it is run) must pass after. **Do not edit
   the applied seed migration `20260812T2010_emailextract_seed.sql`; write a new one.**
6. ⚠️ **Sentence-shape traps carried from SITECOPY-B §4** apply to #3: build from `article`+`term`,
   never a bare noun; a plural tenant word must still read grammatically ("moments from the stables
   land here" — fine, "land" agrees with "moments"). Prove it with the STABLES row in the harness.
7. ⚠️ **#1 lives in `src/App.tsx`.** SITECOPY-B was forbidden that file; you are not, but it is one
   literal on one line. **A diff to `App.tsx` of more than one line is a failed report.**
8. ⚠️ **`CareHome.tsx:90` shows the nickname only when it differs from the name.** Reach it with a
   horse whose nickname is set and different (D17) — do not conclude "not visible" from a horse
   without one.
9. ⚠️ **The migration harness is the proof, not `tsc`** (memory: *TS-clean ≠ DB-clean*). Run the
   `test/db` PGlite harness against the new migrations before you claim they apply.
10. 🔒 **Nothing in §2c. Nothing in §2b.** The urge to "tidy while you are there" is how CR-102's
    568-reference sweep happened. **Scope narrows; it does not widen.**

## 5. OUT OF SCOPE, EXPLICITLY

- 🔒 **The Barn Ops module — name, nav rows, hub, three pages, its RPC's RAISE text (§2c).** Held for
  CR-109. **Do not open `src/pages/app/ops/barnops/`, `…/hubs/BarnopsHubPage.tsx`, `pageRegistry.ts`,
  `AppLayout.tsx`, `AccountHub.tsx`, `OpsDashboard.tsx`.** If a grep you run shows "barn" in them,
  that is expected; list it under §2c in the report.
- **Everything in §2b and §2d.** Listed there with the reason. Report them as "read, left".
- **The mechanism** — `propertyTerm.ts`, `BrandProvider.tsx`, `AuthContext.tsx`, `resolve_property_term`,
  `my_property_term`, the `property_terms` rows. You consume; you do not change.
- **An `ORG.PROPERTY` email token, or any new token.** v2 debt, recorded in the handoff.
- **Contract wording** (`contract_templates`, `contract_clause_defs`) and every `documents` row.
- **Identifier renames** (`barnToday`, `BARN_TZ`, `home_barn`, `HORSE.BARN_NAME`).
- **`scripts/emailextract/gen-seed.mjs` regeneration of the old seed.** New migration only.

## 6. THE REACH — what a person clicks

| # | Path, end to end | Only way? |
|---|---|---|
| 1 | staff → Account → Settings card → `/app/ops/settings` (`App.tsx:508-510`); the description sits under the heading | yes |
| 2 | staff → Records → a contact → Archive → the reason field's placeholder | yes |
| 3 | a NEW member's first feed load — `feed_seed_welcome()` runs once per user. **Seen once, by a new account. Prove it by calling the function for a fresh test user in the harness and reading the row, then render `/app` for that user.** | yes |
| 4 | the 07:00 Pacific day-sheet email to hello@ — subject line; the Templates editor row title (`EmailSurface.tsx:63-64,97`) | the editor is the only place it is seen on demand |
| 5 | Business dashboard → activity read-back → a mirrored delivery row | yes |
| 6 | a client's bell/notifications after staff requests termination on their contract | yes |
| 7 | a document's comment/void trail when the voiding staff member's contact has no full name | the fallback branch only — force it in the harness |
| 8 | Templates editor → email list → description line (`EmailSurface.tsx:97`) | yes |
| 9 | member → `/app/care` → horse card, nickname ≠ name | yes |
| 10 | staff → horse intake → completeness "missing" list when the name is missing | yes |

## 7. THE TELL, AND HOW IT IS UNDONE (D19)

**No D19 flags.** Nothing here moves value or changes who can do what. The tell is the rendered
sentence; the undo for code is `git revert`; the undo for the two data `UPDATE`s is the reverse
`UPDATE` (write it as a comment at the foot of the migration); the undo for the four functions is
`CREATE OR REPLACE` with the prior body (the snapshot has it). **State this in the report rather than
omitting the section.**

## 8. THE TEST THIS MUST PASS

1. **`grep -rn -i "\bbarn" src --include='*.tsx' --include='*.ts' | grep -v -i "barnops\|barn_ops\|BarnOps"`
   returns 109 − 5 = 104 lines** (#1, #2, #9, #10 gone; #10's file loses one) — paste it, and every
   remaining line is in §2b or §2d. ⚠️ **A remaining line in neither is a FAIL.** *(If your count
   differs, say why — main moved, or the spec miscounted. Do not force the number.)*
2. **`test/browser/probe-sitecopy-b.mjs` still passes**, and its `noBarn()` assertion is added to
   `/app/ops/settings` and `/app/care` (with a nicknamed horse). Paste the probe output.
3. **Prod-shape proof for the four functions, in the `test/db` harness:** `feed_seed_welcome` yields
   *"moments from the ranch land here"* under RANCH and *"moments from the stables land here"* under
   STABLES (set `config_values` PROPERTY/TERM_KEY for the test org); `request_contract_termination`'s
   notification body begins with the org's `name`; `void_document`'s fallback label is the org's
   `name`; `dash_activity_readback` emits `copy to the ops inbox` for a mirror delivery.
4. **ACL before/after, for all four functions, from prod:** the `has_function_privilege` row for
   `anon` and `authenticated` is identical before and after the migration. **Both readings in the
   report.** ⚠️ **A changed reading is a FAIL even if the "after" looks safer** — that is a different
   task.
5. **`pg_get_functiondef` diff before/after for each of the four is only the string lines** (TRAP 4).
   Paste the diffs.
6. **`email_templates` after migration:** `CALENDAR_DAY_SHEET.title` = `Today at the ranch (ops inbox)`,
   `.subject` = `Today at the ranch — {{MSG.COUNT}} session(s)`; the three descriptions and the
   `ORG.FOOTER_HTML` notes read as §2a #8; **`node scripts/emailextract/diff.mjs` passes.**
7. **`git diff --stat` shows `src/App.tsx` at exactly 1 line changed**, and NO file from §5.
8. **`npm run build`, typecheck, lint, and the `test/db` harness green.** Paste the harness summary.
9. **The report's "read, left" table lists every §2b and §2c line by `file:line`** — so ORCH can
   verify the sweep was a sweep and not a sample.

## 9. WHERE THE REPORT GOES

`docs/reports/TASK-RANCHWORD-A-REPORT.md`, per `docs/method/TASK-ROLE.md` §6. Ledger at
`docs/reports/FHE-TASK-RANCHWORD-A-LEDGER.md` from your first action. **Flagged-not-fixed section
must carry §2b's `affiliated barns` and the contract-body `Barn Name:` label as the two owner calls,
and the `ORG.PROPERTY` token as v2 debt.**
