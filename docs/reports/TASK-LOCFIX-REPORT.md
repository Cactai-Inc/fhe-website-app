# TASK LOCFIX — lease Location section layout defects

Branch `task/locfix`, worktree `wt-locfix`, off `origin/main` @ `bd97df9`.

## Summary

Three reported defects, two distinct root causes, both traced to the same
mechanism: `ClauseDocument.tsx`'s `MATRIX_LINE` compact-cell layout (a
"`Label: {{token}}`" line rendered as a bold-label + value flex row) being
applied to clauses whose token is a multi-part `location`/`address`-format
field — a layout designed and correct for short scalar values (Breed, Color,
Barn Name…), wrong for a composite facility+street+city/state/zip value.

| Defect | Clause / field | Root cause | Fix | Status |
|---|---|---|---|---|
| 2 — address runs onto the label's line | `LOCATION.MAIN` / `HORSE.CURRENT_LOCATION` | Matrix-cell flex row lays a (possibly long) read-only value beside its label on one line | Template data: split clause body onto two lines | **DONE, applied to prod** |
| 1 — address input right-justified | `LOCATION.NEW` / `TXN.NEW_LOCATION` | Same matrix-cell flex row; the editable structured control's own full-width block is a flex-sibling of the bold label, so it's squeezed into whatever width the label leaves | `ClauseDocument.tsx` (FROZEN) — approved diff | **DONE, applied** |
| 3 — "Location during lease term" prints twice | `LOCATION.NEW` / `TXN.NEW_LOCATION` | Matrix cell prints its own bold label from the clause body's "Label:" text; `InlineFieldControl`'s structured branch ALSO prints the field's own label above the control — same text, twice | `ClauseDocument.tsx` (FROZEN) — same approved diff | **DONE, applied** |

## Mechanism, per defect

### Defect 2 — LOCATION.MAIN / HORSE.CURRENT_LOCATION

Clause body (live, before fix): `Location of the Horse: {{HORSE.CURRENT_LOCATION}}`
— a single line matching `ClauseDocument.tsx`'s `MATRIX_LINE` regex
(`/^([^{}:]{1,40}):\s*\{\{([A-Z0-9_.]+)\}\}\s*$/`). `HORSE.CURRENT_LOCATION`'s
token prefix (`HORSE.`) routes it through `renderToken`'s `isHorseImport`
branch — it never reaches `InlineFieldControl`; it renders as a plain
read-only `TokenValue` (owner directive 2026-08-03: imported record tokens are
locked/read-only, no self-label). The matrix cell's default rendering path
(`cell()` in `ClauseDocument.tsx`) lays the bold label and the value out as one
`flex items-baseline` row — correct for the short `HORSE.*` scalars this path
was built for, but this field is `format_type: 'location'` (a facility name +
full street/city/state/zip), so the value ran on beside the label instead of
starting below it.

Because the value has no self-label of its own (`TokenValue` doesn't echo a
label), there was no duplication risk here — only a line-break/positioning
fix was needed, so this was safely fixable as template data alone.

### Defects 1 & 3 — LOCATION.NEW / TXN.NEW_LOCATION

Clause body: `Location during lease term: {{TXN.NEW_LOCATION}}` — also matches
`MATRIX_LINE`. Unlike `HORSE.CURRENT_LOCATION`, `TXN.NEW_LOCATION` is a
genuinely editable field (`format_type: 'location'`, not `HORSE.`-prefixed),
so `renderToken` routes it to `InlineFieldControl`, whose structured branch
(format `location` is in the `isStructured` list) renders:
```
<span className="block clear-both w-full mt-3 mb-1.5 ml-0 pl-0">
  <span className="block text-[11px] text-muted mb-1">{label}{marks}</span>  {/* f.label = "Location during lease term" */}
  <FieldControl .../>                                                        {/* Facility / Street / City,State,ZIP rows */}
</span>
```
This is nested INSIDE the matrix cell's own row:
```
<div className="flex items-baseline gap-x-1.5 ...">
  <span className="font-semibold whitespace-nowrap">{c.label}:</span>        {/* "Location during lease term:" — SAME text as f.label above */}
  <span className="min-w-0 break-words">{...InlineFieldControl above...}</span>
</div>
```
Two consequences of this nesting:
- **Defect 3**: the field's own label and the matrix cell's bold label are the
  identical string, printed twice — once by each layer.
- **Defect 1**: the address block is a flex ITEM sibling of the (`nowrap`)
  bold-label item in a `flex-direction: row` container with no wrap. Its
  `clear-both`/`w-full` (meant for normal block flow, per the code's own
  comment) has no effect on flex-item sizing; it only gets whatever width
  remains after the label item, so the Facility/Street/City-State-ZIP rows
  render confined to the right portion of the line — reading as
  right-justified.

**Precedent**: this exact shape (matrix bold label + a structured self-labeling
control both printing the same text) was already hit and fixed once before,
for `week_grid` — `cell()` special-cases `week_grid` to skip the bold label
entirely and just render the token (`ClauseDocument.tsx` lines ~514-519,
comment: *"NO label here: the inline control renders its own label above the
grid, and printing the clause line's label too produced the doubled 'Reserved
days of use' heading."*). `location`/`address` formats were never added to
that same special case.

## Why the true fix could not be template-data-only for defects 1 & 3

I first checked whether restructuring the clause body (splitting off the
intro text, or restoring a trailing period to break the `MATRIX_LINE` match)
could fix this without touching `ClauseDocument.tsx`:

- **Splitting the body** (`"Location during lease term:\n{{TXN.NEW_LOCATION}}"`)
  still leaves the field's own label printed a second time by
  `InlineFieldControl`'s structured branch — moves the duplicate onto its own
  line instead of the same line, but doesn't remove it. Defect 3 explicitly
  requires REMOVAL, not repositioning.
- **Blanking the field's label** (`contract_field_defs.label = ''`) would
  remove the visual duplicate, but I traced `p_label` into
  `compose_field_prose()` (SQL): for `location`/`address` formats it's only
  used as the fallback name in `needs(coalesce(p_label,'location'))` — the
  missing-value placeholder shown when the field is unfilled
  (`⟦NEEDS:<label>⟧_____⟧`). `TXN.NEW_LOCATION` is not `required`, so an
  unfilled document can reach compose with this field blank; blanking the
  label would degrade that placeholder to `⟦NEEDS:⟧_____⟧`. That's a real,
  if narrow, behavior change outside pure layout — I stopped rather than
  apply it.
- **Restoring the clause body's trailing period** (its pre-2026-08-04 form)
  would break `MATRIX_LINE` matching, but migration
  `20260804020001_trailing_period_at_compose.sql` (R5, owner directive,
  2026-08-04) deliberately stripped trailing periods from ALL clause bodies
  template-wide, moving punctuation to compose-time specifically to fix an
  "orphan period under a full-width input" — the same failure family as this
  task. Re-adding one would contradict that directive and double the period
  at compose time. Ruled out.

With no side-effect-free template-data path available, the true fix is a
`ClauseDocument.tsx` change. Per the hard rule (frozen file → stop and
propose the minimal diff before applying), I presented the diff and it was
**approved** before I applied it.

## Fixes applied

### 1. Template data — `LOCATION.MAIN` (prod, `lrstswfxfsezdmvkvukc`)

New migration `supabase/migrations/20260805100000_locfix_location_of_horse_linebreak.sql`,
applied directly via psql (statement below) and recorded as a migration file
per repo convention:

```sql
UPDATE contract_clause_defs
   SET body = 'Location of the Horse:' || E'\n' || '{{HORSE.CURRENT_LOCATION}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'LOCATION.MAIN'
   AND body = 'Location of the Horse: {{HORSE.CURRENT_LOCATION}}';
```

Before/after (raw `contract_clause_defs.body`, via psql):
```
BEFORE: Location of the Horse: {{HORSE.CURRENT_LOCATION}}
AFTER:  Location of the Horse:
        {{HORSE.CURRENT_LOCATION}}
```
`UPDATE 1` — one row affected. Content-neutral: no field value, no
`contract_fields` row, touched. Composed/executed text unaffected beyond the
added line break (`remerge_contract_from_clauses` processes the body one line
at a time already, and appends terminal punctuation per-line at compose time
per R5 — verified by reading that function before applying this).

**Sarah's document (`704c8d2d-d179-43f9-8a4a-7ea8cb920ab9`, `HORSE_LEASE_V2`,
status `in_review`)**: the task doc anticipated needing a separate write to
her document's "per-document copy" of the clause. I verified no such copy
exists — `contract_template_structure(p_template_key)` (the RPC the editor
calls, in `src/lib/contracts.ts`) is keyed ONLY on `template_key`, with no
`document_id` join or per-document override table anywhere in the schema.
Clause body/heading text is always read live from the shared template row, so
the one `UPDATE` above reaches her document (and every other open
`HORSE_LEASE_V2` document) automatically. **Zero additional writes were made
to her document or any other document's fields.**

### 2. `ClauseDocument.tsx` (FROZEN — approved before applying)

`src/components/app/ClauseDocument.tsx`, in `cell()`, immediately after the
existing `week_grid` special case:

```tsx
if (wf && (wf.input_kind === 'week_grid' || wf.format_type === 'week_grid')) {
  return ( /* existing week_grid branch, unchanged */ );
}
/* TASK LOCFIX (2026-08-05): ... */
if (wf && !wf.field_key.startsWith('HORSE.')
    && (wf.format_type === 'location' || wf.format_type === 'address')) {
  return (
    <div key={j} className="w-full min-w-0 text-[13.5px] text-green-950">
      {renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}
    </div>
  );
}
```

Scoped by `format_type`, not by clause/field key — generic per the task's
instruction. The `!field_key.startsWith('HORSE.')` guard was necessary and
deliberate: it excludes `HORSE_SALE_V2`'s `Current Location` line in the
Horse Identity grid (also `format_type: 'location'`, but a `HORSE.*` read-only
import routed through `TokenValue`, which has no self-label — for that field
the matrix's bold label is its ONLY label, and this change must not remove
it). Verified: `TXN.NEW_LOCATION` is the only non-`HORSE.*`
`location`/`address`-format field anywhere in the schema
(`contract_field_defs` queried across all templates), so this diff currently
changes rendering for exactly one clause. Zero effect on the SQL composer
(`remerge_contract_from_clauses`) — it does its own line-by-line token
substitution independent of this React branch, so composed/executed document
text is unaffected.

## Where else this reproduces

`HORSE_SALE_V2`'s `HORSE.IDENTITY` clause has the same `HORSE.CURRENT_LOCATION`
field (`format_type: 'location'`) as ONE line among 11 packed into a single
compact Horse-identity grid (`Barn Name`, `Color`, `Markings`, … `Current
Location`). If that horse's current-location value is a long facility
address, the same "runs onto the label's line" symptom as defect 2 would
reproduce there. I did **not** touch it: unlike `LOCATION.MAIN`, this field
lives inside a dense multi-field grid, not a standalone clause — splitting it
onto its own two lines the way I did for `LOCATION.MAIN` would pull it out of
that grid and change the visual layout of the other 10 fields around it,
which is out of this task's scope (owner spec is specifically the lease's
Location section) and not "strictly needed" per the hard rules. A proper
fix there is the same shape as defects 1/3 — a `ClauseDocument.tsx` special
case for a long-value compact cell (similar to the existing `isLong`
longtext branch) — flagging as a follow-up for separate sign-off rather than
building it here.

## Proof

- `npm run typecheck` — clean, no errors.
- `npm run typecheck:api` — clean, no errors.
- `npm run lint` — **0 errors, 29 warnings** (matches documented baseline
  exactly).
- Before/after raw `contract_clause_defs.body` for `LOCATION.MAIN` — shown
  above, captured via direct psql query against prod before and after the
  `UPDATE`.
- `LOCATION.NEW`'s clause body was **not** modified — the `ClauseDocument.tsx`
  diff is the entire fix for defects 1 & 3; no before/after DB text applies.
- **UI is browser-pending** — this environment has no browser available;
  the fix has not been visually confirmed by loading the lease editor.

## Production writes (complete list)

1. `UPDATE contract_clause_defs SET body = ... WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.MAIN'` — 1 row, `LOCATION.MAIN` clause body line-break, applied via
   `supabase/migrations/20260805100000_locfix_location_of_horse_linebreak.sql`.

No other production writes were made. No field values, no `contract_fields`
rows, no document-level data, and no writes to Sarah's document were touched
at any point.

## Files changed

- `supabase/migrations/20260805100000_locfix_location_of_horse_linebreak.sql` (new)
- `src/components/app/ClauseDocument.tsx` (approved diff)
- `docs/BUILD_TRACKER.md` (new row A21)
- `docs/tasks/TASK-LOCFIX-location-layout.md` (copied in, per task instructions)
- `docs/reports/TASK-LOCFIX-REPORT.md` (this report)
