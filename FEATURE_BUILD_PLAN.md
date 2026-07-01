# FHE Suite — Feature & UI Build Plan (Canonical Manifest)

Status: **Canonical build manifest for the COMPLETE feature/UI layer.** Merges the two
lens enumerations (STAFF/OPS/ADMIN and CLIENT-PORTAL/PUBLIC/E2E) into ONE
de-duplicated build plan for the whole platform. The backbone (schema, RPCs, RLS) is
built and tested; this plan builds every operational + client + public UI slice and
wires each to a real, RLS-enforced, tested data path.

Owner mandate: ALL OF IT — every module's operational UI + every website flow
connected, FHE tenant fully usable, no deferrals.

Governing contract: **PLATFORM_ARCHITECTURE.md §15 Wiring & Verification Contract** is
the definition-of-done for every unit. Repeated verbatim as the acceptance bar:
1. REAL-PATH DATA TEST (schema/api units): the actual RPC/data path, correct role, right table/columns.
2. UI-INTERACTION TEST (every frontend slice): jsdom harness (`// @vitest-environment jsdom`;
   `src/test/render.tsx` → `renderWithRouter`/`screen`/`userEvent`; pattern `src/test/harness.smoke.test.tsx`).
   Render the real component, fire the real click/submit, assert the real handler calls the
   real data fn WITH CORRECT ARGS, and that **success AND error** branches render.
3. STATIC DEAD-END AUDIT: no empty `onClick`, no `onSubmit`-less form, no `console.log`-only
   handler, no exported-but-unimported api fn, no defined-but-uncalled RPC, no swallowed error.
4. INDEPENDENT SKEPTIC: a non-builder confirms via the executable trace.
5. CRITICAL CHAINS get a full end-to-end test.

---

## 0. Ground-truth reconciliation (verified against the repo, branch `feat/platform-backbone`)

The manifest was reconciled against the actual code so units reference real symbols:

- **`src/lib/api.ts` ALREADY exports** `myModules()`, `orgPublicConfig(slug)`,
  `configValue(ns,key)`, `provisionTenant(input)` (lines 307–369). The api-integration units
  **must NOT re-author these** — they append the CRM / module / admin / portal wrappers only.
- **`AuthContext.tsx` ALREADY loads a `modules` state** via `myModules()` in `loadProfile`
  (fail-closed to `[]` on error), and projects `role`/`org_id` off the profile row
  (`ProfileRow`). It exposes `isAdmin`/`isMember` today but does **NOT** yet expose
  `modules`/`role`/`orgId`/`isSuperAdmin` on the context value. The AuthContext bridge unit is
  therefore a **small** edit: surface the already-loaded state on the value object + add the
  `useModules`/`useEntitlements` hooks.
- **No shadcn.** The component kit builds on the existing Tailwind utilities in `src/index.css`
  (`.btn-primary`, `.form-input`, `.form-input-error`, `.form-label`, `.form-error`).
- **`src/test/render.tsx` does NOT export `AuthContext`** — portal/gated tests `vi.mock('../contexts/AuthContext', …)` (mock `useAuth`/`useModules`) or mock the supabase client.
- **`form_definitions`** exists (migration `20260629120000`), columns `form_key`, `audience CHECK (audience IN ('CLIENT','COMPANY'))`, `schema jsonb` (`{ sections:[{ heading, fields:[…] }] }`), `active`. **`COMPANY`** (not the enumeration's loose "CLIENT/COMPANY") is the staff/company-audience value; portal client forms filter `audience='CLIENT'`.
- **`record_signature`** lives in `20260629160000_purchase_flow_rpcs.sql` — `(p_document_id, p_party_role, p_typed_name, p_ip DEFAULT NULL)`.

### Confirmed backbone RPC signatures (all callable, all tested)

| RPC | Signature | Migration |
|-----|-----------|-----------|
| `generate_document` | `(p_engagement_id uuid, p_template_key text)` | `20260630000000` |
| `record_signature` | `(p_document_id uuid, p_party_role text, p_typed_name text, p_ip text=NULL)` | `20260629160000` |
| `create_purchase_engagement` | `(p_buyer_contact_id, p_horse_id=NULL, p_seller_contact_id=NULL, p_amount=NULL, p_deposit=NULL)` | `20260630060000` |
| `create_search_engagement` | `(p_client_contact_id, p_retained_by='buyer', p_deal_side='BUY', p_horse_id=NULL)` | `20260630060000` |
| `create_lease_engagement` | `(p_client_contact_id, p_deal_side='LEASE_IN', p_horse_id=NULL, p_counterparty_contact_id=NULL)` | `20260630060000` |
| `resolve_consumption_billing` | `(p_period tstzrange) → int` | `20260630100000` |
| `settle_billable_lines` | `(p_payer_contact_id uuid, p_period tstzrange=NULL) → TABLE(transaction_id, amount, lines_settled)` | `20260630140000` |
| `set_org_module` | `(p_org uuid, p_key text, p_enabled bool=true, p_source text='ADDON')` | `20260630050000` |
| `provision_tenant` | `(p_name, p_slug, p_tier_key, p_admin_email, p_admin_user_id=NULL, p_brand, p_legal, p_rates, p_modules=NULL) → uuid` | `20260630050000` |
| `my_modules` | `() → TABLE(module_key text)` | `20260630150000` |
| `org_public_config` | `(p_slug text)` | `20260630020000` |
| `config_value` | `(p_ns text, p_key text)` | `20260630020000` |
| `has_module` / `require_module` | `(p_key text)` | `20260630010000` |

---

## 1. Merge & de-duplication decisions (how the two lenses became one plan)

| Concern | Two-lens state | Resolution |
|---------|----------------|------------|
| **KIT root** | Staff `K1` (component kit) + portal `KIT-ROOT`/`CP-KITDEP-0` both anchor | **ONE root `KIT` (surface `kit`)** — the component kit + interaction primitives (Form/Field, DataTable, Modal, Money, StatusBadge, ModuleGate, EmptyState, AsyncButton, useAsync, useToast). `ModuleGate` takes an injected module map (prop, default from `useModules`) so it is testable with no data dep. **Every UI slice depends on `KIT`.** Portal's fixture/barrel need becomes `KIT-PORTAL` (thin, re-exports KIT + ships portal fixtures), depends on `KIT`+`INT-AUTH`. |
| **Data hooks** | Both lenses list `useModules`/`useEngagement`/`useDocuments`/etc. | Hooks that read the tenant module set (`useModules`/`useEntitlements`) live in **`INT-AUTH`** (they read AuthContext). Table/RPC data hooks are thin wrappers over the api layer; each feature slice imports the relevant api fn directly (real-path). No separate "hooks" unit is needed beyond `useModules`/`useEntitlements`. |
| **`src/lib/api.ts` authors** | Staff `I1`+`I1b`; portal `CP-INT-API-1` — three concurrent authors of one shared file | **Serial chain on api.ts:** `INT-API-CORE` (CRM/contracts/billing wrappers) → `INT-API-MODULES` (brokerage/lessons/boarding/barnops/records/employees/admin) → `INT-API-PORTAL` (portal/public read wrappers + intake). Each `dependsOn` the prior, honoring dependsOn as the only collision guard (§12). |
| **`App.tsx` / `AppLayout` authors** | Staff `I3`(routes)+`I4`(nav); portal `CP-INT-APP-1` (both) | **`INT-ROUTES`** (App.tsx — every ops + portal + public route) then **`INT-NAV`** (AppLayout — ops + portal + admin/superadmin nav, module/role gated). Serial, each `dependsOn` all page slices. |
| **AuthContext bridge** | Staff `I2`; portal assumes it exists | **ONE `INT-AUTH`** — expose already-loaded `modules`/`role`/`orgId`/`isSuperAdmin`; add `useModules`/`useEntitlements`. |
| **Provision edge fn** | Staff `I5`; portal `CP-API-EMAIL`/`CP-API-DELIVERY` are separate | Kept distinct: **`INT-API-PROVISION`** (`/api/admin-provision-tenant`), **`API-EMAIL`** (`/api/send-transactional-email`), **`API-DELIVERY`** (`/api/deliver-document`), **`INT-APIROUTES`** (vercel.json/package.json wiring). |
| **Document sign/deliver** | Staff `OPS-DOC-SIGN`/`OPS-DOC-DELIVER` (staff-facilitated) vs portal `CP-PORTAL-DOC-2` (client self-sign) | **Both kept** — distinct surfaces, distinct files, both wired to the same `record_signature` / `document_deliveries` real path. No file overlap. |
| **Intake** | Staff `OPS-INTAKE` (review inbox) vs portal `CP-INTAKE-*` (public/client submission via `form_definitions`) | **Both kept** — opposite ends of the same pipeline (submit vs review→convert). Distinct files. |
| **Balance / transactions** | Staff `OPS-TXN` (reconcile view) vs portal `CP-PORTAL-BAL-1` (client balance) | **Both kept** — staff-scoped vs client-scoped reads, distinct files. |
| **Settle modal** | Staff `OPS-SETTLE` reused by boarding/lessons/barnops | **ONE `OPS-SETTLE`** shared component; charge slices depend on it. |

**Distinct-file invariant:** every non-integration unit owns DISTINCT new files. Staff ops
lives under `src/pages/app/ops/**` + `src/components/ops/**`; portal lives under
`src/pages/app/*` + `src/portal/**`; public lives under `src/portal/public/**` +
`src/pages/*`. No two non-integration units share a file (audited in §4). Every shared-file
edit (`src/lib/api.ts`, `src/App.tsx`, `src/components/app/AppLayout.tsx`,
`src/contexts/AuthContext.tsx`, `vercel.json`, `package.json`) is an `integration` unit,
serialized by `dependsOn`.

---

## 2. The reusable KIT (root — everything depends on it)

`KIT` is built ONCE and is the root dependency of every UI slice. It is pure
presentational + interaction primitives on the existing Tailwind, plus the state machines
every form uses. `ModuleGate` takes a `moduleKey` + an injected `modules` map (prop,
default `useModules()`), rendering children or a locked fallback — Layer C gating (§4.3),
proven real (not decorative) by its test. No component in `KIT` performs a data call, so it
is dependency-free and can be verified in isolation.

Files: `src/components/ops/kit/{FormField,DataTable,Modal,Money,StatusBadge,ModuleGate,EmptyState,AsyncButton}.tsx`,
`src/lib/ops/{useAsync,useToast,index}.ts`, test `src/components/ops/kit/kit.test.tsx`.

---

## 3. Wave order (build sequence)

Waves run top-to-bottom; units **within** a wave run in parallel (they own distinct files).
Integration units are serial within their sub-chains as noted.

1. **`kit`** — `KIT` (root; blocks everything).
2. **`integration-api-core`** — `INT-API-CORE` (core CRM/contracts/billing api wrappers). Serial head of the api.ts chain.
3. **`integration-auth`** — `INT-AUTH` (AuthContext bridge + `useModules`/`useEntitlements`). Depends on `INT-API-CORE` (imports `myModules`). Serial.
4. **`integration-api-modules`** — `INT-API-MODULES` (module + admin api wrappers). Serial, after `INT-API-CORE`.
5. **`kit-portal`** — `KIT-PORTAL` (portal barrel + fixtures). Depends on `KIT`+`INT-AUTH`.
6. **`ui-core-slices`** (parallel) — all core staff ops slices + portal core slices that depend only on `KIT`/`INT-AUTH`/`INT-API-CORE`/`KIT-PORTAL`: `OPS-DASH`, `OPS-CONTACTS`, `OPS-HORSES`, `OPS-ENG-LIST`, `OPS-DOC-GEN`, `OPS-DOC-VIEW`, `OPS-DOC-SIGN`, `OPS-DOC-DELIVER`, `OPS-DOCS-QUEUE`, `OPS-TXN`, `OPS-SETTLE`, `CP-INTAKE-1`, `CP-PORTAL-DOC-1`, `CP-PORTAL-BAL-1`.
7. **`ui-module-slices`** (parallel) — everything gated on `INT-API-MODULES`: brokerage (`OPS-ENG-CREATE`, `OPS-ENG-STAGES`, `OPS-INTAKE`, `CP-PORTAL-ENG-1`), boarding, barnops, lessons, records, employees, admin, superadmin-wizard, and the portal module surfaces (`CP-PORTAL-HORSE-1`, `CP-PORTAL-BOARD-1`, `CP-PORTAL-LESSON-1`) + `CP-INTAKE-2`/`CP-INTAKE-3` + dependent detail pages (`CP-PORTAL-ENG-2`, `CP-PORTAL-DOC-2`).
8. **`backend-units`** (parallel) — `API-EMAIL`, `API-DELIVERY`, `INT-API-PROVISION` (`/api` functions; `API-DELIVERY` depends on `API-EMAIL`).
9. **`integration-api-portal`** — `INT-API-PORTAL` (portal/public read wrappers). Serial, after `INT-API-MODULES` + all portal UI slices.
10. **`integration-routes`** — `INT-ROUTES` (App.tsx). Serial, after every page slice + `INT-API-PORTAL`.
11. **`integration-nav`** — `INT-NAV` (AppLayout). Serial, after `INT-ROUTES`.
12. **`integration-apiroutes`** — `INT-APIROUTES` (vercel.json/package.json). Serial, after `API-EMAIL`/`API-DELIVERY`/`INT-API-PROVISION`.
13. **`e2e`** (parallel) — the four critical-chain end-to-end units: `E2E-PROVISION`, `E2E-CONTRACT`, `E2E-CONSUMPTION`, `E2E-PAYMENT`.

waveOrder: `kit` → `integration-api-core` → `integration-auth` → `integration-api-modules`
→ `kit-portal` → `ui-core-slices` → `ui-module-slices` → `backend-units` →
`integration-api-portal` → `integration-routes` → `integration-nav` →
`integration-apiroutes` → `e2e`.

---

## 4. Unit manifest

Every unit below carries: distinct new files (non-integration), a jsdom UI-interaction
test (frontend) or real-path data test (backend/integration), `dependsOn` referencing the
KIT + relevant backbone, and a static dead-end audit. See the machine-readable manifest
returned alongside this document for the exact `dependsOn`/files/tests per unit; the tables
here are the human-readable index.

### 4.1 Root + integration spine

| id | title | surface | key files | dependsOn |
|----|-------|---------|-----------|-----------|
| `KIT` | Reusable component kit + interaction primitives | kit | `src/components/ops/kit/*`, `src/lib/ops/{useAsync,useToast,index}` | — |
| `INT-API-CORE` | api.ts: core CRM/contracts/billing wrappers | integration | `src/lib/api.ts`, `src/lib/ops/types.ts`, `src/lib/api.ops-core.test.ts` | `KIT` |
| `INT-AUTH` | AuthContext bridge + `useModules`/`useEntitlements` | integration | `src/contexts/AuthContext.tsx`, `src/lib/ops/useModules.ts`, `…useModules.test.tsx` | `INT-API-CORE` |
| `INT-API-MODULES` | api.ts: module + admin wrappers | integration | `src/lib/api.ts`, `src/lib/api.ops-modules.test.ts` | `INT-API-CORE` |
| `KIT-PORTAL` | Portal barrel + fixtures | kit | `src/portal/kit-contract.ts`, `src/portal/__fixtures__/portalFixtures.ts`, `…kit-contract.test.tsx` | `KIT`, `INT-AUTH` |
| `INT-API-PORTAL` | api.ts: portal/public read wrappers + intake | integration | `src/lib/api.ts`, `src/lib/api.portal.test.ts` | `INT-API-MODULES` + all portal UI slices |
| `INT-ROUTES` | App.tsx: all ops + portal + public routes + route guard | integration | `src/App.tsx`, `src/components/ops/OpsRouteGuard.tsx`, `src/App.routes.test.tsx` | `INT-AUTH`, `INT-API-PORTAL`, every page slice |
| `INT-NAV` | AppLayout: ops/admin/superadmin/portal nav (module+role gated) | integration | `src/components/app/AppLayout.tsx`, `src/components/ops/OpsNav.tsx`, `…ops-nav.test.tsx` | `INT-AUTH`, `INT-ROUTES` |
| `INT-APIROUTES` | vercel.json/package.json: register `/api` email+delivery+provision routes | integration | `vercel.json`, `package.json`, `api/routes.test.ts` | `API-EMAIL`, `API-DELIVERY`, `INT-API-PROVISION` |

### 4.2 Staff ops — core (surface `ops`/`flow`/`admin`)

| id | title | module | dependsOn (beyond KIT) |
|----|-------|--------|------------------------|
| `OPS-DASH` | Ops home dashboard (entitlement-aware KPI tiles + module launcher) | core | `INT-API-CORE`, `INT-AUTH` |
| `OPS-CONTACTS` | CRM contacts directory + create/edit drawer | core | `INT-API-CORE` |
| `OPS-HORSES` | Horses roster + create/edit (breed/color lookups) | core | `INT-API-CORE` |
| `OPS-ENG-LIST` | Engagements list + detail (parties/horse/txn/stages/docs rollup) | core | `INT-API-CORE` |
| `OPS-DOC-GEN` | Generate-document modal (template picker → `generate_document`) | core | `INT-API-CORE` |
| `OPS-DOC-VIEW` | Merged-contract viewer (read-only body/status/parties/signatures) | core | `INT-API-CORE` |
| `OPS-DOC-SIGN` | Multi-party staff-facilitated signing panel (`record_signature` → EXECUTED) | core | `INT-API-CORE` |
| `OPS-DOC-DELIVER` | Delivery panel (record delivery on EXECUTED) | core | `INT-API-CORE` |
| `OPS-DOCS-QUEUE` | Documents work-queue (all in-tenant docs by status) | core | `INT-API-CORE` |
| `OPS-TXN` | Transactions/invoices list + detail (deal + INVOICE settlement rows) | core | `INT-API-CORE` |
| `OPS-SETTLE` | Shared settlement modal (`billable_lines` → INVOICE via `settle_billable_lines`) | core | `INT-API-CORE` |

### 4.3 Staff ops — modules (gated)

| id | title | module | dependsOn (beyond KIT) |
|----|-------|--------|------------------------|
| `OPS-ENG-CREATE` | Create-engagement wizard (purchase/search/lease) | mod.brokerage | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-ENG-STAGES` | Engagement stages panel (add SEARCH/EVALUATION/TRANSACTION_REP) | mod.brokerage | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-INTAKE` | Intake-review inbox (public submissions → convert to engagement) | core | `INT-API-CORE`, `INT-API-MODULES`, `INT-AUTH` |
| `OPS-BOARD-FACIL` | Boarding: facilities + stalls management | mod.boarding | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-BOARD-AGREE` | Boarding: board agreements (horse↔stall↔boarder, registry rate) | mod.boarding | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-BOARD-CHARGE` | Boarding: period charges → `billable_lines` + settle | mod.boarding | `INT-API-MODULES`, `OPS-SETTLE` |
| `OPS-INV-RES` | Inventory: resources catalog + purchase lots | mod.barnops | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-INV-LOG` | Inventory: consumption logging (append-only event) | mod.barnops | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-INV-ALLOC` | Inventory: cost-allocation split + override rules + `resolve_consumption_billing` | mod.barnops | `INT-API-MODULES`, `INT-AUTH`, `OPS-SETTLE` |
| `OPS-LESSONS-PKG` | Lessons: packages + client credit balances | mod.lessons | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-LESSONS-BOOK` | Lessons: booking scheduler (consume credit, optional instructor) | mod.lessons | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-HORSE-PARTIES` | Records: ownership/rights ledger (owner/lessee/trainer shares) | mod.horserecords | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-HORSE-HEALTH` | Records: health events log (vet/farrier/vaccination/coggins) | mod.horserecords | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-EMP-STAFF` | Employees: staff roster (profile → staff_profile) | mod.employees | `INT-API-MODULES`, `INT-AUTH` |
| `OPS-EMP-SCHED` | Employees: shifts, time entries & service assignments | mod.employees | `INT-API-MODULES`, `INT-AUTH` |

### 4.4 Tenant admin + super-admin (surface `admin`)

| id | title | module | dependsOn (beyond KIT) |
|----|-------|--------|------------------------|
| `ADMIN-MODULES` | Module & entitlement toggles (`set_org_module`) | core | `INT-API-MODULES`, `INT-AUTH` |
| `ADMIN-REGISTRY` | Value-registry editor (business_config typed + config_values EAV + completeness) | core | `INT-API-MODULES` |
| `ADMIN-BRANDING` | Branding editor (BRAND.*/CONTACT.* + logo upload to brand-assets) | core | `INT-API-MODULES` |
| `ADMIN-PRODUCTS` | Products & pricing catalog (products + effective-dated product_prices) | core | `INT-API-MODULES` |
| `SUPERADMIN-PROVISION` | Provision-a-tenant wizard (→ `/api/admin-provision-tenant` → `provision_tenant`) | core | `INT-API-MODULES`, `INT-AUTH`, `INT-API-PROVISION` |

### 4.5 Client portal (surface `portal`/`flow`) + public (surface `public`)

| id | title | module | dependsOn (beyond KIT/KIT-PORTAL) |
|----|-------|--------|-----------------------------------|
| `CP-INTAKE-1` | 27-form intake schema renderer (`FormRenderer`, no submit) | core | `KIT-PORTAL` |
| `CP-INTAKE-2` | Public intake submission (anon, slug→org) | core | `CP-INTAKE-1` |
| `CP-INTAKE-3` | Authenticated client intake submission (CLIENT-audience forms) | core | `CP-INTAKE-1` |
| `CP-PORTAL-ENG-1` | My Engagements list | mod.brokerage | `KIT-PORTAL`, `INT-AUTH` |
| `CP-PORTAL-ENG-2` | Engagement detail (stages/documents/transactions) | mod.brokerage | `CP-PORTAL-ENG-1`, `CP-PORTAL-DOC-1` |
| `CP-PORTAL-DOC-1` | My Documents list (new documents layer) | core | `KIT-PORTAL` |
| `CP-PORTAL-DOC-2` | Contract view + typed-name e-sign (→ EXECUTED) | core | `CP-PORTAL-DOC-1` |
| `CP-PORTAL-BAL-1` | Outstanding balance + invoice history | core | `KIT-PORTAL` |
| `CP-PORTAL-HORSE-1` | My Horses + ownership/rights + health log | mod.horserecords | `KIT-PORTAL` |
| `CP-PORTAL-BOARD-1` | My Board agreements + charge history | mod.boarding | `CP-PORTAL-BAL-1` |
| `CP-PORTAL-LESSON-1` | My Lesson credits + bookings | mod.lessons | `KIT-PORTAL` |
| `CP-PUBLIC-BRAND-1` | Per-tenant public branding consumer (slug→brand) | core.branding | `KIT-PORTAL` |
| `CP-PUBLIC-CATALOG-1` | Per-tenant public product/service pages (registry/products, anon) | core.payments | `CP-PUBLIC-BRAND-1` |
| `CP-PUBLIC-PAYCONF-1` | Payment → confirmation on the billing/transactions layer | core.payments | `CP-PORTAL-BAL-1` |

### 4.6 Backend `/api` units + end-to-end chains

| id | title | surface | dependsOn |
|----|-------|---------|-----------|
| `API-EMAIL` | `/api/send-transactional-email` (tenant-branded footer via config_value) | integration | `KIT` |
| `API-DELIVERY` | `/api/deliver-document` (EXECUTED → document_deliveries + email) | integration | `API-EMAIL` |
| `INT-API-PROVISION` | `/api/admin-provision-tenant` (find-or-create ADMIN → `provision_tenant`) | integration | `INT-API-MODULES` |
| `E2E-PROVISION` | Chain 1: provision → login → gated nav + branded public site | flow | `INT-NAV`, `INT-API-PROVISION` |
| `E2E-CONTRACT` | Chain 2: intake → engagement → generate → sign → EXECUTED → deliver → email | flow | `CP-INTAKE-2`, `CP-PORTAL-DOC-2`, `API-DELIVERY`, `INT-API-PORTAL` |
| `E2E-PAYMENT` | Chain 3: payment → mark-paid → confirm (existing Stripe/Zelle path stays green) | flow | `CP-PUBLIC-PAYCONF-1`, `INT-API-PORTAL` |
| `E2E-CONSUMPTION` | Chain 4: consumption → cost-allocation → billable_line → invoice on portal | mod.barnops | `CP-PORTAL-BAL-1`, `OPS-INV-ALLOC`, `INT-API-PORTAL` |

---

## 5. Per-unit test discipline (how each unit discharges §15)

- **`kit` / UI slices:** jsdom UI-interaction test — render the real component, fire the
  real click/submit, assert the real data fn is called with EXACT args, assert **success AND
  error** branches render, and (for gated slices) assert ModuleGate hides/locks when the
  module is off. Static dead-end audit: every interactive prop invoked in a test; no empty
  handler; no `onSubmit`-less form.
- **`integration` (api.ts) units:** mocked-supabase test asserting the wrapper invokes the
  exact `rpc(name, {p_args})` or `.from(table).select/insert/update` with correct columns,
  returns/throws correctly; static audit that every exported wrapper is imported by ≥1 slice
  and no RPC name is a typo (checked against the migration RPC list).
- **`integration` (App.tsx/AppLayout/AuthContext) units:** jsdom test — mock `useModules`/role,
  render the router/nav at representative routes, assert the right page mounts and gated
  routes/nav items lock/redirect/absent when the module or role is missing; static audit that
  every nav item targets a mounted route and no route points at a missing component.
- **`integration` (`/api`) units:** node-env real-path test with mocked provider +
  `supabaseAdmin` asserting the exact RPC/table calls, idempotency, and auth rejection.
- **`flow` (critical-chain) units:** a node PGlite real-path portion proving the data chain
  lands tenant-correct + a jsdom portion proving the UI drives the real RPC and renders the
  outcome. Independent-skeptic re-runnable.

**Green gate (every unit):** the existing 168 tests (165 DB + 3 UI-harness) + all migrations
stay green; `typecheck` (app + api), `lint`, `build`/prerender stay green. Everything additive.

---

## 6. FHE launch usability (what "fully usable" means for tenant #1)

FHE = `tier.lesson_brokerage` → `{mod.lessons, mod.brokerage, mod.horserecords}` ON;
`{mod.boarding, mod.barnops, mod.employees}` OFF-but-shippable. After this plan ships, an
FHE operator can, end to end: provision/verify the tenant, manage contacts + horses, run the
full brokerage engagement → generate → sign → EXECUTED → deliver chain, review + convert
public intake, manage lesson packages/credits/bookings, maintain the horse ownership ledger +
health log, edit the value registry + branding + products, and toggle modules — while the
FHE client sees My Engagements / Documents (+ self-sign) / Balance / Horses / Lessons in a
correctly gated portal, and the public site renders FHE branding + catalog from the registry.
Boarding/barnops/employees UI is built and gated OFF, ready to light up for a boarding tenant.
