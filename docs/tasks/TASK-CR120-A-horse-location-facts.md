# TASK-CR120-A — fact-find the horse location gap (DISCO profile: measure and trace, no fix yet)

**Owner's words, verbatim — `docs/reference/CHANGE-ORDER-LEDGER.md` CR-120.** Three claims. ORCH
confirmed two solidly and found the third does not match the code as read — **do not re-derive the
confirmed facts below; do trace the open ones. Read the CR-119 lesson
(`orchestration/lessons/LESSONS.md`, 2026-09-03, "traced the wrong renderer") before starting: confirm
which component actually mounts for a given path, never assume from a component that merely could.**

## CONFIRMED by ORCH — do not re-derive
1. **Every location column on the owner's newest horse is blank.** Production, `horses.id =
   'b6a00ca9-b07a-482a-a012-25f6fe0b3ac1'` (created 2026-09-03 11:46, ~2 minutes before the sale
   contract that surfaced this): `current_location_id`, `home_location_id`, `current_barn`,
   `home_barn`, `current_stall`, `home_stall`, `current_location_notes`, `home_location_notes` — **all
   null.** This is not "the right data in the wrong column" — there is no location data captured
   anywhere for this horse. **This may be a bigger problem than what the owner described** (a shape
   mismatch) — it may be that nothing was ever saved.
2. **By contrast, the other 3 real horses in production all HAVE a `home_location_id` /
   `current_location_id`** (the same location row, `2d771cea-5150-43b9-8e3d-38faa434a07d`), though
   none of the 4 horses has ever had `barn`/`stall` populated on any record. **So: location-NAME
   capture works for other horses and failed for this one; barn/stall capture has never worked for
   any horse (that part may be a "blank if outdoor" non-issue — untraced, see below).**
3. **`HorseIntakeForm.tsx` never calls `normalize(` — zero occurrences in the file.** Confirmed by
   grep; the owner's second claim (intake doesn't normalize address/names/other fields) is correct
   as stated. Compare to the contact-writer forms `TASK-SIGNFLOW-G` already fixed (`normalize(...,
   kind, ...)` on blur) — same idiom, not yet applied here.
4. **The contract's "from horse record" text is a genuine placeholder hint, not a bug in itself**
   (`ClauseDocument.tsx:132`: `AUTOFILL_HINT[token] ?? (token.startsWith('HORSE.') ? 'from horse
   record' : null)`) — it shows only when the imported value IS blank. `generate_document`'s seeding
   (`20260802080000_horse_breed_color_fallback.sql:48`) already does
   `coalesce(nullif(v_curr_loc,''), v_horse.current_location)`, i.e. it DOES try to read
   `horses.current_location`. **Given fact 1, the hint is arguably CORRECT for this horse — there is
   nothing to show.** Whether `horses.current_location` (plain text) vs `current_location_id` (FK) is
   itself a shape split worth collapsing is still open — see §1 below.

## NOT CONFIRMED — trace these, do not guess from the component alone
1. **Which surface did the owner actually use to add this horse?** `HorseIntakeForm.tsx` is the real,
   multi-site-mounted intake surface (confirmed: `HorseIntakePage.tsx`, `HorseRecordsPage.tsx`,
   `HorsesPage.tsx`, `Onboarding.tsx`, `ContractPage.tsx`, `NewContractPage.tsx` all render it) — but
   `AddHorseModal.tsx` also exists as a SEPARATE horse-add surface. **Trace: does `AddHorseModal`
   capture location at all, or does it create a bare horse row and defer location to a later edit?**
   If the owner added this horse through `AddHorseModal`, that may be the entire explanation for fact 1
   — not a save-time failure, but a lighter path that never asked. Confirm by reading the component,
   then correlate with which route/button the owner would have clicked (staff "add horse" affordance
   — grep call sites of `AddHorseModal` for where it's triggered).
2. **If he DID go through `HorseIntakeForm`/`HorseIntakePage`: does `locationsOk` (the completeness
   gate, `:837-840`) actually block saving when `homeLoc.name` is blank, or can the form save anyway?**
   Read the save handler and its validation call, not just the `complete`/`missing` computation —
   confirm whether an incomplete form can still submit (a silent-partial-save is the worse of the two
   possible bugs here).
3. **The "Other" dropdown claim — locate the REAL control before concluding anything.**
   `PrefixSelect` (`HorseIntakeForm.tsx:347-354`, used for Barn-vs-Stable and Stall-vs-Pen prefixes)
   has **no "Other" option at all** — two fixed words only. That cannot be what the owner means. The
   ONE control in this file with a real "Other (enter manually)…" option is the **Location name**
   combo (`LocationEntry`, `:388-419`) — used once for "home" location and once for "current/lease"
   location, i.e. there ARE two of them on the form. **Trace: is the owner calling these two combos
   "barn" and "stall" informally (they sit directly above the barn/stall row), or is there a THIRD
   surface with real barn/stall SELECT-with-Other fields this pass hasn't found** (check
   `src/pages/app/ops/HorseRecordsPage.tsx` and `src/pages/app/ops/superadmin/ProvisionTenantPage.tsx`
   — both matched an earlier broad grep and were not read this pass)? **If it IS the Location-name
   combo:** read `otherOpen`/`showOther`'s state logic (`:389-391`) and `set_horse_locations` →
   `_resolve_location`'s matching behavior (the comment at `:384-387` already flags a related risk —
   case/whitespace variants creating duplicate location rows) for why "Other" might visually show but
   not persist correctly.
4. **`horses.current_location` (text) vs `current_location_id` (FK to `locations`) — is this split
   itself the "data shape not matching an explicit expectation" the owner named?** `generate_document`
   reads the TEXT column; nothing in this pass found a writer that populates
   `horses.current_location` from the FK'd `locations` row's address when only `current_location_id`
   is set (the other 3 horses have `current_location_id` but did NOT check whether their contracts
   would render correctly either — **do that check**: pick one of the 3 older horses, generate or
   inspect a contract naming `HORSE.CURRENT_LOCATION`, confirm whether IT ALSO shows the placeholder).
   **This is the decisive test:** if an older horse with a real `current_location_id` ALSO renders the
   placeholder, the shape mismatch is real and systemic. If it renders correctly, fact 1 (nothing was
   captured) is the whole story and there is no separate shape bug.

## Ownership (read-only this pass — D35/D36)
No writes. No thread owns `HorseIntakeForm.tsx`, `AddHorseModal.tsx`, `ClauseDocument.tsx`'s HORSE.*
handling, or the `horses`/`locations` tables. Say so in the report so a build task can claim them
cleanly.

## Report to
`FHE-ORCH` (direct dispatch). Model: **Opus · HIGH · thinking ON** — bounded investigation across a
known small file set, not a shape design.

## What happens after
ORCH reads the report, and only then decides: one CODR task (if the fix is bounded — e.g., a writer
that syncs `current_location` from the FK row, plus normalize() calls added to the intake form idioms
already used elsewhere) or a DSNR pass first (if the location-shape split needs an owner ruling on
which column is authoritative). **Do not build in this task.**
