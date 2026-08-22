# TASK-ARCHIVE — an account can be hidden without destroying what it's evidence of

**Branch** `task/archive` · commit `09eaae9` (unpushed) · worktree `~/Downloads/claude-code-repo/wt-archive`
**4 migrations APPLIED to production** (`lrstswfxfsezdmvkvukc`) · **the two proof identities are archived on production**

---

## 0. Live-thread check

`git log --oneline -15` before starting: `STABILIZE` is **merged** (`83b26c1` + follow-up `6991ac7`),
and `ERRSWEEP` merged on top (`0bbfde2`). Nothing was in flight against `ProvisionClientForm.tsx`,
`admin.ts`, `RegisterComplete.tsx` or the category/provisioning path. A pre-existing `wt-archive`
worktree sat 4 commits behind at `c990559` with no unique commits; it was reset to `main` (`0bbfde2`)
before any work. **No overlap with this task's surface.**

---

## 1. Where the spec was right, and where it was stale

The **finding** was right and the **premise for it was not.** Both matter, so both are recorded.

| Spec claim | Verified state |
|---|---|
| D11 was ruled and never built | ✅ **True.** No `archive_contact`. No deleted-accounts view. The only writer of `contacts.deleted_at` in the entire codebase was a bare client-side `UPDATE` in `deleteContact()`. |
| `purge_account` is a hard delete and the wrong tool | ✅ **True**, unchanged, and untouched by this task. |
| The two STABILIZE identities cannot be hard-deleted | ✅ **True** — `b442080f…` carries 4 signatures on 4 EXECUTED documents; `6cc4cb7d…` is the LESSEE party on a live lease with FHE. |
| *"Zero source files filter on `deleted_at IS NULL`"* | ❌ **False.** 9 of the 16 direct `contacts` reads in `src/` already filtered (`listContacts`, `countContacts`, `listContactOptions` ×2, `listRecordContacts`, `Admin.tsx`, both intake lookups), and the four RPCs that actually drive Records/Contacts/the pickers — `staff_contact_directory`, `staff_contact_options`, `contract_party_options`, `admin_client_accounts` — all filtered on **every** arm. |

**Consequence:** §2 was not "add the filter in ~20 places." It was **find the three that missed it, and
make the filter structural so a fourth cannot appear.** The enumeration is §3 below, in full, because
the spec asked for it explicitly.

**The real, unnamed defect the enumeration turned up** was not a missing filter at all — it was a
**second archive mechanism that destroyed the account↔person link**. See §4.

---

## 2. §1 — archiving hides, never destroys

`20260822T0600_archive_1_the_account_hides_the_record_stays.sql`

- **`contacts.deleted_reason text`** — `deleted_at`/`deleted_by` already carried *when* and *by whom*;
  *why* (D19) had nowhere to go.
- **`is_protected_contact(uuid)`** — D1's denylist in one named place: the 4 protected contact ids,
  any `is_company` row, and any contact anchored to the 3 denied `auth.users` ids.
  ⚠️ **`purge_account` keeps its own inlined copy on purpose and was not edited** — its entire safety
  argument is that its allowlist and denylist are literals inside its own body that nothing external
  can widen. This is a deliberate duplication, flagged in §8.
- **`archive_contact(p_contact_id, p_reason)`** — staff-gated (`coalesce(has_staff_access(), false)`,
  D1a-safe), org-scoped, refuses protected identities, refuses an already-archived row.
  **Two column writes on one `contacts` row and nothing else.** Converged on `staff_archive_horse`
  (`20260815T2000`) — same guard, same two writes, same "not found, or already archived" failure.
- **`unarchive_contact(p_contact_id)`** — clears all three columns. Complete reversal.

`set_document_party_archived` was read and deliberately **not** converged on: it is a *per-party
overlay on one document*, a different thing from archiving a person, and merging them would give one
function two meanings.

---

## 3. §2 — every contact/client listing, enumerated

`20260822T0610_archive_2_archived_is_hidden_by_default.sql`

### The default (the trap)

> *"`deleted_at IS NULL` must become the DEFAULT everywhere, not an opt-in filter a screen forgets to add."*

```sql
CREATE POLICY contacts_hide_archived ON contacts
  AS RESTRICTIVE FOR SELECT TO authenticated USING (deleted_at IS NULL);
```

RESTRICTIVE, so it **ANDs** with whatever permissive policy admitted the row. This matters: `contacts`
carries three permissive-or-restrictive policies, and a staff read that missed `contacts_select` would
still be admitted by `contacts_admin_write` (`is_admin()`). A narrowed `contacts_select` would have done
nothing. The restrictive shape is also the established idiom here — every `*_org_boundary` policy in the
schema is one.

`contacts` is owned by `postgres` and is **not** `FORCE ROW LEVEL SECURITY`, so **SECURITY DEFINER RPCs
bypass this entirely** — which is exactly what §3 and §4 need.

**Verified live on production, as `authenticated` with CJ's claims:** `27` contacts visible, `0` archived
visible, `29` actually present.

### Direct table reads — 16 sites, 9 files (now all covered by the policy)

| File | Sites | Kind | Filtered before? |
|---|---|---|---|
| `src/lib/api.ts` | `listContacts`, `countContacts` | listing / KPI | ✅ |
| `src/lib/api.ts` | `myContactPhone`, `updateMyContactPhone` | own row | n/a (`id = current_contact_id()`) |
| `src/lib/api.ts` | `contactAddress` | detail by id | ❌ → now by policy |
| `src/lib/api.ts` | `deleteContact` | **the only `deleted_at` writer** | replaced (§1) |
| `src/lib/ops/api-barnops.ts` | `listContactOptions` | picker | ✅ |
| `src/lib/ops/api-employees.ts` | `listContactOptions` | picker | ✅ |
| `src/lib/ops/api-records.ts` | `listRecordContacts` | picker | ✅ |
| `src/lib/ops/api-intake.ts` | 2 lookups + 1 insert | resolve-by-email | ✅ |
| `src/lib/admin.ts` | phone overlay, phone write | listing overlay | ❌ → now by policy |
| `src/lib/contact.ts` (×4), `src/lib/contracts.ts` | own row / writes | n/a | n/a |
| `src/pages/app/Admin.tsx` | guardian names | listing | ✅ |

Plus 6 **embedded joins** (`contact:contacts(...)`) in `files.ts`, `api-boarding.ts` ×2,
`api-documents.ts`, `api-lessons.ts`, `api-employees.ts` — all now covered.
`api-documents.ts`'s `listDocumentPartyContacts` was the one embedded join that would have been *wrong*
to hide; **it has zero call sites** (verified) and is dead code.

### SECURITY DEFINER people-listings — audited all 97 functions binding `contacts`

Audited by extracting every alias bound to `contacts` per function and checking for
`<alias>.deleted_at IS NULL`. **Already correct:** `staff_contact_directory`, `staff_contact_options`,
`contract_party_options`, `admin_client_accounts` (all 3 arms), `member_directory_list`,
`template_past_signers`, `admin_client_overview`.

**Fixed — the three that missed it:**

| RPC | What it feeds | Fix |
|---|---|---|
| `credits_roster` | staff roster of who holds credits | `JOIN contacts c … AND c.deleted_at IS NULL` |
| `lesson_plan_roster` | the riders Claire works through | `AND (ct.id IS NULL OR ct.deleted_at IS NULL)` — LEFT JOIN preserved |
| `instructor_options` | the "who is teaching this" picker | `AND (c.id IS NULL OR c.deleted_at IS NULL)` |

**Deliberately NOT filtered** — every by-id read that *resolves* a party, signer, owner or author:
`contract_document_detail`, `document_parties_summary`, `contact_dossier`, `fill_party_fields_from_contacts`,
`party_user_ids`, `list_deals`, `staff_horse_records`, `lesson_plans_for_day`, `open_change_requests`,
`pending_fee_candidates` and the rest. **That is the feature** (D11/D15/D32): the account leaves the
roster; what it is attached to does not change for anyone else.

### Named surfaces, resolved

- **Records** (`/app/records`) — `all`/`leads`/`partners`/`vendors` → `staff_contact_directory` ✅;
  `clients` → `admin_client_accounts` ✅ + a supplementary `contacts` read that already filtered ✅.
- **Contacts** — the same `ContactDirectory` component, same RPC.
- **"The provisioning form's contact picker"** — **does not exist.** `ProvisionClientForm.tsx` has no
  contact query at all (it takes a `contactId`/email from its caller). Every real contact picker in the
  app resolves to `contract_party_options` (`NewContractPage`, `DealsPage`, `ContractPage`,
  `PartiesHorseCard`), `staff_contact_options` (`ClientRecordActions`), or `listContactOptions`
  (`ResourcesPage`, `AllocationRulesPage`) — all now covered.

---

## 4. The defect the spec did not know about — a second, destructive archive

The trap said *"do not build a second archive mechanism."* **One already existed, and it was the broken one.**

`admin_account_action(contact, 'soft')` — the Clients tab's "Soft delete — keep the data", labelled in the
UI *"preserves all history and signed documents"* — branched on whether the person had a login:

- **no login** → archived the contact. Correct.
- **HAS a login** → **did not archive the contact at all.** It ran
  `UPDATE profiles SET is_suspended = true, contact_id = NULL, org_id = NULL`.

`profiles.contact_id` is how the system resolves an account to a person — `current_contact_id()`,
`party_user_ids`, `my_documents`, delivery, signatures-by-signer. Nulling it means the person's own
executed documents stop resolving to their login, **the contact stays fully visible in every staff
listing** (it was never archived), and there is no way back: `'unremove'` only unsuspends, and nothing
else in the codebase re-points `contact_id`. The screen promised "keep the data" and performed the one
operation that loses the thing tying the data to the person.

`20260822T0620_archive_3_one_archive_mechanism_not_two.sql` converges both branches on `archive_contact`:
archive the contact, suspend the login, **sever nothing**. `'unremove'` now also unarchives, so the pair
is fully reversible. The `clients` soft-delete is unchanged — it is the engagement record, it has always
been a `deleted_at` flag, and nothing reads it as evidence.

UI copy corrected in `Admin.tsx`: *"Recoverable only at the database"* was no longer true.

---

## 5. §3 — the deleted-accounts view

`20260822T0630_archive_4_the_deleted_accounts_view.sql` + `src/pages/app/ops/ArchivedAccountsPage.tsx`

- **`archived_contacts()`** — admin-gated (`has_staff_access() AND is_admin()`, matching the control that
  archives and `admin_account_action` beside it; both owners carry ADMIN, so D26's Business Operations
  emphasis is about *where the surface is filed*, not a narrower grant). Returns who / when / by whom /
  why, plus **counts of what survived**: documents, executed documents, signatures, contracts they are a
  party to, orders, horses. **The ONE listing in the codebase that returns `deleted_at IS NOT NULL`.**
- **`contact_dossier`'s existence gate widened** to admit an archived contact — it refused them outright,
  so the view had nothing to click through to. Patched with a shape-assert (`RAISE EXCEPTION` if the gate
  ever changes shape) rather than a blind rewrite. **No second dossier was built**; clicking a row opens
  the same modal every other person-surface opens.
- **`ContactDossierModal` freezes itself** when the dossier's own `contact.deleted_at` is set: a banner
  with the date and reason, disabled fields and filing pills, hidden write panels (assign-documents,
  standing slot, attach-offering, provisioning), disabled Save. `update_contact_record` and those write
  RPCs all refuse an archived contact at the DB anyway — a control that can only fail is worse than none.

---

## 6. §6 — THE REACH

- **Where staff archive an account:** Records → any people tab → open a person → **Archive** →
  a red panel with a **required** reason field and a link to where they can be found again.
  (This is the same button that existed; it was a bare table `UPDATE` with a "Really archive?" toggle.)
- **Where staff find one again:** **Records → Archived** (`/app/records/archived`), last tab, admin-only.
  Filed as a Records tab, not a new nav row or a separate `ops/` route: Records **is** the people page,
  archiving happens from a Records row, and the way out and the way back are one click apart.
  It is also the second exit from the Clients tab's Archive action, whose copy now names it.

---

## 7. §5 / §7 — the tests, run

| # | Test | Result |
|---|---|---|
| 1 | `archive_contact` hides from every enumerated listing; `unarchive_contact` reverses completely | ✅ `staff_contact_directory` 2→0, `staff_contact_options` 2→0, `contract_party_options` 1→0, `admin_client_accounts` 2→0, `credits_roster` 0, `lesson_plan_roster` 0. After `unarchive_contact`: back to 2, `archived_contacts()` empty, all three columns NULL. |
| 2 | **Zero rows deleted anywhere** | ✅ `contacts=29 profiles=14 clients=20 documents=155 document_parties=224 signatures=71 contract_execution_audit=49 purchases=10 files=2 horses=5 lesson_credits=7 auth_users=19` — **identical** before migrations, after migrations, and after archiving both identities on production. |
| 3 | The view shows who/when/why and the documents open as before | ✅ Both rows with `archived_by_name = 'CJ Z'`, full reasons, and footprints `4 doc / 4 executed / 4 sig / 4 party` and `0 / 0 / 0 / 1 party`. `contact_dossier` returns 4 documents for the archived contact and reports `deleted_at`. |
| 4 | A real counterparty on a shared document is unaffected | ✅ The archived contact is LESSEE on lease `375efff8…` with **French Heritage Equestrian** as LESSOR. `document_parties_summary` still returns both parties with emails. Claire's `contract_document_detail` for that lease is **md5-identical before and after** archiving (`b4078a46…`), and her `my_documents`/`my_contract_documents` counts are unchanged. |
| 5 | The two STABILIZE identities archived, absent from Records, present with full history | ✅ Applied to production with reasons naming why each cannot be hard-deleted. 4 EXECUTED documents intact: `merged_body` 11637 / 12745 / 6677 / 14211 bytes, 1 signature and 1 `contract_execution_audit` row each, `deleted_at` NULL. |
| 6 | `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file | ✅ `tsc --noEmit` clean. Lint **46 warnings / 0 errors on both** branch and `main`. `test/db`: **51 failed / 26 passed files, 193 failed / 575 passed / 107 skipped tests on both**, and the failing-file lists `diff` **identical**. |
| — | D1 denylist refuses | ✅ Both the company contact (`352c3898…`) and a protected contact (`75475f66…`) raise `protected identity — refusing to archive`. |

---

## 8. FLAGGED — NOT FIXED

1. **`/api/hard-delete-client` is a live hard-delete path, reachable from the UI.** `Admin.tsx`'s danger
   zone still offers *"Hard delete — nuclear, irreversible … Erases all traces"* behind a `DELETE`
   confirmation, calling `adminHardDeleteClient` → a server endpoint. Under **D32** this is a second odd
   one out beside `purge_account`, but unlike `purge_account` it has **no allowlist**, **no D1 denylist**
   and **a button in the product**. It was out of this task's scope (the spec's traps name only
   `purge_account`) and is untouched. **Recommend it be retired behind the archive path, or given
   `purge_account`'s allowlist, before a real client is ever deleted with it.**
2. **`is_protected_contact()` duplicates `purge_account`'s inlined denylist.** Deliberate — see §2 — but it
   is now two lists that must agree. A future D1 change must edit both. Worth resolving in the rebuild.
3. **`platform_tenant_detail`'s `usage.contacts` counts archived rows** while `engagements`/`horses`/
   `documents` right beside it filter `deleted_at`. It is a platform-operator usage metric, not a staff
   contact listing, so it was left alone — but the four numbers now mean slightly different things.
4. **`pending_fee_candidates` and `open_change_requests` will still name an archived person.** Both are
   work queues over *outstanding items*, not people listings — an unpaid fee does not stop existing
   because the account was hidden. Left as-is deliberately; if the owner wants archived people out of the
   work queues too, that is a one-line change to each.
5. **The archive action is not logged to `status_events`.** D19 is satisfied by
   `deleted_at`/`deleted_by`/`deleted_reason` plus the existing `audit_contacts` trigger (which records
   the full before/after row in `audit_logs`). Adding it properly would mean extending
   `status_events.entity_type`'s CHECK, its vocab table, and `log_status_event`'s org-resolution branch —
   `'account'` there means an **invitation**, not a contact. Judged out of scope for a spec that asked
   only that the reason be captured.
6. **`test/db/fixtures/schema_snapshot.sql` was not regenerated.** It was already 6 migrations behind at
   `main` (last regen `671784d`, TESTREPAIR), which is the repo's accepted cadence; regenerating it is a
   deliberate, separately-verified act (TESTREPAIR's own report records how fragile the BEFORE/AFTER
   pattern is to a regen). The DB proof for this task was run directly against production instead, and
   the `test/db` failure set is confirmed identical to `main`.
7. **`listDocumentPartyContacts` (`src/lib/ops/api-documents.ts`) is dead code** — zero call sites. It is
   the one embedded `contacts` join that the new RLS policy would arguably be wrong to hide, and it does
   not matter because nothing calls it. Left in place (nothing is deleted); flagged so it is not
   resurrected as-is.

---

## 9. Files

**Migrations (all 4 applied to production)**
```
supabase/migrations/20260822T0600_archive_1_the_account_hides_the_record_stays.sql
supabase/migrations/20260822T0610_archive_2_archived_is_hidden_by_default.sql
supabase/migrations/20260822T0620_archive_3_one_archive_mechanism_not_two.sql
supabase/migrations/20260822T0630_archive_4_the_deleted_accounts_view.sql
```

**Source**
```
src/lib/api.ts                              deleteContact → archiveContact/unarchiveContact/archivedContacts
src/pages/app/ops/ArchivedAccountsPage.tsx  NEW — the deleted-accounts view
src/pages/app/ops/ContactsPage.tsx          Archive control captures a reason, calls the RPC
src/pages/app/RecordsPage.tsx               admin-only "Archived" tab
src/components/app/ContactDossierModal.tsx  reads deleted_at, freezes itself
src/pages/app/Admin.tsx                     "Soft delete" → "Archive", copy corrected
```
