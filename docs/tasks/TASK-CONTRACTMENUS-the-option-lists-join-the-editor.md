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

## 5. 🔒 SETTLED — A DRAFT TAKES THE NEW OPTIONS, AND A RETIRED SELECTION IS CLEARED

**Owner, 2026-08-26:** *"a draft document gets the new options so a selected old option is cleared."*

So option **(b)**. A draft is not evidence — it is work in progress, and it should reflect the
current truth of the template.

⚠️ **WHAT THIS OBLIGES, and it is more than a delete:**
- The cleared field becomes **unanswered**, so it **re-enters `contract_lock_blockers`** if it is
  required. That is correct — it must be answered again before the document can reach *ready to
  sign* — but it means **retiring an option can un-ready a contract that was ready**, and the person
  who retired it should be told which drafts they just re-opened.
- ⚠️ **The clearing must be LOGGED.** `log_contract_change` already exists and already records a
  field's before/after. A value disappearing from a draft with no trace is indistinguishable from a
  bug, and the author will assume they never answered it.
- **EXECUTED AND SIGNED DOCUMENTS ARE STILL UNTOUCHED.** The ruling says *draft*. A signed contract
  keeps its snapshot, its value and its version.

## 6. 🔒 SETTLED — THE EDITOR IS THE SURFACE, NOT A LIST OF MENUS

**Owner, 2026-08-26:**
> *"every item needs to be listed as part of the group its shown on, so a document is selected or a
> page is selected or a form is selected from a list on the editor entry page and then the list of
> items as they appear on the screen is shown and with enough information around it that the item can
> be edited. it would be most effective to just render the entire thing that the thing im editing
> lives on, so if its a menu option on the horse intake form, clicking on the horse intake form from
> the entry page opens the horse intake form and then i can edit anything on the form, including the
> menu items."*

⚠️ **THIS SUPERSEDES §4's "212 more rows in the menus list".** A flat inventory of 336 menus was
never going to be usable, and the reason is not length — it is that **a menu means nothing away from
the thing it appears on**. "Front boots / wraps" is only meaningful while looking at the equipment
question on a lease.

**THE SHAPE:**
- **THE ENTRY PAGE IS A LIST OF SURFACES**, not of menus: documents, pages, forms.
- **CHOOSING ONE RENDERS THAT SURFACE**, as it actually appears.
- **EVERYTHING ON IT IS EDITABLE IN PLACE** — labels, wording, and the menu contents — because you
  are looking at the real thing, in its real context.

⚠️ **THE MENUS EDITOR BUILT ON `task/p1ship` IS THEREFORE A STAGING POST, NOT THE DESTINATION.** It
is a flat list of 124 menus. Its `menu_inventory` / `set_menu_value` spine stays useful as the WRITE
layer; the flat LIST becomes a fallback for menus with no surface to render (a vocabulary used in
six places), not the primary way in.

⚠️ **AND THIS IS THE SAME PATTERN AS CR-74/CR-75, ARRIVED AT FROM A DIFFERENT DIRECTION:** *do not
move someone away from the thing to edit the thing*. The editor is the surface, expanded in place —
exactly as a client record is a row that opens rather than a page you travel to. **Build it as one
pattern, not two**, or the globalization pass inherits a third editing idiom.

**WHAT THAT COSTS, honestly:** the three existing template editors (wording, forms, menus) and the
document renderer become **one surface with an edit mode**, rather than four screens. That is a
larger build than adding a source to a list — and it is the one that ends the question rather than
deferring it.

## THE REACH
`/app/ops/admin/menus`, the surface the P1 branch built — one more source in the same list.

## THE TELL
Add an option to a lease's equipment list from the admin screen; a NEW lease offers it, Pamela's
existing lease is unchanged, and the clause that keys on an unrelated value still renders. Deactivate
a value that a condition names and the editor says which clauses depend on it instead of accepting it.
