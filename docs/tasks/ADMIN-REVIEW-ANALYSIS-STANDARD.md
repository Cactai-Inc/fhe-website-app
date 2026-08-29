# ADMIN REVIEW — THE ANALYSIS STANDARD

**Every `TASK-AR*` thread reads this file. It is the depth requirement, in the owner's own words,
turned into something checkable.** Written once so six threads produce six comparable reports rather
than six differently-shaped ones.

---

## 0. ⚠️ YOU ARE WRITING A REPORT. YOU ARE NOT FIXING ANYTHING.

**READ-ONLY. No code changes, no migrations, no data writes.** Your entire output is a report and a
proposed plan. **A separate orchestrator thread (ORCH6) reviews every report with the owner and
authors the build threads from them.**

⚠️ **This is deliberate and it is not a lack of trust.** Six threads fixing overlapping surfaces at
once is how this repo has lost work before. **The fix sequencing is decided after all six reports
exist, because several of them will want the same files.**

**If you find something so broken that leaving it feels wrong: write it at the TOP of your report,
marked `⚠️ URGENT`. Do not fix it.**

---

## 1. THE OWNER'S DEPTH REQUIREMENT — verbatim

> *"the task thread needs to perform a full depth analysis for the page(s) including any duplicates
> or similar near duplicates, wiring, ui elements, data refs and data input fields, as well as CRUD
> capabilities for functionality, presence, redundancy, needs, unnecessary inclusions, accidental
> omissions, misconfigurations, outdated items, and whether or not things that exist are visible,
> accessible, functional, or usable for the users, existence of a page in the code doesnt
> automatically mean the user can see it, seeing it in one circumstance doesnt automatically mean its
> visible or accessible in all circumstances where it should be, and the same logic applies to
> everything in the code and on the pages. after the research is concluded, the issues and reasons
> and potential fixes should be written into a report that is presented for review."*

---

## 2. ⚠️ THE SENTENCE THAT MATTERS MOST, AND WHAT IT MEANS FOR YOUR METHOD

> *"existence of a page in the code doesnt automatically mean the user can see it, seeing it in one
> circumstance doesnt automatically mean its visible or accessible in all circumstances where it
> should be."*

**This forbids the way this repo has been researched until now.** Reading a component and reporting
what it *would* render is exactly how `TASK-CONTRACTWALK` reported a control as *"reachable and
clearly labelled"* when it could not render at all — and no lease could be locked or signed because
of it. **D17 exists because of that report.**

**So every claim you make about visibility has to name the CONDITIONS under which it holds.**

| ❌ Not acceptable | ✅ Acceptable |
|---|---|
| "The horse-add control is on the client record." | "The horse-add control renders when `neverInvited \|\| isDraft`; **once the invitation is sent it does not render at all**, which is 8 of 22 live clients." |
| "Admins can see the Documents tab." | "The Documents tab renders only when `selected.user_id` is non-null. **15 of 22 clients have no login**, so for them it never loads." |

⚠️ **THE STATE MATRIX IS THE DELIVERABLE, NOT THE FEATURE LIST.** For every surface and control in
your scope, walk it across the states a real person occupies:

- **contact with no account** · **client, invitation never sent** · **invitation sent, never signed
  in** · **signed in, no purchases** · **active client with orders** · **archived**
- **staff vs member vs anonymous**
- **desktop vs mobile** — the owner's working device is a phone
- **empty vs populated** — ⚠️ but see §5: empty is not a finding

**Wherever a state produces a different answer, say so.** The gap between two states is where every
defect in this project has lived.

---

## 3. THE CHECKLIST — run all of it, report against all of it

**1. Duplicates and near-duplicates.** Two surfaces doing one job; two components reading two shapes;
two columns holding one fact. ⚠️ **Name the incumbent and say which should survive.** This project's
defining failure is 3 horse rosters, 3 lead lists, 2 staff landing pages, 2 document renderers.

**2. Wiring.** What calls it, what it calls, what reads its output. ⚠️ **A function with zero call
sites is a finding.** So is a column nothing reads, and a write path with no reader.

**3. UI elements.** Every control: what it does, whether it does it, whether it says what it does.

**4. Data references and input fields.** Which column each field reads and writes. ⚠️ **A field that
writes somewhere nothing reads is the single most common defect class in this codebase.**

**5. CRUD, per entity.** Create · Read · Update · Delete. **Say which of the four are missing, which
are present but unreachable, and which exist twice by different paths.** ⚠️ Under **D32** nothing is
truly deleted — so "delete" means archive/retire, and a real hard delete is itself a finding.

**6. Presence · redundancy · needs · unnecessary inclusions · accidental omissions ·
misconfigurations · outdated items.** The owner's list, each answered explicitly.

**7. Visible · accessible · functional · usable** — the four, separately, per §2's state matrix.
**They are not the same question and a surface can pass three and fail one.**

---

## 4. WHAT THE REPORT MUST CONTAIN

`docs/reports/TASK-AR<n>-REPORT.md`, in this order:

1. **⚠️ URGENT** — anything actively harming a user or corrupting data. Empty if none.
2. **WHAT THIS AREA IS FOR** — in plain language, no function names. What a person comes here to do.
3. **THE STATE MATRIX** (§2) — the table.
4. **FINDINGS** — numbered, each with: what · the evidence (file and line, or a query and its output)
   · why it matters · **the conditions under which it is true**.
5. **THE PLAN** — ordered, with a proposed fix per finding. ⚠️ **Say which fixes are independent and
   which must land together**, because ORCH6 schedules from this.
6. **TEST CRITERIA** — numbered and provable, per fix.
7. **SUCCESS, AT TWO LEVELS** — per fix, and for the area as a whole.
8. **FLAGGED, NOT FIXED** — out of scope, blocked on an owner ruling, or found in a neighbour's
   territory. ⚠️ **Name the neighbouring task by ID so ORCH6 can route it.**
9. **CONTENDED FILES** — every file you would need to edit, so the build order can be computed.
   ⚠️ **Required. This is how ORCH6 decides what runs in parallel.**

---

## 5. THE STANDING RULES THAT WILL OTHERWISE COST YOU A FINDING

- ⚠️ **EMPTY IS NOT A FINDING.** Pre-launch counts are the expected state. **Nobody is in the app
  yet.** A finding is something that would still be wrong once the feature is used. The owner:
  *"this is the 10th time you are 'finding' this like its new news."*
- ⚠️ **`test:db` is 51 files red on `main` and has been for weeks.** That is the documented baseline.
  **Nothing may cite it as proof.** Verify against production with `psql`.
- ⚠️ **A state claim in a doc is a hypothesis.** Query the table, read the live function body, run the
  grep. `docs/` goes stale within days — this has cost this project real work twice (D20).
- ⚠️ **`instanceof Error` is false for Supabase errors** — a branch guarded by it is dead code.
- ⚠️ **Prove the row, the class, the emitted CSS — never the absence of an error.**
  `docs/ORCHESTRATOR.md` §3 is a table of changes that reported success and did nothing.
- ⚠️ **`UPDATE OF <col>` triggers fire on the columns the STATEMENT names**, not on what changed.
- ⚠️ **`GROUP_LABEL` in `pageRegistry.ts` is exported and read by NOTHING.** The nav's real labels are
  string literals in `AppLayout.tsx`. **Assume nothing is wired just because it is exported.**

---

## 6. HOW TO WORK

- **Your own worktree**, never the canonical checkout:
  `git worktree add ~/Downloads/claude-code-repo/wt-<id> -b task/<id> origin/main`
- ⚠️ **Copy `.env.db` and `.env` in explicitly** — both gitignored, neither propagates:
  `cp ../fhe-website-app/.env.db ../fhe-website-app/.env .`
- **Read production freely** — connection string is line 1 of `.env.db`. **SELECT only.** If you must
  test a mutation to understand behaviour, wrap it in `BEGIN; … ROLLBACK;` and say so in the report.
- ⚠️ **A LIVE LEASE WITH A REAL CLIENT IS IN PRODUCTION** — Pamela Godde, document
  `7adcd08f-fd5d-40f9-b726-634074266d7c`. **Do not touch it.**
- **The browser harness exists** — `test/browser/README.md`. Its shimmed mode runs the real page in
  real Chromium against PGlite, and it is the only honest way to prove a render.
  ⚠️ **Do NOT use the production-login probe.** Read-only source and DB analysis, plus the shimmed
  harness if you want it.
- **Commit ONLY your report file.** Nothing else. Do not push.
- ⚠️ **TEARDOWN: kill any dev server, watcher or `psql` you started. Run a process census and paste
  it.** Report your worktree path and branch.
