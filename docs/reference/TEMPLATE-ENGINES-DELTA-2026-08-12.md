# TWO TEMPLATE ENGINES — the delta between them (D12)

**Owner ruling, 2026-08-12:**

> *"For template machinery, we build two. i want to say i need to create a form and then have a
> list of presets to choose from or build one from scratch. Likewise i want to say i need to make
> a document and then have a list of presets to choose from or build one from scratch. and i want
> the interfaces to be different as i listed (the 20%)… The option to add a signature block should
> not be part of a form. one giant authoring tool will make it less efficient to build or edit
> with."*

> *"and mostly i need it for editing. not building from scratch"*

---

# ⚠️ EDITING IS THE PRIMARY FLOW. BUILDING FROM SCRATCH IS SECONDARY.

**This is the sentence that should shape both tools.** The owner's day-to-day is *open the thing
that exists, change it, publish a new version* — not start from a blank canvas.

**Consequences, and they are not cosmetic:**

- **The landing surface is a LIST of what exists**, not a chooser. "New" is one control on that
  list, not the front door.
- **The edit loop is the hot path**: find → open → change → save draft → publish (+1). Every
  step in it should be short. A blank-canvas flow that costs an extra click is fine; the edit
  loop costing one is not.
- **Presets matter less than the owner's first framing implied.** A preset is a starting point
  for the rare new thing. **The real preset library is what already exists** and gets copied or
  revised.
- **Nothing may require re-authoring an existing template to bring it into the tool.** The
  existing rows are the working set on day one:

```
form_definitions      23 rows, all active   (12 ENGAGEMENT_*, 11 INTAKE_*)
contract_templates    20 active             (6 clause-composed, 14 flat markdown)
emails                 0 — hardcoded in api/, must be extracted before they are editable
```

---

# THE DELTA — what each engine has that the other must not

## DOCUMENT builder only

| capability | why it is document-only |
|---|---|
| **Signature block** | **Owner, explicit: "should not be part of a form."** |
| Party / role assignment, signing order | Only a document is executed by named parties |
| Fixed prose between fields | A document is text with inputs in it; a form is inputs |
| Merge tokens | Prose that resolves against a record |
| Clause / section structure | The composition model `HORSE_LEASE_V2` already uses |
| Delivery — send for signature, read-only delivery | Forms are published; documents are *delivered to someone* |

## FORM builder only

| capability | why it is form-only |
|---|---|
| Submission target | Where the collected answers land — a form's whole purpose |
| Output shape on publish | Owner: *"when published a form renders as either a record or article or document"* |
| Audience / public exposure | Forms face people who are not signing anything |
| Field-first canvas | No prose body to compose around |

## SHARED — build once, use in both

**These are not authoring differences and must not be built twice.**

- **The lifecycle and its controls** — owner specified them **identically** for both:
  `save as draft` · `publish` (new = v1, edit = **+1**) · `edit` (returns to draft, with the
  option to remove or keep the published version) · `archive` (removes the published version,
  hides the draft, moves to an archive page) · `delete` (hard, removes from the system).
- **Version numbering**, and the rule that a template only becomes selectable / active when
  published.
- **Field types and the required / not-required flag.**
- **Uploads that render inline.**
- **Conditional logic.** The owner named this under documents, but **forms already need it**:
  `PublicIntakeForm` shape-shifts by category today via `intakeCategoryFields.ts`. Building the
  condition engine twice would be the first drift.

**Two engines means two AUTHORING INTERFACES over shared plumbing.** It does not mean two
publish systems, two version schemes or two condition engines. The owner's argument was
efficiency of the *editing surface* — *"one giant authoring tool will make it less efficient to
build or edit with"* — which is satisfied entirely by separating the canvases.

---

# WHERE THE SHARED LIFECYCLE SHOULD LIVE

**Three half-built versioning systems already exist. Do not add a fourth:**

| table | rows | note |
|---|---|---|
| `contract_templates` | 20 active | has `version` + `active`. **No draft / published / archived status.** |
| `form_definitions` | 23 | has `version` + `active`. Same gap. |
| `template_version_events` | 6 | exists and is written |
| `content_blocks` / `content_block_versions` | 0 / 0 | versioned, slug-keyed, empty |

**Neither template table has a publish state at all** — only `active`, which is a different
thing. The lifecycle the owner specified needs `draft` / `published` / `archived` as a real
status, plus the "keep or remove the published version while editing" option, which no existing
table supports.

---

# A FINDING THAT MAKES THE FORM ENGINE CHEAPER THAN IT LOOKS

**The 23 form definitions are read by nothing** — see
`docs/reference/FORMS-ARE-UNUSED-2026-08-12.md`. Their only consumers are the admin page's own
read and its required-toggle. **There is no form renderer in `src/` at all**; the public intake
form is driven by 68 lines of hardcoded TypeScript.

**So the form engine has no live behaviour to preserve** — only 23 schemas worth keeping as
*content*. It is a greenfield build with a ready-made working set, which is the best possible
starting position and the opposite of the contract engine's situation.

---

# OPEN, FOR THE OWNER

1. **Emails are not templates yet.** Every correspondence email is hardcoded in `api/`.
   They must be **extracted** before they can be edited, and that is its own piece of work —
   not a side effect of building the Document engine.
2. **What the two archive pages are.** The owner specified `archive` moves a template "to an
   archive page." One archive or one per engine — not yet ruled.
