# TASK A16 — admin notified when a party signs

Tracker item **A16 only**: "Admin notified when a party signs" — status NOT VERIFIED, meaning
nobody has established whether this exists at all. This task: characterize, then build only
what's missing.

## Known context (trust this)
- `record_signature` (latest committed body: the SQLTRUTH recapture era + any later
  migrations — verify against live prosrc before editing, per standing practice) is the
  single signing RPC. It already: substitutes name/date into merged_body, flips to EXECUTED
  on the completing signature (which fires the execution-email trigger — A8, DONE).
- `remove_my_signature` already notifies staff on signature REMOVAL
  (`notify_staff(org,'signature_removed',...)`) — the shape/precedent to mirror.
- `notify_staff(org, kind, title, link)` is the in-app alert primitive; recipients are the
  org's admin users (mirror-inbox pattern).
- The execution EMAIL on completion is separate and done; A16 is the in-app admin
  notification per signature event.

## Work items
1. **Characterize first** (read-only): does anything currently call `notify_staff` (or any
   notification write) when a signature is RECORDED? Grep live prosrc of `record_signature`
   and anything else in the signing path (`lock_and_sign_contract`, kiosk `sign_release`).
   Record findings. If a signing notification already exists somewhere, verify it fires
   (rolled-back proof) and update the tracker — build nothing redundant.
2. **Build (expected)**: migration — `CREATE OR REPLACE record_signature`, live body carried
   forward unchanged, adding after the successful signature write:
   `notify_staff(v_org, 'party_signed', '<doc title> — signed by <typed name> (<role>)',
   '/app/ops/documents/<doc id>')`, with these exclusions:
   - Do NOT notify when the signer is the company side (staff signing for the company —
     that's the admin's own action; mirror how `record_signature`'s existing company branch
     identifies that case).
   - On the COMPLETING signature, still notify (the admin wants "signed" + the execution
     email will separately confirm EXECUTED) — but title it '<doc title> — fully executed;
     signed by <name> (<role>)' so one notification carries both facts, not two rows.
   Wrap in the same best-effort posture as other in-path notifications if precedent exists
   (a notification failure must never block a signature — check how the execution-email
   trigger isolates errors and do likewise if record_signature has no such precedent).
3. **Kiosk path**: if `sign_release` (kiosk signing) has no staff notification, add the same
   best-effort notify there ONLY if a precedent shows kiosk signings should alert (check
   whether kiosk flow already notifies via another mechanism — e.g. status_events consumers
   or an existing notify call). If unclear, do NOT add it; note the question in the report
   for the orchestrator instead. A16's tracker text is about contract parties, not kiosk.
4. **Proof** (rolled back, simulated sessions per prior reports): a party signature on a
   throwaway in-transaction document → notification row(s) appear for admin users with the
   right title/link; a company-side signature → NO notification; completing signature →
   single 'fully executed' notification. Zero residue after rollback, proven by counts.
5. Update `docs/BUILD_TRACKER.md` A16 honestly.

## Rules
- Branch `task/a16-sign-notifications` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-a16 -b task/a16-sign-notifications origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB writes: the one migration + rolled-back proofs only. Everything logged.
- CRITICAL: `record_signature` is the signing path for real contracts — the notification
  must be provably non-blocking (signature succeeds even if notify fails). Dry-run in
  BEGIN/ROLLBACK first.
- `ClauseDocument.tsx` FROZEN. Signed documents never deleted.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors) + proofs.
- Report: `docs/reports/TASK-A16-REPORT.md`, committed + pushed. Print ONLY the report path.
