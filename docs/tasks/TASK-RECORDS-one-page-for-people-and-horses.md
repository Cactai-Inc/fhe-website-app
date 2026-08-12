# TASK RECORDS — one page: Leads, Clients, Partners, Vendors, Horses

**SUPERSEDES `TASK-ONEPEOPLE`, which is retired.** That spec predates three owner rulings: that
*client* is a marker rather than a type, that vendors and partners are separate, and that horses
belong on this page. **Do not read it.**

**Owner, 2026-08-12**, across several messages:

> *"directories are collections of contacts, contacts are generic entries of people/businesses
> and then vendors, partners, clients/customers and leads are specific types of designations
> applied to contacts."*
> *"Vendors and partners are separate. Leads, Clients, Partners, Vendors."*
> *"team does not go alongside community members… that is a business configuration activity."*
> *"the horses in the system are shown as a category alongside the clients where they are also
> linked and referenced, and visa versa."*

---

# MEASURED IN PRODUCTION, 2026-08-12

```
contact_type   LEAD 6 · CONTACT 20 · TEAM 4 · DIRECTORY 0     one value per contact, EXCLUSIVE
clients        client_since 18 · customer_since 0            additive marker, stacks
groups         RIDER 16 · HORSE_OWNER 11 · GUEST 1           derived, additive
horses         4 live · 4 with an owner · 1 leased
```

**`contact_type` vocabulary today:** `LEAD · CONTACT · TEAM · DIRECTORY` (nullable), enforced by
a check constraint.

## The two layers, and why the tabs are not one dimension

- **`contact_type` is exclusive** — one value per contact.
- **Markers are additive** — and they already cross the type: **1 of the 18 client markers sits
  on a `TEAM` contact** (CJ's own). So "has a client marker" is not "is a CONTACT".

**Tabs are therefore not a pure `contact_type` filter.** Define each tab's rule explicitly and
state it in the report.

## The four TEAM rows, for context

`CJ Z` · `Claire Bourdon` · `French Heritage Equestrian` (the company contact) · **`CACTAI INC.`
(`admin@cactai.io`)**.

**⚠️ D1/D1a: `admin@cactai.io` is the PLATFORM owner and must hold ZERO FHE tenant rows.** That
row is a known violation that **leaves with the owner-run purge, never ad hoc.** **Do not delete
it, do not re-type it, do not "fix" it.**

---

# WHAT TO BUILD

## 1. The page is `Records`, not `Contacts`

By the owner's own definition a contact is *"a generic entry of a person/business"* — **a horse
is neither.** Once Horses is a peer tab, `Contacts` cannot be the container. **`Records` covers
both** and is already the word this codebase uses for the horse lanes.

## 2. Five tabs, flat

```
[ Leads ] [ Clients ] [ Partners ] [ Vendors ] [ Horses ]
```

Plus an **All** default across the people tabs if it reads well — **the owner asked for "one
click opens the house with everyone in it."** Horses is a peer of Clients, **not** a level above:
the records cross-link both ways and moving between them is the work.

**Team is NOT a tab.** It lives in Configuration — *"that is a business configuration activity."*

## 3. ⚠️ THE LOAD-BEARING CONSTRAINT — a tab strip over INDEPENDENT renderers

**Four tabs render the same row shape with a different filter. Horses renders a completely
different shape** — breed, sex, height, owner, lessee, lease state.

**Build this as a tab strip over independent list renderers, NOT as one table with a filter.**
Get it wrong and either horse columns get crammed into a contact table, or the contact tabs
inherit columns that mean nothing. **This is the single most likely way to make this feel
shoddy.**

**And there are already TWO tab layers here.** `Admin.tsx` (Clients) has nine **account-scoped**
tabs — Overview / Bookings / Documents / Orders / Payments / Activity / Posts / Messages / Login
— that appear when you isolate one person. **Those are a different layer and must read as one.**
Do not add population tabs to that array.

## 4. Split `DIRECTORY` into `VENDOR` and `PARTNER`

**`DIRECTORY` has ZERO rows, so this costs no data migration.** Owner's distinction:

- **Vendor** — you pay them. Farrier, vet, feed supplier, hauler.
- **Partner** — you work alongside them. Referring trainers, affiliated barns, event organisers,
  referral and co-marketing relationships. *(Event organisers move here from the old directory
  blurb.)*

**Five places change and nothing else:**

```
contacts check constraint            (contact_type)
src/lib/api.ts:2246                  ContactType union
ContactDossierModal.tsx:176          type picker
ContactsPage.tsx:388                 type picker
ContactsPage.tsx:42                  mode -> type map
DB: set_contact_type, admin_client_accounts   (if they enumerate)
```

**Keep `DIRECTORY` accepted by the constraint** as a deprecated value rather than removing it —
zero rows today, but a hard removal is the kind of thing that surprises a seeder.

## 5. Additive markers are FILTER CHIPS, not tabs

Rider · Horse owner · Company vs person. **These stack; tabs do not.** A contact in two tabs is
correct — **show designation badges on the row** so it reads as correct rather than duplicated.
The app already derives badges this way for RIDER/HORSE_OWNER; follow that pattern.

## 6. Reuse what exists — do not rebuild

- `ContactDirectory({ mode })` in `ops/ContactsPage.tsx` already parameterises the list, with all
  copy in one `MODE_COPY` map. **Leads and the two new types are modes.**
- `Admin.tsx` (1005 lines) is the Clients roster — cards, search, sort, isolate, per-person tabs.
  **Compose it; do not port it.**
- The Horses list: **`TASK-HORSEONE` is HELD** pending the owner's A/B/C review of three horse
  surfaces. **Use whichever is live (`/app/ops/horse-records`) and do not pre-empt that ruling.**

## 7. Cross-links both ways

A client's record shows their horses; a horse's record shows its people. **Both already exist in
the data** — `horses.current_owner_contact_id`, `horses.lessee_contact_id`,
`horse_relationships`. Make them navigable **within the page** — that is the reason horses is a
peer tab rather than a separate destination.

## 8. Nav

One `Records` entry replaces `Leads`, `Clients` and `Directory` in `ACCOUNTS_GROUP`. **Inherit
one of their existing icons; do not introduce a fourth glyph, and do not reuse `UserRound`** —
Team took it 2026-08-12 for the same anti-collision reason.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-records`, branch `task/records`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **`AppLayout.tsx` is contended** — `TASK-REVIEWNAV` merged a `REVIEW` group into it on
  2026-08-12 and `TASK-PAGEVIS` may be running. **Rebase first**, and if PAGEVIS is in flight,
  **report the nav change as a diff instead of applying it.**
- **⚠️ REVIEWNAV moved live page entries into a temporary `REVIEW` nav group** and recorded where
  each came from. **Read `docs/reports/TASK-REVIEWNAV-REPORT.md` before touching the nav** — some
  of these pages may currently sit under Review, and this task must not undo that scaffolding.
- **`DashboardPanel.tsx` and `ops/IntakePage.tsx` belong to LEADCLEAN's shipped design.** The
  dashboard's open-lead cards are a **different thing** from the Leads tab (a LEAD-typed contact
  list). **Do not merge those two concepts** — verify the distinction holds and say so.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Delete nothing.** `Admin.tsx` and `ContactsPage.tsx` both survive as components.
- **Do not change what any list displays.** This is composition, routing and a type split.
- **D1a:** `admin@cactai.io` has `org_id` NULL by design; being denied by tenant surfaces is
  correct. **Never give it an org, never touch its contact row.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run, apply, verify.
- **`test:db` is broken** (55/64 failing) — **do not cite it as proof.** Verify against production.
- No staff browser session exists. Report the render as **NOT VERIFIED** with a numbered
  checklist.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. One `Records` page with **Leads · Clients · Partners · Vendors · Horses**, each addressable
   by URL.
2. Old routes (`/app/ops/leads`, `/app/ops/directory`, `/app/admin`) **redirect to their own
   tab**, not to the page default.
3. The Clients tab keeps its roster cards, isolate interaction and **all nine per-person tabs**,
   and those read as a different layer from the population tabs.
4. **Horses renders its own row shape** — no contact columns, no crammed layout.
5. `VENDOR` and `PARTNER` are accepted types; `DIRECTORY` still validates; **no contact row
   changed type**.
6. Team appears **nowhere** on this page.
7. A horse links to its people and a person links to their horses, without leaving the page.
8. The nav shows **one** Records entry.

Report to `docs/reports/TASK-RECORDS-REPORT.md`.
