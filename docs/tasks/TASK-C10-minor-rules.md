# TASK C10 — Minor downstream rules: no outreach to minors, guardian-addressed delivery

Tracker item **C10 only**. The upstream machinery (kiosk minor/guardian signing split,
`contacts.guardian_contact_id` spine link, MINOR_* document cuts, dossier display) is verified
correct — do not touch it. This task makes the SEND boundary honor the model.

## Verified current state (orchestrator discovery 2026-08-04 — trust this)

- No `is_minor` flag exists. The ONLY under-18 computation in the system is an input validator
  inside `sign_release` (`20260702050000_release_kiosk.sql:236`). `contacts.date_of_birth` is
  nullable/unconstrained; `contacts.guardian_contact_id` FK → contacts, `ON DELETE SET NULL`.
- ZERO email senders check minority. Direct-to-contact exposure (resolves `contacts.email`, no
  account needed): `api/_lib/delivery.ts:156-201` (shared executed-doc core),
  `api/deliver-documents.ts:103-156`, `api/deliver-evaluation-report.ts:63-84`.
  `admin-send-invitation.ts:176-264` sends to an operator-typed address with no cross-check.
  (`calendar-reminders`/`notifications-nudge` resolve via `profiles` — minors without accounts
  are incidentally unreachable there; out of scope.)
- Live data: 3 contacts with DOB implying under 18. ONE is a real minor — Gabriella Olenik
  (DOB 2013-03-31, no email, guardian Brian Olenik linked with email, party on 4 documents; the
  only thing stopping delivery to her today is her null email, which nothing protects). TWO are
  adults with CORRUPTED DOBs equal to their 2026 signup dates: Raymond Thicklin (2026-07-18)
  and Brian Olenik (2026-07-26) — a naive DOB rule would misclassify both, including the real
  minor's own guardian.

## Locked design (do not revisit)

1. **Canonical predicate** `is_minor_contact(p_contact_id uuid) returns boolean`:
   `date_of_birth IS NOT NULL AND date_of_birth + interval '18 years' > current_date`.
   STABLE, callable everywhere. `sign_release`'s inline validator stays as-is (it validates a
   form input DOB, not a contact row).
2. **Data fix first** (logged): NULL out the two corrupt DOBs (`date_of_birth` = signup date,
   age 0 — Raymond Thicklin, Brian Olenik rows identified above; re-verify ids by query before
   writing). A signup-date DOB is data corruption, not information.
3. **Guard trigger on `contacts`**: BEFORE INSERT OR UPDATE, when the row's own DOB makes it a
   minor AND `email IS NOT NULL` → RAISE 'a minor contact carries no direct email; put the
   address on the guardian record'. This converts today's safe-by-accident null email into an
   invariant. (Existing rows all satisfy it after the data fix — verify with a count.)
4. **Guardian substitution at the send boundary** — in `api/_lib/delivery.ts` (the shared
   core), `api/deliver-documents.ts`, and `api/deliver-evaluation-report.ts`: when a resolved
   recipient contact is a minor (check via the predicate through the existing admin client),
   do NOT use their email (should be null anyway post-trigger). Resolve
   `guardian_contact_id → contacts.email`:
   - Guardian with email → send THERE, guardian-addressed: greeting names the GUARDIAN
     (their first name), body names the minor as the subject of the documents ("documents for
     <minor name>"), not as addressee. Delivery row still records `recipient_contact_id` = the
     minor party (the party is who the delivery is FOR) — add nothing to the schema.
   - No guardian or guardian has no email → SKIP the recipient (no send, no delivery row) and
     fire ONE `notify_staff` ('minor_no_guardian', linking /app/ops/intake or the contact) per
     endpoint invocation, listing the skipped minor(s). Fail closed, never fall back to the
     minor's own address.
5. **Invitation guard**: `admin-send-invitation` — if the target contact resolves to a minor
   (existing contact match), reject with a clear 400 ('minors cannot be invited to hold
   accounts; invite the guardian'). Do not build guardian-redirect for invitations — reject
   only.
6. OUT of scope (log as known gaps in the report, build nothing): purge-routine guardian
   orphaning; sign-start self-serve age screening; profiles-based reminder senders.

## Work items
1. Migration: predicate + trigger + the logged two-row data fix (single migration; dry-run
   `BEGIN;...ROLLBACK;`, apply, verify: predicate true for Gabriella, false for the two fixed
   adults; trigger blocks an email UPDATE on a minor row — prove with a rolled-back attempt).
2. API edits per item 4-5. Match each file's existing error/skip/logging style.
3. Live proof, raw psql + reasoned trace in the report:
   - Predicate outputs for the three contacts (after data fix).
   - Trigger rejection (rolled back).
   - For the delivery paths: no deployed preview may exist — reason the code path line-by-line
     as prior reports did, and state plainly that live email fire was not run if it wasn't.
   - Invitation guard: reason or exercise per the same rule.
4. Update `docs/archive/BUILD_TRACKER.md` C10 honestly.

## Rules
- Branch `task/c10-minor-rules` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-c10 -b task/c10-minor-rules origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: allowed writes = the one migration (incl. the two-row DOB fix) + rolled-back
  proofs. Everything logged.
- `ClauseDocument.tsx` FROZEN. Signed documents never deleted. Do not touch kiosk signing
  machinery, `sign_release`, or the C-lane /sign pages.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + live proofs.
- Report: `docs/reports/TASK-C10-REPORT.md`, committed + pushed. Print ONLY the report path.
