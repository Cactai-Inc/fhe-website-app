# TASK-CONTRACTOPTIONS — report

**Thread 2 of three.** Branch `task/contractoptions`, cut from `main` at `1647e11e`.

⚠️ **STATUS: FACT-FIND COMPLETE, BUILD NOT STARTED.** Four owner-raised items arrived
mid-thread and were built and applied first (§0). This section records what was measured
before the option-list build begins, so none of it has to be re-derived.

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

## 4. STILL TO BUILD

1. `"active"` semantics in `contract_field_defs.options`, the reader sweep of §2, and the
   generation path honouring it.
2. `contract_menu_dependents(p_template_key, p_field_key, p_code)` across **all three**
   condition sites of §1.1, plus selected values split by document state.
3. The mutation RPCs: deactivate / reactivate / relabel / add — refusing a re-code, writing
   adds to BOTH stores for non-executed documents, clearing retired selections on drafts
   with `log_contract_change`, returning which documents were re-opened, and calling
   `save_contract_template_version`.
4. THE REACH: **nothing, deliberately** — Thread 3 builds the surface. The RPCs will be
   listed here as awaiting a caller.
