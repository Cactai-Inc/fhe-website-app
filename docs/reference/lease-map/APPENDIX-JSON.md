# Appendix — the raw gates and the composer's rules

Everything in the other three files is derived from what is below. Nothing here
is interpretation.

Source of truth, all in the production database `lrstswfxfsezdmvkvukc`:

- `contract_section_defs`, `contract_clause_defs`, `contract_field_defs`, all
  filtered to `template_key = 'HORSE_LEASE_V2'`
- `clause_condition_met(jsonb, jsonb)` — the gate evaluator
- `remerge_contract_from_clauses(uuid)` — the composer
- `token_display_value(text, text, jsonb)` — value → printed word
- `contract_lock_blockers(uuid)` and `insurance_resolution_sync(uuid)` — the
  signing gate and its notification
- `contract_split_deductible_sync()` — the trigger on `contract_fields`

---

## 1. How a gate is evaluated

`clause_condition_met(p_cond, v_fields)` — recursive, `IMMUTABLE`:

- `null` gate → true (always prints).
- `{"all": [...]}` → every sub-condition must hold.
- `{"any": [...]}` → one sub-condition holding is enough.
- Otherwise the gate names a `field_key`. The field's value is read as text,
  with a missing field read as the empty string, and then:
  - `equals: [...]` → true if the value is one of the listed strings. `""` in the
    list means an unanswered field satisfies the gate.
  - `contains: [...]` → the value is split on commas and true if any listed code
    is present. This is how multi-select activities are tested.
  - `gte: n` → digits are extracted from the value and compared. Unused in the
    insurance section.
- If a `field_key` is named and no operator matches, the gate is **not** met.

The TypeScript mirror (`clauseConditionMet` in `src/lib/contracts.ts`) is used by
the editor so fields appear and disappear live. It behaves identically for every
gate present in this template. It differs from the SQL in one latent respect: a
gate naming a `field_key` with no operator at all would be treated as met in the
browser and unmet in the database. No such gate exists in `HORSE_LEASE_V2`.

## 2. How a surviving clause becomes text

From `remerge_contract_from_clauses`:

1. Sections are walked in `sort_order`; clauses within a section likewise.
2. A clause whose gate is unmet is skipped.
3. **Line-level field gating.** Each line of a clause body is examined
   independently. If the line contains a `{{TOKEN}}` whose *field* has an unmet
   `conditional_on`, the **whole line is dropped** — regardless of the clause's
   own gate.
4. **Empty-token line drop.** If every token on a line is empty, the tokens are
   stripped, a leading `Label:` of up to about sixty characters is stripped, and
   the remaining punctuation and whitespace removed. If nothing is left, the line
   is dropped. **If any words remain, the line prints with a gap where the token
   was.** This is why a blank status still prints its sentence.
5. Token substitution: a coded value is replaced by its option **label**
   (`token_display_value`); ISO dates become "Month D, YYYY"; currency and
   percent fields are formatted; a field marked `certify` prints its own label
   when set to `YES` and nothing otherwise. No insurance clause prints a certify
   token.
6. A composed line that does not already end in `. ! ? : ; ) " '` gets a full stop
   appended. A line ending in a colon with nothing after it keeps the colon.
7. **Numbering.** Only a clause with a heading takes a number. A headingless
   clause is emitted bare as continuation text under the item above it.
8. **Sub-items.** A clause with `render_as_subitem` and no heading is joined with
   a space onto the **end of the previous non-empty line**, not placed on a new
   one. `GL_DED_SPLITC`, `MORT_DEDR_SPLITC`, `MED_DEDR_SPLITC` and `MED_TAIL` all
   behave this way.
9. A section whose clauses all dropped produces nothing and **consumes no
   number**, so later sections shift up.

## 3. `cut_name` is not used

`contract_section_defs.cut_name` and `contract_clause_defs.cut_name` are null for
every row of `HORSE_LEASE_V2`. The `clause_cut_kept` function still exists and
still tests fields named `TXN.MORTALITY_INSURANCE_PARTY`,
`TXN.MAJOR_MEDICAL_INSURANCE_PARTY` and `TXN.LOSS_OF_USE_INSURANCE_PARTY` — none
of which exist in this template. It has no effect on the lease.

## 4. The deductible-split trigger

`contract_fields_split_sync` fires `AFTER UPDATE OF value` on `contract_fields`
whenever the key begins `TXN.MORT`, `TXN.MED` or `TXN.GL`. Its branches reference
these fields:

`TXN.MORT_ELECTED`, `TXN.MED_COVERAGE`, `TXN.MORT_LIMIT`, `TXN.MORT_DEDUCTIBLE`,
`TXN.MED_DEDUCTIBLE`, `<base>_RESP_MODE`, `<base>_RESP_OTHER`

**None of the seven exists in `HORSE_LEASE_V2`.** The consequences:

- The coverage-toggle teardown branches never fire.
- The rule that a mortality policy limit must be at least the horse's fair market
  value never fires.
- For **general liability**, no dollar anchor is configured, so the trigger
  defaults to the percentage path: a share is normalised to `n%` and the
  counterpart is written as `100−n%`.
- For **mortality and medical**, a dollar anchor *is* configured, so the trigger
  looks up a `_RESP_MODE` field, finds nothing, and returns without normalising
  or filling the counterpart.
- The branch that clears a `_OTHER` explanation field when the selection moves
  away from `OTHER` clears a field that does not exist, which is consistent with
  there being no way to explain what `OTHER` means.

## 5. The signing gate

`contract_lock_blockers(document_id)` returns a blocker for each of GL, MORT, MED
where **both statuses are `NONE`, the "not required" box is not `YES`, and the
"Lessee accepts responsibility" box is not `YES`**. Both routes into the `locked`
state — `advance_document_workflow(…, 'locked')` and `approve_contract_review` —
refuse to advance while any blocker stands. `insurance_resolution_sync` uses the
identical predicate to raise and clear a notification to both parties.

`lock_and_sign_contract` contains a **second, independent** precondition check
that runs only when the document is still `editable`. That check counts required
fields with empty values without applying any gate, so it would count the nine
hidden insurance fields in scenario 2. In the application the Sign control is
rendered only when the document is already `locked`, so this branch is not
reached through the interface; it is reachable by calling the RPC directly.

## 6. Who may set what

`set_contract_field` treats six fields as **party-exclusive elections**:

```
TXN.GL_NOT_REQUIRED           TXN.GL_LESSEE_RESPONSIBLE
TXN.MORT_NOT_REQUIRED         TXN.MORT_LESSEE_RESPONSIBLE
TXN.MED_NOT_REQUIRED          TXN.MED_LESSEE_RESPONSIBLE
```

Only a caller holding the owning party role may set them. Staff status does not
substitute — the comment in the function notes that FHE is itself the Lessor on
these contracts, so without the carve-out staff could make the Lessee's election.
The two elections in a pair are mutually exclusive: while one is `YES` the other
cannot be set to `YES`.

Every other insurance field takes the ordinary path: staff of the owning
organisation may set it, or the party whose `owner_role` matches. All six status
fields and all three deductible-responsibility fields carry `owner_role =
LESSOR`, including the three that describe the **Lessee's** insurance.

`contract_document_detail` computes a `can_edit` flag per field mirroring the same
carve-out, so the editor greys out the box that is not yours.

---

## 7. Raw gate JSON — clauses

```
100  INSURANCE_RISK.INSURANCE
    (no gate — always prints)
150  INSURANCE_RISK.GENERAL_LIABILITY
    (no gate — always prints)
155  INSURANCE_RISK.GL_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}
162  INSURANCE_RISK.GL_DED_SIMPLE
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}, {"any": [{"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_STATUS"}, {"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}]}]}
164  INSURANCE_RISK.GL_DED_SPLITC
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}, {"any": [{"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSOR_STATUS"}, {"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.GL_LESSEE_STATUS"}]}]}
168  INSURANCE_RISK.GL_NONE
    {"equals": ["YES"], "field_key": "TXN.GL_NOT_REQUIRED"}
169  INSURANCE_RISK.GL_LESSEE_RESP
    {"equals": ["YES"], "field_key": "TXN.GL_LESSEE_RESPONSIBLE"}
200  INSURANCE_RISK.MORTALITY
    (no gate — always prints)
205  INSURANCE_RISK.MORT_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}
214  INSURANCE_RISK.MORT_DEDR_SIMPLE
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}, {"any": [{"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MORT_LESSOR_STATUS"}, {"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MORT_LESSEE_STATUS"}]}]}
215  INSURANCE_RISK.MORT_DEDR_SPLITC
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}, {"any": [{"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MORT_LESSOR_STATUS"}, {"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MORT_LESSEE_STATUS"}]}]}
220  INSURANCE_RISK.MORT_NONE
    {"equals": ["YES"], "field_key": "TXN.MORT_NOT_REQUIRED"}
221  INSURANCE_RISK.MORT_LESSEE_RESP
    {"equals": ["YES"], "field_key": "TXN.MORT_LESSEE_RESPONSIBLE"}
300  INSURANCE_RISK.MEDICAL
    (no gate — always prints)
305  INSURANCE_RISK.MED_NONE
    {"equals": ["YES"], "field_key": "TXN.MED_NOT_REQUIRED"}
306  INSURANCE_RISK.MED_LESSEE_RESP
    {"equals": ["YES"], "field_key": "TXN.MED_LESSEE_RESPONSIBLE"}
308  INSURANCE_RISK.MED_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}
314  INSURANCE_RISK.MED_DEDR_SIMPLE
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}, {"any": [{"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MED_LESSOR_STATUS"}, {"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MED_LESSEE_STATUS"}]}]}
315  INSURANCE_RISK.MED_DEDR_SPLITC
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}, {"any": [{"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MED_LESSOR_STATUS"}, {"equals": ["HAS_WILL_MAINTAIN", "WILL_OBTAIN"], "field_key": "TXN.MED_LESSEE_STATUS"}]}]}
320  INSURANCE_RISK.MED_TAIL
    {"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}
400  INSURANCE_RISK.CCC
    {"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}
450  INSURANCE_RISK.COORDINATION
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}, {"equals": ["ENTITY"], "field_key": "LESSEE.PARTY_TYPE"}]}
500  INSURANCE_RISK.RISK_OF_LOSS
    (no gate — always prints)
550  INSURANCE_RISK.LOSS_OF_USE_ACK
    (no gate — always prints)
950  INSURANCE_RISK.ASSUMPTION_INHERENT
    (no gate — always prints)
960  INSURANCE_RISK.RELEASE
    (no gate — always prints)
961  INSURANCE_RISK.RELEASE_LESSOR
    (no gate — always prints)
1100  INSURANCE_RISK.SAFETY_ATTIRE
    (no gate — always prints)
1200  INSURANCE_RISK.TRAIL_RIDING
    {"contains": ["TRAIL"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
1210  INSURANCE_RISK.JUMPING_RISKS
    {"contains": ["JUMPING"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
1220  INSURANCE_RISK.COMPETITION_RISKS
    {"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
1230  INSURANCE_RISK.SHARED_ARENA_RISKS
    {"contains": ["ARENA_GROUP"], "field_key": "TXN.PERMITTED_ACTIVITIES"}
1300  INSURANCE_RISK.WAIVER_UNKNOWN
    (no gate — always prints)
1400  INSURANCE_RISK.INDEMNIFICATION
    (no gate — always prints)
1520  INSURANCE_RISK.LIMITATION
    (no gate — always prints)
```

---

## 8. Raw gate JSON — fields

```
TXN.GL_NOT_REQUIRED
    (no gate — always shown)
TXN.MED_NOT_REQUIRED
    (no gate — always shown)
TXN.MORT_NOT_REQUIRED
    (no gate — always shown)
TXN.GL_LESSEE_RESPONSIBLE
    {"all": [{"equals": ["NONE"], "field_key": "TXN.GL_LESSOR_STATUS"}, {"equals": ["NONE"], "field_key": "TXN.GL_LESSEE_STATUS"}, {"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}]}
TXN.MED_LESSEE_RESPONSIBLE
    {"all": [{"equals": ["NONE"], "field_key": "TXN.MED_LESSOR_STATUS"}, {"equals": ["NONE"], "field_key": "TXN.MED_LESSEE_STATUS"}, {"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}]}
TXN.MORT_LESSEE_RESPONSIBLE
    {"all": [{"equals": ["NONE"], "field_key": "TXN.MORT_LESSOR_STATUS"}, {"equals": ["NONE"], "field_key": "TXN.MORT_LESSEE_STATUS"}, {"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}]}
TXN.GL_LESSOR_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}
TXN.MED_LESSOR_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}
TXN.MORT_LESSOR_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}
TXN.GL_LESSEE_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}
TXN.MED_LESSEE_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}
TXN.MORT_LESSEE_STATUS
    {"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}
TXN.GL_DED_RESP
    {"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}
TXN.GL_DED_RESP_SPLIT_LESSOR
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}
TXN.GL_DED_RESP_SPLIT_LESSEE
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.GL_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.GL_DED_RESP"}]}
TXN.MED_DED_RESP
    {"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}
TXN.MORT_DED_RESP
    {"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}
TXN.MED_DED_RESP_SPLIT_LESSOR
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}
TXN.MORT_DED_RESP_SPLIT_LESSOR
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}
TXN.MED_DED_RESP_SPLIT_LESSEE
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MED_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.MED_DED_RESP"}]}
TXN.MORT_DED_RESP_SPLIT_LESSEE
    {"all": [{"equals": ["NO", ""], "field_key": "TXN.MORT_NOT_REQUIRED"}, {"equals": ["SPLIT"], "field_key": "TXN.MORT_DED_RESP"}]}
```
