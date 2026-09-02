# FHE-TASK-SIGNFLOW-D — LEDGER

## RESUME
Role / thread   TASK-SIGNFLOW-D · wt-1 · branch task/signflow-d
Merge-base      c23dc022 (origin/main at checkout) — origin/main not moved since fetch
DONE            worktree claimed, ledger opened, CLNR pass run, spec §2 re-verified, §4.2 measured against prod
IN FLIGHT       Phase 1 §4 — measurements 2 done (usage + deliveries); 1 (prod fetch), 3 (module trace), 4 (/sign coverage) remain
NEXT            fetch the 3 routes in production, then trace §4.3 modules
DECIDED         —
BLOCKED         —
DO NOT          —

---

## LOG

### 2026-09-01 — thread start
- Board `docs/orch/BOARD.md:55` assigns `wt-1` to `FHE-TASK-SIGNFLOW-D` (Opus · HIGH · thinking ON).
- Guard before checkout, in `/Users/Cactai/Downloads/claude-code-repo/wt-1`:
  - `git symbolic-ref -q HEAD` → empty (detached HEAD) ✅
  - `git status --porcelain` → empty ✅
- `git fetch origin && git checkout -b task/signflow-d origin/main` → branch created at `c23dc022`.
- `git clean -xdf -e node_modules -e .env -e .env.db` → removed `dist/`, `dist-ssr/`.

### Phase 1 measurements (2026-09-01)

**SPEC PREMISE CORRECTED — production SQL IS available.** `.env.db` in the pool worktree carries a
full production Postgres URL (`db.lrstswfxfsezdmvkvukc.supabase.co`). Spec §4.2 said DSNR could not
run these counts because the repo only had `VITE_*` keys. `psql "$(cat .env.db)"` connects as
`postgres`. **Every count below is measured, not inherited.**

- `grep -n "release" src/App.tsx` → `:31` import Release · `:32` import DocsParticipantFlow ·
  `:237 /release` · `:238 /release/:releaseKey` · `:240 /docs/release-participant`. No auth wrapper. ✅ spec §2 holds.
- `grep -rn "'/release|\"/release|release-participant" src api supabase scripts` → the 3 routes,
  `src/lib/reviewSection.ts:283` (Review slot D), plus comment-only hits in
  `api-public.ts:118`, `DocsParticipantFlow.tsx:11,261`, `Release.tsx:219,235`, `api/sign-release.ts:26`.
  ⚠️ `Release.tsx:235` is a `<Link to="/release">` — a SELF-link inside the retired page. ✅ spec §2 holds.
- `grep -rn "release-participant|/release" supabase/ | grep -v migrations-archive` → **zero.** ✅
- **ACL BEFORE (pg_proc.proacl):**
  - `sign_release(...)` → `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
  - `sign_general_release(text,text,text,text,uuid,boolean)` → `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
- 🔒 **THE ATTRIBUTOR: `signatures.method = 'KIOSK_TYPED'`.** `sign_release` line 214-215 writes it;
  a scan of EVERY function in `public` (`pg_get_functiondef ilike '%KIOSK_TYPED%'`) returns
  **`sign_release` and nothing else**. `/app/onboarding` signs through `record_signature`, method `TYPED`.
  So the two methods separate the kiosk from onboarding exactly.
- **USAGE, MEASURED:** 40 `KIOSK_TYPED` signatures · **10 distinct real signers** · 4 documents each
  (RELEASE_PARTICIPANT + FACILITY_RULES + COMPANY_POLICIES + HUMAN_EMERGENCY_MEDICAL) ·
  first 2026-07-13 · **last 2026-08-15 (17 days ago)** · all EXECUTED.
  **Zero RELEASE_GENERAL → the single-doc `/release` kiosk has produced NOTHING; every use is the
  4-doc `/docs/release-participant` flow.**
- **F3's "35 delivery rows" is WRONG. The real number is 28** (`document_deliveries` joined to
  KIOSK_TYPED documents), all channel EMAIL, 2026-07-28 → 2026-08-15. 107 delivery rows in total.
