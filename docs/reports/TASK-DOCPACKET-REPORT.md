# TASK DOCPACKET — report

**Task:** `docs/tasks/TASK-DOCPACKET-onboarding-is-one-packet.md`
**Branch:** `task/docpacket` (worktree off `origin/main`)
**Status:** DONE — applied to production (DB) and committed locally (frontend). Not pushed.

---

## 1. Decisions taken (owner-directed)

The task doc flagged four open questions. The owner answered directly in this session:

- **View style — expand to reveal individual documents.** Matches the task doc's own
  DECIDED section. The packet row is a container; every underlying document still opens
  and signs exactly as it does today.
- **Partial state — a simple count, "X of Y signed."** Purely derived from the same
  per-row status this page already computes for each document — cannot drift out of
  sync with what's on screen.
- **Lease placement — outside the packet.** A lease has `contract_templates.wall_gating
  = false` (confirmed live: `HORSE_LEASE_V2` rows all show `wall_gating = f`), so it's
  never a packet candidate — no special-case code needed, the same flag that defines the
  packet excludes it for free.
- **Packet name — owner's call, not guessed.** Implemented with a placeholder so nothing
  waits on it:

  **Recommended: "Onboarding Packet"** — echoes the owner's own word for this ("they are
  meant to be a packet") directly in the UI.
  **Alternative: "Onboarding Documents"** — plainer, matches the tab's existing
  "Documents" label.

  The name lives in one place: `DOCUMENT_PACKET_NAME` in
  [`src/pages/app/Admin.tsx`](../../src/pages/app/Admin.tsx) (search for it — one string
  constant, one-line change to swap it).

## 2. What changed

**Grouping key: `contract_templates.wall_gating`** — the same boolean `my_wall_state()`
already reads to define "onboarding class." No migration, no new column, no stored
relationship. A document's packet membership is computed at read time from its
template's flag, so swapping a document in or out of onboarding changes the packet's
contents automatically, per the task doc's core requirement.

**DB — `supabase/migrations/20260811T1300_docpacket_admin_documents_wall_gating.sql`**
`admin_client_documents(uuid)` (the RPC behind the Clients → Documents tab) now returns
one additional column, `wall_gating boolean`, on both branches of its UNION (real
documents via `LEFT JOIN contract_templates`, and synthetic NOT_STARTED/ASSIGNED
requirement rows via the join it already had to `contract_templates t`). Everything else
about the function — the requirement logic, the pseudo-id scheme for unstarted rows, the
`is_admin()` gate — is untouched. `DROP FUNCTION` + `CREATE FUNCTION` was required
because Postgres won't `CREATE OR REPLACE` a return-type change; grants were explicitly
restored to match what was live (`authenticated`, plus Postgres's default `PUBLIC`
EXECUTE, which was already granted pre-change) — verified before and after, byte-for-byte
same grantee list. **No REVOKE was added** — tightening that function's access posture is
a separate, unrelated decision and wasn't made here.

**Frontend — `src/pages/app/Admin.tsx`.** Replaced the flat `RpcListTab` call for the
Documents tab with a new `DocumentsTab` component:
- Fetches the same RPC, then splits rows by `wall_gating` into `packetRows` /
  `otherRows` — no other query, no new RPC.
- `packetRows` render as one collapsible card (title, "`X` of `Y` signed", chevron).
  Expanding it reveals the packet's contents via the **same** `RowList`/`ListRow`
  rendering the flat list always used — same title, sub-line, status badge, and
  click-through `href` to `/app/ops/documents/:id` for real documents. Nothing about how
  a document opens or signs changed.
- `otherRows` (leases, any future non-onboarding contract) render below, unchanged from
  today — same component, same row shape, same behavior.
- Signed count = `packetRows` whose `docDisplay(status, workflow_state).tone === 'done'`
  — the exact tone logic this page's badges already use, so the aggregate number matches
  what a staff member would get counting the expanded rows by eye.

**Nothing was deleted, hidden, or retired.** No boolean-gated retirement was needed
because no surface became redundant — the flat-row rendering logic is reused verbatim
for both the packet's expanded contents and the non-packet rows; there's no second
rendering path competing with a first one.

## 3. A defect found, not fixed (flagging per standing cleanup duty)

`Admin.tsx`'s Documents tab calls `docDisplayLabel(r.status, r.workflow_state)` **without**
`currentStatus`, so a document whose `current_status = 'superseded'` (an old signed copy
kept as evidence while a re-assigned pending copy awaits a fresh signature — CJ Z's case,
confirmed live) displays as plain "Signed" here instead of "Superseded." The member-facing
page already carries this fix (`docDisplayLabel(status, workflow_state, currentStatus)`,
per `documentStatus.ts`'s own 2026-07-30 comment: "the staff list could not" tell them
apart). This is pre-existing and **not touched by this task** — the packet's "X of Y
signed" count inherits this exact per-row logic, so it's consistent with what's already
on screen today, but it means the count can currently overstate "signed" by one for
anyone mid-re-sign (CJ Z would show slightly better than reality: an old executed row
still counts as signed even though a fresh signature is pending). Worth its own follow-up
task; out of scope here (presentation-grouping only, not a correctness pass on the
underlying badge).

## 4. Verification

**Live DB, direct proof (not just typecheck).**
- Dry-run: applied the migration inside `BEGIN…ROLLBACK`, queried
  `admin_client_documents` for a real account, rolled back, then applied for real.
- Confirmed CJ Z's real 8-document case (the exact number the task doc's own 2026-08-10
  audit cites) — all 8 rows carry `wall_gating = true`, so all 8 collapse into one
  packet: 6 `EXECUTED` + 2 `AWAITING_SIGNATURE` → "6 of 8 signed."
- Confirmed a real lease (`HORSE_LEASE_V2`, `contract_kind = 'HORSE_LEASE'`) carries
  `wall_gating = false` on every row checked (6 documents, mixed VOID/AWAITING/EXECUTED)
  — none of them would ever enter the packet.
- Confirmed grants on `admin_client_documents` are identical before/after
  (`PUBLIC, anon, authenticated, postgres, service_role` — all `EXECUTE`, no change).

**Frontend.**
- `npm install` (fresh worktree, no prior `node_modules`).
- `npm run typecheck` — **0 errors.**
- `npm run lint` — **0 errors**, 35 warnings, none introduced by this change (verified
  none of the reported warning lines fall inside the new `DocumentsTab`/
  `adminDocRowToListRow` code; the two `Admin.tsx` warnings shown are pre-existing
  `useCallback` dependency warnings on unrelated hooks).
- `npm run dev` boots clean, root route returns `200`.

**Not done — authenticated browser click-through.** No `chromium-cli`/Playwright
available in this environment, and this worktree's `.env` (`VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY`) are literal placeholders, not live credentials — there is no
way to log in as staff and load `/app/admin` from here. This is the same blocker
TASK-ACCOUNTSURFACE hit and logged ("browser verification blocked, no Supabase creds in
worktree"). Verification instead went as deep as the DB layer allows: the exact RPC the
UI calls, proven against production data for both the packet case and the excluded-lease
case, plus a clean typecheck/lint/build of the component that consumes it. Recommend an
owner or thread with a real staff session give the Documents tab one visual pass before
this is considered fully closed.

## 5. Open item for the owner

**Packet name.** Pick between "Onboarding Packet" (current default) and "Onboarding
Documents," or supply different wording — one string, `DOCUMENT_PACKET_NAME` in
`Admin.tsx`.
