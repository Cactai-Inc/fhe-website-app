# BUNDLE-GRANTS — B1 GRANTS + STALE (cut by ORCH, 2026-09-03; RECONCILED-2026-09-02.md §8 row B1)

**Sender: hand everything back to `FHE-ORCH-7`.** Bundle tree: `wt-1`. Task trees allotted: `wt-2`
(one build at a time; ask ORCH for more).

## The items, with state
| # | Item | Change name | State |
|---|---|---|---|
| 1 | `request_purchase_payment` is anon-executable in production despite its own migration revoking it (RECONCILED §7.1; CONFIRMED by ORCH 2026-09-03 via `pg_proc.proacl`) | GRANTS | facts known; no spec |
| 2 | `reap_expired_holds` carries `anon=X` — an unauthenticated caller can execute a WRITER (board ROUTED 1; never probed — probing writes production) | GRANTS | facts known; no spec |
| 3 | `trg_seed_display_name` carries PUBLIC + anon EXECUTE (inert — trigger fn — but a false "anon absent" claim; TASK-SIGNBOOK-VERIFICATION) | GRANTS | facts known |
| 4 | **THE SWEEP:** every SECURITY DEFINER function that WRITES, checked for anon/PUBLIC EXECUTE — not only the three above (RECONCILED §7.1's instruction) | GRANTS | needs DISCO-lite measurement inside the DSNR spec |
| 5 | The caller-less `authenticated` EXECUTE on the retired `sign_release` / `sign_general_release` (TASK-SIGNFLOW-D §5) | GRANTS | facts known |
| 6 | Stale comments with exact replacement text: `MergedBodyView.tsx:28` · `src/lib/contact.ts:184` · `api/deliver-document.ts:10` (TASK-SIGNFLOW-D §4) · `Onboarding.tsx:106-108` and `:621` claim the payment step is live (SITECOPY-B §6) | STALE | text supplied |
| 7 | CHANGE-ORDER-LEDGER status headers: CR-85, CR-89, CR-93, CR-97 read "open" at the header and are built (RECONCILED §9) — header-only pass, LAST, after ORCH is told (ORCH writes that file) | STALE | docs |

## Ownership declaration (D35/D36) — this bundle holds:
- **DB:** the ACL (`GRANT`/`REVOKE`) of every `SECURITY DEFINER` function in `public` — **ACLs ONLY,
  never a function body**. No `DROP`. Explicit roles; `REVOKE FROM PUBLIC` alone is proven
  insufficient (memory: DROP+CREATE re-grants via default privileges) — the migration must also
  REVOKE from `anon` by name and prove `proacl` after.
- **Files:** the five comment lines in item 6, nothing else in those files.
- **Docs:** `docs/reference/CHANGE-ORDER-LEDGER.md` headers — item 7 only, coordinated with ORCH.
- **Trees:** `wt-1` (MGMT) · `wt-2` (tasks).
**Disjoint from every other bundle by construction** (no feature files; B2's F-items touch function
BODIES, not ACLs — if the sweep finds a body needs a guard, that is a FINDING routed up, not a fix).

## Pre-registered escalation points (the only summons)
1. **Which anon-executable writers are LEGITIMATELY anon.** Known-public by design: `submit_public_request`, `request_category_label` (the contact form). Any OTHER writer the sweep finds anon-executable goes to the owner as a list with the surface that would break if revoked — he rules per function. Prepare: function name · what it writes · the public surface that calls it (grep the call site) · recommendation.
2. Nothing else. A guard that is missing INSIDE a body is routed to ORCH as a finding, not decided here.

## Gates to ORCH
None guest-facing. **Report the sweep's full before/after `proacl` table up with the bundle report.**

## Merge lane
Per task, after VRFY. The ACL migration is applied to production by the build task under the rehearsal
discipline (`BEGIN…ROLLBACK` first) and re-proven immediately before report (D35).

## Sequence inside the bundle
DSNR (short spec: the sweep query + the revoke migration + the five comment edits) → CODR (Sonnet ·
MEDIUM · thinking ON) → VRFY (Opus · HIGH · ON — re-run `proacl` for every touched function in
production) → merge → item 7 last → WALKR: **the public contact-form submission** and **the `/sign/*`
start** must still work anonymously (FLOW-MAP names: the inbound request flow and the sign-start
flow) — walked as an anonymous visitor.

## Suggested model/effort — SUGGESTIONS ONLY (D45): MGMT evaluates each task's work and decides, stating why
DSNR: Opus · HIGH · ON. CODR: Sonnet · MEDIUM · ON. VRFY: Opus · HIGH · ON. WALKR: Opus · HIGH · ON.
