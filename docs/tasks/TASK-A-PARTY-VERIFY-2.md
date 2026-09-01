# TASK A-PARTY-VERIFY-2 — second pass: A2/A3/A4 + A17/A18/A19

First pass (`docs/reports/TASK-A-PARTY-VERIFY-REPORT.md`) was blocked by two production bugs,
BOTH NOW FIXED AND DEPLOYED: party-controls bootstrap (TASK-PARTYCTRL — starters seed
`document_party_controls`) and party document visibility (TASK-DOCVIS — `documents_select` +
`my_documents()` honor `document_parties`). This pass re-runs exactly the items those bugs
blocked. A7 LESSOR is already PASS (don't redo); LESSEE-side remains out of scope until the
dedicated company signing account exists (owner decision made, not yet executed).

## How this works (same as pass 1)
You cannot click a browser. Owner is your hands: pre-verify code/DB yourself, hand numbered
click-script batches, verify DB effects between batches, record PASS/FAIL per item. Small UI
fixes on this branch; RPC/migration defects and ANYTHING in `ClauseDocument.tsx` (FROZEN) get
diagnosed and reported, never patched here.

## Setup
- Fresh worktree `~/Downloads/claude-code-repo/wt-averify2`, branch `task/a-party-verify-2`
  off `origin/main`. Copy this doc + `.env.db` from the shared checkout (untracked).
- Test identities from pass 1: LESSOR = CJ Z (`d99f1472-...`, cjzigs@icloud.com, working
  non-staff login). Fresh individual LESSEE test contact: create one again
  (pass 1's "Throwaway Tester" was deleted) — same pattern, owner-controlled email only.
- Author a fresh VERIFY-TEST lease via the UI (or the same RPCs it calls) — the starters now
  seed controls, so the Send list and permissions panel must populate this time; that
  population is itself the first check.
- Production is deployed from today's main — confirm the deploy is current enough to include
  DOCVIS/PARTYCTRL (check that a freshly authored doc gets controls rows; check my_documents
  for CJ returns the executed lease) BEFORE handing the owner any clicks.
- EXECUTED reference doc for A17-19: `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` (CJ = LESSOR).
  NOTE: its `executed_email_sent_at` is now SET (A8 testing) — the self-send button should
  read "Resend me a copy"; that's expected, and A18's click now also verifies the Resend
  label variant.

## Items
- **A2** — send the fresh contract to both parties; each opens it from their invite. DB checks:
  invitation rows, then owner opens as each party.
- **A3** — as LESSOR on the in-progress contract: lessee-owned fields visually inert +
  uneditable; as LESSEE: lessor-owned likewise.
- **A4** — fully preconfigure as admin; counterparty sees nothing demanding review. Record
  exactly what they still see; borderline = FAIL with description.
- **A17** — CJ's `/app/documents` now lists the executed lease (DOCVIS); open it, final PDF
  view renders.
- **A18** — "Resend me a copy" click → email arrives with correct PDF; verify the new
  `document_deliveries` row (this also closes A8B's deferred write-test).
- **A19** — download/print; PDF opens; both signatures visible.

## Cleanup
Unsigned VERIFY-TEST contract: void/delete at the end (cite rows). If you sign it to
execution for any reason, it STAYS (signed docs are never deleted) — log it. Throwaway LESSEE
contact: delete at the end unless it now holds signed documents.

## Report
`docs/reports/TASK-A-PARTY-VERIFY-2-REPORT.md`, committed + pushed. Per item PASS/FAIL/BLOCKED
with owner-observed evidence + your DB verification; fixes made; cleanup performed. Update
`docs/archive/BUILD_TRACKER.md` honestly (owner-observed = DONE). Print ONLY the report path.
PASS requires the owner actually performed the step and said what they saw.
