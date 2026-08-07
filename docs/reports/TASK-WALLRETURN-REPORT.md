# TASK WALLRETURN — the signing wall discards where the user was going

Branch: `task/wallreturn-preserve-destination` · Worktree: `wt-wallreturn` (off
`origin/main` @ `b8b078a`)
Date: 2026-08-07

## Scope delivered

Three files changed/added, all frontend, no migrations:

- **`src/lib/wallReturn.ts`** (new) — the capture/consume/validate logic:
  `captureWallReturnDestination`, `consumeWallReturnDestination`,
  `isSafeAppDestination`. Pure functions, sessionStorage-backed.
- **`src/components/app/AppLayout.tsx`** (+7 lines) — one call,
  `captureWallReturnDestination(location.pathname, location.search)`, added
  immediately before the existing `<Navigate to="/app/onboarding" replace />`
  at the wall interception (was line 691, now line 698). The redirect itself
  is byte-for-byte unchanged.
- **`src/pages/app/Onboarding.tsx`** (+11 lines) — `enterApp()`, the single
  exit point every onboarding path (sign-only, horse+payment, "nothing to
  do") funnels through, now consumes the captured destination and navigates
  there instead of the default dashboard/community landing, when one exists.

Plus four test files (33 tests total, all passing) — see §2 and §4.

`ClauseDocument.tsx` was never opened. The wall's gating logic
(`my_wall_state()`, `contact_document_wall_state()`) was read, never edited.
Sarah's document (`704c8d2d-…`) was never queried or referenced by any test —
all live-data reads used a throwaway test contact I created and later
discarded (isolated PGlite DB, not prod — see §3).

## 1. Where the destination actually gets lost

Traced the three files the task doc names:

- `Register.tsx:29-30` — for a contract invite, `redeemByKind()` correctly
  computes `` `/app/contracts/${documentId}` `` and `navigate(dest, {replace:
  true})`s there (line 157/86). **Confirmed correct, untouched.**
- `AppLayout.tsx:691` (pre-fix) — `if (wall?.wall && location.pathname !==
  '/app/onboarding') return <Navigate to="/app/onboarding" replace />;` — the
  member's actual `location.pathname` (e.g. `/app/contracts/abc-123`) is read
  here and then never referenced again anywhere in the codebase. This is the
  drop point.
- `Onboarding.tsx` — `enterApp()` (the only navigate-away call reachable from
  every step: sign-only → `done`; horse+payment → `done`; "nothing to do" →
  `done`) always computed `unread > 0 ? '/app/dashboard' : '/app'`, with no
  way to know a deep link had ever been attempted. This is where the fix
  needed to re-inject the destination.

`my_wall_state()` (`contact_document_wall_state()`, read on the live DB, not
touched) is the authoritative "is she still walled" signal: `wall` is
computed from `count(*) FILTER (WHERE ct.wall_gating)` over required,
unexecuted documents — it counts every un-superseded pending `wall_gating`
template, so it only reaches zero once ALL of them are `EXECUTED`. This is
the structural guarantee §3's DB test exercises live.

## 2. Reproduce first — real test runs against the unmodified code

Two integration test files render the **actual** `AppLayout` / `Onboarding`
components (React Testing Library + a `MemoryRouter`, only data-fetching
dependencies mocked — same convention as the existing
`test/ui/pluspass_create_controls.test.tsx`). I wrote each file's assertions
against the intended FIXED behavior first, then ran them against the
unmodified source to get a genuine failure, not a staged one.

**AppLayout — capture side**, run before touching `AppLayout.tsx`:
```
❯ test/ui/wallreturn_applayout.test.tsx (5 tests | 2 failed)
     × stores the attempted /app/* destination when the wall intercepts
     × overwrites a stale capture with the most recent attempted destination

 FAIL  … > stores the attempted /app/* destination when the wall intercepts
AssertionError: expected null to be '/app/contracts/abc-123'
- Expected: "/app/contracts/abc-123"
+ Received: null

 Test Files  1 failed (1)
      Tests  2 failed | 3 passed (5)
```
The 3 passing tests in that same run confirm the redirect itself fires
correctly (walled → onboarding, not walled → the contract page renders) —
i.e. the wall was never broken; only the destination was silently dropped,
exactly as the task doc describes.

**Onboarding — return side**, run before touching `Onboarding.tsx` (a
contact with only a reissued gating document pending, mirroring Sarah's real
case — signs it, reaches "You're all set.", clicks Continue, dismisses the
app-tour modal via "Enter the app" — the real click path, not a mocked
shortcut):
```
❯ test/ui/wallreturn_onboarding.test.tsx (5 tests | 2 failed)
     × navigates to the captured destination instead of the default landing page
     × consumes the destination once — it is gone from storage after the return

 FAIL  … > navigates to the captured destination instead of the default landing page
TestingLibraryElementError: Unable to find an element with the text: CONTRACT PAGE STUB
<body><div><div>COMMUNITY STUB</div></div></body>
```
She signs, finishes the flow exactly as today, and lands on the community
feed — the contract she followed a link to reach is never shown. This is the
"it navigated somewhere [wrong]" failure the task doc warns a shallower check
would miss.

## 3. The fix, and why sessionStorage

- **Capture** (`AppLayout.tsx`): one line at the existing interception,
  before the `<Navigate>`. Nothing else about the branch changed.
- **Return** (`Onboarding.tsx`): `enterApp()` calls
  `consumeWallReturnDestination()` first; if it returns a value, navigate
  there and return — otherwise fall through to today's exact
  dashboard/community logic, unchanged.
- **Storage: `sessionStorage`, not a query param** — signing runs through
  several same-URL step transitions inside `Onboarding.tsx` (details → horse
  → sign → payment → done, none of which change the route) plus a possible
  reload; a query param would need every one of those transitions, and every
  `navigate()` call along the way, to keep re-forwarding it — easy to drop
  silently and it would put an internal destination in the URL bar/history.
  sessionStorage survives the whole round trip untouched and never surfaces
  in the URL.
- **Validation** (`isSafeAppDestination`): requires `/app/` prefix, rejects
  `//host` (protocol-relative), any `scheme:` prefix, and the onboarding
  route itself (no self-loop). Applied both when writing (capture) and when
  reading (consume) — a value that somehow got tampered with in storage is
  rejected at read time too, not just at write time.
- **Consumed once**: `consumeWallReturnDestination()` reads and
  `removeItem`s in the same call, unconditionally (even a rejected/invalid
  value gets cleared, not left behind).
- **Trigger point chosen deliberately**: the task frames the return as "when
  the wall clears." `enterApp()` fires only once *every* onboarding
  requirement on that page is done (not just wall-gating documents — also
  horse intake and payment, when present), which is a **stronger** condition
  than the wall alone. I considered making the return fire the instant
  `my_wall_state().wall` flips false (closer to the literal wording), but
  that signal is a strict subset of what `/app/onboarding` may still be
  legitimately asking for (a still-unpaid purchase, say), and using it
  directly risked yanking a member away mid-flow before they'd finished
  something the wall doesn't cover but onboarding still requires. Tying the
  return to `enterApp()` avoids inventing that new failure mode while still
  covering the reported case exactly (Sarah's journey has no purchase/horse
  step — `enterApp()` fires immediately after her one signature). Flagging
  this trade-off explicitly since it's a judgment call, not a re-derivation
  of the task's wording.

## 4. Fix verified — same tests, now green

```
 RUN  v4.1.9

 Test Files  4 passed (4)
      Tests  33 passed (33)
```
Breakdown:
- `test/ui/wall_return_destination.test.ts` (21) — pure unit tests for
  `wallReturn.ts`: valid/invalid destinations (external URL, protocol-
  relative, `javascript:`, bare `/`, non-`/app` path, whitespace-smuggled
  scheme, the onboarding route itself with/without query/as a prefix),
  round-trip with and without a query string, consume-once (second read is
  `null`), a later unrelated capture unaffected by an earlier consume, empty
  storage returns `null`, a tampered off-origin value in storage is rejected
  **and still cleared**, a fresh capture overwrites an older one.
- `test/ui/wallreturn_applayout.test.tsx` (5) — the real `AppLayout`: wall
  still redirects exactly as before (not weakened); captures the destination
  on interception; captures nothing when not walled (normal nav untouched);
  captures nothing for `/app/onboarding` itself; a fresh interception
  overwrites a stale capture.
- `test/ui/wallreturn_onboarding.test.tsx` (5) — the real `Onboarding`: full
  click-path (Continue → app-tour modal → "Enter the app") lands on the
  captured destination; the destination is gone from storage afterward;
  **no captured destination → today's default behavior, byte-identical**;
  an off-origin captured value is refused and falls back to default.
- `test/db/wallreturn_wall_state.test.ts` (3) — `my_wall_state()` itself,
  live against an isolated database (see below), with a throwaway test
  contact holding two `wall_gating` documents:
  ```
  ✓ walls the member once required wall-gating documents exist
    { pending: 2, wall: true, staff: false, staff_banner: false }
  ✓ PARTIAL COMPLETION: signing the first of two does not release the wall
    { pending: 1, wall: true, staff: false, staff_banner: false }
  ✓ signing the LAST gating document clears the wall
    { pending: 0, wall: false, staff: false, staff_banner: false }
  ```
  This is requirement 3 of the task's verification list ("partial completion
  does not release early"), proven at the exact RPC the frontend gates on,
  not inferred from reading the SQL.

**Isolation used for the DB test**: `test/db/harness.ts`'s existing PGlite
harness — an in-memory Postgres with the repo's real migrations replayed,
completely separate from the production database (`.env.db`). No prod writes
were made for this task; the DB connection was used only for read-only
`\d`/`pg_get_functiondef`/`SELECT` inspection (§1, and confirming
`wall_gating` flags / `record_signature`'s argument shape before writing the
test). The throwaway contact (`wallreturn.rider@test.fhe`) and its two
documents exist only inside that in-memory instance, which is discarded when
the test process exits.

**Regression check**: full `test/ui` run — 41 passed, 5 skipped (one file,
`clause_ownership_affordance.test.tsx`, requires `npm run build:client` to
have run first; pre-existing, unrelated to this task, not attempted).
`npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 30 warnings, none
in any file this task touched (`wallReturn.ts` and the two diffs are
warning-free); matches CLAUDE.md's documented ~26-warning baseline.

**Aside, not fixed**: ran the full `npm run test:db` suite for a broader
regression check and found 60 of 64 files already failing on unmodified
`origin/main`, independent of this task — the dominant cause is `offering_tiers`
no longer existing (removed 2026-07-08 per CLAUDE.md) while several
older fixtures (`rider_onboarding.test.ts`, `minor_onboarding.test.ts`,
`esign_hardening.test.ts`, others) still provision through
`provision_lesson_invitation`, which queries it. Also found the PGlite
snapshot's data allowlist (`SNAPSHOT_DATA_TABLES` in `harness.ts`) doesn't
seed `status_events_vocab` or `document_status`, so any fresh test creating a
`documents` row from scratch hits two FK violations until those are seeded
locally (worked around inside `wallreturn_wall_state.test.ts`'s own
`beforeAll`, not touched at the shared-fixture source). Both are pre-existing
and out of this task's scope — flagging per the standing "report what you
find" instruction, not fixing.

## 5. Verification checklist against the task doc

1. **Reproduce** — §2, raw failing-test output against unmodified code,
   both the capture side and the return side, each isolated so the failure
   can't be confused with "it navigated somewhere."
2. **Fix** — §4, same two test files now pass end-to-end through the real
   click path.
3. **Partial completion** — §4/§3, `test/db/wallreturn_wall_state.test.ts`,
   proved live: signing 1 of 2 gating documents leaves `wall: true`.
4. **No destination** — `wallreturn_onboarding.test.tsx`, "defaults cleanly
   to today's behavior when nothing was captured" — passes.
5. **Consumed once** — `wall_return_destination.test.ts` ("consumes exactly
   once") and `wallreturn_onboarding.test.tsx` ("consumes the destination
   once — it is gone from storage after the return") — both passing, at the
   unit level and through the real component.
6. **Open-redirect refused** — `wall_return_destination.test.ts`'s
   `isSafeAppDestination` table (11 rejected variants) plus
   `wallreturn_onboarding.test.tsx`'s "refuses an off-origin destination" —
   passing.
7. **Typecheck and lint clean** — §4.

## 6. What I verified with my own eyes vs. what I assumed

**Verified, with raw output above:** the pre-fix defect on both halves
(capture discarded; return ignores whatever's in storage), each as a real
failing assertion against unmodified source, not a description; the fix
closes both, through the actual `AppLayout`/`Onboarding` components rendered
by React Testing Library (not reimplementations); the wall's redirect
behavior is byte-identical before and after (dedicated regression test);
`my_wall_state()`'s partial-completion guarantee, live, against a real
signing sequence; the validation function's open-redirect rejections, one
case at a time; typecheck/lint against the full modified tree; that
`test/ui` has no new failures; that `ClauseDocument.tsx` and the wall's
gating SQL were never edited (only read); that no prod writes occurred.

**Assumed, not verified:** pixel-level rendering in a real browser — no
browser session is available in this environment (same limitation noted in
`TASK-SIGREAD-REPORT.md` and `TASK-DOCVIS`'s report). The React Testing
Library runs render the real component tree and assert on what's actually in
the DOM after real `fireEvent` clicks and real `react-router` `navigate()`
calls resolve, which is the closest available proxy — but it's jsdom, not
Chromium. Also assumed: that `enterApp()` is genuinely the *only* place
onboarding ever navigates the member away without going through it — checked
by reading every `navigate(` call site in `Onboarding.tsx` (payment
confirmation, "I'll pay later", the horse-binding paths — all route to
`setStep('done')`, none call `navigate()` directly except `enterApp()`
itself), not by exhaustively fuzzing every UI path.

## 7. Constraints honored

- Own worktree (`wt-wallreturn`), branch
  `task/wallreturn-preserve-destination`, off `origin/main` @ `b8b078a`.
- The wall was not weakened: the interception condition and the
  `<Navigate to="/app/onboarding" replace />` are unchanged; no exemption,
  no early contract render, no skip path was added. Confirmed by a dedicated
  regression test asserting the redirect still fires identically.
- `ClauseDocument.tsx` was never opened.
- Sarah's document (`704c8d2d-…`) was never queried, read, or written by any
  command or test in this session — every live-data read used prod in
  read-only mode (`\d`, `pg_get_functiondef`, plain `SELECT`) for schema
  inspection only, and every write (signing, document creation) happened
  inside the isolated in-memory PGlite test database, never against prod.
- The two related-but-out-of-scope defects the task doc names (`contracts`
  has no party-read policy; `document_party_controls` has RLS with zero
  policies) were not touched — noted here only because the task doc asked
  to "report them again if you touch that area"; I did not touch that area
  and have nothing new to add.
