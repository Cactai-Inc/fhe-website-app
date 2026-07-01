# Contract Module Architecture — Search / Transaction / Evaluation

Status: **SPEC (owner-directed correction, 2026-06-30). Not yet implemented — queued as build work.**
Authority: sits under the 13-service catalog (§10 of DATABASE_SECURITY_AND_PERMISSION_MODEL.md) and the MERGE_TOKEN_DICTIONARY. Legal-body rewrites require owner + attorney sign-off (same gate as the liability-release decision).

## The problem

The contract templates in `supabase/contract_templates/` conflate agreements that are **executed separately** and only *sometimes* strung together. The owner flagged this reviewing `HORSE_SEARCH_RETAINER.md` and `HORSE_REPRESENTATION.md`: what reads as ~2 documents is really **3 layers / 4+ modules**.

Two independent facts drive the decomposition:
- A **search** has no guarantee of a result, and even a successful result has no guarantee the party consummates a deal. Each module is therefore **separately executed** — search, evaluation, and transaction rep are distinct agreements, entered (and terminating) on their own terms. This is about *separable execution*, NOT about which fees a document may contain: a search retainer may still carry a success/acquisition fee (see revenue chain below).
- The **same** service runs on either side of a deal and in either direction (buy / sell / lease-in / lease-out). Which words appear must be **token-driven by who retains us and which side they're on** — not hard-coded per document.

### Staged revenue chain (expected happy path)
The modules are separate agreements but form one intended engagement journey, each stage independently billed:
1. **Search** — flat search retainer fee at retention; the retainer **may also carry a success/acquisition fee** payable if the search yields a horse the client acquires.
2. **Evaluation** — a **per-horse** evaluation fee, charged for each horse evaluated during/after the search.
3. **Transaction representation** — a representation fee for handling the actual purchase / sale / lease.
4. **Downstream services (upsell)** — the same client is expected to convert into ongoing services: lessons, horse training, clipping, and exercise / care coverage when they need it.

Because each stage is separately executed, a client may enter or exit at any stage (see engagement shapes) — but the model and pricing should assume and encourage the full chain plus downstream conversion.

The 13-service catalog already models this correctly (six representation services below). The **contract templates lag the catalog** — this spec closes that gap.

## Target: three module layers

### Layer 1 — Search / Sourcing Retainer  (service: `HORSE_FINDER`)
Retained to **find** something. Standalone agreement. Explicit "no result guaranteed / no consummation guaranteed" recitals. Four directional variants, one tokenized template:

| Variant | Retained by | Looking for | Terminology |
|---|---|---|---|
| Find a horse to buy | prospective buyer | a horse | purchase |
| Find a horse to lease | prospective lessee | a horse | lease (lessee) |
| Find a buyer | current owner | a buyer | sale |
| Find a lessee | current owner | a lessee | lease (lessor) |

Fixes required:
- `HORSE_SEARCH_RETAINER.md` — the fix is NOT to strip fees. **Keep** the flat search retainer fee AND the optional success/acquisition fee (both are legitimately part of the search agreement). What's wrong is that it reads as if the search *is* the transaction. Reframe it as a standalone search module whose success fee is contingent on an acquisition that a **separate** transaction-representation agreement (Layer 2) actually handles. Search fee and evaluation fee and representation fee are three distinct charges across three modules.
- `HORSE_REPRESENTATION.md` is really just the **lease-flavored** search+placement bundle. Collapse it into the tokenized `HORSE_FINDER` template (lease direction) rather than keeping a parallel document.
- Extend `HORSE_FINDER` service description to cover **owner-side** sourcing (find a buyer / lessee), not just buyer-side "sourcing horses."

### Layer 2 — Transaction Representation  (per side, standalone)
Represents a party in an **actual deal**. A separate agreement, executed after a search *or* entered fresh mid-way (client already found the horse). Side-scoped modules:

| Module | Service code | Side |
|---|---|---|
| Purchase representation | `HORSE_PURCHASE_ASSISTANCE` | buyer |
| Sale representation | `HORSE_SALE_ASSISTANCE` | seller |
| Lease representation | `HORSE_LEASE_IN_ASSISTANCE` / `HORSE_LEASE_OUT_ASSISTANCE` | lessee / lessor |

Current templates `HORSE_PURCHASE_SALE.md`, `HORSE_SALE_TRANSFER.md`, `HORSE_LEASE.md` are **dual-party deal bundles**, not clean side-scoped *representation* modules. Rework so each represents our client's side; dual-party execution is a composition of two side modules (or a token flag), not a separate hard-coded doc.

### Layer 3 — Evaluation  (service: `HORSE_EVALUATION`)
`HORSE_EVALUATION.md` is currently titled "Pre-Purchase." Reposition as **transaction-agnostic**: evaluate a horse being purchased, sold, leased-in, or leased-out. Terminology token-driven by retaining party + side. Slots anywhere in a sequence (typically before a transaction, but not exclusively).

## Engagement shapes the model must support
- **Singular** — one module only (e.g. just an evaluation).
- **Dual-party** — FHE represents/relates to both sides of one deal.
- **Sequential** — search → evaluation → transaction rep, chained.
- **Partial sequential** — NOT every chain is full-scope: some **start mid-way** (client already has the horse → transaction rep only) and some **exit mid-way** (search finds nothing, or a horse is found but no deal closes). The data model (engagements + parties + transactions) must not assume a full pipeline.

## Current → target mapping (for the implementer)

| Current template (`contract_templates/`) | Disposition |
|---|---|
| `HORSE_SEARCH_RETAINER.md` | → Layer 1 `HORSE_FINDER`, tokenized; **remove bundled success/acquisition fee** |
| `HORSE_REPRESENTATION.md` | → fold into Layer 1 `HORSE_FINDER` (lease direction); retire as a separate doc |
| `HORSE_PURCHASE_SALE.md` | → Layer 2 purchase (buyer) representation, side-scoped |
| `HORSE_SALE_TRANSFER.md` | → Layer 2 sale (seller) representation, side-scoped |
| `HORSE_LEASE.md` | → Layer 2 lease representation (lease-in / lease-out via token) |
| `HORSE_EVALUATION.md` | → Layer 3, retitle transaction-agnostic |

## Implementation notes / guardrails
- **Do NOT edit the `contract_templates/*.md` bodies with banners or comments.** Migration `20260629100000_load_contract_bodies.sql` loads them **verbatim** into the DB as contract bodies; stray text would leak into generated documents.
- Template registration lives in `20260629040000_contract_templates_tokens.sql` (`contract_templates` table: `template_key`, `service_type`, `party_namespaces`). Re-register modules here.
- Keep all terminology switches in **tokens** per `MERGE_TOKEN_DICTIONARY.md`; no hard-coded buy/sell/lease wording.
- Preserve the deterministic `generate_document` merge seam (migration 18) — no AI.
- Sequence relationships between modules belong in the **engagement / transaction** data model, not inside the contract bodies.
