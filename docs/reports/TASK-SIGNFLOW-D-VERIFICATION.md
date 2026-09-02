# TASK-SIGNFLOW-D — VERIFICATION (ORCH, 2026-09-02)
**Verdict: VERIFIED AND MERGED** (e2f3dabf) — merged with priority because migration `20260902T0010`
was already applied to production, so old participant links ERRORED until the code landed; that
window is now closed.
**Checked independently:** `pg_proc.proacl` fresh from production — `anon` holds EXECUTE on
NEITHER `sign_release` nor `sign_general_release` (the board's long-standing routed item 1 for
`reap_expired_holds`'s sibling class is closed for these two). The three files are deleted, the
routes removed with the retirement comment at `App.tsx:235`, D32 honoured — zero rows touched.
**The headline the owner must read:** TEN real people used the participant flow, most recently
2026-08-15. Usage was struck as a gate (his ruling, reaffirmed) — reported, not acted on.
**Deliberately not done, queued:** 3 stale comments in files other threads own (exact replacements
in report §4) · the `authenticated` EXECUTE grant both functions still carry with zero callers.
**Spec wrong on four points, routed to the DSNR profile:** prod SQL WAS available via `.env.db`;
SPA returns HTTP 200 for every path (status-code tests cannot work); F3's 35 delivery rows is 28;
`/release` itself never signed anything.
**OPEN PRODUCT QUESTION (report §9): redirect `/release` + `/docs/release-participant` → `/sign`,
or leave the branded 404?** Thread recommends redirect; the against-case is his own retired-URLs-404
ruling. His call.
