# LEASEFIX batch 2 — the insurance section (13.2 / 13.3 / 13.4 / 13.5)

Owner spec 2026-08-09. Batch 1 (11.x / 12.x) is applied and committed as `a184f3a`.
This document holds the **draft contract language** and the control structure for the
insurance rework. **Nothing here is applied yet — the prose needs owner sign-off first,
because it becomes binding text in a lease awaiting execution (Sarah Morgan,
`DOC-J7NXZDHD5F`).**

Owner decisions carried in from the Q&A:

- The `TXN.*_LESSEE_RESPONSIBLE` certify checkboxes are **removed**, not fixed. The
  responsibility text is driven by the party's own election, so no one is asked to
  check a box asserting something the election already says. This resolves the
  party-exclusive collision (`contract_document_detail` F1/D4) without weakening it —
  genuine acceptances (deductible share, mortality cost share, CCC cost) stay as real
  LESSEE-owned checkboxes.
- Full leases are **disabled**: an owner's existing mortality policy is void on a full
  lease, so the whole full-lease insurance set is different work. `TXN.LEASE_TYPE`
  offers PARTIAL only, and defaults to PARTIAL, until that set is built.
- `INSURANCE_RISK.COORDINATION` is **deleted**. Its substance is replaced by the
  negligence rule inside the CCC clause.

---

## 13.2 General Liability Insurance

### Control structure

| Field | Owner | Kind | Gate |
|---|---|---|---|
| `TXN.GL_LESSOR_ELECTION` | LESSOR | select (4) | — |
| `TXN.GL_LESSEE_ELECTION` | LESSOR | select (3) | Lessor election ≠ `NOT_REQ_FULL` |
| `TXN.GL_DED_RESP` | LESSOR | select (4) | Lessor election ∈ (`HAS`,`WILL_OBTAIN`) |
| `TXN.GL_DED_RESP_SPLIT_LESSOR/LESSEE` | LESSOR | text | + `GL_DED_RESP` = `SPLIT` |
| `TXN.GL_DED_LESSEE_ACCEPT` | **LESSEE** | certify | `GL_DED_RESP` ∈ (`LESSEE`,`SPLIT`) |

Retired: `TXN.GL_NOT_REQUIRED`, `TXN.GL_LESSOR_STATUS`, `TXN.GL_LESSEE_STATUS`,
`TXN.GL_LESSEE_RESPONSIBLE`.

`TXN.GL_LESSOR_ELECTION` options:

- `NOT_REQ_FULL` — Does not require general liability insurance; Lessor accepts full responsibility
- `NOT_REQ_FAULT` — Does not require general liability insurance; each party bears its own at-fault costs
- `HAS` — Has and will maintain general liability insurance
- `WILL_OBTAIN` — Will obtain and will maintain general liability insurance

`TXN.GL_LESSEE_ELECTION` options:

- `ACCEPT_FAULT` — Accepts responsibility for at-fault costs; does not carry general liability insurance
- `HAS` — Has and will maintain general liability insurance
- `WILL_OBTAIN` — Will obtain and will maintain general liability insurance

### Draft prose

**A — `NOT_REQ_FULL`** (unchanged from the current `GL_NONE`):

> Lessor has elected not to require general liability insurance under this Agreement.
> Lessor accepts full risk and responsibility for liability claims for bodily injury or
> property damage to third parties arising from the Horse or the activities contemplated
> by this Agreement, except as otherwise expressly allocated in this Agreement.

**B — `NOT_REQ_FAULT`** (A plus the at-fault caveat):

> Lessor has elected not to require general liability insurance under this Agreement.
> Lessor accepts risk and responsibility for liability claims for bodily injury or
> property damage to third parties arising from the Horse or the activities contemplated
> by this Agreement, except for any such claim arising from an event for which Lessee is
> at fault, and except as otherwise expressly allocated in this Agreement. Each party is
> responsible for the costs of any claim arising from an event for which that party is at
> fault.

**C — `HAS`:**

> Lessor has and will maintain general liability insurance covering the Horse and the
> activities contemplated by this Agreement for the duration of this Agreement, and shall
> provide proof of coverage to Lessee upon request.

**C — `WILL_OBTAIN`:**

> Lessor will obtain and will maintain general liability insurance covering the Horse and
> the activities contemplated by this Agreement, effective no later than the commencement
> of this Agreement and for its duration, and shall provide proof of coverage to Lessee
> upon request.

**Lessor responsibility — derived, gated on `HAS` or `WILL_OBTAIN`:**

> Lessor accepts financial responsibility for general liability insurance under this
> Agreement. As between the parties, and except as otherwise expressly allocated in this
> Agreement, Lessor bears responsibility for liability claims for bodily injury or
> property damage to third parties arising from the Horse or the activities contemplated
> by this Agreement to the extent not covered by an in-force policy.

**Lessee — `ACCEPT_FAULT`:**

> Lessee does not carry general liability insurance under this Agreement. Lessee accepts
> financial responsibility for liability claims for bodily injury or property damage to
> third parties arising from an event for which Lessee is at fault, except as otherwise
> expressly allocated in this Agreement.

**Lessee — `HAS` / `WILL_OBTAIN`:** mirrors of the Lessor wording, then the derived
responsibility paragraph (the current `GL_LESSEE_RESP` text, with "has elected to accept,
and hereby accepts" dropped — it is no longer an act of election):

> Lessee accepts financial responsibility for general liability insurance under this
> Agreement. Lessee shall maintain, at Lessee's sole cost, general liability insurance
> covering the Horse and the activities contemplated by this Agreement for the duration
> of this Agreement, and shall provide proof of coverage to Lessor upon request. As
> between the parties, and except as otherwise expressly allocated in this Agreement,
> Lessee bears responsibility for liability claims for bodily injury or property damage
> to third parties arising from the Horse or the activities contemplated by this
> Agreement to the extent not covered by an in-force policy.

**Deductible acceptance — real LESSEE checkbox, gated on `LESSEE` or `SPLIT`:**

> Lessee accepts responsibility for the share of any deductible allocated to Lessee above,
> for claims arising from events for which Lessee bears responsibility.

---

## 13.2(cont.) Care, Custody and Control — folded in, ENTITY Lessee only

Every control and clause below is additionally gated on `LESSEE.PARTY_TYPE = ENTITY`.

`TXN.CCC_REQUIRED` (LESSOR, select):

- `NO` — Lessor does not require Lessee to have Care, Custody and Control insurance
- `YES` — Lessor requires Lessee to have Care, Custody and Control insurance for the duration of this lease agreement

**`NO`:**

> Lessor does not require Lessee to carry care, custody and control insurance under this
> Agreement.

**`YES` — the whole clause, replacing both the old CCC text and 13.6 Coordination of
Coverage:**

> Lessor requires Lessee to have care, custody and control insurance for the duration of
> this Agreement. Care, custody and control insurance applies only where loss of, injury
> to, or death of the Horse is caused by Lessee's negligence. It shall not be claimed
> against merely because other coverage is unavailable, is not in force, or has denied a
> claim. Where a loss is caused by Lessee's negligence, care, custody and control
> insurance is the policy to be claimed against for that loss, and no other policy shall
> be claimed against for it.

Then, gated on `YES`:

- `TXN.CCC_LESSEE_ACCEPT` (**LESSEE** certify) — "Lessee accepts financial responsibility
  for the cost of care, custody and control insurance under this Agreement."
- `TXN.CCC_LESSEE_STATUS` (LESSEE select) — has and will maintain / will obtain and will maintain.

**Deleted:** `INSURANCE_RISK.COORDINATION`. Its first sentence (Lessor bears loss, mortality
responds first) is preserved in 13.3; the rest is superseded by the negligence rule above.

---

## 13.3 Mortality Insurance (partial lease)

`TXN.MORT_ELECTION` (LESSOR): `NOT_REQUIRED` / `REQUIRED`.
Retired: `TXN.MORT_NOT_REQUIRED`, `TXN.MORT_LESSEE_STATUS`, `TXN.MORT_LESSEE_RESPONSIBLE`.
The Lessee can no longer elect to carry mortality — on a partial lease only the Lessor can.

**`NOT_REQUIRED`:**

> Lessor does not require mortality insurance on the Horse under this Agreement.

**`REQUIRED`:** `TXN.MORT_LESSOR_STATUS` (currently has / will obtain):

> Lessor requires mortality insurance on the Horse for the duration of this Agreement.
> Lessor {{status}} such a policy. Lessor bears responsibility for loss of, injury to, or
> death of the Horse, and Lessor's mortality policy shall be the first policy noticed and
> claimed against for any such covered event.

`TXN.MORT_COST_RESP` (LESSOR): `LESSOR_FULL` / `LESSEE` / `SPLIT`

> The cost of the policy is {{the full responsibility of Lessor | the responsibility of
> Lessee | to be split by the parties as set out below}}.

`SPLIT` reveals `TXN.MORT_COST_SPLIT_LESSOR` and `..._LESSEE`, each accepting a `$` amount
or a `%`. **Remaining-amount rule (owner's suggestion, adopted):** if one party's share is
entered as a `$` amount and the other's is left blank, the other prints as "the remaining
balance of the premium".

`TXN.MORT_POLICY_COST` (optional) prints its own line, and when the cost is known **and**
Lessee carries a share, the allocation is computed:

> Cost of the policy: $X. Lessor's share: $A. Lessee's share: $B.

**Disclaimer — gated on cost responsibility being `LESSEE` or `SPLIT`:**

> Lessee's obligation to contribute to the cost of this policy exists only while this
> Agreement is in effect and ends upon the termination or expiration of this Agreement,
> however arising. The cost of the policy is subject to change. Where the parties' shares
> are stated as percentages, those percentages shall govern the allocation of any change
> in the cost of the policy.

`TXN.MORT_LESSEE_ACCEPT` (**LESSEE** certify, same gate):

> Lessee accepts financial responsibility for Lessee's share of the cost of mortality
> insurance as stated above.

---

## 13.4 Medical Insurance

Gated entirely on the mortality election, because medical is only ever a component added
to a mortality policy.

**Mortality `NOT_REQUIRED` → 13.4 prints, and says why it is empty:**

> Not applicable. Medical coverage is available only as a component of a mortality policy
> on the Horse. Because no mortality insurance is required or in force under this
> Agreement, no medical coverage is available.

**Mortality `REQUIRED` →** `TXN.MED_INCLUDED` (LESSOR, yes/no): "Medical coverage is
included on the mortality policy." `YES` reproduces the 13.3 shape exactly — cost
responsibility, split, policy cost with computed allocation, the same disclaimer, and the
same LESSEE acceptance checkbox. `NO` prints:

> Medical coverage is not included on the mortality policy for the Horse under this
> Agreement.

---

## Machinery this needs

1. **`contract_lock_blockers` D3 rewrite.** The current rule keys off
   `*_LESSOR_STATUS = NONE AND *_LESSEE_STATUS = NONE AND NOT *_NOT_REQUIRED AND NOT
   *_LESSEE_RESPONSIBLE`. Every one of those keys is retired. The replacement: GL is
   unresolved unless a Lessor election is made, and unless a Lessee election is made
   whenever the Lessor election is not `NOT_REQ_FULL`; mortality is unresolved without an
   election; the LESSEE acceptance checkboxes must be checked wherever their gate is on.
2. **Computed allocation.** The engine has no arithmetic today. A composer runs at
   remerge, parses `TXN.MORT_POLICY_COST` and the two share fields, and writes the
   allocation line. `%` shares compute both sides; a `$` share on one side computes the
   other as the remainder; mixed or unparseable input prints the shares verbatim with no
   computed line rather than guessing.
3. **`default_value` on `contract_field_defs`** (nullable, no behaviour change where
   unset), honoured by `start_lease_contract_v2`, so `TXN.LEASE_TYPE` seeds as `PARTIAL`.
4. **Backfill.** After applying: `sync_contract_fields_from_defs()` +
   `remerge_contract_from_clauses()` over the three live non-executed leases. Retiring the
   old GL/MORT/MED keys means sync will DELETE those rows and the answers on them — owner
   has confirmed this is intended (the live leases are samples plus one awaiting this
   update before execution).
