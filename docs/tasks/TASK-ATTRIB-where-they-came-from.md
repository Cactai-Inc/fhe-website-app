# TASK-ATTRIB — where they came from, before they hit the website

> # 📎 MERGED INTO `TASK-ORIGIN`. DO NOT RUN THIS SEPARATELY.
>
> **Reconciled 2026-08-27 by ORCH5, the thread that wrote it, on the owner's instruction:**
> *"TASK-ATTRIB covers origin only. Channel and 'what they bought' are the other two thirds and
> they're in TASK-ORIGIN, already on main — reconcile them into one spec before running it, don't
> discard either."*
>
> ⚠️ **THE CORRECTION THIS FILE EARNED, RECORDED PLAINLY.** He asked to log **three** things — where
> they found us, how they contacted us, and what they bought. **This spec built the first and only
> the first.** Channel appears once here, incidentally, in a sentence about retiring values; the
> historic purchase gets one passing mention. **Had it shipped alone, he would have sat down to review
> every account and found two of three surfaces missing — the exact "enter everything twice" failure
> the work exists to prevent.**
>
> **THE ONE SPEC IS NOW `docs/tasks/TASK-ORIGIN-three-things-he-must-be-able-to-log.md`.** Everything
> below lives there: the production measurements (ORIGIN §2), the three allowlist traps (§5), the
> read-side reach (§6), and the numbered acceptance tests (§9). **Nothing was dropped in the merge.**
>
> **The two specs agreed independently on every structural call** — the columns belong on `contacts`
> and not `clients`, the vocabulary belongs in `lookup_options`, and `clients.source` is row
> provenance that must not be overloaded. That agreement is worth something, which is part of why this
> file is retained rather than deleted (D32): **it is the measurement record the traps rest on.**

**You are a build thread. This file is your whole assignment.** Everything you need is here or in the
files it names. Nothing was said to you in the prompt.

---

## 0. READ THESE FIRST, IN THIS ORDER

1. **`CLAUDE.md`** — ⚠️ **no subagent delegation.** D13 (the owner changes it without a developer),
   D21, D22 §0, D31, D32.
2. **`docs/method/04-OPEN-QUESTIONS.md` §3 and §3b** — this task IS §3b. §3 is the reason it is
   urgent and the reason its scope stops where it does.
3. **`docs/method/ORCHESTRATOR.md` §3, §3b, §4** — the silent-no-op class and the nothing-reaches-it class.

---

## 1. WHAT YOU ARE BUILDING

**Owner, 2026-08-26:**
> *"I know want to see where people come from before they hit the website, and i need a way to add
> info to every client record to indicate (from a constrained list of options) where they
> originated/how they found us... we need to see real data about these things to know whats working,
> what we can invest in to get more out of, and what isnt firing or working so we can investigate
> it."*

**One field on the person record, filled from an editable menu, visible and filterable on the roster.**
That is the whole task. It is small on purpose and it is **on the critical path** — the owner is about
to sit down and hand-enter every client and their purchases (his words, §3). **If the field does not
exist before he starts, he enters everything twice.**

---

## 2. WHAT WAS MEASURED — 2026-08-26, against production

| | |
|---|---|
| `contacts` | **28 rows**, 0 soft-deleted |
| `clients` | **21 rows** |
| `lookup_options` | **3 keys, 33 rows** — `horse_markings` (9) · `horse_registration_org` (13) · `horse_passport_country` (11). **All three are horse vocabularies. There is no person vocabulary yet.** |
| the Menus editor | **exists and is reachable** — `/app/ops/admin/menus`, `AdminMenusPage.tsx`, registry row `settings.menus` at `pageRegistry.ts:202` |
| `menu_inventory()` | **auto-discovers `lookup_options` keys** with `GROUP BY lo.lookup_key`. **A new key appears in the editor with no UI work.** |

---

## 3. ⚠️ THE TRAPS — read every one, they are most of this document's value

### T1. `clients.source` ALREADY EXISTS AND IS NOT THIS. DO NOT OVERLOAD IT.

Measured values, all 21 rows:

```
VISITOR_RELEASE (11) · provisioned invitation (8) · BOOKLINK backfill (1) · staff created (1)
```

**That is row provenance — how the `clients` row came to be written — not how the human found us.**
It is free text, it has no vocabulary, and one of its values is the name of a past migration.
**Leave it exactly as it is** (D32: nothing is removed). Do not rename it, do not repurpose it, do
not "clean it up", and do not read it as attribution anywhere.

### T2. ⚠️ `add_lookup_value` HAS A HARDCODED FIVE-KEY ALLOWLIST — THE "ADD" BUTTON WILL THROW

The Menus page's **Add a value…** control calls `add_lookup_value`, whose body contains:

```
IF v_key NOT IN ('horse_breeds', 'horse_colors', 'horse_markings',
                 'horse_registration_org', 'horse_passport_country') THEN
  RAISE EXCEPTION 'lookup % is not open to additions from a form', v_key;
```

**So seeding a new key and stopping there ships a HALF-EDITABLE menu:** rename and on/off work
(`set_menu_value` is generic and falls through to `lookup_options` for any key), **adding a new option
raises.** That is a D13 failure — the owner cannot add "TikTok" to his own list without a thread.
**Widening this allowlist to include the new key is part of this task, not a follow-up.**

⚠️ **Widen it by ADDING the one key. Do not replace the guard with "any key"** — the guard exists
because this function is reachable from a public-facing form path, and an open key namespace lets a
form invent vocabularies.

### T3. `menu_inventory()` WILL LABEL THE NEW MENU AS A HORSE MENU

Its `lookup_options` branch is hardcoded to two horse-shaped derivations:

```
initcap(replace(replace(lo.lookup_key, 'horse_', 'Horse '), '_', ' '))   -- label
'Horse intake · contracts'                                              -- used_by
```

The label derivation happens to come out fine for a `<word>_<word>` key. **`used_by` does not — it
will tell the owner this menu is used by horse intake and contracts, which is false.** Fix it with a
minimal `CASE` so the new key states where it is really used. **Do not restructure the function.**

### T4. `update_contact_record` HAS ITS OWN ALLOWLIST AND RAISES ON ANYTHING NOT IN IT

```
IF NOT coalesce(k = ANY(v_allowed), false) THEN
  RAISE EXCEPTION 'field % is not editable here', k;
```

A new column that is not added to `v_allowed` cannot be saved from the dossier. **This one is loud
rather than silent, which is the only reason it is not in `ORCHESTRATOR.md` §3 — do not rely on that.**

**The read side needs nothing:** `contact_dossier` returns `to_jsonb(c)` for the whole contacts row, so
a new column flows to the UI on its own. **Verify that rather than assuming it.**

### T5. NO FOREIGN KEY. A DEACTIVATED OPTION MUST STAY VALID ON RECORDS THAT ALREADY CARRY IT.

`lookup_options`'s primary key is `(lookup_key, code)`, so a plain FK is not available anyway — but
the deeper reason is the one already written into `set_menu_value`'s own comment: *"Switching off is
how a value is retired — it leaves every dropdown and stays valid on the records that already carry
it."* **Store the code as text. Validate on WRITE against an ACTIVE option. Never validate on read,
and never constrain the column.** A person who came from a channel the owner later switched off did
still come from it.

### T6. ⚠️ THE PUBLIC SIGN-UP PAGES ARE OUT OF BOUNDS — D22 §0 IS A RECORDED RULING

It is tempting to add *"How did you hear about us?"* to `/sign/*`, and it is the obvious place. **It is
ruled out for now.** D22 §0 records the owner declining a proposal to make that page's field set
configurable, in these words: *"i did not intend to invite this type of question and answer set into
my life."* The per-path field set is a deliberate constant in `SignStart.tsx`.

**The owner's verb in the request is his own — "a way to ADD info to every client record."** This task
builds the field he fills in. **Self-reported origin at intake is a separate change request that needs
his ruling, and §7 below is where you flag it.**

---

## 4. THE SHAPE — decided, not open

**These are decisions, already made. Build them. If you find one of them is wrong, say so in your
report with the evidence — do not quietly build something else.**

1. **The column goes on `contacts`, NOT on `clients`.**
   `contacts` is the person record and exists for all 28 people; `clients` exists for 21 and is the
   commercial marker. **Attribution is a property of the person's arrival**, and half of what the
   owner wants to measure — conversion rate, cost per enquiry — is arithmetic over the people who
   did **not** convert. Putting it on `clients` makes the denominator unreachable.
2. **`contacts.origin_code text`**, nullable. NULL means *not recorded yet*, which is the honest state
   for all 28 rows on day one.
3. **`lookup_options.lookup_key = 'contact_origin'`.**
4. **Seed a starter vocabulary and say plainly in the report that it is a starting point**, because
   D13 means the owner re-words it himself in the Menus editor within a minute of seeing it. Suggested
   seed — adjust the wording, not the count:
   *Word of mouth · Referred by a client · Referred by a trainer or barn · Referred by a vet or
   farrier · Google search · Instagram · Facebook · Drove by / saw the sign · Horse show or event ·
   Local ad or flyer · Other.*
5. **One column. No free-text sibling.** *"From a constrained list of options"* is the request.
   ⚠️ A referral without a referrer's name is half the value, and that is a real gap — **flag it in
   §7, do not build it.**

---

## 5. THE REACH — what a person clicks, from which page, and whether it is the only way

**Three surfaces, and all three already exist. You are adding to them, not building a fourth.**

| | Where | What |
|---|---|---|
| **Set / change it** | `ContactDossierModal.tsx` — the expanding row on `/app/records/clients` and `/app/records/leads` | A select, beside the existing standing fields, saving through `updateContactRecord` |
| **Edit the list** | `/app/ops/admin/menus` → **Contact origin** | ⚠️ **Already reachable, already in `pageRegistry.ts`. You add NO page and NO nav row.** Prove it appears there rather than asserting it |
| **Read the data** | the **Clients** and **Leads** tabs of `RecordsPage` | Origin as a **visible column** and as a **filter**, beside the existing designation filter |

⚠️ **The roster column and filter are REQUIRED, not polish.** A field that can only be seen one record
at a time is the ninth entry in `ORCHESTRATOR.md` §3b — correct code nothing reaches. The owner asked
to *"see real data about these things"*; one row at a time is not seeing data.

⚠️ **AND IT MUST BE THE ONLY WAY.** Do not add a second origin control anywhere — not on the invite
form, not on `ProvisionClientForm.tsx`, not on `ContactForm.tsx`. **One writer.**

---

## 6. THE TELL — what the person sees, and how it is undone

- Saving shows the chosen origin on the record immediately, from the returned dossier — **not from
  local state you set optimistically.**
- **Clearing it back to "not recorded" is one action and is always available.** This is a correction
  field for data the owner is entering by hand at speed; the first thing he will do is pick the wrong
  one and need it gone.
- **A record whose origin was set to an option later switched off still displays that option's words**
  (T5). It does not render a blank, and it does not render the raw code.

---

## 7. FLAG, DO NOT BUILD — the three things this task deliberately stops short of

Put these in your report under **"flagged, not fixed"**, with what you found:

1. **Self-reported origin at intake** — the `/sign/*` question. **T6: D22 §0 governs. Needs an owner
   ruling.** Say what it would cost if he says yes.
2. **The referrer's name** — §4.5. *"Referred by a client"* with no name recorded is the most valuable
   answer and the least actionable one.
3. **Anything that computes a metric from this field.** ⚠️ **A metrics spec is coming to the
   orchestrator from a separate Claude chat (04-OPEN-QUESTIONS §3), and the owner ruled that the
   metric list is not ours to author.** Build **no** dashboard tile, **no** KPI, **no** conversion
   rate. This task's deliverable is the captured input those metrics will need.

---

## 8. OUT OF SCOPE — explicitly

- `clients.source` in any form (T1).
- Any new page, route, or nav row. **`pageRegistry.ts` and `App.tsx` are not yours** — see §9.
- Backfilling the 28 existing contacts. **That is the owner's manual data-entry session and the whole
  reason this ships first.** Seeding a guess would corrupt the only data he has.
- Restructuring `menu_inventory()` beyond the `CASE` in T3.
- The 5-key allowlist in `add_lookup_value` beyond adding the one key (T2).

---

## 9. CONSTRAINTS

- **Worktree, never the canonical checkout** — code commits are refused outside one:
  `git worktree add ~/Downloads/claude-code-repo/wt-attrib -b task/attrib origin/main`
- ⚠️ **COPY `.env.db` AND `.env` INTO THE WORKTREE EXPLICITLY.** Both gitignored, neither propagates,
  and `npm run build` dies with `supabaseUrl is required` without `.env`:
  `cp ../fhe-website-app/.env.db ../fhe-website-app/.env .`
- **Migrations:** connection string is the **first line of `.env.db`**. `BEGIN; … ROLLBACK;` first,
  then apply, then verify with a query, then commit. No self-contained `COMMIT;`.
- ⚠️ **`TASK-SURFACEEDITOR` IS RUNNING RIGHT NOW in `~/Downloads/claude-code-repo/wt-surfaceeditor`,
  and it OWNS `AdminMenusPage.tsx`, `pageRegistry.ts` and `App.tsx`.** Its brief collapses the menus
  screen into one editor. **DO NOT OPEN ANY OF THOSE THREE FILES.** You do not need to: `menu_inventory()`
  discovers your key on its own, and `set_menu_value` already writes any `lookup_options` key.
  **If you conclude you need a change in one of them, report the diff and stop — the orchestrator applies it.**
- **`menu_inventory()` and `add_lookup_value` are DATABASE functions and they ARE yours** — but T3 may
  touch the same area, so **name both changes prominently at the top of your report** so the merge can
  be checked. A function-body collision does not show up in a git diff.
- ⚠️ **A LIVE LEASE WITH A REAL CLIENT IS IN PRODUCTION** — Pamela Godde, `HORSE_LEASE_V2`, document
  `7adcd08f-fd5d-40f9-b726-634074266d7c`. Nothing here should reach it. Rehearse anything destructive
  in `BEGIN; … ROLLBACK;` regardless.
- **`npm run test:db` is 51 files red on `main` and has been for weeks.** That is the documented
  baseline. **Nothing may cite it as proof.** Verify against production with `psql`.
- **COMMIT AS YOU GO. DO NOT PUSH.**
- **Report to `docs/reports/TASK-ATTRIB-REPORT.md`** and commit it.

---

## 10. THE TEST THIS MUST PASS — numbered and provable

**Prove each one. `ORCHESTRATOR.md` §3 is a table of changes that reported success and did nothing —
never offer the absence of an error as evidence.**

1. `contacts.origin_code` exists — `information_schema.columns`, in the report.
2. `lookup_options` has the `contact_origin` key with its seeded rows, all `active` —
   `SELECT lookup_key, code, display_name, active FROM lookup_options WHERE lookup_key='contact_origin'`,
   output pasted.
3. **`menu_inventory()` returns a `contact_origin` entry** whose `used_by` does **not** say
   *"Horse intake · contracts"* — the actual JSON element pasted (T3).
4. ⚠️ **`add_lookup_value('contact_origin', 'TikTok')` SUCCEEDS AND INSERTS A ROW** (T2). Run it in
   `BEGIN; … ROLLBACK;` and paste the returned JSON **and** the row count. **A test that only proves
   it did not raise proves nothing.**
5. `set_menu_value('contact_origin', <code>, …, false)` switches an option off, and that row's
   `active` reads `false` afterwards — the before and after counts pasted.
6. ⚠️ **`update_contact_record` accepts an `origin_code` patch and the value is on the row afterwards**
   (T4). In `BEGIN; … ROLLBACK;`, against a real contact id. **Paste the stored value, not the RPC's
   return.**
7. `update_contact_record` still **raises** on a genuinely unknown key — proving you widened the
   allowlist rather than removing the guard.
8. A contact holding a **deactivated** origin code still renders that option's display name (T5) —
   name the code path that does it.
9. **The roster column and the filter** — `npm run typecheck` and `npm run lint` clean against the
   48-warning baseline on `main`, and the filter's query named in the report.
10. **THE REACH, verified in the source and quoted:** the dossier control's save call site · the
    `contact_origin` row arriving in the Menus editor through `menu_inventory` · the roster column
    and filter. **And state explicitly that you added no route and no `pageRegistry` row.**
11. **Renders are NOT VERIFIED by you.** End the report with a numbered checklist the owner runs in a
    browser. **Never simulate a render.**

---

## 11. TEARDOWN

Kill any dev server, watcher, `vitest` or `psql` session you started. **Run a process census before
you finish and paste it** — leave no background process running. Report the worktree path and branch
so the orchestrator can archive and remove it.
