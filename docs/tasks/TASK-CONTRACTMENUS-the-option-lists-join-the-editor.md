# TASK-CONTRACTMENUS — the contract option lists join the menus editor

**Owner, 2026-08-26**, on being told the menus editor covers 124 menus but not contract field options:

> *"yea we need to add the contract menus and button array contents to the editor, good catch. make
> sure it doesnt break things though when something is removed or added it needs to be properly done
> so the old docs still work and the new docs work properly, this means if there are conditions set on
> 'any selection from this section causes this thing over here to do this' they still work with the
> new added item, a change to an existing item, or a removal of an item. regarding ensuring old docs
> still work, the solution we implemented was versioning, so a change mints a new version and updates
> forward but the previous version remains intact for existing items that used it with the old
> information."*

⚠️ **THIS IS NOT A SMALL ADDITION.** The numbers below are measured on production, not estimated.

---

## 1. THE FACTS — verified 2026-08-26, do not re-derive

| | |
|---|---|
| contract option lists (`contract_field_defs.options`) | **212**, across **6** templates |
| of which `select` | **171** |
| of which `buttons` (the "button arrays") | **41** |
| ⚠️ **conditions keyed on option VALUES** (`conditional_on`) | **208** |
| per-document option snapshots (`contract_fields.options`) | **42** live rows |
| `contract_field_defs` version/active column | ❌ **NEITHER. Only `closed`.** |
| `contract_templates.version` | ✅ exists — `HORSE_LEASE_FULL` is already at 3 |

**A condition looks like this**, and it names the value as a bare string:
```
{"equals": ["LESSEE"], "field_key": "TXN.VET_ARRANGE"}
{"all": [{"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"},
         {"equals": ["ENTITY"], "field_key": "COBUYER.PARTY_TYPE"}]}
```
⚠️ **So a value's CODE is a contract of its own.** Renaming `LESSEE` to `LESSEE_ARRANGES` silently
falsifies every condition that names it — the clause does not error, it just stops appearing.

## 2. ⚠️ WHAT ALREADY PROTECTS OLD DOCUMENTS, AND WHAT DOES NOT

**Already safe:** every document carries **its own snapshot** of the options in
`contract_fields.options`, taken when it was generated. An edit to a template's list does **not**
reach an existing document. That is document-level versioning and it already works — it is why
adding "Bell boots" on 2026-08-26 required writing **both** places.

**NOT safe, and this is the whole risk:**
1. ⚠️ **A REMOVED VALUE THAT A CONDITION NAMES.** The condition still names it; nothing that reads
   `conditional_on` validates against the option list. The clause quietly stops rendering.
2. ⚠️ **A REMOVED VALUE THAT A DOCUMENT HAS SELECTED.** The stored value in `contract_fields.value`
   no longer matches any option, so the field renders blank or as a raw code.
3. ⚠️ **A RENAMED CODE.** Same as removal, but harder to spot, because the LABEL still looks right.

## 3. THE RULES THIS BUILD MUST HOLD

1. ⚠️ **A VALUE IS NEVER DELETED AND NEVER RE-CODED. It is DEACTIVATED.** Removal means "stop
   offering this on new documents", not "erase it". The code must keep resolving forever, because
   208 conditions and every historic selection resolve through it. **The label may be edited; the
   code may not.** *(This mirrors `lookup_options.active`, which the existing editor already uses —
   the same shape, not a new idea.)*
2. **An EDIT MINTS A NEW TEMPLATE VERSION** — the owner's stated solution. `contract_templates.version`
   is incremented; documents already carry `signed_template_version`, which is what the drift guard in
   `regenerate_contract_document` reads. **Old documents keep their snapshot and their version.**
3. ⚠️ **REFUSE THE UNSAFE EDIT, DO NOT WARN ABOUT IT.** Before deactivating a value, the RPC checks
   `conditional_on` across the template and the stored `contract_fields.value` set. If either names
   it, deactivation is allowed **only** as a hide-from-new — never a delete — and re-coding is
   rejected outright with the list of what depends on it.
4. **ADDING is always safe** and needs no version bump of its own beyond rule 2 — nothing can depend
   on a value that did not exist. ⚠️ **But it must be written to BOTH stores** for non-executed
   documents, or the new item exists only for documents generated in future *(the Bell Boots lesson)*.
5. ⚠️ **EXECUTED DOCUMENTS ARE NEVER TOUCHED.** Not their options, not their values. A signed contract
   says what it said when it was signed.

## 4. THE BUILD

- **`menu_inventory()`** gains a third `source`: `contract`. Key shape
  `<TEMPLATE_KEY>::<FIELD_KEY>`, matching the existing `<FORM_KEY>::<field_key>`.
  ⚠️ **212 new entries — the editor's list roughly triples**, so it needs grouping/filtering by
  source before it is usable, not after.
- **`set_menu_value`** gains the `contract` branch: label edits and `active` toggles only.
- **A new `add_menu_value`** for the contract source — the existing editor can only edit and
  deactivate, and rule 4 needs an insert.
- **`contract_field_defs.options` entries gain `"active": true|false`**, since there is no active
  column and the list is JSON. Every reader that renders options must then filter on it —
  ⚠️ **and a reader that does NOT filter will show retired values; that sweep is part of the build,
  not a follow-up.**
- **The version bump**, and a `contract_menu_dependents(p_template_key, p_field_key, p_code)` read so
  the editor can say *"3 clauses and 1 document depend on this"* before anything is pressed.

## 5. ⚠️ THE ONE DECISION THAT IS THE OWNER'S

**When a value is deactivated, what happens to a DRAFT document that has already selected it?**
- **(a) It keeps it** — the selection stands, and only new documents lose the option. *Safest; means
  a retired option can still appear on a contract that goes out tomorrow.*
- **(b) It is cleared and the field becomes unanswered** — the document is forced back to a valid
  state. *Cleaner, but silently un-answers a question someone already answered.*

**This is not a technical toss-up.** (a) risks shipping a term he thought he had retired; (b) risks
a contract going out with a blank where an answer used to be. **Executed documents are out of scope
either way — they keep everything.**

## THE REACH
`/app/ops/admin/menus`, the surface the P1 branch built — one more source in the same list.

## THE TELL
Add an option to a lease's equipment list from the admin screen; a NEW lease offers it, Pamela's
existing lease is unchanged, and the clause that keys on an unrelated value still renders. Deactivate
a value that a condition names and the editor says which clauses depend on it instead of accepting it.
