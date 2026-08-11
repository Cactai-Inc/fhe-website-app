# TASK-FACILITYTERM — REPORT

Branch `task/facilityterm` off `origin/main`, worktree `~/Downloads/claude-code-repo/wt-facilityterm`. Not pushed.

## Status: built, verified, two items deferred (not blocked — coordination-gated)

## Owner decisions this session (superseding the task doc's own recommendations)

The task doc said **ASK, do not guess** on three points. Owner answered directly; recorded here as the ratified spec:

1. **Internal term: `property`**, not `facility` (the task doc's own suggestion) or `site` (its fallback). Reason found during scoping, not anticipated by the task doc: the codebase already has a *load-bearing* `Facility`/`facilities` entity (a physical structure with stalls — `src/lib/ops/api-boarding.ts`, `src/pages/app/ops/boarding/FacilitiesPage.tsx`, `listFacilities`/`createFacility`/`updateFacility`). That's the exact "Barn A" building concept the task's own judgement table says to leave alone — reusing `facility` for the NEW "tenant's word for their whole operation" concept would overload one identifier with two unrelated meanings. `site` was rejected too (collides with "the public marketing website" — `container-site`, `Seo.tsx` `og:site_name`). `property` has no such collision and isn't one of the five tenant-facing words, so it's safely internal-only.
2. **Term list: exactly the 5 the owner named** — barn, ranch, stables, grounds, facility. Nothing invented. But the list is a **data table** (`property_terms`), not a hardcoded array — adding a 6th word later (the owner's "possibly others") is an `INSERT`, never a code change or redeploy.
3. **Fallback: `FACILITY`** (neutral, singular, never wrong) for any org that hasn't chosen — **and FHE's own org is explicitly set to `RANCH`** in the same migration, since FHE predates this feature and the owner's own sentence supplied the answer ("FHE is a stable at a ranch, not a barn").

Third open question from the task doc — **does the term appear in outbound email/contracts/PDFs?** — checked directly: no. The two "barn" hits under `api/` (`api/_lib/email.ts`, `api/request-received.ts`) are both code comments, not rendered email copy. Contract wording is untouched per the constraint (`ClauseDocument.tsx` frozen).

## What shipped

**DB** — `supabase/migrations/20260811T1300_facilityterm_property_term.sql`:
- `property_terms` — global, world-readable, SUPER_ADMIN-write lookup table. Not just a bare noun: each row carries the full grammar shape (`term`, `article`, `plural`, `preposition`) per the task doc's own warning that a single noun substitution breaks on plural-form words ("the stables ARE closed", not "IS"). Seeded with the 5 owner-named words.
- `config_values` ns `PROPERTY` key `TERM_KEY` — the org's selection, an EAV row exactly like `BRAND.*`/`CONTACT.*`. Registered in `config_keys` (not required — the fallback covers it).
- `resolve_property_term(org)` — single resolution seam (mirrors `config_value()`), always returns a complete shape.
- `my_property_term()` — new RPC mirroring `my_modules()`. **This closes a gap the task doc didn't know about**: `BrandProvider`'s per-tenant config fetch only ever reached the anon/public `slug` marketing path (`org_public_config`) — the signed-in app always rendered the hardcoded FHE constant, with zero per-tenant fetch of its own. Since ~90% of the 160 mentions live in the authenticated app (ops pages, forms, nav-adjacent copy), and Verification item 3 requires switching an org's term to change every surface with no redeploy, the authenticated app needed this seam too. Wired into `AuthContext` exactly where `myModules()` already lives.
- `org_public_config(slug)` reissued (`CREATE OR REPLACE`, the project's own pattern) to add a `property` key alongside `brand`/`modules`/`pricing`.
- `provision_tenant()` reissued to extend the `p_brand` key-prefix router with a `PROPERTY.` prefix (alongside the existing `BRAND.`/`CONTACT.`/`MODULE.<mod>.`) — reproduced **byte-for-byte** from the original U6 migration plus this one additive change; verified against the original file line by line after an early reconstruction pass introduced a drift (see Verification below).
- FHE's org seeded to `PROPERTY.TERM_KEY = 'RANCH'`.

**Client**:
- `src/lib/propertyTerm.ts` — the `PropertyTerm` shape, `resolvePropertyTerm()`, and grammar helpers (`withArticle`, `withPreposition`, `titleCase`, `withArticleCapitalized`, `agree` for subject-verb agreement). `DEFAULT_PROPERTY_TERM` mirrors `brand.ts`'s `BRAND` constant exactly — it's FHE's real value (`ranch`), not a neutral placeholder, matching the existing "start from the FHE constant so prerender stays green" convention.
- `AuthContext.tsx` — fetches `my_property_term()` alongside `myModules()`, same posture (failure doesn't block sign-in, falls back to the default).
- `BrandProvider.tsx` — new `usePropertyTerm()` hook, resolving from `org_public_config().property` on the public slug path or `AuthContext.propertyTerm` on the member-app path (same split `useModules()` already uses).
- `src/lib/api.ts` — `myPropertyTerm()`, `listPropertyTerms()`, `OrgPublicConfig.property`.

**Settings surface** (`AdminBrandingPage.tsx`) — new "What do you call your place?" section, a `<select>` populated live from `property_terms` (data-driven — a 6th word appears here automatically), saved through the same `upsertConfigValue()` seam BRAND fields already use, refreshing via `refreshProfile()` so the change is visible immediately.

**Provisioning** (`ProvisionTenantPage.tsx`) — step 2 (Brand) gets the same picker; the choice flows into `provision_tenant()`'s `p_brand` payload as `PROPERTY.TERM_KEY`; the review step (step 5) shows the chosen word.

## Full classified list

Every file from a case-insensitive `barn` grep across `src/` and `api/` (168 raw hits — the task doc estimated 160; close enough to be the same count under slightly different grep flags). Grouped by file; one row per distinct reason.

### CHANGED — named FHE's own operation, now renders the tenant's term

| File | What changed |
|---|---|
| `PublicIntakeForm.tsx` | "Saw the barn nearby" intake-source option → `Saw ${withArticle(term)} nearby` |
| `HorseIntakeForm.tsx` | "pass your entry to the barn" / "opened a review with the barn" → templated |
| `AppOverviewModal.tsx` | 4 intro paragraphs + Calendar/Messages page descriptions + "For Sale" feed blurb + closing "whole barn" paragraph (rewritten to `everyone ${withPreposition(term)}` — "whole barn"/"whole grounds" doesn't survive substitution, so the sentence was rewritten rather than special-cased, per the task doc's own instruction) |
| `CreateModal.tsx` | "e.g. Barn closed Friday for the show" placeholder → `${titleCase(term)}` |
| `CommunityFeed.tsx` | Empty-state copy "posts from the barn and community" → templated |
| `NotFound.tsx` | 404 copy "back to the barn" → templated |
| `About.tsx` | "Trail access from the barn" amenity bullet → hardcoded to "ranch" (static FHE marketing prose, same posture as the tagline fixes below — this page already hardcodes "Carmel Creek Ranch" throughout, not templated per-tenant) |
| `HorsePage.tsx` | "ask the barn to add you as a party" error copy → templated |
| `Schedule.tsx` | "Barn events" section heading + `aria-label` → `${titleCase(term)} events` |
| `ContractPage.tsx` | "The barn has requested to terminate" → `${withArticleCapitalized(term)} ${agree(term,'has','have')}` — the one genuine subject-verb-agreement case (stables/grounds need "have", not "has") |
| `Onboarding.tsx` | 3 strings: "attached to their record with the barn", "On file with the barn", "This creates their record with the barn" → templated |
| `HorsesPage.tsx` | "Roster of horses in your barn" → rewritten as `Roster of horses ${preposition} your ${term}` (using the shape's own preposition rather than forcing "in") |
| `LessonPackagesPage.tsx` | "The lesson packs your barn sells" → templated |
| `SchedulePage.tsx` (employees) | "e.g. Barn duty, Lessons, Show prep" role hint → templated |
| `ScheduleSessionForm.tsx` | "(barn horse or the rider's own)" staff-facing hint → templated |
| `brand.ts`, `Footer.tsx`, `seo.ts` | Three independent hardcoded copies of the same tagline/description ("family-run hunter/jumper barn and community…") → "ranch" (static tenant-authored copy, not templated — same reasoning as the About.tsx bullet) |
| `seed.ts` | `FEED_VIEW_META.for_sale.description` ("listed by the barn and members") → "ranch". This is the one `seed.ts` string that's live: `FEED_VIEW_META` is consumed unconditionally by `Home.tsx`'s page header, unlike the rest of the file, which is gated behind `SEED_ENABLED = false` (see below) |

### KEPT — building prefix, horse name, or industry-generic (per the task's own judgement table)

| File | Why kept |
|---|---|
| `HorseIntakeForm.tsx`, `StableEditors.tsx`, `HorseForm.tsx`, `HorseTable.tsx`, `HorseRecordsPage.tsx`, `NewContractPage.tsx`, `CareHome.tsx`, `fieldSources.ts`, `StableSection.tsx`, `stable.ts`, `seed.ts` (non-live rows) | "Barn name" / `barnName` / `BARN_NAME` / `p_barn_name` — the horse's everyday name (nickname), explicitly protected by the task doc and by the constraint against renaming DB columns carrying barn as a horse attribute |
| `HorseIntakeForm.tsx` (`PrefixSelect prefixes={['Barn','Stable']}`), `horses.ts` (`home_barn`/`current_barn`), `HorsePage.tsx` (`composeLocation`) | "Barn A" / "Stable B" — a physical-structure prefix on a horse's location, names a building not the business |
| `HorseIntakeForm.tsx:958` ("another barn"), `About.tsx:88` ("the best barns are not really about the riding") | Industry-generic — matches the task doc's own worked example verbatim ("another barn") and a generic aphorism about barns-as-a-category, not naming FHE |
| `acquisition.ts`, `Checkout.tsx` ("Barn / property address" placeholders) | Format-example placeholders for a horse's *external* location (pre-acquisition or off-site), generic |
| `HorseIntakeForm.tsx:247` ("123 Barn Rd") | Street-name example, unrelated to the facility concept |
| `ClauseDocument.tsx` | **Frozen** per the task's constraint — not touched regardless of classification |

### DEFERRED — the `barnops` module family (route, files, nav, module key)

**Not built this pass.** `AppLayout.tsx` is owned by `TASK-ONEHEADER`'s successor, **`UIBUILD`**, which is actively committing to it right now (confirmed: `wt-uibuild` has commits as recent as this session, mid-flight on 6 UI orders). The task doc's own coordination note said to report nav changes here, not make them.

This is one cohesive unit, not stray strings — renaming any piece without the rest leaves things inconsistent or breaks navigation:
- Nav item (`AppLayout.tsx:312`): `{ to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' }`
- Route family (`App.tsx`): `ops/barnops`, `ops/barnops/resources`, `ops/barnops/consumption`, `ops/barnops/allocation-rules`
- Files: `BarnopsHubPage.tsx`, `ResourcesPage.tsx`, `ConsumptionLogPage.tsx`, `AllocationRulesPage.tsx` (all under `pages/app/ops/barnops/` and `pages/app/ops/hubs/`), `api-barnops.ts`
- Module key: `mod.barnops` (live in production `org_modules` rows — a rename is a data migration, not just a code change)
- In-page copy tied to the same identity: page `<title>` tags, the `BarnopsHubPage` `h1`, "Barn default" / "barn payer" labels in `AllocationRulesPage.tsx`, `OpsDashboard.tsx`'s `mod.barnops` → label/path map

**Recommendation for the follow-up, once UIBUILD releases `AppLayout.tsx`:** rename the route/file/module family in one pass (`ops/barnops` → e.g. `ops/property-ops`, `mod.barnops` → `mod.property_ops` with a data migration for existing `org_modules` rows), update the nav label to `${titleCase(term)} Ops`, and template the in-page "Barn default"/"barn payer" labels the same way this pass did everywhere else. I did not start it partially to avoid a half-renamed, inconsistent module.

**Comments only, left untouched** (not user-facing, low value to churn): `api.ts`, `api-barnops.ts`, `api-lessons.ts`, `api-calendar.ts`, `ContractPage.tsx` ("barn office" / "barn admin"), `CalendarItemPanel.tsx`, `PublicIntakeForm.tsx:230`, `api/request-received.ts:1`, `api/_lib/email.ts:141`, `HorseIntakeForm.tsx` (several JSDoc comments).

## Overlap check: LEASEFIX

Confirmed **no collision**. `LEASEFIX`'s only current change (`20260811T1200_leasefix_addendum_gl_ccc_wording.sql`, on `task/leasefix`, unmerged) contains zero "barn" mentions, and this task's own constraint keeps `contract_clause_defs`/contract wording out of scope entirely (`ClauseDocument.tsx` frozen). If LEASEFIX's later stages touch insurance clause wording that happens to say "barn," it's still out of this task's scope — contract text isn't templated by tenant word per the task doc.

## Out-of-scope observations (spotted in passing, not acted on)

- **`About.tsx`'s "The Facility" eyebrow label** (`<p className="eyebrow">The Facility</p>`, right above "Carmel Creek Ranch, San Diego") doesn't contain the word "barn" so it was outside the literal 160-mention scope, but it's the same collision risk the owner already ruled on: "facility" as a generic section label sitting next to FHE's actual chosen word ("ranch"). Left as-is — didn't want to scope-creep into a general equestrian-vocabulary pass. Flagging for a possible follow-up.
- **`seed.ts`'s `FEED_VIEW_META.all.description`** already says "around the stables" — a pre-existing, unrelated inconsistency (not "barn," so not in this task's grep scope). Same file, same observation as above.
- **`seed.ts` is otherwise dead in production** (`SEED_ENABLED = false`, file marked "DELETE THIS FILE once the backing RPCs return real rows" in its own header) — the remaining "barn" mentions there (`Summer barn dinner` ×2, mock `barnName: 'Bruno'`) are inert and were left untouched; only `FEED_VIEW_META.for_sale.description` was fixed since it's the one export that renders unconditionally.

## Verification

- `npm run typecheck` (app) — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — 0 errors, 36 pre-existing warnings (fast-refresh/exhaustive-deps on files this task didn't touch, plus one expected new fast-refresh warning on `BrandProvider.tsx` from adding `usePropertyTerm()` alongside its existing `useBrand()`/`useModules()` — same pattern already present there).
- `npm run build:client` — clean.
- **DB, functional** (`test/db`'s PGlite harness — both the checked-in snapshot and a full fresh-migration replay are independently broken today for reasons unrelated to this task: the snapshot fixture violates a `products_module_key_fkey` constraint before any test runs, and a full replay hits a documented pre-existing break at `20260728010000_release_family_signer_side.sql`, well before this migration; confirmed by removing this task's migration entirely and re-running — identical failure). Verified this migration directly instead: replayed migrations up to the checkpoint immediately before that break, applied `20260811T1300_facilityterm_property_term.sql` on top, and exercised it end-to-end —
  - `property_terms` seeded with exactly the 5 rows and correct grammar shapes (including `STABLES`/`GROUNDS` plural + `GROUNDS` preposition `on`).
  - FHE's `resolve_property_term()` → `RANCH`.
  - `org_public_config(slug)` (anon path) carries `property: RANCH`.
  - `my_property_term()` (authenticated USER, not staff) → `RANCH`.
  - `provision_tenant()` with `PROPERTY.TERM_KEY: 'STABLES'` → the new org resolves to `STABLES`.
  - `provision_tenant()` with no `PROPERTY.TERM_KEY` → the new org falls back to `FACILITY`.
  - Non-SUPER_ADMIN caller still rejected — the `provision_tenant()` reissue preserved the guard.
  - **Caught and fixed one real bug this way**: an early draft of the migration's header comment contained a literal `BRAND.*/CONTACT.*`, whose `*/` prematurely closed the SQL block comment and would have made the whole migration fail to apply. Fixed before this was ever a risk to prod.
  - `provision_tenant()` was reissued from a byte-for-byte read of the original U6 migration (`20260630050000_provision_tenant.sql`) plus only the additive `PROPERTY.` prefix-routing lines — checked line-by-line against the original after an earlier reconstruction-from-memory pass had drifted (missing the SUPER_ADMIN guard, wrong `audit_logs` insert shape). Re-verified against the source file before finalizing.

## Verification against the task doc's own checklist

1. ✅ Every user-facing string identified as naming FHE's own operation now renders the tenant's word (list above).
2. ✅ "Barn name" and building prefixes verified untouched by diff, not just by search (see KEPT table).
3. ✅ Switching an org's term changes every surface with no code change/redeploy — proven end-to-end via the DB functional checks above, and via the new `my_property_term()` seam that makes the *authenticated app* (not just the public marketing site) actually reactive to it for the first time.
4. ✅ Plural terms walked, not assumed: `stables`/`grounds` checked against every construction they appear in — the one genuine subject-verb case (`ContractPage.tsx`) uses `agree()`; the one "in your barn" case (`HorsesPage.tsx`) was rewritten around the shape's own preposition rather than forced.
5. ✅ Typecheck, lint, build clean (above).

## Open items for the owner

- Confirm FHE = **ranch** (used the owner's own sentence as the source; flagging per the task doc's request to confirm, not assume).
- `barnops` module rename: confirm the plan above once `AppLayout.tsx` is free, including whether `mod.barnops` gets renamed in production `org_modules` rows or kept as a stable internal key forever (a legacy internal identifier never shown to users is arguably fine to leave as-is, since the task's own constraint is "never shown to a user" for *this* migration, not that it's already `property`-branded — worth a explicit call either way before that follow-up starts).
- `About.tsx`'s "The Facility" eyebrow — cosmetic, low priority, flagged above.
