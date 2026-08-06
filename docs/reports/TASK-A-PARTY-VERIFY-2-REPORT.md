# TASK A-PARTY-VERIFY-2 — REPORT

Second-pass party-side verification (A2/A3/A4/A17/A18/A19), re-running items blocked in pass 1
by the PARTYCTRL and DOCVIS bugs (both confirmed fixed and live in prod before any owner clicks
were requested). This pass surfaced one production incident, two renderer bugs (fixed), one new
RLS gap (diagnosed, not fixed), one account-provisioning gap (diagnosed, scoped to a new
workstream by the owner), and one feature request (spec'd for a separate build).

## Pre-verification (before any owner click)

- `document_party_controls` seeding (PARTYCTRL) and `my_documents()`/`documents_select`
  party-visibility (DOCVIS) confirmed live in prod via direct prosrc/RLS inspection and a
  rolled-back `start_lease_contract_v2` call proving fresh controls seed correctly.
- CJ (`d99f1472-…`, `cjzigs@icloud.com`) reconfirmed as a working, owner-controlled, non-staff
  LESSOR test identity.
- Fresh individual LESSEE test contact created per the task doc's instruction:
  `85fa1abe-346e-49fa-bf90-bbbebe7105ea`, "AVERIFY2 Tester", `cjzigs+averify2@icloud.com`
  (plus-address of the owner's own controlled inbox — no undeliverable domain used).
- Fresh VERIFY-TEST lease authored via `start_lease_contract_v2` (not rolled back): contract
  `50294595-07e5-41e1-889d-b419446180ba`, document `9a56b738-36f7-4a55-a813-cdd17fe4d753`.
  Controls confirmed seeded for both roles via `contract_document_detail`.

## Item results

| Item | Result | Evidence |
|---|---|---|
| A2 (admin sends) | **PASS** | Owner clicked Send → "Send to both parties" on the correct document (verified party names before the click, per the fresh-tab/in-app-nav discipline adopted after the incident below). `invitations` table shows 2 real send events, both correctly targeting `9a56b738-…`, none touching any other document. |
| A2 (party opens invite) | **BLOCKED** | See "New defect: brand-new party can't redeem a contract invite" below. CJ's own invite link (existing account) was reported by the owner as landing on a non-functional/"unwired" page — not independently reproduced or root-caused; logged as an open item needing live browser evidence (console/network), same as the cold-navigation finding. |
| A3 (lessee fields inert to lessor, vice versa) | **BLOCKED** | Depends on a working non-staff party session on the fresh contract, which A2's blocker prevented. Not attempted. |
| A4 (fully preconfigured, nothing demands review) | **BLOCKED** | Same dependency as A3. Not attempted. |
| A17 (party's Documents page lists + opens the executed lease) | **PARTIAL — new, different blocker found** | CJ correctly sees the executed reference lease (`ecaecd42-…`) listed via the DOCVIS-fixed `my_documents()` — owner-confirmed, matches server-side re-verification. But "nothing to click into" — root-caused to a **new** RLS gap, see below. Server-side visibility (DOCVIS's actual scope) is proven; the richer view/download UI is blocked by an unrelated table's missing policy. |
| A18 (self-send a copy) | **PASS** | Owner clicked "Resend me a copy" on the plain (DOCVIS) list — that path doesn't depend on the broken `document_parties` read. Took a while but succeeded; owner confirmed "sent to my email address." No *new* `document_deliveries` row appeared, which is correct, not a bug — the endpoint's documented behavior treats a resend's unique-index collision as expected success (mail still sends via `sendViaProvider`; only the log dedup, not the delivery). |
| A19 (download/print, both signatures visible) | **PASS** | In-app download button is in the same blocked section as A17, so the owner verified via the PDF attachment from the A18 email instead. Both signatures present (Claire/LESSEE typed signature, CJ Z/LESSOR typed signature). Owner flagged the LESSEE block showing only "Printed Name: French Heritage Equestrian" with no name/title breakdown — root-caused and confirmed correct: this document predates the `SIGNATURES.LESSEE_CAPACITY` clause (name+title+"signing on behalf of", gated on `LESSEE.PARTY_TYPE='ENTITY'`) — its frozen field set has none of those fields. Signed documents are never retroactively modified, so this is expected, not a defect. |

## Incident: Send action landed on a real, unrelated document

While handing the owner the A2 click batch, "Send to both parties" was clicked on a document
that was **not** the linked VERIFY-TEST contract — it landed on a real, pre-existing lease
(`704c8d2d-…`, LESSOR = Sarah Rosengard, a real customer; LESSEE = French Heritage Equestrian).
The action advanced that document's workflow (`ready_to_sign` → `in_review`/`sent_for_review`)
and sent real invitations — Sarah's was **already redeemed** by the time this was discovered.

Root cause (owner-reproduced: pasted the correct URL, page never actually loaded the new
document — right URL, wrong/stale content): `ContractPage.tsx`'s `load()` never cleared
`detail` (and dependent state: `signingSet`, `redline`, `partiesSummary`, `sigState`,
`structure`, `controlNote`) before fetching a new document, so a previously-loaded document's
fully-interactive page — including its real Send button — could remain on screen across a
navigation to a different document's URL.

**Fix (orchestrator-approved, merged to `main` at `1d78b49` and deployed before any further
clicks):** `load()` now clears all per-document state synchronously before its first `await`,
and guards every async resolution against `idRef` (always the latest route id) so a stale or
out-of-order response can never overwrite the current document. A loading skeleton (the page's
existing `if (!detail || !doc) return <Loading…>` guard, previously dead code for this case)
now correctly shows during the gap. Follow-up fix on the same branch: the first version of this
patch also cleared the `note` banner, which wiped `sendReview()`'s own success message
("Notified — all parties…") almost instantly since that function calls `load()` right after
setting it — `note` isn't per-document content and shouldn't have been in the clearing set;
removed.

**Disposition of the affected real document (Sarah Rosengard's lease), owner/orchestrator
ruling:** left alone entirely. The premature send is accepted as a live, real negotiation going
forward; her field permissions were separately unlocked at the orchestrator level. Not part of
this task's test set; not touched again after the ruling.

## New defect, diagnosed: `document_parties` has no non-staff read policy

`signatures_select` and `documents_select` both have real permissive policies letting a genuine
party read rows they're party to. `document_parties` does not — its only two policies are
`document_parties_org_boundary` (**RESTRICTIVE**, `org_id = current_org()`) and
`document_parties_staff_all` (**PERMISSIVE**, `has_staff_access()`). A restrictive policy only
narrows access a permissive policy already grants; it never grants access alone. With the only
permissive policy requiring staff, a genuine non-staff party gets zero rows from a direct
`document_parties` read — silently (RLS filters, no error).

This is why A17's plain list (driven by the `my_documents()` RPC, `SECURITY DEFINER`, bypasses
RLS) correctly shows the document, but the richer "Contracts you've signed" section (driven by
`listMySignableDocuments()`, a client-side query against `document_parties` as the caller's own
session, fully RLS-subject) silently returns nothing — no click-through, no PDF view, no
download button ever render for a real party. Confirmed empirically: CJ's own
`document_parties` row is invisible to CJ's own session; `current_org()` matches the row's
`org_id` exactly, ruling out an org mismatch.

**Not fixed here** — this is an RLS/migration change (new permissive SELECT policy needed on
`document_parties` for `contact_id = current_contact_id()`), out of scope for in-line
patching per this task's rules. Recommend a dedicated policy migration, dry-run + verified the
same way PARTYCTRL/DOCVIS were.

## New defect, diagnosed: brand-new party can't redeem a contract invite

`redeem_contract_invitation` requires an existing `profiles` row for the signed-in user
(`IF NOT FOUND THEN RAISE EXCEPTION 'no profile for the signed-in user'`). For a genuinely new
invitee (no prior account — the AVERIFY2 test contact), nothing creates that row:
`register-invited.ts` creates the `auth.users` row directly via the admin API, and **there is
no trigger on `auth.users`** to auto-create a matching `profiles` row (confirmed: zero triggers).
The sibling community-invite path (`redeem_invitation`) apparently does create the profile
itself — this asymmetry is the actual gap. `Register.tsx`'s catch block also masks the real
error behind a generic "We could not finish activating your account" (only reads `err.message`
when the error is a JS `Error` instance; a Postgres/PostgREST error object isn't one).

**Owner ruling (scoped to a separate thread, not built here):** the invite flow works for
existing/active users; what's missing is a dedicated account-creation pathway for **deal-only
parties** — a new user category, restricted to documents + horse records, no other app access,
promotable to a full relationship later.

## Open, unconfirmed finding: cold/direct navigation into `/app/...` fails

Reported by the owner during this session: pasting a direct URL to *any* `/app/...` route
(not just contracts) failed to load in their Chrome session — reproduced across a fresh tab and
a full browser restart, not reproduced in Safari (different account) or via in-app navigation
from an already-warm session. Ruled out: DNS/TLS/hosting (the plain site and in-app navigation
both work fine in the same session). Investigated but not confirmed: a possible
auth-bootstrap-on-cold-load hang in `AuthContext.tsx` (its `loading` state is `.finally()`-guarded
against thrown errors, but not against a request that never settles at all) — plausible but
unproven without live browser console/network evidence, which wasn't available. Per the
orchestrator's ruling, not chased further by static reading. **Needs live repro with devtools
open** to root-cause properly.

## Fixed, working-as-designed (not a bug): insurance "not required" checkboxes

Reported alongside the `PURPOSE.RECREATION` gating bug (below) as also appearing inert. Traced
fully: `contract_document_detail`'s `can_edit` computation has an explicit, documented
party-exclusive carve-out for six insurance fields (`TXN.GL_NOT_REQUIRED`,
`TXN.MED_NOT_REQUIRED`, `TXN.MORT_NOT_REQUIRED`, and their `*_LESSEE_RESPONSIBLE` counterparts)
— staff status deliberately does not substitute for owning the role. On Sarah's document
specifically, FHE holds LESSEE (not the LESSOR the comment's example assumes), and the
`*_NOT_REQUIRED` fields are LESSOR-owned (Sarah's own elections) — so admin correctly cannot
edit them. Not a rendering bug; not touched. Flagging that the code comment's assumption
("FHE is itself the Lessor on these contracts") doesn't hold for a reverse-direction lease —
whether staff should ever fill a counterparty's exclusive fields on their behalf (mirroring the
existing barn-office wet-signing precedent) is a product decision, not made here.

## Fixed: `ClauseDocument.tsx` gate chicken-and-egg (orchestrator-approved)

Reproduced by the owner on Sarah's document (viewing as ADMIN — ruling out permissions): the
"Purpose of Agreement" section rendered gray, its select inert. Root cause: `PURPOSE.RECREATION`'s
body is `"For {{TXN.LEASE_PURPOSE}} purposes, …"` — the select is simultaneously its own
clause's gate trigger *and* inlined in that clause's prose. The existing self-toggle protection
(`gateTriggerKeys`/`gateControls`, which lets a clause's own driving field stay interactive
above the muted preview) explicitly excludes any trigger field already referenced by a body
token, to avoid double-rendering — leaving this field with no interactive rendering at all,
trapped inside the `pointer-events-none` wrapper with no way to ever supply the value that
would open its own gate.

**Applied fix** (orchestrator-approved exact diff, `ClauseDocument.tsx` line ~866): when the
clause is gated off *and* the field is that gate's own trigger, include it as an orphan despite
being body-inlined, routing it through the already-built `gateControls` path. Accepted tradeoff,
orchestrator-directed, no suppression logic added: while unanswered, the field renders twice
(live control above, inert placeholder inline) — resolves the instant a value is picked.
**Flagged for the upcoming renderer rebuild**: a gate-driving field should always have exactly
one live rendering regardless of where its token lives.

Verified the fix is generic (keys purely on field_key matching, not field type) and would cover
a checkbox-kind field in the identical trap — but swept every checkbox-type self-gating field
across all four templates and found none currently in that specific trap (all are pure orphans,
never body-inlined), so nothing further needed there.

## Fixed: `Documents.tsx` copy (owner feedback)

`EmailMeACopyButton` label: "Resend me a copy"/"Send me a copy" → "Resend a copy to me"/"Send a
copy to me". Success message: dropped the trailing period after the email address
("Sent to x@y.com" not "Sent to x@y.com.").

## Spec only, not built: document-card status stamp trail (for the orchestrator to author)

Owner request, deferred to a separate build alongside the RLS/invite-provisioning fixes above.

**Design:**
- A "Complete" badge on the executed-document card (top-right, beside the title) once there's
  no remaining action for the viewer.
- The line currently reading "Signed · [date]" becomes a chronological stamp trail, oldest →
  newest, left to right: `Created · [date] → Sent to everyone · [date] → Signed · [date] →
  Sent to you · [date]`, repeating a "Sent to you" stamp for every resend (not collapsed to
  latest-only).
- `status_events`' richer multi-stage lifecycle (assigned → ready-to-sign → sent-for-review…)
  is **not** needed for this — confirmed with the owner that only contracts have that shape,
  and there are no real ones yet; every other document type only needs signed/sent/resent, all
  already available.

**Data/migration needed:** `my_documents()` already returns `created_at`, `signed_at`, and
`executed_email_sent_at` — no change needed for those three stamps. The only gap is the
viewer's own resend history, which can't be read client-side (`document_deliveries` has no
party-facing RLS policy, same class of gap as `document_parties` above). Add one column to the
RPC's "executed" branch:

```sql
(SELECT array_agg(dd.delivered_at ORDER BY dd.delivered_at)
   FROM document_deliveries dd
  WHERE dd.document_id = d.id AND dd.recipient_contact_id = current_contact_id()
    AND dd.deleted_at IS NULL)                                    -- my_resends timestamptz[]
```
with `NULL::timestamptz[]` in the other two `UNION ALL` branches to keep types aligned. Known,
accepted tradeoff: the first entry in that array will usually be near-identical to
`executed_email_sent_at` (the automatic delivery created at execution) — two honest
perspectives on the same moment, not deduped.

## UI feedback (not built, logged for backlog)

- Staff Documents queue (`DocumentQueueTable.tsx`): the "Contract" column (raw contract-id
  prefix) is wasted space; owner wants a parties column instead.

## Cleanup

- VERIFY-TEST document `9a56b738-36f7-4a55-a813-cdd17fe4d753` / contract
  `50294595-07e5-41e1-889d-b419446180ba`: never signed, voided via `void_document()` (staff,
  reason logged, 2 parties notified — both owner-controlled test addresses).
- Throwaway LESSEE contact `85fa1abe-346e-49fa-bf90-bbbebe7105ea`
  (`cjzigs+averify2@icloud.com`): held no signed documents, soft-deleted.
- Sarah Rosengard's document (`704c8d2d-…`): explicitly NOT touched, per the orchestrator's
  ruling — it stands as a live negotiation.

## Commits on this branch (`task/a-party-verify-2`)

1. `ContractPage: clear per-document state synchronously on id change` — the incident fix.
2. `ContractPage: don't wipe the action-result banner on load()` — follow-up to the above.
3. `ClauseDocument: let a gate-driving field stay actionable when body-inlined` — orchestrator-approved gating fix.
4. `Documents: copy tweaks on the email-me-a-copy button (owner feedback)`.

Rebased cleanly onto `origin/main` (including `task/locfix` and the orchestrator's own
`SEEDFIX: can_edit_deal defaults true` migration) before the final push; typecheck and lint
both 0 errors post-rebase.
