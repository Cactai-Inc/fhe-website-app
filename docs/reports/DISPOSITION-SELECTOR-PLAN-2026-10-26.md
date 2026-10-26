# Paperwork-timing selector — investigation & plan (2026-10-26)

The "when do they need to sign?" selector on a new account's onboarding paperwork:
it doesn't hold the selection, and we need it to be a standalone, persisted setting
that defers to a sensible system default and never fights the contract-first flow.

---

## Part 1 — Findings (contract flow first, as asked)

### 1a. The contract-first flow we established today — confirmed, and one caveat

**Confirmed: CONTRACT FIRST, ALWAYS.** A party reviews and signs the contract, and a
party who owes onboarding flows *from the contract into onboarding after signing*.
Routing is template-agnostic (lease / sale / BOS all ride the same
`document_parties` + contract-invite spine). On final signature, **one bundled email**
carrying a copy of each signed document is sent (`document_delivery_holds` keeps a hold
open mid-run; `deliver_executed_document_set` POSTs the whole set as one request). All
of this is independent of the disposition selector.

**Caveat you should know before we plan — the hard "cannot do anything else until the
documents are signed" is NOT what ships today.** Two gates that used to enforce it were
deliberately removed:

- The **contract-page** document gate is retired (`CONTRACT_ONBOARDING_GATE_RETIRED =
  true`, owner ruling 2026-08-22).
- The **app-layout wall redirect is DOWN** (CR-123·A1, owner 2026-09-06 — it had bounced
  Pamela Godde out of her own lease). `AppLayout.tsx:1731` now only *remembers* where the
  member was headed; it no longer forces them into onboarding.

So as shipped, after the contract is signed the documents are **surfaced but skippable**
(a dismissible banner that returns every sign-in), not a hard block. The wall *state* is
still computed (`my_wall_state`/`contact_document_wall_state`); only the forced
navigation is gone.

**This matters for your request:** your "AT_LOGIN = they can't do anything until signed"
intent is exactly the hard wall that is currently down. The selector can still *record*
AT_LOGIN and we can re-arm enforcement for that disposition specifically — but that is a
decision to make deliberately (it's the behaviour that caused CR-121), not something the
selector quietly turns back on. I flag it rather than assume it.

### 1b. Why the selection doesn't save — confirmed, exactly as you suspected

- The selector is **local component state** in `ClientRecordActions.tsx`
  (`useState<DocumentDisposition>('WHEN_READY')`), re-initialised to `WHEN_READY` every
  time the modal opens.
- It is persisted **only as a side effect of "Ask them to sign"** —
  `requestDocumentsFromContact(contactId, assigned, disposition)` →
  `/api/documents-requested` → `request_documents_from_contact(…, p_disposition)`, which
  writes `contact_required_documents.disposition`. No selection, no send ⇒ no save.
- There is **no read-back**: the modal never loads the current stored disposition, so even
  a previously-saved value shows as `WHEN_READY`.

### 1c. The data model behind the three options

`contact_required_documents.disposition` — `text NOT NULL DEFAULT 'AT_LOGIN'`,
`CHECK IN ('AT_LOGIN','WITH_CONTRACT','WHEN_READY')`. Per-assignment (per contact ×
template), not per account.

| Disposition | Wall treatment (`contact_document_wall_state`) | Meaning |
|---|---|---|
| `AT_LOGIN` | counted as **`gating`** (hard wall — *would* block, but the redirect is down) | must sign before using the app |
| `WHEN_READY` | counted as **`waiting`** (soft — dismissible banner every sign-in) | asked, not demanded; may leave for later |
| `WITH_CONTRACT` | **excluded from the wall** ("not owed yet — arrives with the deal, on execution") | held until the contract executes, signed with it |

**Readers of the column:** `contact_document_wall_state` (the wall), `contract_send_state`
(staff sequencing view), `required_templates_for_contact` (onboarding's owed list — also
excludes WITH_CONTRACT), `_waiting_items`, plus the assignment writers
(`request_documents_from_contact`, `apply_offering_documents`).

### 1d. What assigns documents, and with which disposition today

- **Contract parties** (`redeem_contract_invitation`): assigns **nothing** automatically —
  it passes an *explicit empty array* to `apply_category_documents` (PARTYROLE fix). "A
  party's document set is decided by staff, never here." So a pure contract party owes only
  what staff assign.
- **A purchase/order** (`trg_documents_when_order_opens`): assigns offering documents as
  **`WHEN_READY`** — "asks, surfaces every sign-in." (Not AT_LOGIN, despite the column
  default.)
- **Staff assignment** (this selector): whatever staff pick — else the modal's local
  default `WHEN_READY`, written only on send.
- **Column default** `AT_LOGIN` applies only where an INSERT omits the column (e.g.
  `apply_category_documents`).

### 1e. The gap vs. your design

You want a **four-state** model: an *unset* natural state that defers to a
system-designated flow, plus the three explicit choices. Today there are only **three**
states and **no unset** — the column is `NOT NULL DEFAULT 'AT_LOGIN'`, so "I didn't choose"
silently becomes the hard-wall value. Prod today: 135 `AT_LOGIN`, 2 `WITH_CONTRACT`, 0
`WHEN_READY`.

**Does the selector interfere with the contract-first flow?** As it stands, **no** — a
contract party is assigned nothing on redemption, and the bundle/ordering logic never reads
disposition. The risk is entirely in what we *add*: if a standalone selector starts writing
a disposition onto a contract party's documents, `WITH_CONTRACT` and the new ordering rule
you describe must be wired so they *reorder/bundle* rather than *gate*, and the default must
be the unset "system flow", never AT_LOGIN.

---

## Part 2 — The plan

### Goal
Make the timing a **standalone, persisted, read-back setting** with a natural **unset**
state that defers to a system-designated flow, and make its explicit values cooperate with
— never fight — the contract-first flow. One email on final contract signature stays.

### The four states (proposed)

| State | Stored as | No contract present | Contract present |
|---|---|---|---|
| **Unset** (natural default) | `NULL` (new) | surfaced at every sign-in until complete (today's WHEN_READY-soft behaviour), **required** while something else drives it | **after** the contract is signed, immediately, as the contract flow already does — bundled on final signature |
| **At login** | `AT_LOGIN` | hard: must sign before using the app | (see Part 1a — hard enforcement is a separate re-arm decision) |
| **When ready** | `WHEN_READY` | optional — completion not required unless something else drives it (e.g. a booking they're requesting) | optional, after the contract |
| **With / before contract** | `WITH_CONTRACT` (+ an order flag, below) | n/a (no contract) | **before** the contract — switches the order so paperwork signs first, then the contract; still one bundled email on the contract's final signature |

Note the two senses the current `WITH_CONTRACT` conflates: today it means "held until the
contract, signed *with* it (after)". Your request adds "*before* the contract." So we need a
small amount of extra state — see step 3.

### Steps

**1. Schema — add the unset state.**
Make `disposition` nullable (drop `NOT NULL`, drop the default), keep the CHECK but allow
NULL. Backfill: today's rows are real staff/purchase choices — leave them as-is. New
assignments that don't specify a disposition store `NULL` = "system flow". Migration is
additive and in the established journal style.

**2. The resolver — one place that turns (disposition, has-contract, other-drivers) into
behaviour.**
A single function `effective_document_requirement(contact, template)` (or extend
`contact_document_wall_state`) that encodes the table above: NULL defers to the system flow
(contract → after; no contract → surfaced-every-login, required only while a driver exists);
AT_LOGIN/WHEN_READY/WITH_CONTRACT as described. Every reader (wall, onboarding list,
contract send-state) goes through it, so the rules live in exactly one spot.

**3. Ordering for the contract case.**
Add a boolean (e.g. `sign_before_contract`) on the assignment, meaningful only when a
contract is present. Default false = the established "docs after the contract" order; true =
"docs before, then contract." The contract flow reads it to decide sequence; the bundled
one-email-on-final-signature is unchanged either way. (Alternatively a fourth enum value
`BEFORE_CONTRACT` — I lean to the boolean so the three existing values keep their current
meaning and the migration is smaller.)

**4. Decouple the selector from "send" + add read-back (the actual bug you hit).**
- On modal open, **load** the stored disposition for the assignment(s) and show it.
- Add a **Save** affordance (or autosave on change, matching the D34 persist-vs-commit rule
  — closing keeps it, the explicit control commits) that writes disposition **without**
  sending anything. A thin RPC `set_document_disposition(contact, template_keys,
  disposition, sign_before_contract)` — or widen `request_documents_from_contact` to a
  no-send mode. "Ask them to sign" keeps working but no longer *owns* the setting.
- Add the fourth "**Use the standard flow (unset)**" option to the `<select>` and the
  `DocumentDisposition` type, mapping to `NULL`.

**5. Make "required vs optional" honest for the unset/WHEN_READY cases.**
"Optional unless something else drives it" needs the driver check: a `WHEN_READY`/unset doc
becomes required when a purchase/booking depends on it. `_waiting_items` and the booking
gate already know about service-driven requirements; wire the resolver (step 2) to escalate
those to required while the driver is open, and relax when it's gone.

**6. Guardrails / tests.**
- A contract party with an **unset** disposition must behave exactly like today's
  contract-first flow (prove: no pre-contract gate, docs after signing, one bundled email).
- `WITH_CONTRACT` + `sign_before_contract=true` reorders to docs-first, still one email.
- Changing the selector **without** clicking send persists and reads back.
- Re-arming AT_LOGIN enforcement (if you want it) is isolated behind one flag and does not
  resurrect the CR-121 lease-bounce — i.e. it never applies to the contract a party is
  actively signing.

### Open decision for you
Do you want **AT_LOGIN to actually hard-block again** (it's currently computed but not
enforced — the wall redirect is down since CR-123)? The selector can record it regardless,
but turning the hard block back on is the behaviour that caused the Pamela Godde bounce, so
I want your explicit call before re-arming it, and only in a way that never catches the
contract a party is mid-signing.

### Scope touched
`contact_required_documents` (nullable disposition + ordering flag) · one resolver function
+ the three readers routed through it · `trg_documents_when_order_opens` and
`apply_offering_documents` left as-is (they already choose sensible values) ·
`ClientRecordActions.tsx` (read-back, Save, fourth option) · `src/lib/admin.ts`
(`DocumentDisposition` + label) · a no-send disposition RPC · `api/documents-requested`
unchanged for the send path. No change to the bundle/delivery mechanism.
