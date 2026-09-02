# FHE-TASK-SIGNFLOW-D — LEDGER

## RESUME
Role / thread   TASK-SIGNFLOW-D · wt-1 · branch task/signflow-d
Merge-base      c23dc022 (origin/main at checkout) — origin/main not moved since fetch
DONE            worktree claimed, ledger opened, CLNR pass run, spec §2 re-verified, §4.2 measured against prod
IN FLIGHT       Phase 1 COMPLETE, stop condition did not fire. Starting Phase 2 step 1 (routes)
NEXT            §7.1 remove the 3 routes + 2 imports from src/App.tsx
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

### Phase 1 §4.1 · §4.3 · §4.4 · §4.5

**§4.1 PRODUCTION REACHABILITY.** The site is `https://www.frenchheritageequestrian.com`
(`src/components/Seo.tsx`). ⚠️ **It is an SPA: EVERY path returns HTTP 200 with the same 9,474-byte
`index.html` shell** — `/release`, `/release/general`, `/docs/release-participant`, `/sign`,
`/sign/guest` are byte-identical. **HTTP status can never distinguish a live route from a retired
one here, and "404" in this task means the app's not-found SCREEN, not an HTTP 404.**
So reachability was proved from the DEPLOYED BUNDLE instead — `curl .../assets/index-B5KF9vyk.js`
(2,525,045 bytes): `"/docs/release-participant"` ×2, `"release/:releaseKey"` ×1, `"sign-release"` ×1,
`"sign/guest"` ×1. **All three routes are live and shipping today.** No form was submitted.

**§4.3 MODULE TRACE — nothing has a second live consumer.**
| module | other consumers | verdict |
|---|---|---|
| `src/pages/Release.tsx` (+`RELEASE_OPTIONS`) | none — export used only inside itself | GOES |
| `src/pages/DocsParticipantFlow.tsx` | none but `App.tsx:32,240` | GOES |
| `api-public.ts` `ReleaseTemplateKey`/`ReleasePreview`/`fetchReleasePreview`/`SignReleaseInput`/`SignReleaseResult`/`signRelease` | only the two pages | GOES |
| `api-public.ts` `fetchIntakeRequirements` | `PublicIntakeForm.tsx:4`, `InquiryForm.tsx:33` | **STAYS — the file stays** |
| `api/sign-release.ts` | only `api-public.ts:170` posts to it | GOES |
| `api/deliver-documents` | `SendCopiesMenu.tsx:39`, `Onboarding.tsx:78,1229-1240` | 🔒 **STAYS, PROVEN** |
| the hold close inside it (`deliver-documents.ts:486`) | onboarding's own held run | **STAYS — nothing kiosk-only to remove** |
| `open_document_delivery_hold` | `Onboarding.tsx:21,627` `holdMyDocumentDelivery()`; widened for onboarding by `20260901T1420_signbook...:26,80` | **STAYS** |
| `sign_release` / `sign_general_release` | ⚠️ `sign_general_release` has **ZERO code callers** — comments only | **NOT DROPPED (D32). Grants revoked only** |
🔒 **THE ONE STOP CONDITION DOES NOT FIRE. Phase 2 runs.**

**§4.4 `/sign/` COVERS ALL FIVE KEYS — from `sign_path_document_requirements` in PRODUCTION**
(owner-editable table, seeded `20260824T1210_offeringdocs_sign_paths_and_tags_stop_deciding.sql:53`;
applied by `api/sign-start.ts:401` `apply_sign_path_documents`):
- `RELEASE_GENERAL` → **`/sign/guest`**
- `RELEASE_PARTICIPANT` → **`/sign/rider`, `/sign/horse`, `/sign/rider+horse`**
- `FACILITY_RULES` → **all four**
- `COMPANY_POLICIES` → **all four**
- `HUMAN_EMERGENCY_MEDICAL` → **`/sign/rider`, `/sign/rider+horse`**
🔒 **NO GAP. `/sign/rider`'s set is EXACTLY the four documents the kiosk ever produced**
(RELEASE_PARTICIPANT + FACILITY_RULES + COMPANY_POLICIES + HUMAN_EMERGENCY_MEDICAL). **Nothing for
TASK-SIGNFLOW-E.**

**§4.5 LINKS IN THE WILD.** The repo proves NOTHING links to either (§2, re-run). A printed QR code,
a laminated sign, or a link in a past sent email is invisible from here — and 10 real people reached
`/docs/release-participant` somehow, so a link exists SOMEWHERE outside the repo. Owner ruled it: a
retired URL 404s.

### Phase 2 (2026-09-01 → 02)
- §7.1 `src/App.tsx` — routes `:237/:238/:240` and imports `:31/:32` removed, replaced by a RETIRED
  comment in the file's own `/inquire`-retired idiom. Commit `1` of the phase.
- §7.2 `src/lib/reviewSection.ts` — slot D removed, A/B/C NOT renumbered.
  **DECIDED (spec did not):** the section's `question` said *"Five capture surfaces, three writers"*.
  It was already off by one (4 entries listed) and is now further off. Rewritten to
  *"Three capture surfaces, two writers"* — 3 entries listed, and 2 remaining `record_signature`
  RPC call sites (`src/lib/api.ts:1502`, `src/lib/ops/api-client.ts:143`) once `sign_release`'s
  door closes.
- 🔒 §7.3 **THE ANON GRANT IS CLOSED IN PRODUCTION.**
  `supabase/migrations/20260902T0010_the_retired_kiosk_closes_the_last_anonymous_signing_door.sql`
  (named 0902 because it was written after midnight; it must sort after `20260901T2330`).
  Dry-run `BEGIN; \i …; ROLLBACK;` first, then applied.
  - BEFORE: both `{postgres=X,anon=X,authenticated=X,service_role=X}`
  - AFTER:  both `{postgres=X,authenticated=X,service_role=X}` · `has_function_privilege('anon',…)=false` ×2
  - **DECIDED:** re-GRANT to `service_role` ONLY. `authenticated` keeps the direct grant it already
    had — revoking it is subtractive beyond the spec's letter (§7.3 names anon+PUBLIC) and NOSTRIP's
    rule applies. **Flagged for follow-up: nothing calls either function as `authenticated`.**
  - Functions NOT dropped (D32, and DROP+CREATE would re-grant anon via default privileges).
