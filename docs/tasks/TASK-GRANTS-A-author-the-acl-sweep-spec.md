# TASK-GRANTS-A — author the spec for the ACL sweep (DSNR profile: spec authoring, no build)

**Dispatched by `FHE-MGMT-GRANTS` (bundle manager, D44), 2026-09-03. Bundle: `docs/orch/BUNDLE-GRANTS.md`
(RECONCILED §8 row B1). Change name: `GRANTS`.**
**Thread name: `FHE-TASK-GRANTS-A`. Profile: `DSNR` — you author specs and a handoff; you build nothing,
you apply nothing to production, you write no `GRANT`/`REVOKE`.** The build thread that follows is
`FHE-TASK-GRANTS-B` (letters continue; `-V` is the verifier, `-W` the walk — reserved, not yours).
**Hand this back to `FHE-MGMT-GRANTS`** — not to ORCH, not to the owner.

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/DSNR-ROLE.md` — the profile you wear. §4 is the spec anatomy; §"WRITE FROM THE DATABASE".
> - `docs/method/TASK-ROLE.md` — the standing requirements. `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-GRANTS-A-LEDGER.md` FIRST.
> - `docs/orch/BUNDLE-GRANTS.md` — **the charge.** The seven items, the ownership declaration (ACLs ONLY,
>   never a body, no `DROP`), the ONE pre-registered escalation point, the WALKR flows.
> - `docs/reports/FHE-MGMT-GRANTS-LEDGER.md` §MEASUREMENT — the population, measured once by MGMT
>   2026-09-03: 675 SECURITY DEFINER functions in `public`, 326 anon-executable, 151 of those volatile
>   non-trigger. **Re-run it yourself; that table is your starting point, not your evidence.**
> - `CLAUDE.md` **D35** (a worktree does not isolate the database; re-prove before reporting) · **D1a**
>   (the platform owner is not a tenant — a guard that goes NULL for it is correct).
> - `docs/reports/TASK-BOOKS1-REPORT.md:80` and `docs/reports/TASK-BACKDATE-REPORT.md:290` — the trap
>   this bundle exists for: Supabase default privileges hand `anon` EXECUTE to every fresh function, and
>   `REVOKE … FROM PUBLIC` does not undo a direct grant.
> - `supabase/migrations/20260902T0010_the_retired_kiosk_closes_the_last_anonymous_signing_door.sql`
>   — **the idiom**: explicit-role `REVOKE` by full signature, then a `proacl` proof. Copy its shape.
> - `supabase/migrations/20260823T0140_creditgrant_5_asking_for_the_money_is_its_own_act.sql:123-124`
>   — item 1's own revoke that production does not reflect.
> - `supabase/migrations/20260901T0100_the_reaper_stops_calling_a_dropped_function.sql` and
>   `api/expire-holds.ts:64` — item 2's function and its only caller (establish which ROLE that
>   client runs as; the answer decides whether `anon` on `reap_expired_holds` has any caller at all).
> - `api/order-request-payment.ts:74` — item 1's caller (bearer of the CALLER, i.e. `authenticated`).
> - `docs/reports/TASK-SIGNBOOK-VERIFICATION.md` §"Checked by ORCH" — item 3, `trg_seed_display_name`.
> - `docs/reports/TASK-SIGNFLOW-D-REPORT.md` §2 criterion 4 (**the three replacement texts, verbatim**),
>   §4 first two bullets and §5 item 1 — item 5, the caller-less `authenticated` grant on the retired
>   `sign_release` / `sign_general_release`, and the zero-caller `release_preview` /
>   `general_release_preview` `anon` grants D flagged.
> - `docs/orch/RECONCILED-2026-09-02.md` rows 1.13, 1.14, 1.17, F7, R1 and §7.1 — the confirmed facts.
> - `src/pages/app/Onboarding.tsx:97-111` and `:615-625` — item 6's two Onboarding comments (the payment
>   step is claimed live on the provisioned door; nothing sets `step='payment'`). No replacement text
>   was supplied for these two — **you write it**, from what the code does today.

---

## 1. THE OUTCOME — three files, and the third is the one the owner will read

1. **`docs/tasks/TASK-GRANTS-B-<sentence>.md`** — the build spec for `FHE-TASK-GRANTS-B` (CODR profile):
   the sweep query, the ACL migration, the five comment edits, THE TEST, THE REACH (none — this is not a
   feature; say so), ownership restated from the bundle, the owner's render checklist (none).
2. **`docs/reports/FHE-DSNR-GRANTS-A-HANDOFF.md`** — your handoff to MGMT: the chunks and whether they are
   disjoint, model/effort per chunk, what you decided that the bundle did not, where the bundle was wrong.
3. **`docs/reports/FHE-TASK-GRANTS-A-ANON-WRITERS.md`** — 🔒 **THE ESCALATION LIST.** MGMT puts this file in
   front of the owner for the bundle's one pre-registered escalation. Its shape is fixed (§3).

## 2. THE SWEEP — what "a SECURITY DEFINER function that WRITES" means, decided here and written down

- **The candidate set is every SECURITY DEFINER function in `public` that `anon` can execute** — all 326,
  **not** the 151. `provolatile` is a hint, not the test: a function declared STABLE that writes is a
  finding, and you will only see it by reading bodies.
- **The writer test is the BODY**: `pg_get_functiondef` contains `INSERT` / `UPDATE` / `DELETE` /
  `TRUNCATE` / `MERGE` / `PERFORM`-or-`SELECT` of another function that writes (one level deep is
  enough — name the callee), or `pg_notify`/`set_config` side effects you judge material. Write the
  query or script that does this, paste it, and paste its output. **A function you classified by
  reading its name is a function you did not classify.**
- **Trigger functions are writers by construction and are inert through the API.** Classify them as
  their own class (item 3 is one of 45). They go in the migration under their own heading with the same
  explicit-role idiom — a false "anon absent" claim is what item 3 is — but they are NOT escalated.
- **Readers (no write in the body) are OUT of this bundle's revoke** unless D flagged them with zero
  callers (`release_preview`, `general_release_preview` — include those two, cite D §4). Do not widen
  to a general read-ACL sweep; say in the handoff how many readers carry `anon` so ORCH can bundle it.

## 3. THE ESCALATION LIST — `FHE-TASK-GRANTS-A-ANON-WRITERS.md`, its fixed shape

The bundle's escalation point, verbatim: *"Which anon-executable writers are LEGITIMATELY anon. Known-public
by design: `submit_public_request`, `request_category_label` (the contact form). Any OTHER writer the sweep
finds anon-executable goes to the owner as a list with the surface that would break if revoked — he rules
per function. Prepare: function name · what it writes · the public surface that calls it (grep the call
site) · recommendation."*

**One row per anon-executable non-trigger WRITER**, columns exactly: `function(signature)` · `writes`
(tables) · `internal guard` (`has_staff_access()` / `auth.uid()` / org fence / **none**) · `call sites`
(`grep -rn "rpc('<name>'" src api` — every hit, file:line) · `anonymous surface?` (is any call site on a
route a logged-out person reaches — `/`, `/sign/*`, `/contact`, `/visit`, `/gift`, `/order/*`, the
public intake — name the route) · `recommendation` (REVOKE anon · KEEP anon BY DESIGN · **ASK** when a
surface would plausibly break).

**Group the rows so the owner rules in blocks, not 150 times:**
- **A — no call site at all, or callers only through `authenticated`/`service_role`:** recommendation
  REVOKE, ruled as one block. (Expect this to be most of the list.)
- **B — an anonymous surface calls it today:** one row each, with the route and what breaks if revoked.
  The sign-start writers (`sign_start_register_attempt` and whatever else `/sign/*` calls logged out) and
  the gift/redeem doors will land here — walk their call sites, do not guess.
- **C — `request_category_label`** is named public by the bundle but is NOT in MGMT's SECURITY DEFINER
  population; establish what it is (invoker? absent? renamed?) and say so in one line.
- **Already ruled by the handoff, listed for completeness, not for a ruling:** items 1, 2, 3, 5.

## 4. THE MIGRATION — shape, and what it must never do

- **ONE additive migration file**, `YYYYMMDDTHHMM_<sentence>.sql`, ACL statements only. **No `CREATE`,
  no `CREATE OR REPLACE`, no `DROP`, no body of any kind** — B2 FUNNELDEBT owns bodies. If the sweep shows
  a body needs a guard, that is a line in the handoff routed up, not a statement in this file.
- **Explicit roles, by full signature:** `REVOKE ALL ON FUNCTION public.f(sig) FROM PUBLIC, anon;` —
  and for item 5 only, `… FROM authenticated` as well on the two retired sign functions. Grant nothing
  new. Never touch `service_role` or `postgres`.
- 🔒 **Chunk it so the ruled work does not wait on the ruling.** Section 1 = items 1, 2, 3, 5 + group A
  (revoke-recommended, no anonymous caller) + the two zero-caller previews. Section 2 = group B, gated on
  the owner's per-function ruling. **Decide whether that is one migration with a commented Section 2 the
  build fills after the ruling, or two files — say why in the handoff.** MGMT's constraint: `-B` must be
  dispatchable the day the owner rules on block A even if block B is still open.
- **The proof, before and after, is the spec's THE TEST:** the `proacl` table for every touched function
  (pasted); `has_function_privilege('anon', …)` = **f** for every revoked one; = **t** still for
  `submit_public_request` and every KEEP-BY-DESIGN row; `md5(pg_get_functiondef(oid))` unchanged for every
  touched function (proves ACL-only); the rehearsal (`BEGIN … ROLLBACK`) output; then apply; then the
  same proof re-run immediately before the report (D35). Gates: `typecheck`, `typecheck:api`, `lint` at
  baseline — the comments are prose, so any drift is someone else's.

## 5. THE FIVE COMMENT EDITS — item 6, in the same build spec

Three texts are verbatim in D's report §2.4; the two Onboarding comments (`:97-111` block and `:615-625`
block) you write from the code: nothing sets `step = 'payment'` on either door (RECONCILED 1.13). **The
spec names each file:line and the exact replacement string. The build changes those lines and nothing
else in those files** (bundle ownership: "the five comment lines … nothing else in those files").

## 6. WHAT IS NOT YOURS
- Item 7 (CHANGE-ORDER-LEDGER status headers) — MGMT does it last, coordinated with ORCH. Do not spec it.
- Any function body. Any RLS policy. Any file beyond the five comment lines.
- Probing whether `anon` can *actually* execute a writer by calling it — probing writes production.
  `has_function_privilege` is the probe.
- The ruling itself. You recommend; MGMT summons; the owner rules.

## 7. THE TEST THIS TASK MUST PASS
1. The three files in §1 exist, and the spec is self-sufficient (DSNR-ROLE §"YOUR SPEC IS THE ONLY THING").
2. The sweep query and its full output are in your ledger — every one of the 326, classified, with the
   body evidence for each WRITER verdict.
3. Every row of the escalation list has a real `grep` result behind its call-site column (paste the grep).
4. Items 1, 2, 3, 5 each appear in the spec with their current `proacl` pasted from YOUR run, timestamped.
5. The handoff states the chunks, their disjointness, and model/effort per chunk.
6. `git diff --stat` on `task/grants-a-spec` touches only `docs/`.
7. TEARDOWN census; tree returned detached at `origin/main`, clean.

## MODEL AND EFFORT (for MGMT's dispatch line — you do not set these)
Opus · HIGH · thinking ON. Not Fable: the ground is a classification sweep on a known idiom, not a shape question.
