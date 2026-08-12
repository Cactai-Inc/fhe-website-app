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

---

# THE FORM ENGINE HAS TWO EDITABLE HALVES — CAPTURE AND RENDER

**Owner, 2026-08-12:**

> *"i need to be able to edit both, each form has a rendered view that is editable. its input
> capture, output render, two steps or two tabs or whatever..."*

Driven by a stated need, not a preference:

> *"i want to publish articles and guides, the community feed is sparse and aside from pictures
> and videos or regurgitated content from social media i have nothing to add without a method to
> author it. And the formatting structure for an article or guide is going to be the most time
> consuming part so building it once and reusing it makes sense to me. but when i need to modify
> the input capture surface i need a place to go to do that"*

## ⚠️ THE LOAD-BEARING RULE: ONE LIST, TWO VIEWS

**Capture and render are two views over the SAME ordered list of parts. They are not two
structures.**

- **Capture tab** — what each part collects: type, required/optional, condition, repeat.
- **Render tab** — how each part presents: heading level, full-bleed vs inline, pull-quote
  treatment, hidden-from-output.

**Build them as two structures and you get a silent drift bug immediately**: a part added in
capture never appears in the render, a part deleted leaves an orphan in the layout, and nothing
errors. That is this codebase's single most repeated failure — a surface reporting success while
doing nothing. **One list. Two sets of attributes.**

## The render tab is NOT a page designer

An ordered list of parts, each with a presentation treatment. **No free canvas, no drag-anywhere
layout editor.** The owner ruled against one giant authoring tool on efficiency grounds
(**D12**), and a layout designer puts him back to designing instead of writing.

## Tabs, not steps

Steps imply a sequence you complete once. The owner's primary flow is **editing** — he will
return to one half or the other repeatedly. Tabs let him open the one he needs.

## Why an article is a FORM and not a DOCUMENT — settled

Owner: *"id say an article or guide would use a form to capture the parts. i would not thing a
document template is the right thing to use for that…do you agree?"* **Agreed, and it matches
his own taxonomy** (*"articles are written using forms"*).

A **document** is prose you compose with inputs in the gaps — `HORSE_LEASE_V2` is 163 clauses of
fixed wording with blanks. A **form** is a set of parts with no prose body. An article's parts
change every time; its structure does not. **And the signature-block rule proves it** — a
signature block is document-only, and an article is never signed.

## THE DATA — why this is urgent, not cosmetic

```
feed_posts        20 rows
  member_joined   15   ← system-generated, not authored
  rider_post       5   ← all carry media; average body length 27 characters
content_posts      0
content_resources  0   ← designed as the articles/guides home; routed; never had an authoring path
content_blocks     0
```

**There is not one authored written post in the system**, and no mechanism to produce one.
`feed_posts` holds a body blob, one media item and a source link — no structure. The owner's
*"nothing to add without a method to author it"* is literally the state of the data.

**`content_resources` is org-scoped and empty.** `TASK-UPLOADS` recorded it as *"precisely the
owner's requirement that company material be centralized around the tenant not any individual
staff account."* It is the destination; it has never had a way in.

---

# RULED 2026-08-12 — ARCHIVE, AND EMAILS

## One archive page

**Owner: "one archive page."** Shared across both engines. Settles the open question above.

## Emails are DOCUMENTS with a delivery output

> *"the email templates will use the same concept as a document engine, only difference is the
> output type"*

**Confirmed.** No third engine. An email template is a Document whose output goes to an inbox
rather than a page or a signing surface. It shares the prose+tokens model, the condition logic
and the whole lifecycle. **Emails get their own SECTION inside Templates, not their own engine.**

**Still true and still the first piece of work:** every correspondence email is hardcoded in
`api/`. They must be **extracted** before any of this can edit them.

---

# SIGN-BY-EMAIL — the goal is right, the mechanism must be a LINK, not a reply

> *"things like signature capture probably dont translate to email very well, but if they do that
> would be cool i can send the email and the signature block is rendered in the response for them
> to use and it captures it and they dont need to log into the app to sign a form, we just send it
> to them as an email they read it in the body, reply and sign before sending..."*

**The outcome — "they don't need to log into the app" — is right and worth building. The
in-email reply mechanism is not viable.** Three reasons, none of them stylistic:

1. **Email clients strip interactivity.** No forms, no scripts. AMP for Email requires
   per-sender registration with Google and Yahoo, is unsupported across most clients, and is
   effectively abandoned. There is no cross-client interactive email.
2. **A reply is free text.** Consent would be inferred by parsing prose, attributed by a `From`
   header that is trivially spoofable, with no record of which version the signer read.
3. **It breaks the evidence chain this app already has.** `signatures` records
   `signer_user_id`, `signer_contact_id`, `ip_address`, `user_agent`, `signed_at`, `typed_name`
   and `method`; `documents` carries `execution_hash`. That is attribution, intent and a
   tamper-evident record. **61 EXECUTED documents already rest on it.** A weaker second path
   would create two classes of signature with different standing.

## The mechanism that delivers the same outcome

**A one-click signing link in the email.** No password, no account creation. The token opens the
document; the signature is captured on the signing surface with the **same** evidence as any
other. This is what DocuSign and Dropbox Sign do, for exactly these reasons.

## It does not exist today — verified 2026-08-12

- **`/sign/:path` is NOT document signing.** It is the sign-**UP** onboarding path
  (`guest` / `rider` / `horse` / `rider+horse`), showing catalog offerings by segment. The name
  collides; the function does not.
- **`record_signature()` requires an authenticated caller** — it raises
  `'no contact for the signing account'` when `auth.uid()` does not resolve to a contact.

**So signing currently requires logging in.** Closing that is a distinct piece of work — it is
where signers drop out — and **THE SIGNING FREEZE IS IN FORCE**, so it is design until the owner
lifts it.

---

# ⚠️ THE TOOL FITS THE ARCHITECTURE. THE ARCHITECTURE DOES NOT MOVE FOR THE TOOL.

**Owner, 2026-08-12:** *"we will be modifying what the db has and what the code has separately,
i like the construction of the architecture i dont want to change it to accommodate this tool
system."*

**This is a hard constraint on both engines. It forbids the tempting version of this build.**

## FORBIDDEN

- **A new unified `templates` table** replacing or absorbing `contract_templates` and
  `form_definitions`. There is no grand template schema.
- **Migrating the 163 lease clauses** into a different structure.
- **Rewriting the composition model** — `contract_section_defs` / `contract_clause_defs` /
  `contract_field_defs` / `remerge_contract_from_clauses` / `compose_field_prose` stay as they
  are. `HORSE_LEASE_V2` is the proof they work.
- Reshaping `form_definitions.schema` because a new editor would prefer a different jsonb shape.

## REQUIRED

- **The Document engine is an EDITOR OVER the existing `contract_*` tables.** It writes what
  sixteen `leasefix` migrations have been writing by hand. That is the whole point (**D13**) —
  the owner should not need SQL to change a clause.
- **The Form engine is an EDITOR OVER `form_definitions`** and its existing `schema` jsonb.
- **The shared lifecycle ADDS COLUMNS to the tables that exist** — a real draft/published/
  archived status, alongside the `version` and `active` both tables already carry. **It does not
  introduce a new home for templates.**
- **One archive page reads both tables.** One surface, two sources — not a third table to
  unify them.

## Why this is the smaller build, not the larger one

The composition machinery, the merge/remerge path, the token dictionary and the field-format
registry all already work and are exercised by 61 executed documents. **The missing piece has
only ever been a UI.** Building the editor against what exists is less work than a migration
plus an editor, and it cannot break the documents already signed.

**This also restates the standing rule from `ORCHESTRATOR-HANDOFF.md`:** improve what exists;
never build a second implementation alongside it.
