# TASK HARVESTCLOSE — report

One thread, no subagents, read-only except the four files it wrote. No application code changed, no
migration applied, nothing pushed.

**What it produced**

| file | what it is |
|---|---|
| `docs/reports/flagharvest-work/DECIDE.md` | **the deliverable** — the owner's keep/remove sheet, 438 blocks |
| `docs/reports/flagharvest-work/CLOSED.md` | the audit trail — every family removed, with its evidence |
| `docs/reports/flagharvest-work/FAMILIES.md` | the Phase 1 product — the ONE family list, all 975 items |
| `docs/reports/flagharvest-work/gitlog-2.txt` | the fresh commit log, `6a58c0f..HEAD` (185 commits) |

---

## 1. THE ATTRITION

```
975 raw flagged items   (all 104 reports — collection accepted, not redone)
→ 609 families          deduplicated WITHIN the six unverified slices and ACROSS all eight
→  61 machine-closed    resolved or superseded, evidence in CLOSED.md
→  13 folded            duplicate pointers to a family already on the sheet
→ 535 on the sheet      of which 14 are flagged MOOT?
                        presented as 438 blocks (37 group several same-shape record-only families)
```

**Rank split of the 438 blocks:** 21 rank 1 · 61 rank 2 · 123 rank 3 · 37 rank 4 · 113 rank 5 ·
83 rank 6.

The collapse is smaller than the phrasing "deduplicate 975" might suggest, and the reason is worth
stating: **the duplication rate in this corpus is genuinely low.** The two slices that had already
been deduped collapsed 72→51 and 109→99. The 794 items in the six unverified slices collapsed at a
similar rate. What the corpus actually contains is ~600 distinct facts, most of them of the form
"flagged, not fixed" or "not verified" — each raised once, by the thread that hit it.

Where real duplication existed, it was large and it is now gone:
- **62 separate "nobody looked at this on a screen" items → 4 families** (items 198-201), split by
  what each actually needs: a staff login, a member login, a physical phone, or app credentials.
- **17 "the database test suite is red" restatements → 1 family** plus 5 named causes.
- **12 "the lint baseline in CLAUDE.md is wrong" reports → 1 family** (item 366).
- **28 "a task document's premise was wrong" corrections → 1 family** (item 367).
- **14 "the security audit is code-reading, not proof" caveats → 1 family** (item 232).

## 2. THE METHOD, AND WHETHER IT HELD

The two failures this task existed to avoid:

| the rule | what happened |
|---|---|
| **Deduplicate FIRST; judge nothing until the family list is complete** | Held. `FAMILIES.md` was written in full — all 609 families, every raw id assigned — before a single status was decided. |
| **Load the evidence ONCE, then sweep every family against it** | Held. Phase 2 loaded: the 185-commit log, the 62 migrations added since the baseline, the full changed-file list, 12 merged task reports, one batched 40-query prod script, and four short follow-up query batches. Phase 3 judged all 609 against that one load. |

**The single most valuable piece of evidence was cheap:** `git diff --name-only 6a58c0f..HEAD`. With
that list in hand, any family citing a file absent from it is still open *by construction* — no
re-reading required. That one command re-baselined the majority of the 120 previously-open UI and
identity families.

## 3. THE RE-BASELINE (test 5)

Both verified slices were judged at `6a58c0f`; `main` is **185** commits ahead (the task said ~180).
Of the **120** items those slices marked OPEN, **exactly 2 flipped to closed** — the staff account
link and the single-sited RSVP control. One more (null-client bookings) changed materially without
closing. **117 remain open.**

The reason so few flipped: the 185 commits are credits, bookings, payments, checkout, forms and
website copy. The UI and identity surfaces those families point at were largely untouched — five of
the most-cited files appear nowhere in the diff.

## 4. THE FOURTH BUCKET — MOOT?

**14 families are flagged `STILL OPEN — MOOT?`** and sit at the top of the sheet, each naming the
in-flight task that overtakes it (ASKRIGHT, CAREPATH, LESSONREQUEST, SESSIONBOOK, or the flow
program's rewrite of `/lessons`, `/horse`, `/acquisition` and the checkout). Three further items
carry a `moot?:` note without being lifted to that section, because the underlying database change
stands whatever happens to the screen (breed/colour, the euthanasia data question, the enquiry
placeholders).

**Nothing was removed for being moot.** That is a judgement, and it is the owner's.

## 5. ACCOUNTING — NOTHING VANISHED (test 1)

Every raw id in the six unverified slices was assigned to a family, and that was proved
mechanically, not by eye. A script extracted all 794 `### ITEM [batchN#M]` ids from the six slice
files and compared them against the ids written into `FAMILIES.md`:

```
ca:  162 raw / 162 assigned / 0 missing
cb:  185 raw / 185 assigned / 0 missing
sec: 137 raw / 137 assigned / 0 missing
df:  121 raw / 121 assigned / 0 missing
db:   98 raw /  98 assigned / 0 missing
em:   91 raw /  91 assigned / 0 missing
     794 raw / 794 assigned / 0 missing
```

The first run found 35 unassigned ids and 12 mis-slice-labelled ones; both were fixed and the script
re-run to zero. The remaining 181 raw items are the UI (72) and IDENTITY (109) slices, whose
raw→family mapping is the two verified files' own accepted collapse (72→51, 109→99); those 150
families were then merged across slices here.

## 6. EFFICIENCY PROOF (test 8)

| measure | count |
|---|---|
| distinct input files read (8 slices + 2 verified + instructions + task doc) | 12 |
| merged task reports read (once each, summary sections) | 12 |
| distinct code files inspected | 48 |
| prod query batches | 6 (one 40-query script + 5 follow-ups) |
| distinct prod objects examined | ~62 functions, 18 tables/views, 28 policies, 12 grant sets |
| **files read twice** | **0** |
| families judged | 609 |

**48 code files against 609 families is the proof the method held.** The first attempt reviewed items
one at a time with a fresh context each; this one read each surface once and swept the whole family
list against it. Two mechanics did most of that work: the changed-file list (which answers "has this
moved?" for every family at once) and one batched SQL script (which answered 40 database questions in
a single connection).

The only file opened in two calls was `verified-UI.md`, read in two pages because it exceeds the
read limit — one file, one pass, two pages.

## 7. WHAT I FOUND WHILE SWEEPING THAT NOBODY HAD REPORTED

Three things surfaced from the evidence rather than from the flags:

1. **`add_contract_composition` no longer carries the in-review widening.** `20260812T2100` widened
   five authoring functions; `20260815T1000_partystaging_edit_vs_suggest.sql` then rebuilt that one
   function onto a `caller_may_propose(...)` permission model with **no workflow-state test at all**.
   The net effect still unblocks in-review editing (CLOSED.md C28), but the mechanism now differs
   between that function and its four siblings — worth knowing before anyone edits either.
2. **The receipt-forgery hole closed itself this week.** `20260816T2000_receipt_rpcs_service_role_only.sql`
   (from the payment work) revoked both public roles from the two receipt writers that TASK-INBOUNDALERT
   flagged as forgeable. Nobody connected the two.
3. **The pre-commit hook is real and works, and it is not enough.** It blocked one thread from
   committing code in the shared checkout this week, and a different thread still swept another
   session's uncommitted files into its own commit on 2026-08-16. Item 85 carries both facts.

## 8. THE TESTS, ONE BY ONE

| test | result |
|---|---|
| 1. Both files exist and account for all 975 | Yes — §5, mechanically proven to zero missing |
| 2. All 975 reconciled into ONE family list, deduped within and across, sources kept | Yes — `FAMILIES.md`, 975 → 609 stated |
| 2b. Ordered by rank; every `what:` line plain language, no paths or function names | Yes — ranks 1→6 after the MOOT section; `what:` lines carry no file paths or identifiers |
| 3. Every closed family names a commit or migration and confirms the fix is real | Yes — `CLOSED.md`, 47 evidenced entries plus the 25 that stand from the verified slices |
| 4. Every open family shows what was checked | Yes — every block's `checked:` line names the file:line, the SQL result, or the grep that produced it |
| 5. The 120 previously-open items re-baselined; flip count stated plainly | Yes — §3: **2** flipped |
| 6. `gitlog-2.txt` written and used | Yes — 185 commits; used together with the changed-file list, which did more work |
| 7. Attrition reported | Yes — §1 |
| 8. Efficiency proof reported | Yes — §6: 48 code files, 6 query batches, 0 files read twice |
| 9. No application code, migration or push | Yes — `git status` shows only the four files this task wrote |

## 9. WHAT I WOULD READ FIRST, IF IT HELPS

Not a recommendation about any item — just where the sheet's weight sits:

- **Items 198-201** are 62 reports' worth of "never seen on a screen" collapsed into four decisions.
  One session with real credentials retires more of this sheet than any other single action.
- **Items 21-34** are one root cause (every new database function is public by default) with thirteen
  symptoms. One migration changes the default; the rest is a list.
- **Items 1-20** are the live defects. Five of them (items 5, 6, 269, 270, 271) are the same
  underlying behaviour — a document composing a sentence around a missing answer — and one rule fixes
  all five.
- **Item 2 and item 3** are armed today: two documents will error the moment anyone touches them, and
  the migration that clears them is written and waiting.
