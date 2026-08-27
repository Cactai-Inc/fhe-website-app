# TASK-CONTRACTOPTIONS — report

**Thread 2 of three.** Branch `task/contractoptions`, cut from `main` at `1647e11e`.

**STATUS: BUILT AND APPLIED.** Two migrations on production, both rehearsed in
`BEGIN … ROLLBACK` against the live lease first. Four owner-raised items arrived mid-thread
and were built first (§0); the option-list build is §§1–5.

---

## 0. WHAT WAS BUILT FIRST — four items the owner raised mid-thread

| | | |
|---|---|---|
| `270b11e3` | the printed name was clipped | the company's own name, one glyph short |
| `45ec6203` | the vet's address stopped being required | **was blocking Pamela's lease** |
| `7fee1749` | the deal and its contract were two cards for one fact | dashboard B3 |
| `087b2406` | the owners can see their notifications again | 137 unread, no surface |

Three migrations applied to production, each dry-run in `BEGIN … ROLLBACK` first.
Detail in the commit messages; the two that were live defects are worth restating:

**The vet address was an unfillable required field in front of a real client.**
`contract_intake_requirements` put `vet_address` in `horse.missing`, and
`ContractIntake.tsx` renders every entry in that list `required`. Sundance — the horse on
Pamela's lease — has a veterinarian with no address, because he travels to the horse.
Rehearsed as the Lessor against the live document: the horse list came back with exactly
one entry, and `complete` was `false`. **She has not clicked her invite link yet, so this
would have met her on first login.** Entries now carry `optional`; `complete` counts only
the ones that block.

**137 unread notifications had no surface.** `DashboardHome` sends staff to
`OwnerDashboard` (`if (isStaff) return <OwnerDashboard />`), and the component that reads
notifications — `DashboardPanel` — is the MEMBER branch. 77 unread for admin@, 60 for
hello@. This is D19's "ledgers the app writes and never reads back", in the one ledger the
B6 activity zone does not cover.

---

## 1. THE MEASURED GROUND — re-measured 2026-08-26, all against production

The handoff's four headline numbers **all still hold exactly**:

| | handoff | measured | |
|---|---|---|---|
| option lists in `contract_field_defs.options` | 212 / 6 templates | **212 / 6** | ✅ |
| of which `select` / `buttons` | 171 / 41 | **171 / 41** | ✅ (the column is `input_kind`, not `input_type`) |
| FIELD-level conditions | 208 | **208** | ✅ |
| CLAUSE-level conditions | 449 | **449** | ✅ |
| per-document option snapshots | 42 | **42** | ✅ |
| an active/version column on `contract_field_defs` | neither, only `closed` | **confirmed — only `closed`** | ✅ |

Option lists by template: `HORSE_LEASE_STANDARD` 42 · `HORSE_LEASE_V2` 42 ·
`HORSE_LEASE_SIMPLE` 42 · `HORSE_LEASE_FULL` 42 · `HORSE_SALE_V2` 25 ·
`HORSE_BILL_OF_SALE` 19.

### 1.1 ⚠️ THERE IS A THIRD CONDITION SITE, AND THE CORRECTED HANDOFF NAMES ONLY TWO

The handoff was corrected before I started to add clause-level conditions beside
field-level ones. **There is a third, and it is inside the option lists themselves.**

Every one of the **795** option entries is a JSON object, and they carry **three** keys,
not two: `label`, `value`, and **`when`**.

```
{"when": {"any": [{"contains": ["LESSONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"},
                  {"equals": ["YES"],       "field_key": "TXN.LESSONS_ENTITY_PERMITTED"}]},
 "label": "Riding Lesson Participants", "value": "LESSON_PARTICIPANTS"}
```

**8 entries carry a `when`**, across 2 distinct fields × the 4 lease templates
(`TXN.OTHERS_ALLOWED`, `TXN.GL_LESSEE_STATUS`). They name three field keys and four option
codes as bare strings, exactly as the other two sites do.

**So `contract_menu_dependents` must search THREE places, not two:**

1. `contract_field_defs.conditional_on` — 208
2. `contract_clause_defs.conditional_on` — 449
3. `contract_field_defs.options[].when` — 8

Small, but it is the same failure the handoff's own correction describes: a dependents read
that misses a site reports "nothing depends on this" for something that does, and is
trusted. **A retired value could silently un-gate an option in another list.**

### 1.2 `contract_section_defs` has NO `conditional_on`

The corrected handoff says `clause_condition_met` is evaluated "for every section and
clause". **Sections carry no condition column** — the 9 columns are id, template_key,
section_key, heading, sort_order, is_optional, cut_name, guidance, created_at. Section
gating, where it happens, is a property of the clauses inside it. Nothing to search.

### 1.3 The operator set is `equals` · `contains` · `gte`, plus `all` / `any`

From `clause_condition_met`. **`equals` and `contains` name option values; `gte` does
not** — it is a numeric gate that strips non-digits and compares. So a dependents read
looks inside `equals` and `contains` arrays only, and must recurse through `all`/`any`.

⚠️ **`contains` splits an unparseable value on commas** — `regexp_split_to_table(v_raw, ',')`
— which is how a multi-select stores itself. Deactivating a value used by a `contains` gate
is therefore a different shape from an `equals` gate: the stored value is a comma-joined
list, and clearing one member is an edit to a string, not a delete of a row.

---

## 2. THE READER SWEEP — every place an option list is rendered or resolved

The build rule is that every reader which OFFERS options must filter on `active`, and every
reader which RESOLVES a stored value to its label must NOT. Here is the full set.

### 2.1 The offer path — must filter on `active`

**`fieldWithAvailableOptions(f, valueByKey)`** in `ClauseDocument.tsx:399-421` is the one
choke point, and **it already implements exactly the pattern `active` needs**:

> *"an option with a `when` gate is only offered while the gate holds — EXCEPT when it's
> already selected (it must stay visible so it can be unselected)"*

That "except when already selected" escape hatch is the same rule a retired value needs, for
the same reason. **`active` filtering belongs in this function**, beside the `when` filter.

⚠️ **BUT IT IS NOT APPLIED AT EVERY CALL SITE.** `InlineFieldControl` is rendered from three
places in `ClauseDocument.tsx`:

| line | wrapped in `fieldWithAvailableOptions`? | |
|---|---|---|
| 442 | ✅ yes | the main field render |
| 1159 | ✅ yes | the responsibility-matrix render |
| **1011** | ❌ **NO** | `renderCustom` — author-added custom fields |

**So `when` gating is already inconsistent today**, and `active` would inherit the same
gap. Author-added fields are per-document and would not normally carry template gates,
which is presumably why nobody noticed — but the third call site is a hole in the sweep and
it is named here rather than discovered later.

### 2.2 The resolve path — must NOT filter

- `ClauseDocument.tsx:269-277` — `optionLabel(f)`, value → label for read-only display.
- `ClauseDocument.tsx:294-296` — `gateValueLabel(f, raw)`, a gate's raw value → its label.
- `ContractCascade.tsx:1293-1294` — the same resolve inside the control.

**These are what make "a retired value must still resolve for display" true.** They look up
by `value` and fall back to the raw code, so they already behave correctly for a retired
option — provided nothing removes the entry from the list. Which is the whole reason the
rule is deactivate-never-delete.

### 2.3 Other renderers of `f.options`

`ContractCascade.tsx` at 392, 1030, 1197, 1280, 1441 — the select, the button array, the
multi-select chips and the cost/duty matrix. **1441 falls back to hardcoded `COST_OPTS` /
`DUTY_OPTS` when the field has no options**, which is a second source of vocabulary worth
noting but out of this thread's scope.

### 2.4 Database-side

14 functions read `contract_field_defs`/`contract_fields` options: `add_contract_element`,
`apply_contract_composition_spec`, `apply_field_formats`, `bos_generate_document`,
`clone_contract_template`, `contract_document_detail`, `recompose_document_fields`,
`remerge_contract_from_clauses`, `seed_cascade_fields`, `start_lease_contract_v2`,
`start_sale_contract`, `sync_contract_fields_from_defs`, `add_deal_document`,
`_restore_contract_template_composition`. **The generation path
(`start_*` → `sync_contract_fields_from_defs` → `recompose_document_fields`) is where a new
document takes its snapshot, and is therefore where `active` has to be honoured** so a
retired value never reaches a new document at all.

---

## 3. WHAT THREAD 1 LEFT ME, CONFIRMED

- `contract_template_versions` exists on `main` (merge `baabdc11`), with `composition`
  capturing `fields` whole-row via `to_jsonb`, so **whatever `"active"` flag goes inside
  `options` is retained per version without widening anything**. Confirmed by reading the
  migration; no schema change needed on my side.
- ⚠️ **Every option-list change must call `save_contract_template_version(key)` afterwards**,
  or the live template stops matching its own current version — the D33 drift.

---

## 4. WHAT WAS BUILT

### 4.1 The read — `contract_menu_dependents(template_key, field_key, code)`

Returns the option's label and `active` state, then **all three** condition sites plus every
document holding the value, split by whether it can still change:

```
totals: { clauses, fields, options, conditions, documents_open, documents_frozen }
```

Two helpers do the work, and both are about being exactly right rather than roughly right:

- **`_condition_names_value`** recurses through `all`/`any` and reads **only** `equals` and
  `contains`. `gte` strips non-digits before comparing, so it can never name a code.
- **`_value_selects_code`** tests **membership of a comma-joined list**, not equality —
  that is how a multi-select stores itself, and what `clause_condition_met`'s `contains`
  branch splits on. `LESSONS` inside `LESSONS,ARENA_SOLO,ARENA_GROUP` is a dependency.

### 4.2 The mutations — one function per rule

| | |
|---|---|
| `contract_menu_set_active` | deactivate / reactivate; both stores; clears, logs, reports re-opened |
| `contract_menu_relabel` | the label may change, the code may not |
| `contract_menu_add_value` | writes to BOTH stores; refuses an existing code, retired ones included |
| `contract_menu_recode` | **always raises**, naming the dependent counts |

**`contract_menu_recode` exists in order to refuse.** Rule 3 says refuse the unsafe edit
rather than warn about it. A function that refuses is discoverable and testable; an absence
is a gap someone later fills with an `UPDATE`.

**Frozen = executed OR carrying any signature.** The brief says *"executed or signed"*.
Signature-bearing is included deliberately: clearing an answer out from under a party who
has already signed it is the one outcome no amount of logging repairs.

**Every mutator calls `save_contract_template_version`** — D33's rule, so the live template
never drifts ahead of its own retained version.

### 4.3 ⚠️ THE SWEEP FOUND A HOLE WHERE §2 EXPECTED NONE

§2 mapped three `InlineFieldControl` call sites in `ClauseDocument`. **There are four.** The
fourth is `PartyDocumentView.tsx:171` — *the panel the counterparty answers in* — and it
passed the field through unfiltered, exactly as `renderCustom` did.

**So `active` is filtered inside `InlineFieldControl`, not at the call sites.** It needs no
sibling context, so it can live in the one component every picker goes through, and a fifth
call site cannot forget it. The `when` gate reads other fields' values and cannot move
there; it stays in `fieldWithAvailableOptions`, which `renderCustom` now also uses.

⚠️ **`PartyDocumentView` still does not evaluate `when` gates.** That is a **pre-existing**
gap this build did not create and did not close — recorded here rather than left to be
rediscovered.

**Nothing is stripped at generation, and the label resolvers do not filter.** `optionLabel`,
`gateValueLabel` and the control's own value lookup keep seeing the full list. Filtering
there is what would make a retired historic selection render as a raw code — the failure the
whole design exists to prevent.

---

## 5. VALIDATION — the seven items

Every one rehearsed against production inside `BEGIN … ROLLBACK`, on the live
`HORSE_LEASE_V2` document (Pamela Godde's lease), then rolled back.

**1. Adding appears on a new document AND an existing draft, not on an executed one.** ✓
`contract_menu_add_value('HORSE_LEASE_V2','HORSE.COLOR','STRAWBERRY_ROAN',…)` → template
`true`, live draft `true`, **executed documents touched: 0**.

**2. Deactivating: it leaves the picker, a historic selection still renders as its label,
and conditions still evaluate.** ✓ The entry stays in the list with `active:false`; its
label still resolves (`Open-ended`); conditions read stored VALUES, which are untouched.

**3. `contract_menu_dependents` is right, and empty when it should be.** ✓
`TXN.PERMITTED_ACTIVITIES = LESSONS` → 4 clauses, 1 option gate, 1 open document.
`HORSE.COLOR = PALOMINO` → all zeros.

**4. A cleared draft field is unanswered, logged, and reported as re-opened.** ✓

```
cleared:  { was: "OPEN_ENDED", now: null, required: true }
reopened: { blockers_before: 0, blockers_after: 1 }
log:      option_retired · TXN.LEASE_TERM_TYPE · OPEN_ENDED → (null)
```

**That `0 → 1` is the brief's warning made visible**: retiring an option un-readied a
contract that was ready to sign, and the RPC named the document.

**5. Re-coding is REFUSED, with the dependents named.** ✓
> *a value's code can never change. HORSE_LEASE_V2 names "LESSEE": 0 clause condition(s), 4
> field condition(s), 0 option gate(s), and 0 document(s) have it selected…*

Re-adding a retired code is refused too, pointing at reactivation.

**6. No reader shows a retired value.** ✓ Readers found and how each was handled:

| reader | kind | treatment |
|---|---|---|
| `InlineFieldControl` (ContractCascade) | picker — **all 4 call sites** | **filters** `active` |
| `fieldWithAvailableOptions` | picker context | filters `when` |
| `optionLabel` · `gateValueLabel` · control value lookup | resolver | **never filters** |
| `SelectWithOther` · `InlineSelect` · button arrays · `ResponsibilityControl` | sub-controls | render what they are handed — already filtered |
| 14 SQL functions reading options | generation/composition | pass the list through whole, by design |

**7. Typecheck, api-typecheck, build clean; lint at main's baseline.** ✓ 0 errors, 48
warnings, none from the changed files.

**Production verified clean after the rehearsals**: zero `active` flags anywhere, zero
`option_retired` log rows, lease templates still at version 3, and the live lease's values
byte-identical.

---

## 6. THE REACH — nothing, and that is the point

⚠️ **This thread ships NO new route and NO new button.** Thread 3 builds the surface.

**Awaiting a caller** — listed explicitly so they do not quietly join
`docs/ORCHESTRATOR.md` §3b:

- `contract_menu_dependents(text,text,text)`
- `contract_menu_set_active(text,text,text,boolean)`
- `contract_menu_relabel(text,text,text,text)`
- `contract_menu_add_value(text,text,text,text)`
- `contract_menu_recode(text,text,text,text)`

All five are `GRANT`ed to `authenticated` and gated on `is_admin()`; all are proven callable
by the §5 rehearsals. **No TypeScript wrapper was written**, deliberately — the shape of the
seam belongs with the surface that uses it.

---

## 7. WHAT I FOUND THAT NOBODY ASKED ABOUT

1. **The third condition site** (§1.1) — the single most consequential finding, and the one
   the corrected handoff still did not have.
2. **The fourth call site** (§4.3) — `PartyDocumentView` never filtered options at all.
3. **`PartyDocumentView` ignores `when` gates** — pre-existing, unfixed, recorded.
4. **Reactivation restores the OPTION, not the ANSWER.** Undo makes the value offerable
   again; it does not re-answer the field on the party's behalf. That is deliberate — the
   old answer is in `contract_change_log` where a person can read it and decide — but it
   means "undo" is not symmetrical, and the editor should say so rather than imply it.
5. **`ContractCascade.tsx:1441`** falls back to hardcoded `COST_OPTS`/`DUTY_OPTS` when a
   field has no options — a second vocabulary outside the option-list system entirely, and
   therefore outside everything this build governs. Out of scope; worth a look.
