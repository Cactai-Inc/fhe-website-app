# FLAGHARVEST part 5 — unviewed inventory, artifacts 48–57

Read-only pass. Nothing changed. Nothing recommended for deletion.
Worktree `/Users/Cactai/Downloads/claude-code-repo/wt-flagharvest`, prod DB `lrstswfxfsezdmvkvukc`, 2026-08-13.

---

## 48. PageHeader aria-label fallback (src/components/app/PageHeader.tsx:88)
- reported by: docs/reports/TASK-ADDNEW-REPORT.md [docs/reports/flagharvest-work/batch4.md#66]
- reachability: **verified unreachable — no gate, an unused BRANCH.** The fallback is the `: undefined` arm of the ternary at `src/components/app/PageHeader.tsx:88`. It runs only when a caller passes `onAdd` WITHOUT `addLabel`. Grep over all of `src/` finds exactly five call sites that pass `onAdd` into `PageHeader`/`PageLayout`, and **all five pass `addLabel`**:
  - `src/pages/app/CareHome.tsx:36-37` → `addLabel="horse"`
  - `src/pages/app/ops/HorseRecordsPage.tsx:233-234` → `addLabel="horse"`
  - `src/pages/app/Admin.tsx:789-790` → `addLabel="client"`
  - `src/pages/app/ops/DealsPage.tsx:232-233` → `addLabel="deal"`
  - `src/pages/app/ops/ContactsPage.tsx:284-285` → `addLabel={MODE_COPY[mode].newLabel}`
  (`MODE_COPY` at `src/pages/app/ops/ContactsPage.tsx:53` defines `newLabel` for every `DirectoryMode` — `'directory entry'`, `'lead'`, `'contact'`, `'vendor'`, … — so it is never undefined.)
  The other `onAdd=` grep hits (`src/components/OfferingCatalog.tsx:118/128/133/178`, `src/components/app/PartiesHorseCard.tsx:101/104/107/156/167/169`) are DIFFERENT components with their own unrelated `onAdd` prop, not `PageHeader`.
- exists: yes
- content:

The fallback, and the button's every user-visible copy string (visible text is the literal `Add New`; there is no other string in the control):

```tsx
export function PageHeader({ name, title, description, onAdd, addLabel }: {
  /** The gold eyebrow — what this page IS. Short, it gets uppercased. */
  name: string;
  /** The large green line — a message to the reader, NEVER a repeat of `name`.
   *  OPTIONAL, and deliberately so: TASK-TITLESWEEP holds draft-approved copy for
   *  the user pages only. Ops pages have none, and inventing a conversational
   *  line per page is exactly the improvisation that task forbids. A page with no
   *  approved copy renders name + description and reads fine; TITLESWEEP fills
   *  the titles in later without touching layout. */
  title?: string;
  description?: ReactNode;
  /** Omit to render no control; the row still holds the page name. */
  onAdd?: () => void;
  /** Required whenever `onAdd` is given: the object noun, e.g. "horse", not a
   *  full sentence. Composed into the accessible name as "Add New {addLabel}". */
  addLabel?: string;
}) {
  return (
    <header className="mb-8">
      {/* Row 1 — page name left, control top-right, bottoms aligned.
          min-h matches the control so pages WITHOUT one keep the same rhythm
          as pages with one; otherwise the title would ride up on those pages
          and the drift this component exists to fix would come back. */}
      <div className="flex items-end justify-between gap-4 min-h-[40px] mb-3">
        <p className="eyebrow">{name}</p>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={addLabel ? `Add New ${addLabel}` : undefined}
            className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring"
          >
            <Plus size={16} aria-hidden="true" />
            Add New
          </button>
        )}
      </div>

      {title && <h1 className="heading-section text-green-800">{title}</h1>}

      {description && (
        <p className={`body-text text-muted max-w-2xl ${title ? 'mt-3' : ''}`}>{description}</p>
      )}
    </header>
  );
}
```

The file's own header comment states the intent — the unreachable arm is documented as deliberate future headroom (lines 47–57):

```
 * ACCESSIBLE NAME — resolution 1 of the two TASK-ADDNEW named as compliant
 * with WCAG 2.5.3 Label in Name: the accessible name must CONTAIN the visible
 * text. Visible text is always "Add New"; `addLabel` is now the OBJECT NOUN
 * being added ("horse", "client", "deal" — not a full sentence), composed as
 * `aria-label="Add New {addLabel}"`. That keeps "Add New" as an exact prefix
 * of the accessible name (satisfying 2.5.3) while a screen-reader user still
 * hears which page they're on, which an app-wide "Add New" with no context
 * would not give them. Omitting `addLabel` falls back to the visible text
 * alone as the accessible name (resolution 2) — no page in this app does that
 * today, but the type stays optional for a page with nothing more specific to
 * say.
```

---

## 49. listContractTemplates() (src/lib/api.ts:1161)
- reported by: docs/reports/TASK-ONEAUTHOR-REPORT.md:263 [docs/reports/flagharvest-work/batch4.md#67]
- reachability: **verified unreachable — zero callers, no gate involved.** Repo-wide grep for `listContractTemplates` (excluding `node_modules`) returns exactly ONE code hit: its own definition at `src/lib/api.ts:1161`. Every other hit is a report file (`docs/reports/TASK-ONEAUTHOR-REPORT.md:263`, `docs/reports/flagharvest-work/slice-CONTRACT-A.md:773-776`, `docs/reports/flagharvest-work/batch4.md:890-893,1293-1295`). No import, no re-export, no dynamic reference. The one template picker in the app — `src/pages/app/ops/NewContractPage.tsx:6,107,240` — imports and calls `listLeaseTemplates()` instead.
- exists: yes (the report cites `:1093`; it has drifted to `:1161` — same function, file grew)
- content:

```ts
// ─── Contracts: templates & documents ────────────────────────────────────

export async function listContractTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('active', true)
    .is('deleted_at', null)
    .order('title');
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}
```

The live sibling that displaced it, immediately below in the same file (`src/lib/api.ts:1173-1189`):

```ts
/** LEASEFORK: the selectable lease versions, for the picker on New contract.
 *  `contract_kind` is what groups lease templates — HORSE_LEASE_V2 plus the
 *  HORSE_LEASE_STANDARD / _FULL / _SIMPLE forks. The active + not-deleted filter
 *  is what keeps the retired flat `HORSE_LEASE` template out of the list, and it
 *  mirrors the validation start_lease_contract_v2 applies server-side, so the UI
 *  cannot offer a template the RPC would reject. */
export async function listLeaseTemplates(): Promise<ContractTemplate[]> {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .eq('contract_kind', 'HORSE_LEASE')
    .eq('active', true)
    .is('deleted_at', null)
    .order('title');
  if (error) throw error;
  return (data ?? []) as ContractTemplate[];
}
```

Grep proof:

```
$ grep -rn "listContractTemplates" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md" . | grep -v node_modules
docs/reports/flagharvest-work/slice-CONTRACT-A.md:773:- item: Found not fixed — listContractTemplates() (src/lib/api.ts:1093) has no callers; dead read path, not deleted.
docs/reports/flagharvest-work/slice-CONTRACT-A.md:774:- quote: "**`listContractTemplates()` (`src/lib/api.ts:1093`) has no callers.** ..."
docs/reports/flagharvest-work/slice-CONTRACT-A.md:776:- artifacts: listContractTemplates() (src/lib/api.ts:1093)
docs/reports/flagharvest-work/batch4.md:890:  ... (same, report text)
docs/reports/flagharvest-work/batch4.md:1293:- what: listContractTemplates() has no callers — dead read path, not deleted.
docs/reports/TASK-ONEAUTHOR-REPORT.md:263:2. **`listContractTemplates()` (`src/lib/api.ts:1093`) has no callers.** The only template
src/lib/api.ts:1161:export async function listContractTemplates(): Promise<ContractTemplate[]> {
```

One definition, zero call sites.

---

## 50. HORSE_LEASE_FULL / HORSE_LEASE_SIMPLE / HORSE_LEASE_STANDARD + FlatDocument.tsx (contract_templates rows + src/components/app/FlatDocument.tsx)
- reported by: docs/reports/TASK-ONEAUTHOR-REPORT.md [docs/reports/flagharvest-work/batch4.md#69]
- reachability: **two different answers, verified.**
  - **The three lease forks are NOT unreachable — they are OFFERABLE.** `HORSE_LEASE_FULL` and `HORSE_LEASE_SIMPLE` are `active = t`, `deleted_at IS NULL`, `contract_kind = 'HORSE_LEASE'`, so `listLeaseTemplates()` (`src/lib/api.ts:1180`) returns them and they render as `<option>` in the New-contract picker at `src/pages/app/ops/NewContractPage.tsx:240`. They simply carry **zero documents**. `HORSE_LEASE_STANDARD` is the one that IS gated off: `active = f` in prod, so the `.eq('active', true)` filter at `src/lib/api.ts:1183` drops it from the picker, and the editor shows it locked via `template_editor_list`'s hard-coded `CASE WHEN t.template_key = 'HORSE_LEASE_STANDARD' THEN 'Archived (D10) — edit the Standard lease (HORSE_LEASE_V2) instead' END AS locked_reason`, rendered as a non-clickable `<div>` with a Lock icon at `src/pages/app/ops/admin/AdminTemplatesPage.tsx:56-62`. This state is the settled D10 ruling (CLAUDE.md), not drift.
  - **FlatDocument.tsx IS reachable and live**, gated by `!structure`: `src/pages/app/ContractPage.tsx:1948`. `structure` is set null when `contract_template_structure()` returns zero sections (`src/pages/app/ContractPage.tsx:529`). The three lease forks all have 22 section defs, so they never take this branch — FlatDocument serves the 14 flat templates instead.
- exists: yes — all four rows present in prod, `src/components/app/FlatDocument.tsx` present (71 lines)
- content:

**md5 / length comparison, live from prod (`contract_templates` + document counts + clause/section defs):**

```
      template_key      |                    title                     | contract_kind | active | not_deleted | version | body_len |             body_md5             | docs_live | docs_all | clause_defs | section_defs
------------------------+----------------------------------------------+---------------+--------+-------------+---------+----------+----------------------------------+-----------+----------+-------------+--------------
 HORSE_LEASE            | Horse Lease Agreement                        | HORSE_LEASE   | f      | f           |       1 |    18253 | c0ccb0380dc965b99b866db5f7bac38b |         0 |        0 |           0 |            0
 HORSE_LEASE_FULL       | Horse Lease Agreement — Detailed             | HORSE_LEASE   | t      | t           |       3 |       23 | af2572690e946d4358edd01d3eef3dce |         0 |        0 |         163 |           22
 HORSE_LEASE_SIMPLE     | Horse Lease Agreement — Simple               | HORSE_LEASE   | t      | t           |       3 |       23 | af2572690e946d4358edd01d3eef3dce |         0 |        0 |         163 |           22
 HORSE_LEASE_STANDARD   | Horse Lease Agreement — Standard             | HORSE_LEASE   | f      | t           |       1 |       23 | af2572690e946d4358edd01d3eef3dce |         0 |        0 |         163 |           22
 HORSE_LEASE_V2         | Horse Lease Agreement — Standard             | HORSE_LEASE   | t      | t           |       3 |       23 | af2572690e946d4358edd01d3eef3dce |         6 |        6 |         163 |           22
```

The 23-byte `body` is a placeholder, identical across all four clause templates:

```
$ psql … -tAc "select 'BODY[' || body || ']' from contract_templates where template_key='HORSE_LEASE_V2';"
BODY[(composed from clauses)]
```

**So `body` md5 identity proves nothing on its own — the real wording lives in `contract_clause_defs`. Fingerprinting THAT confirms byte-identity for real:**

```
$ psql … -c "select template_key, count(*) as clauses,
             md5(string_agg(clause_key||'|'||coalesce(heading,'')||'|'||coalesce(body,'')||'|'||clause_type||'|'||sort_order||'|'||is_optional||'|'||coalesce(conditional_on::text,''), E'\n' order by clause_key)) as clause_fingerprint
             from contract_clause_defs where template_key like 'HORSE_LEASE%' group by template_key order by template_key;"

     template_key     | clauses |        clause_fingerprint
----------------------+---------+----------------------------------
 HORSE_LEASE_FULL     |     163 | 6e4878065de55ec1464f9391b8fa6172
 HORSE_LEASE_SIMPLE   |     163 | 6e4878065de55ec1464f9391b8fa6172
 HORSE_LEASE_STANDARD |     163 | 6e4878065de55ec1464f9391b8fa6172
 HORSE_LEASE_V2       |     163 | 6e4878065de55ec1464f9391b8fa6172
```

All four are byte-identical across all 163 clauses, key/heading/body/type/order/optionality/conditional. Note `_V2`, `_FULL` and `_SIMPLE` have all reached **version 3** (the TEXTEDIT lockstep publishes), while `_STANDARD` sat out at v1 — it is not in the lockstep set.

**FlatDocument.tsx — the whole file (render section + every user-visible copy string):**

```tsx
import { useState } from 'react';
import { ContractBody } from './ContractCascade';

/**
 * FLAT DOCUMENT — the body renderer for a document with no clause structure.
 *
 * TASK ONEAUTHOR. The one authoring page keeps everything AROUND the document —
 * drawers, history, parties, send, signing — and chooses only the body renderer:
 *
 *   structure present → <ClauseDocument>   (fields, clauses, Add New Item)
 *   structure null    → <FlatDocument>     (this: read/verify the composed text)
 *
 * `ContractPage.tsx:498` already produced that null: `contract_template_structure`
 * returns zero sections for a flat template and the page stores null. What was
 * missing was a renderer that occupies the same slot. Fourteen of the twenty
 * active templates are flat, so this is the majority case, not the fallback.
 *
 * It is READ-ONLY BY CONSTRUCTION, and that is a property of the document rather
 * than a decision made here: a flat template has no `contract_field_defs`, so
 * there is nothing to author. Any field a flat document does carry is rendered by
 * the page's own grouped-field sections ABOVE this — fill the fields, then read
 * what they composed.
 *
 * It reuses `ContractBody`, the SAME renderer the read-only and executed frames
 * use, so one document does not change appearance as it moves through its states.
 * (`MergedBodyView` in components/ops/documents is the other renderer in the
 * codebase; it styles signature lines but not the `NEEDS:` marks that tell an
 * author what is still unfilled, so it is the weaker of the two here.)
 *
 * COLLAPSIBLE, EXPANDED BY DEFAULT. A release runs to 12,000 characters and can
 * push the signature block off the bottom of a long page, so it folds — but it
 * opens showing the document, because you sign what you see.
 */
export function FlatDocument({
  body, title, defaultOpen = true,
}: {
  body: string | null;
  /** The document's own name, so the disclosure reads as the document rather
   *  than as a generic "Review the document text" control. */
  title?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Nothing composed yet. Say so plainly rather than rendering an empty frame —
  // a card around nothing is the same defect as a drawer that can never fill.
  if (!body || !body.trim()) {
    return (
      <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
        <p className="text-sm text-muted">
          This document has no composed text yet. It appears once the document is generated.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
      <button type="button" aria-expanded={open}
        className="font-serif text-green-800 underline-offset-4 hover:underline"
        onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} {title?.trim() || 'the document'}
      </button>
      {open && (
        <div className="document-paper mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-green-950">
          <ContractBody body={body} />
        </div>
      )}
    </section>
  );
}
```

User-visible copy strings: `This document has no composed text yet. It appears once the document is generated.`, and the disclosure label `Hide {title}` / `Show {title}`, falling back to `the document`.

**The null-structure branch condition that gates it — `src/pages/app/ContractPage.tsx:1939-1950`:**

```tsx
      {/* …and the OTHER half of the one body slot: a document with no clause
          structure. It renders HERE, immediately after any flat field sections, so
          the reading order is fill-then-read; all fourteen flat templates carry
          zero field defs, so in practice it lands in exactly the position
          <ClauseDocument> occupies for the six clause-composed ones.

          Same visibility rule as the clause branch above, so neither renderer can
          appear while the read-only merged frame (below) or the executed frame is
          showing the same text. This REPLACES the old collapsible "Review the
          document text" block that used to sit further down the page. */}
      {state !== 'executed' && !showHorseGate && !readOnlyDoc && !structure && (
        <FlatDocument body={doc.merged_body} title={doc.title} />
      )}
```

And where `structure` becomes null — `src/pages/app/ContractPage.tsx:517-533`:

```tsx
  /* ONE FETCH, TWO ANSWERS (TASK ONEAUTHOR).
     contract_template_structure() returns the clause structure AND the template's
     surface configuration. Zero sections → `structure` is null, which is the flat
     branch; the config lands either way.
     Every failure path falls back to the PERMISSIVE default rather than hiding
     surfaces: a lookup that did not answer must not be read as "this document has
     no drawers". */
  const templateKey = doc?.template_key ?? null;
  useEffect(() => {
    if (!templateKey) { setStructure(null); setTemplateConfig(DEFAULT_TEMPLATE_CONFIG); return; }
    contractTemplateStructure(templateKey)
      .then((s) => {
        setStructure(s.sections.length > 0 ? s : null);
        setTemplateConfig(s.config ?? DEFAULT_TEMPLATE_CONFIG);
      })
      .catch(() => { setStructure(null); setTemplateConfig(DEFAULT_TEMPLATE_CONFIG); });
  }, [templateKey]);
```

---

## 51. FACILITY_LICENSE and INDEPENDENT_CONTRACTOR templates (contract_templates rows)
- reported by: docs/reports/TASK-ONEAUTHOR-REPORT.md:256-261 [docs/reports/flagharvest-work/batch4.md#70]
- reachability: **the "ACTIVE and SELECTABLE" half of the claim is now WRONG for document creation, and the owner should read this before treating it as a live footgun.** Verified three ways:
  1. **Not assignable.** `staff_assignable_templates(contact)` — the RPC behind the only staff "assign documents" UI (`src/components/app/ClientRecordActions.tsx:88` → `src/lib/admin.ts:194` → `staff_assign_documents`) — filters `AND ct.body IS NOT NULL`. Both rows have `body IS NULL` (not `''`), so both are excluded. Proven live: `select template_key from staff_assignable_templates(<a live contact>) where template_key in ('FACILITY_LICENSE','INDEPENDENT_CONTRACTOR')` → **(0 rows)**. And `staff_assign_documents` re-checks the same view and raises `'template % is not assignable (inactive, clause-engine, or not the current version)'`, so the RPC refuses them too.
  2. **Not offerable in the New-contract picker.** That picker calls `listLeaseTemplates()` (`src/lib/api.ts:1180`), which filters `contract_kind = 'HORSE_LEASE'`. Both rows have `contract_kind` NULL.
  3. **Not offerable on a deal.** `DealPage.tsx:236` renders from `deal_document_status` → `deal_template_options`, which is a hard-coded VALUES list of exactly three keys (`HORSE_BILL_OF_SALE`, `HORSE_SALE_V2`, `HORSE_LEASE_V2`).
  Also confirmed: `select * from contract_requirements where template_key in (…)` → **(0 rows)**, so nothing auto-assigns them either.
  **Where they ARE still visible:** the admin Templates editor list, `template_editor_list()` (gated `AND is_admin()`), rendered at `src/pages/app/ops/admin/AdminTemplatesPage.tsx:110-115` in the "Flat — one body of text" group. That surface already flags them explicitly with a red `empty body` badge (`AdminTemplatesPage.tsx:36-40`), so the condition is visible to the owner rather than silent. **Judgement: this is unreviewed inventory that the system already refuses to generate from — not an armed footgun today.**
- exists: yes, both rows live in prod
- content:

Full SELECTed rows:

```
$ psql … -x -c "select template_key, title, short_label, service_type, contract_kind, party_namespaces, active,
                deleted_at, version, wall_gating, companion_template_key,
                coalesce(length(body),-1) as body_len, coalesce(length(draft_body),-1) as draft_len,
                body, allows_co_buyer
                from contract_templates where template_key in ('FACILITY_LICENSE','INDEPENDENT_CONTRACTOR');"

-[ RECORD 1 ]----------+---------------------------------------------
template_key           | INDEPENDENT_CONTRACTOR
title                  | Independent Contractor Agreement
short_label            | Contractor agreement
service_type           | INDEPENDENT_CONTRACTOR
contract_kind          |
party_namespaces       | {CONTRACTOR,COMPANY}
active                 | t
deleted_at             |
version                | 1
wall_gating            | f
companion_template_key |
body_len               | -1        <-- -1 means body IS NULL (not '')
draft_len              | -1
body                   |
allows_co_buyer        | f
-[ RECORD 2 ]----------+---------------------------------------------
template_key           | FACILITY_LICENSE
title                  | Facility Use and Business Operations License
short_label            | Facility use license
service_type           |
contract_kind          |
party_namespaces       | {OWNER,COMPANY}
active                 | t
deleted_at             |
version                | 1
wall_gating            | f
companion_template_key |
body_len               | -1        <-- body IS NULL
draft_len              | -1
body                   |
allows_co_buyer        | f
```

Clause-def / section-def / document counts (from the same live query as artifact 50):

```
      template_key      | active | body_len | docs_live | docs_all | clause_defs | section_defs
------------------------+--------+----------+-----------+----------+-------------+--------------
 FACILITY_LICENSE       | t      |        0 |         0 |        0 |           0 |            0
 INDEPENDENT_CONTRACTOR | t      |        0 |         0 |        0 |           0 |            0
```

(`body_len` reads 0 under `coalesce(length(body),0)` and -1 under `coalesce(length(body),-1)` — the column is NULL. That NULL is precisely what the assignable-templates guard keys on.)

The guard that excludes them, `staff_assignable_templates()` prosrc (prod):

```sql
  SELECT ct.template_key, ct.title, ct.version, ct.wall_gating,
         CASE WHEN d.id IS NULL THEN 'none'
              WHEN d.current_status = 'superseded' THEN 'superseded'
              ELSE 'executed' END,
         d.exec_date, d.version
    FROM contract_templates ct
    LEFT JOIN LATERAL (
      SELECT dd.id, dd.current_status, dd.created_at::date AS exec_date, ct2.version
        FROM documents dd JOIN contract_templates ct2 ON ct2.id = dd.template_id
       WHERE dd.contact_id = p_contact_id AND dd.deleted_at IS NULL
         AND dd.status = 'EXECUTED' AND ct2.template_key = ct.template_key
       ORDER BY (dd.current_status IS DISTINCT FROM 'superseded') DESC, dd.created_at DESC
       LIMIT 1
    ) d ON true
   WHERE has_staff_access()
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.body IS NOT NULL                                          -- <<< the exclusion
     AND NOT EXISTS (SELECT 1 FROM contract_section_defs s WHERE s.template_key = ct.template_key)
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key AND x.active AND x.deleted_at IS NULL)
   ORDER BY ct.wall_gating DESC, ct.title;
```

The one UI code path that DOES surface them — `src/pages/app/ops/admin/AdminTemplatesPage.tsx`, with the empty-body warning already in place:

```tsx
          {t.body_empty && !t.is_composed && (
            <span className="text-[10px] tracking-wide uppercase px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
              empty body
            </span>
          )}
        </span>
        <span className="block text-[12px] text-muted mt-0.5">
          {t.is_composed ? `${t.clause_count} clauses` : 'Single body'}
          {draftNote ? ` · ${draftNote}` : ''}
          {t.lockstep_keys.length > 1 && !locked ? ' · edits apply to all three leases' : ''}
          {locked ? ` · ${t.locked_reason}` : ''}
        </span>
```

Note the badge's own predicate is `coalesce(t.body,'') = ''` inside `template_editor_list` — so it fires for a NULL body too. The row opens to `/app/ops/admin/templates/{template_key}`, i.e. the owner can author a body into either one from the UI without a migration (D13-compliant).

The report's original wording, for the record (`docs/reports/TASK-ONEAUTHOR-REPORT.md:256-261`):

```
1. **Two active templates compose an empty document.** `FACILITY_LICENSE` and
   `INDEPENDENT_CONTRACTOR` are `active = true`, selectable, and carry **`body = ''` and zero
   clause defs**. A document generated from either would have no text. Zero documents exist from
   both, so nothing is broken today. `FlatDocument` degrades honestly rather than rendering an
   empty frame — it says *"This document has no composed text yet"*. **These are also two of the
   four templates I recommend converting first**, which would resolve it.
```

---

## 52. Shelved CardstockHeader (docs/reference/shelved-cardstock-header/)
- reported by: docs/reports/TASK-ONEHEADER-REPORT.md [docs/reports/flagharvest-work/batch4.md#71]
- reachability: **verified unreachable — the two source files no longer live under `src/`, so nothing can import them.** The claim's paths (`src/components/app/CardstockHeader.tsx`, `src/components/app/header-cardstock.css`) do NOT exist; the files were moved to `docs/reference/shelved-cardstock-header/` with a `.txt` suffix, which is outside every tsconfig include, outside vite's module graph, and outside tailwind's content globs (`./src`, `./index.html`), so the CSS emits nothing. Grep across `src/`, `index.html` and `public/` for `CardstockHeader`, `header-cardstock` or `header-stock` returns **only comments** — zero imports, zero `url()` references:
  - `src/components/app/ContractSubheader.tsx:13` — comment
  - `src/components/app/AppLayout.tsx:1743` — comment
  - `src/components/app/PageCreateButton.tsx:7` — comment
  The texture `public/header-stock.jpg` is still shipped by the build (it is in `public/`) but is referenced by nothing, because the only `url('/header-stock.jpg')` calls are inside the shelved `.txt`.
- exists: yes — shelved, not deleted
- content:

Files on disk:

```
$ ls -la docs/reference/shelved-cardstock-header/
-rw-r--r--  1 cactai  staff   8434 Aug 12 15:15 CardstockHeader.tsx.txt
-rw-r--r--  1 cactai  staff   2516 Aug 12 15:15 README.md
-rw-r--r--  1 cactai  staff  27066 Aug 12 15:15 header-cardstock.css.txt      (532 lines)

$ ls -la public/header-stock.jpg
-rw-r--r--  1 cactai  staff  493554 Aug 12 15:15 public/header-stock.jpg

$ file public/header-stock.jpg
public/header-stock.jpg: JPEG image data, JFIF standard 1.01, aspect ratio, density 72x72,
segment length 16, Exif Standard: [TIFF image data, big-endian, direntries=1], baseline,
precision 8, 3000x773, components 3
```

**The jpg is confirmed present: 493,554 bytes, 3000×773 px, baseline JPEG.**

**README.md — verbatim, in full:**

````markdown
# Shelved: the cardstock header

**Shelved 2026-08-08, not deleted.** Owner: *"the green header is cool and I love it but it's
got to go. We can save it for another time when we can colour-match the entire site to it."*

## What is here

| file | restore to |
|---|---|
| `CardstockHeader.tsx.txt` | `src/components/app/CardstockHeader.tsx` |
| `header-cardstock.css.txt` | `src/components/app/header-cardstock.css` |

The texture asset **`public/header-stock.jpg` was left in place** (493KB) — it is referenced
only by this CSS, and leaving it means a restore is two file copies with no asset hunt.

## To restore

1. Copy both files back, dropping the `.txt` suffix.
2. Confirm `header-cardstock.css` is imported (it was imported from `AppLayout.tsx`).
3. Check `--cs-hdr-h` still matches what the rails, contract subheader and drawer tab expect
   — they read it for their sticky offsets.

That is the whole restore. Nothing else was entangled with it.

## Why it was shelved, and what has to change before it returns

**The app was two backdrops.** A dark cardstock header above a near-white page meant the
translucent nav panel composited against both at once, and no single label colour is legible
across both. Measured:

```
green-800/20 over the cream page   -> #c8cac0   hue  73deg   (yellow-green)
green-800/20 over the dark header  -> #1a2d23   hue 147deg   (green)
```

**The page is warm (hue 37°), so mixing green into it rotates the hue 72° toward yellow.**
That is why the nav read as washed out — not paleness, a different colour. Over a dark
backdrop the hue barely moves, which is why glass works there and cannot work over cream.

**So this header does not come back on its own.** It returns when the site is colour-matched
to it — meaning the page surfaces move toward the header's darkness, or the header's family
becomes the app's, rather than one dark band sitting on a light app.

## What is genuinely good here and should not be lost

The wordmark, monogram and avatar are **debossed relief** — layered `text-shadow` carving the
letters into the stock texture, with the avatar pressing on hover and click. It was tuned
over several sessions (the "5c" shadow values, the press depth, the ~36px threshold below
which relief stops resolving on mobile).

**Relief needs a mid-tone surface to carve into.** It cannot be ported onto glass — on a
translucent surface over arbitrary content there is nothing to carve, so the values do not
transfer. If this returns, it returns whole.
````

**CardstockHeader.tsx.txt — the render, in full (its user-visible copy is three strings: the wordmark `French Heritage Equestrian` / `French Heritage`, the home link's aria-label, and the `initial` glyph):**

```tsx
import { Link } from 'react-router-dom';
import './header-cardstock.css';

/**
 * THE CARDSTOCK NAMEPLATE HEADER
 *
 * A Racing Green cardstock sheet carrying an embossed logo squircle (left), an
 * embossed wordmark (centre) and a debossed avatar (right) — plus the Create
 * tab hanging off its bottom edge. Ported from the owner-approved reference,
 * `docs/reference/header-mockup.html`; that file's CSS is the specification and
 * lives here as `header-cardstock.css`.
 *
 * The header holds EXACTLY those three marks. The old Calendar button, the old
 * mobile-nav button and the avatar's ChevronDown were removed deliberately (the
 * first is reachable from the nav; the second is now the drawer tab, moved to
 * the top-right — ONEMENU A1; the debossed avatar is a DECORATIVE MONOGRAM,
 * ONEMENU owner ruling 2026-08-07 — no click, no press/hover animation, no
 * menu, no ARIA control semantics. It used to open the account dropdown; that
 * dropdown is gone, its contents merged into the side nav (rail + drawer) in
 * AppLayout.tsx).
 *
 * SUPERADMIN NEVER RENDERS THIS. Platform chrome is not tenant branding and
 * keeps its own white header (with its own live avatar-menu button) — see
 * AppLayout.
 *
 * Sizes are held at every breakpoint on purpose: each SVG is DRAWN at its
 * render size (56 logo, 50 avatar) so one user unit is one CSS pixel and the
 * 1px stroke offsets land on exact device pixels. Resizing the marks
 * responsively is what made the outline jagged.
 *
 * Below 410px there isn't room for that at full size (TASK-BP410), so a
 * SECOND pair of drawings exists at 48/42 units — redrawn, not resized — and
 * header-cardstock.css swaps between the two pairs (`.cs-mark-lg`/
 * `.cs-mark-sm`) at that breakpoint. Same rule, second size.
 */

/** The squircle the FH sits inside — one path, drawn three times at three
 *  offsets (light lip above, hard dark below, face on top). Held at 56 units. */
const SQUIRCLE =
  'M28 3.61 C 11.29 3.61, 3.61 11.29, 3.61 28 C 3.61 44.71, 11.29 52.39, 28 52.39 ' +
  'C 44.71 52.39, 52.39 44.71, 52.39 28 C 52.39 11.29, 44.71 3.61, 28 3.61 Z';

/** The SAME squircle, REDRAWN at 48 units (geometry scaled ×48/56, not the
 *  56-unit path resized) for the ≤410px breakpoint — see header-cardstock.css.
 *  Scaling the 56-unit drawing down to 48px is what put the 1px stroke
 *  offsets on fractional device pixels and produced the jagged-outline defect
 *  this header already went through once (TASK-HEADER-REPORT). */
const SQUIRCLE_48 =
  'M24 3.09 C 9.68 3.09, 3.09 9.68, 3.09 24 C 3.09 38.32, 9.68 44.91, 24 44.91 ' +
  'C 38.32 44.91, 44.91 38.32, 44.91 24 C 44.91 9.68, 38.32 3.09, 24 3.09 Z';

type Props = {
  /** first letter of the member's display name — the debossed glyph */
  initial: string;
};

export function CardstockHeader({ initial }: Props) {
  return (
    <div className="cs-hdrwrap">
      {/* Filter/clip/gradient defs for the avatar well. A native feGaussianBlur
          is used because iOS ignores CSS filter:blur() on SVG children. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="csWallBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
          {/* keeps the blurred wall strictly inside the struck rim */}
          <clipPath id="csWellClip"><circle cx="25" cy="25" r="22.2" /></clipPath>
          {/* same clip, redrawn for the 42-unit avatar (≤410px) — cx/cy/r
              scaled ×42/50, not the 50-unit circle resized */}
          <clipPath id="csWellClip42"><circle cx="21" cy="21" r="18.65" /></clipPath>
          {/* Light comes from above, so the top wall casts and the bottom barely
              does. Faint on purpose: a diffuse shadow that gains REACH as the
              button sinks, not a fill that switches on. */}
          <linearGradient id="csWallFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity=".30" />
            <stop offset="45%" stopColor="#000" stopOpacity=".16" />
            <stop offset="75%" stopColor="#000" stopOpacity=".06" />
            <stop offset="100%" stopColor="#000" stopOpacity=".02" />
          </linearGradient>
        </defs>
      </svg>

      <header className="cs-hdr">
        <div className="cs-left">
          <Link to="/app" className="cs-homelink" aria-label="French Heritage Equestrian — home">
            <span className="cs-mark cs-logo">
              <svg className="cs-mark-lg" viewBox="0 0 56 56" width="56" height="56" aria-hidden="true" focusable="false">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE} />
                <path className="cs-ring" d={SQUIRCLE} />
              </svg>
              {/* TASK-BP410: redrawn at 48 units, not the 56-unit mark resized */}
              <svg className="cs-mark-sm" viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
                <path className="cs-ring-light" transform="translate(0,-1)" d={SQUIRCLE_48} />
                <path className="cs-ring-dark" transform="translate(0,1)" d={SQUIRCLE_48} />
                <path className="cs-ring" d={SQUIRCLE_48} />
              </svg>
              <span className="cs-glyph cs-fh cs-emboss">FH</span>
            </span>
          </Link>
        </div>

        {/* The wordmark's own text is its accessible name, so it needs no label. */}
        <Link to="/app" className="cs-wordmark cs-emboss">
          <span className="cs-long">French Heritage Equestrian</span>
          <span className="cs-short">French Heritage</span>
        </Link>

        <div className="cs-right">
          {/* ONEMENU (owner ruling 2026-08-07): decorative monogram only — no
              button, no click handler, no press/hover class, no ARIA control
              semantics. aria-hidden because it conveys nothing an assistive
              tech user would act on (same treatment the logo's own SVGs
              already get above); the account link now lives in the nav. */}
          <span className="cs-mark cs-avatar" aria-hidden="true">
            <svg className="cs-mark-lg" viewBox="0 0 50 50" width="50" height="50" focusable="false">
              <g clipPath="url(#csWellClip)">
                <circle className="cs-ring-wall" cx="25" cy="24.4" r="21.8" />
              </g>
              <circle className="cs-ring-dark" cx="25" cy="24" r="22.2" />
              <circle className="cs-ring-breath" cx="25" cy="26" r="22.2" />
              <circle className="cs-ring" cx="25" cy="25" r="22.2" />
            </svg>
            {/* TASK-BP410: redrawn at 42 units, not the 50-unit mark resized.
                Well-band (wall + clip) cx/cy/r scaled ×42/50; the outline
                triple's ±1 y-offset (20/21/22) stays literal, same as the
                logo's translate(0,±1) — a physical pixel, not geometry. */}
            <svg className="cs-mark-sm" viewBox="0 0 42 42" width="42" height="42" focusable="false">
              <g clipPath="url(#csWellClip42)">
                <circle className="cs-ring-wall" cx="21" cy="20.5" r="18.31" />
              </g>
              <circle className="cs-ring-dark" cx="21" cy="20" r="18.65" />
              <circle className="cs-ring-breath" cx="21" cy="22" r="18.65" />
              <circle className="cs-ring" cx="21" cy="21" r="18.65" />
            </svg>
            <span className="cs-glyph cs-av">{initial}</span>
          </span>
        </div>
      </header>

      {/* THE CREATE TAB WAS REMOVED — owner, 2026-08-07.
          It hung below the header on desktop and opened the create modal. The
          create control now lives at the top of the nav rail as a `+`, in the
          slot the collapse toggle used to hold, so there is one create entry
          point instead of two and nothing overlaps page content.
          The `showCreateTab` and `onCreate` props are gone with it. The
          `.cs-tab` rules in header-cardstock.css are now unreferenced and can be
          deleted in a cleanup pass — left in place for one release so the tab
          can be restored quickly if the rail placement does not work in
          practice. */}
    </div>
  );
}
```

**header-cardstock.css.txt — the key rules that define the look (lines 1–80 of 532; the remainder is breakpoint re-declarations of `--cs-hdr-h` at 6 widths, the avatar well, and the retired `.cs-tab` block):**

```css
/* ============================================================================
 * THE CARDSTOCK NAMEPLATE HEADER
 *
 * Ported from the owner-approved reference, docs/reference/header-mockup.html,
 * which is the specification for this file. Every value below is that file's
 * value. The commentary is its commentary — kept because each number records a
 * specific observed failure, and the obvious "cleaner" alternative is usually
 * the failure being corrected.
 *
 * Only three kinds of change were made in the port, each marked PORT: below:
 *   1. classes are namespaced `cs-` (cardstock) so they cannot collide with
 *      the app's global utility and component classes;
 *   2. SVG def ids are namespaced `cs*` for the same reason;
 *   3. the header height is published as `--cs-hdr-h` so the two things that
 *      must track it — the Create tab's stock continuation and the drawer
 *      tab's offset — follow it across breakpoints instead of assuming 80px.
 *
 * The one behavioural repair is on `.cs-tab::after`; it is documented in full
 * at that rule and in docs/reports/TASK-HEADER-REPORT.md.
 * ========================================================================= */

/* PORT: the reference hardcodes the header height (80px) in three places. It
   is published here instead, and re-declared in every breakpoint below, so the
   Create tab's background continuation and the drawer tab's offset stay locked
   to the real header height rather than to a desktop constant. On desktop the
   value is 80px, so the reference's numbers are reproduced exactly. */
:root { --cs-hdr-h: 80px; }

.cs-hdrwrap { position: sticky; top: 0; z-index: 40; }

.cs-hdr {
  /* 80px — close to 5c's 76px proportion, where the name carries a real
     share of the header height rather than floating in empty stock. */
  height: var(--cs-hdr-h);
  position: relative; z-index: 2;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
  /* the stock runs edge to edge; only the marks are inset past the notch */
  padding-left: calc(33px + env(safe-area-inset-left));
  padding-right: calc(33px + env(safe-area-inset-right));
  background-image:
    radial-gradient(120% 200% at 82% -30%, rgba(255,255,255,.045) 0%, rgba(255,255,255,0) 60%),
    radial-gradient(90% 160% at 10% 130%, rgba(0,0,0,.12) 0%, rgba(0,0,0,0) 58%),
    url('/header-stock.jpg');
  background-size: auto, auto, cover;
  background-repeat: no-repeat;
  background-position: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.09), inset 0 -1px 0 rgba(0,0,0,.26),
              0 6px 18px rgba(24,38,32,.14);
}

/* ============ EMBOSS — logo letters + wordmark ============
   Face is the EXACT tone of the sheet (#293a37). Lightening it to #2e403c read
   as a lighter shape sitting ON the stock; when the face matches the sheet, the
   only cues are the highlight and the shadow, which is what makes it read as
   displaced material. Sub-pixel offsets + blur always (1px/0-blur = detached
   slab at 3x).

   Offsets are SCALED for 44px. Shadow offsets are absolute pixels — they don't
   grow with font-size, so reusing 36px values verbatim at 44px made the relief
   22% shallower and washed the name out. */
.cs-emboss {
  color: #293a37;
  text-shadow:
    0 -0.61px 0.73px rgba(198,214,200,.55),
    0  0.61px 0.98px rgba(0,0,0,.78),
    0  1.83px 3.05px rgba(0,0,0,.32);
}

/* ============ THE OUTLINES ============
   THREE strokes, NO blur filters at all, offset a full 1px (not 0.5), and the
   light stroke is a bright rgba(226,236,226,.32) against a hard rgba(0,0,0,.80)
   dark. Blurred sub-pixel versions are what killed the crispness — this
   construction is deliberately hard-edged, which is exactly what makes it read
   as a struck impression. */
.cs-ring       { fill: none; stroke: #293a37;               stroke-width: 1.8; }
.cs-ring-dark  { fill: none; stroke: rgba(0,0,0,.80);       stroke-width: 1.8; }
.cs-ring-light { fill: none; stroke: rgba(226,236,226,.32); stroke-width: 1.8; }
/* The avatar is DEBOSSED — a sunken edge shows no bright rim. Its lower stroke
   is only the faintest breath of light, not the logo's .32 lip. Scoped to the
   avatar so pressing it never touches the logo's strokes. */
```

Grep proof of no importer:

```
$ grep -rn "CardstockHeader\|header-cardstock\|header-stock" src/ index.html public/
src/components/app/ContractSubheader.tsx:13: * header-cardstock.css) rather than a hardcoded offset — the cardstock header
src/components/app/AppLayout.tsx:1743:         ONEMENU (2026-08-07): the tenant's CardstockHeader avatar is now an
src/components/app/PageCreateButton.tsx:7: * is admin/staff + desktop only (CardstockHeader). Icon + short label, quiet
```

All three are comments. No `import`, no `url()`, no JSX element.

---

## 53. tailwind.config.js glass.nav (tailwind.config.js:86-88)
- reported by: docs/reports/TASK-ONEHEADER-REPORT.md [docs/reports/flagharvest-work/batch4.md#72]
- reachability: **verified unreachable — a theme colour with no class consuming it.** Tailwind only emits a utility if the class string appears in a content-glob file. Grep across `src/` and `index.html` for `glass-` (which would catch `bg-glass-nav`, `text-glass-nav`, `border-glass-nav`, `from-glass-nav`, …) returns **zero matches**. Grep for `NAV_GLASS` — the constant that used to hold the class — returns **zero matches**; it was removed by ONEHEADER §1. The only `glass` hits in `src/` are prose comments recording the removal:
  - `src/components/app/AppLayout.tsx:44` — "The green glass is DROPPED…"
  - `src/components/app/AppLayout.tsx:56` — "`glass.nav` in tailwind.config.js was the compensated base…"
  - `src/components/app/AppLayout.tsx:313`, `:1237`, `:1239` — comments
  - `src/components/app/AppHeader.tsx:38`, `src/components/app/app-header.css:206`, `:392` — comments
  - `src/components/layout/Header.tsx:18`, `:169` — the PUBLIC site header's own frost effect, which uses inline `backdrop-blur` + `bg-*`, not `glass.nav`
  So `theme.extend.colors.glass.nav` compiles into the theme object on every build and emits **no CSS rule**. Its sibling `navfill` immediately below it IS read (`bg-navfill/80`, `bg-navfill/64` — `AppLayout.tsx:130,248,320`), which is the contrast that makes the `glass` block's silence unambiguous rather than a grep artefact.
- exists: yes
- content:

`tailwind.config.js:77-99` — the glass block with its full derivation comment, plus the live `navfill` sibling for contrast:

```js
        /* COMPENSATED GLASS BASES — owner's method, 2026-08-08.
           These are INPUTS to an alpha blend, not colours anyone sees. A
           translucent green over the warm cream page (hue 37deg) composites
           72deg toward yellow: green-800/20 renders #c8cac0, hue 73deg, sat 9%.
           Pre-shifting the base cooler cancels that rotation, so the RENDERED
           colour lands on the brand hue instead of the declared one.
             navGlass at /30 over cream -> #aed5bf, hue 145deg, sat 32%.
           Recompute if the page background changes — the compensation is
           specific to what is behind it. */
        glass: {
          nav: '#09975e',
        },
        /* NAV FILL — the selected/hover green, HUE-CORRECTED. Owner's method:
           a translucent green composites toward the warm backdrop and drifts
           yellow, so the DECLARED base is pre-shifted cooler and the RENDERED
           colour lands on the brand hue. Solved against the near-white nav panel
           at both alphas it is used at:
             /85 (selected) -> #31523f  hue 145.5deg  near-white text 8.50:1
             /65 (hover)    -> #617a6b  hue 144.0deg  near-white text 4.55:1
           Recompute if the panel changes — the correction is specific to what is
           behind it. */
        navfill: '#0d341e',
```

Grep proof:

```
$ grep -rn "glass-\|bg-glass\|NAV_GLASS" src/
(no output — 0 matches)
```

---

## 54. AppHeader.tsx + app-header.css + archived verification harness (src/components/app/ + docs/reports/oneheader-shots/)
- reported by: docs/reports/TASK-ONEHEADER-REPORT.md [docs/reports/flagharvest-work/batch4.md#73]
- reachability: **split answer, reported honestly.**
  - **`AppHeader.tsx` and `app-header.css` are LIVE, not inventory.** `src/components/app/AppLayout.tsx:31` imports it (`import { AppHeader } from './AppHeader';`) and mounts it at `src/components/app/AppLayout.tsx:1824`. `AppHeader.tsx` is 215 lines, `app-header.css` is 558 lines, both under `src/` and inside every build glob. Nothing here is unviewed inventory beyond the owner not having read the source.
  - **The ARCHIVED HARNESS is the unviewed inventory, and it is unreachable by construction.** It lives at `docs/reports/oneheader-shots/harness.main.tsx.txt` and `docs/reports/oneheader-shots/harness.index.html.txt`. The `.txt` suffix takes both out of vite's module graph and out of `tsconfig.app.json`; the directory `harness/` that they reference **does not exist** (`ls harness` → No such file or directory), so even the paths inside them (`/harness/main.tsx`, `../src/index.css`) resolve to nothing. Vite's app entry is `index.html` at the repo root, which never references `harness/`. Verified: `ls -d harness` and `ls -d docs/reports/oneheader-shots/harness` both fail.
  - Alongside them the directory holds 15 PNG screenshots and `measurements.json` — the evidence the harness produced.
- exists: yes — both `.txt` files present, dated Aug 12 15:15
- content:

Exact locations and the rest of the archive directory:

```
$ ls -la docs/reports/oneheader-shots/
-rw-r--r--  1 cactai  staff   46970  1280--sticky-scrolled.png
-rw-r--r--  1 cactai  staff   59564  1280-desktop--scrolled.png
-rw-r--r--  1 cactai  staff  120943  1280-desktop--top.png
-rw-r--r--  1 cactai  staff   46963  1440--sticky-scrolled.png
-rw-r--r--  1 cactai  staff   53720  360-narrow--scrolled.png
-rw-r--r--  1 cactai  staff   90917  360-narrow--top.png
-rw-r--r--  1 cactai  staff    7411  390--header-over-dark.png
-rw-r--r--  1 cactai  staff   56346  390-iphone--scrolled.png
-rw-r--r--  1 cactai  staff   89961  390-iphone--top.png
-rw-r--r--  1 cactai  staff   45347  768-tablet--scrolled.png
-rw-r--r--  1 cactai  staff   66456  768-tablet--top.png
-rw-r--r--  1 cactai  staff   52731  844-landscape--scrolled.png
-rw-r--r--  1 cactai  staff   77831  844-landscape--top.png
-rw-r--r--  1 cactai  staff   24518  bodylock-repro.png
-rw-r--r--  1 cactai  staff     308  harness.index.html.txt
-rw-r--r--  1 cactai  staff    5762  harness.main.tsx.txt
-rw-r--r--  1 cactai  staff    5303  measurements.json
```

**`docs/reports/oneheader-shots/harness.index.html.txt` — verbatim, in full (308 bytes):**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ONEHEADER harness</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/harness/main.tsx"></script>
  </body>
</html>
```

**`docs/reports/oneheader-shots/harness.main.tsx.txt` — verbatim, in full (5,762 bytes):**

```tsx
/* TASK-ONEHEADER visual harness — NOT part of the app build.
 *
 * Mounts the REAL AppHeader component (not a hand-copied mock) against the real
 * stylesheets, so the screenshots in the report are of the shipped component.
 * The nav rows below reproduce AppLayout's palette constants VERBATIM — the
 * strings are checked against AppLayout.tsx by the report's grep step.
 *
 * Delete this directory before merge, or leave it: vite's app build entry is
 * index.html at the repo root and never reaches harness/.
 */
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, ShoppingBag, MessageSquare, Users, UserRound, Inbox, Receipt, Eye, Library, ChevronUp } from 'lucide-react';
import '../src/index.css';
import { AppHeader } from '../src/components/app/AppHeader';

/* Copied verbatim from src/components/app/AppLayout.tsx (ONEHEADER §1). */
const NAV_PANEL = 'bg-green-800';
const NAV_ROW_IDLE = 'text-cream-100/80 [@media(hover:hover)]:hover:bg-green-600 [@media(hover:hover)]:hover:text-cream-100';
const NAV_ROW_ACTIVE = 'bg-cream-100 text-green-900 font-medium';
const NAV_ICON_IDLE = 'text-cream-100/65 [@media(hover:hover)]:group-hover:text-cream-100';
const NAV_ICON_ACTIVE = 'text-green-800';
const NAV_HEADING = 'text-cream-100/60';
const NAV_DIVIDER = 'border-cream-100/20';
const NAV_BADGE = 'bg-gold-500 text-green-950';

function Row({ icon: Icon, label, active = false, badge = 0 }: {
  icon: typeof Users; label: string; active?: boolean; badge?: number;
}) {
  return (
    <span className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-sans ${active ? NAV_ROW_ACTIVE : NAV_ROW_IDLE}`}>
      <Icon size={17} className={active ? NAV_ICON_ACTIVE : NAV_ICON_IDLE} />
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className={`min-w-[1.25rem] h-5 px-1.5 text-[11px] leading-5 text-center rounded-full ${NAV_BADGE}`}>{badge}</span>
      )}
    </span>
  );
}

function Nav({ sticky = false }: { sticky?: boolean }) {
  return (
    /* Layout-only sizes are INLINE STYLES, not Tailwind. tailwind.config.js's
       content globs cover ./src and ./index.html — not harness/ — so a
       harness-only arbitrary value like `min-h-[560px]` would emit no rule and
       silently render at zero. The palette classes above are safe because they
       are the same strings AppLayout uses, so src is what emits them. */
    <nav
      className={`${NAV_PANEL} p-2 flex flex-col gap-0.5 ${sticky ? 'sticky top-[var(--cs-hdr-h)] h-[calc(100dvh-var(--cs-hdr-h))]' : ''}`}
      style={{ width: 240, minHeight: sticky ? undefined : 560 }}
    >
      <span className={`group relative flex items-center rounded-lg pr-1 bg-cream-100`}>
        <span className="flex items-center gap-3 flex-1 min-w-0 px-3 py-2.5 text-[13.5px] font-sans text-green-900 font-medium">
          <Users size={18} className={NAV_ICON_ACTIVE} />
          <span className="whitespace-nowrap">Community Feed</span>
        </span>
        <span className="shrink-0 flex items-center justify-center p-1.5 rounded-md text-green-800">
          <ChevronUp size={18} />
        </span>
      </span>
      <Row icon={LayoutDashboard} label="Dashboard" badge={3} />
      <Row icon={CalendarDays} label="Calendar" />
      <Row icon={ShoppingBag} label="Catalog" />
      <Row icon={MessageSquare} label="Messages" badge={12} />
      <div className={`mt-2 border-t ${NAV_DIVIDER} pt-2 px-3 pb-1 text-[10px] tracking-widest uppercase ${NAV_HEADING} font-semibold`}>
        Management
      </div>
      <Row icon={Inbox} label="Inbound" badge={5} />
      <Row icon={Receipt} label="Payment review" />
      <Row icon={Eye} label="Oversight" />
      <Row icon={Library} label="Content store" />
      <Row icon={UserRound} label="Account" />
    </nav>
  );
}

/* Page filler that mimics what actually passes behind the header in the app:
 * cream page, white cards, and a green-800 block (the rail's own colour) so
 * Verification #4 — "over light AND dark page content" — is exercised. */
function Filler() {
  return (
    <div className="flex-1 min-w-0 px-4 sm:px-8 pt-10 pb-24 flex flex-col gap-4">
      <div className="bg-white border border-green-800/10 rounded-xl p-6">
        <h1 className="font-serif text-xl text-green-800">A white card</h1>
        <p className="body-text text-sm text-muted mt-2">Light page content passing under the header.</p>
      </div>
      <div id="greenblock" className="bg-green-800 rounded-xl p-6 grid place-items-center" style={{ height: 220, flex: 'none' }}>
        <p className="text-cream-100 font-sans text-sm">A green-800 block — the darkest surface the app puts on a page.</p>
      </div>
      <div className="bg-white border border-green-800/10 rounded-xl p-6" style={{ height: 1200, flex: 'none' }}>
        <p className="body-text text-sm text-muted">Scroll runway.</p>
      </div>
    </div>
  );
}

function Harness() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <MemoryRouter>
      <div className="min-h-screen bg-cream">
        <AppHeader initial="C" menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
        <div className="w-full max-w-[120rem] mx-auto flex">
          {/* sticky exactly as ClientRail / the staff rail do, so the screenshots
              prove the offset lands flush with the header's bottom edge */}
          <aside className="hidden lg:block shrink-0"><Nav sticky /></aside>
          <Filler />
        </div>
      </div>
    </MemoryRouter>
  );
}

createRoot(document.getElementById('root')!).render(<StrictMode><Harness /></StrictMode>);
```

For completeness, the LIVE mount that makes AppHeader not-inventory — `src/components/app/AppLayout.tsx:1809-1828`:

```tsx
           The cardstock nameplate is SHELVED, not deleted — the files and the
           texture asset stay put and a verbatim copy with restore instructions
           lives at docs/reference/shelved-cardstock-header/. It returns when the
           site is colour-matched to it.

           In its place: the login screen's header, so the header no longer
           changes at sign-in and the colours match either side of the wire. See
           AppHeader.tsx — it adopts the public header's MATERIAL and keeps the
           app's own contents (home mark, wordmark, avatar), it does not import
           the public header's site nav.

           The avatar is the menu button again (ONEHEADER §2) below lg, which is
           what let the hanging drawer tab be deleted (§3). It opens the one
           nav — not a second avatar menu (§4). */
        <AppHeader
          initial={initial}
          menuOpen={mobileNavOpen}
          onToggleMenu={() => setMobileNavOpen((v) => !v)}
        />
      )}
```

---

## 55. 23 internal helper functions revoked from anon/authenticated in NOGUARD3 Phase B (prod pg_proc)
- reported by: docs/reports/TASK-NOGUARD3-REPORT.md:32,327-375 [docs/reports/flagharvest-work/batch4.md#74]
- reachability: **verified unreachable from the browser and from `api/` — and the revoke IS APPLIED in production, correcting the report's own "DRY RUN ONLY. Three migrations delivered unapplied" header.** Live privilege read over all 23:
  - every one returns `has_function_privilege('anon', …, 'EXECUTE') = f` and `has_function_privilege('authenticated', …, 'EXECUTE') = f`
  - every one is `prosecdef = t` (SECURITY DEFINER), so in-database callers reach them regardless
  So the gate is the **grant itself**, not a flag in code: PostgREST will refuse a direct RPC call from a browser session for all 23.
  Independently grep-proven from the client side — for each of the 23, `grep -rn "rpc('<name>'\|rpc(\"<name>\"" src/ api/` returns **0**. The loose-identifier sweep returns 7 hits total across 4 names, and every one resolves to a COMMENT, exactly as the migration header claims:
  - `_provision_purchase_for_offerings` — 1 loose hit, 0 rpc
  - `change_request_is_frozen` — 2 loose, 0 rpc
  - `contact_document_wall_state` — 1 loose, 0 rpc
  - `document_changes_frozen` — 3 loose, 0 rpc
  - `send_executed_document_email` — 1 loose, 0 rpc (the real caller is `resend_executed_document_email`, a different function)
  - the other 18 — 0 loose, 0 rpc
  The migration files that did this: `supabase/migrations/20260811T0200_noguard3_revoke_internal_helpers.sql` (18) and `supabase/migrations/20260811T0300_noguard3_revoke_generate_document_helpers.sql` (5). Both still carry a `-- DRY RUN ONLY. NOT APPLIED.` banner that is now **stale** — the state in prod says otherwise.
- exists: yes — all 23 functions exist in prod, all 23 revoked
- content:

**The full list of 23, derived from prod, with signature, return type and one-line purpose (purposes are the function's own `COMMENT ON` where one exists, otherwise read from prosrc):**

```
 #  signature                                                                          | anon | authd | definer | returns
 1  _provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric) |  f   |   f   |    t    | uuid
    Creates a purchase + purchase_items for a caller-supplied contact/client/org with a
    caller-supplied p_mark_paid. The migration names this the highest-consequence of the 18:
    "any free signup could mint a purchase marked paid". Callers: attach_offerings_to_client,
    provision_client_invitation — both staff/service_role gated.
 2  assert_horse_care_eligible(uuid,uuid)                                              |  f   |   f   |    t    | jsonb
    Raises unless the contact/horse pair may receive horse-care services (the horse-care
    document gate); returns the eligibility detail as jsonb.
 3  assert_not_signature_locked(uuid)                                                  |  f   |   f   |    t    | void
    Raises if the document carries a live signature — the guard every structural write on a
    document calls before touching it.
 4  change_request_is_frozen(uuid)                                                     |  f   |   f   |    t    | boolean
    COMMENT: "True once a party OTHER than the author has genuinely viewed this entry.
    Submission alone does NOT freeze an entry — being seen does."
 5  compose_insurance_allocation(uuid)                                                 |  f   |   f   |    t    | void
    Writes the composed insurance-allocation text for a document from its insurance control
    answers.
 6  contact_document_satisfied(uuid,text)                                              |  f   |   f   |    t    | boolean
    COMMENT: "THE satisfaction rule for an assigned document. Called by
    contact_document_wall_state(), my_onboarding_state() and generate_my_onboarding_documents()"
 7  contact_document_wall_state(uuid)                                                  |  f   |   f   |    t    | jsonb
    COMMENT: "THE shared onboarding-document predicate: how many assigned documents a contact
    has not yet satisfied at the current active template version, and how …"
 8  deal_status(uuid)                                                                  |  f   |   f   |    t    | jsonb
    Rolls a deal's documents up into one status object (which are present, which executed).
 9  derive_affiliations(uuid)                                                          |  f   |   f   |    t    | text[]
    Computes RIDER / HORSE_OWNER / PARENT_GUARDIAN from executed documents + horse ownership.
    The authoritative derivation behind apply_affiliations (CLAUDE.md: sole writer of those rows).
10  document_changes_frozen(uuid,uuid)                                                 |  f   |   f   |    t    | boolean
    COMMENT: "TRUE only once the document is fully EXECUTED. Reading a document never freezes
    it — the previous rule locked the author out as soon as any counterpar…"
    (NOGUARD3 corrects NOGUARD1 here: the src/ hit at ContractPage.tsx is a comment, not a call.)
11  document_horse_ids(uuid)                                                           |  f   |   f   |    t    | uuid[]
    COMMENT: "Ordered horses a document names (join table, else the legacy horse_id column)."
12  ensure_staff_profile(uuid,text)                                                    |  f   |   f   |    t    | void
    Creates/repairs the profiles row for a staff user id + email.
13  expand_horse_blocks(text,uuid[])                                                   |  f   |   f   |    t    | text
    COMMENT: "Expand each contiguous run of HORSE.*-token lines into one filled copy per bound
    horse. One horse in = byte-identical to single-horse substitution."
14  horse_medication_component(uuid,text)                                              |  f   |   f   |    t    | text
    COMMENT: "U2.3: single medication component (DOSAGE | INSTRUCTIONS | ADDITIONAL) across a
    horse's medications. horse_medications_prose renders the whole line; t…"
15  horse_medications_prose(uuid,text)                                                 |  f   |   f   |    t    | text
    Renders a horse's medication list as one prose line for merge into a document body.
16  lease_sublease_allowed(uuid)                                                       |  f   |   f   |    t    | boolean
    The lease's sublease-permitted predicate, read by the conditional clause gating.
17  location_full_label(uuid)                                                          |  f   |   f   |    t    | text
    COMMENT: "U2.5: a facility name plus its address. 'FHE Main Barn Stall 12' is not an
    address on a legal instrument."
18  member_display_name(uuid)                                                          |  f   |   f   |    t    | text
    The one display-name resolution for a member/user id.
19  next_custom_field_key(uuid,text)                                                   |  f   |   f   |    t    | text
    Allocates the next unused custom-field key on a document, given a prefix.
20  owner_has_executed_template(uuid,text)                                             |  f   |   f   |    t    | boolean
    True if the given owner contact has an executed, non-superseded copy of the template.
21  party_user_ids(uuid,text)                                                          |  f   |   f   |    t    | TABLE(user_id uuid)
    The auth user ids behind a document's party role — the join used by the party-read RLS family.
22  send_executed_document_email(uuid)                                                 |  f   |   f   |    t    | jsonb
    Fires the executed-document delivery POST to /api/deliver-documents, once, per document.
    OWNER-FACING EMAIL. Full body below.
23  undelivered_executed_documents(integer,integer)                                    |  f   |   f   |    t    | TABLE(document_id uuid, title text,
                                                                                                                 executed_at timestamptz,
                                                                                                                 missing_recipients bigint)
    The sweep query: executed documents with at least one party who has no EMAIL delivery row,
    past a grace window. OWNER-FACING EMAIL. Full body below.
```

Live privilege proof (the exact query and its output):

```
$ psql … -c "select p.oid::regprocedure::text as signature,
             has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') as authd,
             p.prosecdef as definer
             from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.prorettype::regtype::text <> 'trigger'
             and p.proname = any(ARRAY[…the 23…]) order by p.proname;"

                                     signature                                      | anon | authd | definer
------------------------------------------------------------------------------------+------+-------+---------
 _provision_purchase_for_offerings(uuid,uuid,uuid,uuid[],boolean,text,text,numeric) | f    | f     | t
 assert_horse_care_eligible(uuid,uuid)                                              | f    | f     | t
 assert_not_signature_locked(uuid)                                                  | f    | f     | t
 change_request_is_frozen(uuid)                                                     | f    | f     | t
 compose_insurance_allocation(uuid)                                                 | f    | f     | t
 contact_document_satisfied(uuid,text)                                              | f    | f     | t
 contact_document_wall_state(uuid)                                                  | f    | f     | t
 deal_status(uuid)                                                                  | f    | f     | t
 derive_affiliations(uuid)                                                          | f    | f     | t
 document_changes_frozen(uuid,uuid)                                                 | f    | f     | t
 document_horse_ids(uuid)                                                           | f    | f     | t
 ensure_staff_profile(uuid,text)                                                    | f    | f     | t
 expand_horse_blocks(text,uuid[])                                                   | f    | f     | t
 horse_medication_component(uuid,text)                                              | f    | f     | t
 horse_medications_prose(uuid,text)                                                 | f    | f     | t
 lease_sublease_allowed(uuid)                                                       | f    | f     | t
 location_full_label(uuid)                                                          | f    | f     | t
 member_display_name(uuid)                                                          | f    | f     | t
 next_custom_field_key(uuid,text)                                                   | f    | f     | t
 owner_has_executed_template(uuid,text)                                             | f    | f     | t
 party_user_ids(uuid,text)                                                          | f    | f     | t
 send_executed_document_email(uuid)                                                 | f    | f     | t
 undelivered_executed_documents(integer,integer)                                    | f    | f     | t
(23 rows)
```

The two migrations' own reasoning (the "why these and not others"), `supabase/migrations/20260811T0200_noguard3_revoke_internal_helpers.sql:1-37`:

```sql
-- TASK NOGUARD3 / PHASE B — DRY RUN ONLY. NOT APPLIED. Do not apply without review.
--
-- Revoke EXECUTE from anon / authenticated / PUBLIC on 18 SECURITY DEFINER
-- functions that are internal by construction: they have NO browser caller and
-- NO api/ caller, and every in-database caller is a postgres-owned
-- SECURITY DEFINER function, which reaches them regardless of the invoker's
-- grants. service_role is retained everywhere.
--
-- This is NOGUARD1's category-5 argument, re-proven by NOGUARD2 in a
-- rolled-back transaction and re-proven again here for the invoker case
-- (see 20260811T0300, which is deliberately kept separate).
--
-- WHY THESE AND NOT OTHERS. Each was checked three ways:
--   * src/  : grepped for rpc('name') and rpc("name"), then grepped loosely for
--             the bare identifier to catch a dynamically built call. Every loose
--             hit on this list resolved to a COMMENT or to a DIFFERENT function
--             (resend_executed_document_email, sweep_undelivered_executed_documents).
--   * api/  : same, zero hits.
--   * pg_proc: callers enumerated; all are prosecdef AND owned by postgres.
--
-- CORRECTION TO NOGUARD1: it lists a src/ caller for document_changes_frozen
-- (src/pages/app/ContractPage.tsx). That is a comment, not a call. Verified.
--
-- CONSEQUENCE OF LEAVING THEM. The highest is
-- _provision_purchase_for_offerings: it creates a purchase for a
-- caller-supplied contact/client/org with a caller-supplied p_mark_paid, so any
-- free signup could mint a purchase marked paid. Its only callers are
-- attach_offerings_to_client and provision_client_invitation, both of which are
-- staff/service_role gated. The leading underscore states the intent.
--
-- Both trap grants are handled: each grant is revoked BY NAME (PUBLIC, anon,
-- authenticated separately), because a revoke naming only one of them is a
-- silent no-op against the other. has_function_privilege() is re-read in the
-- verify block; the REVOKE's own output is never trusted.
--
-- This migration carries NO transaction control of its own so it is safe to
-- wrap in an outer BEGIN … ROLLBACK. Do not add BEGIN/COMMIT.
```

And `supabase/migrations/20260811T0300_noguard3_revoke_generate_document_helpers.sql:1-42` — the five kept separate because their only in-database caller is SECURITY **INVOKER**:

```sql
-- TASK NOGUARD3 / PHASE B — DRY RUN ONLY. NOT APPLIED. Do not apply without review.
--
-- KEPT SEPARATE FROM 20260811T0200 ON PURPOSE. These five carry a risk the
-- other eighteen do not, and they should be approved or rejected on their own.
--
-- The five: document_horse_ids, expand_horse_blocks, horse_medication_component,
-- horse_medications_prose, location_full_label. They leak animal medical data,
-- addresses and document/horse links by id, with no identity check.
--
-- WHY THEY ARE DIFFERENT. Their only in-database caller is generate_document,
-- and generate_document is SECURITY **INVOKER** (prosecdef = false), not
-- DEFINER. NOGUARD2's clearance argument — "revoking never breaks an
-- in-database caller, because every caller is a postgres-owned SECURITY
-- DEFINER function and the inner privilege check is made against postgres" —
-- DOES NOT COVER AN INVOKER CALLER. An invoker function runs as whoever is
-- current_user at the time, so its inner calls are checked against that role.
--
-- Tested rather than reasoned about, in a rolled-back transaction, with a
-- three-function probe mirroring the real shape (probe objects confirmed gone
-- afterwards: 0 rows matching ng3_%):
--
--   definer_outer -> invoker -> target, target revoked from authenticated
--     called as authenticated  ->  "target reached"        (SURVIVES)
--
--   invoker -> target, target revoked from authenticated
--     called as authenticated  ->  ERROR: permission denied for function
--
-- So the revoke is safe for the real path and unsafe for a direct one:
--   * generate_document has NO direct browser or api/ RPC caller (grepped for
--     rpc('generate_document') and the bare identifier).
--   * All 10 of its in-database callers ARE SECURITY DEFINER, so in every real
--     invocation current_user is postgres by the time it runs and the five
--     inner calls resolve against postgres.
--   * generate_document is itself granted to anon AND authenticated, so a
--     direct PostgREST call is possible today. After this migration such a call
--     would fail partway through instead of completing.
--
-- THE OPEN QUESTION FOR REVIEW: generate_document is a SECURITY INVOKER
-- function that creates documents and is granted to anon. That grant, not
-- these five, is the more interesting finding. It is left alone here because
-- changing it is a larger decision than this migration should make.
--
-- No transaction control of its own. Do not add BEGIN/COMMIT.
```

**Full prosrc of the two that touch owner-facing email — live from prod `pg_get_functiondef`:**

```sql
CREATE OR REPLACE FUNCTION public.send_executed_document_email(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_doc     documents%ROWTYPE;
  v_unsigned int;
  v_base    text;
  v_req     bigint;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'document not found'; END IF;

  -- every signer must have signed: any NULL signature means do not send
  SELECT count(*) INTO v_unsigned
    FROM signatures s
   WHERE s.document_id = p_document_id AND s.deleted_at IS NULL AND s.signed_at IS NULL;
  IF v_doc.status <> 'EXECUTED' OR v_unsigned > 0 THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'not fully signed');
  END IF;

  IF v_doc.executed_email_sent_at IS NOT NULL THEN
    RETURN jsonb_build_object('sent', false, 'reason', 'already sent',
                              'sent_at', v_doc.executed_email_sent_at);
  END IF;

  SELECT value_text INTO v_base FROM config_values
   WHERE org_id = v_doc.org_id AND namespace='SYSTEM' AND key='APP_BASE_URL';
  IF coalesce(btrim(v_base),'') = '' THEN
    UPDATE documents SET executed_email_error = 'APP_BASE_URL not configured'
     WHERE id = p_document_id;
    RETURN jsonb_build_object('sent', false, 'reason', 'no base url');
  END IF;

  -- fire-and-forget POST; the endpoint renders the PDFs, unions the parties,
  -- brands per tenant and writes document_deliveries rows idempotently.
  -- A15: 15000ms timeout — the endpoint legitimately takes 6-8s (PDF + SMTP);
  -- pg_net's 5000ms default was recording false timeouts on real successes.
  SELECT net.http_post(
           url     := v_base || '/api/deliver-documents',
           body    := jsonb_build_object('documentIds', jsonb_build_array(p_document_id::text)),
           headers := '{"Content-Type": "application/json"}'::jsonb,
           timeout_milliseconds := 15000
         ) INTO v_req;

  UPDATE documents
     SET executed_email_sent_at = now(), executed_email_error = NULL
   WHERE id = p_document_id;

  RETURN jsonb_build_object('sent', true, 'request_id', v_req);
END;
$function$
```

```sql
CREATE OR REPLACE FUNCTION public.undelivered_executed_documents(p_limit integer DEFAULT 10, p_grace_minutes integer DEFAULT 5)
 RETURNS TABLE(document_id uuid, title text, executed_at timestamp with time zone, missing_recipients bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id,
         coalesce(d.title, 'Document'),
         d.updated_at,
         count(*) FILTER (WHERE dd.id IS NULL) AS missing_recipients
    FROM documents d
    JOIN document_parties dp ON dp.document_id = d.id
    JOIN contacts c ON c.id = dp.contact_id
                   AND coalesce(btrim(c.email), '') <> ''
    LEFT JOIN document_deliveries dd
           ON dd.document_id = d.id
          AND dd.recipient_contact_id = dp.contact_id
          AND dd.channel = 'EMAIL'
          AND dd.deleted_at IS NULL
   WHERE d.status = 'EXECUTED'
     AND d.deleted_at IS NULL
     -- grace: let the browser path deliver first in the common case
     AND d.updated_at < now() - make_interval(mins => greatest(p_grace_minutes, 0))
   GROUP BY d.id, d.title, d.updated_at
  HAVING count(*) FILTER (WHERE dd.id IS NULL) > 0
   ORDER BY d.updated_at
   LIMIT greatest(p_limit, 1);
$function$
```

---

## 56. SENDGUARD §2 migration committed but UNAPPLIED (supabase/migrations/20260810T1400_sendguard_reuse_pending_onboarding_document.sql)
- reported by: docs/reports/TASK-SENDGUARD-REPORT.md [docs/reports/flagharvest-work/batch4.md#75]
- reachability: **verified unapplied — two of the three functions DO NOT EXIST in production.** Live `pg_proc` read:

```
$ psql … -c "select p.oid::regprocedure::text, p.prosecdef, md5(p.prosrc)
             from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public'
             and p.proname in ('compose_document_body','regenerate_document_body','generate_my_onboarding_documents');"

                oid                 | prosecdef |               md5
------------------------------------+-----------+----------------------------------
 generate_my_onboarding_documents() | t         | c4e11b0748afcb32b656216ce4587b3e
(1 row)
```

  - `compose_document_body(uuid, text)` — **absent from prod**
  - `regenerate_document_body(uuid, text)` — **absent from prod**
  - `generate_my_onboarding_documents()` — **exists**, but it is the PRE-SENDGUARD body: the migration's rewrite depends on `compose_document_body`, which does not exist, so the version in prod cannot be the rewritten one. The F2 delete-and-regenerate churn described in the migration header is therefore still the live behaviour.
  The gate is simply that the file was never run: the repo has no `supabase_migrations.schema_migrations` table (CLAUDE.md — migrations are a hand-maintained journal applied via `psql`), and the file's own banner says so at lines 4-6: `*** NOT APPLIED. Dry-run only, per the APPLY MODE section of the task doc. ***`
- exists: yes — 579 lines, present in the migrations directory, unapplied
- content:

The full SQL of the migration follows. It is the owner's decision material for whether to apply it.

```sql
-- SENDGUARD §2 — the onboarding document stops churning: the BODY is regenerated
-- in place, the ROW and its id survive.
--
-- ****************************************************************************
-- *** NOT APPLIED. Dry-run only, per the APPLY MODE section of the task doc. ***
-- ****************************************************************************
--
-- THE DEFECT (F2, verified in production 2026-08-09). Every re-entry to
-- onboarding soft-deletes the pending draft and generates a replacement with a
-- NEW id. Sarah's single RELEASE_GENERAL became three documents in six minutes:
--
--   62e9c1f7  DRAFT     created 04:47:25  deleted 04:48:26   signatures ever: 0
--   352ccb89  DRAFT     created 04:48:26  deleted 04:53:52   signatures ever: 0
--   54665d4d  EXECUTED  created 04:53:52  signed  04:54:22   signatures ever: 1
--
-- No signature was lost. The harm is LINK STABILITY: a document id sent in an
-- email points at a deleted row the moment the recipient reloads the page.
--
-- WHY THE DELETE EXISTS — and why "just reuse the row" reintroduces a real bug.
-- The regeneration is deliberate. Onboarding merges profile data (names,
-- addresses, emergency contacts, date of birth) into the document BODY at
-- generation time. A draft created before the member finished step 1 has empty
-- or stale tokens baked into merged_body, and nothing later refreshes them.
-- Deleting and regenerating is how that draft gets correct data. Remove the
-- delete without replacing that mechanism and members sign documents printing an
-- old address.
--
-- THE DISTINCTION IMPLEMENTED HERE: regenerate the BODY in place, keep the ROW.
--
--   1. compose_document_body(document_id, service_type) — the composition half of
--      generate_document, lifted out VERBATIM and pointed at an existing row. It
--      reads the template, contract, horse, party roster and config exactly as
--      before and returns the merged text. It writes nothing.
--
--   2. generate_document — unchanged signature, unchanged behaviour. It still
--      inserts the row, binds the horse set and seeds the parties; it now calls
--      compose_document_body for the text instead of composing inline. Every one
--      of its ten callers is untouched.
--
--   3. regenerate_document_body(document_id, service_type) — recompose an
--      existing row. If the composed body is IDENTICAL, it writes nothing at all
--      and returns false. It REFUSES to touch an EXECUTED document, and refuses
--      to touch a document carrying a live signature (rewriting a body under a
--      signature is the void_signatures_on_edit failure in another form).
--
--   4. generate_my_onboarding_documents — the pending draft is REUSED: parties
--      re-synced, horse binding refreshed, body recomposed in place. The id is
--      stable across re-entry. The delete remains ONLY as the path for a
--      document that cannot be reused.
--
-- THE ONE CASE WHERE AN ID STILL CHANGES: none in the onboarding loop. The
-- delete-and-regenerate branch now runs only when no reusable pending document
-- exists — i.e. when there is nothing to keep an id of. A pending document that
-- carries a live signature is adopted untouched (SENDGUARD §3) and is never
-- recomposed, so a signed body is never rewritten under the signer.
--
-- WHAT THE DRY-RUN PROVES (raw output in the report):
--   a. compose_document_body reproduces generate_document's body BYTE FOR BYTE —
--      regenerate on a freshly generated document reports "no change" and writes
--      nothing.
--   b. Re-entering onboarding returns THE SAME document id.
--   c. Changing a profile field that appears in the body updates the body, and
--      the id still does not change.
--   d. THE REGRESSION THE DELETE EXISTED TO PREVENT: a draft generated before the
--      profile was completed still ends up with correct merged data.
--   e. The unsigned/no-draft path and the §3 signed-document path are unchanged.
--
-- ClauseDocument.tsx is untouched. No renderer change is involved.

BEGIN;

-- ── 1. compose_document_body — generate_document's composition half, verbatim,
--       pointed at an existing row. Reads only; returns the merged text.
CREATE OR REPLACE FUNCTION public.compose_document_body(
  p_document_id uuid, p_service_type text DEFAULT NULL)
 RETURNS text
 LANGUAGE plpgsql
AS $fn$
#variable_conflict use_column
DECLARE
  v_doc     documents%ROWTYPE;
  v_tmpl    contract_templates%ROWTYPE;
  v_org_id  uuid;
  v_ctr     contracts%ROWTYPE;
  v_has_ctr boolean := false;
  v_horse   horses%ROWTYPE;
  v_horse_ids uuid[];
  v_cfg     business_config%ROWTYPE;
  v_breed   text := '';
  v_color   text := '';
  v_home_loc text := '';
  v_curr_loc text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_org     text;
  v_rate    numeric;
  v_dir     jsonb := '{}'::jsonb;
  r         record;
  m         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text; v_db text;
  v_ec1n text; v_ec1r text; v_ec1p text; v_ec2n text; v_ec2r text; v_ec2p text;
  v_ry text; v_jx text; v_rb text; v_jl text;
  v_c_phone text; v_c_email text; v_c_url text;
  v_has_minor boolean := false;
  v_is_jumper boolean := false;
  v_svc text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  v_doc_id := v_doc.id;
  v_doc_code := v_doc.display_code;

  SELECT * INTO v_tmpl FROM contract_templates WHERE id = v_doc.template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'document % has no template', p_document_id;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', v_tmpl.template_key;
  END IF;

  SELECT org_id INTO v_org_id FROM contacts WHERE id = v_doc.contact_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unknown contact: %', v_doc.contact_id;
  END IF;

  IF v_doc.contract_id IS NOT NULL THEN
    SELECT * INTO v_ctr FROM contracts WHERE id = v_doc.contract_id AND deleted_at IS NULL;
    v_has_ctr := FOUND;
  END IF;

  v_svc := coalesce(p_service_type, v_ctr.segment);

  IF v_doc.horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_doc.horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
    v_home_loc := coalesce(location_full_label(v_horse.home_location_id), '');
    v_curr_loc := coalesce(location_full_label(v_horse.current_location_id), '');
  END IF;

  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_org_id;
  SELECT value_text INTO v_c_phone FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url   FROM config_values WHERE org_id = v_org_id AND namespace = 'CONTACT' AND key = 'URL';

  IF v_has_ctr THEN
    SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
      FROM template_variants tv
      WHERE tv.template_key = v_tmpl.template_key
        AND tv.retained_by  = (v_ctr.terms ->> 'retained_by')
        AND tv.deal_side    = (v_ctr.terms ->> 'deal_side')
        AND tv.active
      LIMIT 1;
  END IF;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  v_body := v_tmpl.body;

  -- MULTI-HORSE: when this document names more than one horse, expand every
  -- contiguous run of HORSE.*-token lines into one filled copy per horse
  -- BEFORE the token loop. One horse (or none) skips this entirely, so the
  -- single-horse body is byte-for-byte what it has always been.
  v_horse_ids := document_horse_ids(v_doc_id);
  IF coalesce(array_length(v_horse_ids, 1), 0) > 1 THEN
    v_body := expand_horse_blocks(v_body, v_horse_ids);
  END IF;

  v_has_minor := EXISTS (
    SELECT 1 FROM document_parties WHERE document_id = v_doc_id AND party_role = 'PARTICIPANT');
  v_is_jumper := v_svc = 'JUMPER_TRAINING';
  FOR m IN
    SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name
  LOOP
    IF m.name IN ('EVALUATION_PERIOD','PARTIAL_LEASE','INSURANCE',
                  'MORTALITY_INSURANCE','MAJOR_MEDICAL_INSURANCE',
                  'LOSS_OF_USE_INSURANCE','COMPETITION') THEN
      CONTINUE;
    END IF;
    IF (m.name LIKE 'MINOR%' AND v_has_minor)
       OR (m.name LIKE 'JUMPER%' AND v_is_jumper) THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || m.name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || m.name || '[^>]*-->.*<!-- CUT-END: ' || m.name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

  FOR r IN
    SELECT namespace, field, token FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
    v_val := '';

    IF r.namespace = 'HORSE' THEN
      v_val := CASE r.field
        WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
        WHEN 'BARN_NAME'           THEN v_horse.nickname
        WHEN 'BREED'               THEN v_breed
        WHEN 'COLOR'               THEN v_color
        WHEN 'SEX'                 THEN v_horse.sex
        WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
        WHEN 'HEIGHT'              THEN v_horse.height
        WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
        WHEN 'MICROCHIP'           THEN v_horse.microchip_id
        WHEN 'CURRENT_LOCATION'    THEN coalesce(nullif(v_curr_loc,''), v_horse.current_location)
        WHEN 'HOME_LOCATION'       THEN v_home_loc
        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
        WHEN 'FAIR_MARKET_VALUE'   THEN fmt_money(v_horse.fair_market_value)
        WHEN 'MARKINGS'            THEN v_horse.markings
        WHEN 'PASSPORT_NUMBER'     THEN v_horse.passport_number
        WHEN 'VET_BUSINESS'        THEN v_horse.vet_business_name
        WHEN 'VET_ADDRESS'         THEN compose_vet_address(v_horse.vet_address_line1, v_horse.vet_city, v_horse.vet_state, v_horse.vet_postal)
        WHEN 'MEDICATION_NAME'         THEN horse_medications_prose(v_horse.id, 'MEDICATION')
        WHEN 'MEDICATION_DOSAGE'       THEN horse_medication_component(v_horse.id, 'DOSAGE')
        WHEN 'MEDICATION_INSTRUCTIONS' THEN horse_medication_component(v_horse.id, 'INSTRUCTIONS')
        WHEN 'MEDICATION_ADDITIONAL'   THEN horse_medication_component(v_horse.id, 'ADDITIONAL')
        WHEN 'KNOWN_CONDITIONS'        THEN v_horse.known_conditions
        WHEN 'EUTHANASIA_A' THEN CASE WHEN v_horse.euthanasia_authorization = 'A' THEN 'X' ELSE ' ' END
        WHEN 'EUTHANASIA_B' THEN CASE WHEN v_horse.euthanasia_authorization = 'B' THEN 'X' ELSE ' ' END
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      -- ENG.ID/SERVICE_TYPE/START_DATE are used by ZERO live templates; map what
      -- exists onto the contract, blank otherwise.
      v_val := CASE r.field
        WHEN 'ID'           THEN v_ctr.display_code
        WHEN 'SERVICE_TYPE' THEN v_svc
        WHEN 'START_DATE'   THEN to_char(v_ctr.effective_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        WHEN 'EFFECTIVE_DATE' THEN to_char(coalesce(
                                 (SELECT d2.effective_date FROM documents d2 WHERE d2.id = v_doc_id),
                                 (SELECT d2.created_at::date FROM documents d2 WHERE d2.id = v_doc_id),
                                 now()::date), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'ORD' THEN
      IF r.field = 'SERVICE_SELECTION' THEN
        SELECT pi.label INTO v_val FROM purchase_items pi
          JOIN purchases pu ON pu.id = pi.purchase_id
          WHERE pu.contract_id = v_doc.contract_id
          ORDER BY pi.created_at DESC LIMIT 1;
      ELSE
        v_val := CASE r.field
          WHEN 'UUID' THEN v_doc_id::text
          WHEN 'ID'   THEN v_doc_code
          ELSE '' END;
      END IF;

    ELSIF r.namespace = 'REQ' THEN
      v_val := '';

    ELSIF r.namespace = 'DIR' THEN
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      v_org := CASE r.field
        WHEN 'LEGAL_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'   THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE'  THEN v_cfg.signatory_title
        WHEN 'ADDRESS'          THEN v_cfg.business_address
        WHEN 'BRAND_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'ENTITY_FORMATION' THEN v_cfg.entity_formation
        WHEN 'REGISTERED_AGENT' THEN v_cfg.registered_agent
        WHEN 'CANCELLATION_FEE' THEN fmt_money(v_cfg.cancellation_fee)
        WHEN 'LATE_FEE'         THEN fmt_money(v_cfg.late_fee)
        WHEN 'NO_SHOW_FEE'      THEN fmt_money(v_cfg.no_show_fee)
        WHEN 'PHONE'            THEN v_c_phone
        WHEN 'EMAIL'            THEN v_c_email
        WHEN 'URL'              THEN v_c_url
        ELSE NULL END;
      IF v_org IS NULL THEN
        SELECT coalesce(cv.value_text, cv.value_num::text, cv.value_json #>> '{}')
          INTO v_org FROM config_values cv
          WHERE cv.org_id = v_org_id AND cv.namespace = 'ORG' AND cv.key = r.field;
      END IF;
      v_val := v_org;

    ELSIF r.namespace = 'TXN' THEN
      -- commission from config; deal money is filled by remerge from contract_fields.
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_svc ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_svc ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSE
        v_val := '';
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL; v_db := NULL;
      v_ec1n := NULL; v_ec1r := NULL; v_ec1p := NULL; v_ec2n := NULL; v_ec2r := NULL; v_ec2p := NULL;
      v_ry := NULL; v_jx := NULL; v_rb := NULL; v_jl := NULL;
      SELECT NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
             c.phone, c.email, c.address_composed, dp.title, dp.relationship,
             CASE WHEN c.date_of_birth IS NULL THEN NULL
                  ELSE to_char(c.date_of_birth, 'FMMonth FMDD, YYYY') END,
             c.emergency_contact_1_name, c.emergency_contact_1_relationship, c.emergency_contact_1_phone,
             c.emergency_contact_2_name, c.emergency_contact_2_relationship, c.emergency_contact_2_phone,
             c.riding_experience_years, c.jump_experience, c.riding_background, c.jump_limitations
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re, v_db,
             v_ec1n, v_ec1r, v_ec1p, v_ec2n, v_ec2r, v_ec2p,
             v_ry, v_jx, v_rb, v_jl
        FROM document_parties dp
        JOIN contacts c ON c.id = dp.contact_id
        WHERE dp.document_id = v_doc_id AND dp.party_role = r.namespace
        ORDER BY dp.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        WHEN 'DOB'          THEN v_db
        WHEN 'EMERGENCY_CONTACT_1_NAME'         THEN v_ec1n
        WHEN 'EMERGENCY_CONTACT_1_RELATIONSHIP' THEN v_ec1r
        WHEN 'EMERGENCY_CONTACT_1_PHONE'        THEN v_ec1p
        WHEN 'EMERGENCY_CONTACT_2_NAME'         THEN v_ec2n
        WHEN 'EMERGENCY_CONTACT_2_RELATIONSHIP' THEN v_ec2r
        WHEN 'EMERGENCY_CONTACT_2_PHONE'        THEN v_ec2p
        WHEN 'RIDING_EXPERIENCE_YEARS'          THEN v_ry
        WHEN 'JUMP_EXPERIENCE'                  THEN v_jx
        WHEN 'RIDING_BACKGROUND'                THEN v_rb
        WHEN 'JUMP_LIMITATIONS'                 THEN v_jl
        WHEN 'HORSE_CAPACITY' THEN CASE
          WHEN v_horse.current_owner_contact_id IS NULL THEN 'owns, leases, manages, or otherwise has authority over'
          WHEN (SELECT dp2.contact_id FROM document_parties dp2 WHERE dp2.document_id = v_doc_id AND dp2.party_role = r.namespace ORDER BY dp2.signer_order NULLS LAST LIMIT 1) = v_horse.current_owner_contact_id THEN 'owns'
          WHEN (SELECT dp2.contact_id FROM document_parties dp2 WHERE dp2.document_id = v_doc_id AND dp2.party_role = r.namespace ORDER BY dp2.signer_order NULLS LAST LIMIT 1) = v_horse.lessee_contact_id THEN 'leases'
          ELSE 'is an authorized agent of' END
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;


  RETURN v_body;
END;
$fn$;

-- ── 2. generate_document — same signature, same behaviour. It still inserts the
--       row, binds the horse set and seeds the parties; the text now comes from
--       compose_document_body instead of being composed inline. Ten callers
--       untouched.
CREATE OR REPLACE FUNCTION public.generate_document(p_contact_id uuid, p_template_key text, p_contract_id uuid, p_horse_id uuid, p_parties jsonb, p_service_type text, p_horse_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(document_id uuid, merged_body text)
 LANGUAGE plpgsql
AS $fn$
#variable_conflict use_column
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_org_id  uuid;
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  -- org from the CONTACT (was: the engagement). Explicit, not RLS-accidental.
  SELECT org_id INTO v_org_id FROM contacts WHERE id = p_contact_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unknown contact: %', p_contact_id;
  END IF;

  INSERT INTO documents (org_id, contact_id, contract_id, horse_id, template_id, title, status)
    VALUES (v_org_id, p_contact_id, p_contract_id, p_horse_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  -- MULTI-HORSE: bind the full ordered set NOW, before the body is composed,
  -- so the expander sees every horse on this one pass. One id (or none)
  -- changes nothing — the single-horse path is untouched.
  IF coalesce(array_length(p_horse_ids, 1), 0) > 1 THEN
    DELETE FROM document_horses WHERE document_id = v_doc_id;
    INSERT INTO document_horses (org_id, document_id, horse_id, position)
      SELECT v_org_id, v_doc_id, p_horse_ids[i], i
        FROM generate_subscripts(p_horse_ids, 1) AS i
      ON CONFLICT (document_id, horse_id) DO UPDATE SET position = EXCLUDED.position;
  END IF;

  -- seed the document's parties (was engagement_parties). Person + SIG tokens and
  -- signing authz all resolve from document_parties keyed by this document.
  IF p_parties IS NOT NULL THEN
    INSERT INTO document_parties (document_id, contact_id, party_role, relationship, title, is_signer, signer_order, org_id)
    SELECT v_doc_id,
           (e ->> 'contact_id')::uuid,
           e ->> 'role',
           e ->> 'relationship',
           e ->> 'title',
           COALESCE((e ->> 'is_signer')::boolean, false),
           (e ->> 'signer_order')::int,
           v_org_id
      FROM jsonb_array_elements(p_parties) e
    ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;
  END IF;

  v_body := compose_document_body(v_doc_id, p_service_type);

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;

-- ── 3. regenerate_document_body — recompose an existing row IN PLACE. Writes
--       nothing when the text is unchanged. Never touches an executed document,
--       and never rewrites a body under a live signature.
CREATE OR REPLACE FUNCTION public.regenerate_document_body(
  p_document_id uuid, p_service_type text DEFAULT NULL)
 RETURNS boolean
 LANGUAGE plpgsql
AS $fn$
DECLARE
  v_doc  documents%ROWTYPE;
  v_body text;
BEGIN
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF v_doc.status = 'EXECUTED' THEN
    RAISE EXCEPTION 'document % is executed and is never rewritten', p_document_id;
  END IF;
  IF EXISTS (SELECT 1 FROM signatures s
              WHERE s.document_id = p_document_id AND s.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'document % carries a signature and is never rewritten', p_document_id;
  END IF;

  v_body := compose_document_body(p_document_id, p_service_type);

  -- Unchanged body → no write at all. Re-entering onboarding without changing
  -- anything must leave no trace.
  IF v_body IS NOT DISTINCT FROM v_doc.merged_body THEN
    RETURN false;
  END IF;

  UPDATE documents SET merged_body = v_body, updated_at = now() WHERE id = p_document_id;
  RETURN true;
END;
$fn$;

-- ── 4. generate_my_onboarding_documents — REUSE the pending draft.
--       The delete-and-regenerate branch survives only for the case where there
--       is no reusable pending document, i.e. nothing whose id could be kept.
DO $mig$
DECLARE
  v_oid oid;
  v_src text;
  v_new text;
BEGIN
  SELECT p.oid INTO v_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents';
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'SENDGUARD2: generate_my_onboarding_documents not found';
  END IF;
  v_src := pg_get_functiondef(v_oid);

  IF v_src NOT LIKE '%a pending document carrying a LIVE SIGNATURE%' THEN
    RAISE EXCEPTION 'SENDGUARD2: SENDGUARD 3 must be applied first';
  END IF;

  -- declare the one new local the reuse block needs
  v_new := replace(v_src,
    E'  v_keep_horses uuid[];   -- the member''s bound horse set for this template\n',
    E'  v_keep_horses uuid[];   -- the member''s bound horse set for this template\n'
    || E'  v_reuse   uuid;         -- the pending document being reused in place\n');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'SENDGUARD2: declare block not matched; refusing to report a no-op as success';
  END IF;
  v_src := v_new;

  v_new := replace(v_src, '    IF v_doc IS NULL THEN
      -- carry the member''s multi-horse choice across regeneration
      SELECT dh.horses INTO v_keep_horses FROM (
', '    -- SENDGUARD 2: REUSE the pending draft. Regenerating the BODY is what keeps
    -- freshly-entered profile data correct; minting a new ROW is what broke the
    -- link in the email. Do the first, stop doing the second.
    IF v_doc IS NULL THEN
      SELECT d.id INTO v_reuse
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        WHERE d.contact_id = v_contact AND t.template_key = req.template_key
          AND d.deleted_at IS NULL AND d.status <> ''EXECUTED''
          AND NOT EXISTS (SELECT 1 FROM signatures s
                           WHERE s.document_id = d.id AND s.deleted_at IS NULL)
        ORDER BY d.created_at DESC
        LIMIT 1;

      IF v_reuse IS NOT NULL THEN
        -- the roster can have changed since the draft was made (a guardian added
        -- a minor), and the body reads from it, so re-sync BEFORE recomposing.
        INSERT INTO document_parties (document_id, contact_id, party_role, is_signer, org_id)
        SELECT v_reuse, (e ->> ''contact_id'')::uuid, e ->> ''role'',
               COALESCE((e ->> ''is_signer'')::boolean, false),
               (SELECT org_id FROM documents WHERE id = v_reuse)
          FROM jsonb_array_elements(v_parties) e
        ON CONFLICT (document_id, contact_id, party_role) DO NOTHING;

        DELETE FROM document_parties dp
         WHERE dp.document_id = v_reuse
           AND dp.party_role IN (''CLIENT'',''PARTICIPANT'')
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(v_parties) e
              WHERE (e ->> ''contact_id'')::uuid = dp.contact_id
                AND (e ->> ''role'') = dp.party_role);

        -- the horse this paperwork is about, by the same rule as generation:
        -- the member''s bound set wins, else the horse resolved above.
        SELECT array_agg(x.horse_id ORDER BY x.position) INTO v_keep_horses
          FROM document_horses x WHERE x.document_id = v_reuse;
        UPDATE documents
           SET horse_id = coalesce(v_keep_horses[1], v_horse)
         WHERE id = v_reuse
           AND horse_id IS DISTINCT FROM coalesce(v_keep_horses[1], v_horse);

        PERFORM regenerate_document_body(v_reuse, NULL::text);
        SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
          FROM documents d WHERE d.id = v_reuse;
      END IF;
      v_reuse := NULL;
    END IF;

    IF v_doc IS NULL THEN
      -- carry the member''s multi-horse choice across regeneration
      SELECT dh.horses INTO v_keep_horses FROM (
');
  IF v_new = v_src THEN
    RAISE EXCEPTION 'SENDGUARD2: reuse block not matched; refusing to report a no-op as success';
  END IF;

  EXECUTE v_new;
  RAISE NOTICE 'SENDGUARD2: generate_my_onboarding_documents rewritten';
END
$mig$;

DO $verify$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'generate_my_onboarding_documents';
  IF v_def NOT LIKE '%regenerate_document_body%' THEN
    RAISE EXCEPTION 'SENDGUARD2: the reuse path is not live';
  END IF;
END
$verify$;

COMMIT;
```

---

## 57. Deliberate re-sign workflow: record_template_version_bump, pending_version_decisions(), resolve_version_decision(), require_resign_from(), template_version_events (prod)
- reported by: docs/reports/TASK-WALLSYNC-REPORT.md [docs/reports/flagharvest-work/batch4.md#76]
- reachability: **NOT unreachable, and the "6 queued events never actioned" claim is now STALE — report this to the owner as a correction.** Verified live:
  - `template_version_events` holds **12 rows, and ZERO are unresolved**: `select count(*) filter (where resolved_at is null) as unresolved, count(*) as total from template_version_events;` → `unresolved = 0, total = 12`.
  - The original 6 (all queued 2026-07-28 04:28:34) were **resolved on 2026-08-09 15:19**, every one with `resolution = 'NONE'`, by `resolved_by = fdbdfe89-76d7-486b-b734-8e23b09e0353`. Because the resolution was NONE, `people_required = 0` on all of them — **nobody was forced to re-sign**.
  - A further 6 were auto-queued on 2026-08-12 15:07–15:08 by the `record_template_version_bump` trigger firing on the TEXTEDIT lease-trio publishes (v1→v2 then v2→v3 for `HORSE_LEASE_V2` / `_FULL` / `_SIMPLE`), and all 6 were resolved `NONE` within the same minute (15:08:14).
  - Consequently `pending_version_decisions()` returns **0 rows** today, and the UI banner that reads it is hidden by its own `if (!rows || rows.length === 0) return null;` at `src/pages/app/ops/DocumentsQueuePage.tsx:167`.
  - **A UI does surface them**: `VersionDecisions` in `src/pages/app/ops/DocumentsQueuePage.tsx:118-206`, reached from `src/lib/api.ts:823` (`pendingVersionDecisions`) / `:832` (`resolveVersionDecision`) / `:864` (`templatePastSigners`). It renders a gold banner on the Documents queue page with three controls: `Everyone re-signs`, `Choose who`, and (further down) the "No one" answer. `require_resign_from()` is deliberately NOT wrapped in the client — `src/lib/api.ts:873-876` records that `resolve_version_decision` calls it server-side for both ALL and SELECTED, so a second client entry point would be a way to bypass the audit trail.
  So: the workflow exists, has UI, and has been used 12 times — always answering "no one re-signs". **The unviewed inventory is the DECISION HISTORY, not dead machinery.**
- exists: yes — table + all four functions live in prod
- content:

**The full event table (all 12 rows, none queued):**

```
$ psql … -x -c "select * from template_version_events order by occurred_at;"

id              | 2141a1e9-de03-4c37-ac06-50543c187677
template_key    | RELEASE_PARTICIPANT
from_version    | 2
to_version      | 3
occurred_at     | 2026-07-28 04:28:34.463449+00
resolved_at     | 2026-08-09 15:19:17.941605+00
resolution      | NONE
resolved_by     | fdbdfe89-76d7-486b-b734-8e23b09e0353
people_required | 0

id              | 820a31d7-c75d-4b32-bd27-8842d7d1bb9d
template_key    | HUMAN_EMERGENCY_MEDICAL
from_version    | 1
to_version      | 2
occurred_at     | 2026-07-28 04:28:34.463449+00
resolved_at     | 2026-08-09 15:19:18.614426+00
resolution      | NONE
resolved_by     | fdbdfe89-76d7-486b-b734-8e23b09e0353
people_required | 0

id              | a9df9ea7-0420-4e06-9cab-94afb37ebf11
template_key    | HORSE_EMERGENCY_VET
from_version    | 1
to_version      | 2
occurred_at     | 2026-07-28 04:28:34.463449+00
resolved_at     | 2026-08-09 15:19:19.989418+00
resolution      | NONE
resolved_by     | fdbdfe89-76d7-486b-b734-8e23b09e0353
people_required | 0

id              | a98dda13-250e-42b9-aa0b-76873dc430fd
template_key    | RELEASE_HORSE_CARE
from_version    | 1
to_version      | 2
occurred_at     | 2026-07-28 04:28:34.463449+00
resolved_at     | 2026-08-09 15:19:20.673977+00
resolution      | NONE
resolved_by     | fdbdfe89-76d7-486b-b734-8e23b09e0353
people_required | 0

id              | 09370816-8c5b-4549-9d94-40bc0e1facf1
template_key    | COMPANY_POLICIES
from_version    | 0
to_version      | 1
occurred_at     | 2026-07-28 04:28:34.463449+00
resolved_at     | 2026-08-09 15:19:21.268643+00
resolution      | NONE
resolved_by     | fdbdfe89-76d7-486b-b734-8e23b09e0353
people_required | 0

id              | 0217f5a5-5840-4a81-9406-581d18ee758f
template_key    | FACILITY_RULES
from_version    | 0
to_version      | 1
occurred_at     | 2026-07-28 04:28:34.463449+00
resolved_at     | 2026-08-09 15:19:21.940975+00
resolution      | NONE
resolved_by     | fdbdfe89-76d7-486b-b734-8e23b09e0353
people_required | 0
```

Those are the **6 the WALLSYNC report called queued** — `RELEASE_PARTICIPANT v2→v3`, `HUMAN_EMERGENCY_MEDICAL v1→v2`, `HORSE_EMERGENCY_VET v1→v2`, `RELEASE_HORSE_CARE v1→v2`, `COMPANY_POLICIES v0→v1`, `FACILITY_RULES v0→v1`. **All six were actioned on 2026-08-09 with the answer "no one re-signs", so they would have forced a re-sign on zero documents.** The six that followed:

```
id              | f3ce615d-9f24-458c-849b-d586afedc528  HORSE_LEASE_V2      v1→v2  occurred 2026-08-12 15:07:37  resolved 15:08:14  NONE  people_required 0
id              | 8c201224-d34e-4ca1-b10a-6956f063bfa9  HORSE_LEASE_FULL    v1→v2  occurred 2026-08-12 15:07:37  resolved 15:08:14  NONE  people_required 0
id              | 674e00d7-1596-47cf-9ffd-2654d19413a4  HORSE_LEASE_SIMPLE  v1→v2  occurred 2026-08-12 15:07:37  resolved 15:08:14  NONE  people_required 0
id              | d3691fe9-e5d9-442b-bf15-25537a73b752  HORSE_LEASE_V2      v2→v3  occurred 2026-08-12 15:08:14  resolved 15:08:14  NONE  people_required 0
id              | bb0c0af8-4cef-4814-8477-11b5ab7d30c3  HORSE_LEASE_FULL    v2→v3  occurred 2026-08-12 15:08:14  resolved 15:08:14  NONE  people_required 0
id              | 7e655799-1193-4659-b9cd-c4d65256533b  HORSE_LEASE_SIMPLE  v2→v3  occurred 2026-08-12 15:08:14  resolved 15:08:14  NONE  people_required 0
```

**Which documents a re-sign would have hit:** `HORSE_LEASE_V2` carries the only live lease documents (6 of them, per artifact 50's count). Had any of those four `HORSE_LEASE_V2` / lease-fork events been answered `ALL`, `require_resign_from` would have superseded every executed, non-superseded copy of that template for every past signer. All were answered NONE, so none were touched. The 2026-07-28 six target the onboarding/release family (`RELEASE_PARTICIPANT`, `RELEASE_HORSE_CARE`, `HUMAN_EMERGENCY_MEDICAL`, `HORSE_EMERGENCY_VET`, `COMPANY_POLICIES`, `FACILITY_RULES`) — the wall-gating set, i.e. answering `ALL` there would have re-walled every member who had signed the older wording.

**Table definition:**

```
                        Table "public.template_version_events"
     Column      |           Type           | Nullable |      Default
-----------------+--------------------------+----------+-------------------
 id              | uuid                     | not null | gen_random_uuid()
 template_key    | text                     | not null |
 from_version    | integer                  |          |
 to_version      | integer                  | not null |
 occurred_at     | timestamp with time zone | not null | now()
 resolved_at     | timestamp with time zone |          |
 resolution      | text                     |          |
 resolved_by     | uuid                     |          |
 people_required | integer                  | not null | 0
Check constraints:
    "template_version_events_resolution_check" CHECK (resolution = ANY (ARRAY['ALL','SELECTED','NONE']))
Policies:
    POLICY "tve_staff" TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access())
```

**`pending_version_decisions()` — prosrc from prod:**

```sql
CREATE OR REPLACE FUNCTION public.pending_version_decisions()
 RETURNS TABLE(id uuid, template_key text, title text, from_version integer, to_version integer, occurred_at timestamp with time zone, past_signers bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.id, e.template_key, coalesce(ct.title, e.template_key),
         e.from_version, e.to_version, e.occurred_at,
         (SELECT count(DISTINCT d.contact_id)
            FROM documents d JOIN contract_templates ct2 ON ct2.id = d.template_id
           WHERE ct2.template_key = e.template_key
             AND d.status = 'EXECUTED' AND d.deleted_at IS NULL
             AND coalesce(d.signed_template_version, ct2.version) < e.to_version)
    FROM template_version_events e
    LEFT JOIN contract_templates ct ON ct.template_key = e.template_key
                                   AND ct.active AND ct.deleted_at IS NULL
   WHERE e.resolved_at IS NULL AND has_staff_access()
   ORDER BY e.occurred_at DESC
$function$
```

**`resolve_version_decision()` — prosrc from prod:**

```sql
CREATE OR REPLACE FUNCTION public.resolve_version_decision(p_event_id uuid, p_resolution text, p_contact_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_n int := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF p_resolution NOT IN ('ALL','SELECTED','NONE') THEN
    RAISE EXCEPTION 'resolution must be ALL, SELECTED or NONE (got %)', p_resolution;
  END IF;

  SELECT template_key INTO v_key FROM template_version_events
   WHERE id = p_event_id AND resolved_at IS NULL;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'no unresolved version event with id %', p_event_id;
  END IF;

  IF p_resolution = 'ALL' THEN
    SELECT require_resign_from(v_key, array_agg(s.contact_id))
      INTO v_n FROM template_past_signers(v_key) s;
  ELSIF p_resolution = 'SELECTED' THEN
    IF p_contact_ids IS NULL OR array_length(p_contact_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'SELECTED requires at least one contact';
    END IF;
    v_n := require_resign_from(v_key, p_contact_ids);
  END IF;
  -- NONE: recorded deliberately. The decision that nobody re-signs is still a
  -- decision, and leaving the event unresolved would keep nagging for it.

  UPDATE template_version_events
     SET resolved_at = now(), resolution = p_resolution,
         resolved_by = auth.uid(), people_required = coalesce(v_n, 0)
   WHERE id = p_event_id;

  RETURN coalesce(v_n, 0);
END
$function$
```

**The trigger that queues them, `record_template_version_bump()` — prosrc from prod:**

```sql
CREATE OR REPLACE FUNCTION public.record_template_version_bump()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.version IS DISTINCT FROM OLD.version AND NEW.version > coalesce(OLD.version, 0) THEN
    INSERT INTO template_version_events (template_key, from_version, to_version)
    VALUES (NEW.template_key, OLD.version, NEW.version);
  END IF;
  RETURN NEW;
END
$function$
```

**The enforcement primitive, `require_resign_from()` — prosrc from prod (this is what an `ALL` answer would have run):**

```sql
CREATE OR REPLACE FUNCTION public.require_resign_from(p_template_key text, p_contact_ids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_n int := 0;
  r   record;
  dr  record;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_templates
                  WHERE template_key = p_template_key AND active AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'no active template with key %', p_template_key;
  END IF;

  -- Only contacts in this org, and only the ones actually named.
  FOR r IN
    SELECT c.id FROM contacts c
     WHERE c.id = ANY(coalesce(p_contact_ids, '{}'::uuid[]))
       AND c.org_id = v_org AND c.deleted_at IS NULL
  LOOP
    -- 1. The obligation must exist.
    INSERT INTO contact_required_documents (contact_id, template_key, org_id)
    VALUES (r.id, p_template_key, v_org)
    ON CONFLICT DO NOTHING;

    -- 2. Supersede the executed copies that would otherwise satisfy it. This is
    --    what actually creates the demand — same mechanism as
    --    staff_assign_documents(). Evidence is retained, not deleted, and
    --    signed_template_version is left exactly as signed.
    --    Only EXECUTED documents are touched: anything mid-negotiation
    --    (AWAITING_SIGNATURE, DRAFT, …) is never written by this path.
    FOR dr IN
      SELECT d.id FROM documents d
      JOIN contract_templates ct ON ct.id = d.template_id
      WHERE d.contact_id = r.id AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status, '') <> 'superseded'
        AND ct.template_key = p_template_key
    LOOP
      UPDATE documents SET current_status = 'superseded' WHERE id = dr.id;
      PERFORM log_status_event('document', dr.id, 'superseded',
        'Re-signature required by staff decision on a template version change', v_org);
    END LOOP;

    -- Count people who genuinely owe the document now, so people_required on the
    -- resolved event is the truth rather than a count of fresh INSERTs.
    IF NOT contact_document_satisfied(r.id, p_template_key) THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;

  RETURN v_n;
END
$function$
```

**The UI that surfaces them — `src/pages/app/ops/DocumentsQueuePage.tsx:102-206`, with every user-visible copy string:**

```tsx
/**
 * VERSION-BUMP DECISION.
 *
 * When a template's version changes, the people who already signed consented to
 * DIFFERENT wording. A trigger records each bump as an unresolved event, and this
 * is where it gets answered — the owner's three choices:
 *
 *   Everyone      every past signer must re-sign
 *   Choose who    pick the subset (e.g. exclude someone mid-onboarding)
 *   No one        recorded, not merely dismissed — deciding nobody re-signs is a
 *                 real decision and should be auditable
 *
 * Requiring does not email or interrupt anyone. It adds a gating obligation, so
 * at their next sign-in they are routed through the normal flow: intake
 * pre-filled from what we hold, edit or continue, sign, into the app.
 */
function VersionDecisions() {
  …
  const load = useCallback(() => {
    pendingVersionDecisions().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  async function answer(ev: PendingVersionDecision, res: 'ALL' | 'NONE') {
    setBusy(true); setErr(null);
    try {
      await resolveVersionDecision(ev.id, res);
      setPicking(null);
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not record that decision.'));
    } finally { setBusy(false); }
  }

  async function openPicker(ev: PendingVersionDecision) {
    setPicking(ev); setSigners(null); setErr(null);
    try {
      const list = await templatePastSigners(ev.template_key);
      setSigners(list);
      // Default to everyone selected: the common case is "all but one".
      setChosen(new Set(list.map((s) => s.contact_id)));
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load past signers.'));
      setSigners([]);
    }
  }

  async function confirmSelected() {
    if (!picking) return;
    …
      await resolveVersionDecision(picking.id, 'SELECTED', Array.from(chosen));
    …
  }

  if (!rows || rows.length === 0) return null;      // <<< why the banner is invisible today

  return (
    <div className="mb-8 rounded-xl border border-gold-600/40 bg-gold-50 p-4">
      <p className="text-sm font-medium text-gold-900 mb-1">
        {rows.length} document {rows.length === 1 ? 'version needs' : 'versions need'} a decision
      </p>
      <p className="text-[12.5px] text-gold-900/85 mb-3">
        The wording changed. Anyone who signed the previous version agreed to
        different text — choose who should sign again.
      </p>
      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-white/70 rounded-lg px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-green-900 font-medium">{r.title}</span>
              <span className="text-[11.5px] text-muted">
                v{r.from_version ?? 0} → v{r.to_version}
                {` · ${r.past_signers} signed the older version`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button type="button" disabled={busy || r.past_signers === 0}
                onClick={() => void answer(r, 'ALL')}
                className="text-[11px] px-2.5 py-1 rounded-full bg-green-800 text-white hover:bg-green-700 focus-ring disabled:opacity-40">
                Everyone re-signs
              </button>
              <button type="button" disabled={busy || r.past_signers === 0}
                onClick={() => void openPicker(r)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-green-800/25 text-green-800 hover:bg-green-800/10 focus-ring disabled:opacity-40">
                Choose who
              </button>
```

And the deliberate absence of a client wrapper for `require_resign_from`, `src/lib/api.ts:872-876`:

```ts
/* … a version prompt through resolveVersionDecision(), which invokes
 * require_resign_from SERVER-SIDE for both the ALL and SELECTED cases. A second
 * … remains in the DB as the primitive resolve_version_decision builds on. */
```
