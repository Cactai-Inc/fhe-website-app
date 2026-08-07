# Field map — every field the insurance sections touch

22 fields live in `INSURANCE_RISK`. Four more sit outside it and reach in.
CSV copy: [FIELD-MAP.csv](FIELD-MAP.csv).

## The four things that most surprised me here

1. **Six of the 22 insurance fields print nothing at all.** The three
   "not required" checkboxes and the three "Lessee accepts responsibility"
   checkboxes are never named by a `{{TOKEN}}` in any clause body. They are pure
   switches. What the reader sees is the prose of the clause they switch on — the
   checkbox itself leaves no trace in the document beyond that.
2. **The Lessor fills in the Lessee's insurance status.** `TXN.GL_LESSEE_STATUS`,
   `TXN.MORT_LESSEE_STATUS` and `TXN.MED_LESSEE_STATUS` are all `owner_role =
   LESSOR`. The sentence "Lessee: Will obtain and will maintain mortality
   insurance on the Horse" is written into the contract by the Lessor, and the
   Lessee's only recourse is a change request.
3. **A hidden field keeps its value.** Gating hides a field; it does not clear it.
   If the Lessee checks "I accept responsibility" and the Lessor then changes
   their own status away from "Does not have", the Lessee's box vanishes from the
   form and their clause vanishes from the document — but the stored `YES`
   survives, and it comes back if the Lessor flips back. The Lessee is never
   asked again.
4. **Nine of the twenty-three required fields in the whole template are insurance
   status/deductible fields, and every one of them is gated off by a checkbox.**
   Ticking one "not required" box takes three required fields out of play.

---

## How to read the columns

- **Owner role** — who the system lets fill it in. `LESSOR`, `LESSEE`, or `DEAL`
  (either side, subject to per-party controls).
- **Required** — `contract_field_defs.required`. A required field that is gated
  off does not block locking; a required field that is visible does.
- **Gated by** — what must be true for the field to appear in the form. When a
  field is gated off, any line of any clause that names its token is also dropped
  from the composed document, whatever the clause's own gate says.
- **Drives** — every clause whose gate reads this field, and what each value does.
- **Referenced by** — every clause whose body contains its `{{TOKEN}}`.
- **Reachable when** — the upstream conditions needed for this field to render.

---

## A. The General Liability block

| Field key | Owner | Req | Type + options | Gated by | Drives | Referenced by | Reachable when |
|---|---|---|---|---|---|---|---|
| `TXN.GL_NOT_REQUIRED` | LESSOR | no | Checkbox: ticked (`YES`) or not (blank) — *"General liability insurance is not required for or by either party under this Agreement."* | Never gated — always on the form | **Ticked:** turns ON `GL_NONE` (Lessor accepts full liability risk). Turns OFF `GL_STATUS`, `GL_DED_SIMPLE`, `GL_DED_SPLITC`, and the fields `GL_LESSOR_STATUS`, `GL_LESSEE_STATUS`, `GL_DED_RESP`, both `GL_DED_RESP_SPLIT_*`, and `GL_LESSEE_RESPONSIBLE`. **Not ticked:** the reverse. | — nothing prints its token | Always |
| `TXN.GL_LESSOR_STATUS` | LESSOR | **yes** | Select, closed list: `HAS_WILL_MAINTAIN` "Has and will maintain" · `WILL_OBTAIN` "Will obtain and will maintain" · `NONE` "Does not have and will not obtain" | Only when GL is **not** waived (`GL_NOT_REQUIRED` unticked) | Set to *Has* or *Will obtain* → turns ON `GL_DED_SIMPLE` (and `GL_DED_SPLITC` if the split is chosen). Set to `NONE` **and** Lessee also `NONE` → turns ON the Lessee's `GL_LESSEE_RESPONSIBLE` checkbox, and puts the contract in the **unresolved** state that blocks locking. | `GL_STATUS` | GL not waived |
| `TXN.GL_LESSEE_STATUS` | **LESSOR** | **yes** | Same three options | Only when GL is not waived | Same as above, mirrored | `GL_STATUS` | GL not waived |
| `TXN.GL_LESSEE_RESPONSIBLE` | LESSEE | no | Checkbox — *"The Lessee accepts financial responsibility for general liability insurance under this Agreement."* | Only when **both** statuses are `NONE` **and** GL is not waived | **Ticked:** turns ON `GL_LESSEE_RESP` (a headed clause: Lessee shall obtain and maintain GL cover at its own cost). Also clears the unresolved-signing block. | — nothing prints its token | Both statuses `NONE`, GL not waived |
| `TXN.GL_DED_RESP` | LESSOR | **yes** | Select, closed: `LESSOR` · `LESSEE` · `SPLIT` · `OTHER` | Only when GL is not waived | `SPLIT` → turns ON `GL_DED_SPLITC` and the two `GL_DED_RESP_SPLIT_*` fields. `LESSOR`/`LESSEE` → those stay off. `OTHER` → nothing further; the document prints the bare word *Other*. | `GL_DED_SIMPLE` | GL not waived |
| `TXN.GL_DED_RESP_SPLIT_LESSOR` | LESSOR | no | Free text (a percentage, normalised by a trigger) | GL not waived **and** `GL_DED_RESP = SPLIT` | — gates nothing | `GL_DED_SPLITC` | GL not waived and split chosen |
| `TXN.GL_DED_RESP_SPLIT_LESSEE` | LESSOR | no | Free text | Same | — gates nothing | `GL_DED_SPLITC` | GL not waived and split chosen |

## B. The Mortality block

Structurally identical. Substitute `MORT` for `GL` throughout; the only
differences are noted.

| Field key | Owner | Req | Type + options | Gated by | Drives | Referenced by | Reachable when |
|---|---|---|---|---|---|---|---|
| `TXN.MORT_NOT_REQUIRED` | LESSOR | no | Checkbox — *"Mortality insurance is not required for or by either party under this Agreement."* | Never gated | **Ticked:** turns ON `MORT_NONE` (Lessor accepts full loss-of-value risk). Turns OFF `MORT_STATUS`, `MORT_DEDR_SIMPLE`, `MORT_DEDR_SPLITC`, **and `COORDINATION`** — the one place a waiver reaches outside its own block. Also turns off the five dependent MORT fields. | — | Always |
| `TXN.MORT_LESSOR_STATUS` | LESSOR | **yes** | Same three options as GL | Only when mortality is not waived | Has/Will obtain → turns ON `MORT_DEDR_SIMPLE`. Both `NONE` → turns ON `MORT_LESSEE_RESPONSIBLE` and blocks locking. | `MORT_STATUS` | Mortality not waived |
| `TXN.MORT_LESSEE_STATUS` | **LESSOR** | **yes** | Same | Only when mortality is not waived | Same, mirrored | `MORT_STATUS` | Mortality not waived |
| `TXN.MORT_LESSEE_RESPONSIBLE` | LESSEE | no | Checkbox — *"The Lessee accepts financial responsibility for mortality insurance under this Agreement."* | Both statuses `NONE` **and** mortality not waived | **Ticked:** turns ON `MORT_LESSEE_RESP` — Lessee shall obtain mortality cover at not less than the Horse's fair market value. Clears the signing block. | — | Both statuses `NONE`, mortality not waived |
| `TXN.MORT_DED_RESP` | LESSOR | **yes** | `LESSOR` · `LESSEE` · `SPLIT` · `OTHER` | Only when mortality is not waived | `SPLIT` → turns ON `MORT_DEDR_SPLITC` and the two split fields | `MORT_DEDR_SIMPLE` | Mortality not waived |
| `TXN.MORT_DED_RESP_SPLIT_LESSOR` | LESSOR | no | Free text | Mortality not waived **and** `MORT_DED_RESP = SPLIT` | — | `MORT_DEDR_SPLITC` | as gated |
| `TXN.MORT_DED_RESP_SPLIT_LESSEE` | LESSOR | no | Free text | Same | — | `MORT_DEDR_SPLITC` | as gated |

## C. The Medical block

| Field key | Owner | Req | Type + options | Gated by | Drives | Referenced by | Reachable when |
|---|---|---|---|---|---|---|---|
| `TXN.MED_NOT_REQUIRED` | LESSOR | no | Checkbox — *"Medical insurance is not required for or by either party under this Agreement."* | Never gated | **Ticked:** turns ON `MED_NONE`. Turns OFF `MED_STATUS`, `MED_DEDR_SIMPLE`, `MED_DEDR_SPLITC`, **and `MED_TAIL`** — the long reimbursement paragraph. Also turns off the five dependent MED fields. | — | Always |
| `TXN.MED_LESSOR_STATUS` | LESSOR | **yes** | Same three options | Only when medical is not waived | Has/Will obtain → turns ON `MED_DEDR_SIMPLE`. Both `NONE` → turns ON `MED_LESSEE_RESPONSIBLE` and blocks locking. | `MED_STATUS` | Medical not waived |
| `TXN.MED_LESSEE_STATUS` | **LESSOR** | **yes** | Same | Only when medical is not waived | Same, mirrored | `MED_STATUS` | Medical not waived |
| `TXN.MED_LESSEE_RESPONSIBLE` | LESSEE | no | Checkbox — *"The Lessee accepts financial responsibility for medical insurance under this Agreement."* | Both statuses `NONE` **and** medical not waived | **Ticked:** turns ON `MED_LESSEE_RESP`. Clears the signing block. | — | Both statuses `NONE`, medical not waived |
| `TXN.MED_DED_RESP` | LESSOR | **yes** | `LESSOR` · `LESSEE` · `SPLIT` · `OTHER` | Only when medical is not waived | `SPLIT` → turns ON `MED_DEDR_SPLITC` and the two split fields | `MED_DEDR_SIMPLE` | Medical not waived |
| `TXN.MED_DED_RESP_SPLIT_LESSOR` | LESSOR | no | Free text | Medical not waived **and** `MED_DED_RESP = SPLIT` | — | `MED_DEDR_SPLITC` | as gated |
| `TXN.MED_DED_RESP_SPLIT_LESSEE` | LESSOR | no | Free text | Same | — | `MED_DEDR_SPLITC` | as gated |

## D. Fields outside the section that reach into it

| Field key | Section | Owner | Req | Type + options | Gated by | Drives (inside insurance) | Also drives (outside — boundary, not followed further) | Referenced by |
|---|---|---|---|---|---|---|---|---|
| `LESSEE.PARTY_TYPE` | PARTIES | LESSEE | **yes** | Select, closed: `INDIVIDUAL` "Individual" · `ENTITY` "Entity / organization" | Never gated | `ENTITY` → turns ON **`CCC`** (Lessee must carry care-custody-and-control cover at the Horse's fair market value) and, together with mortality not being waived, **`COORDINATION`**. `INDIVIDUAL` or blank → both off. | 10 further clauses: `DEFINITIONS.LESSEE_ENT` / `_IND` / `_PENDING`, `LESSEE_REPS.MAIN_ENTITY` / `MAIN_INDIVIDUAL` / `PENDING`, `TRAINING_LESSONS.LESSONS` / `LESSONS_ENTITY` / `PENDING`, `SIGNATURES.LESSEE_CAPACITY`; and the fields `LESSEE.ENTITY_SIGNER_NAME` / `_TITLE` | — not printed in insurance |
| `TXN.PERMITTED_ACTIVITIES` | PERMITTED_USE | DEAL | **yes** | Multi-select (stored comma-separated): `LESSONS` · `ARENA_SOLO` · `ARENA_GROUP` · `TRAINING` · `COMPETITIONS` · `JUMPING` · `TRAIL` | Never gated | Contains `TRAIL` → `TRAIL_RIDING`. Contains `JUMPING` → `JUMPING_RISKS`. Contains `COMPETITIONS` → `COMPETITION_RISKS`. Contains `ARENA_GROUP` → `SHARED_ARENA_RISKS`. `LESSONS`, `ARENA_SOLO`, `TRAINING` turn on **no insurance clause**. | 15 clauses in PERMITTED_USE (the `RESTRICT.*` and `TRAINING_LESSONS.*` families, `COMPETITIONS.INTRO`, `PERMITTED_USE.TRAINER`) | `PERMITTED_USE.MAIN` only |
| `HORSE.FAIR_MARKET_VALUE` | HORSE | LESSOR | no | Currency | Never gated | Gates nothing. Printed inside `CCC` and `LIMITATION`. If blank, `CCC` still prints and reads *"…a death benefit limit of not less than the Horse's current fair market value of."* | — | `CCC`, `LIMITATION` |
| `TXN.LEASE_TYPE` | PURPOSE | LESSOR | **yes** | Select, closed: `FULL` "Full lease (full-time access)" · `PARTIAL` "Partial lease (shared or limited access)" | Never gated | **Nothing.** No insurance clause and no insurance field is gated on lease type. | 3 clauses, all in SCHEDULE (`MAIN`, `OTHER`, `CHANGES`) — a full lease empties that section, so it consumes no number and every later section number, insurance included, shifts down by one. | — |

---

## Deductible splits: the two blocks behave differently

The `contract_fields_split_sync` trigger normalises a split share and fills in
the counterpart automatically. It resolves whether a share is a percentage or a
dollar amount by looking up a `…_DED_RESP_MODE` field.

- **General liability** has no dollar anchor, so the trigger takes the percentage
  path unconditionally: typing `60` into the Lessor share stores `60%` and writes
  `40%` into the Lessee share.
- **Mortality and medical** are wired to look for `TXN.MORT_DEDUCTIBLE` /
  `TXN.MED_DEDUCTIBLE` and read the mode from `TXN.MORT_DED_RESP_MODE` /
  `TXN.MED_DED_RESP_MODE`. **None of those four fields exists in
  `HORSE_LEASE_V2`.** The mode lookup returns nothing, and the trigger returns
  without normalising or filling the counterpart. Whatever is typed is stored
  verbatim, and the two shares are never checked against each other.

So the same-looking control behaves one way in the GL block and another way in
the other two. *(Read from the trigger source and confirmed against the field
list; not exercised on a live document — no lease has ever had these fields
filled.)*
