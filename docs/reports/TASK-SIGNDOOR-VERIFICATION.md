# TASK-SIGNDOOR — VERIFICATION · ORCH6 · 2026-09-01

**Merged.** Gates on `main` after merge: typecheck 0 · typecheck:api 0 · lint 46 · build clean.

## ✅ VERIFIED INDEPENDENTLY, IN PRODUCTION
| Claim | Check | Result |
|---|---|---|
| migration `20260901T1120` is applied | `pg_proc` for its four functions | ✅ **all four live** |
| ACLs are sane | `proacl` | ✅ ⚠️ **no `anon` anywhere.** The two client-facing RPCs (`my_onboarding_state`, `update_my_onboarding_profile`) grant `authenticated`; the two helpers (`sign_path_for_contact`, `_sign_path_allows_minor`) are **service_role only** — correct, they are internals |
| the path does not survive as standing categories | `select sign_path_for_contact(id) from contacts limit 3` | ✅ **empty for existing contacts** — consistent with the thread's finding, and the reason its migration exists |
| no collision with `CLNR-1` | the thread's own `comm -12` of the two change sets | ✅ **no overlap**, and the merge was clean |

⚠️ **NOT VERIFIED BY ORCH: the render.** The thread ran 30 browser assertions in real Chromium;
**ORCH did not open a browser.** `SignStart.tsx` contains 10 `<input>` tags across all its
branches — the "exactly 2 on the door" claim is a claim about what RENDERS, and only the probe
tested it. **Owner check: load `/sign/rider` and count the boxes.**

## 🔒 ROUTED TO `DSNR` — the spec's trap 3 was wrong, and it was load-bearing
**The spec asserted the `/sign/*` path survives as standing categories. It does not** — proven
empty on production for a door signup. ⚠️ **Building to the spec as written would have re-created
the AR7 incident.** **The thread caught it and carried the path on the invitation instead.**
🔒 **This is the fourth spec-premise error found by a build thread** *(after MODAL2's two
contradictions, CR85's stale row count, and DSNR-1's `current_date + 90`)*. **It goes back to
`DSNR` as a pattern, not an incident** — the specs are being written from documents rather than
from the database.

## FLAGGED, NOT FIXED
**The minor question moved post-auth and became a no-default radio pair** — a deliberate change
to `FIX1`'s shipped behaviour, forced by email-only. **Correct, and on the owner's checklist.**
