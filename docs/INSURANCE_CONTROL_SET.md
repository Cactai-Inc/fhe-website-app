# Insurance obligations — governing control set

**Status: FOR REVIEW. Do not implement any of this yet.**
Owner-supplied legal research (2026-08-06) translated into the condition sets the
contract engine must enforce. Reviewed and revised before a line is built.

---

## 0. The architectural finding — read this first

The existing engine gates **visibility**: `conditional_on` decides whether a field
renders. This control set needs something the engine does not currently have — gating
of **legality**. Three distinct outcomes must be expressible per party per insurance
type:

| State | Meaning | Required UI behaviour |
|---|---|---|
| **MANDATORY** | This party must carry it; the lease cannot elect otherwise | Election forced on, not merely defaulted; cannot be unchecked |
| **PERMITTED** | May be elected, and the Lessor may require it of the Lessee | Normal selectable control |
| **PROHIBITED** | Cannot lawfully be elected — insurer would deny, or no insurable interest exists | Option **removed or blocked**, with the reason stated |

Hiding a PROHIBITED option is not sufficient and is arguably worse: a Lessor who cannot
see the option does not learn *why* it is unavailable, and the same Lessor on a
different lease will see it appear with no explanation. **PROHIBITED elections must be
visible and blocked with their reason**, in the same spirit as the ownership tooltips
just shipped ("This item is set by the Lessor").

This is the decision that determines whether the insurance sections are revised or
rebuilt. My recommendation is **rebuild**: the current three sections encode a
show/hide model that cannot express PROHIBITED at all.

---

## 1. Driving variables

### Already live in `HORSE_LEASE_V2`

| Variable | Field | Values |
|---|---|---|
| Lease type | `TXN.LEASE_TYPE` | `FULL` / `PARTIAL` |
| Lessor party type | `LESSOR.PARTY_TYPE` | `INDIVIDUAL` / `ENTITY` |
| Lessee party type | `LESSEE.PARTY_TYPE` | `INDIVIDUAL` / `ENTITY` |
| Off-site privileges | `TXN.OFFSITE_TRANSPORT` | `GRANTED` / … |
| Jumping privileges | `TXN.JUMP_*` | height, days, supervision |
| Competition | `TXN.COMPETITION_*` | expenses, winnings |
| Purpose | `TXN.LEASE_PURPOSE` | recreational / instructional / … |

### Missing — must be added before any gate can be written

| # | Proposed field | Values | Why it is load-bearing |
|---|---|---|---|
| V1 | `TXN.LESSOR_INSURABLE_INTEREST` | `OWNER` / `LEASEHOLDER` / `NONE` | **The single most important addition.** Under California insurance law a party with no ownership stake, financial investment, or primary leasehold liability *cannot* hold mortality cover. Without this the engine cannot tell a lawful election from an unlawful one. |
| V2 | `TXN.PRIMARY_OWNER_AUTHORIZES_INSURANCE` | yes / no | When the Lessor is not the owner, medical cover requires the owner's authorisation. |
| V3 | `TXN.HORSE_IN_LESSON_PROGRAM` | yes / no | A horse ridden by multiple students blocks a partial Lessee from holding medical cover. |
| V4 | `TXN.PRIMARY_LEASE_REQUIRES_MORTALITY` | yes / no | If FHE's own upstream lease obliges mortality cover, it becomes MANDATORY downstream. |
| V5 | `TXN.HORSE_AGREED_VALUE` | currency | Drives mortality limits and shortfall allocation. |

Note V1 and V4 describe **FHE's own position** on horses it leases from boarders, which
is the normal case for this program — the Lessor is very often *not* the owner.

---

## 2. Control matrix

`LT` = lease type · `LOR`/`LEE` = party types · `II` = Lessor insurable interest

### 2.1 General Liability

| Question | Rule |
|---|---|
| Lessor may require Lessee to carry | **Always permitted.** Never prohibited. |
| Lessee policy *type* available | `LEE = INDIVIDUAL` → **only** Personal Horse Owner's / Private Horse Rider's liability. Commercial GL must be **removed** — it is not sold to hobbyists. `LEE = ENTITY` → commercial GL. |
| Lessee carry becomes MANDATORY | `OFFSITE = GRANTED` **or** `LEE = ENTITY` |
| Lessor must carry | **MANDATORY when `LOR = ENTITY`** — a program offering lessons, training and lungeing must hold CGL with an Equestrian Professional Liability endorsement. |
| Lessor prohibited | Never |
| Shared policy | **Never possible.** Where the Lessee carries GL, naming the Lessor **and the facility owner** as Additional Insureds is MANDATORY, plus a COI within 5 days. |

### 2.2 Equine Mortality

| Question | Rule |
|---|---|
| Lessor may require Lessee to carry | `LT = FULL` → permitted. **`LT = PARTIAL` → PROHIBITED.** A partial lessee cannot be compelled to insure an asset they do not exclusively control. |
| Lessee may carry at all | **`LT = PARTIAL` → PROHIBITED.** Carriers deny the application outright — no sole insurable interest. |
| Lessor must carry | MANDATORY if `V4 = yes` (upstream lease requires it) **or** `II = OWNER`. |
| Lessor prohibited | **`II = NONE` → PROHIBITED.** No insurable interest. |
| Shared policy | Never. Permitted alternative: Lessee **pays the premium** on the Lessor's policy, Lessor named sole **Loss Payee**. |
| Shortfall | Deductible *and* any gap between payout and `V5` agreed value allocated per §3. |

### 2.3 Major Medical / Surgical

| Question | Rule |
|---|---|
| Lessor may require Lessee to carry | `LT = FULL` → permitted. **`LT = PARTIAL` → PROHIBITED**, except requiring a **pro-rata share of the Lessor's existing premium**. |
| Lessee may carry at all | **PROHIBITED when `LT = PARTIAL` AND `V3 = yes`** (horse used by multiple students). |
| Lessor must carry | MANDATORY where the horse is high-value and in the advanced jumping/training program (elevated injury risk). *Threshold needs an owner ruling — see §6.* |
| Lessor prohibited | **`II ≠ OWNER` AND `V2 = no` → PROHIBITED.** |
| Shared policy | Never. Premium **cost-splitting** is permitted. |

### 2.4 Care, Custody & Control — **exists as one unconditional paragraph; actively wrong**

`INSURANCE_RISK.CCC` is a static clause with no fields and no gating, reading in
substance *"Lessee shall obtain and maintain care, custody and control insurance for the
duration of this Agreement."* It therefore applies to **every** lease we issue —
including every lease whose Lessee is a private individual, who cannot lawfully purchase
CCC at all. The contract currently imposes an impossible obligation, which is
unenforceable and a live exposure. This alone justifies the rebuild.

| Question | Rule |
|---|---|
| Section applies | Toggles ON when **either** party is `ENTITY`. |
| Lessor must carry | **MANDATORY when `LOR = ENTITY`.** A program training, lungeing and giving lessons on horses it does not own must hold commercial CCC to answer claims from the primary owners. This is FHE's normal position. |
| Lessor prohibited | Never |
| Lessee may be required | **Only when `LEE = ENTITY`** (outside trainer/professional). |
| Lessee prohibited | **`LEE = INDIVIDUAL` → PROHIBITED.** CCC is a commercial product; consumers cannot buy it. |
| Lessee MANDATORY | When `LEE = ENTITY` and taking custody of the horse for their own clients. |
| Shared policy | Never |

---

## 3. Deductibles and non-covered costs

Two layers, and they must not be conflated:

1. **Fault override (a clause, not an election).** Injury or death caused by the Lessee's
   clear breach — jumping above the agreed height, gate left unlatched — allocates
   **100% of the deductible to the Lessee**, regardless of the no-fault selection below.
2. **No-fault allocation (an election).** Illness or pasture accident. Selectable, with
   defaults by lease type: `FULL` → 100% Lessee; `PARTIAL` → 50/50 or 100% Lessor.

**Existing defects to fold into the rebuild** (verified in the live template):
- All six split-percentage fields have **no `format_type`** and are **not required** — a
  lease can execute with "Split" elected and no split defined.
- No validation that the two percentages total 100.
- The `Other` option on all three `DED_RESP` selects has **no follow-up field**, so a
  contract can execute saying responsibility is "Other" with nothing capturing what that
  means. Every other `Other` in the template has a text follow-up.

---

## 4. Medical payment and reimbursement flow

Must be stated in the contract body, not left implied:

- The **named primary policyholder must make the initial payment** to the veterinary
  hospital. Hospitals require payment at time of service and do not bill carriers.
- The policyholder files the claim, receives reimbursement, and **then** reconciles the
  out-of-pocket balance with the other party per the allocation elections.
- **Emergency Medical Care Authorisation Limit** (e.g. $5,000): grants the program
  authority to authorise life-saving surgery when the owner/Lessor cannot be reached,
  and names who bears the non-reimbursed cost.

---

## 5. Mandatory generated disclosures

Injected on output, not optional:

1. **California Civil Code § 3333.7** equine liability warning — statutory wording, bold
   uppercase, prominent.
2. **No-shared-policy acknowledgement** — an Additional Insured gains third-party
   liability protection but **no** first-party medical or mortality cover on the horse.
3. **California UCC § 10210** — true lease of personal property; risk of loss governed by
   the elections herein, overriding default statutory allocation.

---

## 6. Open questions — owner ruling needed before build

1. **PROHIBITED presentation.** Blocked-with-reason (recommended) or hidden entirely?
2. **"High-value horse" threshold** for mandatory Lessor medical cover — a dollar figure,
   or derived from `V5` agreed value plus jumping privileges?
3. **Emergency authorisation default** — is $5,000 the number?
4. **The staff carve-out, still unresolved from A-PARTY-VERIFY-2.** Staff currently
   *cannot* fill a counterparty's insurance elections, and the code comment justifying it
   assumes FHE is always the Lessor — untrue on reverse leases. Should staff be able to
   record a counterparty's elections on their behalf, mirroring barn-office wet-signing?
5. **Rebuild or revise?** My recommendation is rebuild — see §0.
6. **Scope of this contract family.** These rules assume the California program described.
   Do they apply unchanged to leases FHE merely *assists* clients with (external horse,
   FHE neither Lessor nor Lessee)?

---

## 7. What this does NOT yet cover

Stated so it is not mistaken for completeness: policy-detail capture (carrier, limits,
deductible amounts, COI dates) is sketched in the owner's blueprint but not yet
translated into field definitions; that follows once §6 is answered and the
revise-or-rebuild decision is made.
