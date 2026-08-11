# TASK-UPLOADS — the Files spine

**Branch** `task/uploads` (off `origin/main` @ `a9b2042`) · worktree `~/Downloads/claude-code-repo/wt-uploads`
**DB** `lrstswfxfsezdmvkvukc` — migration **APPLIED to production** and verified.
**Not pushed.**

---

## What was built

| | |
|---|---|
| `files` | one row per stored object. **Ownership is a column**: `owner_kind` + `owner_contact_id`. `uploaded_by_user_id` is audit only. |
| `file_links` | polymorphic surfacing — `(subject_type, subject_id)`, the `status_events` shape. One file, many surfacings, **never a copy**. |
| `content_resources.file_id` | the org's articles and guides keep their existing home and now point at a `files` row. **No second table.** |
| storage policies | on the existing private `facility-files` bucket. **No thirteenth bucket.** |
| `src/lib/files.ts` | the client spine: upload, list, signed URL, remove, company upload. |
| `src/components/app/FilesContent.tsx` | **My Files** — the one account surface this is proven on. |
| ContentStorePage | **Company files** — the upload it was routed for and never had. |
| `test/db/uploads_files_spine.test.ts` | 11 tests, applied to a **fresh** database, all passing. |

Migration: `supabase/migrations/20260811T1600_uploads_files_spine.sql`.
Proof script: `docs/reports/TASK-UPLOADS-rls-proof.sql`.

### Two tables, not one — and why

The task specified *"one attachments table with a polymorphic subject."* It also
specified, in §3, *"Store once, reference many … Uploading a Coggins to a horse
record and to a deal must not produce two files that can drift."* One table with
one subject cannot satisfy the second: surfacing the same file twice needs two
rows, and two rows carrying ownership, title and size is exactly the drift §3
forbids. **§3 governs.** `files` holds the object and its owner; `file_links`
holds the surfacings. The task's minimum column list is satisfied across the
pair. Proof 6 below shows one file surfaced on a record and still exactly one
`files` row.

### Storage: reuse, not a new bucket

Path grammar, parsed by the storage policies and enforced by a table `CHECK`:

```
{org_id}/{owner_kind}/{owner_id}/{file_id}-{safe_filename}
```

`facility-files` was chosen: private, empty, and the only generically-named
bucket of the twelve. Reads are 600-second signed URLs minted at click time. No
bucket was made public.

---

## RLS proofs — raw output

Run against **production**, post-apply, inside `BEGIN … ROLLBACK`. Identities:
member A = `sarahrosengard@`, member B = `maeboon@`, staff = `admin@fhequestrian.com`,
platform owner = `admin@cactai.io` (`org_id` NULL).

Seed: one file owned by member A, one **published** company guide, one
**unpublished** company draft, and A's file surfaced on a horse record.

### 1 — `files`

```
       identity       |         files it can read
----------------------+-----------------------------------
 A (owner)            | coggins.pdf, guide.pdf
 B (other member)     | guide.pdf
 STAFF (tenant admin) | coggins.pdf, draft.pdf, guide.pdf
 PLATFORM OWNER (D1a) | (nothing)
 anon                 | (nothing)
```

A sees their own file plus the published company guide. B sees only the guide —
**not A's file**. Staff see all three including the unpublished draft. The
platform owner and anon see nothing.

### 2 — `storage.objects` (the bytes; a signed URL needs SELECT here)

```
       identity       |                             objects it can read
----------------------+--------------------------------------------------------------------------
 A (owner)            | …001-coggins.pdf, …002-guide.pdf
 B (other member)     | …002-guide.pdf
 STAFF (tenant admin) | …001-coggins.pdf, …002-guide.pdf, …003-draft.pdf
 PLATFORM OWNER (D1a) | (nothing)
 anon                 | (nothing)
```

The object layer matches the row layer exactly. A member cannot mint a signed URL
for a file they cannot see.

### 3 — D1a across **all twelve** buckets

```
 objects the platform owner can read, all buckets |  8
 objects the TENANT admin can read, all buckets   | 15
```

The platform owner's remaining 8, broken down:

```
   bucket_id    | count |                first_segment
----------------+-------+--------------------------------------
 feed-media     |     6 | (other users' uids)
 profile-images |     2 | 3c5d6af1-… (its own uid)
```

Both are correct: `feed-media` is a deliberately **public** bucket readable by
anon, and the two `profile-images` objects are the platform account's own avatar
under its own prefix. **Zero private tenant objects.**

### 4 — writes: who may claim ownership of what

```
                scenario                 |      outcome
-----------------------------------------+--------------------
 A uploads a file it owns                | ALLOWED  ← correct
 A writes a row owned by B               | DENIED  ← correct
 A claims ORG ownership                  | DENIED  ← correct
 STAFF scans a file FOR B (B owns it)    | ALLOWED  ← correct
 PLATFORM OWNER writes a tenant file     | DENIED  ← correct
 A writes an OBJECT under B's prefix     | DENIED  ← correct
 A writes an OBJECT under its own prefix | ALLOWED  ← correct
 A's row points at B's path              | DENIED  ← correct
```

Row 4 is the owner's ruling made operational: staff scan a member's document, the
**member** is recorded as owner, the staff account only as uploader. Row 8 is the
path `CHECK` — a row cannot describe an object living under someone else's prefix.

### 5 — `published` gates company material

```
           check           |  visible
---------------------------+-----------
 member B, org-owned files | guide.pdf

                   check                   |  visible
-------------------------------------------+-----------
 same member, after unpublishing the guide | (nothing)
```

Unpublishing withdraws the **object** too, not just the listing — the storage
policy reads the same `content_resources.published` flag the row policy does.

### 6 — surfacing is a reference

```
       identity        | surfacings it can see
-----------------------+-----------------------
 A (owner of the file) | horse
 B (other member)      | (nothing)
 STAFF                 | horse
 PLATFORM OWNER (D1a)  | (nothing)

 files rows for the surfaced Coggins (must be 1, not 2) |  1
```

### 7 — grants, raw

**No functions were created by this task**, so there is no `CREATE FUNCTION`
EXECUTE-to-PUBLIC grant to revoke — the trap the task warns about (three prior
occurrences) has no surface here. The policies call six pre-existing helpers;
their privilege state, read back rather than assumed:

```
      function      | anon | authenticated | PUBLIC
--------------------+------+---------------+--------
 current_contact_id | t    | t             | t
 current_org        | t    | t             | t
 has_staff_access   | t    | t             | t
 is_active_member   | t    | t             | t
 is_admin           | t    | t             | t
 try_cast_uuid      | t    | t             | t
```

`anon` holding EXECUTE on these is pre-existing and harmless: with no JWT they
return NULL/false, which is why the anon rows in proofs 1 and 2 read `(nothing)`.

### 8 — fresh-database proof

`test/db/uploads_files_spine.test.ts` applies the migration to a **fresh** PGlite
database (the harness's snapshot path predates it) and re-proves all of the above
independently of production data. **11/11 pass.** Typecheck (app + api) clean;
lint **0 errors, 36 warnings — identical to `origin/main`'s 36**, so this branch
adds none (CLAUDE.md's "~26 pre-existing warnings" is stale); `npm run build`
succeeds through prerender.

The rest of `npm run test:db` fails **identically on `origin/main`** — the
snapshot references the retired `engagements` table and a service-catalog label
has drifted. Pre-existing, unrelated, and not touched here.

---

## A pre-existing hole this closes

`storage_admin_all` granted `ALL` on **every object in every bucket** on bare
`is_admin()` — no org test. `is_admin()` is `role IN ('ADMIN','SUPER_ADMIN')`, and
the platform account is `SUPER_ADMIN`, so `admin@cactai.io` could read and write
every tenant file in the system, including the tenant's private `brand-assets`.

Adding one condition — `AND current_org() IS NOT NULL` — closes it. Tenant admins
are unaffected (proof 3: 15 of 15). This is the same shape as the ~48
`coalesce(…, false)` repairs D1a already sanctioned, and it is why the D1a proofs
above are meaningful rather than accidental.

**Before this task, "the platform owner cannot see tenant files" was not true of
storage.** It is now.

---

## Two claims in the task doc that are not accurate

1. **"`ContentStorePage` … is not in the nav."** It is —
   [AppLayout.tsx:324](src/components/app/AppLayout.tsx#L324), Community group,
   `{ to: '/app/ops/content', label: 'Content store', icon: Library }`, and it is
   in `src/lib/grants.ts`. **No `AppLayout.tsx` edit was needed or made**; the
   constraint to report rather than edit that file is satisfied by there being
   nothing to change.
2. **`ContentStorePage` is not the `content_resources` editor.** It edits
   `content_blocks` (versioned slug-keyed copy/policy blocks) — a different table
   that this task did not touch. The Company files section was added **below** the
   existing editor; nothing was removed.

---

## A live defect fixed on the way

[community.ts](src/lib/community.ts) `resourceDownloadUrl()` signed against a
bucket named **`members`**, which has never existed. Every call returned `null`,
so no company resource has ever been downloadable. Now points at
`facility-files`. `content_resources` has 0 rows, so nothing was lost — but the
function would have failed silently the first time it was used.

---

## NOT VERIFIED — no browser session

There is no staff browser session and none was requested. **The browser upload
path is NOT VERIFIED.** What *is* verified is everything the browser depends on:
the policies, the path grammar, the ownership rules, the published gate, and that
the code typechecks, lints and builds. What is unproven is the round trip through
`supabase-js` — the multipart PUT, the MIME sniffing, and the signed-URL fetch.

### Owner checklist

**A — a member's own file**
1. Sign in as a non-staff member (e.g. `sarahrosengard@`). Go to **Account**.
2. Confirm a **My Files** row sits below **My Documents**. Open it.
3. Click **Upload a file**, choose a small PDF. Expect "Uploaded <name>." and the
   file listed with its date and size.
4. Click **Download**. Expect a new tab showing the PDF.
5. Reload the page. The file is still listed.
6. Click **Remove**, confirm. Expect "Removed <name>." and an empty list.

**B — the fence** (the part worth actually checking)
7. Sign in as a **different** member. Open **My Files**. Expect the other
   member's file is **absent**.

**C — company files**
8. Sign in as staff. Nav → Community → **Content store**. Scroll to **Company
   files**.
9. Give a title, leave "Publish to members immediately" ticked, upload a PDF.
   Expect it listed as **Published**.
10. Click **Download**. Expect the PDF.
11. Click **Unpublish**. Expect it to read **Not published**.
12. Sign in as a member and confirm the file is not reachable. (See "not wired"
    below — today this is a DB-level check, not a UI one.)

If step 3 or 9 fails with a storage error, the policy names to look at are
`files_owner_object_rw` and `files_staff_object_rw` on `storage.objects`.

---

## Consuming surfaces — what each one needs

The spine is proven on **one** surface (Account → My Files) plus the company home.
Everything below is a `file_links` row and a list component; **none of it was
built**, per the task's instruction to report rather than half-wire six surfaces.

The shared shape for every one of them: read `file_links` filtered to
`(subject_type, subject_id)`, join `files`, render with `fileDownloadUrl()`;
write by inserting a `file_links` row (staff-writable today). What differs per
surface is the layout question and the permission question, listed here.

| Surface | `subject_type` | id to use | What it needs beyond the shared shape |
|---|---|---|---|
| **Deal** — [DealPage.tsx](src/pages/app/ops/DealPage.tsx) | `deal` | `deals.id` | Nothing structural. Files must render **visibly separate** from the deal's `documents` — same page, different section, different heading. This is the surface most at risk of blurring the two concepts. |
| **Contract** — [ContractPage.tsx](src/pages/app/ContractPage.tsx) | `contract` | `contracts.id` | Same, and stricter: an executed contract is evidence. A file attached to it must never render inside the paper, only alongside it. Consider read-only after execution. |
| **Horse record** — [HorsePage.tsx](src/pages/app/HorsePage.tsx), [HorseRecordsPage.tsx](src/pages/app/ops/HorseRecordsPage.tsx) | `horse` | `horses.id` | **The permission question this task did not answer.** A Coggins on a horse must be readable by that horse's owner(s) even though a *different* member uploaded it. Needs a `files` SELECT policy arm using `client_can_read_horse()` (already exists, already used by `storage_client_read_horse`) plus a matching storage arm. Do this before the UI. |
| **Stable pages** — [Stable.tsx](src/pages/app/Stable.tsx), `stable_items` | `stable` | `stable_items.id` | Member-owned items, so the owner arm already covers it. Needs a decision on whether a shared-back item's files travel with the share. |
| **Lessons** — [MyLessons.tsx](src/pages/app/MyLessons.tsx), `lesson_credits` / `fulfillment_units` | `lesson` | fulfillment unit id | The subject grain is genuinely unclear: a lesson *package*, a *session*, or a *credit*. Pick one before writing rows — repointing them later is a data migration. |
| **Offerings** — [CatalogPage.tsx](src/pages/app/CatalogPage.tsx) | `offering` | `offerings.id` | These are catalog attachments (a syllabus, a waiver PDF) and are effectively **org-owned**, not member-owned. Route through `content_resources` + `published` rather than inventing a third visibility rule. |
| **Leads** — `LeadsPage` in [ContactsPage.tsx](src/pages/app/ops/ContactsPage.tsx) | `lead` | `contacts.id` | A lead is a `contacts` row with no account, so there is no `current_contact_id()` to own the file. Owner is either the org or the contact-without-account — **needs an owner ruling**; the schema allows `owner_contact_id` on a contact with no profile, but nobody can then read it as "theirs". |
| **Directory cards** — `DirectoryPage`, `vendors` | `directory_listing` | `vendors.id` | External providers. Files here are almost certainly org-owned (a farrier's insurance certificate the *stable* holds). Confirm before building. |
| **Community → Resources** — [communityFeed.ts:211](src/lib/communityFeed.ts#L211) | n/a | n/a | Already lists `content_resources` and now has a working `resourceDownloadUrl()`, but the card has **no download control**. Members cannot yet open a published company guide from the UI. Smallest item on this list and the one that completes the company-files loop. |
| **Orders / bookings** | `purchase`, `booking` | `purchases.id`, `bookings.id` | Not requested by the owner; the `subject_type` values exist so a receipt or a coggins-for-a-booking has somewhere to go without a migration. |

Adding a surface not on this list is **one line** in the `file_links.subject_type`
CHECK and one in `FileSubjectType` — not a migration per column, which is what
the polymorphic shape bought.

---

## Flagged, not fixed

1. **Account deletion vs. files.** Per the owner ruling, nothing here
   cascade-deletes. `purge_account` does not know about `files`, so purging a
   member today leaves their files with a dangling `owner_contact_id`. **Needs a
   ruling**: does a departing member's file go with them, stay with the stable, or
   get offered back? Until then, purge will orphan rather than delete — which is
   the safer failure but is not a decision anyone made.
2. **Member "remove" deletes the bytes, tombstones the row.** `removeMyFile()`
   soft-deletes the `files` row and hard-deletes the storage object. The
   reasoning: it is the member's property and "remove" must mean removed, while
   the tombstone preserves that a file was here and where it had been surfaced.
   If the owner wants recoverable removal instead, it is a one-line change (drop
   the `storage.remove` call) plus a retention policy.
3. **Cross-member reads are not built.** A file is readable by its owner and by
   staff. The horse-record case above is the first surface that needs more, and
   the policy arm for it is described there.
4. **Members cannot create `file_links`.** Only staff can surface a file on
   another record; a member can *withdraw* a surfacing of their own file
   (`file_links_owner_unlink`). Member-initiated surfacing needs a per-subject
   permission check that does not exist yet.
5. **`storage_admin_all` is now org-gated but still not path-scoped.** A second
   tenant's admin could read tenant #1's objects in buckets whose path grammar
   does not start with an org id (`contracts`, `generated-documents`, `reports`,
   `profile-images`, `temporary-uploads`). Single-tenant today, so not live — but
   it is the next thing to fix in this file, and it is larger than one condition.
6. **Staff have no personal Files surface.** The Account page renders only
   Profile and Login for staff (owner ruling 2026-08-08: for staff, Account *is*
   the company). My Files sits inside the existing `!isStaff` block, so a staff
   member has no personal file surface — the company's files are on the Content
   store instead. That matches the ruling; flagging in case it reads as a gap.
7. **`content_resources.storage_path` is now redundant with `file_id`.** Both are
   written, and the storage policy reads `storage_path`. Nothing was deleted.
   Collapsing to `file_id` alone is a later cleanup.
