# FHE-TASK-RANCHWORD — LEDGER (DSNR profile: spec authoring for CR-108 / D43)

## RESUME
- **Opened:** 2026-09-02, on `main` at `b846b227`. Tree clean except `docs/reports/FHE-TASK-TACKROOM-LEDGER.md` (untracked — the live `FHE-TASK-TACKROOM` DISCO-profile thread on CR-109, read-only, no contention with anything here).
- **Subject:** CR-108 / D43 — every rendered "barn" adopts the tenant's word through `usePropertyTerm`; the Barn Ops module NAME is held for CR-109.
- **Profile:** DSNR (decisions — chunks + specs). Read-only against production. No build, no worktree.
- **Deliverables:** `docs/tasks/TASK-RANCHWORD-A-every-rendered-barn-says-what-it-means.md` · `docs/reports/FHE-DSNR-RANCHWORD-HANDOFF.md` · this ledger.
- **Status:** DONE — measurement complete, spec + handoff written. Next stop is ORCH (prompt in the handoff §7).
- **If this thread dies:** everything is in the two files above. Nothing is in flight.

## Measurements (all run 2026-09-02 by this thread on `b846b227` + prod, read-only)
- `grep -rn -i "\bbarn" src --include='*.tsx' --include='*.ts' | grep -v -i "barnops\|barn_ops\|BarnOps"` → **109 lines / 48 files**; every line classified in spec §2.
- `grep -rln usePropertyTerm src` → 19 consumer files + `BrandProvider.tsx`. (SITECOPY-B's report already corrected the "zero consumers" premise; re-confirmed.)
- prod `property_terms`: BARN · FACILITY · GROUNDS · RANCH · STABLES. `resolve_property_term(p_org)` reads `config_values(namespace='PROPERTY', key='TERM_KEY')`, falls back to FACILITY. Client default is RANCH (`src/lib/propertyTerm.ts:28-34`).
- prod `email_templates` with barn: `CALENDAR_DAY_SHEET` title + subject ("Today at the barn …"); `SUPPORT_RECEIVED` / `CALENDAR_OPS_DIGEST` / `REQUEST_RECEIVED` **description only**. `email_template_save_draft(p_email_key, p_subject, p_body)` — description is NOT owner-editable.
- prod `pg_proc` non-comment string literals containing barn: `dash_activity_readback` ('copy to the barn'), `feed_seed_welcome` ('moments from the barn'), `request_contract_termination` ('The barn has requested …'), `void_document` ('The barn' ×2), `resolve_consumption_billing` (RAISE text — barnops, held), `set_horse_locations` (jsonb keys, not copy). Eight more functions matched only inside `--` comments.
- prod `contract_clause_defs`: 2 rows carry `Barn Name: {{HORSE.BARN_NAME}}`. `contract_templates`: 10 bodies match — all either the horse-block "Barn Name:" label or the generic list "any ranch, barn, arena, stable, tack room …" / "barn aisles". `template_tokens`: 4 `HORSE.BARN_NAME` rows + `ORG.FOOTER_HTML` notes ("two barn-facing emails").
- prod data rows containing "the barn": `feed_account_items` 0 · `notifications` 0 · `documents` 0.
- `email_templates` triggers: `audit_email_templates`, `email_templates_set_updated_at` only — no versioning trigger on UPDATE.
- `organizations` has `name`; `resolve_property_term(uuid)` exists → both business-name and location-word are composable inside a DB function.

## Decisions (why each is in spec §3/§5, handoff §5)
1. **Two senses of "barn", two replacements.** LOCATION-sense → the property term (`usePropertyTerm` / `resolve_property_term`). BUSINESS-sense → NOT the property term: "how the ranch runs" / "the ranch has requested" would restate the misnomer D43 names (FHE does not run the ranch). Business-sense strings get the D38 word (**program**) or the org's own name, whichever the sentence needs.
2. **Zero LOCATION-sense strings remain in `src/`** — SITECOPY-B took all five. The `usePropertyTerm` adoptions this sweep produces are on the DB side (`feed_seed_welcome`) and in email data (`CALENDAR_DAY_SHEET`). Stated plainly in the spec rather than manufacturing adoptions.
3. **Barn Ops surfaces held whole for CR-109**, including their sentence copy, not only the name — CR-109 may re-lay those pages, and their "barn payer" means the BUSINESS payer, which is a finding CR-109 needs.
4. **Horse "Barn name" (nickname sense)** is a separate, already-ruled item (commit `3b46419f`, owner rejected the label twice) — the two REACHABLE survivors are included; the unreachable three are left per that commit's precedent. Contract-body "Barn Name:" is an equine-document convention, owner-editable (D13), left with an optional ASK-OWNER.
5. **Generic / client's-barn / vocabulary-list strings are left** and listed, with the reason each time.
6. **Data-only fixes go in one migration with `UPDATE`s; function fixes use `CREATE OR REPLACE` never `DROP`** (ACL trap, CLAUDE.md + memory) with an ACL assertion in the tests.

## Process census
- No background processes started. Six `psql` read-only sessions, all exited. No worktree opened.
