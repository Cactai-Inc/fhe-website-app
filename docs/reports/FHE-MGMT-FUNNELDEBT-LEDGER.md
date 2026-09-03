# FHE-MGMT-FUNNELDEBT — LEDGER (bundle B2, `docs/orch/BUNDLE-FUNNELDEBT.md`)

**Role file:** `docs/method/MGMT-ROLE.md` (in force, D44). **Sender / hand back to:** `FHE-ORCH` (standing tab; ORCH-8 today).
**Opened:** 2026-09-03 · bundle tree `wt-9` · branch `bundle/funneldebt` from `origin/main` @ `a1399848`.
**Task trees allotted:** `wt-10`. **Escalations:** 0 of 7 pre-registered points reached — ONE batched summons after -A's handoff.

## RESUME
Thread          FHE-MGMT-FUNNELDEBT · wt-9 · bundle/funneldebt (claimed 2026-09-03; D36 guard: wt-9 was detached at 2779ca2c, porcelain empty, .env pair + node_modules present)
Station         DSNR — dispatched FHE-TASK-FUNNELDEBT-A (Fable · HIGH · wt-10 · task/funneldebt-a); awaiting owner launch
DONE            bundle + read-first set read (RECONCILED §2/§7/§8, SIGNBOOK handoff §2–3.4, guardian FINDING §4, TASK-DEPENDENT, CAREPATH §C6, MODEL-CHOICE §2026-09-03, MGMT/DSNR role files, both running MGMT ledgers as the idiom) · handoff §7 check passed (below) · production measured once read-only (below) · charge file docs/tasks/TASK-FUNNELDEBT-A-shape-the-request-to-booking-spine-and-the-guardian-spine.md written · board section written · process census clean
IN FLIGHT       FHE-TASK-FUNNELDEBT-A (awaiting docs/reports/FHE-DSNR-FUNNELDEBT-HANDOFF.md + docs/reports/FHE-TASK-FUNNELDEBT-A-ESCALATIONS.md + specs TASK-FUNNELDEBT-B…)
NEXT            on A's hand-back: (1) read handoff + ESCALATIONS + specs; verify A's numbers against a fresh read-only run; (2) ONE summons to the owner with all seven points in the §9 shape, A's file as the evidence; (3) record rulings verbatim here + in BUNDLE-FUNNELDEBT.md's rows; send F3's words up to ORCH for the CR ledger; (4) dispatch the chunk A declares buildable-now (F3 writer + constraints) to wt-10 as -B CODR while rulings are pending; ask ORCH for trees if A declares more than one disjoint chunk; (5) VRFY per branch (-V) → merge into bundle/funneldebt → push the BUNDLE BRANCH (ORCH merges to main — board PROCESS ruling 2026-09-03); guest-facing renders UP before merge; (6) WALKR (-W) at close: F4→F1→F5 (request→activation→booking) and the minor-at-the-door variant of F4→F1, WALKTEST fixture only; (7) bundle report
DECIDED         · letters: -A DSNR · B… CODR chunks · -V VRFY · -W WALKR
                · DSNR tier Fable·HIGH as the bundle suggests (MODEL-CHOICE §2026-09-03 names FUNNELDEBT); CODR/VRFY/WALKR Opus·HIGH·ON unless A's handoff argues Sonnet for a parameter/copy chunk
                · MGMT never pushes main: bundle/funneldebt is pushed as a branch; ORCH merges (board PROCESS ruling, 2026-09-03)
                · the F3 relabel is its own chunk, gated on ruling 3 AND on the words landing in the CR ledger; the writer+constraint chunk is not gated
BLOCKED         nothing. The owner has not been summoned; nothing is owed to ORCH yet
DO NOT          · do not write the canonical checkout (D40) · do not author specs or fix at the pass · do not touch any GRANT/REVOKE (B1), SignStart.tsx (B3), AccountHub.tsx (B5), request_purchase_payment / the six-state machine (B6), Onboarding.tsx:106-108/:621 (B1)
                · do not apply the F3 relabel before the owner's verbatim words are in CHANGE-ORDER-LEDGER.md (ORCH writes it)
                · do not merge without a TASK-<ID>-VERIFICATION.md verdict of HOLDS · do not summon the owner for anything not in the seven points
                · do not touch the Caddell family's records beyond reads; Charlotte is the owner's own case
                · do not share a migration file with B5's purchases column; declare our column name before any apply
                · do not trust the bundle's CHECK citation (lessonplan_m1:171,174) — production's constraint is 20260826T1000's, with 'payment' (below)

## LOG
- 2026-09-03 · claimed wt-9 (detached 2779ca2c, clean) → `bundle/funneldebt` from origin/main a1399848. Nothing to clean.
- 2026-09-03 · handoff check (MGMT-ROLE §7): bundle name ✓ · 7 items + state ✓ · ownership (DB bodies, files, trees; B1/B3/B5/B6 exclusions) ✓ · 7 escalation points, each with what to prepare ✓ · gates (guest-facing copy/email renders up; F3 relabel after CR ledger) ✓ · merge lane (per task after VRFY; relabel under rehearsal) ✓ · WALKR flows (named in prose, mapped by me to FLOW-MAP F4→F1→F5 and the minor variant of F4→F1) ✓ · model/effort ✓ · sender `FHE-ORCH` ✓. **Not sent back.**
- 2026-09-03 · two citation corrections passed to -A, not treated as blockers: (a) CAREPATH §C6 is in `docs/tasks/TASK-CAREPATH-horse-care-enquiry-to-active-client.md`, not the CR ledger; (b) the live `status_events` CHECK is the one `20260826T1000_payments_are_records_with_numbers.sql:109,115` re-created (adds `'payment'`); the `status_events_vocab` twin constraint must widen too.
- 2026-09-03 · wt-10 verified idle (detached 2779ca2c, porcelain empty, .env pair present) and assigned to -A.
- 2026-09-03 · dispatched FHE-TASK-FUNNELDEBT-A (prompt handed to the owner; Fable · HIGH · wt-10 · sender FHE-MGMT-FUNNELDEBT).

## MEASUREMENT — production, read-only, 2026-09-03 07:21 PDT (the -A charge inherits these as a starting point; -A re-runs)
```
select entity_type, count(*) from status_events group by 1 order by 2 desc;
select count(*) from status_events s where s.entity_type='offering' and exists (select 1 from bookings b where b.id=s.entity_id);
select count(*) from status_events s where s.entity_type='offering' and exists (select 1 from offerings o where o.id=s.entity_id);
select pg_get_constraintdef(oid) from pg_constraint where conname='status_events_entity_type_check';
```
| Measure | Value |
|---|---|
| `status_events` by `entity_type` | offering 829 · document 397 · account 144 · order 60 · fulfillment 30 · lesson_plan 1 · **booking 0** |
| `offering` rows whose entity is a `bookings.id` | **781** (13 of those bookings soft-deleted) |
| `offering` rows whose entity is an `offerings.id` | **0** |
| `offering` rows matching neither table | **48** (unclassified — -A's) |
| latest `offering` row | 2026-09-03 03:18 PDT — still being written |
| `status` on the 829 | pending 653 · scheduled 164 · cancelled 11 · completed 1 |
| live CHECK | `entity_type = ANY (ARRAY['account','document','order','offering','fulfillment','lesson_plan','payment'])` — from `20260826T1000`, not `20260821T1500` |
| member profiles (role USER, not admin) | 13 · with no `clients` row: **3, all `zz-test-*@example.invalid` fixtures** — no live member is trapped by F4 today |
| app readers of `entity_type` | `src/lib/ops/api-status.ts:27,40,51` only (grep src+api); DB readers not yet enumerated |
| booking-event writer | `20260901T1530…sql:50` names `trg_status_bookings`; its CREATE was not found by grep — -A locates it from bodies |
| `flush_held_executed_document_emails` | defined `20260822T0730_dealauto_4…sql`; called hourly (`scheduled-jobs.yml:47`) with `p_hold_minutes: 30` → effective window 30–90 min |

## TEARDOWN (running)
- Census 2026-09-03 at open: no node/vite/vitest/esbuild/psql processes belong to this thread or any worktree. MGMT started nothing but short-lived read-only `psql` sessions, all exited.
