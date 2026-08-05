# TASK A-PARTY-VERIFY — browser-verify the party-side contract experience

Branch: `task/a-party-verify` · Worktree: `wt-averify` (rebased onto `origin/main` @ `7749943`)
Date: 2026-08-04

## Result summary

| # | Item | LESSOR | LESSEE | Notes |
|---|---|---|---|---|
| A2 | Send invite; party opens it | **BLOCKED** | **BLOCKED** | party-controls bootstrap bug (below) — blocks both roles on any freshly authored contract |
| A3 | In-progress field gating per party | **BLOCKED** | **BLOCKED** | same — never reached an in-progress state with invited parties |
| A4 | Preconfigured contract shows nothing demanding review | **BLOCKED** | **BLOCKED** | same |
| A7 | Executed doc is read-only in the UI | **PASS** (found+fixed) | **BLOCKED** | LESSEE is a company party — no account can ever represent it (below) |
| A17 | Party Documents page lists + renders docs | **FAIL** | **BLOCKED** | root cause found, live production impact (below) |
| A18 | Send/Resend me a copy | **FAIL** | **BLOCKED** | cascades from A17 (same page) |
| A19 | Print/download signed PDF | **FAIL** | **BLOCKED** | cascades from A17 (same page) |

No item reached a clean, unconditional PASS on both sides. All FAIL/BLOCKED
verdicts have a precise, code-confirmed root cause below — none are "couldn't
figure out why." One real bug was found small enough to fix on this branch and
was fixed (A7). The rest are RLS/RPC-layer defects or an unbuilt capability,
outside this task's fix authority (`docs/tasks/TASK-A-PARTY-VERIFY.md` fix
policy, exception 1).

## Setup

- Test document (EXECUTED lease): `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`.
  - LESSOR: `d99f1472-48b4-466e-aaa7-f76396745c17` — "CJ Z", `cjzigs@icloud.com`.
    Owner-confirmed test contact. Has a real, working, non-staff (`role=USER`,
    `is_admin=false`) login with `profiles.contact_id` correctly linking to this
    party.
  - LESSEE: `352c3898-65d0-4a90-ad59-29107b7e03fe` — "French Heritage
    Equestrian", `hello@fhequestrian.com`, `is_company=true`. Owner-confirmed
    business-controlled contact. **Not test-substitutable for this document** —
    it's the real party of record on an executed doc, and executed docs/parties
    are never altered.
  - My first pass looked in the wrong table (`contracts`, not `documents`) and
    incorrectly reported the document as missing — the owner corrected this;
    logged so the error is visible, not silently absorbed.
- Fresh pre-signature contract for A2/A3/A4: authored via `start_lease_contract_v2`
  (faked staff JWT context in `psql`, identity = the owner's own SUPER_ADMIN
  profile), title `VERIFY-TEST — Horse Lease (A-PARTY-VERIFY)`. LESSOR = CJ Z
  (same as above). LESSEE = a fresh individual test contact
  (`45f4c06a-d133-428c-88d7-7aa9d2e0cfd9`, "Throwaway Tester",
  `throwaway.taskb.test@example.com`, `is_company=false`, no prior login) —
  substituted for the company LESSEE specifically so a genuine non-staff
  party-gated login was reachable for this fresh contract. Deleted at the end
  of the session (see Cleanup).
- `/api/*` is Vercel-serverless; `npm run dev` runs plain `vite` and does not
  serve it (confirmed: no `vercel dev` script in `package.json`). Anything
  touching an API route was tested against production,
  `https://www.frenchheritageequestrian.com` (canonical domain, confirmed via
  `scripts/seo-files.mjs`).

## Findings

### 1. Party-controls bootstrap bug — blocks A2/A3/A4 for any freshly authored contract

`start_lease_contract_v2` (and `start_sale_contract`, checked as a sibling —
same gap) never inserts into `document_party_controls`. The "Send" button's
party list (`invitableRoles`) and the "Document controls" permission panel
(fill/edit/suggest per role) in `ContractPage.tsx` (~line 566, ~line 1444) are
**both derived from `document_party_controls` itself** — there is no other
source; `contract_document_detail` doesn't expose raw `document_parties`
either. Net effect: a freshly created contract has zero rows in that table,
so the only UI that could ever create the first row never renders. Confirmed
live: navigating to the new VERIFY-TEST contract and clicking "Send" showed
only "Send myself a PDF copy" — no party options.

This is not new-contract-flow-specific by design — the existing EXECUTED
reference document has valid `document_party_controls` rows, so contracts
*have* been configured successfully in the past; this appears to be a
regression in how the role-list is sourced, or the starter RPCs never seeded
it and an older UI iteration derived the list a different way.

**Fix needed (RPC/migration territory, not done here):** either seed default
`document_party_controls` rows in the starter RPCs, or have
`contract_document_detail` return raw `document_parties` so the panel can
bootstrap from the actual party roster instead of from itself.

### 2. A7 — found + fixed: stale "awaiting signature" text on executed docs

`ContractPage.tsx` (~line 1317) rendered a party-facing guidance paragraph
gated only on `!embedded && !isOwnerSide` — no `!isExecuted` check. A party
who had signed saw **"You've signed. The contract executes once the other
party signs."** even after the document was fully `EXECUTED` (both parties
signed). Reproduced live by the owner logged in as CJ (LESSOR) on the
executed lease.

Fixed: added `!isExecuted` to the condition, matching the pattern already
used correctly for the same message elsewhere in the file (the `readOnlyDoc`
block explicitly excludes `state === 'executed'`). `npm run typecheck`
passes. Pure client-side JSX gating — no RPC/migration/`ClauseDocument.tsx`
touched.

Remaining controls on the executed contract page, cataloged and confirmed
legitimate (not defects):
- **Terminate** — a real mutual-termination request, correctly available to
  any signing party on an executed contract (requires the other party's
  approval; doesn't unilaterally mutate the contract).
- **"Add a comment" + a renamable placeholder comment thread** — `ContractNotes.tsx`
  has a server-side trigger (`seed_contract_note`, migration `20260731100000`)
  that auto-creates one starter, renamable comment thread on document
  creation, specifically to avoid an empty first-open state and a
  seed-race between the two parties. By design, not a stray artifact.
- **Expand/collapse change-history rows** — `ContractChangeHistory`, read-only,
  no mutation.
- No editable contract fields, no stray owner-only controls: `PartiesHorseCard`
  correctly computes `canEdit={isStaff && editablePhase}` → `false` for a
  non-staff party; the executed body renders via plain `ContractBody`
  (no `onSelectSpan`, no inline editing).

**A7 = PASS for LESSOR.** LESSEE side is BLOCKED — see finding 4.

### 3. A17/A18/A19 — root cause: `documents.contact_id` is a single-owner column, can't represent a two-party lease

Both the `my_documents()` RPC and the RLS policy gating `SELECT` on
`documents` (`documents_select`, via `caller_owns_document`) check **only**
`documents.contact_id = current_contact_id()`. Neither considers
`document_parties`. For the reference lease, `documents.contact_id` is set to
the LESSEE (`352c3898...`) — so the LESSOR (CJ, a genuine signer confirmed in
`document_parties` with `is_signer=true`) is invisible to both the RPC and
the RLS check. Reproduced live: CJ's `/app/documents` page ("Party Documents")
rendered nothing.

**This is not test-specific.** Query against production right now:

```sql
select count(*) from documents d
where d.status='EXECUTED' and d.deleted_at is null
  and exists (select 1 from document_parties dp
              where dp.document_id=d.id and dp.contact_id <> d.contact_id);
-- => 5
```

Five currently-EXECUTED production documents have at least one real signer
whose `contact_id` differs from `documents.contact_id` — those signers
likely cannot see their own signed documents in their account today. This
predates this task; it wasn't introduced by anything done here.

A18 (self-send copy) and A19 (download/print) both render from rows on that
same page/list — they fail identically because the page never loads a row to
act on, not from independent defects. `EmailMeACopyButton` and "Download
signed PDF" themselves were not exercised (never reachable), so their own
correctness is unverified, not confirmed-broken.

**Fix needed (RLS + RPC territory, not done here):** OR in a
`document_parties`-based check (`caller_is_document_party`, which already
exists and is used correctly elsewhere, e.g. `document_shares_party_read`)
alongside `caller_owns_document` in both the RLS policy and `my_documents()`.

**A17/A18/A19 = FAIL for LESSOR** (reachable, but broken). LESSEE side is
BLOCKED — see finding 4.

### 4. LESSEE side — structurally blocked for a company party, no workaround exists

`352c3898...` (French Heritage Equestrian) is `is_company=true` with no
linked `profiles` row. `redeem_contract_invitation`
(`20260723630000_redeem_dont_repoint_company_party.sql`) explicitly skips
linking `profiles.contact_id` to a company contact — in **both** branches
(fresh account: `IF NOT v_inv_is_company` guards the adopt-identity path;
existing account: `ELSIF ... AND NOT v_inv_is_company` guards the repoint
path). This means **no individual login, fresh or existing, can ever satisfy
`document_parties.contact_id = profiles.contact_id` for this party** — it's
not specific to using a staff login.

Separately confirmed: `hello@fhequestrian.com` (the LESSEE's contact email)
is also the live login for the owner's own staff/admin account ("Claire",
`is_admin=true`, `role=ADMIN`). Traced the full access path (RLS policies,
`my_roles` computation in `contract_document_detail`, client gating in
`ContractPage.tsx`) — `is_admin()`/`has_staff_access()` unconditionally
bypass every party-gated check at every layer, so even redeeming the pending
invite would land that login in the full admin/owner editing surface, never
the true LESSEE-restricted view. **No "view as party" mechanism exists** —
confirmed by grepping for `act_as_company`, `company_party`, `is_party_of`,
`can_view_document`, `resolve_party` and inspecting every RLS policy on the
relevant tables: nothing implements it.

Mid-session, the owner proposed the correct direction: an admin-only
"view-as"/impersonation lens that lets staff preview the true party-restricted
UI without actually becoming the party (no `contact_id` repoint, no RLS
change to grant real access — a simulated view). **Not built here** — it's a
new capability spanning RLS/RPC/client, outside this task's fix policy. Flagging
as a distinct recommended follow-up task.

**A7/A17/A18/A19 = BLOCKED for LESSEE.** No click was spent confirming this
empirically for A17-19 once the code-level proof was clear for A7 — the same
root cause applies identically (no login can ever equal the company's
`contact_id`), so a browser attempt would fail for the identical, already-proven
reason.

## Out of scope, flagged for follow-up (not investigated further)

- Owner-reported: the Orders page in Account has a back button that routes to
  the Community feed instead of back to Account. Unrelated to this task's
  items; not investigated or fixed.

## Cleanup

The VERIFY-TEST contract/document (`6a973c29-d1d1-4dd5-8398-27fb251a3601` /
`27201617-af7c-4001-93d1-cfebdc1b1d72`) was never signed and never
successfully invited (the bootstrap bug prevented any invite from being
sent), so no party ever saw or was notified about it. Hard-deleted via the
existing `hard_delete_contract` RPC (same one the UI's delete action calls).
Confirmed removed — a lookup for both IDs across `contracts` and `documents`
after deletion returns zero rows.

The executed reference document (`ecaecd42...`) and its parties were never
touched — no edits, no signature changes, no deletions. The owner's account
password for `cjzigs@icloud.com` may have been reset via the "Forgot
password?" flow during login (owner-initiated, on their own test contact).

## Recommended follow-up tasks (not done here — flagging for the orchestrator)

1. **Party-controls bootstrap fix** — seed `document_party_controls` in
   `start_lease_contract_v2`/`start_sale_contract`, or expose raw
   `document_parties` from `contract_document_detail`. Blocks A2/A3/A4 on
   every freshly authored contract today.
2. **Multi-party document visibility fix** — add a `document_parties`-based
   OR-clause to the `documents_select` RLS policy and to `my_documents()`.
   Confirmed live production impact: 5 executed documents today have a real
   signer who can't see it on their own Documents page.
3. **Admin "view-as-party" lens** (owner-directed design) — lets staff
   preview the true party-gated UI for a company party (or any party) without
   repointing identity or opening a real RLS hole. Needed before company-party
   experiences (A2/A3/A4/A7/A17/A18/A19 LESSEE-side, and likely others) can
   ever be genuinely verified or used for QA.
4. Orders-page back-button mis-route (Account → should return to Account, not
   Community feed) — low priority, unrelated to this task.

## BUILD_TRACKER.md updates

A2, A3, A4 → BLOCKED (was NOT VERIFIED / BUILT). A7 → PARTIAL, LESSOR-side
verified PASS with one fix, LESSEE-side BLOCKED (was PARTIAL). A17, A18, A19 →
FAIL with root cause, LESSOR reachable, LESSEE BLOCKED (was NOT VERIFIED /
BUILT). See tracker for exact wording.
