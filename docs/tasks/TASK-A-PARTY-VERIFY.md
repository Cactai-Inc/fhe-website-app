# TASK A-PARTY-VERIFY — browser-verify the party-side contract experience

Tracker items: **A2, A3, A4, A7, A17, A18, A19**. All are BUILT or PARTIAL; none are
browser-verified. This task's product is VERIFIED STATUSES + fixes for anything that fails,
not new features.

## How this task works

You cannot click a browser. The owner is your hands. Your job:
1. Stand everything up and do all code-path + DB pre-verification yourself.
2. Produce a numbered CLICK SCRIPT for the owner — exact URLs, exact expected outcomes.
3. The owner executes it and tells you what they saw; you verify server-side effects in the DB
   after each relevant step, record PASS/FAIL per item, and fix small failures on this branch.
4. Anything failing that is bigger than a small fix: stop, describe the defect precisely, ask.

## Setup

- Branch `task/a-party-verify` off `origin/main` (contains today's merged A8B/R11/C/B work) in
  your OWN worktree (`git worktree add ~/Downloads/claude-code-repo/wt-averify -b
  task/a-party-verify origin/main`). Copy this doc + `.env.db` from the shared checkout
  (both untracked there).
- `npm install`, then `npm run dev`. Note: `/api/*` endpoints are Vercel functions — determine
  whether the dev server serves them (`vercel dev` vs `vite`); check package.json scripts and
  say which applies. Anything requiring a deployed endpoint gets tested against the PRODUCTION
  site instead (it deployed today's main) — say per item which host you used.
- Test identities: use the lease test document `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` and its
  parties (LESSOR `d99f1472-...`, LESSEE `352c3898-...`). FIRST verify via psql that both party
  contacts are owner-controlled test emails; if either looks like a real customer, STOP and ask.
  Determine how each party authenticates (existing accounts? magic link? invite link?) and
  prepare working login steps for the owner — if you cannot mint a login without sending email
  to an address the owner doesn't control, STOP and ask.
- That document is EXECUTED — good for A7/A17/A18/A19. For A2/A3/A4 you need a contract in a
  pre-signature state: author a NEW lease as admin (via the UI click script or the same RPCs the
  UI calls — `start_lease_contract_v2` family), parties = the same two test contacts. Mark it
  clearly (title containing "VERIFY-TEST") and delete/void it at the end per the cleanup rule.
  NOTE: signed/executed documents are NEVER deleted (owner rule) — only the unsigned test
  contract gets cleaned up. Do not sign the new test contract to execution unless needed for
  A7's locked-state check, and if you do, it stays (log it).

## The items — each ends PASS / FAIL / BLOCKED with evidence

- **A2** — Admin sends the new contract to parties; each party receives the invite and can open
  the contract from it. Verify: delivery rows / invite links in DB, then owner opens as each
  party. (If email sending from dev isn't possible, extract the invite link from the DB and
  have the owner open it directly — say so in the report.)
- **A3** — Logged in as LESSOR on an in-progress contract: lessee-owned fields are visually
  inert (the 08-04 affordance) and uneditable; server rejection ("not authorized to edit this
  field") never surfaces because the UI never lets them try. Then the same as LESSEE for
  lessor-owned fields.
- **A4** — Preconfigure the test contract fully as admin (every admin-side selection made).
  As the counterparty: nothing demands review — gated previews show only unmade + their-owned
  selections. Record exactly what the party still sees and judge it against "nothing demanding
  review"; borderline = FAIL with a screenshot description, not a shrug.
- **A7** — On the EXECUTED document, as EACH party: read-only in the UI — no editable fields,
  no action buttons that mutate. List every interactive control still visible and whether it is
  legitimately read-only (e.g. "Email me a copy" is fine).
- **A17** — Party Documents page: open each listed document, final PDF view renders.
- **A18** — "Send me a copy" button (label should read Send vs Resend correctly per
  `executed_email_sent_at`), owner clicks, email arrives with correct PDF. Verify the
  `document_deliveries` row appears. This also closes A8B's deferred write-test.
- **A19** — Print / download from the Documents page: owner downloads, PDF opens, signatures
  visible.

## Fix policy

Small UI defects found during verification (wrong label, missing gating, dead button) get fixed
ON THIS BRANCH immediately, re-verified, and listed as found+fixed. TWO EXCEPTIONS — report as
FAIL with precise diagnosis, do NOT fix: (1) anything touching RPCs, migrations, or another
lane's design; (2) anything inside `src/components/app/ClauseDocument.tsx` — that file is under
a separate quality audit and is FROZEN to all threads; renderer defects get diagnosed precisely
(what data, what rendered, what should have rendered) and handed back, never patched here.

## Report

`docs/reports/TASK-A-PARTY-VERIFY-REPORT.md`, committed + pushed on the branch. Per item:
PASS/FAIL/BLOCKED, evidence (owner's observed outcome + your DB verification), fixes made,
cleanup performed (the unsigned test contract voided/removed — cite the rows). Update
`docs/archive/BUILD_TRACKER.md` statuses honestly (owner-observed = DONE). Print ONLY the report path.
Honesty rule: an item is PASS only if the owner actually performed the step and said what they
saw — you may not infer a PASS from code reading in this task.
