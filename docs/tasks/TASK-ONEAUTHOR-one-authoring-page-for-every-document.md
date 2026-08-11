# TASK ONEAUTHOR — one authoring page that arranges itself around the document

**Owner, 2026-08-11:**

> *"we need to convert the contract authoring page into a universally usable authoring page
> that self arranges around the document being created. All the basic machinery is already in
> place and remains usable for each document type. the things that change are the contents of
> the document and it's associated content surfaces like the requests and comments drawers,
> change history, and references to who documents are sent to as well as the interactions,
> notifications, and requirements as they relate to each document specifically."*

**This is a CONVERGENCE, not a rebuild.** Measured before specifying — the machinery is
already close to generic, and the page already survives a document with no clause structure.

---

# WHAT WAS MEASURED — production + source, 2026-08-11

```
ContractPage.tsx        2189 lines    only 32 contract-specific references
ContractCascade.tsx     1600
ClauseDocument.tsx      1055          STOP-AND-PROPOSE
AddElementModal.tsx      817          the "Add New Item" custom component authoring
NewContractPage.tsx      410
ContractSubheader.tsx    333          owns the drawers — "one owner, one set of buttons"
DocumentViewerPage.tsx   253          the OTHER renderer: MergedBodyView on merged_body
```

**Three findings that shape the work:**

1. **`ContractPage.tsx:498` already handles the no-structure case:**
   `setStructure(s.sections.length > 0 ? s : null)`. A flat document does not break the page —
   it produces a null structure. The branch exists; it just has no renderer behind it.

2. **The drawers are already generic.** The page's own comment: *"Append-only surfaces (notes /
   requests / history) just bump `changeKey`, which the drawers already watch."* That event
   model does not care what kind of document it is.

3. **There are two renderers and they never meet.** `ClauseDocument` for clause-composed
   documents, `MergedBodyView` for flat `merged_body`. **Six** active templates are
   clause-composed; **fourteen** are flat.

---

# THE MODEL

## 1. One page, renderer chosen by the document

The page keeps everything around the document — drawers, history, send, parties, signing — and
selects the body renderer:

- **structure present** → `ClauseDocument` (authoring: fields, clauses, Add New Item)
- **structure null** → the flat renderer (read/generate, no clause authoring)

**Do not fork the page per document type.** The variation is data, and the null branch already
exists.

## 2. Per-type behaviour is DATA on the template, not branches in code

`contract_templates` **already carries per-type configuration** — `contract_kind`,
`service_type`, `wall_gating`, `party_namespaces`. That is the established pattern here, and
the codebase's own history is emphatic: the two hardcoded shadow catalogs were deleted because
mechanics belong in data.

The owner's list of what varies — *"interactions, notifications, and requirements as they
relate to each document specifically"* and *"references to who documents are sent to"* — is
configuration, and it extends that same row.

**Extend the template row. Do not write `if (templateKey === …)`.** A conditional per document
type is how 26 templates become 26 special cases.

## 3. Which surfaces appear is part of that configuration

A release signed at a kiosk does not need a change-requests drawer. A lease does. The surface
list — requests, comments, change history, recipients, signature order — is per type.

**Default to showing what is safe and hiding what is meaningless.** A drawer that can never
have contents is the same defect as the "and 1 more" control that expanded to nothing, and the
same as an empty preset tab.

## 4. What must NOT change

- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.** Minimal diff plus orchestrator approval, and it
  should barely need touching — the convergence happens in the page, not the renderer.
- **61 EXECUTED documents are evidence and are never rewritten.** This task changes how a
  document is authored and displayed, never what an executed one says.
- **THE SIGNING FREEZE IS IN FORCE.** Nothing here lifts it.
- **`AddElementModal`'s custom component authoring is an asset — keep it whole.** It is the
  thing that makes new document types buildable without a developer, and it is the reason this
  convergence is worth doing.

## 5. What this task does NOT do

**It does not convert the fourteen flat templates into clause-composed ones.** That is a
separate, substantial program — `HORSE_LEASE_V2` proves it can be done, and it took a
dedicated thread to do one. **Report what conversion would involve; do not start it.**

The point of this task is that when a flat template *is* converted, it needs no page work —
it simply starts producing a structure and the same page authors it.

---

# A THING TO CHECK AND REPORT, NOT FIX

**Four lease templates carry identical clause and field counts** — `HORSE_LEASE_V2`, `_FULL`,
`_SIMPLE`, `_STANDARD`, all at 163 clauses / 114 fields. Either they are four keys over one
shared clause set by design, or three are dead weight from the fork work.

**Find out which and report it.** A picker that offers four cards for one document would be a
confusing surface, and the answer changes what the picker should list. **Do not delete
anything** — `HORSE_LEASE` (inactive) and the fork history suggest these were deliberate.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-oneauthor`, branch `task/oneauthor`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`AppLayout.tsx`**: report nav changes, do not edit.
- **Delete nothing.** Retire behind a boolean; `ContactsPage` is the pattern.
- Migrations: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.**
- No staff browser session exists and you will not be given one. Prove behaviour against SQL
  and the built bundle; report the render as **NOT VERIFIED**.
- **Sarah's `704c8d2d…` is a SAMPLE under review**, not a live negotiation — template changes
  are expected to reach it. Do not scope around it.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

One page opens a clause-composed document (lease) with full authoring, and opens a flat
document (`RELEASE_GENERAL`) without breaking, showing only the surfaces that document can
actually have. Neither path loses the drawers, history, or send behaviour it has today.

Report to `docs/reports/TASK-ONEAUTHOR-REPORT.md`.
