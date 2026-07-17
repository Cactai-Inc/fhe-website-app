# Contract System — Spec-Authoring Handoff

**Purpose of this document:** You (a fresh Claude thread) are being asked to help the owner author a *specification* for the contract-building feature of this app. You are **NOT** implementing anything. Your job is to interview the owner, then produce a clear written spec that a separate implementation thread can build against.

The reason this spec is needed: implementation so far has been driven by reacting to screenshots, which produced correct-but-piecemeal fixes with no single source of truth for what the contract page *should be*. The owner wants to fix that architecturally by writing the spec down first. Do not fall into the same trap — do not propose code, do not guess at layout. Extract the owner's intent and write it down precisely.

---

## What the feature is

French Heritage Equestrian (FHE) is a React/TS + Supabase equestrian app. One feature is a **contract builder**: staff originate lease / purchase / broker contracts, fill or delegate fields, negotiate with a counterparty, then lock & sign. Contracts are a "living document" — a form of structured fields that composes into legal prose.

Three contract types exist: **lease** (lessee/lessor), **purchase** (buyer/seller), **broker** (client representation). The lease is the most developed and is the one the owner is actively refining.

---

## Current architecture (factual — verified against the codebase)

### Data model
- `contract_fields` — per-document field instances. Key columns:
  - `field_key` (e.g. `TXN.FARRIER_RESPONSIBILITY`, `LESSEE.EMAIL`, `HORSE.BREED`),
    `label`, `section`, `sort_order`, `owner_role` (LESSEE/LESSOR/DEAL/…)
  - `value` (the **composed prose string** a template token consumes)
  - `structured` (jsonb — the **canonical structured value**, the source of truth)
  - `format_type` (registry key: text/phone/email/party/pair/person/currency/date/…)
  - `input_kind` (which UI control renders it)
  - `parent_field_key`, `conditional_on`, `is_optional`, `included`, `is_na`,
    `control_override`, `responsibility`
  - `pair_cost_key` / `pair_manage_key` (links a manage field to its cost field)
- `contract_field_defs` — template-level defaults that seed new documents.
- `contract_formats` — the **format registry** (24 formats). Each defines
  `label, category, input_kind, guidance, reusable_as`. Single source of truth for
  field types; powers input rendering, prose composition, and the add-field modal.
- `documents` — the document row (workflow_state, merged_body, horse_id, sent_at,
  archived_at, cancelled_at, originator, signatures…).
- `document_party_controls` — per-party controls (can_fill, can_edit_deal, can_suggest,
  can_add_clause).
- `contract_templates` — the tokenized legal body: prose with `{{TOKEN}}` substitution
  and `<!-- CUT-START/END: X -->` conditional sections.

### How prose is produced
Structure → prose is DERIVED, not typed. `compose_field_prose(format, structured, label)` turns a field's structured jsonb into the prose its `{{TOKEN}}` expects. Missing required parts render as a highlighted fill-in blank via a marker `⟦NEEDS:label⟧_____⟧` `recompose_document_fields(doc)` writes every field's `value` from its `structured`;
`remerge_contract_from_fields(doc)` calls that, then substitutes tokens into the template body → `documents.merged_body`.

### Workflow states
`editable → editing → in_review → locked → executed` (plus `void`). Also `sent_at`, `archived_at`, `cancelled_at` flags. Signing: counterparty-first when they owe input; owner reviews + signs last.

### The paired manage↔cost model (recently built)
Care items with both a "who manages" and "who pays" question (boarding, farrier, routine vet, emergency/non-routine vet, supplements) are ONE `format_type='pair'` field: a two-column mini-block — left = responsible party, right = cost defaulting to "same as
responsible party" (diverges to a specific party or a Shared % split + note only when changed). The cost field stays a live row in the DB (its own template token) but is hidden as an independent UI row and composed from the pair's structure.

### Key source files
- `src/pages/app/ContractPage.tsx` (~847 lines) — THE contract surface. Renders (in
  current order): a segmented signing-set bar (if in a set) → **`RedlineSection`
  ("Proposed changes" — pending edits/clauses + an "Add a clause" box)** → title +
  status → lifecycle banners → owner-side per-party controls + invite → horse gate →
  field sections (each via `<ContractCascade>`) → **`AddElementButton`** → lease extras
  → change-request composer → change requests → document preview → workflow/signing →
  messages.
- `src/pages/app/ops/NewContractPage.tsx` (~322) — the creation page: pick parties +
  horse + controls, "Get started" creates the doc and renders `<ContractPage embedded>`
  inline below.
- `src/components/app/ContractCascade.tsx` (~527) — the field renderer: `FieldControl`
  dispatches by `format_type` (pair→`PairControl`, party→`PartyPicker`, person/address→
  structured inputs, etc.), plus `ContractBody` (renders merged_body, highlights
  `⟦NEEDS:⟧` blanks).
- `src/components/app/AddElementModal.tsx` (~186) — `AddElementButton` + modal to add a
  section or field with placement (section + position, or insert-after) and type (from
  the format registry).
- `src/lib/contracts.ts` (~460) — types + RPC wrappers.
- Engine RPCs: `start_lease_contract`, `seed_contract_fields`, `compose_field_prose`,
  `recompose_document_fields`, `remerge_contract_from_fields`, `set_field_structured`,
  `add_contract_element`, `apply_field_formats`, `contract_document_detail`, etc.

---

## Known open problems (the owner's own words, paraphrased)

These are symptoms the owner has flagged. They are evidence of missing spec, NOT a to-do list for you — use them to probe for the underlying rules:

1. **"Proposed changes" renders as the FIRST section at the top of the page.** The owner
   does not want a standalone section there; adding things should be a *button that opens
   a configuration modal* (add section / item / field), not a persistent section. This
   implies the owner has an opinion about (a) page order, (b) what "adding" means and how
   it's surfaced, and (c) when a review/redline list should appear at all.
2. Earlier: document controls were **restated after creation** (creation page collected
   them, then the embedded contract re-showed them). Owner wants controls collected once.
3. Owner wants **every field structured/formatted** (reusable data), guidance on every
   field, and the legal prose auto-composed from structure with **missing parts
   highlighted** in the body.
4. Owner wants the **add section/item/field** flow to be a small button → modal that asks
   WHERE (between which sections / which section + position) and WHAT (dropdown / free
   text / formatted type e.g. phone, first name, company, website).

The through-line: the owner reasons about this page as an **ordered, rule-driven layout** and keeps hitting places where the implementation doesn't match an unstated model.

---

## YOUR TASK: interview, then write the spec

Produce a written **Contract Page Specification**. Do it by interviewing the owner — ask focused questions, one cluster at a time, and write down confirmed answers. Cover at minimum:

### A. Page skeleton (the big one)
The ordered, top-to-bottom list of what the owner sees when opening a contract, for each viewer type (owner/staff vs. counterparty vs. review-only). For each block: its name, its purpose in one line, and the condition under which it appears.

### B. Adding & editing structure
- What "add a section / item / field" should look like (button? where does it live?),and exactly what the modal asks.
- Is "add a clause" (free-text proposed clause) the same thing as "add a field," or separate? (This is currently ambiguous — RedlineSection has an "Add a clause" box AND there's a separate AddElementButton.)
- Where do **pending proposed changes / redlines** (counterparty proposed an edit or clause; owner accepts/rejects) belong, and when do they show?

### C. Controls & delegation
- Where per-party controls (can fill / edit terms / suggest / add clauses) are set, and whether they're ever shown again after creation.
- How "acting on behalf of a party" reads on the page.

### D. Fields, formats, guidance
- Confirm the format list the owner wants selectable (phone, email, name, company,website, currency, date, party, pair, list, dropdown, free text, …).
- The paired manage↔cost mini-block rules (defaults, when cost diverges, Shared split).
- How incomplete fields should appear in the rendered body (blank + highlight?).

### E. Lifecycle & signing
- The states, who advances them, and how send/lock/sign/execute surface on the page.

### Output format
Write the spec as a single markdown document with:
1. A **page skeleton table** (block | purpose | shown-when | viewer) per viewer type.
2. A **rules** section (the conditional logic in plain language).
3. A **components** section mapping each block to what it does (so implementation can map spec → code).
4. An explicit **"open questions / owner to decide"** list for anything unresolved.

Keep it conceptual, not code. The goal is a document the owner can read and say "yes,that's the page," which an implementation thread then builds to exactly.

### How to run the interview
- Ask 2–4 questions at a time, grounded in the current state above. Offer the owner concrete options with a recommendation when a decision has a sensible default.
- When the owner reacts to a symptom, pull it up to the rule ("so the rule is: the review list only appears when something is pending — correct?").
- Do not start writing the full spec until you've covered A–E. Then draft it, and let the owner red-line it.
