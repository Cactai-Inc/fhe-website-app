# FHE-TASK-SIGNFLOW-F — LEDGER (DSNR profile: spec authoring, no build)

**Charge (ORCH, `docs/reports/TASK-SIGNFLOW-B-VERIFICATION.md` + `CHANGE-ORDER-LEDGER.md` §CR-101·A1):** author TWO
follow-up specs — (1) the three remaining unnormalised address writers; (2) no trailing period on a signature line
in `remerge_contract_from_clauses`.
**Opened 2026-09-02 · wt-3 · branch `task/signflow-f-specs` from `main` @ b846b227.**

## RESUME
Role / thread   FHE-TASK-SIGNFLOW-F (DSNR profile) · wt-3 · task/signflow-f-specs
DONE            sources read (B verification, B report §3/§5, A report §5, CR-101·A1, DSNR-ROLE, normalize.ts, formState hook, dossier idiom); three writers measured on main; composer + regenerate + record_signature read from PRODUCTION via pg_get_functiondef
IN FLIGHT       nothing — complete
NEXT            ORCH reads docs/reports/FHE-DSNR-SIGNFLOW-F-HANDOFF.md, merges task/signflow-f-specs, dispatches G (Sonnet/MEDIUM) and H (Opus/HIGH) to pool worktrees
DECIDED         G+H naming · G wires every contact field (D39) · vet_* fields out · H exempts the whole SIG block via v_has_sig · in-place rewrite idiom · no backfill, lease recomposes on open
BLOCKED         nothing
DO NOT          do not build; do not write to production; do not touch wt-1/wt-2 (RANCHWORD spec, SITESEO)

## LOG
- Naming: this authoring thread is F. The two BUILD specs it produces take the next letters (G, H) so their ledgers/reports do not collide with this file. DSNR-ROLE: letters continue after the last that ran.
- Measured on prod (SELECT only): composer 276 lines; v_has_sig at :128-134; period site :176-178 (A said 171-174); second period site :113-115 (authored CUSTOM lines, not in play).
- Only ONE document has the defect: the lease 7adcd08f (HORSE_LEASE_V2, AWAITING_SIGNATURE, 0 signatures). The two DRAFTs are flat templates with NO period — A §5 wrong for 2 of 3.
- All 81 executed docs have contract_id IS NULL → regenerate returns before composing → composer cannot reach them. Exactly 1 engine doc in prod.
- proacl on the composer: postgres/authenticated/service_role, no anon. CREATE OR REPLACE keeps it.
- The three writers: none imports the normalizer at all (name/phone/email raw too). Line numbers today: Provision :529/:549-566, Intake :167-204 (+vet :238-246), ContractPage grid :1977-1985, condition :1955-1957.
- test/db snapshot path is a prod dump (2026-08-21); replay chain broken at 20260709160000 → H's assertion is red-until-snapshot by design.
- WRITTEN: docs/tasks/TASK-SIGNFLOW-G-the-last-three-contact-writers-normalize-on-blur.md · docs/tasks/TASK-SIGNFLOW-H-no-period-after-a-signature-line.md · docs/reports/FHE-DSNR-SIGNFLOW-F-HANDOFF.md
