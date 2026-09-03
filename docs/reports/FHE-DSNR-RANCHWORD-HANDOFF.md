# FHE-DSNR-RANCHWORD — HANDOFF TO ORCH

**From `FHE-TASK-RANCHWORD` (DSNR profile), 2026-09-02. Subject: CR-108 / D43.**
**Spec: `docs/tasks/TASK-RANCHWORD-A-every-rendered-barn-says-what-it-means.md`. Ledger:
`docs/reports/FHE-TASK-RANCHWORD-LEDGER.md` (all measurements, with the queries).**

## 1. The chunks, in dependency order
**One chunk: `FHE-TASK-RANCHWORD-A`.** Ten edits — 4 code literals, 4 `CREATE OR REPLACE` function
bodies (one string expression each), 1 data migration (5 `UPDATE`s), 1 `bodies.mjs` sync. Nothing
merges before it. Splitting code from DB would double the reach proofs for no isolation gain.

## 2. Contention I can see
- **None with live threads.** `FHE-TASK-TACKROOM` (DISCO profile, CR-109) is read-only and its subject
  — the Barn Ops surfaces — is exactly the directory this spec forbids (§5).
- **Files touched:** `src/App.tsx` (1 line), `src/pages/app/ops/ContactsPage.tsx`, `src/pages/app/CareHome.tsx`,
  `src/lib/horses.ts`, `scripts/emailextract/bodies.mjs`, `test/browser/probe-sitecopy-b.mjs`, two new
  migrations. `App.tsx` is the only file another thread is likely to want; the change is one literal.

## 3. Model and effort
**Opus · thinking ON · effort HIGH.** The work is small but it carries the ACL trap and four
SECURITY DEFINER function edits; HIGH buys the before/after discipline, MAX buys nothing here.

## 4. ASK-OWNER — most blocking first (none block the build)
1. *(optional, after the build)* `ContactsPage.tsx:77` says **"affiliated barns"** about OTHER
   businesses. Keep the industry word, or say "affiliated programs/stables"? Not guessed.
2. *(optional)* Contract bodies label the horse's nickname **"Barn Name:"** (2 clause defs, 3 template
   bodies) — the equine-document convention. You ruled "Nickname" for the Records column; do you want
   the contracts to follow? Owner-editable in the wording editor; executed documents stay as signed.

## 5. What I decided that CR-108 did not say
1. 🔒 **"Barn" has two senses here, and only one is the ranch.** Location-sense strings take the
   property term. Business-sense strings ("how the barn runs", "the barn has requested", "copy to the
   barn", "so the barn sees") do NOT — FHE does not run the ranch, so "the ranch has requested" restates
   the misnomer D43 names. They take D38's word (**program**) or the org's own name.
   **Consequence you should know:** there are ZERO location-sense strings left in `src/` — SITECOPY-B
   took all five — so this sweep's `usePropertyTerm`-family adoptions are on the DB side
   (`feed_seed_welcome` via `resolve_property_term`) and in email data. The brief's "every rendered barn
   adopts through usePropertyTerm" is true of the location sense and empty of the rest.
2. **Barn Ops is held WHOLE for CR-109 — sentence copy included, not only the name.** Its "barn payer"
   is the BUSINESS payer, which CR-109 needs to rule on; renaming that copy now is waste or wrong.
3. **The horse "barn name" (nickname) sense is folded in** — two reachable survivors of the 2026-08-24
   ruling (commit `3b46419f`), same fixed word "Nickname". Unreachable ones stay, per that commit.
4. **`CALENDAR_DAY_SHEET`'s "Today at the barn" becomes a hardcoded "ranch"** by data `UPDATE`. The
   tenant-neutral fix is an `ORG.PROPERTY` email token — a mechanism, v2 debt (below).
5. **Descriptions and token notes are ours, not the owner's** — `email_template_save_draft` takes
   subject+body only, so D13 does not cover them; they go in the migration, and `bodies.mjs` in the same
   commit so `diff.mjs` keeps proving.

## 6. Shape needing the owner's eyes before build
**None.** No new page, state, or layout — ten sentences.

## 7. Debt recorded, not built
- **`ORG.PROPERTY` (+ article/preposition variants) as an email token**, so subjects like the day sheet
  resolve per tenant. Today `api/_lib/emailTemplates.ts` knows `ORG.BRAND_NAME` only.
- **Comments and identifiers still say "barn"** (`barnToday`, `BARN_TZ`, ~60 comment lines). Harmless,
  deliberately left so the diff shows the ten real edits.

## 8. The prompt for ORCH to hand out

**Opus · thinking ON · effort HIGH.**
```
FHE-TASK-RANCHWORD-A

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/tasks/TASK-RANCHWORD-A-every-rendered-barn-says-what-it-means.md and build it.
```
