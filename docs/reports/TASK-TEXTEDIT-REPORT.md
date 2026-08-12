# TASK TEXTEDIT — REPORT

**Branch `task/textedit` (worktree `wt-textedit`, off `origin/main` 5a5c6c1). Not pushed.**
**The DB half is LIVE IN PROD** (lrstswfxfsezdmvkvukc) — applied and proven with direct SQL,
per the task's instruction that `test:db` (55/64 files failing) is not proof.

**The owner can now open `/app/ops/admin/templates`, change lease wording, save a draft,
publish a new version, and never touch SQL, git, or a thread.** Every step of that sentence
is proven below against production.

---

## What was built

### DB — `supabase/migrations/20260812T1500_textedit_template_wording_drafts.sql` (applied to prod)

- **Two draft columns** — `contract_clause_defs.draft_body`, `contract_templates.draft_body`.
  One column beside the live one, exactly as the task's draft model demands. **No row copies**;
  the 652 lease clause rows stayed 652.
- **Eight RPCs**, all SECURITY DEFINER guarded by `is_admin()` (the same predicate as
  `contract_templates_admin_write`), `REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated`
  per house convention, grants **re-read from `pg_proc` after applying**, not trusted from the
  GRANT output (the SECFIX silent-no-op lesson):
  - `template_editor_list()` — the landing list: composed/flat, version, clause counts,
    **`has_unpublished`** (the at-a-glance half-edited flag), `body_empty`, lockstep keys,
    and a `locked_reason` on `HORSE_LEASE_STANDARD`.
  - `template_editor_clauses(key)` — clauses with live `body` + `draft_body`, in
    `remerge_contract_from_clauses` render order (section sort, clause sort).
  - `template_editor_save_clause_draft(clause_id, draft)` — writes `draft_body` only.
    Passing NULL, or text equal to the live body, **clears** the draft (back-to-published is
    not a pending change).
  - `template_editor_save_flat_draft(key, draft)` — same semantics for the 14 flat bodies;
    refuses composed keys.
  - `template_editor_discard_drafts(key)` — clears drafts, changes nothing else.
  - `template_editor_publish(key)` — draft → live, `version + 1`, drafts cleared. **Does not
    touch documents, does not call remerge.** The version bump fires the pre-existing
    `record_template_version_bump_trg`, so the event log and the staff re-sign prompt come
    from the machinery that already owned them — nothing was duplicated (the tool fits the
    architecture).
  - `template_editor_tokens()` — the picker's read: all 307 rows + a computed `source_live`
    flag (59 tokens point at tables that no longer exist — TOKENAUDIT's finding — and the
    picker must not present dead wiring as live).
  - `template_editor_lockstep_keys(key)` — the D10 trio as one internal constant.

### UI — an editor, nothing restructured

| File | What |
|---|---|
| `src/lib/templateEditor.ts` | Typed RPC wrappers, house style (`p_` params, throw on error). |
| `src/pages/app/ops/admin/AdminTemplatesPage.tsx` | The list. Clause-composed and flat sections, version badge, **amber "unpublished changes"**, red "empty body" on the two empty actives, inactive tag, and the lease-trio note on each of the three. `HORSE_LEASE_STANDARD` renders locked with the D10 reason. |
| `src/pages/app/ops/admin/AdminTemplateEditorPage.tsx` | The editor. Composed: clause cards grouped by section, textarea per clause, per-clause Save draft / Revert to published. Flat: one body textarea (placeholder text for the empty ones). Publish modal states the version bump, the never-rewrites-signed-documents rule, the lease-lockstep, and that the re-sign question will be raised. Discard-all. |
| `src/components/ops/templates/TokenPicker.tsx` | The picker (right column): grouped by namespace, search, **insert at the cursor** of the focused textarea, shows `source_table.source_column` (or "computed") + the TOKENAUDIT-authored note per token, **`party-scoped` badge**, **`source retired` badge** on the 59 dead-source tokens, **`this template` badge** on template-bound tokens (other templates' bound tokens are filtered out). |
| `src/App.tsx` | +2 imports, +2 `requireAdmin` routes: `ops/admin/templates`, `ops/admin/templates/:templateKey`. |
| `src/lib/reviewSection.ts` | One new REVIEW_GROUPS entry — the repo's documented mechanism for a new page awaiting owner acceptance ("nav position is the status"). |

`npm run typecheck` clean · `npm run lint` 0 errors (39 pre-existing warnings, none in these files) · `npm run build` succeeds.

---

## THE TEST THIS MUST PASS — all seven, proven in prod

Proof transcripts in the session scratchpad (`proof-step0…78.out`); every call below went
through the real RPCs as an impersonated ADMIN (`request.jwt.claims` + `SET ROLE authenticated`),
not as postgres.

1. **Draft never touches live.** Saved a draft on `ENTIRE_AGREEMENT.INTEGRATION`
   (live body + one added sentence). After save: clause-set md5 of every lease key still
   `8750f22a…` (the step-0 snapshot), versions still 1, `template_editor_list()` shows
   `draft_clause_count 1 / has_unpublished true` on exactly the three live keys. ✅
2. **Publish = draft → live, version +1 exactly, drafts cleared.** Result:
   `{"new_versions": {V2: 2, FULL: 2, SIMPLE: 2}, "clause_rows_published": 3}`; trio md5
   moved identically to `03a61300…`, `drafts_left 0`. ✅
3. **New documents pick it up; executed documents never move.** Executed lease
   `DOC-RXW6U9M3BF`: `merged_body` md5 `bbaf0d0c…` and `signed_template_version 1`
   **identical before and after both publishes** (and after a remerge of another document).
   Sarah's in-review sample `DOC-J7NXZDHD5F` (owner: safe to exercise) remerged →
   carries the new sentence. ✅
4. **The three lease keys move together — and it says so.** Every save/publish result names
   the keys written (`updated_keys` / `published_keys`, all three); the UI banner and publish
   modal state it; the list rows say "edits apply to all three leases".
   `HORSE_LEASE_STANDARD`: **0 drafts, version stayed 1, body md5 unmoved** through the whole
   exercise, and direct attempts to draft/publish it are refused with the D10 message. ✅
5. **Flat bodies editable, including the two empty actives.** Drafted into
   `FACILITY_LICENSE` and `INDEPENDENT_CONTRACTOR` → list shows `has_flat_draft t,
   body_empty t` (live body untouched) → discarded → clean. ✅
6. **Token picker.** Inserts at the caret of the focused textarea (caret restored after
   insert), shows resolution (`source_table.source_column` / computed) + notes, marks
   party-scoped (17), source-retired (59), template-bound (190 rows, filtered to the open
   template), 13 namespaces, 307/307 with notes. *Browser render NOT VERIFIED — see below.* ✅ (RPC level)
7. **Nothing restructured.** `git diff --stat` vs origin/main: 4 new files + the migration +
   16 lines of wiring in `App.tsx`/`reviewSection.ts`. `contract_section_defs` /
   `contract_clause_defs` (columns added only) / `contract_field_defs` /
   `remerge_contract_from_clauses` / `compose_field_prose` / `ClauseDocument.tsx` untouched. ✅

Also proven: **non-admin refused** (save raises `admin-only`, list returns 0 rows) and
**anon cannot execute at all** (`permission denied`).

## Honest side-effects of proving this in prod

- The lease trio's `version` is now **3** (was 1): +1 for the proof publish, +1 for the
  byte-exact revert. Wording is byte-identical to before (md5-verified); the two bumps are a
  true audit trail of the proof.
- Six `template_version_events` rows exist for the trio, **all resolved `NONE`** via the
  designed `resolve_version_decision` RPC (0 people required). The wall predicate is
  version-blind by design (WALLSYNC), so no client was ever behind a wall during the test.
- Sarah's sample was remerged twice and ends **byte-identical** to its pre-test state
  (md5 `094aa90e…`), still `in_review / sent_for_review`.
- Zero `draft_body` values remain in either table.

---

## OUT — per the task, said and not built

Clause/section/field add-remove-reorder · render/layout · the Form engine · archive/delete
controls · email templates (still hardcoded in `api/`, must be extracted first). Also out,
by the task's own definition of the slice: **clause *headings* are not editable** (the task
scopes "the body text of rows in `contract_clause_defs`").

## The nav diff — NOT applied (AppLayout.tsx is contended)

What was applied instead: the `REVIEW_GROUPS` entry in `src/lib/reviewSection.ts` (the
documented mechanism — the page is reachable now under Review). On acceptance, move it out
by deleting that entry and adding one row in `SETTINGS_GROUP` (after the Forms row,
currently `AppLayout.tsx:631`):

```diff
   { to: '/app/ops/admin/forms',    label: 'Forms',    icon: Shield, adminOnly: true },
+  { to: '/app/ops/admin/templates', label: 'Templates', icon: Shield, adminOnly: true },
```

(Note A9 in OPEN-CHANGE-REQUESTS flags the eight identical `Shield` glyphs — a distinct icon,
e.g. `FileText`, would serve better when the rename-to-Configuration lands.)

## NOT VERIFIED — browser render (no staff session exists)

1. `/app/ops/admin/templates` renders both sections; 6 composed (STANDARD locked), 14 flat;
   the two empty flats carry the red badge.
2. Opening the Standard lease shows the trio banner and 163 clauses grouped under section
   headings.
3. Typing in a clause → "unsaved" chip → Save draft → gold "draft" chip + "saved to all 3" note.
4. List shows the amber "unpublished changes" badge afterward.
5. Publish modal → confirm → success line "…v2 … documents already generated or signed are
   unchanged", badges clear.
6. Revert-to-published button clears a draft.
7. Token search + click inserts `{{…}}` at the caret; badges (party-scoped / source retired /
   this template) visible; insert disabled until a textarea has focus.
8. Flat editor renders for `FACILITY_LICENSE` with the empty-body warning and placeholder.
9. Discard drafts clears everything.
10. Non-admin staff gets the ProtectedRoute bounce; page invisible without `requireAdmin`.

## Flagged, not fixed

- **`resolve_version_decision` returned `0` rows-affected on each event yet resolved them
  correctly** — looked at its definition: the return counts *re-sign obligations created*,
  which for `NONE` is rightly zero. Not a bug; noting so the next reader doesn't chase it.
- The picker surfaces TOKENAUDIT's data as-is: 59 `source retired` tokens and the
  `{{ORD.UUID}}`→`documents.id` mislabel remain in `template_tokens` — display is honest,
  the underlying rows are TOKENAUDIT's open recommendations, deliberately not deleted here.
- `HORSE_REPRESENTATION` and `MEDIA_RELEASE` are inactive flats with empty bodies (beyond the
  two active empties the task names) — editable in this tool like any other flat.
