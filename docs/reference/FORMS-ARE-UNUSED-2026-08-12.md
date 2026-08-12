# THE 23 FORM DEFINITIONS ARE NOT USED BY ANYTHING — measured 2026-08-12

**Owner asked: "In the Forms page there are a long list of forms. are any of these being
used?"**

**No. Not one.**

## The evidence

`form_definitions` holds **23 rows, all `active = true`** — 12 `ENGAGEMENT_*` (audience
`COMPANY`) and 11 `INTAKE_*` (audience `CLIENT`).

**Every consumer, in the database and in the app:**

```
RPCs referencing form_definitions:   admin_form_definitions   (the read for the admin page)
                                     set_form_required        (the required toggle)
App code referencing it:             src/lib/admin.ts:775  ->  AdminFormsPage only
```

**That is the complete list.** Nothing renders a form from `form_definitions`. There is no
form renderer in `src/` at all — no `FormRenderer`, no `form_schema` consumer, no
`public_form` RPC.

## What actually renders the public intake form

```
src/components/PublicIntakeForm.tsx  ->  CATEGORY_FIELDS
src/lib/intakeCategoryFields.ts      ->  68 lines of hardcoded TypeScript
```

Also imported by `LeadWorkDrawer.tsx`.

**This is a third hardcoded shadow**, the same pattern as `src/lib/services.ts` and
`src/lib/catalog.ts` — both deleted 2026-07 because "the catalog is DB-driven."

## The Forms page documents behaviour it does not have

`AdminFormsPage.tsx`'s own docstring:

> *"toggles save immediately (set_form_required) and **the public renderer enforces them**
> (required inputs + gated checkbox groups)"*

**That renderer does not exist.** The toggle writes to a row nothing reads. This is the
recurring failure mode — a control that reports success and changes nothing on screen — in its
purest form: the whole page is one.

## Why this is good news

**Nothing depends on the current Forms behaviour**, so the templates consolidation the owner
is designing is free to redesign it. There is no migration of live behaviour to preserve —
only 23 schema rows whose *content* is worth keeping as the starting shape of the new form
templates.

## Existing versioning machinery — do not build a fourth

| table | rows | note |
|---|---|---|
| `contract_templates` | 20 active | has `version` + `active`. **No draft / published / archived status.** |
| `template_version_events` | 6 | exists and is written |
| `template_variants` | 10 | exists |
| `content_blocks` | **0** | versioned slug-keyed copy; `ContentStorePage` edits this |
| `content_block_versions` | **0** | the version table for the above |
| `form_definitions` | 23 | has `version` + `active`, same as contract_templates |

**Three half-built versioning systems already exist.** The publish/version model the owner
specified should consolidate onto one, not add another.
