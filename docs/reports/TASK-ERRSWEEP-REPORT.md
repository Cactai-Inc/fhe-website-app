# TASK-ERRSWEEP — REPORT

Branch `task/errsweep`, rebased onto `main` @ `e4f0c72` (picks up TESTREPAIR's
schema-snapshot fix and ROLEBUNDLE; the worktree predated both). Commit
`8b1300f`. Not pushed.

## Summary

- **96 real candidate sites** surveyed (`grep -rn "instanceof Error" src/`,
  comments/tests/the fix itself excluded). The task doc's own count of 54 undercounts
  by 42 — every one of the 96 is dispositioned below regardless.
- **92 fixed** — converged onto `toErrorMessage` (`src/lib/ops/errors.ts`), fallback
  text kept verbatim.
- **4 left untouched**, each justified (no site was skipped silently).
- **The confirmed case** (`RegisterComplete.tsx:102`) fixed and **proven against a
  real database** — see §3.
- **Two additional live bugs found** in the same class, beyond the 96 ternary sites
  — see §2.
- `typecheck`: 0 errors. `lint`: 46 warnings / 0 errors, **identical** to main.
  `test/db`: file-for-file **identical** to main (51 failed / 26 passed incl. the
  new proof test — same failing files, same passing files; main's `test/db` is
  broadly red for reasons predating this task, see `TASK-TESTREPAIR-REPORT.md`).

---

## 1. Per-site disposition

96 rows. In-scope = wraps a `.rpc(`/`.from(`/`.auth.` call (directly or via a
wrapper function) upstream in the same try block.

| # | File:line | In scope | Fixed | Reason if not fixed |
|---|---|---|---|---|
| 1 | `src/components/AvatarCropModal.tsx:83` | N | N | `cropImageToBlob` is local `<canvas>` work — no network call anywhere in the try block; every error it throws is already a real `new Error(...)`. |
| 2 | `src/components/OfferingCatalog.tsx:59` | Y | Y | |
| 3 | `src/components/PublicIntakeForm.tsx:234` | Y | Y | wraps `submitRequest` |
| 4 | `src/components/app/AddElementModal.tsx:845` | Y | Y | |
| 5 | `src/components/app/AddElementModal.tsx:863` | Y | Y | |
| 6 | `src/components/app/CaptureInfoModal.tsx:99` | Y | Y | |
| 7 | `src/components/app/ClauseDocument.tsx:686` | Y | Y | |
| 8 | `src/components/app/ClauseDocument.tsx:692` | Y | Y | |
| 9 | `src/components/app/ClauseDocument.tsx:816` | Y | Y | |
| 10 | `src/components/app/ClauseDocument.tsx:824` | Y | Y | |
| 11 | `src/components/app/ClientRecordActions.tsx:375` | Y | Y | |
| 12 | `src/components/app/ClientRecordActions.tsx:77` | Y | Y | |
| 13 | `src/components/app/ClientRecordActions.tsx:83` | Y | Y | |
| 14 | `src/components/app/ClientRecordActions.tsx:96` | Y | Y | |
| 15 | `src/components/app/ConfirmNameModal.tsx:42` | Y | Y | |
| 16 | `src/components/app/ContactDossierModal.tsx:114` | Y | Y | |
| 17 | `src/components/app/ContactDossierModal.tsx:78` | Y | Y | |
| 18 | `src/components/app/ContactDossierModal.tsx:98` | Y | Y | |
| 19 | `src/components/app/ContractActivityCard.tsx:54` | Y | Y | |
| 20 | `src/components/app/ContractChangeRequests.tsx:425` | Y | Y | |
| 21 | `src/components/app/ContractChangeRequests.tsx:96` | Y | Y | |
| 22 | `src/components/app/ContractNotes.tsx:52` | Y | Y | |
| 23 | `src/components/app/CreateModal.tsx:178` | Y | Y | |
| 24 | `src/components/app/CreateModal.tsx:349` | Y | Y | |
| 25 | `src/components/app/DocumentsContent.tsx:228` | Y | Y | |
| 26 | `src/components/app/DocumentsContent.tsx:320` | Y | Y | local `errText` helper, collapsed to call `toErrorMessage` |
| 27 | `src/components/app/DocumentsContent.tsx:77` | Y | Y | |
| 28 | `src/components/app/EmailChangeModal.tsx:110` | Y | Y | seam wired to `lib/emailChange.ts` (Supabase auth) |
| 29 | `src/components/app/EmailChangeModal.tsx:123` | Y | Y | |
| 30 | `src/components/app/FilesContent.tsx:59` | Y | Y | |
| 31 | `src/components/app/FilesContent.tsx:76` | Y | Y | |
| 32 | `src/components/app/FilesContent.tsx:99` | Y | Y | |
| 33 | `src/components/app/GiftsContent.tsx:103` | Y | Y | |
| 34 | `src/components/app/GiftsContent.tsx:133` | Y | Y | |
| 35 | `src/components/app/NotifyConfirmModal.tsx:87` | Y | Y | |
| 36 | `src/components/app/OrdersContent.tsx:105` | Y | Y | |
| 37 | `src/components/app/OrdersContent.tsx:112` | Y | Y | |
| 38 | `src/components/app/PartiesHorseCard.tsx:100` | Y | Y | |
| 39 | `src/components/app/PartiesHorseCard.tsx:82` | Y | Y | |
| 40 | `src/components/app/PartiesHorseCard.tsx:94` | Y | Y | |
| 41 | `src/components/app/ReviewChangesModal.tsx:55` | Y | Y | |
| 42 | `src/components/app/ReviewChangesModal.tsx:82` | Y | Y | |
| 43 | `src/components/app/SendCopiesMenu.tsx:88` | Y | Y | fallback was `String(err)`; now `toErrorMessage(err)` |
| 44 | `src/components/app/StableEditors.tsx:202` | Y | Y | |
| 45 | `src/components/app/StableEditors.tsx:74` | Y | Y | |
| 46 | `src/components/app/VerifyEmailScreen.tsx:57` | Y | Y | |
| 47 | `src/components/app/VerifyEmailScreen.tsx:63` | Y | Y | |
| 48 | `src/components/app/VoidContractModal.tsx:185` | Y | Y | |
| 49 | `src/components/app/VoidContractModal.tsx:50` | Y | Y | |
| 50 | `src/components/app/VoidContractModal.tsx:63` | Y | Y | |
| 51 | `src/components/app/profile/AccountInfoCard.tsx:66` | Y | Y | |
| 52 | `src/components/app/profile/ProfileCard.tsx:151` | Y | Y | |
| 53 | `src/components/ops/DocumentIntegrityPanel.tsx:70` | Y | Y | |
| 54 | `src/components/ops/documents/DeliveryPanel.tsx:100` | Y | Y | `setPartiesError(err instanceof Error ? err : new Error(String(err)))` — object-shape variant, see §2 |
| 55 | `src/components/ops/documents/DeliveryPanel.tsx:160` | Y | Y | |
| 56 | `src/components/ops/documents/DeliveryPanel.tsx:81` | Y | Y | object-shape variant, see §2 |
| 57 | `src/components/ops/documents/DocumentQueuePicker.tsx:73` | Y | Y | |
| 58 | `src/components/ops/documents/DocumentQueueTable.tsx:352` | Y | Y | |
| 59 | `src/components/ops/documents/SigningPanel.tsx:82` | Y | Y | object-shape variant, see §2 |
| 60 | `src/components/ops/kit/AsyncButton.tsx:41` | Y | N (already correct) | already reads `err instanceof Error ? err : new Error(toErrorMessage(err))` — the surfacing was already right; nothing to change |
| 61 | `src/components/order/OrderPayment.tsx:81` | Y | Y | |
| 62 | `src/lib/horses.ts:46` (`errorText`) | — | N | pre-existing, independently-correct duplicate normalizer (falls through to the plain-object branch correctly; does not hide anything). Out of scope per the task's own D18 instruction — do not touch a second normalizer, only converge new stragglers onto `toErrorMessage`. Flagged as consolidation debt, not fixed here. |
| 63 | `src/lib/ops/useAsync.ts:45` | Y | Y | **shared by 26 files** — see §2, the second dead-code finding |
| 64 | `src/pages/Gift.tsx:69` | Y | Y | |
| 65 | `src/pages/Redeem.tsx:78` | Y | Y | |
| 66 | `src/pages/RegisterComplete.tsx:102` | Y | Y | **the confirmed case — see §3** |
| 67 | `src/pages/app/Admin.tsx:410` | Y | Y | |
| 68 | `src/pages/app/Admin.tsx:431` | Y | Y | |
| 69 | `src/pages/app/Admin.tsx:742` | Y | Y | |
| 70 | `src/pages/app/CalendarPage.tsx:185` | Y | Y | |
| 71 | `src/pages/app/CalendarPage.tsx:750` | Y | Y | **dead machine-code branch — see §2**, `msg.includes('FEE_CONFIRMATION_REQUIRED')` was unreachable |
| 72 | `src/pages/app/ContractPage.tsx:63` (`errMessage`) | — | N | same as #62 — pre-existing, independently-correct duplicate normalizer (falls through to the object branch correctly). Not modified per D18. |
| 73 | `src/pages/app/HorsePage.tsx:425` | Y | Y | |
| 74 | `src/pages/app/HorsePage.tsx:65` | Y | Y | **dead friendly-message branch — see §2**, the "ask staff to add you" panel was unreachable |
| 75 | `src/pages/app/HorsePage.tsx:85` | Y | Y | |
| 76 | `src/pages/app/ops/ContentStorePage.tsx:186` | Y | Y | |
| 77 | `src/pages/app/ops/ContentStorePage.tsx:198` | Y | Y | |
| 78 | `src/pages/app/ops/DealPage.tsx:115` | Y | Y | |
| 79 | `src/pages/app/ops/DealPage.tsx:128` | Y | Y | |
| 80 | `src/pages/app/ops/DealPage.tsx:137` | Y | Y | |
| 81 | `src/pages/app/ops/DealPage.tsx:302` | Y | Y | |
| 82 | `src/pages/app/ops/DealPage.tsx:42` | Y | Y | |
| 83 | `src/pages/app/ops/DealsPage.tsx:221` | Y | Y | |
| 84 | `src/pages/app/ops/DealsPage.tsx:94` | Y | Y | |
| 85 | `src/pages/app/ops/HorseRecordsPage.tsx:111` | Y | Y | |
| 86 | `src/pages/app/ops/HorseRecordsPage.tsx:76` | Y | Y | |
| 87 | `src/pages/app/ops/HorseRecordsPage.tsx:95` | Y | Y | |
| 88 | `src/pages/app/ops/NewContractPage.tsx:188` | Y | Y | |
| 89 | `src/pages/app/ops/NewContractPage.tsx:214` | Y | Y | |
| 90 | `src/pages/app/ops/TeamPage.tsx:164` | Y | Y | |
| 91 | `src/pages/app/ops/TeamPage.tsx:301` | Y | Y | |
| 92 | `src/pages/app/ops/TeamPage.tsx:347` | Y | Y | |
| 93 | `src/pages/app/ops/TeamPage.tsx:412` | Y | Y | |
| 94 | `src/pages/app/ops/admin/AdminModulesPage.tsx:63` | Y | Y | **dead privilege check — see §2** |
| 95 | `src/pages/app/ops/superadmin/TenantDetailPage.tsx:70` | Y | Y | |
| 96 | `src/pages/app/ops/superadmin/TenantDetailPage.tsx:85` | Y | Y | |

---

## 2. Beyond the ternary: four more live instances of the same bug class

The task named one confirmed case (`RegisterComplete.tsx:102`). Reading every
site's surrounding context surfaced four more, all real and all now fixed:

1. **`useAsync.ts:45`** (`src/lib/ops/useAsync.ts`) — the shared `idle → pending
   → success/error` hook used by **26 files** across the ops surface. Its own
   normalization was `err instanceof Error ? err : new Error(String(err))`. On a
   Supabase rejection, `String(err)` renders `"[object Object]"` — and
   `AdminModulesPage.tsx` (etc.) render `loadError.message` directly on screen.
   Every page built on this hook showed the literal string `[object Object]`
   instead of the real reason, on every load failure. Fixed to
   `new Error(toErrorMessage(err))`.

2. **`AdminModulesPage.tsx:63`** — `isPrivilegeError(e)` regex-tests `e.message`
   to decide whether to show the friendly "contact your platform operator"
   message or the raw one. Built from `err instanceof Error ? err : new
   Error(String(err))`, `e.message` was always `"[object Object]"`, so
   `isPrivilegeError` never matched and the friendly branch was **unreachable** —
   a tenant admin blocked by the SUPER_ADMIN-only RPC always saw `[object
   Object]`, never the intended notice.

3. **`CalendarPage.tsx:750`** (`change()`, inside the same file whose own
   `book()` function at line 687 already uses `toErrorMessage` and documents this
   exact class in a comment) — `const msg = e instanceof Error ? e.message :
   ''` then `msg.includes('FEE_CONFIRMATION_REQUIRED')`. Always `''`, so the
   "tell us how you're paying the change fee" panel was dead code; every fee
   change error fell to the generic fallback.

4. **`HorsePage.tsx:65`** — `const raw = e instanceof Error ? e.message : ''`,
   then `/not authorized|unknown horse/i.test(raw)` decides whether to show the
   friendly "ask staff to add you as a party" message. Always false, so that
   message was unreachable and every horse-load denial showed the generic
   "Could not load this horse."

Three sites use the object-wrapping variant of the same bug
(`DeliveryPanel.tsx:81/100`, `SigningPanel.tsx:82`) — `setLoadError(err
instanceof Error ? err : new Error(String(err)))`, feeding a typed `Error |
null` state whose `.message` is rendered directly. Fixed to `new
Error(toErrorMessage(err))`.

## 3. The confirmed case, proven

`RegisterComplete.tsx:102` is the OAuth-return leg of invite-only registration —
the one screen a brand-new contract counterparty sees if `redeemContractInvitation`
or `redeemInvitation` fails. Fixed the same way as every other site.

**Proof** (`test/db/errsweep_repro.test.ts`, 3 tests, run against a real
PostgreSQL instance via the project's PGlite harness — not asserted from reading
the code):

1. Builds a real document + party + contract invitation, redeems it once
   (succeeds).
2. Redeems the **same token a second time** — `redeem_contract_invitation`
   genuinely raises. The raw exception text is captured verbatim:
   `"invitation is not valid or has expired"` (the real message from the current
   migration, `20260820T0940_partyemail_p4b_regenerate_on_open_and_redemption.sql`).
3. Wraps that exact text in the plain-object shape `postgrest-js` actually hands
   a catch block (`{message, details, hint, code}` — never a real `Error`, per
   `errors.ts`'s own doc comment) and shows:
   - the **old** `err instanceof Error ? err.message : 'We could not finish
     setting up your account.'` pattern returns the generic fallback on this
     object — reproducing the exact bug RegisterComplete had,
   - the **fix**, `toErrorMessage(err, fallback)`, returns the real Postgres
     text.

All 3 tests pass. This is the closest available proxy to "read the screen" in
this environment (no interactive browser here) — it exercises the real RPC, the
real exception, and the real fix function, not a hypothetical.

One workaround was needed to reach this: `status_events_vocab` and
`document_status` seed 0 rows in every `createTestDb()` in this harness (main
too — confirmed independently, unrelated to this task, see the comment in the
test file). The test re-seeds the two rows it needs, matching the migrations'
own `INSERT` statements verbatim, and does not touch the harness or migrations.
That gap is TESTREPAIR/harness territory.

## 4. Verification

- `npm run typecheck` — 0 errors.
- `npm run lint` — 46 warnings, 0 errors. **Identical** to `main` (same count,
  same files, re-checked side by side).
- `npx vitest run test/db` — **file-for-file identical** to `main`: 51 failed /
  25 passed on `main`, 51 failed / 26 passed here (the +1 pass is this task's
  own new, passing `errsweep_repro.test.ts`). Every other file's pass/fail status
  matches `main` exactly. `main`'s red files are pre-existing (see
  `TASK-TESTREPAIR-REPORT.md`) and out of this task's scope.
- Branch was rebased onto `main`@`e4f0c72` before this comparison — the worktree
  had been created before TESTREPAIR (schema-snapshot fix) and ROLEBUNDLE
  landed on `main`; comparing against the stale base would have been dishonest
  (it showed a completely different, worse `test/db` baseline caused by
  TESTREPAIR not being present yet). Two files' merges during rebase
  (`Admin.tsx`, `PartiesHorseCard.tsx`) were auto-resolved by git cleanly —
  confirmed no `instanceof Error` sites remain in either.
