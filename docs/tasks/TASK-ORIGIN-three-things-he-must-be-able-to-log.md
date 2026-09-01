# TASK-ORIGIN — the three things he must be able to log before he reviews every account

⚠️ **THIS IS THE CRITICAL-PATH ITEM IN THE HANDOFF. BUILD IT FIRST.**

> ## THIS IS THE ONE SPEC. `TASK-ATTRIB` IS FOLDED INTO IT.
> **Reconciled 2026-08-27 (ORCH5), on the owner's instruction:** *"TASK-ATTRIB covers origin only.
> Channel and 'what they bought' are the other two thirds and they're in TASK-ORIGIN, already on main
> — reconcile them into one spec before running it, don't discard either."*
>
> Two specs were written in parallel for overlapping work. **ATTRIB built §3.2's origin field and
> nothing else** — channel appeared once, incidentally, in a sentence about retiring values, and the
> historic purchase got one passing mention. **Shipping it alone would have left two of his three
> surfaces missing on the morning he sits down to review every account — the exact "enter everything
> twice" failure this task exists to prevent.**
>
> **What ATTRIB contributed, now carried here:** the production measurements in §2, the three
> allowlist traps in §5 *(the first of which nobody else had found)*, the read-side reach in §6, and
> the numbered acceptance tests in §9. **`docs/tasks/TASK-ATTRIB-where-they-came-from.md` is retained
> as the measurement record it is — not discarded, not to be run separately.**

**Owner, 2026-08-26:**
> *"before i review every client's account i need the surfaces to be there for me to log where they
> found us, how they contacted us, and what they bought (when the system doesnt already know these
> things)…"*

And, earlier the same day:
> *"I know want to see where people come from before they hit the website, and i need a way to add
> info to every client record to indicate (from a constrained list of options) where they
> originated/how they found us… we need to see real data about these things to know whats working,
> what we can invest in to get more out of, and what isnt firing or working so we can investigate it."*

⚠️ **THE SCHEDULING FACT THAT MAKES THIS URGENT:** he is about to sit down and go through **every
client account by hand**. **If the fields do not exist when he starts, he enters everything twice.**
That is the entire reason this jumps the queue.

⚠️ **RE-CHECKED AGAINST THE MULTI-TENANT PLATFORM FRAMING (2026-08-27) AND IT STILL SHIPS.**
`docs/reference/REBUILD-SCOPE-multi-tenant-platform-2026-08-27.md` records that the rebuild target is a
platform where **users are independent of tenants** — which makes this task, adding two columns to the
person record, the obvious candidate for "wait for the rebuild." **It is not, and the reason is worth
stating so nobody re-opens it: the DATA is what ports, and the columns are only the vessel.** He
enters it by hand once; captured now it survives into whatever the platform's person model becomes,
and **not captured it never exists at all — no later schema can recover a fact nobody wrote down.**
**Build it in the current schema without apology.**

---

## 0. READ FIRST

1. **`CLAUDE.md`** — ⚠️ **no subagent delegation.** D13 (he changes it without a developer), D21,
   D22 §0, D31, D32.
2. **`docs/method/ORCHESTRATOR.md` §3, §3b, §4** — the code-that-reports-success-and-does-nothing class, and
   its sibling, the code-nothing-reaches class. **§5 below is an instance of the first.**
3. **`docs/method/04-OPEN-QUESTIONS.md` §3** — why the metric list is **not yours to author**, and
   why this task stops where §7 says it stops.

---

## 1. THE THREE THINGS — they are not one field

| | What he is logging | Why it is separate |
|---|---|---|
| **ORIGIN** | *where they found us* | Instagram, a friend, a sign, a Google search. **The marketing question.** |
| **CHANNEL** | *how they contacted us* | the website form, a phone call, in person at the barn, a DM. **The operations question.** |
| **PURCHASE** | *what they bought*, **when the system does not already know** | A historic sale that predates the app, or one taken in cash and never entered |

⚠️ **ORIGIN AND CHANNEL ARE NOT THE SAME QUESTION AND MUST NOT SHARE A FIELD.** "Instagram" is an
origin; "phoned us" is a channel; **the same person can be both**, and collapsing them destroys
exactly the analysis he is asking for — *"what we can invest in to get more out of"* is an ORIGIN
question, *"what isnt firing"* is a CHANNEL one.

## 2. WHAT WAS MEASURED — against production, 2026-08-26/27

| | |
|---|---|
| `contacts` | **28 rows**, none soft-deleted |
| `clients` | **21 rows** |
| `lookup_options` | **3 keys, 33 rows** — `horse_markings` (9) · `horse_registration_org` (13) · `horse_passport_country` (11). ⚠️ **All three are horse vocabularies. There is no person vocabulary yet.** |
| `menu_inventory()` | **auto-discovers `lookup_options` keys** with `GROUP BY lo.lookup_key` — so a new key reaches the editor with **no UI work**. ⚠️ Confirmed still true after `TASK-SURFACEEDITOR` merged |
| the editor | ⚠️ **CHANGED 2026-08-27.** `AdminMenusPage` is retired; the surface is now **`/app/ops/admin/editor`** (`AdminEditorPage.tsx`, registry row `settings.editor` at `pageRegistry.ts:208`), with vocabularies rendered by **`src/components/ops/editor/SharedListSurface.tsx`**. **The write spine is unchanged** — `menuInventory` → `menuVocabularyValues` / `setMenuValue` / `addLookupValue` |

⚠️ **THE 28 CONTACTS ARE WHY THE COLUMNS GO ON `contacts`** — see §3.

## 3. ⚠️ `clients.source` ALREADY EXISTS AND IS NOT THIS

| Value | Rows |
|---|---|
| `VISITOR_RELEASE` | 11 |
| `provisioned invitation` | 8 |
| `BOOKLINK backfill` | 1 |
| `staff created` | 1 |

⚠️ **THAT COLUMN RECORDS WHICH CODE PATH CREATED THE ROW — not where the human came from.** It is
free text with **no CHECK and no lookup**, it mixes SCREAMING_CASE machine tokens with prose, and one
of its four values is the name of a past migration. **Do not repurpose it. Do not extend it. Do not
tidy it. Leave it exactly where it is** (D32) — it is a provenance trail and something reads it.

⚠️ **AND DO NOT ADD A THIRD FREE-TEXT COLUMN BESIDE IT.** *"from a constrained list of options"* is
the owner's own wording, and a free-text origin field produces "instagram", "Instagram", "IG" and
"insta" inside a month, which cannot be counted — which defeats the entire purpose.

## 4. THE BUILD

### §4.1 — TWO VOCABULARIES, IN `lookup_options`
⚠️ **`lookup_options` IS THE RIGHT HOME, NOT A CHECK CONSTRAINT AND NOT A HARDCODED ARRAY.** It is
already the editable-menu spine, it already carries `active`, and the editor already surfaces it.
**D13: he must be able to add "saw the trailer at a show" without a thread.** A CHECK constraint
would need a migration for every new option — that is the pattern D13 exists to stop.

Two keys: **`client_origin`** and **`contact_channel`**. **Seed them with his real answers, not
guesses — ⚠️ ASK HIM FOR THE STARTING LISTS.** A wrong seed list is worse than an empty one, because
he will pick the nearest wrong option rather than stopping to correct it.

### §4.2 — TWO FIELDS ON THE PERSON, SET LATE AS WELL AS EARLY
On `contacts`, **not** `clients` — ⚠️ **a LEAD has an origin too, and that is the most valuable one to
capture.** A person who never becomes a client is exactly the data point that tells him what is not
working. **The measurement makes it concrete: 28 contacts against 21 clients**, and half of what he
wants to measure — conversion rate, cost per enquiry — is arithmetic over the people who did *not*
convert. **Putting these on `clients` makes the denominator unreachable.**

Both columns are **nullable text**, and **NULL means "not recorded yet"** — the honest state for all
28 rows on day one. **Do not backfill a guess** (§8).

- **Settable at intake** *(the public enquiry/contact form, and the staff provisioning form)*, and
- ⚠️ **editable afterwards, on the record, forever** — because he is backfilling by hand and most of
  these people already exist.

⚠️ **"AT INTAKE" MEANS THE ENQUIRY FORM, NOT `/sign/*`.** The five signing paths have a deliberately
fixed field set, and a thread that proposed making it configurable was declined in these words:
*"i did not intend to invite this type of question and answer set into my life"* (D22 §0). **Do not
add a question to `SignStart.tsx` or `api/sign-start.ts`.** If you conclude the signing paths need
it, **flag it in §7 rather than building it.**

### §4.3 — RECORD A PURCHASE THE SYSTEM DOES NOT KNOW ABOUT
⚠️ **CHECK WHAT ALREADY EXISTS BEFORE BUILDING.** `grant_lesson_credit(p_client_id, p_offering_id,
p_quantity, p_mode, p_reason, p_payment_method)` already supports modes `handwrite` / `comp` / `bill`
and already records a payment method — **it may already be most of this.** And as of 2026-08-26
`mark_purchase_paid` honours a partial amount, so a historic order can be settled the way it actually
was, including a split.

**What is genuinely likely to be missing is a DATE.** ⚠️ **A backfilled purchase entered today with
today's timestamp is worse than no record — it will corrupt every "this month" and "this year" number
on the dashboard he is about to specify.** **It must be possible to say when it actually happened**,
and the number that a report reads must be that date, not `created_at`.

## 5. ⚠️ THREE ALLOWLISTS STAND BETWEEN §4 AND A WORKING MENU

**Measured against production 2026-08-26, and re-verified 2026-08-27 after `TASK-SURFACEEDITOR`
merged — all three survive it unchanged.** The first is the one that would ship a half-editable menu
and look finished.

**T1 — `add_lookup_value` REFUSES ANY KEY OUTSIDE A HARDCODED FIVE.** The editor's *Add a value…*
control calls it (`SharedListSurface.tsx:53`), and its body reads:

```
IF v_key NOT IN ('horse_breeds', 'horse_colors', 'horse_markings',
                 'horse_registration_org', 'horse_passport_country') THEN
  RAISE EXCEPTION 'lookup % is not open to additions from a form', v_key;
```

⚠️ **So seeding `client_origin` and `contact_channel` and stopping there gives him menus he can
rename and switch off but CANNOT ADD TO** — precisely the D13 failure §4.1 is written to avoid.
**Widen it by adding the two keys. Do NOT replace the guard with "any key"** — it is reachable from a
public-facing form path (`HorseIntakeForm.tsx:222`), and an open namespace lets a form invent
vocabularies.
⚠️ **Prove it by actually inserting** inside `BEGIN; … ROLLBACK;`, and paste the returned JSON **and**
the row count. **Proving it did not raise proves nothing.**

**T2 — `update_contact_record` HAS ITS OWN COLUMN ALLOWLIST** (`v_allowed`) and raises
`'field % is not editable here'` for anything absent from it. Both new columns must be added, or
§4.2's "editable afterwards, forever" silently cannot save. **It raises rather than no-ops, which is
the only mercy here.** Keep the guard working: it must still refuse a genuinely unknown key.

**The read side needs nothing** — `contact_dossier` returns `to_jsonb(c)` for the whole row, so new
columns reach the UI on their own. **Verify that rather than assuming it.**

**T3 — `menu_inventory()` WILL LABEL BOTH NEW MENUS AS HORSE MENUS.** It auto-discovers every
`lookup_options` key — which is why §4.1's keys appear in the editor with no UI work — but its
`used_by` is the hardcoded string `'Horse intake · contracts'` for all of them. **Fix with a minimal
`CASE` so each new key states where it is really used. Do not restructure the function.**

⚠️ **`set_menu_value` is already generic** and falls through to `lookup_options` for any key, so
rename and on/off need no change. **That asymmetry is exactly why T1 is easy to miss** — two of the
three controls work, and the third throws.

**T4 — NO FOREIGN KEY, NO CHECK, ON EITHER COLUMN.** `lookup_options`'s primary key is
`(lookup_key, code)` so a plain FK is unavailable anyway — but the real reason is already written into
`set_menu_value`'s own comment: *"switching off is how a value is retired — it leaves every dropdown
and stays valid on the records that already carry it."* **Validate on WRITE against an ACTIVE option;
never on read.** A person who came from a channel he later switches off still came from it, and their
record must render that option's words — **not a blank, and not the raw code.**

## 6. THE REACH — and it has two halves

**What does a person click, from which page, and is that the only way?**

| | Where | What |
|---|---|---|
| **Set / change it** | the client & contact record — `ContactDossierModal.tsx`, the expanding row on `/app/records/clients` and `/app/records/leads` | Two selects beside the existing standing fields, saving through `updateContactRecord` |
| **Edit the lists** | `/app/ops/admin/editor` → **Client origin** · **Contact channel** | ⚠️ **Already reachable, already in `pageRegistry.ts`. You add NO page and NO nav row.** Prove they appear there rather than asserting it |
| **Read the data** | the **Clients** and **Leads** tabs of `RecordsPage` | Origin and channel as **visible columns** and as **filters**, beside the existing designation filter |

⚠️ **HE IS REVIEWING ACCOUNTS ONE BY ONE — SO THE FIELDS MUST BE ON THE THING HE IS ALREADY LOOKING
AT.** *"Not a separate data-entry screen."* **If he has to open a second page per client, this has
failed.**

⚠️ **AND THE READ HALF IS REQUIRED, NOT POLISH.** A field that can only be seen one record at a time
is the next entry in `ORCHESTRATOR.md` §3b — correct code that nothing reaches. He asked to *"see
real data about these things"*; one row at a time is not seeing data. **This is the cheap half of
that: a column and a filter, not a metric** (§7).

⚠️ **ONE WRITER.** Do not add a second origin or channel control anywhere — not on the invite form,
not on `ProvisionClientForm.tsx`, not on `ContactForm.tsx`.

## 7. FLAG, DO NOT BUILD

Report these under **"flagged, not fixed"**, with what you found:

1. **Self-reported origin on the `/sign/*` paths** — §4.2. D22 §0 governs; it needs his ruling.
2. **The referrer's NAME.** *"A friend referred me"* with no name recorded is the most valuable answer
   and the least actionable one. He asked for a constrained list; a free-text sibling is a separate
   request.
3. ⚠️ **Anything that COMPUTES a metric from these fields.** A metrics spec is coming to the
   orchestrator from a separate chat thread, and **the owner ruled the metric list is not ours to
   author.** Build **no** dashboard tile, **no** KPI, **no** conversion rate. **This task's
   deliverable is the captured input those metrics will need** — and a metric whose input was never
   captured renders as zero, which on an always-visible strip is indistinguishable from a real zero.

## 8. OUT OF SCOPE — explicitly

- `clients.source` in any form (§3).
- Any new page, route or nav row.
- ⚠️ **Backfilling the 28 existing contacts.** **That is his manual review session and the whole
  reason this ships first.** Seeding a guess would corrupt the only data he has.
- Restructuring `menu_inventory()` beyond T3's `CASE`, or `add_lookup_value` beyond T1's two keys.

## 9. THE TEST THIS MUST PASS — numbered and provable

**Prove each one.** `ORCHESTRATOR.md` §3 is a table of changes that reported success and did nothing
— **never offer the absence of an error as evidence.**

1. Both columns exist on `contacts` — `information_schema.columns`, pasted.
2. Both `lookup_options` keys exist with their seeded rows, all `active` — the rows pasted.
3. `menu_inventory()` returns both keys, and neither `used_by` says *"Horse intake · contracts"* (T3)
   — the JSON elements pasted.
4. ⚠️ **`add_lookup_value('client_origin', 'TikTok')` SUCCEEDS AND INSERTS A ROW** (T1). In
   `BEGIN; … ROLLBACK;`. **Paste the returned JSON and the row count.**
5. `set_menu_value` switches an option off, and that row reads `active = false` — before and after.
6. ⚠️ **`update_contact_record` accepts both fields in a patch and the values are ON THE ROW
   afterwards** (T2). In `BEGIN; … ROLLBACK;`, against a real contact id. **Paste the stored values,
   not the RPC's return.**
7. `update_contact_record` still **raises** on a genuinely unknown key — proving you widened the
   allowlist rather than removing the guard.
8. A contact holding a **deactivated** code still renders that option's display name (T4) — name the
   code path that does it.
9. ⚠️ **A purchase recorded with a June date reads as June, not as today** (§4.3). **Paste the query
   a monthly report would run, and its result.** This is the one that silently poisons the metrics
   work if it is wrong.
10. **The two columns and the two filters** on the Clients and Leads tabs — `npm run typecheck` and
    `npm run lint` clean against the **48-warning** baseline on `main`, and the filters' query named.
11. **THE REACH, verified in source and quoted:** the dossier save call site · both keys arriving in
    `/app/ops/admin/editor` through `menu_inventory` · the roster columns and filters. **State
    explicitly that you added no route and no `pageRegistry` row.**
12. **Renders are NOT VERIFIED by you.** End with a numbered checklist the owner runs in a browser.
    **Never simulate a render.**

## 10. CONSTRAINTS

- **Worktree, never the canonical checkout** — code commits are refused outside one:
  `git worktree add ~/Downloads/claude-code-repo/wt-origin -b task/origin origin/main`
- ⚠️ **COPY `.env.db` AND `.env` IN EXPLICITLY.** Both gitignored, neither propagates, and
  `npm run build` dies with `supabaseUrl is required` without `.env`:
  `cp ../fhe-website-app/.env.db ../fhe-website-app/.env .`
- **Migrations:** connection string is the **first line of `.env.db`**. `BEGIN; … ROLLBACK;` first,
  then apply, verify with a query, commit. No self-contained `COMMIT;`.
- ⚠️ **`menu_inventory` and `add_lookup_value` are DATABASE functions.** A function-body change does
  not appear in a git diff — **name both at the top of your report** so the merge can be checked.
- ⚠️ **A LIVE LEASE WITH A REAL CLIENT IS IN PRODUCTION** — Pamela Godde, document
  `7adcd08f-fd5d-40f9-b726-634074266d7c`. Nothing here should reach it; rehearse anything destructive
  in `BEGIN; … ROLLBACK;` regardless.
- **`npm run test:db` is 51 files red on `main`** and has been for weeks. **That is the documented
  baseline and NOTHING may cite it as proof.** Verify against production with `psql`.
- **COMMIT AS YOU GO. DO NOT PUSH.**
- **Report to `docs/reports/TASK-ORIGIN-REPORT.md`** and commit it.

## 11. TEARDOWN

Kill any dev server, watcher, `vitest` or `psql` session you started. **Run a process census before
you finish and paste it.** Report the worktree path and branch so the orchestrator can archive and
remove it.
