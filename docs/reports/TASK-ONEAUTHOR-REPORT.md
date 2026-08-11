# TASK ONEAUTHOR — one authoring page that arranges itself around the document

**Branch** `task/oneauthor` (worktree `~/Downloads/claude-code-repo/wt-oneauthor`), off
`origin/main` @ `a9b2042`. **Not pushed.**
**Database** `lrstswfxfsezdmvkvukc` — migration applied to production and verified.

---

## What was done

The convergence happened where the task said it would: **in the page, not the renderer.**
`ClauseDocument.tsx` and `AddElementModal.tsx` are byte-for-byte untouched, and so is
`AppLayout.tsx`. Five files changed or added:

| File | Change |
|---|---|
| `supabase/migrations/20260811T1700_oneauthor_template_surface_config.sql` | new — surface config on `contract_templates`, + 2 RPCs reissued |
| `src/lib/contracts.ts` | new `TemplateConfig` type + `DEFAULT_TEMPLATE_CONFIG`; `TemplateStructure` gains `config`; `SigningSetDoc` gains `short_label` |
| `src/components/app/FlatDocument.tsx` | new — the renderer behind the null-structure branch |
| `src/pages/app/ContractPage.tsx` | the convergence (+165 / −60) |
| `test/db/oneauthor_template_surface_config.test.ts` | new — 13 tests, migration exercised on a fresh DB |

### 1. One body slot, renderer chosen by the document

`ContractPage.tsx:498` already produced the null structure for a flat template. It now has a
renderer behind it:

```
structure present → <ClauseDocument>   (fields, clauses, Add New Item)
structure null    → <FlatDocument>     (the composed merged_body, read-only)
```

`FlatDocument` reuses `ContractBody` — the same renderer the read-only and executed frames
already use — so one document does not change appearance as it moves through its states.

This **replaced** a block that already existed but was in the wrong place: a collapsible
labelled *"Review the document text"*, sitting **below** the change-request list, positioned by
how the document happened to be built rather than by where a document belongs. It is retired
behind `INLINE_BODY_PREVIEW_RETIRED = true` (the `CONTACTS_PAGE_RETIRED` pattern), not deleted.
Nothing is lost in the move: same renderer, still collapsible, still expanded by default.

### 2. Per-type behaviour is DATA on `contract_templates`

Seven columns, sitting beside `contract_kind` / `service_type` / `wall_gating` /
`party_namespaces`, which are the same kind of thing:

```
short_label   show_comments   show_change_requests   show_history
show_party_controls   allows_co_buyer   companion_template_key
```

**Every surface column defaults TRUE, including for a `template_key` with no row at all.** An
unconfigured template — or one added next year — behaves exactly as the page behaved before
this existed. Only rows explicitly classified lose anything, and each loses only a surface it
can never fill. Every failure path in the page falls back to the same permissive default: a
lookup that did not answer must never read as *"this document has no drawers."*

**Every `if (templateKey === …)` in `ContractPage.tsx` is gone.** `templateKey` now has exactly
one use — fetching the template. The three conditionals that were there:

| was | now |
|---|---|
| `templateKey === 'HORSE_SALE_V2' \|\| templateKey === 'HORSE_BILL_OF_SALE'` (co-buyer) | `allows_co_buyer` |
| `templateKey === 'HORSE_SALE_V2'` (generate bill of sale) | `companion_template_key` |
| a 5-entry `stepLabel()` map over 26 templates | `short_label`, carried per row by `contract_signing_set` |

### 3. Which surfaces appear

The split is **standard-form** (issued as-is and signed — a release, a waiver, a policy
acknowledgment) vs **negotiated**. `wall_gating` already marks that class exactly; `MINOR_RIDER`
and `MEDIA_RELEASE` are the same shape without the flag.

Standard-form documents lose the **Requests drawer** and the **per-party controls matrix** —
there is no counterparty with standing to redline a kiosk release, so both are surfaces that
can never have contents. **Comments and Change History stay on for every template**: a staff
note and a status trail are possible on any document, and hiding a surface that *can* fill is
the opposite defect.

10 negotiated (6 clause-composed + `FACILITY_LICENSE`, `HORSE_SEARCH_RETAINER`,
`HORSE_TRANSACTION_REP`, `INDEPENDENT_CONTRACTOR`) keep everything; 10 standard-form lose the
two. **This is a starting classification carried in data — any of it is one `UPDATE` to change.**

Two deliberate non-changes:

- **The "Open change requests" LIST is not gated.** That flag governs the *compose* surface.
  The list only renders when it already has contents, so it is safe by construction, and gating
  it could strand a request raised before its template was classified. *(Verified: zero change
  requests exist on any document in production — nothing is stranded either way.)*
- **`RedlineSection` is not gated** — it already self-hides on empty (`if (!anything) return null`).

### 4. One un-gating

"Scroll to Bottom" was gated on `structure`, so it never appeared on a flat document. Jumping
to the signature block is a page affordance, not a clause-model one, and a 12,000-character
release is exactly where a reader needs it. Now gated on the document existing.

---

## The test the task set

> *One page opens a clause-composed document (lease) with full authoring, and opens a flat
> document (`RELEASE_GENERAL`) without breaking, showing only the surfaces that document can
> actually have.*

Proved against **production**, as the tenant admin, through the real RPCs:

```
FLAT  RELEASE_GENERAL (doc 54665d4d)
  sections 0 → null structure → FlatDocument     body 10,770 chars renders
  label "Visitor release"   comments ✓  history ✓   requests ✗  party-controls ✗

CLAUSE  HORSE_LEASE_V2 (live doc, in_review)
  sections 22, fields 128 → ClauseDocument
  label "Lease agreement"   requests ✓  party-controls ✓
```

Signing-set labels, on the one live multi-document set:
`Vet authorization → Care liability release` (was the same, because both happened to be 2 of
the 5 keys the old map knew — see §"one new document type away" below).

Neither path loses drawers, history, or send behaviour: `invitableRoles` is computed from
`detail.party_controls`, independent of whether the controls *card* renders, so **Send is
unaffected by hiding that card**. Verified separately that no live document has a party absent
from both `document_party_controls` and `signatures` — i.e. there is no recipient the Send list
would miss. *(0 rows.)*

**The rendered page is NOT VERIFIED.** No staff browser session exists. Everything above is
proved against SQL and a clean production bundle build.

---

## Checks

| | |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run typecheck:api` | 0 errors |
| `npm run lint` | 0 errors, 36 warnings — **identical to `origin/main`**, none in changed files |
| `npm run build` | clean, prerender + seo OK |
| new DB test (PGlite, fresh database) | **13/13 pass** |
| contract/document DB suite (11 files) | 9 failed / 2 passed — **byte-identical on `origin/main`**, pre-existing |
| migration replay on production | idempotent — second run is `UPDATE 0` ×4 |

The new test applies **the migration file itself** on top of the schema snapshot, twice, then
exercises both RPC branches. That matters: the default harness loads a snapshot rather than
replaying migrations, so a migration is not otherwise exercised at all.

**It caught a real defect in my own first draft.** I asserted that every template carried a
seeded `short_label`; the snapshot carries six templates my seed list had never heard of
(`HORSE_EVALUATION`, `RIDER_LESSON`, `HORSE_TRAINING`, `HORSEMANSHIP_TRAINING`,
`HORSE_EXERCISE`, `RIDER_LESSON_JUMPER` — none in production today). A hardcoded enumeration
that must know every key is the exact smell this task exists to remove. The column is now
documented as an **optional shorter override**, readers resolve `coalesce(short_label, title)`,
and a test inserts an unseeded template to prove it names itself. A title edited later flows
through instead of going stale against a backfilled copy.

---

## THE FOUR LEASE TEMPLATES — answered

**They are three redundant copies, created for a divergence that has not happened yet. Nothing
was deleted, as instructed.**

`HORSE_LEASE_V2`, `_FULL`, `_SIMPLE`, `_STANDARD` are **byte-for-byte identical** — the
`md5` of each one's full clause set (key + body + condition + order + section) is the same
value, `fa5326ba71f62f60743781a798274cfe`, and each carries its own physical 163 rows.

The provenance is explicit. `20260807121000_leasefork_three_lease_forks.sql` cloned V2 three
times on 2026-08-07, and says why in its own header:

> *"No content changes: the forks exist so that content work can happen on a fork without
> touching the template currently signing real leases."*
> `_STANDARD` *(insurance gates land here)*, `_FULL` *(Comprehensive)*, `_SIMPLE` *(trimmed
> later, once specced)*

Since then **every** `leasefix_*` migration — 14 of them, through
`20260811T1200_leasefix_addendum_gl_ccc_wording.sql` — has written to all four keys in
lockstep (`WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL',
'HORSE_LEASE_SIMPLE')`). That is why they have not diverged, and it is a standing cost: every
lease content change is a 4× write.

The intended divergence is specified and unbuilt — `docs/INSURANCE_BUILD_PLAN.md` line 4:
*"Target: `HORSE_LEASE_FULL` only. `HORSE_LEASE_V2` and `HORSE_LEASE_STANDARD` are not…"*

**Document counts:** `HORSE_LEASE_V2` = 6 documents. `_FULL` / `_SIMPLE` / `_STANDARD` = **0
documents each.** No signed or in-flight lease depends on any fork.

**What the picker actually shows.** Not four cards — `NewContractPage.tsx:222` renders a
`<select>` labelled "Lease version" with **five** options (`Default` + four titles), and only
when `leaseTemplates.length > 1`. Reading it, a staff member is asked to choose between
"Horse Lease Agreement", "— Standard", "— Comprehensive" and "— Simple" that all produce the
identical document. That is a confusing surface today, and it gets worse the moment one fork
diverges and the other two still do not.

**The decision is the owner's.** Three options, none taken here:
1. Build the divergence (`INSURANCE_BUILD_PLAN.md`) and the picker becomes honest.
2. Deactivate the three forks (`active = false`) until divergence — `listLeaseTemplates()`
   filters on `active`, so the picker self-hides at `length > 1` with no code change. Reversible
   with one `UPDATE`; nothing is deleted; the 0-document count makes it free.
3. Leave as-is and accept the 4× write plus the picker.

---

## FLAT → CLAUSE CONVERSION — what it would involve (reported, not started)

Not started, per the task. **The point of this convergence is that conversion now needs no page
work**: a converted template simply starts returning sections, and the same page authors it.

**The estate, measured:**

| | count | scale |
|---|---|---|
| clause-composed (active) | 6 | lease 22 sections / 163 clauses / 114 fields; sale 18/76/65; BOS 11/36/48 |
| flat with a body | 12 | 101,516 chars total, **153 numbered items**, 531 paragraph breaks, 225 merge tokens, **6 CUT blocks** |
| flat with an EMPTY body | 2 | `FACILITY_LICENSE`, `INDEPENDENT_CONTRACTOR` — see defects below |

Per template, conversion is:

1. **Decompose the prose** into `contract_section_defs` › `contract_clause_defs` rows. The
   153 numbered items are the natural clause unit; paragraph breaks (531) are the upper bound.
   Largest single job: `RELEASE_PARTICIPANT` (14,316 chars, 17 numbered items).
2. **Extract inputs** into `contract_field_defs` — `input_kind`, `value_type`, `options`,
   `required`, `responsibility`, `conditional_on`. This is the expensive half: the sale work
   produced 113 field defs for 112 clauses, roughly 1:1.
3. **Translate the conditionals.** Flat bodies gate with `<!-- CUT-START: NAME -->` comment
   blocks — only **6 exist across all 12** (`RELEASE_PARTICIPANT`, `FACILITY_RULES`,
   `RELEASE_GENERAL`, `RELEASE_JUMPER_ADDENDUM` ×1 each, `HUMAN_EMERGENCY_MEDICAL` ×2). These
   map onto `cut_name` / `conditional_on`, which the composer already honours. **Cheap** — the
   flat templates are near-unconditional prose.
4. **Re-point the token map** — 225 `{{TOKEN}}` occurrences move from body text to field defs
   and `docs/TOKEN_DICTIONARY.md` (`npm run check:tokens` is the guard).
5. **A golden-render test** per template (`golden_render.test.ts` / `sale_golden_render.test.ts`
   are the pattern) proving the composed output matches the flat body it replaced.
6. **Owner review of the composed output** — the step that actually gated the lease.

**Calibration from this repo's own history:** `HORSE_LEASE_V2` (22/163/114) took one dedicated
thread. `HORSE_SALE_V2` + `HORSE_BILL_OF_SALE` (29/112/113 combined) took one more. The 12 flat
templates carry ~153 numbered items — about **one lease's worth of clause volume, spread across
twelve documents**, so the cost is dominated by per-template setup and owner review rather than
by clause count. **Roughly 3–5 threads**, and it should be sequenced by value, not by size:

- **Convert first** — `HORSE_SEARCH_RETAINER`, `HORSE_TRANSACTION_REP`, `INDEPENDENT_CONTRACTOR`,
  `FACILITY_LICENSE`. Negotiated commercial agreements with real variable terms (27–31 tokens
  each) that today cannot be authored at all, only generated. These are where clause authoring
  earns its keep.
- **Convert later or never** — the releases and policy acknowledgments (`RELEASE_*`,
  `COMPANY_POLICIES`, `FACILITY_RULES`, the authorizations). They are standard-form: nobody
  edits them per-signature, and clause structure would buy little beyond version control.
  **61 executed documents ride on these** and are never rewritten — conversion changes only how
  the *next* one is authored.

---

## Found and NOT fixed — for the owner

1. **Two active templates compose an empty document.** `FACILITY_LICENSE` and
   `INDEPENDENT_CONTRACTOR` are `active = true`, selectable, and carry **`body = ''` and zero
   clause defs**. A document generated from either would have no text. Zero documents exist from
   both, so nothing is broken today. `FlatDocument` degrades honestly rather than rendering an
   empty frame — it says *"This document has no composed text yet"*. **These are also two of the
   four templates I recommend converting first**, which would resolve it.

2. **`listContractTemplates()` (`src/lib/api.ts:1093`) has no callers.** The only template
   picker in the app uses `listLeaseTemplates()`. Dead read path; not deleted.

3. **The ops document viewer offers signing the server refuses.** `SigningPanel`
   (`/app/ops/documents/:id`) presents a sign box for **every** unsigned party. But
   `record_signature()` admits staff only when the party is the org's **own company contact** —
   any other role raises `'not a signer on this document in role %'`. `ContractPage` gets this
   right (TASK COSIGN restricted its affordance to `company_signable_roles`); the ops viewer was
   never updated to match. **This is an affordance that fails on click**, and it is the same
   class of defect as a drawer that opens onto nothing.

4. **Routing was deliberately left alone — the one line that finishes the convergence is the
   owner's call.** Today `DocumentQueueTable.tsx:50` sends a document to `/app/contracts/:id`
   only when `contract_id` is set; otherwise to the read-only ops viewer. `DocumentViewerPage`
   redirects on the same test. So flat documents reach the one page only by direct URL, or as
   the **2 live flat documents that do carry a `contract_id`** (`RELEASE_HORSE_CARE` +
   `HORSE_EMERGENCY_VET` on contract `ae4ffe95`) — both of which now render through the new
   path. Flipping that line would route the whole estate to the one page.

   **I did not flip it**, because the ops viewer carries one capability `ContractPage` does not:
   `DeliveryPanel`, which records `document_deliveries` on the `MAIL` / `PORTAL` / `DOWNLOAD`
   channels. *(Caveat: all 49 live delivery rows are `EMAIL`, which `ContractPage`'s
   `SendCopiesMenu` already covers — so the gap is real in the schema and nominal in practice.)*
   Finding 3 means the viewer's other panel is a liability, not a capability. **Recommendation:
   port `DeliveryPanel` onto the one page, then flip the line and retire the viewer behind a
   boolean.**

5. **Every lease content change is a 4× write** — see the four-lease section.

## Nav changes

**None required.** `AppLayout.tsx` was not opened. Both documents open at the existing
`/app/contracts/:id` route; no new route, no new nav item. The only navigation question is
finding 4, which is a routing target, not a nav change.
