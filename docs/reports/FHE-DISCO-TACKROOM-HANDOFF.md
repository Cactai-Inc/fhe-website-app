# FHE-DISCO-TACKROOM — HANDOFF (CR-109, DISCO profile, research only)

**Thread:** `FHE-TASK-TACKROOM` wearing the DISCO profile (D41). **Date:** 2026-09-02. **Base:** `main` @ b846b227.
**Read-only against production** — every number below was run as a query on 2026-09-02; the query is
named beside it. No code, no migration, no write.

**Next stop: `ORCH`** — step 3 (discussion & lock) happens in ORCH's window under D41. Nothing here is
locked; §5 lists what the owner has to rule on before a DSNR-profile task can shape it.

---

## 1. THE REQUEST, VERBATIM (CR-109, owner, 2026-09-02)

> *"We have Stable and Tackroom management and tracking needs, if these are bucketed under 'Barn Ops'
> we need to review the layout, inclusions, capabilities, and access/ui visibility. I've only ever seen
> My Stable which shows My Horses and My Gear. As a business with a tackroom we have horse specific
> gear and supplies and general use gear and supplies, logging, tracking, management, and visibility
> for gear and supplies appears to be split between a single gear page and horse specific supplies
> section on the horse records. Im not sure this is ideal, it would be better to have dedicated pages
> for Horses, Gear, Supplies, and Business (boarding, tackroom, signage, insurance, decorative items
> for the tackroom, furniture, etc...), and then the ability to assign things to eachother. so we would
> assign gear to the horse(s) that use it, select the feed and bedding from the supplies page on each
> horses record and input how much they use every month to track consumption on a per horse basis and
> aggregate so we can see the depletion of the amount on hand shown in the supplies page."*

Related rulings already in force: **D43 / CR-108** (the location is the *ranch*; FHE boards there and
rents a tackroom; "Barn Ops" is a misnomer twice over and its name is held for this review).

---

## 2. WHAT EXISTS TODAY — the inventory

### 2a. The `mod.barnops` module (staff, org-scoped, module-gated)
Built 2026-06-30 as the platform's "crown jewel" cost-attribution ledger, mirroring the contract
engine: *log dumb facts cheaply, price and attribute them later with a deterministic resolver.*

| Piece | What it holds | Production rows (2026-09-02) |
|---|---|---|
| `resources` | catalog: key, name, **category ∈ feed · med · bedding · supply · equipment**, unit of measure, `is_consumable` | **0** |
| `resource_lots` | a purchase: resource, **vendor = a `contacts` row**, qty purchased, unit cost, **`on_hand`**, purchased_at | **0** |
| `consumption_events` | the fact: resource, optional lot, **optional horse**, qty, occurred_at, notes, administered_by. **APPEND-ONLY** (UPDATE/DELETE revoked — verified in `role_table_grants`) | **0** |
| `cost_allocation_rules` | payer overrides by scope (horse / lease / board / **default**), share %, effective dates | **0** — including **zero `default`-scope rows** |
| `resolve_consumption_billing(period)` | RPC: events × (override → `horse_relationships.share_pct` → default payer) → `billable_lines` rows, source_kind `consumption` | **0** consumption lines ever emitted |

Four pages, all routed behind `requireStaff` + `ModuleGate('mod.barnops')`:
- `/app/ops/barnops` — hub with three cards + live counts.
- `/app/ops/barnops/resources` — **Resources & lots**: catalog CRUD; "Add lot" (vendor, qty, unit cost);
  a "stock level" column = **sum of `on_hand` across the resource's lots**.
- `/app/ops/barnops/consumption` — **Consumption log**: capture form (resource, lot, horse-optional,
  qty, occurred-at, notes) + recent list. No edit, no delete, by design.
- `/app/ops/barnops/allocation-rules` — **Cost allocation rules** CRUD + **"Resolve billing"** for a
  chosen month (calls the RPC, lists the lines it produced).

⚠️ **THREE THINGS THE MACHINERY DOES NOT DO, measured:**
1. **Consumption never depletes `on_hand`.** No trigger on `consumption_events` touches lots
   (`pg_trigger`: only the audit trigger); the resolver reads `unit_cost` and never writes `on_hand`;
   no function in the database references `on_hand` except an unrelated contract-block expander. The
   only way `on_hand` changes is a staff member editing the lot by hand. **"Depletion of the amount on
   hand" — the thing the owner asked for — is not implemented anywhere.**
2. **No per-horse read of consumption exists.** The log is a flat recent-50 list. The only aggregation
   by horse is inside the billing resolver, which writes money lines, not usage totals.
3. **The resolver cannot run for FHE today.** With zero `default`-scope rules, the first event that is
   not fully covered by a horse split raises *"no default/barn payer is configured"*. The
   `provision_tenant` seeding that was meant to plant that row (its source references
   `cost_allocation_rules`) did not leave one for FHE.

Also found: `src/lib/api.ts` carries a **second, dead copy** of every barnops wrapper (types and
functions, ~300 lines); every page imports from `src/lib/ops/api-barnops.ts`. Nothing imports the
`api.ts` copy. `DB-MAP.md` lists both as callers of the resolver.

Tests: `test/db/mod_barnops.test.ts` + `test/db/e2e_consumption.test.ts` exist (29 tests) and are
**red on `main` today (19 failed / 10 passed)**. Two causes, not one: the module-gate tests still assume
FHE has `mod.barnops` **OFF** (false since TASK-PAGEVIS, 2026-08-12); and the append-only / resolver
money assertions fail in the PGlite snapshot (an UPDATE that should be rejected resolves; a sum that
should be 18 comes back 2397.6). Production's REVOKE is intact (verified); whether the snapshot lost it
or test data leaks between files is a TESTREPAIR-shaped question, not this profile's.

### 2b. My Stable (`/app/stable` + the Account-page panel) — the page the owner has seen
Member-scoped. Three lists on one page: **Horses · Gear · Supplies**, plus a staff-only toggle
**"The business / My own"**.

| List | Source | Fields | Production rows |
|---|---|---|---|
| Horses | `my_stable_horses(p_as_company)` — horses where the scope contact is owner, lessee, or an active `horse_relationships` party | the real horse record | **0 of 3 for "The business"** — all three horses (Tiz, Sundance, Secret) are owned by client contacts (Abby Little, Pamela Godde, Sarah Morgan), none by the company contact; "My own" for hello@ is also 0 |
| Gear | `stable_items` kind=`gear` | name, detail, vendor (→ `vendors` table), `owner_kind` contact\|org | **0** |
| Supplies | `stable_items` kind=`supply` | same shape | **0** |

`stable_items` has **no quantity, no cost, no horse link, no category** — it is a named list with a
vendor link. The seed fallback is off (`SEED_ENABLED = false`), so what the owner saw was **three empty
lists** with "+ Horse", "+ Add gear", "+ Add a supply". The member-facing overview copy already calls
this page *"My Stable — your tackroom"* for riders.

`vendors` (0 rows) is My Stable's own vendor directory; a vendor marked `shared` is surfaced in the
Community feed's **Resources** view. It is **not** the `contacts` vendor type that the Records page's
**Vendors** tab lists, and **not** what `resource_lots.vendor_contact_id` points at (that is `contacts`).
**Three vendor notions exist**: contacts-of-type-vendor (Records › Vendors), the `vendors` table (My
Stable + Community Resources), and lot vendors (barnops → contacts).

### 2c. The horse record's "supplies"
What the owner calls the *horse-specific supplies section* is `horse_medications`:
kind **MEDICATION | SUPPLEMENT**, name, dosage, instructions, **cost, supplier website/phone, Rx info,
order units, days supply**. Written by the intake form (repeatable "Medications" and "Supplements"
blocks), read by `/app/horses/:id` as the card *"Medications & supplements"*.
Production: **3 rows** — Sundance › SUPPLEMENT "Smartpak"; Tiz › MEDICATION "equioxx"; Secret ›
MEDICATION "Adeqon"; every cost/order/supplier column blank.

The `horses` table (64 columns) carries **nothing for feed, bedding, tack, blanket or equipment** — the
nearest are stall, care-giver and free-text notes. Staff's own horse roster (Records › Horses tab,
`HorseRecordsPage`) links each horse to **Parties** and **Health** only; it has no link to
`/app/horses/:id`, so the meds/supplements card is a member-side view that staff reach only by URL.

### 2d. Summary — where "gear" and "supplies" live right now

| Concept | Home 1 | Home 2 | Home 3 |
|---|---|---|---|
| Gear / tack | `stable_items` kind=gear (My Stable; per member or org; no qty) | `resources` category=equipment, `is_consumable=false` (barnops; lots with cost) | — |
| Supplies (feed, bedding, meds, misc) | `stable_items` kind=supply (My Stable) | `resources` feed/med/bedding/supply + `resource_lots.on_hand` (barnops) | `horse_medications` SUPPLEMENT on the horse record (cost/supplier/order fields) |
| Horses | Records › Horses tab (staff roster, `staffHorseRecords`) | My Stable › Horses (member-scoped, 0 for the business) | `/app/horses/:id` record page |
| Vendors | Records › Vendors (contacts) | `vendors` table (My Stable / Community Resources) | `resource_lots.vendor_contact_id` (contacts) |
| Gear → horse assignment | **nowhere** | | |
| Horse → feed/bedding selection with a monthly quantity | **nowhere** (the closest is a per-event `consumption_events.horse_id`) | | |
| Business items (tackroom rent, signage, insurance, décor, furniture) | **nowhere** (nearest: `resources` equipment, or `stable_items` owner_kind=org) | | |

**Everything in the table is empty in production except the three medication rows.** There is no data
to migrate; the convergence question is about shape, not about moving records.

---

## 3. WHY THE BARNOPS PAGES ARE UNSEEN (the D17 question) — answered

1. **They are not in the rail, by ruling.** The Barn Ops row lives in `MODULES_GROUP` in
   `AppLayout.tsx`, and since **TASK-FIX3 (2026-08-31)** the `modules` group is `CARD_PAGE_ONLY`:
   `railNavGroups()` strips it from all three nav surfaces (desktop rail, mobile drawer, avatar menu).
   The owner asked for exactly that on 2026-08-15 ("the settings and modules sections are still in the
   nav"); FIX3 is when the code finally did it.
2. **The remaining doors are quiet.** Barn Ops reaches staff as (a) the **last `NavRow` on
   `/app/account`** — after My Profile, My Login and **My Stable** — labelled *"Barn Ops — Resources,
   consumption & allocation rules"*; (b) a **module tile** on the admin dashboard's "Modules" panel
   (`OpsDashboard`, rendered for admins by `OpsHome`); (c) `/app/ops/modules`, a card page nothing
   advertises since FIX3. **The owner's "I've only ever seen My Stable" is the row immediately above
   Barn Ops on the same Account page.**
3. **"Nav rows" in the ledger note are registry rows, not rail rows.** `pageRegistry.ts` lists
   `barnops.hub/resources/consumption/allocation_rules`, but the registry feeds only the Page-visibility
   editor (`/app/ops/admin/pages`). **The rail never reads the registry** — its source is the
   hand-written `NavItem` arrays — and `org_page_visibility` has **0 rows** and is wired to nothing
   (the registry header says so itself). A registry row proves the page is *entitled*, not *reachable*.
4. **The window in which it was ever in a rail was 16 days and it was always empty.** Before
   TASK-PAGEVIS (2026-08-12) `mod.barnops` was OFF for FHE (the DUPECENSUS report's "disabled" claim was
   true then and is stale now); from 2026-08-12 to 08-31 the Modules group sat in the rail; since 08-31
   it does not. The tables have had 0 rows throughout.
5. **My Stable itself is half-hidden for staff.** The member rail's "My Stable" link is
   `useNavPresence(!isStaff)` — off for staff. Staff reach `/app/stable` only from the Account-page row;
   the Community › **Stable** row in the staff rail points at **Records › Horses**, not `/app/stable`
   (TASK-AR3 F3: the member surface returns 0 of the tenant's 3 horses for staff — still true today).

---

## 4. THE OWNER'S MODEL AGAINST THE MACHINERY (D18 — name the incumbent)

| Owner's page / capability | Incumbent(s) | Fit | Gap |
|---|---|---|---|
| **Horses** page | Records › Horses tab (staff) · `/app/horses/:id` (record) · My Stable › Horses (member) | Two staff surfaces + one member surface already; AR3 already flagged the third roster | A fourth "Horses" page would repeat TASK-RECORDS' finding; the question is which of the existing doors is *the* one, not whether to build |
| **Gear** page | `resources` (equipment, non-consumable, lots w/ cost, org-scoped, staff) **or** `stable_items` gear (member/org, no qty/cost) | barnops carries cost + vendor + on-hand; My Stable carries nothing but a name | Neither links gear to a horse |
| **Supplies** page with on-hand | `resources` feed/med/bedding/supply + `resource_lots.on_hand` | Exactly the owner's "amount on hand" — **but nothing depletes it** | Depletion (event → on_hand) is unbuilt; `horse_medications` SUPPLEMENT is a parallel list on the horse |
| **Business** page (boarding, tackroom, signage, insurance, décor, furniture) | none. Nearest: `resources` equipment; `stable_items` owner_kind=org | Nothing models FHE-as-tenant-of-the-ranch | ⚠️ `mod.boarding` models the **inverse**: FHE as the boarding *provider* (facilities & stalls, board agreements, board charges to clients). The owner's "boarding" here is a cost FHE *pays*. Insurance already has its own control-set spec (2026-08-06) |
| **Assign gear → horse(s)** | none | — | Needs a horse↔item link; `consumption_events.horse_id` is per-event, not an assignment |
| **On the horse record, pick feed & bedding from Supplies and enter monthly usage** | `consumption_events` (resource, horse, qty, occurred_at) is the right *fact* shape | The Consumption log page captures it — from the log, not from the horse record; per event, not per month | Needs (a) a horse↔resource selection, (b) a monthly-quantity input on the record, (c) a per-horse aggregate read, (d) depletion |
| **Aggregate per horse → depletion on the Supplies page** | resolver aggregates per *payer* for billing only | wrong axis (money), wrong reader (billing) | A usage aggregate (horse × resource × month) and on-hand minus usage — both unbuilt |
| **Cost attribution / billing clients** | `cost_allocation_rules` + resolver + `billable_lines` | Complete design, zero use, red tests, no default payer | **The owner did not ask for this.** Whether it stays in scope is a ruling, not a finding |

**What "already exists" honestly means:** the catalog, the purchase lot with on-hand, the append-only
usage fact with an optional horse, and a staff CRUD page for each. **What does not exist at all:**
assignment (either direction), monthly-rate input, per-horse usage reads, depletion, and any
"business" bucket. The routing note's *"consumption/attribution machinery ALREADY EXISTS"* is true of
the schema and false of the behaviour the owner described.

---

## 5. ASK-OWNER — what research could NOT answer (for step 3, most-blocking first)

1. **One tenancy or two?** My Stable is *member-scoped* (a boarder's own saddle, their own supplement)
   with an org toggle bolted on; barnops is *business-scoped* staff inventory. The owner's paragraph is
   about the **business's** tackroom. Is client-owned gear (a boarder's tack in FHE's tackroom) in
   scope for the same pages, or is this staff inventory only?
2. **Money in or out?** Lots carry unit cost; the resolver bills clients. The request says logging,
   tracking, visibility, depletion — no billing. Keep cost per lot (for reorder/valuation)? Keep
   allocation/billing at all, or retire it behind a flag (D32)?
3. **Usage granularity:** "input how much they use every month" — is that (a) a **standing monthly
   rate** per horse per supply that auto-depletes each month, or (b) a **figure entered each month**
   (one consumption event per horse per resource per month), or (c) the existing per-event log? (a)
   is new machinery; (b) is one event a month into the existing table; (c) already exists.
4. **Horses page = which incumbent?** Records › Horses (staff), or a new page? TASK-RECORDS and AR3
   both ruled against more rosters.
5. **The "Business" bucket vs `mod.boarding`'s inversion.** Is FHE ever a boarding *provider* (does
   `mod.boarding` stay), or only a boarder? This decides whether "Business" is a new page or a
   re-pointing of an existing module.
6. **The module's name and bucket** (held from CR-108). The owner's own words: *Stable and Tackroom
   management.* Candidates the record already uses: "Stable", "Tackroom". Does "Barn Ops" become one
   surface named for the tackroom, or split into the four pages?
7. **`horse_medications` SUPPLEMENT:** fold into Supplies (a resource assigned to the horse with a
   rate), or leave on the record as clinical data alongside MEDICATION?
8. **Vendors:** three notions exist (§2b). Converge on `contacts` vendor type (Records › Vendors) and
   retire the `vendors` table, or keep the member-facing shared directory?

**Already answered by research — do not re-ask:** whether barnops is enabled (yes, all six modules
since 2026-08-12); whether there is data to migrate (no — 0 rows everywhere but 3 medication rows);
whether the pages work when reached (they render; the resolver would fail on first use for lack of a
default payer); whether page visibility hides them (it is wired to nothing).

---

## 6. VALIDATION CRITERIA — proposed, to be agreed with the owner in step 3

- From the staff rail, the four surfaces (or the one surface with four tabs) are reachable in ≤2 clicks,
  and THE TELL names the row (D17 / reachability-is-part-of-done).
- A supply with a purchased quantity shows an on-hand figure that **goes down** when usage is recorded
  against a horse, and a per-horse view shows what that horse used in the month.
- A gear item can be assigned to one or more horses and appears on each horse's record.
- The three medication rows survive (D32) whatever Supplies becomes.
- No new roster of horses (AR3 / RECORDS).
- The module gate and org boundary still hold on every table touched (the existing tests, un-staled).

---

## 7. WHERE THE RECORD WAS WRONG (corrections to carry)
- **CR-109 routing note** (ORCH, 2026-09-02): *"consumption/attribution machinery ALREADY EXISTS"* —
  schema and pages exist; depletion, assignment and per-horse reads do not; tables are empty; tests red.
- **TASK-DUPECENSUS-REPORT** (§"dark module pages"): says `mod.barnops` is disabled for FHE — stale
  since 2026-08-12 (FIX3 already corrected `reviewSection.ts`; the report was not).
- **`DB-MAP.md` resolver row** lists `src/lib/api.ts` as a caller — it is a dead duplicate; nothing
  calls it.
- **`SURFACE-INVENTORY.md`** row for `/app/ops/barnops`: "NAV: MODULES_GROUP, AppLayout.tsx:558" —
  true when written, false since FIX3 removed the group from the rail.

---

## 8. FILES A DSNR-PROFILE TASK WILL NEED
`src/pages/app/ops/barnops/*.tsx`, `src/pages/app/ops/hubs/BarnopsHubPage.tsx`,
`src/lib/ops/api-barnops.ts`, `src/lib/api.ts` (dead copy), `src/lib/stable.ts`,
`src/components/app/StableSection.tsx`, `src/components/app/StableEditors.tsx`,
`src/pages/app/Stable.tsx`, `src/pages/app/AccountHub.tsx` (the Barn Ops + My Stable rows),
`src/components/app/AppLayout.tsx` (`MODULES_GROUP`, `CARD_PAGE_ONLY`, `useNavPresence`),
`src/lib/pageRegistry.ts` (barnops keys), `src/pages/app/HorsePage.tsx` + `HorseIntakeForm.tsx`
(medications/supplements), `src/pages/app/ops/HorseRecordsPage.tsx`,
`supabase/migrations-archive/20260630100000_mod_barnops.sql` (schema of record),
`supabase/migrations/20260815T2100_stable_business_aware.sql` (`owner_kind`),
`test/db/mod_barnops.test.ts`, `test/db/e2e_consumption.test.ts`.
