# HANDOFF → ORCH5

## WHERE YOU ARE — read this before anything else

```
repo          /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch        main            04b150be (clean, pushed)
database      Supabase project lrstswfxfsezdmvkvukc — connection string in .env.db (line 1)
worktrees     NONE LIVE. Every worktree that existed when this thread started has been audited,
              merged, and removed. If you see a wt-* directory that isn't in `git worktree list`,
              it's orphaned filesystem debris from an already-closed thread — check before acting
              on it, don't assume it's live work.
platform      macOS. Every path above is absolute and real; nothing is a placeholder.
```

⚠️ **`cd` into the repo first.** Same warning every handoff carries, still true.

⚠️ **You (ORCH5) were spawned before this thread (ORCH4) closed, and sat idle** — read the
handoff prompt and its reading list, took no action. This file is written knowing that: it is a
full accounting, not a delta, because I don't know exactly how stale your read of the repo already
is. Don't assume anything you read earlier today is still current — re-verify per the discipline
below before acting on it.

---

**Written by ORCH4 at its own close, 2026-08-27, for the thread that replaces it — you.**
**This file instructs. It is not a status report.** If you finish reading it and still have to ask
the owner how to operate or what to do first, this file failed.

---

# 1. THE STATE OF THE APP, IN ONE PARAGRAPH

The database and RPC layer is still the correct, expensive half — unchanged assessment across four
threads now. What changed this session: **the surface-editor sequence finished.** Three threads
(VERSIONSPINE → CONTRACTOPTIONS → SURFACEEDITOR) collapsed forms, contract wording, contract
option lists and — newly — **email templates** into one config editor at `/app/ops/admin/editor`,
closing most of D13's list (the owner can now change nearly everything without a developer or a
migration). Two things are named as still genuinely open, not silently dropped: **UI page copy is
blocked, not deferred** — `get_content_block` can't resolve a tenant for an anonymous visitor, so
public marketing copy can't be served from the config store until that read path gets a security
decision — and the dashboard's owner-visibility model gained a **"whose move it is"** reorganization
that DB-level was live in production for a day with zero frontend callers before this thread found
and merged it. Separately, **the obligation model inverted underneath the refactor plan**
(OFFERINGDOCS, merged before this thread started): documents now come from what was purchased or
which door someone entered, never from a tag. `ADMIN-IA.md` and the rest of the refactor bundle
predate that inversion and have **not yet been re-read against it** — see §8b, this is the single
most consequential unfinished thing in this handoff.

---

# 2. WHO YOU ARE, AND THE THREE ABSOLUTES

Unchanged from every prior handoff. **You orchestrate. You do not build**, except a genuinely
small, fully-specified, uncontended change.

1. **Never spawn a subagent for FHE build work.**
2. **Verify before asserting.**
3. **Never trust a self-reported "done."**

**A fourth, learned today, sharpens #3:** ⚠️ **`git merge-base --is-ancestor` is necessary but not
sufficient before concluding a branch is unmerged or fully absorbed.** See §7 and
`orchestration/lessons/LESSONS.md`'s newest entry. **Multiple orchestrator sessions, plus the
owner merging directly, is now a live, expected condition of this system — not an edge case.**
Before touching any worktree: check `git worktree list` for whether it's even still live, then
diff branch-tip against current `main` **by content** (`git diff main <branch> --stat`), and if
the diff looks smaller than a report or earlier session implies, find the actual absorbing commit
by `git log --grep` before assuming anything — don't infer from an empty diff alone, confirm it.

---

# 3. WHAT TO DO FIRST — the owner's own priorities, in his words, 2026-08-26/27

He is running a **parallel `claude.ai` chat thread** doing design/architecture work (the six-step
change process — `docs/METHOD-change-orders.md`, `docs/CHANGE-ORDER-LEDGER.md`, 65 change requests
— and the DISCO/ORCH/TASK/TEST role-split design, see §5). **Two messages from this thread are
sitting unanswered in that chat** as of this handoff: a request for the exact files ORCH4 is
working from (answered, with a proposal to split ORCH into four roles), and a bundle of orchestrator
+ six-step-process files handed over for that chat to use in authoring the role-split file set. **Do
not re-litigate either — check with the owner whether the chat has responded before doing anything
that assumes a settled answer.**

His stated sequencing, verbatim, for the work still ahead on the app itself:

> "I know we need to implement globalization for standardization across the app, we need to nail
> down the final shape of the app for the admin side, and there is still some refinement of the
> account shape for users and a review of their ui as well as the final walk through of the flows
> for the different /sign/* onboarding/activation pathways and the admin provisioned versions as
> well as the contract system and the full set of deliverables workflows... Then we can focus on
> the community feed... but that is something really being built properly from the ground up in
> the v2 build... i just want to be sure the core feature set and full functionality is operable in
> v1 so the user testing we collect from first run users on FHE tenant are valid and usable."

ORCH4's read, given to him and not yet contradicted: **flow integrity outranks polish for this
sequencing test.** A `/sign/*` path that works end to end but looks unfinished still yields usable
signal; one that looks finished but silently drops a document does not, and you won't know which.
That argues the `/sign/*` + admin-provisioned + contract + deliverables walkthrough (TASK-ONERAIL,
already specced — see §8a) comes before the globalization pass, not after.

**Concretely, in order:**
1. Check whether the chat thread has responded with the role-split files or the refactor
   documents. If yes, read them before doing anything else in §8b.
2. If TASK-ONERAIL hasn't been run yet, that's the next thing to hand the owner a spawn prompt
   for — it's fully specced, landed in the repo, verified for contention. See §8a.
3. Re-ground the refactor bundle (`docs/design/refactor/`) against OFFERINGDOCS's inverted
   obligation model. This was promised by ORCH4 and not delivered — see §7 and §8b.

---

# 4. THE FULL ACCOUNTING — this session, in the order it happened

Roughly 2026-08-26 evening into 2026-08-27. Picked up from `docs/HANDOFF-ORCH4.md` (ORCH3's
close). Everything below is merged to `main` and pushed unless stated otherwise.

## 4.1 TASK-PAMELA — audited and merged, two defects found in the audit itself

The account-save/horse-fields task from ORCH3's handoff. Verified every headline DB claim against
production directly rather than reading the report's own numbers — held up. **Two things the
report got wrong, both found and fixed in the audit, both applied to prod and pushed:**

- **A Save was still telling the system the lead had been invited.** §A split provisioning into
  save-vs-send, but the trailing `UPDATE requests SET status='invited'` in
  `provision_client_invitation` was never gated on `p_send`. Proven live in
  `BEGIN…ROLLBACK`: saving flipped `requests.status` from `new` to `invited` regardless. Material
  — `inbound_queue`'s `overdue` computation and `dash_people_waiting()` both key off that column,
  so a save would have silently dropped someone from the lead follow-up queue. Fixed
  (`20260824T0900_a_save_does_not_invite_the_lead.sql`), re-proven live: save leaves it `new`,
  send flips it, same invitation id both times.
- **"Barn name" was not one occurrence.** The report's grep was scoped to the deleted contract
  path; repo-wide there were four, one live (`RecordsPage → Horses`). Relabelled to Nickname.

Worktree removed, branch deleted, tagged `archive/pamela-2026-08-24`.

## 4.2 The repo-change review and the plan critique

Reviewed everything merged since the previous review (OFFERINGDOCS's model inversion — see below
— plus the beginning of what's now the surface-editor sequence). Gave the owner a critique of his
proposed four-lane build plan (design/architecture/code/DB-migration split, Fable for design,
Sonnet for authoring): **agreed on the model tiers, disagreed on the seam.** Splitting by layer
(code thread vs DB thread) institutionalizes exactly the failure D17 exists to name — a defect
living in the seam between two correct halves, which is precisely what the PAMELA audit found
(§4.1). Recommended two lanes instead: one design+architecture pass per wave on Fable, one
vertical-slice authoring thread per wave (DB + code + reach together) on a model chosen per wave.
**Not yet re-litigated or ruled on by the owner** — carry this forward as ORCH4's standing
recommendation, not a settled decision.

## 4.3 The OFFERINGDOCS model — read, understood, not yet propagated to the refactor docs

`docs/HANDOFF-OFFERINGDOCS-2026-08-24.md`, read in full. **The obligation model inverted**:
documents now come from the offering purchased or the sign-in door, never from a tag; tags are
derived-only, staff never tick one. New tables (`service_type_document_requirements`,
`sign_path_document_requirements`), new writer (`apply_offering_documents`), new disposition column
(`AT_LOGIN`/`WITH_CONTRACT`/`WHEN_READY`). **`ADMIN-IA.md` and `ADMIN-PAGE-SPECS.md` were written
before this shipped** and describe the old model in their People and Documents zones. **This
re-grounding was promised and not delivered this session** — see §8b, item 1.

Also found, during this review, a discrepancy in the OFFERINGDOCS handoff itself: it claimed
`apply_category_documents` had "no caller that turns a category into paperwork." **False** —
`provision_client_invitation` line 135 still held a live call. This became the seed of TASK-ONERAIL
(§8a) rather than something ORCH4 fixed directly, because the owner's own framing (provisioning /
invitation / document-sharing convergence across three entry paths) made it clearly a
verification-task-shaped question, not a two-line fix.

## 4.4 The DISCO/ORCH/TASK/TEST role-split design conversation

The owner is redesigning how Claude Code threads operate across all his repos — not FHE-specific,
lives at the repos-folder root. Three roles today (DISCO: discovery/chat/logging, ORCH: this
role, TASK: focused low-cost execution) with a proposed fourth (TEST: review/merge/push/worktree
cleanup, split out of ORCH because ORCH juggling live tasks + preparing new ones + review was
producing exactly the RAM/worktree-pileup problems he described). ORCH4's position, given and not
yet contested: **the split is right; TEST as sole merge authority is right; TEST as a
cross-lane coordination point is wrong** — coordination should be a file (a claims board naming
which files/surfaces each lane owns), not a thread, because by merge time a collision has already
happened. A file bundle (orchestrator rules + the six-step-process docs, 16 files across this repo
and `orchestration/`) plus a written SPLIT-BRIEF summarizing the owner's own requirements was
handed to the `claude.ai` chat thread to draft the actual DISCO/ORCH/TASK/TEST role files.
**Response not yet received as of this handoff — check with the owner.**

## 4.5 TASK-ONERAIL — specced, landed, verified for contention, not yet run

Read `docs/tasks/TASK-ONERAIL-three-entry-paths-one-first-login-rail.md` in full before doing
anything with it — it's dense and precise. Adversarial, read-only verification of whether the
three paths that end in a first login (self-service `/sign/*` signup, admin provision, contract
link email) actually converge on one shared mechanism for the required first-login steps, per
D18. Settles the line-135 question from §4.3 as its "Question Zero." Landed in the repo
(`docs/tasks/`), checked for contention against every then-live worktree (none), pushed. **The spec
itself says "no branches beyond your report"** — it runs directly in the canonical checkout, writes
one file (`docs/reports/TASK-ONERAIL-REPORT.md`), commits it (a doc commit, no `FHE_ALLOW_CODE`
needed), does not push, and stops. Spawn prompt:

```
ONERAIL

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-ONERAIL-three-entry-paths-one-first-login-rail.md and build it.
```

**Opus 5 · thinking ON · effort HIGH.** Judgment-heavy (D18's "same mechanism" test isn't
mechanical), not coding — `xhigh` isn't warranted, `high` is the documented sweet spot for this
shape of work. **Has not been run as of this handoff.** When it reports, audit it exactly like
§4.1 and §4.6/§4.7 below before trusting a single claim in it — this task exists specifically
*because* a prior handoff's claim was wrong.

## 4.6 TASK-CONTRACTOPTIONS — the remaining piece merged; most of it was already on `main`

Found live, unmerged worktree `wt-contractoptions` (branch `task/contractoptions`). **This is
where the ancestor-check lesson (§2, §7) was learned.** A dry-run merge against current `main`
staged only 5 of the 11 files the branch's own diff-stat showed. Investigation found the owner
had already merged the bulk of it directly, in two separate commits (`7951b9ee` "four fixes and
the fact-find", and `aeda9941`/`e10624e0` for the full option-list build — five new
`contract_menu_*` RPCs, verified live against production: `contract_menu_dependents` correctly
found 4 clauses / 1 option gate / 1 open document for a real live-lease value, exactly matching the
branch's own report). **Aborted the naive merge before committing it** — it would have replayed
already-landed history under new hashes.

What was genuinely unmerged: `dash_waiting_on_you`/`dash_waiting_on_clients` were **live in
production DB with zero frontend callers** — the dashboard's "whose move it is" reorganization
(four department zones folded into two, per the owner: *"I dont need a section dedicated to
contracts and deals... I need to just have visibility over what is happening and what is waiting
for a next action"*). Cherry-picked the two commits carrying it (`3831fcc4`, `b9bc9edc`) cleanly
onto current `main`, verified `WaitingOnYouZone`/`WaitingOnClientsZone` are actually imported and
rendered from `OwnerDashboard.tsx` (reachable, not just defined), typecheck/lint clean at
baseline, pushed. Worktree fully absorbed by content (confirmed via `git diff main <branch>`, not
assumed), removed; branch deleted.

## 4.7 TASK-SURFACEEDITOR — the third thread in the surface-editor sequence, merged

Read the full report (`docs/reports/TASK-SURFACEEDITOR-REPORT.md`) after checking — correctly,
this time — that it was genuinely unmerged by content diff, not just by ancestor check. **One
editor, `/app/ops/admin/editor`, four tabs (Forms 28 · Documents 26 · Emails 24 · Shared lists
5)**, every surface listed by name, choosing one expands it in place rather than navigating.
Verified myself before merging: `email_template_versions` has 24 backfilled rows and a live
append-only trigger; `content_blocks` genuinely still has 0 rows and `get_content_block` genuinely
still returns NULL under `SET ROLE anon` (the report names this as a known, unclosed gap — public
page copy can't be served from the config store without a security decision about anonymous reads
first, and this thread correctly declined to work around it); zero TypeScript callers of the
`email_template_*` RPCs existed pre-merge anywhere in `src/`, confirming the report's headline
finding that 24 production emails had **no editor at all** before this. Reach verified: route,
`pageRegistry` row, nav row all present for the new editor; all four retired routes
(`/app/ops/admin/forms|menus|templates|templates/:key`) still resolve. Typecheck/lint clean at
baseline. Merged, pushed, archive-tagged (`archive/surfaceeditor-2026-08-27`), worktree removed,
branch deleted.

**Two things this thread flagged as genuinely open, not its job to close:**
- **UI page copy is blocked** on the anon-read security decision above (§7.2 of its report has the
  ordered path to done — anon-safe read, widen `content_block_versions` for title/kind, one reader
  hook, then a `Pages` tab the editor is already shaped to take).
- **`lesson_plans` is deliberately exempted** from this versioning spine — it's a client record
  (D27's shape), not a tenant-configurable surface, and its restore mechanism can't take the
  append-only guard as currently written (superseding a plan UPDATEs the outgoing row's status,
  which the guard would refuse).

Also corrected, verified against `main` rather than inherited: `/app/ops/content` **does** have a
`pageRegistry` row and nav row (a prior report claimed otherwise); `COST_OPTS`/`DUTY_OPTS` are
**dead, not a rival vocabulary** — there are four such constants, not two as previously reported,
and zero live fields reach any of them.

## 4.8 Worktree/branch cleanup discovered already done

`wt-dealparty` (on `task/pagefit`, contract/PDF layout work — the one explicit "stay out" boundary
in TASK-ONERAIL's spec) **no longer exists** — the owner closed it out himself while this thread
was elsewhere. `task/dealparty` (a differently-named branch, not the same work) is confirmed
already merged. `wt-paysign` was found already fully merged (ancestor-confirmed cleanly this
time, no content surprises) and its idle worktree removed. **Nothing outstanding on either.**

---

# 5. WHO YOU ARE WORKING WITH — carried forward, one addition

Everything in ORCH3/ORCH4's prior handoffs about how the owner corrects, thinks out loud, wants
verification not reassurance, and values small direct fixes over ceremony still holds — read
`docs/HANDOFF-ORCH4.md` §5 if you haven't (it's long and worth it in full; not repeated here).

**New this session:** he is now running work in ways that don't route through you — direct merges
of task branches, closing out worktrees himself — while parallel Claude Code sessions (you, a
second orchestrator session, task threads, and a `claude.ai` chat thread) are all live at once.
**This is the system working as he's designing it (§4.4), not a breakdown of process.** The
consequence for you: don't assume your view of `main`/worktrees is current just because you
haven't touched anything — check, every time, per §2's fourth absolute.

**Focus mode is on.** Only your final text message per turn is visible to him.

---

# 6. HOW TO AUDIT WHAT COMES BACK — unchanged, one addition

Steps 1–7 from `docs/ORCHESTRATOR.md` §6 and every prior handoff still apply exactly as written.
**Add, before step 1:** confirm the worktree is still live at all (`git worktree list`) — it may
already be gone. Then, when computing the diff, diff **by content against current `main`**
(`git diff main <branch> --stat`), not only by ancestor check — if the result looks smaller than
a report describes, find the commit that already absorbed the rest (`git log --grep`) before
concluding the branch is stale or the report was wrong. See §2's fourth absolute and
`orchestration/lessons/LESSONS.md`'s newest entry for the full incident this rule is built from.

---

# 7. WHERE THIS THREAD WAS WRONG OR HAD TO CORRECT ITSELF

| the claim or assumption | the correction |
|---|---|
| A `git merge --no-commit --no-ff` dry-run staging fewer files than a branch's diff-stat means something is wrong with the merge | It can mean the branch was already substantially absorbed via a differently-hashed commit. Confirm by content diff and `git log --grep` before concluding either way — don't assume the dry-run tool is telling the whole story from ancestry alone. |
| `git merge-base --is-ancestor <tip> main` returning false means a branch is genuinely unmerged | Not sufficient on its own in a multi-session system. It correctly reported false for `task/contractoptions` even though ~80% of its content was already on `main` under different commit hashes. |
| The refactor bundle re-grounding against OFFERINGDOCS (promised at the end of the previous turn in this thread) would happen this session | It did not — the three worktree audits and the DISCO/ORCH/TASK/TEST design conversation took the whole session. **Explicitly not done. Do it first if nothing else is more urgent — see §3.** |

---

# 8. WHAT IS OPEN — the real register

## 8a. Immediate

- **TASK-ONERAIL** — specced, landed, not run. §4.5 has the spawn prompt. Audit its report with
  the same rigor as §4.1/§4.6/§4.7 when it comes back — this task exists because a prior handoff's
  claim was false, so its own claims get zero benefit of the doubt either.
- **Check the `claude.ai` chat thread** for a response on the DISCO/ORCH/TASK/TEST role-split file
  set, and separately on whatever "missing documents" question prompted this whole check-in.
  §4.4.

## 8b. The refactor bundle — genuinely unresolved, worse than ORCH3 left it

**Everything ORCH3's original handoff (`docs/HANDOFF-ORCH3.md`, superseded but the content below
still applies) flagged as open in the refactor is still open, plus one new one:**

1. **NEW, most urgent: the obligation-model inversion (§4.3) has not been reconciled against
   `ADMIN-IA.md` / `ADMIN-PAGE-SPECS.md`.** Those documents describe a tag-driven People/Documents
   model that OFFERINGDOCS replaced before this session started. Re-reading them with this in mind
   is the first real step of any refactor work — don't spec a single wave against the stale model.
2. The primitive-kit gap (`src/ui/`, the fhe-ui skill) — still doesn't exist; every page spec in
   `ADMIN-PAGE-SPECS.md` still assumes it does.
3. Commit-tier (D19) sign-off — still marked "proposed, awaiting owner sign-off" in its own source
   document.
4. The mobile nav shape — still genuinely undecided, the owner was exploring options, not ruling.
5. **NEW: `TASK-HOMESHAPES`** (`docs/tasks/TASK-HOMESHAPES-four-account-types-one-composable-home.md`,
   committed, unbuilt) describes the member-side composable dashboard in almost the same language
   as the admin-side zone framework. Two documents now describe "a dashboard of zones that shows
   itself" for two different audiences. Reconcile before either gets built further — and note the
   dashboard zone framework just gained a live worked example this session (§4.6's
   `WaitingZones.tsx`) worth reading as a concrete pattern, not just the abstract plan doc.
6. **NEW, smaller: `lesson_plans` reconciliation against `PROGRESSION-PLAN.md`** — still open per
   ORCH3's original finding (real engine, zero rows, unreconciled against the SKILL/FRONTIER/
   MILESTONE model), and now additionally confirmed by SURFACEEDITOR (§4.7) as deliberately outside
   the new versioning spine for a structural reason (its restore mechanism UPDATEs rather than
   appends). Both facts belong in whatever reconciles this.

## 8c. Flagged-not-fixed, real but not urgent, inherited and added to this session

Everything in ORCH3's handoff's §8c still stands (contact_dossier RLS edge cases, the five legacy
booking-ownership RPCs, the three pre-existing UI bugs, `email_templates` lacking an editor — **the
last one is now fixed, see §4.7, remove it from any future copy of this list**). New this session:

- **UI page copy is blocked on a security decision**, not just unbuilt. §4.7. The next thread that
  touches public marketing copy needs to make the anon-read call, not just extract strings.
- **A large number of stale local `task/*` branches** (dozens, visible via `git branch -a`) have
  accumulated from long-since-merged or abandoned threads. Not blocking anything. Low-priority
  hygiene — a sweep to delete branches already confirmed merged (`git branch --merged main`) would
  be safe and mechanical, but is not this session's job and wasn't attempted.

---

# 9. LOAD-BEARING RULES YOU MUST NOT REDISCOVER

Everything in `docs/ORCHESTRATOR.md` §2 and `orchestration/rules/L3-PLAN.md` still applies without
exception. Restated here only where this session found a new instance or a sharper phrasing:

- **`git merge-base --is-ancestor` alone can lie about whether a branch is unmerged, when multiple
  sessions or the owner directly can merge into the same repo.** Diff by content first. §2, §7.
- **A HANDOFF's own claim can be false and become the seed of a verification task** rather than
  something you silently fix — TASK-ONERAIL exists because OFFERINGDOCS's handoff asserted
  something ORCH4 disproved with one query. When a claim is narrow and mechanical, fix it; when
  it's about whether an architectural property (D18's "same mechanism") actually holds across
  multiple paths, that's real investigation and belongs in a spec, not a one-line correction.
- **This system now runs multiple concurrent sessions by design** (DISCO/ORCH/TASK/TEST role
  split, in progress — §4.4). Don't assume you have the only current view of the repo.

---

# 10. READING LIST — in this order

1. `docs/ORCHESTRATOR.md` — the role (unchanged).
2. This file, in full — you're already here.
3. `docs/HANDOFF-ORCH4.md` — still has real content this file didn't repeat: the PAMELA task spec
   detail, the full owner-working-style notes, the D-rule-adjacent context around the surface-
   editor sequence's earlier threads (VERSIONSPINE). Worth the second read even though it's
   superseded as the entry point.
4. `docs/HANDOFF-OFFERINGDOCS-2026-08-24.md` — the obligation-model inversion. Load-bearing for
   anything touching People, Documents, or onboarding.
5. `docs/tasks/TASK-ONERAIL-three-entry-paths-one-first-login-rail.md` — if it hasn't been run yet.
6. `docs/design/refactor/` — all four documents, **with §8b's re-grounding in mind, not as
   settled fact.**
7. `docs/tasks/TASK-HOMESHAPES-four-account-types-one-composable-home.md`.
8. `orchestration/lessons/LESSONS.md` — read the newest entry (the ancestor-check lesson) even if
   you've read this file before; it's new since your last read if you were spawned before
   2026-08-27.
9. `CLAUDE.md` — the live spine. No new D-rule was added this session (nothing here was a product
   decision — the ancestor-check lesson lives in `orchestration/lessons/LESSONS.md` instead,
   because it's a process finding, not an FHE product rule).

**Do not read** `docs/HANDOFF-ORCH3.md` beyond what §10.3 above points you to specifically,
`docs/ORCHESTRATOR-HANDOFF.md`, `docs/HANDOFF.md`, `docs/HANDOFF-CHECKLIST.md`, or
`docs/SESSION_HANDOFF_2026-08-07.md` — superseded, history.

---

# 11. THE PROMPT THAT SPAWNS THE NEXT ONE

You were spawned before this file existed, so this is retrospective for you — but keep it current
for whoever replaces you:

```
FHE-ORCH-6

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/HANDOFF-ORCH5.md, then docs/ORCHESTRATOR.md, and take over.
```

**Model and effort: your own call per §1 of `docs/ORCHESTRATOR.md`** — this thread ran on Sonnet 5
for the audit/merge work (mechanical breadth, traps already known from prior handoffs) and would
recommend Opus for anything that touches the refactor re-grounding in §8b, which is judgment-heavy
in the way §4.2's plan critique already flagged.
