# TASK UPLOADS — a file can live on an account, and on the company

**Owner, 2026-08-11:**

> *"we need it to be able to accept uploads from a user's account, it lives on their account
> and can be made visible on other surfaces like the deal, the contract, the horse record, the
> other pages in the stable, lessons and other services, and other records cards like leads and
> directory listings. Additionally, the brand itself needs to be able to hold company documents
> in the same way a contact can. This is where things i create for positing like articles and
> guides can have a home that is appropriately centralized around the tenant not any individual
> staff account."*

---

# WHAT ALREADY EXISTS — verified in production 2026-08-11. Build on it, do not restart it.

**`docs/DOCUMENT_LIBRARY_DESIGN.md` says "no document storage bucket". That is WRONG.**
Twelve buckets exist:

```
contracts · generated-documents · reports · horse-photos · horse-documents
facility-files · temporary-uploads · inventory-docs · horse-health · brand-assets
feed-media (public) · profile-images (public)
```

Only three hold anything: `feed-media` 6, `profile-images` 5, `brand-assets` 1.
**Do not create a thirteenth bucket per surface.** The buckets are not the missing piece.

**The missing piece is that nothing binds a stored file to a record.** Exactly one column in
the entire schema carries a storage path: `content_resources.storage_path`.

## The tenant home is already modeled and empty

`content_resources` — `id, title, description, kind, url, storage_path, published, created_at,
org_id` — is **org-scoped, not staff-scoped**, which is precisely the owner's requirement that
company material be *"centralized around the tenant not any individual staff account."*

**It has 0 rows.** `ContentStorePage.tsx` is routed at `/app/ops/content`, is **not in the
nav**, and **contains no upload code**. The home was designed, routed, and never finished.

**Use `content_resources` for articles and guides. Do not build a second table for it.**

---

# THE MODEL

## 1. One attachments table with a polymorphic subject

A file binds to a subject. Follow the shape this codebase already uses in `status_events`
(`entity_type` + `entity_id`), not a nullable FK per surface — the surface list is open-ended
(deal, contract, horse, stable page, lesson, offering, lead, directory card) and a column per
surface guarantees a migration every time a new one appears.

Minimum: subject type, subject id, `org_id`, bucket, storage path, original filename, mime
type, size, uploader, created_at, soft-delete.

## 2. The owner of a file is an ACCOUNT or the ORG

Both cases, one table:

- **Account-owned** — the member uploads it; it lives on their account and is surfaced
  elsewhere by reference.
- **Org-owned** — the company holds it. The company contact already exists
  (`352c3898-65d0-4a90-ad59-29107b7e03fe`, `is_company = true`), and `org_id` is on every
  table. **Org-owned means owned by the ORG, not by whichever staff account uploaded it** —
  that is the owner's explicit point, and it is the same platform-versus-person distinction as
  D1a. A staff member leaving must not take the company's documents with them.

## 3. Visibility is a REFERENCE, never a copy

*"lives on their account and can be made visible on other surfaces"* — one file, surfaced in
many places. Uploading a Coggins to a horse record and to a deal must not produce two files
that can drift. **Store once, reference many.**

## 4. An uploaded file is NOT a `documents` row

**This distinction is load-bearing. Do not blur it.**

`documents` are generated, signable, and evidentiary — 61 are EXECUTED and carry signatures,
and the project's rule is that they are never rewritten. An uploaded PDF is a *file*: it is not
composed from clauses, it cannot be signed through the contract engine, and it has no
`template_id`.

**Do not add uploads to the `documents` table. Do not make an attachment look like a contract.**
They may appear together in a UI — that is a rendering decision, not a schema one.

## 5. RLS, and it is the risky part

These are private buckets today and must stay private. Get the policies right before the UI:

- A member reads and writes **their own** attachments.
- Staff read tenant attachments; **D1a** — the platform owner (`admin@cactai.io`, `org_id`
  NULL) is not a tenant member and must remain denied.
- Org-owned material has a `published` concept already on `content_resources` — respect it.
- **`CREATE FUNCTION` grants EXECUTE to PUBLIC by default.** Explicitly
  `REVOKE … FROM PUBLIC, anon` on anything new, then print `has_function_privilege()` for
  `anon`, `authenticated` and PUBLIC. **A revoke that reports success may have done nothing** —
  this has happened three separate times here. Re-read the privilege; never trust the command.

## 6. Signed URLs, not public buckets

Private buckets plus short-lived signed URLs. **Do not flip a bucket public to make a render
work.** `feed-media` and `profile-images` are public deliberately; nothing in this task is.

---

# SCOPE — build the spine, not every surface

**In scope:** the attachments table and its RLS; upload + list + remove on **one** account
surface; org-owned uploads through `content_resources`, including putting `ContentStorePage`
in the nav and giving it the upload it never had.

**Out of scope, and report rather than build:** wiring every consuming surface. Deal,
contract, horse record, stable pages, lessons, leads and directory cards each have their own
layout questions. **Prove the spine on one surface and list what each remaining one needs.**

A spine that works on one surface is worth more than six half-wired surfaces — and this project
has already paid for the alternative.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-uploads`, branch `task/uploads`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **`AppLayout.tsx`**: the nav entry for the content store must be **reported, not edited** —
  other threads work in that file.
- **Delete nothing.** Retire behind a boolean if a surface becomes redundant.
- Migrations: **no self-contained `COMMIT;`**, and **do not reuse a temp table name** another
  migration uses.
- No staff browser session exists and you will not be given one. **An upload flow cannot be
  proven without one** — prove the policies and the RPCs against SQL, state plainly that the
  browser upload is **NOT VERIFIED**, and give the owner a numbered checklist to run.
- Apply your proven work. **Do not leave it held.**

# REPORT

`docs/reports/TASK-UPLOADS-REPORT.md`. Include the RLS proofs (own / other member / staff /
platform owner), the grant output raw, and the list of consuming surfaces with what each needs.
