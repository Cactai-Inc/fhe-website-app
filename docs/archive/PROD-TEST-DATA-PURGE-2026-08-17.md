# PRODUCTION TEST-DATA PURGE — 2026-08-17

**Hard deletes against production, owner-authorised.** Recorded so anything found missing later has
a paper trail.

**Backup taken before any change:**
`~/Downloads/claude-code-repo/backups/prod-before-testpurge-20260817-013643.sql` (44MB, full
`pg_dump`). **Do not delete it.**

## Owner's ruling
> *"claire (her gmail), any cjzigs@icloud.com and charlesjzigmund@icloud.com are my tests… these
> along with any contracts and any horses and any documents or orders are all test articles…
> anything that is a test item needs to be fully removed, not soft deleted, not archived, complete
> hard delete."*
> *"CJ and Claire have admin accounts under French Heritage Equestrian (company) and those items
> dont get deleted."*
> *"the 18 signatures are not something to keep."*

## What was removed

**Pass 1 — four test CONTACT rows and everything hanging off them:**
CJ Z `cjzigs@icloud.com` · Charles Zigmund `cjzigs@icloud.com` · Charles Zigmund *(no email)* ·
Claire Bourdon `claire.bourdon21@gmail.com`
→ 30 documents · 18 signatures · 3 horses · 8 contracts · 2 purchases · 48 document-party links ·
12 invitations · 19 required-document rows.

**Pass 2 — five soft-deleted test contacts** (hidden but still present): AVERIFY2 Tester ·
ZZ Inboundalert Test · Throwaway Tester · two `cjzigs+inviteworks` aliases — plus **2 unsigned
duplicate draft documents**.

**Pass 3 — 9 orphaned `groups` rows** (8 `HORSE_OWNER`, 1 `RIDER`) pointing at contacts that no
longer existed. Created 2–4 August, present in the backup, **not caused by passes 1–2**. Same
trigger-bypassing origin as the orphaned documents — the FK is `ON DELETE CASCADE` and validated,
so normal operation cannot produce them.

## What was explicitly KEPT
- **All four TEAM rows**, including **French Heritage Equestrian `hello@fhequestrian.com`, the
  `is_company = true` anchor** that `company_contact_id()` resolves. Deleting it would have
  orphaned every company-attributed artifact and lazily recreated a *new* company contact.
- **`business_config.signatory_contact_id` was REPOINTED to the company contact** before its former
  holder was deleted.
- **All 319 bookings** — 279 available slots, 40 scheduled lessons. Zero touched.
- **Every real client's documents** — Sarah Morgan, Madeline Do, the Oleniks, Kit Garcin, Audrey
  Slater and the rest.
- **Mary Richardson's 12 DRAFT documents** — owner: *"probably drafts that are real unsigned"*.

## ⚠️ A mistake, and its correction
The purge also deleted **4 soft-deleted `contract_templates`** (`HORSE_LEASE`,
`HORSE_PURCHASE_SALE`, `HORSE_SALE_TRANSFER`, `RELEASE_HORSE_EXERCISE`). **That was wrong** — a
retired template is not a test item. **All four were restored from the backup** with their original
`deleted_at` timestamps and bodies; the table is back to 26 rows.

**STANDING RULE: templates are never deleted, hard or soft.** Retiring one *is* `deleted_at`. Old
versions must stay resolvable so a document signed against one can be reconstructed.

## Final state
`24 contacts · 1 horse · 57 documents · 51 signatures · 0 contracts · 26 templates · 319 bookings`
**No soft-deleted rows anywhere except the 4 retired templates — which is correct.**

## Still known-dirty
- **`AVERIFY2 Tester` and similar were only findable by eye** — pattern searches for `test`,
  `example`, `averify` now return nothing, so any remaining test accounts are named plainly.
  A contact-by-contact review by the owner is the only way to catch those.
