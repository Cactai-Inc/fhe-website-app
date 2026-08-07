# TASK WALLRETURN — the signing wall discards where the user was going

**A live defect that silently breaks invitations.** Diagnosed against production by the
orchestrator, 2026-08-07, from a real case.

---

## What happened

A counterparty was emailed a link to a lease. Everything worked *except the destination*:

1. The email link was correct — `/activate?token=…&kind=contract`.
2. Redemption succeeded; the invitation is `redeemed` in the database.
3. `Register.tsx` computed the right destination: `/app/contracts/{documentId}`.
4. **`AppLayout.tsx:684` then intercepted her:**

```js
if (wall?.wall && location.pathname !== '/app/onboarding') {
  // forcibly redirected to /app/onboarding
}
```

She had a pending wall-gating document — `RELEASE_GENERAL` had been reissued as version 2.
The wall fired before the contract could render, and dropped her into onboarding.

5. She signed the release, which is exactly what the screen asked. **Nothing returned her
   to the lease.** She had no reason to believe there was anything else, and concluded the
   contract had never arrived.

The lease sat at `AWAITING_SIGNATURE` for two days while both parties believed the other
was holding things up.

## Why this matters more than one lease

**It fails invisibly.** No error, no message, nothing in a log. The user is simply
delivered somewhere else and told to do something plausible.

It affects **every deep link to a user with pending wall-gated paperwork** — contract
invitations, document links, emailed deep links of any kind. A contract invitation is the
worst case, because reaching that specific document is the entire purpose of the email.

---

## The fix

**Capture the intended destination before the wall redirects, and return the user there
once the last gating document is signed.**

Requirements:

1. **Capture on interception.** At `AppLayout.tsx:684`, before redirecting, record where
   the user was trying to go.
2. **Return on completion.** When the wall clears — the last gating document signed —
   navigate to the captured destination instead of the default landing page.
3. **Survive the round trip.** Signing involves navigation and may involve a reload.
   Whatever holds the destination must survive that. `sessionStorage` or a query parameter
   are both plausible; choose one and say why.
4. **Consume it once.** After returning the user, clear it. A stale destination must never
   hijack a later, unrelated visit.
5. **Only `/app/*` internal paths.** Never redirect to an absolute URL or an external
   origin from stored state — that is an open-redirect. Validate before navigating.
6. **Default cleanly.** No captured destination, or an invalid one, means today's
   behaviour exactly.

### Do not weaken the wall

The wall is deliberate: gating documents must be signed before the app is used. **This
task does not add exemptions, does not let the contract render first, and does not make
the wall skippable.** It only remembers where the user was headed. If a fix seems to
require loosening the wall, **stop and report**.

---

## Verification

Reproduce the real failure first, then prove the fix. The failure mode is silent, so
"it navigated somewhere" proves nothing.

1. **Reproduce.** A test user with a pending wall-gating document follows a contract
   invitation link. Confirm they land on onboarding and that after signing they do **not**
   reach the contract. Capture it.
2. **Fix.** Same journey: after the last gating document is signed, they arrive at the
   contract.
3. **Partial completion.** With two gating documents pending, signing only the first must
   **not** release them early — the wall holds until all are done, then returns them.
4. **No destination.** A user who navigates to `/app` normally with pending documents
   still gets today's behaviour, and lands normally afterwards.
5. **Consumed once.** After the return, a fresh visit to `/app` goes to the default
   landing page, not the stored destination.
6. **Open-redirect refused.** A stored value pointing off-origin is rejected.
7. Typecheck and lint clean.

**Sarah's own case is already resolved** — her `my_onboarding_state()` now returns
`needed: false`, so she is no longer walled. **Do not use her document
(`704c8d2d-…`) for testing; it is a live negotiation. Read-only, never write.**

## Related, and NOT in scope

Found during the same investigation. Both are currently masked because the contract page
loads through a `SECURITY DEFINER` RPC, so neither is breaking anything today:

- **`contracts` has no party-read policy** — only `contracts_org_boundary` (restrictive)
  and `contracts_staff_all`. A non-staff party gets zero rows. Same shape as the
  `document_parties` bug fixed by `TASK-PARTYRLS`.
- **`document_party_controls` has RLS enabled and zero policies** — nobody can read it
  directly, staff included.

Report them again if you touch that area, but **do not fix them here.**

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN** and is not involved.
- Do not change the wall's gating logic, only what happens to the destination.

## Reporting

`docs/reports/TASK-WALLRETURN-REPORT.md`. State what you verified with your own eyes
versus what you assume, and include the reproduction from step 1.
