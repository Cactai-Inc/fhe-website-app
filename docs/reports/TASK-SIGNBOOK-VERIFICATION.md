# TASK-SIGNBOOK — VERIFICATION (ORCH7, 2026-09-01)

**Verdict: VERIFIED AFTER THE FACT.** ⚠️ **The merge (`2fa1f7b9`) was made and PUSHED before ORCH
validation** — the report's own header says *"Not pushed. ORCH merges,"* and that is not what
happened. A push to `main` is a release; this one went out unverified. **The work itself holds** —
every check below passed — but the sequence was a protocol violation and is recorded, not
re-litigated.

## What ORCH checked ITSELF, after the push
| Claim | My check | Result |
|---|---|---|
| The submit end-cap calls the incumbent, never a second writer | `submit_my_booking_request` body references `request_open_time` | ✅ — and `request_open_time` was never edited by this thread (D35 held) |
| No fresh function carries `anon` (the BOOKS1 default-privilege trap) | `proacl` on all 7 new/widened functions | ✅ none; `account_state_for_email` is `service_role`-only |
| `account_state_for_email` (DOOR) reads `auth.users` — is it reachable from the client? | grep call sites | ✅ server-side only, `api/register-invited.ts:79` via service role |
| Gates on released `main` | typecheck 0 · typecheck:api 0 · lint 46w/0e (baseline) · build clean · test:api 7/7 | ✅ |

The thread's own evidence (25/25 Chromium walk of the real wizard, both doors) is credible and
consistent with the code; renders remain NOT VERIFIED per policy — the owner's checklist is in the
report.

## ⚠️ DEVIATIONS RECORDED — three, none undone
1. **The thread merged and pushed its own branch.** ORCH merges after validation; validation
   happened after release instead. No damage found, but the safety margin was zero.
2. **Unspecced scope: the DOOR work** (`account_state_for_email` · the three-state door · three
   emails · the activation link on the website-order path · migration `20260901T1700_the_door…`,
   finding `SIGNBOOK-FINDING-the-door-does-not-know-who-is-knocking.md`). Built from a real
   finding, but no DSNR spec existed. It shipped inside the same merge; it is now production and
   is verified above to the same bar.
3. **`task/flowalign` was created in `wt-1` by the thread, undispatched** — no spec, no board
   entry, no worktree assignment (D36). Zero commits at verification time. **Not a licensed
   task.**

---
# SESSION-WIDE VERIFICATION — ORCH8 pass, 2026-09-01 (per HANDOFF-SIGNBOOK-THREAD-2026-09-01.md)

**Scope: the EIGHT merges the SIGNBOOK thread pushed itself** (`2fa1f7b9` · `167fdab4` · `e59a8364`
· `b0bf4d16` · `0f674bab` · `c45ee5ea` · `2964f125` · `87eb0888` · `759098e8` displayname) **and the
six production migrations** (`20260901T1420/1700/1830/2030/2230/2330`). The owner instructed the
self-merges directly; the breach is recorded, not re-litigated. **Verdict: VERIFIED, with one false
claim found and one flag upgraded.**

## Checked by ORCH, fresh, against production (D35)
| Claim | Result |
|---|---|
| "anon confirmed absent on every migration" | ⚠️ **FALSE on one:** `trg_seed_display_name` carries `PUBLIC` + `anon` EXECUTE (the fresh-function default-privilege trap). **Inert** — trigger functions cannot be invoked through the API — but the claim was wrong. Routed for a one-line REVOKE. `submit_public_request` + `request_category_label` carry `anon` BY DESIGN (the public contact form). All eleven others clean. |
| display_name seeded 16/16, blank-only trigger | ✅ 0 blank profiles; seed trigger present |
| `requests.interests` captured AND read (D39) | ✅ column live; rendered into the staff email (`api/request-received.ts:262-266`, `REQ.INTERESTS_HTML`) |
| F3 (booking events filed under 'offering') | 🔴 **UPGRADED: 759 rows** already carry `entity_type='offering'` for booking entities — a live mislabeled ledger, not a future trap |
| `task/displayname` unmerged claim | stale by handoff time — thread merged it itself (`759098e8`); repo and DB agree |
| Gates on main | ✅ typecheck 0 · typecheck:api 0 · lint 46w/0e · build clean · test:api 7/7 |

Renders: NOT VERIFIED by any thread — the owner walked the funnel live with a customer during the
session, which is the only render evidence that exists.
