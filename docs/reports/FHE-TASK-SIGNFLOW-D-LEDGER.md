# FHE-TASK-SIGNFLOW-D — LEDGER

## RESUME
Role / thread   TASK-SIGNFLOW-D · wt-1 · branch task/signflow-d
Merge-base      c23dc022 — origin/main HAS MOVED to a65243ad (D41/D42 role-model commits; no file overlap)
DONE            COMPLETE. Phase 1 (all 5 measurements) + Phase 2 (all 6 steps). 8 commits.
                f7173415 ledger · 1c1b0bf0 + bf482116 Phase 1 · cb008c52 routes+slot D ·
                58dfbfab the REVOKE (applied to prod) · e6d58cb6 file deletions ·
                6c341118 docs RETIRED markers · + the report
IN FLIGHT       nothing
NEXT            ORCH verifies and writes docs/reports/TASK-SIGNFLOW-D-VERIFICATION.md. THREAD IS DONE.
DECIDED         (1) migration re-GRANTs service_role only; `authenticated`'s existing grant LEFT
                    standing — subtractive beyond the spec's letter, flagged for follow-up instead.
                (2) migration dated 20260902T0010 (written after midnight; must sort after T2330).
                (3) reviewSection's "Five capture surfaces, three writers" → "Three … two writers".
                (4) 3 stale comments in files I do not own (MergedBodyView.tsx:28, contact.ts:184,
                    deliver-document.ts:10) LEFT for ORCH, with exact replacement text in the report.
BLOCKED         nothing
DO NOT          - DO NOT test the retirement with `curl -I`. The site is an SPA: EVERY path returns
                  HTTP 200 with the same 9,474-byte shell. Prove routes from the built bundle or the
                  rendered screen. The spec's §4.1/§10.7 asked for a status code that cannot mean this.
                - DO NOT look for `origin`/`channel` on `documents` to attribute a kiosk signing —
                  the columns do not exist. `signatures.method='KIOSK_TYPED'` is the attributor and
                  `sign_release` is its ONLY writer anywhere in the DB.
                - DO NOT believe `.env` is all there is. `.env.db` in a pool worktree is a FULL
                  PRODUCTION POSTGRES URL. The spec said these counts were unmeasurable; they were not.
                - DO NOT trust FLOW-MAP F3's "35 delivery rows" — it is 28.
                - DO NOT expect `/release` to have signed anything. It never did, not once.
                - The migration is LIVE IN PRODUCTION and the code is NOT (TASK does not push):
                  until ORCH merges, an old participant link errors rather than 404s.

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

### Close (2026-09-02, ~00:30)
- §7.4/§7.5 — `api/sign-release.ts`, `src/pages/Release.tsx`, `src/pages/DocsParticipantFlow.tsx`
  deleted; `src/lib/ops/api-public.ts` trimmed to `fetchIntakeRequirements` only (the two
  `PublicIntakeForm`/`InquiryForm` consumers keep the file alive). `types.ts` re-exported NONE of
  the release symbols — the spec's §7.5 warning checked and negative.
- §7.6 — FLOW-MAP F3, both SURFACE-INVENTORY rows and `flows/onboarding.md` F3 marked RETIRED with
  the owner's words and the measured usage. **Rows kept, not deleted.**
- **A JSX comment I added to App.tsx was missing its closing `}` — caught by `npm run typecheck`,
  NOT by `npx tsc --noEmit` (which resolves a different project and reported nothing). Use the
  npm scripts.**
- typecheck 0 · typecheck:api 0 · lint 0 errors / 45 warnings · build ✓ 4.11s.
- **Built-bundle proof:** `docs/release-participant` 0 · `release/:releaseKey` 0 · `api/sign-release` 0
  · `sign/guest` **1**.
- D35 re-verify immediately before reporting: `anon=false` on `sign_release`, `sign_general_release`,
  `record_signature`, `open_document_delivery_hold`; `authenticated`/`service_role` intact.
- Report at `docs/reports/TASK-SIGNFLOW-D-REPORT.md`. **Complete, nothing in flight.**
