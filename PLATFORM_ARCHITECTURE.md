# FHE Suite — Platform Architecture (Canonical)

Status: **Canonical. Single source of truth every downstream builder obeys.**
Owner: Lead Architect. Supersedes the three lens proposals; conflicts resolved here.
Scope: the multi-tenant equestrian-business SaaS platform backbone, built **ADDITIVELY** on the existing green codebase (`fhe-website-app`, branch `dev`).

> **Prime directive.** Nothing here rewrites existing schema, tests, or code. The 26 existing migrations (ending `20260629190000_org_scope_data.sql`) and the 165 passing tests stay untouched and green. Every change is a **new** migration numbered after `20260629190000`, a **new** test file, or a **new** src/ file — plus a small number of clearly-scoped `integration` edits to shared files (App.tsx, nav, `src/lib/api.ts`, `package.json`) that run **serially, last**.

---

## 0. How to read this document

1. §1 Principles (the owner mandate, baked in).
2. §2 The three stacking seams (tenancy / entitlement / access) — the discipline every table obeys.
3. §3 Module catalog (core + modules, tiers, FHE-enabled flags).
4. §4 Entitlement model (`org_modules` + `has_module()` + 3-layer enforcement).
5. §5 Global Value Registry (define-once value table(s) + resolution seam).
6. §6 The `generate_document` isolation fix + `{{ORG.*}}` de-specification (highest-priority correctness fix).
7. §7 Domain data models (contracts, products/services, branding, financials/legal, boarding, horse ownership, inventory cost-attribution ledger, horse health, employees).
8. §8 Tenant-isolation RLS pattern extended to every new table (the exact recipe).
9. §9 Push-button `provision_tenant()`.
10. §10 Additive-migration numbering plan.
11. §11 Testing contract (how every new table proves isolation + entitlement).
12. §12 Frontend seam (BrandProvider / useModules / AuthContext bridge).
13. §13 Risks & mitigations (carry-forward).
14. §14 Conflict resolutions (how the three proposals were merged).
15. **§15 Wiring & Verification Contract** — the owner's #1 requirement; "done" is earned with an executable proof. The definition-of-done every unit's `tests` field conforms to.

---

## 1. Principles (non-negotiable, baked into the architecture)

1. **MODULAR.** A universal **CORE** (identity, tenancy, roles, branded public site + member app, contracts/documents/e-sign, payments, audit, the value registry, and the entitlement machinery) plus feature **MODULES** (Brokerage & Contracts, Lessons & Membership, Boarding & Facility, Barn Ops & Inventory, Horse Records/Health, Employees & Scheduling). Sold as strata-mapped **TIERS** with a-la-carte add-ons. **Entitlements are DATA** (`org_modules` + `has_module(key)`), enforced in **3 layers** (RLS guard, RPC guard, UI nav gating). Adding a module later = additive migration + a flag, **never a refactor**.
2. **GLOBAL-VALUE-CHANGES-RULE-THE-DAY.** Every business-critical value (prices, commission/lease/board rates, deposits, tax, legal entity name/agent/signatory, cancellation/late/no-show fees, retention, brand name/colors/logo/copy, contact info) is defined **exactly once per tenant** in a config/value registry and referenced everywhere. No hardcoding, no duplication. One write propagates to contracts, products, pages, receipts, and emails **simultaneously**.
3. **FOCAL POINTS.** Contracts, products, services, branding, and the variables that drive business financials and legal protections are **first-class, config-driven, and modular**.
4. **PUSH-BUTTON PER-TENANT PROVISIONING.** A `provision_tenant(...)` path creates an org, seeds its config/value registry + branding + enabled modules + first ADMIN, and yields a working branded site + app. Personalization = config, not code. Assisted onboarding first; self-serve as a maturity goal.
5. **TENANT ISOLATION IS SACRED.** Extend the existing `org_id` + RESTRICTIVE RLS + `current_org()` pattern to **every** new table **and to every pre-existing business table that migration 26 did not reach** (the platform catalog + community/gifts set — see §8.5 for the exact enumerated list, grep-derived, not a vague "and the community tables"). RESTRICTIVE boundaries stack (`AND`) so a permissive access bug can only narrow, never breach. The boundary is declared **`TO anon, authenticated`** on any table `anon` touches (public catalog/intake), with anon scoping via slug→org, because a `TO authenticated`-only boundary leaves `anon` completely unconstrained (§8.5–§8.6). The entitlement/registry substrate (`org_modules`, `config_values`, `business_config`, `modules`/`tiers`/`tier_modules`) carries the boundary but **never a `module_gate`**, and its resolvers are `SECURITY DEFINER`, so gate evaluation never recurses (§2, §4.3). Cross-tenant leakage — including an unscoped table or an anon-visible cross-tenant catalog — is a launch-blocking defect.
6. **FULL DOMAIN FROM DAY ONE.** The platform ships the whole modular domain; FHE (a lesson/brokerage barn) uses a subset.
7. **DONE IS EARNED WITH AN EXECUTABLE PROOF (Wiring & Verification Contract).** No unit is "done" on assertion. Every build unit ships a real-path data test (the actual RPC/data path, as the correct RLS role, landing in the right table), a UI-interaction test for any frontend unit (real component, real click/submit, correct handler args, success **and** error branches), a static dead-end audit (no dead buttons, no-op forms, defined-but-never-called RPCs), and — for critical chains — a full end-to-end test. A skeptic who did not build the unit confirms via the trace. This is the owner's #1 requirement and is specified verbatim in the new top-level **§15 Wiring & Verification Contract**; every unit's `tests` field is written to conform to it.

---

## 2. The three stacking seams (the whole discipline)

Every operational table obeys **three orthogonal seams that stack and never collide**. This is a strict, mechanical extension of the proven pattern in migrations 24–26.

| Seam | Question | Mechanism | Policy kind |
|------|----------|-----------|-------------|
| **1. TENANCY BOUNDARY** | *Which tenant?* | `org_id uuid NOT NULL DEFAULT current_org()` + policy `<t>_org_boundary` `USING (org_id = current_org()) WITH CHECK (org_id = current_org())` | **RESTRICTIVE** |
| **2. MODULE GATE** (module tables only) | *Is this module turned on for the tenant?* | policy `<t>_module_gate` `USING (has_module('<key>')) WITH CHECK (has_module('<key>'))` | **RESTRICTIVE** |
| **3. ACCESS** | *Who, within the tenant?* | `is_admin()`/`has_staff_access()` for staff; SECURITY-DEFINER ownership predicates (`caller_owns_engagement`, `caller_owns_document`, `caller_owns_horse`, `caller_is_payer`, `current_client_id`/`current_contact_id`) for clients | **PERMISSIVE** |

**Why this is safe.** RESTRICTIVE policies **AND** together; PERMISSIVE policies **OR** within the restrictive envelope. So a row is visible only when it is the caller's tenant **AND** (for a module table) the tenant owns the module **AND** at least one access policy passes. A bug in a permissive access policy can only ever **narrow**, never breach the tenant or module walls. Boundary and gate are independent walls — one can never weaken the other.

- **Core tables** carry boundary + access (seams 1 + 3).
- **Module tables** carry boundary + gate + access (seams 1 + 2 + 3).
- **CORE ENTITLEMENT/REGISTRY SUBSTRATE carries boundary ONLY — never a `module_gate`.** `org_modules`, `config_values`, `business_config`, and the global `modules`/`tiers`/`tier_modules` are the substrate the gate itself reads. If any of them carried a `module_gate` (seam 2), evaluating the gate on a module table would call `has_module()` → `SELECT … FROM org_modules` → whose `module_gate` policy calls `has_module()` again → **infinite policy recursion**. They are therefore CORE (seams 1 + 3 for the per-tenant ones; global read-active for the catalog), and `has_module()`/`config_value()`/`current_org()` are **`SECURITY DEFINER` search_path-pinned** so they read that substrate **past RLS** and gate/boundary evaluation never recurses. This is a hard invariant, asserted by a CI meta-test (§4.3, §11): no substrate table may ever acquire a `_module_gate` policy.
- `org_id` is `NOT NULL DEFAULT current_org()`, so a write that forgets `org_id` **fails loudly** instead of silently cross-wiring tenants.
- New tables are added to the **same `DO`-loop array style** already in the repo (migration 26 boundary loop; audit loop), so isolation + audit coverage is mechanical and grep-verifiable.
- **GLOBAL tables (no `org_id`) are a deliberate, separate class.** `contract_templates`, `template_tokens`, `template_variants`, `modules`, `tiers`, `tier_modules` are platform-owned, world-read-active, SUPER_ADMIN-write, and carry **no `org_id` and no boundary**. A per-tenant override, when needed, lives in a **separate** org-scoped table (e.g. `org_template_overrides`), never as a nullable `org_id` on the global table. The CI meta-test enumerates these intended-global tables explicitly so a *business* table that forgot its `org_id` cannot hide among them (§4.3, §11).

`current_org()` is already correct (migration 26): authenticated → their `profile.org_id`; an outsider with no membership → NULL → sees nothing; the seed/service context (`auth.uid() IS NULL`) falls back to the `app.current_org` GUC. **Nothing about `current_org()` changes.** One consequence is load-bearing below: a **service_role / BYPASSRLS / `SECURITY INVOKER` service caller has `auth.uid() = NULL`**, so `current_org()` resolves to the *session* `app.current_org` GUC — **not** to any particular row's tenant. Any function that must scope to a *specific* record's tenant (e.g. `generate_document` scoping to the target engagement) must therefore read the tenant **from the record itself** (`v_eng.org_id`), never from `current_org()` (§6).

**Anon reach is a first-class boundary concern.** A RESTRICTIVE `<t>_org_boundary` written `TO authenticated` **does not constrain the `anon` role at all** (a RESTRICTIVE policy only restricts the roles it names). Tables that `anon` can read or insert (the public catalog: `offerings`, `offering_tiers`; the public intake: `requests`, `request_selections`, `bookings`, `inquiries`) must therefore carry the boundary `TO anon, authenticated`. But `current_org()` is `NULL` for `anon` (no profile), so an anon boundary cannot filter by `current_org()`; anon catalog reads are scoped by the **addressed tenant** resolved from the slug/subdomain via `org_public_config(slug)` (§5.2, §8.6), and anon public **inserts** stamp `org_id` from that same resolved tenant. This is detailed in §8.5–§8.6 and is launch-blocking if omitted.

---

## 3. Module Catalog

`coreOrModule = core` ships to every tenant, always-on, ungated. `coreOrModule = module` is entitlement-gated. **FHE-enabled** marks what the first tenant (a lesson/brokerage barn) turns on at launch; the platform ships all of them.

### Core (always-on, ungated) — `has_module()` never gates these

| Key | Name | FHE-enabled | Description |
|-----|------|-------------|-------------|
| `core.tenancy` | Tenancy & Identity | yes | `organizations`, `profiles.org_id`, `current_org()`, `org_modules`, `has_module()`/`require_module()`, `provision_tenant()`. The isolation + entitlement substrate. |
| `core.roles` | Roles & Access | yes | Existing `SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE/USER` model, `app_role()`/`is_admin()`/`has_staff_access()` and ownership predicates. Unchanged; reused verbatim. |
| `core.registry` | Global Value Registry | yes | `business_config` (typed, per-org) + `config_values` (EAV long-tail) + `config_value(ns,key)` resolver. The define-once home for prices, rates, legal identity, branding, copy, contact info. |
| `core.branding` | Branding & Public Site | yes | Per-tenant brand rows in the registry (name, colors, logo path, copy) driving the branded public site + member app. Personalization = config rows, not code. |
| `core.contracts` | Contracts, Documents & E-Sign | yes | `contract_templates`, `template_tokens`, `documents`, `signatures`, `document_deliveries`, `generate_document` (de-specified to `{{ORG.*}}`), `record_signature`. Seal-on-sign legal engine. |
| `core.payments` | Payments, Billing & Audit | yes | `transactions`, `billable_lines` (universal charge primitive), Stripe/Zelle reconcile `/api`, `audit_logs` (append-only). |

### Feature Modules (entitlement-gated)

| Key | Name | FHE-enabled | Tier hint | Description |
|-----|------|-------------|-----------|-------------|
| `mod.brokerage` | Brokerage & Contracts | **yes** | Brokerage tier / add-on | Search/evaluation/transaction-representation layering (`HORSE_FINDER`, `HORSE_EVALUATION`, the six representation service types), `engagement_stages`, `template_variants`, `create_purchase_engagement` + siblings. FHE's launch centerpiece. |
| `mod.lessons` | Lessons & Membership | **yes** | Lessons/Base tier / add-on | `lesson_packages`, `lesson_credits`, membership plans (wraps existing community memberships), `RIDING_LESSON`/`JUMPER_TRAINING`/`HORSEMANSHIP_TRAINING` engagements. FHE's other launch subset. |
| `mod.boarding` | Boarding & Facility | no | Boarding tier / add-on | `facilities`, `stalls`, `board_agreements` (rate from registry), `board_charges` → `billable_lines`. Ships day one; FHE leaves it disabled. |
| `mod.barnops` | Barn Ops & Inventory | no | Operations tier / add-on | `resources`, `resource_lots` (vendor/lot/unit_cost/on_hand depletion), `consumption_events` (dumb log), `cost_allocation_rules` + `resolve_consumption_billing()` → `billable_lines` per payer. Multi-party cost-attribution ledger. |
| `mod.horserecords` | Horse Records & Health | no | Records tier / add-on (bundled with Boarding/Barn Ops) | `horse_parties` (tenancy-independent ownership; owner/lessee/trainer/caretaker/boarder + share_pct + effective dates), `horse_health_events` (vet/farrier/vaccination/deworming/coggins). The owner-of-record + share source the cost-attribution ledger reads. |
| `mod.employees` | Employees & Scheduling | no | Staff/Operations tier / add-on | `staff_profiles` (link to profiles), `shifts`, `time_entries`, `service_assignments`, `INDEPENDENT_CONTRACTOR` engagements. Ties `consumption_events.administered_by` and `engagements.assigned_staff_id` to real staff. |

### Tiers (strata-mapped packaging — data, expanded at provision time)

Tiers are **packaging sugar**. `tiers` + `tier_modules` express which module keys a tier grants; `provision_tenant()` **expands** the chosen tier into `org_modules` rows so runtime entitlement resolution reads `org_modules` **only** and never reasons about tiers. Add-ons = extra `org_modules` rows (`source = 'ADDON'`). Grandfathering is deliberate: editing a tier later does **not** retroactively re-entitle existing tenants (a future `reconcile_tier(org)` helper can, explicitly).

| Tier key | Name | Modules granted (beyond core) |
|----------|------|-------------------------------|
| `tier.lesson_barn` | Lesson Barn | `mod.lessons` |
| `tier.brokerage` | Brokerage | `mod.brokerage`, `mod.horserecords` |
| `tier.lesson_brokerage` | Lesson + Brokerage (**FHE**) | `mod.lessons`, `mod.brokerage`, `mod.horserecords` |
| `tier.boarding` | Boarding Barn | `mod.boarding`, `mod.horserecords`, `mod.barnops` |
| `tier.full_barn` | Full Barn | all six modules |

**FHE launch entitlement** = `tier.lesson_brokerage` → `{mod.lessons, mod.brokerage, mod.horserecords}` enabled; `{mod.boarding, mod.barnops, mod.employees}` disabled but shippable.

---

## 4. Entitlement Model

### 4.1 Data model

- **`modules`** — platform-owned catalog (global, **no org_id**): `module_key` (PK), `name`, `description`, `is_core`, `active`. World-readable so the pricing/tier UI can list them; `SUPER_ADMIN` write.
- **`tiers`** — global packaging: `tier_key` (PK), `name`, `monthly_price`, `sort_order`, `active`.
- **`tier_modules`** — global map: `tier_key` FK, `module_key` FK (composite unique).
- **`org_modules`** — **per-tenant entitlement, the enforcement source of truth**: `org_id` FK, `module_key` FK, `enabled bool`, `source text CHECK (source IN ('TIER','ADDON','GRANT','SUBSCRIPTION'))`, `enabled_at`, `expires_at` (nullable), `UNIQUE(org_id, module_key)`. Carries the org boundary (seam 1) **and NO `module_gate` (seam 2)** — it is the substrate the gate reads, so gating it would recurse (§2). Writes restricted to `provision_tenant`/`set_org_module` (SUPER_ADMIN, or the billing webhook via service_role). Audited. Index `org_modules(org_id, module_key)`.

> **Substrate rule (hard invariant).** `org_modules`, `config_values`, `business_config` carry seam 1 (boundary) + seam 3 (access) but **never seam 2 (`module_gate`)**. `modules`, `tiers`, `tier_modules` are **global** (no `org_id`, no boundary), world-read-active, SUPER_ADMIN-write. Because `has_module()` and `config_value()` are `SECURITY DEFINER` search_path-pinned, they read this substrate past RLS and the module-gate on *every other* table never recurses into it. The §4.3 CI meta-test asserts no substrate table ever grows a `_module_gate`.

### 4.2 Helpers (the RLS vocabulary — shaped exactly like `current_org()`/`is_admin()`)

```sql
-- STABLE SECURITY DEFINER, search_path-pinned — never recurses into the policies
-- of tables it reads, and is cached per-statement.
CREATE OR REPLACE FUNCTION has_module(p_key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_modules
    WHERE org_id = current_org()
      AND module_key = p_key
      AND enabled
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- The RPC guard: raise cleanly if the caller's tenant lacks the module.
CREATE OR REPLACE FUNCTION require_module(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_module(p_key) THEN
    RAISE EXCEPTION 'module % is not enabled for this organization', p_key
      USING errcode = 'insufficient_privilege';
  END IF;
END;
$$;
```

`SUPER_ADMIN` is deliberately **not** OR'd into `has_module()` (same decision the role model made for `is_org_admin()`): platform access is a separate path, never a blanket OR on every tenant table.

### 4.3 Three-layer enforcement (defense in depth; server authoritative)

- **Layer A — data/RLS.** Module tables carry the second RESTRICTIVE policy `<t>_module_gate USING (has_module('<key>')) WITH CHECK (has_module('<key>'))`. A disabled module's rows are **invisible AND unwritable** even to that org's own ADMIN. No data is deleted; re-enabling restores visibility.
- **Layer B — RPC.** Every module RPC's first statement (after the existing `IF auth.uid() IS NULL` check) is `PERFORM require_module('<key>')`. This protects SECURITY-DEFINER RPCs that run **past** RLS.
- **Layer C — UI.** Nav/route gating reads `org_modules` via a `my_modules()` RPC/view surfaced through `AuthContext`. Convenience only; A + B are the real fence.

**CI meta-tests** (the §11 `rls_meta_coverage.test.ts`) assert, over `information_schema` + `pg_policy`:
- **(a) boundary present + RESTRICTIVE.** Every `public` table with an `org_id` column has a matching `_org_boundary` policy that is `PERMISSIVE = false` (RESTRICTIVE).
- **(b) gate present + RESTRICTIVE.** Every module-owned table has a `_module_gate` policy that is RESTRICTIVE (not merely *named* `_module_gate` — a PERMISSIVE gate would OR into access and widen visibility).
- **(c) INVERSE — no business table is missing `org_id`.** Enumerate an explicit allow-list of **intended-global** tables (`contract_templates`, `template_tokens`, `template_variants`, `modules`, `tiers`, `tier_modules`, plus lookup/enum tables `service_types`, `horse_breeds`, `horse_colors`, `document_status`, `engagement_status`, `config_keys`, and the audit sink `audit_logs`). Assert that **every other** `public` base table **HAS** an `org_id` column. This catches a business table that *should* be tenant-scoped but shipped without `org_id` — which case (a) alone silently ignores, because a table with no `org_id` escapes the "has org_id ⇒ has boundary" rule entirely. A forgotten `org_id` fails the build here.
- **(d) SUBSTRATE — no `module_gate` on the entitlement/registry substrate.** Assert `org_modules`, `config_values`, `business_config`, `modules`, `tiers`, `tier_modules` have **no** `_module_gate` policy (recursion guard, §2/§4.1).
- **(e) audit coverage.** Every business table (the (c) complement) has an audit trigger firing `audit_row_change()`.

A new table cannot silently ship without isolation, gating, an `org_id`, or audit.

---

## 5. Global Value Registry — "define exactly once"

### 5.1 Two-tier design (the resolved conflict)

**Decision.** `business_config` is a **typed table** and **stays a table** — it is not converted to a view. (A view would break `business_config%ROWTYPE` in `generate_document` and the migration-14 singleton/identity tests. That conflict is resolved in favor of keeping the table.) We **generalize** the registry by keeping the typed columns for settled financial/legal fields and **adding an EAV side-table** for the open-ended long tail so new business values become **DATA, not columns/migrations**.

| Tier | Home | Holds | Why |
|------|------|-------|-----|
| **Typed** | `business_config` (per-org, migration 26) | legal entity/signatory/agent, commission rates + min, travel/cancellation/late/no-show fees, protection period, tax rate, retention, e-sign provider, lease full/half fees | Contracts already bind to these columns; strong typing on legal/financial values; **do not migrate away**. |
| **EAV long-tail** | `config_values` (**new**) | brand name/colors/logo path/tagline/copy, contact email/phone/address, per-product prices, per-module knobs, any future value | Honors GLOBAL-VALUE-CHANGES-RULE-THE-DAY without a migration per value. |

**`config_values`** (new): `org_id uuid NOT NULL DEFAULT current_org()`, `namespace text`, `key text`, `value_text text`, `value_num numeric`, `value_json jsonb`, `category text`, `effective_from timestamptz DEFAULT now()`, `updated_by uuid`, `UNIQUE(org_id, namespace, key)`. Carries the org boundary (seam 1). Index `config_values(org_id, namespace, key)`. Audited.

**`config_keys`** (new, global registry of allowed keys — the anti-typo guard): `namespace`, `key`, `expected_type text CHECK (expected_type IN ('text','num','json'))`, `required bool`, `description`. `config_value()` validates against it; a go-live completeness check flags required-but-unset keys per tenant. (An untyped EAV silently resolving a fat-fingered key to NULL is dangerous for a legal/financial value; this guard is the mitigation.)

### 5.2 The single resolution seam

```sql
-- Reads the typed business_config column when the (ns,key) maps to one; else the
-- config_values row; always scoped to current_org(). ONE resolver that contracts,
-- products, pages, receipts, and emails all call — so one write propagates everywhere.
-- SECURITY DEFINER search_path-pinned + STABLE, shaped exactly like current_org()/
-- has_module(): it reads business_config/config_values PAST their RLS, so calling it
-- inside a policy or a SECURITY-INVOKER RPC never recurses into those tables' policies.
CREATE OR REPLACE FUNCTION config_value(p_ns text, p_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$ ... $$;
```

- **`config_value()` is `SECURITY DEFINER`** (not INVOKER): it is called from RLS policies, from `SECURITY INVOKER` functions like `generate_document`, and from module RPCs. As DEFINER it resolves against `current_org()` without tripping `business_config`/`config_values` RLS, exactly the recursion-safe posture of `current_org()`/`has_module()`. It resolves for the caller's own tenant; it is **not** the anon public path (that is `org_public_config`, below).
- **`business_config` posture is preserved:** typed financial/legal config is **admin-only** and NEVER exposed to anon/USER except as merged document text.
- **Public exposure is tightly scoped and is the ANON org-resolution seam:** `org_public_config(p_slug text)` is `SECURITY DEFINER`; it resolves `slug → org_id` from `organizations` (the `slug` column is UNIQUE, migration 26) and returns **only** brand (`config_values` ns `BRAND`) + active public module list + public product pricing for **that addressed tenant** — no `current_org()`, because `anon` has none. Financial/legal internals never cross to anon. This is the single function the prerendered public site and any anon catalog read call to learn "which tenant am I, and what may I show?" (§8.6). Anon public **writes** (intake `requests`/`bookings`/`inquiries`) resolve `org_id` from the same slug and stamp it server-side; they never trust a client-supplied `org_id`.
- **Effective-dating:** `config_values.effective_from` and `product_prices` (§7.2) keep an auditable price/rate history; the resolver reads the current effective value, sales snapshot the value at sale time.

### 5.3 The registry catalog (define-once values → where they resolve)

| Key(s) | Category | Home | Resolves to |
|--------|----------|------|-------------|
| `ORG.LEGAL_NAME` / `ORG.SIGNATORY_NAME` / `ORG.SIGNATORY_TITLE` / `ORG.ENTITY_FORMATION` / `ORG.REGISTERED_AGENT` | legal_identity | `business_config` typed | `{{ORG.LEGAL_NAME}}`/`{{ORG.SIGNATORY_*}}` (+ `{{FHE.*}}` alias) in every contract, receipt/email footer |
| `ORG.ADDRESS` / `ORG.PHONE` / `ORG.EMAIL` / `ORG.URL` | contact | **`config_values` ns `CONTACT`** (phone/email/url); `ORG.ADDRESS` additionally has a typed `business_config.business_address` | `{{ORG.ADDRESS/PHONE/EMAIL}}`, header/footer, receipts, transactional emails. **`business_config` has NO phone/email/url column** (only `business_address`); phone/email/url therefore resolve ONLY from `config_values` ns `CONTACT`. Replaces the hardcoded `src/lib/brand.ts` contact block AND the phantom `brand`-table reference in `template_tokens.notes` (`{{FHE.PHONE}}`/`{{FHE.EMAIL}}` currently point at a non-existent `brand` table). Seeded by **U3**; any token that renders these depends on U3. |
| `COMMISSION.PURCHASE_RATE` / `SALE_RATE` / `LEASE_RATE` / `MIN` | financial | `business_config` typed | `{{TXN.COMMISSION_RATE/MIN}}` (by service type), product/pricing pages, receipts |
| `FEE.CANCELLATION` / `LATE` / `NO_SHOW` / `TRAVEL_*` | financial | `business_config` typed | contract fee clauses, lessons/boarding billing, receipts, dunning emails |
| `LEASE.FULL_FEE` / `HALF_FEE` | financial | `business_config` typed | `{{TXN.LEASE_FEE}}` default, lease pages |
| `ENG.PROTECTION_PERIOD` | legal_terms | `business_config` typed | `{{ENG.PROTECTION_PERIOD}}` in representation contracts |
| `TAX.SALES_RATE` / `RETENTION.DOCUMENT` / `ESIGN.PROVIDER` | compliance | `business_config` typed (admin-only) | receipts (tax), retention jobs, signing flow |
| `BRAND.NAME` / `SHORT_NAME` / `TAGLINE` / `PRIMARY_COLOR` / `SECONDARY_COLOR` / `LOGO_PATH` / `COPY.*` | branding | `config_values` ns `BRAND` | BrandProvider (SPA + prerender), document letterhead, `{{ORG.BRAND_NAME}}`. Replaces hardcoded `brand.ts` constant. |
| `PRICING.<product_key>.PRICE/UNIT/MIN` | pricing | `products`/`product_prices` (typed) + `config_values` ns `PRICING` (add-ons) | product pages, checkout, Stripe amounts, receipts, contract fee tokens — one tenant-scoped source |
| `MODULE.<key>.<param>` (e.g. `BOARDING.DEFAULT_BOARD_RATE`, `BARNOPS.MARKUP_PCT`) | module_config | `config_values` ns `<MODULE>` | resolved by `config_value()` inside module RPCs and cost-attribution — tunable business values as data, no new columns |

---

## 6. `generate_document` isolation fix + `{{ORG.*}}` de-specification

**This is the single highest-priority correctness fix and must land in the FIRST backbone migration, before any second tenant is provisioned.**

**Ground truth (verified against `20260629110000_generate_document.sql`, `20260629150000_transactions.sql`, `…040000_contract_templates_tokens.sql`, `…100000_load_contract_bodies.sql`):**
- **`generate_document` is defined TWICE.** The first definition is migration 18 (`…110000_generate_document.sql`); it is **re-created (superseded)** by migration 22 (`…150000_transactions.sql` line 96), which adds the TXN money-token arms (`PURCHASE_PRICE`/`DEPOSIT_AMOUNT`/`BALANCE_DUE`/…) that `purchase_flow.test.ts` asserts (`$15,000.00`, `$12,000.00`). **U1 must `CREATE OR REPLACE` starting from the migration-22 body** (preserving all TXN arms), NOT the migration-18 body — otherwise the money tokens regress and `purchase_flow.test.ts` goes red. The line references below are to the migration-22 (authoritative) copy.
- `generate_document` (both copies) is declared `LANGUAGE plpgsql` **with NO `SECURITY DEFINER` — it runs `SECURITY INVOKER`.** (An earlier docblock in migration 14 loosely calls the merge RPC "SECURITY DEFINER"; the function as written is INVOKER. This section is authoritative.)
- The config read (migration 22 line 140) is **`SELECT * INTO v_cfg FROM business_config LIMIT 1`** — an arbitrary tenant's row.
- The merge loop (lines 90–93) iterates **only per-template `template_tokens` rows** (`WHERE template_id = v_tmpl.id`). **Global dictionary rows (`template_id = NULL`) are NEVER merged.** Adding a global `{{ORG.PHONE}}`/`{{FHE.EMAIL}}` dictionary row therefore does **nothing** to a document — only a per-template row for a token that literally appears in that body merges.
- The **only** FHE tokens that appear in any loaded body are **`{{FHE.SIGNATORY_NAME}}` (×24) and `{{FHE.SIGNATORY_TITLE}}` (×24)**, driven by `business_config.signatory_name`/`signatory_title`. **No body contains `{{ORG.*}}`, `{{FHE.LEGAL_NAME}}`, `{{FHE.ADDRESS}}`, `{{FHE.PHONE}}`, or `{{FHE.EMAIL}}`.** The `{{FHE.PHONE}}`/`{{FHE.EMAIL}}` global dictionary rows point at a **non-existent `brand` table** (`source_table 'brand'`, documentation-only) and hardcode `858-439-3614` / `Hello@FHEquestrian.com` in `notes`.

### 6.1 The two defects and the exact fix

**Defect 1 — cross-tenant config leak (legal, not cosmetic).** With one tenant, `LIMIT 1` is fine; with a second, a contract can merge another tenant's legal entity / signatory / commission.

**The fix keys off the ENGAGEMENT's tenant, NOT `current_org()`:**
```sql
-- 4. business config — scope to the ENGAGEMENT'S org (v_eng already loaded at step 2)
SELECT * INTO v_cfg FROM business_config WHERE org_id = v_eng.org_id;
```
**Why not `WHERE org_id = current_org()`?** Because `generate_document` is `SECURITY INVOKER` and a legitimate caller can be `service_role`/BYPASSRLS (batch generation, provisioning) or any path where `auth.uid() IS NULL`. For such a caller `current_org()` falls back to the session `app.current_org` GUC (migration 26) — in the harness pinned to org #1 — so `WHERE org_id = current_org()` would scope to the **session**, not to the target engagement, and a batch run could merge the wrong tenant's config into another tenant's contract. `v_eng.org_id` is the engagement's own tenant (RLS already guaranteed the caller may read that engagement for interactive callers), so it is correct for **both** authenticated and service-role callers. This is the isolation fix.

**Defect 2 — hardcoded `FHE` namespace → `{{ORG.*}}` de-specification.** Add an **org-neutral `{{ORG.*}}`** CASE arm alongside the existing `{{FHE.*}}` arm, both resolving from the **same** per-engagement `v_cfg` (typed) with phone/email/url via `config_value('CONTACT', …)` scoped to `v_eng.org_id`. `{{FHE.*}}` becomes a **literal alias** of `{{ORG.*}}` (identical resolution), so a future body can use either and a body that renames `{{FHE.SIGNATORY_NAME}} → {{ORG.SIGNATORY_NAME}}` merges identically. **No existing contract body is edited.**

Handled fields per namespace (both `ORG` and `FHE`): `LEGAL_NAME`, `SIGNATORY_NAME`, `SIGNATORY_TITLE`, `ADDRESS`, `BRAND_NAME` from `v_cfg`/`config_value`; **`PHONE`/`EMAIL`/`URL` from `config_value('CONTACT', …)`** — **not** from `business_config`, which has no such column.

### 6.2 What the U1 test can and cannot assert (this is why the old test spec was red)

Because only `{{FHE.SIGNATORY_NAME}}`/`{{FHE.SIGNATORY_TITLE}}` actually appear-and-merge in shipped bodies, the isolation test **must assert on those tokens** — not on `{{ORG.LEGAL_NAME}}`, which no body emits:
- Two orgs, each with a **distinct `business_config.signatory_name`** (e.g. org A `'A. Owner'`, org B `'B. Boss'`). Generate the same template for an engagement in each org and assert **A's document contains `'A. Owner'` and NOT `'B. Boss'`**, and vice-versa — the render-equality/isolation proof, on a token that is real.
- **Service-role leak guard (the crux):** seed A and B, set the session GUC to org A, then as `service_role` generate a document for **B's** engagement and assert it renders **B's** signatory, proving the read keyed off `v_eng.org_id` and did **not** follow the org-A session GUC. (With the old `WHERE org_id = current_org()` fix this assertion FAILS — it would render A's config — which is exactly why the fix must use `v_eng.org_id`.)
- Optionally add a per-template `{{ORG.SIGNATORY_NAME}}` alias row to **one** template and assert it renders identically to `{{FHE.SIGNATORY_NAME}}`, exercising the alias without touching a shipped body's tokens.

**`{{ORG.PHONE}}`/`{{ORG.EMAIL}}` (and `{{FHE.*}}` aliases) are handled by U3, not U1 — a deliberate ordering resolution.** U1 lands **first** (migration #1) and must therefore stay dependency-free: it resolves only the fields available from the typed `business_config` `v_cfg` (`LEGAL_NAME`/`SIGNATORY_NAME`/`SIGNATORY_TITLE`/`ADDRESS`/`BRAND_NAME`) — it does **not** call `config_value()` (that function does not exist until U3). The `CONTACT`-backed `PHONE`/`EMAIL`/`URL` arms are added by a **second `CREATE OR REPLACE generate_document` inside U3's migration** (`…020000_value_registry.sql`), which is where `config_value()` and the FHE `CONTACT` seed are born — so U3 is the natural, in-order home to wire phone/email. This honors the review's "defer ORG.PHONE/EMAIL to after U3" while keeping U1 first and dep-free. Net effect: `{{…PHONE/EMAIL}}` render **blank until (a) a body/per-template row uses them (none today) and (b) U3 has seeded `CONTACT`**; any global dictionary rows added for them are documentation only (they do not merge on their own).

- `{{TXN.*}}` commission/fee tokens continue to resolve rates through `v_cfg`/registry so a rate change propagates to every **future** contract merge.

Because `generate_document` reads engagement/parties/transactions that are already org-scoped, its output becomes **tenant-correct** once the config read keys off `v_eng.org_id` and `{{ORG.*}}` resolves from that same per-engagement config.

### 6.3 Green-safety of the additive `CREATE OR REPLACE`

- No schema/table change — a pure `CREATE OR REPLACE FUNCTION`, so `generate_document.test.ts` structure is untouched.
- The existing test seeds `business_config` and the engagement as superuser (both default `org_id` to org #1 via the GUC), so `WHERE org_id = v_eng.org_id` finds the row exactly as `LIMIT 1` did → the existing "resolves party/horse/config tokens" and "no orphan `{{…}}` except SIG" assertions stay green.
- New `{{ORG.*}}`/`CONTACT` handling only *adds* CASE arms; unmerged-but-present global dictionary rows never reach the loop, so they cannot introduce a leftover token.

**Contract template bodies stay platform-global.** `contract_templates`/`template_tokens` remain the shared, attorney-maintained legal library keyed by `template_key`; tenants differ only by the **values** their tokens resolve to. Provisioning seeds **values, not documents**. An optional future `org_template_overrides(org_id, template_key, body)` allows a tenant-specific clause set **additively**, not needed for launch.

---

## 7. Domain Data Models

All new domain tables obey §2 (boundary + gate + access), carry `deleted_at`/`deleted_by` and the audit trigger (added to the migration-13 `business_tables` array by name), and use the existing helpers (`assign_display_code[_yearly]`, `set_updated_at`, `audit_row_change`, `try_cast_uuid`).

### 7.1 Contracts (layered: search / evaluation / transaction-rep) — module `mod.brokerage`

Per `CONTRACT_MODULE_ARCHITECTURE.md`: an engagement is a **chain of separately-executed, independently-billed stages**; the model must **not** assume a full pipeline (clients enter/exit mid-way). Directional terminology (buy/sell/lease-in/lease-out) is **token-driven** by (retained_by, deal_side), never hardcoded per document.

- **`engagement_stages`** — the separately-executed stages of an engagement: `org_id`, `engagement_id` FK, `stage text CHECK (stage IN ('SEARCH','EVALUATION','TRANSACTION_REP'))`, `retained_by text`, `deal_side text CHECK (deal_side IN ('BUY','SELL','LEASE_IN','LEASE_OUT'))`, `status`, `fee_value_key text`, effective/created. Each stage independently created/billed with **no required predecessor**. Boundary + `module_gate('mod.brokerage')`.
- **`template_variants`** — **a GLOBAL table with NO `org_id`, modeled exactly like `contract_templates`/`template_tokens`.** Maps `(template_key, retained_by, deal_side)` → `token_overrides jsonb` so one tokenized `HORSE_FINDER`/representation template serves all four directions without duplicated documents. **World-read-active, SUPER_ADMIN-write, no boundary, no `module_gate`.** It is *not* given a nullable `org_id`: a nullable `org_id` cannot take the standard RESTRICTIVE `org_id = current_org()` boundary (which would hide every NULL/global row from every tenant, since `NULL = current_org()` is never true), and a bespoke `org_id IS NULL OR org_id = current_org()` shape both evades the §4.3 meta-test and still hides globals on WRITE. Global-with-no-`org_id` keeps the meta-test's "has `org_id` ⇒ has boundary" rule clean and global rows visible to all tenants. A **tenant-specific** override, if ever needed, goes in a **separate** org-scoped `org_template_overrides(org_id, template_key, retained_by, deal_side, token_overrides)` table (boundary + access) — never as a nullable column here. `template_variants` is listed in the §4.3 intended-global allow-list.

The six representation service types (`HORSE_PURCHASE_ASSISTANCE`, `HORSE_SALE_ASSISTANCE`, `HORSE_LEASE_IN_ASSISTANCE`, `HORSE_LEASE_OUT_ASSISTANCE`, plus `HORSE_FINDER`, `HORSE_EVALUATION`) already exist in the 13-service catalog.

> **Brokerage-gating decision (resolves the coherence question).** `create_purchase_engagement` **already exists** (migration `…160000_purchase_flow_rpcs.sql`) as **core, ungated** — its only guard today is `IF auth.uid() IS NULL`. To keep brokerage entitlement **consistent**, U7 adds `PERFORM require_module('mod.brokerage')` to **all three** engagement-creation RPCs — `create_purchase_engagement` (via `CREATE OR REPLACE`, signature unchanged) **and** the new `create_search_engagement`/`create_lease_engagement`. Purchase-engagement creation is thereby gated by `mod.brokerage` like its siblings, not left as an ungated core path. (The FHE launch tier includes `mod.brokerage`, so FHE is unaffected; a lesson-only tenant without `mod.brokerage` is correctly denied all three.) This is an **additive `CREATE OR REPLACE`**; the existing `purchase_flow.test.ts` runs as an FHE-context caller (org #1 has `mod.brokerage`), so it stays green — U7's test additionally asserts a `mod.brokerage`-off org is denied.

### 7.2 Products / Services catalog — core `core.payments` (visibility gated per owning module)

`service_types` (the existing 13-value catalog) is the **service taxonomy**; products are the **per-org sellable SKUs** layered on top. Prices reference the registry, **never literals**.

- **`products`** — `org_id`, `product_key`, `name`, `service_type text REFERENCES service_types(code)` (nullable), `module_key text REFERENCES modules(module_key)` (gates visibility), `price_value_key text`, `active bool`. Boundary; and `module_gate(module_key)` where the product belongs to a module. Active/public rows exposed via `org_public_config`.
- **`product_prices`** — effective-dated price history: `org_id`, `product_id` FK, `amount`, `effective_from`, `effective_to`. Snapshotted at sale time.
- **`billable_lines`** (the universal charge primitive — shared by consumption, board, lessons, fees): `org_id`, `payer_contact_id` FK, `source_kind text` (`consumption|board|lesson|fee`), `source_id uuid`, `horse_id uuid` (nullable), `qty numeric`, `unit_amount numeric`, `amount numeric`, `status text`, `period tstzrange` (nullable), `transaction_id uuid` (nullable). Boundary; staff RCUD; client reads own where `payer_contact_id = current_contact_id()`. **Append-only once settled** (REVOKE UPDATE/DELETE after settle, mirroring signatures' seal). Module resolvers emit these; they roll up into `transactions`.

> **`billable_lines` lives in core** (not a module) because board, lessons, and consumption all emit into it. Rows are still tagged `source_kind`; the module that produced them is gated at the source table, not on `billable_lines`.

### 7.3 Branding / Personalization — core `core.branding`

Registry categories `BRAND.*` / `CONTACT.*` in `config_values` (§5). No new domain table required. Frontend `brand.ts`/`catalog.ts`/`serviceCatalog.ts` flip from hardcoded consts to a tenant-resolved **BrandProvider** fed by `org_public_config` (§12). Logo/brand assets live in a new `brand-assets` storage bucket, path-prefixed by `org_id` (§8.4).

### 7.4 Financials / Legal variables — core `core.registry`

All in `business_config` (typed) + `config_values` (long-tail) per §5. No new table beyond the registry itself. `transactions` (existing) remains the per-engagement financial record; `billable_lines` (§7.2) is the roll-up primitive.

### 7.5 Boarding / Facility — module `mod.boarding`

- **`facilities`** — `org_id`, `name`, `address_value_key text`. Parent of stalls/agreements.
- **`stalls`** — `org_id`, `facility_id` FK, `code`, `stall_type`, `active`.
- **`board_agreements`** — per-horse boarding contract: `org_id`, `horse_id` FK, `stall_id` FK, `boarder_contact_id` FK, `board_rate numeric` (defaulted from `config_value('BOARDING','DEFAULT_BOARD_RATE')`), `board_type`, `start_date`, `end_date`, `status`. Anchors board billing + board-scoped cost allocation. Boundary + `module_gate('mod.boarding')`; staff RCUD; boarder reads own; never hard-deletable.
- **`board_charges`** — recurring/period charges: `org_id`, `board_agreement_id` FK, `period_start`, `period_end`, `amount`, `billable_line_id` FK. Deterministic (rate × period); emits into `billable_lines`.

### 7.6 Horse ownership — module `mod.horserecords`

**Ownership is tenancy-independent** (a boarding client owns a horse stabled at the barn; lessees hold partial rights) **but every row still carries `org_id`** for the boundary. A horse is stabled-at / operated-by exactly one org (its `org_id`); ownership/rights are modeled separately.

- **`horse_parties`** — the ownership/rights ledger and the **payer source** the cost-attribution ledger resolves against: `org_id`, `horse_id` FK, `contact_id` FK, `role text CHECK (role IN ('owner','lessee','trainer','caretaker','boarder'))`, `share_pct numeric`, `effective_from date`, `effective_to date`. Boundary + `module_gate('mod.horserecords')`; staff RCUD; client reads where `contact_id = current_contact_id()` or owns the horse's engagement (new predicate `caller_owns_horse(h_id)` in the `client_can_read_horse` style). Never hard-deletable.

> **Cross-org horse portability is deliberately out of scope for launch.** Isolation is sacred: a horse belongs to one tenant's boundary. A horse physically moving barns (org→org) has **no v1 migration path**; if it becomes a real workflow it needs a deliberate, audited **transfer RPC**, NOT a relaxation of the boundary. Multi-barn horse identity is a future federated concern.

### 7.7 Inventory / Consumables cost-attribution ledger — module `mod.barnops`

**The crown jewel. It MIRRORS the contract engine exactly: logging is dumb and cheap; attribution is a deterministic resolvable function of (event × allocation rules) → billable lines**, just as document generation is a deterministic function of (template × tokens × config).

- **`resources`** — catalog of consumables/durables: `org_id`, `resource_key`, `name`, `category text` (`feed|med|bedding|supply|equipment`), `unit_of_measure text`, `is_consumable bool`. The "what."
- **`resource_lots`** — a purchased lot (depletion + vendor attribution unit): `org_id`, `resource_id` FK, `vendor_contact_id` FK (nullable), `qty_purchased numeric`, `unit_cost numeric`, `on_hand numeric`, `purchased_at`. Consumption draws down `on_hand`.
- **`consumption_events`** — the **DUMB, cheap, append-only** fact: `org_id`, `resource_id` FK, `resource_lot_id` FK (nullable), `horse_id` FK (nullable), `qty numeric`, `administered_by uuid` (staff), `occurred_at`, `notes`. **Never computes money.** Append-only (REVOKE UPDATE/DELETE). Mirrors an unmerged template awaiting resolution.
- **`cost_allocation_rules`** — the **explicit OVERRIDE layer** for attribution: `org_id`, `scope text CHECK (scope IN ('horse','lease','board','default'))`, `scope_id uuid` (nullable for `default`), `payer_contact_id` FK, `share_pct numeric`, `effective_from date`, `effective_to date`. It is **not** the primary source of the owner/lessee split — that is `horse_parties` (§7.6). It exists only to *override* the derived split for a specific horse/lease/board (e.g. "for this horse, bill the trainer 100% of med costs regardless of ownership shares") or to hold the `default`/barn payer.

- **`resolve_consumption_billing(p_period tstzrange)`** — the **deterministic resolver RPC** (`require_module('mod.barnops')`), a pure re-runnable function of (event × derived-or-overridden allocation) → `billable_lines` per payer per period, rolling into `transactions` (via the settlement roll-up, §7.11). **The payer split is single-sourced from `horse_parties`, mirroring how `config_value()` prefers the typed column:**

  For each `consumption_event` in `p_period`, resolve the split for its `horse_id` in this precedence:
  1. **Explicit override.** If an active (effective-dated) `cost_allocation_rules` row covers the event's scope (`horse`/`lease`/`board`), use it. This is the deliberate override.
  2. **Derived from `horse_parties` (the default, single source of truth).** Otherwise derive the split from the **effective-dated `horse_parties` shares** for that horse at the event's `occurred_at` — the `owner`/`lessee` (and any share-bearing role) `share_pct` rows. Editing a lease share in `horse_parties` thus flows straight into billing with **no** parallel `cost_allocation_rules` edit — no drift, one source of truth for the split.
  3. **Uncovered → explicit `default`/barn line.** If neither an override nor any `horse_parties` share covers (or shares don't reach 100%), route the remainder to the `default`-scoped/barn payer as an **explicit** line — **never silently dropped**.

  This removes the duplication the review flagged (the split lived in both `horse_parties.share_pct` and `cost_allocation_rules.share_pct` with no wiring between them) and the drift risk (stale `cost_allocation_rules` after a lease change).

All `mod.barnops` tables: boundary + `module_gate('mod.barnops')`; staff RCUD; `billable_lines` client-readable by payer. Every row carries `org_id`; payers resolve **only within `current_org()`** (a `contact` that is also a client of another org never leaks a cross-org relationship).

**Attribution determinism guardrails (same discipline + tests as `generate_document`):**
- A consumption event with **no covering override AND no `horse_parties` share** surfaces as an **explicit `default`-scoped/barn payer** line, **never silently dropped**.
- `resolve_consumption_billing()` validates that the effective split for a horse **sums to 100** (deriving from `horse_parties` when no override exists; routing any remainder to the barn/default payer), and rejects overlapping effective-dated **override** rules that would double-bill.
- **Provisioning does not pre-seed a bogus "100% owner" rule.** Because the split derives from `horse_parties`, `provision_tenant` seeds **at most** a `default`/barn fallback `cost_allocation_rules` row (for events on horses with no `horse_parties` rows yet) — **not** a per-horse "100% owner" override that would silently bill a leased horse entirely to the owner (the exact bug the old §9 step-4 wording risked). See §9 step 4.

### 7.8 Horse Records / Health — module `mod.horserecords`

- **`horse_health_events`** — vet/farrier/vaccination/deworming/coggins log: `org_id`, `horse_id` FK, `event_type`, `occurred_at`, `provider_contact_id` FK (nullable), `next_due date`, `notes`, `document_id` FK (nullable, links to a core e-sign doc e.g. emergency vet auth). Boundary + `module_gate('mod.horserecords')`; staff RCUD; owner reads own horse (`caller_owns_horse`).

### 7.9 Employees / Scheduling — module `mod.employees`

- **`staff_profiles`** — employment record on a profile/contact: `org_id`, `profile_user_id uuid REFERENCES profiles(user_id)`, `contact_id` FK (nullable), `title`, `pay_type`, `active`. Ties `consumption_events.administered_by` and engagement assignment to real staff.
- **`shifts`** — `org_id`, `staff_profile_id` FK, `starts_at`, `ends_at`, `role`.
- **`time_entries`** — `org_id`, `staff_profile_id` FK, `clock_in`, `clock_out`, `minutes`, `source_kind`, `source_id`. Payroll/service-time costing.
- **`service_assignments`** — assigns staff to an engagement/service occurrence: `org_id`, `engagement_id` FK (nullable), `staff_profile_id` FK, `service_type text REFERENCES service_types(code)`, `scheduled_at`, `status`. The operational link behind `assigned_staff_id`.

All `mod.employees` tables: boundary + `module_gate('mod.employees')`; org-admin write; employee reads own (`staff_profile_id`/`profile_user_id = auth.uid()`-resolved).

### 7.10 Lessons & Membership — module `mod.lessons`

- **`lesson_packages`** — purchasable packs: `org_id`, `package_key`, `name`, `price_value_key`, `credits`, `active`. Priced from the registry.
- **`lesson_credits`** — per-client balances: `org_id`, `client_id` FK, `package_key`, `credits_total`, `credits_remaining`, `purchased_at`. Boundary + `module_gate('mod.lessons')`; client reads own.
- **`lesson_bookings`** — the **in-module scheduling surface** credits are consumed against: `org_id`, `client_id` FK, `lesson_credit_id` FK, `scheduled_at`, `duration_min`, `instructor_staff_profile_id uuid` (nullable — a `mod.employees` `staff_profiles` id, **nullable** so a lesson-only FHE tenant with `mod.employees` OFF still schedules), `status text CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW'))`, `credits_used int DEFAULT 1`. Boundary + `module_gate('mod.lessons')`; staff RCUD; client reads own. **This resolves the orphan the review flagged:** the old spec said credits are "consumed at scheduling" but no scheduling table existed inside `mod.lessons` (`service_assignments`/`shifts` live in `mod.employees`, which is FHE-DISABLED), so a lesson-only tenant had nothing to consume against. A trigger on `lesson_bookings` insert decrements `lesson_credits.credits_remaining` (guarding non-negative) and, on `COMPLETED`, may emit a `billable_lines` `source_kind='lesson'` row for any overage/fee. The instructor link to `mod.employees` is **optional**: when `mod.employees` is on, `instructor_staff_profile_id` ties to a real staff record; when off, it is NULL and scheduling still works.

### 7.11 Settlement roll-up: `billable_lines` → `transactions` — core `core.payments`

`billable_lines` is the universal charge primitive that board/lessons/consumption emit into, but the review correctly flagged that **no unit stated HOW settled lines reach an invoice** — the mandate's explicit example ("cost_allocations reach invoices") was unbuilt. This subsection + build unit **U17** close it.

- **`settle_billable_lines(p_payer_contact_id uuid, p_period tstzrange)`** — a `SECURITY DEFINER` core RPC (no `require_module` — core, shared by all emitters) that:
  1. selects `billable_lines` for the payer in the period with `status='OPEN'` and `transaction_id IS NULL`;
  2. inserts **one** `transactions` row (an invoice: `txn_type='INVOICE'`, `amount = SUM(billable_lines.amount)`, `payer_contact_id`, `period`, and `engagement_id` = the lines' engagement when they share one, else NULL);
  3. stamps each rolled line `status='SETTLED'`, `transaction_id = <new txn>`;
  4. at settle, the lines become **append-only** (REVOKE UPDATE/DELETE / the seal trigger fires) exactly like signatures seal on sign.

  Re-runnable/idempotent: a line already `SETTLED`/`transaction_id`-stamped is skipped, so a second call for the same payer/period does not double-invoice. This is the **only** path a `billable_line` (including a `resolve_consumption_billing()` cost-allocation line) reaches a `transactions` invoice — so the consumption → cost-allocation → billable_line → **transaction** chain is complete and end-to-end testable (§15 critical chains).

- **`transactions` additive alterations (verified against `…150000_transactions.sql`):** today `transactions.engagement_id` is **`NOT NULL`** and `txn_type CHECK (txn_type IN ('PURCHASE','SALE','LEASE'))`. U17 therefore, additively:
  - `ALTER TABLE transactions ALTER COLUMN engagement_id DROP NOT NULL` (relaxing a constraint invalidates no existing row; a consumption invoice may have no single engagement). The existing `transactions.test.ts`/`purchase_flow.test.ts` insert with an `engagement_id`, so they stay green.
  - `ALTER TABLE transactions DROP CONSTRAINT <txn_type_check>; ADD CONSTRAINT … CHECK (txn_type IN ('PURCHASE','SALE','LEASE','INVOICE'))` — re-adding the **superset**, so every existing `PURCHASE`/`SALE`/`LEASE` row stays valid; only the new value is added.
  - `ADD COLUMN IF NOT EXISTS payer_contact_id uuid REFERENCES contacts(id)` and `ADD COLUMN IF NOT EXISTS period tstzrange` (both nullable). `transactions` is already org-scoped (migration 26) and audited, so no boundary/audit change is needed.

---

## 8. Tenant-Isolation RLS pattern — the exact recipe extended to every new table

### 8.1 Boundary loop (extends migration 26 by name, never rewrites it)

Each new-tables migration appends its tables to a `DO`-loop array in the migration-26 style:

```sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[ '<new_table_1>', '<new_table_2>', ... ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id)', t);
    -- new tables are born empty, so no backfill is needed; the DEFAULT + NOT NULL
    -- suffice. (Only the migration-26 pre-existing tables needed the one-time backfill.)
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN org_id SET DEFAULT current_org()', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (org_id)', t||'_org_idx', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
  END LOOP;
END $$;
```

### 8.2 Module gate (module tables only)

```sql
CREATE POLICY <t>_module_gate ON <t> AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('<key>')) WITH CHECK (has_module('<key>'));
```

### 8.3 Access (permissive) + audit + soft-delete

Per-table permissive policies use `is_admin()`/`has_staff_access()` + ownership predicates (§2). Every business table carries `deleted_at`/`deleted_by` and REVOKE DELETE where the security model demands (contracts/horses/transactions/signatures pattern extended to `horse_parties`, `board_agreements`, `documents`-linked rows). Ledger tables (`consumption_events`, `billable_lines`) additionally REVOKE UPDATE/DELETE (append-only after settle; the seal trigger mirrors `signatures`).

**Audit-trigger attachment has EXACTLY ONE owner: U14.** The audit trigger is attached to every new business table **only** in U14's fresh `business_tables` `DO`-loop (§10 migration 14, `…130000_audit_gate_meta.sql`) — the single site that extends the migration-13 array. **Individual module/schema units (U5, U7–U12, U17) do NOT attach audit triggers to their own tables** (the earlier "add to the audit business_tables set locally" wording is **removed** — it caused a double-attach: a table added both in its own migration and again in U14 would `CREATE TRIGGER` twice; idempotent via `DROP TRIGGER IF EXISTS` but ownership was muddled). Each domain unit still declares `deleted_at`/`deleted_by` and any REVOKE; **audit trigger creation is U14's job alone.** Because U14 `dependsOn` all domain units, every table exists when U14 attaches. The §4.3 audit meta-test (e) then proves coverage.

### 8.4 Storage isolation matches table isolation

New buckets `inventory-docs`, `horse-health`, `brand-assets` reuse the path-prefix ownership model with **`org_id` as the leading path segment** (`brand-assets/{org_id}/logo.png`), and policies AND `try_cast_uuid(split_part(name,'/',1)) = current_org()` so storage isolation matches table isolation.

### 8.5 Pre-existing platform catalog must be org-scoped too (focal point) — the EXACT list

Migration 26 scoped only 8 CRM tables + `business_config` (`contacts`, `clients`, `horses`, `engagements`, `engagement_parties`, `transactions`, `documents`, `signatures`). **A grep of every `CREATE TABLE` that still lacks `org_id` after migration 26** (not a vague "the community tables") yields the following **complete unscoped set**, which **U4** must org-scope. Any table omitted from the `DO`-loop array ships with NO `org_id` and is a cross-tenant leak (Principle 5, launch-blocking):

**Booking/intake (migration `…012944` + `…010000_platform_data_model`):**
`bookings` (**note: `bookings`, not just `bookings_v2`**), `inquiries`, `availability_slots`, `requests`, `request_selections`, `qualifier_answers`.

**Commerce catalog + orders (migration `…010000_platform_data_model`):**
`offerings`, `offering_tiers`, `orders`, `order_items`, `order_documents`, `payments`, `payment_notifications`, `bookings_v2`.

**Community (migration `…040000_community`):**
`memberships`, `member_groups`, `group_members`, `announcements`, `channels`, `channel_messages`, `threads`, `thread_posts`, `direct_messages`, `events`, `event_rsvps`, `invitations`, `moderation_actions`, `content_posts`, `content_resources`.

**Gifts (migration `…050000_gifts`):** `gifts`.

**Excluded (correctly unscoped):** the lookup/enum tables (`service_types`, `horse_breeds`, `horse_colors`, `document_status`, `engagement_status`), the audit sink (`audit_logs`), and the global template/entitlement tables (`contract_templates`, `template_tokens`, plus the new global `template_variants`, `modules`, `tiers`, `tier_modules`) — these are in the §4.3 intended-global allow-list.

**Recipe (identical to migration 26):** for each table in the array — `ADD COLUMN org_id` → **one-time backfill onto tenant #1** (`SELECT id FROM organizations ORDER BY created_at LIMIT 1`) → `SET NOT NULL` → `SET DEFAULT current_org()` → index → RESTRICTIVE `<t>_org_boundary`. Backfilling onto tenant #1 keeps existing catalog/community/gifts tests green (tenant #1 owns all backfilled rows). **The boundary role list is NOT `TO authenticated` for the anon-facing subset — see §8.6.** This is its own schema build unit (§10, U4), done before per-module domain tables. The §4.3 **inverse** meta-test (c) is what guarantees this list is exhaustive: after U4, any business base table still missing `org_id` (i.e. one this list forgot) fails the build.

### 8.6 Anon-reachable tables need a `TO anon, authenticated` boundary + a slug→org path

A RESTRICTIVE `<t>_org_boundary` declared **`TO authenticated`** (the migration-26 recipe) **does not constrain the `anon` role at all** — a RESTRICTIVE policy only restricts the roles it is declared `TO`. Verified anon-reachable pre-existing tables:
- **`offerings`, `offering_tiers`** — `offerings_public_read`/`offering_tiers_public_read` are `FOR SELECT TO anon, authenticated` (`…platform_data_model` lines 132–138). Without an anon boundary, **every visitor sees every tenant's catalog** — a cross-tenant catalog leak.
- **`requests`, `request_selections`** — `FOR INSERT TO anon, authenticated` (lines 183–194); **`bookings`, `inquiries`** — `anon_insert_*` `FOR INSERT TO anon, authenticated` (`…012944` lines 60–82). Anon can insert across all tenants.

Therefore **U4 declares the boundary `AS RESTRICTIVE FOR ALL TO anon, authenticated`** on the anon-reachable tables, and — because `current_org()` is **NULL for `anon`** (no profile) — the boundary for those tables uses an **addressed-tenant** resolver. U4 adds:

```sql
-- The tenant the current PUBLIC request is addressing (host/subdomain/slug → org).
-- Set by the public site/prerender per host (SET app.addressed_org = <org>), and by
-- the SECURITY DEFINER intake RPCs from the submitted slug. NULL when no tenant is
-- addressed (direct psql / a test with no host context).
CREATE OR REPLACE FUNCTION current_addressed_org()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.addressed_org', true), '')::uuid
$$;
```

The boundary on an anon-reachable table `<t>`:
```sql
CREATE POLICY <t>_org_boundary ON <t> AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (
    org_id = current_org()                                  -- authenticated: own tenant
    OR (current_org() IS NULL AND (                         -- anon (no profile):
         current_addressed_org() IS NULL                    --   no host context → unscoped (tests/psql only)
         OR org_id = current_addressed_org()))               --   host addressed a tenant → that tenant only
  )
  WITH CHECK (
    org_id = current_org()
    OR (current_org() IS NULL AND org_id = current_addressed_org())  -- anon writes MUST address a tenant
  );
```

- **Anon reads** (public catalog): when the public site addresses a tenant (always, per host), `current_addressed_org()` scopes the read to that tenant — closing the cross-tenant catalog leak. `org_public_config(slug)` / a `SECURITY DEFINER` `public_offerings(slug)` reader remains the ergonomic entry that sets/uses the addressed org. **The `current_addressed_org() IS NULL` arm exists only for the no-host context** (direct psql, or the existing harness smoke test that reads an offering with no host set); it is unreachable from the real per-host public site, which always addresses a tenant, so it does not reintroduce a production leak.
- **Anon writes** (intake `requests`/`bookings`/`inquiries`/`request_selections`): stamped server-side by a `SECURITY DEFINER` intake RPC from the submitted slug, never client-supplied.

**Two scoping classes among the unscoped tables (this is the green-safety crux, verified against `harness.smoke.test.ts`):**

| Class | Tables | `org_id` treatment | Boundary role list | Why |
|-------|--------|--------------------|--------------------|-----|
| **A — standard** | everything in §8.5 **except** the four raw-anon-INSERT intake tables (i.e. `offerings`, `offering_tiers`, `orders`, `order_items`, `order_documents`, `payments`, `payment_notifications`, `bookings_v2`, `availability_slots`, `qualifier_answers`, and the whole community/gifts set) | `NOT NULL DEFAULT current_org()`, backfill tenant #1 | `TO anon, authenticated` for the **read-anon** subset (`offerings`, `offering_tiers`); `TO authenticated` for the rest | full migration-26 recipe |
| **B — raw-anon-INSERT intake** | `requests`, `request_selections`, `bookings`, `inquiries` | **`org_id` NULLABLE** (column present + boundary + backfill tenant #1, but **no `NOT NULL`, no `DEFAULT current_org()`**) | `TO anon, authenticated` | The existing `harness.smoke.test.ts` inserts a `requests` row **as anon with no host** (line 94). Anon has `current_org() = NULL`, so a `NOT NULL DEFAULT current_org()` column would make that untouched insert fail. Leaving `org_id` **nullable** on exactly these four tables keeps the smoke test green: the anon insert lands with `org_id = NULL`, which the boundary makes **invisible to every tenant** (a `NULL` never equals `current_org()` or `current_addressed_org()`) — no cross-tenant leak — while a **real** intake goes through the `SECURITY DEFINER` intake RPC that stamps the addressed `org_id`. |

Class **B**'s nullable `org_id` is a **deliberate, documented exception** to the `NOT NULL DEFAULT current_org()` invariant, justified solely by keeping the untouched anon-insert smoke test green; the §4.3 inverse meta-test (c) still passes because it checks the **column exists**, not that it is `NOT NULL`. U4's own test proves: an offering seeded under org A and org B is, to an anon with `app.addressed_org = A`, visible only for A; an intake RPC with slug A lands the `requests` row under org A and org B's admin cannot see it; and the raw anon `requests` insert (no host) lands `org_id NULL`, invisible to both tenants' admins. The existing smoke test's two anon behaviors (reads the one seeded offering; inserts a request an admin then reads) stay green because that admin is org #1 and the seeded/back-filled rows are org #1.

For authenticated users the boundary behaves exactly as before (`org_id = current_org()`). This closes both (a) the anon cross-tenant catalog leak and (b) the broken prerendered public-site catalog read that a bare `TO authenticated` boundary would cause. It is **launch-blocking** and is U4's responsibility, not covered by the copied migration-26 recipe.

> **Wait — does the org-#1 admin still read the anon-seeded offering in the smoke test?** Yes. `harness.smoke.test.ts` seeds the offering **as superuser** (line 77–79); after U4 its `org_id` defaults to `current_org()` = the GUC = org #1. The anon read (line 82–84) has no `app.addressed_org` set → the `current_addressed_org() IS NULL` read arm admits it → still visible. Both existing assertions hold.

---

## 9. Push-button `provision_tenant()`

**One SECURITY-DEFINER RPC, SUPER_ADMIN-only** (`IF NOT is_super_admin() THEN RAISE`), running in **one transaction** so a tenant is either fully born or not at all. It is the **only** blessed path to a new org (mirroring how `create_purchase_engagement` is the only path to a purchase). Personalization is entirely seeded registry rows; the code is identical across tenants.

```
provision_tenant(
  p_name text, p_slug text, p_tier_key text, p_admin_email text,
  p_brand jsonb DEFAULT '{}', p_legal jsonb DEFAULT '{}', p_rates jsonb DEFAULT '{}',
  p_modules text[] DEFAULT NULL   -- explicit add-ons beyond the tier
) RETURNS uuid   -- the new org_id
```

Steps, all inside the txn:
1. **Create org.** `INSERT organizations(name, slug, status)` → `v_org` (ORG- display code via existing trigger; slug uniqueness enforced). Then `SET LOCAL app.current_org = v_org` so every `DEFAULT current_org()` and boundary check resolves to the new tenant **before any user exists** — the exact seed/service seam migration 26 built (`current_org()` falls back to the GUC when `auth.uid() IS NULL`).
2. **Seed the value registry.** `business_config` typed row from `p_legal` + `p_rates`; `config_values` rows from `p_brand` (`BRAND.*`/`CONTACT.*`) and module knobs. Every value nullable/overridable, seeded from the tier's defaults; an unfinished tenant still boots.
3. **Seed entitlements.** Expand `p_tier_key` (via `tier_modules`) + `p_modules` into `org_modules` rows (`source='TIER'`/`'ADDON'`) so `has_module()` lights up exactly the paid surfaces.
4. **Clone the tier's default catalog.** Copy default `products`/`product_prices` into `org_id = v_org` so the tenant has a working product/pricing surface day one. **Do NOT seed a per-horse "100% owner" `cost_allocation_rule`** — the payer split derives from `horse_parties` (§7.7), so a blanket 100%-owner override would silently bill a *leased* horse entirely to the owner. At most, seed a single **`default`/barn-scoped** `cost_allocation_rules` fallback row (the payer for consumption events on horses that have no `horse_parties` rows yet). **Ordering:** `cost_allocation_rules` is a `mod.barnops` (U11) table, so this fallback seed can only run once U11 exists. Rather than force a U6→U11 dependency (which would invert the natural core-before-modules order and create a cycle, since U11 depends on U5 which U6 also depends on), the barnops-starter seed is **conditional and deferred**: `provision_tenant` seeds it **only inside `IF to_regclass('public.cost_allocation_rules') IS NOT NULL AND has-barnops THEN …`**, so U6 applies and tests green **before** U11 exists (the block is simply skipped), and once U11 has shipped, provisioning a barnops tenant seeds the fallback. U6 therefore `dependsOn` only U2/U3/U5 (its hard table deps), and the conditional guard removes the omitted-ordering hazard the review flagged.
5. **First ADMIN.** The `/api/admin-provision-tenant` function creates the auth user via the Supabase Auth API (**idempotent find-or-create by email**, mirroring `ensure_contact_for_profile`), then this RPC `INSERT profiles(user_id, email, role='ADMIN', org_id=v_org)`; the existing profiles→contact trigger binds identity.
6. **Audit + return.** Emit an `audit_logs` row (action `PROVISION_TENANT`) and `RETURN v_org`.

**Result:** a working branded site + member app with **zero code changes** — the public site/app resolve slug/subdomain → `org_id` and read brand/contact/pricing from the registry; the contract engine merges `{{ORG.*}}` from seeded config; enabled modules light up in nav via `org_modules`.

**Maturity path.** Assisted onboarding first (operator calls `/api/admin-provision-tenant`). Self-serve later is the **same RPC** behind signup + billing (chosen tier + a branding wizard's output as `p_brand`), no rearchitecture because personalization was always data.

**Orphan-safety.** Auth-user creation happens in the `/api` function outside the RPC transaction; a failure between auth-user creation and the profiles insert can orphan a user. The `/api` function is **idempotent** (find-or-create by email) and the RPC re-runnable.

**Billing seam (designed, deferred build).** `org_subscriptions(org_id, tier_key, status, stripe_customer_id, stripe_subscription_id, current_period_end)` + `subscription_events`; a Stripe-webhook path (extending `/api/stripe-webhook`) maps `price → tier → org_modules`. Because entitlement resolution reads `org_modules` regardless of source (`TIER/ADDON/GRANT/SUBSCRIPTION`), comped/assisted tenants and paying subscribers share **one** enforcement path; enabling billing is additive.

---

## 10. Additive-migration numbering plan

All new migrations are numbered **after** `20260629190000`, applied in lexical order, each reversible in spirit and green after each step. Numbering scheme: `20260630HHMMSS_<name>.sql` (the day after the last existing migration), monotonic. Each schema migration ships with **its own test file** under `test/db/`.

| # | Migration file | Builds | Type |
|---|----------------|--------|------|
| 1 | `20260630000000_generate_document_org_fix.sql` | **First, isolation-critical.** `CREATE OR REPLACE generate_document` with `WHERE org_id = current_org()` + `{{ORG.*}}` namespace + `{{FHE.*}}` alias; add `{{ORG.PHONE/EMAIL}}` + `{{FHE.PHONE/EMAIL}}` token rows. | schema |
| 2 | `20260630010000_entitlements.sql` | `modules`, `tiers`, `tier_modules`, `org_modules`, `has_module()`, `require_module()`, boundary on `org_modules`; seed the module catalog + tiers + `tier_modules`. | schema |
| 3 | `20260630020000_value_registry.sql` | `config_values`, `config_keys`, `config_value()` (**SECURITY DEFINER**), `org_public_config(slug)`; boundary on `config_values` (no `module_gate`); seed `config_keys` + FHE (tenant #1) `BRAND.*`/`CONTACT.*` rows from `brand.ts`. **Also `CREATE OR REPLACE generate_document`** to add the `CONTACT`-backed `{{ORG.PHONE/EMAIL/URL}}`+`{{FHE.*}}` arms (now that `config_value()` exists) — the deferred half of the U1 de-specification (§6.2). | schema |
| 4 | `20260630030000_platform_catalog_org_scope.sql` | Org-scope **the full §8.5 unscoped set** (booking/intake + commerce + community + gifts — the exact grep-derived list). Class A: add `org_id` → backfill tenant #1 → NOT NULL → DEFAULT → boundary; anon-read subset (`offerings`,`offering_tiers`) boundary `TO anon, authenticated` + `current_addressed_org()`. Class B (`requests`,`request_selections`,`bookings`,`inquiries`): nullable `org_id` + boundary (green-safe for the anon-insert smoke test). Adds `current_addressed_org()`. §8.5–§8.6. | schema |
| 5 | `20260630040000_products_billing.sql` | `products`, `product_prices`, `billable_lines` (core); boundary (+ `module_gate(module_key)` on `products`); audit + soft-delete; append-only-after-settle on `billable_lines`. | schema |
| 6 | `20260630050000_provision_tenant.sql` | `provision_tenant()` + `set_org_module()`; seed `tier_modules` defaults; audit action. | schema |
| 7 | `20260630060000_mod_brokerage.sql` | `engagement_stages`; **global `template_variants` (no `org_id`)**; `require_module('mod.brokerage')` guards on **all three** brokerage RPCs (`create_purchase_engagement` via `CREATE OR REPLACE`, `create_search_engagement`, `create_lease_engagement`); register directional variants. `engagement_stages`: boundary + `module_gate('mod.brokerage')`. | schema |
| 8 | `20260630070000_mod_lessons.sql` | `lesson_packages`, `lesson_credits`, **`lesson_bookings`** (in-module scheduling surface credits are consumed against). Boundary + `module_gate('mod.lessons')`. | schema |
| 9 | `20260630080000_mod_horserecords.sql` | `horse_parties`, `horse_health_events`, `caller_owns_horse()`. Boundary + `module_gate('mod.horserecords')`. | schema |
| 10 | `20260630090000_mod_boarding.sql` | `facilities`, `stalls`, `board_agreements`, `board_charges`. Boundary + `module_gate('mod.boarding')`. | schema |
| 11 | `20260630100000_mod_barnops.sql` | `resources`, `resource_lots`, `consumption_events`, `cost_allocation_rules`, `resolve_consumption_billing()`. Boundary + `module_gate('mod.barnops')`; append-only on `consumption_events`. | schema |
| 12 | `20260630110000_mod_employees.sql` | `staff_profiles`, `shifts`, `time_entries`, `service_assignments`. Boundary + `module_gate('mod.employees')`. | schema |
| 13 | `20260630120000_new_storage_buckets.sql` | `inventory-docs`, `horse-health`, `brand-assets` buckets + `org_id`-prefix policies. | schema |
| 14 | `20260630130000_audit_gate_meta.sql` | **Sole audit-attachment site:** add ALL new business tables to a fresh audit `business_tables` `DO`-loop (no module unit attaches its own). `dependsOn` every domain unit so all tables exist. | schema |
| 15 | `20260630140000_billing_rollup.sql` | **U17 — settlement roll-up (closes "cost_allocations reach invoices").** `settle_billable_lines(payer, period)` rolling settled `billable_lines` into one `transactions` INVOICE row; additive `transactions` alterations (relax `engagement_id` NOT NULL; extend `txn_type` CHECK to add `INVOICE`; add `payer_contact_id`/`period`). §7.11. | schema |

**Numbering rule for builders:** claim the next unused `20260630HHMMSS` slot; never renumber an existing file; never edit migrations `≤ 20260629190000`. **U13 (storage buckets) keeps slot `…120000`; it is independent and may apply before or after U14/U17 (no shared objects), but for a stable lexical order it stays at `…120000`, U14 at `…130000`, U17 at `…140000`.**

---

## 11. Testing contract

- **Harness reuse.** The existing PGlite harness (`test/db/harness.ts`) `asUser({role, org})` + `createAuthUser({role, org})` applies unchanged. New tables are born under the same invariants.
- **Per-table isolation + gate test.** For each new table, a test asserts: (a) org B cannot **see** org A rows; (b) org B cannot **INSERT** into org A (WITH CHECK); (c) `org_id` **defaults** to the caller's tenant; and for module tables (d) a **module-off** org sees **zero** rows and **cannot insert** even as ADMIN.
- **Second-tenant proof.** Extend the isolation suite to provision a second tenant with a **different tier** (e.g. `tier.boarding`: boarding + barn_ops, **not** brokerage) and confirm: it sees only its data; its `generate_document` renders **its** `{{ORG.*}}`/brand (not FHE's); brokerage tables/RPCs are **denied** by `has_module`/`require_module`. **Note:** the existing `tenant_isolation.test.ts` already creates org 'Rival Stables' with slug `'rival'` — a provisioning test must use a **different slug** (e.g. `'boarding-barn'`) to avoid the unique-slug collision.
- **CI meta-tests (`rls_meta_coverage.test.ts`, U14).** The five assertions of §4.3: (a) boundary present + RESTRICTIVE for every `org_id` table; (b) every module-owned table's `_module_gate` is RESTRICTIVE; **(c) INVERSE — every business base table HAS an `org_id`** (against the intended-global allow-list), so a forgotten `org_id` fails the build; **(d) the entitlement/registry substrate carries NO `_module_gate`** (recursion guard); (e) every business table has an audit trigger.
- **Determinism tests (ledger).** Mirror the `generate_document` tests: `resolve_consumption_billing()` is re-runnable/idempotent; the split **derives from `horse_parties`** by default with `cost_allocation_rules` as an explicit override; shares sum to 100 (or remainder → barn/default); an uncovered event routes to a default line, never dropped.
- **Settlement roll-up test (U17).** `settle_billable_lines()` rolls settled `billable_lines` into exactly one `transactions` INVOICE (`amount = SUM`), stamps each line `SETTLED`+`transaction_id`, is idempotent (no double-invoice), and seals the lines. The full **consumption → cost-allocation → billable_line → transaction** chain is a §15 critical-chain end-to-end test.
- **No-orphan-token test (extended).** Every token used by any active template resolves for every active tenant. **Scoped to tokens that actually appear in bodies** — today `{{FHE.SIGNATORY_NAME/TITLE}}` (driven by `business_config.signatory_name` set distinct per org); `{{ORG.*}}`/`{{FHE.PHONE/EMAIL}}` are asserted only where a body/per-template row uses them (none today), never assumed to merge from a global dictionary row.
- **Green gate.** After each schema migration, run the full suite before adding the next. The **168 existing tests (165 DB + 3 UI-harness)** and all 26 migrations stay green; `typecheck` (app + api), `lint`, `build` + prerender stay green.
- **Wiring & Verification Contract (§15) is the definition-of-done.** Every unit's real-path data test, UI-interaction test (frontend), static dead-end audit, independent-skeptic trace, and critical-chain end-to-end test are mandatory, not optional. See §15; every unit's `tests` field conforms to it.

---

## 12. Frontend seam (integration units — run serially, last)

These edit **shared** files, so they are `integration` units that depend on the schema units and run **serially at the end** — never parallelized.

- **`src/lib/api.ts`** — add `myModules()`, `orgPublicConfig(slug)`, `configValue(ns,key)`, `provisionTenant(...)` wrappers; `src/lib/brand.ts` gains a runtime fetch path (keep the constant as the FHE fallback so prerender stays green).
- **`AuthContext.tsx`** — extend the profile select to surface `app_role()`, `org_id`, and the resolved **module set** (`my_modules()`), so nav/routes can gate on modules/role. (Today it reads only the legacy `is_admin` boolean and surfaces neither role, org, nor entitlements — this bridge must land with the entitlement layer or nav gating silently no-ops.)
- **`BrandProvider`** (new `src/contexts/BrandProvider.tsx` + a `useBrand()`/`useModules()` hook) — reads `org_public_config` and provides tenant brand + active modules to the member app. New files (parallel-safe) but wired in via `App.tsx` (integration).
- **`App.tsx` / `AppLayout` nav** — `ProtectedRoute` and the NAV array gain module/role predicates from `useModules()`. Integration (shared files).
- **First-cut scope:** member app + contracts (data plane). Multi-tenant **public** prerender (slug→org at build/hydration) is a follow-on so the green prerender build stays intact; the SPA reads the tenant registry at runtime.
- **`/api/admin-provision-tenant.ts`** (new) — thin idempotent wrapper: find-or-create the ADMIN auth user, then call `provision_tenant()`. New file; `package.json`/routing touches are integration.

**UI test harness (already built — U15/U16 use it, do not rebuild it).** `src/test/render.tsx` exports `renderWithRouter`/`screen`/`userEvent`; `src/test/ui-setup.ts` registers jest-dom + auto-cleanup; `src/test/harness.smoke.test.tsx` is the reference pattern (dead-button, no-op-form, correct-args, success/error branches). Every UI test file **starts with `// @vitest-environment jsdom`**. Per `render.tsx`, **`AuthContext` is not exported**, so a UI test that needs a logged-in user with modules **mocks `useAuth`** (`vi.mock('../contexts/AuthContext', …)`) or mocks the supabase client — the entitlement-gated nav/route tests in U15 mock `useModules()`/`useAuth()` to render the gated and un-gated states. These are the **3 existing UI-harness tests** in the 168 count; U15/U16 add more, all additive.

**Shared-file serialization (collision safety).** `src/lib/api.ts` is edited by **both** U15 and U16. U16 `dependsOn ['U6','U15']`, so it runs **after** U15 and appends to the U15 baseline of `api.ts` — no concurrent write. The runner MUST honor `dependsOn` for ordering (it is the only collision guard for shared files; there is no separate file-lock). All `integration`-type units are serial and last (§7 principle); no two run in parallel on a shared file. Each schema unit touches **only its own new migration file** and its own new tables — no schema unit re-`ALTER`s a migration-26 table (U4 is the single re-scoping site; U17 is the single `transactions`-alteration site).

---

## 13. Risks & mitigations (carry-forward)

1. **`generate_document` `LIMIT 1` + hardcoded FHE** is an **active** cross-tenant leak vector today (in BOTH the migration-18 and the authoritative migration-22 copies). Fixed in **migration #1** by keying the config read off **`v_eng.org_id`** (NOT `current_org()`, which follows the session GUC for `SECURITY INVOKER` service-role callers), before any second tenant is provisioned. Highest priority.
2. **Pre-existing catalog + community/gifts lack `org_id`.** The **full** grep-derived set (§8.5) is org-scoped in **migration #4**; anon-reachable tables get a `TO anon, authenticated` boundary + `current_addressed_org()` (§8.6); the four raw-anon-insert intake tables keep `org_id` nullable to preserve the untouched anon-insert smoke test. The §4.3 inverse meta-test guarantees the list is exhaustive.
3. **EAV typo → NULL for a legal/financial value.** Mitigated by `config_keys` (allowed namespaces/keys + expected type) and a go-live completeness check.
4. **A gate written PERMISSIVE by mistake** would OR into access and widen visibility. CI meta-test asserts each `_module_gate` is **RESTRICTIVE**; a further meta-test asserts the entitlement/registry substrate carries **no** `_module_gate` (recursion guard).
5. **Policy recursion via the gate.** `has_module()`/`config_value()`/`current_org()` are **`SECURITY DEFINER`** search_path-pinned and the substrate (`org_modules`/`config_values`/`business_config`/`modules`/`tiers`/`tier_modules`) carries no `module_gate`, so gate/boundary evaluation never recurses. Hot-path cost stays low: STABLE + single-row indexed lookups on `org_modules(org_id,module_key)` and `config_values(org_id,namespace,key)`.
6. **Horse org→org move** has no v1 path; a deliberate audited transfer RPC later, never a boundary relaxation.
7. **Provisioning orphan** between auth-user creation and profiles insert; the `/api` function is idempotent (find-or-create by email) and the RPC re-runnable. U6 seeds no bogus 100%-owner cost rule; barnops fallback seed is conditional on U11 existing.
8. **Tier edits don't retroactively re-entitle** existing tenants (grandfathering is deliberate); a future `reconcile_tier(org)` helper if needed. Document so operators don't expect it.
9. **`business_config` must stay a table** (not a view): converting it would break `business_config%ROWTYPE` in `generate_document` and the migration-14 singleton test. The registry generalizes **beside** it via `config_values`, not by replacing it. Note it has **no phone/email column** — those live in `config_values` ns `CONTACT` (U3), which is why any `{{ORG.PHONE/EMAIL}}` token depends on U3.
10. **Split duplicated between `horse_parties` and `cost_allocation_rules`.** Resolved: `resolve_consumption_billing()` derives the split from `horse_parties` (effective-dated) as the default; `cost_allocation_rules` is an explicit override only — one source of truth for the split.
11. **`billable_lines` never reaching invoices.** Resolved by **U17** (`settle_billable_lines` → one `transactions` INVOICE), completing the consumption → cost-allocation → billable_line → transaction chain.
12. **`template_variants` isolation ambiguity.** Resolved by modeling it **global (no `org_id`)** like `contract_templates`; tenant overrides go in a separate `org_template_overrides` table, keeping the §4.3 meta-test clean.
13. **`create_purchase_engagement` ungated while siblings gated.** Resolved: U7 adds `require_module('mod.brokerage')` to all three engagement RPCs (additive `CREATE OR REPLACE`); FHE has the module so `purchase_flow.test.ts` stays green.
14. **Lessons credit-consumption orphan.** Resolved by an in-module `lesson_bookings` scheduling surface with an optional (nullable) `mod.employees` instructor link, so a lesson-only tenant can consume credits without `mod.employees`.
15. **"Done" claimed without proof.** Resolved by the **§15 Wiring & Verification Contract** — real-path data tests, UI-interaction tests, static dead-end audit, independent skeptic, and critical-chain end-to-end tests as the definition-of-done in every unit's `tests`.

---

## 14. Conflict resolutions (how the three proposals were merged)

| Conflict | Resolution |
|----------|------------|
| `business_config`: keep typed table (P1, P2) vs. make it a VIEW over `org_values` (P3) | **Keep the typed table**; add `config_values` EAV **beside** it. P3's view would break `%ROWTYPE` + the singleton test. |
| Value registry table name: `config_values` (P1) vs. `org_values` (P2/P3) | **`config_values`** with `(namespace, key, value_text/num/json)` — P1's typed-column-aware shape + a `config_keys` guard. |
| Engagement staging table: `engagement_modules` (P3) vs. `engagement_stages` | **`engagement_stages`** (avoids the word "module" colliding with the entitlement `modules`/`org_modules` vocabulary). |
| `billable_lines` placement: per-module (P1) vs. core universal primitive (P2/P3) | **Core** (`core.payments`); board/lessons/consumption all emit into it, tagged by `source_kind`. |
| Cost-allocation table name: `cost_allocations` (P2) vs. `cost_allocation_rules` (P1/P3) | **`cost_allocation_rules`** (it is the policy, not the output). |
| Resolver name: `resolve_consumption_costs` (P1) vs. `resolve_consumption_billing` (P3) | **`resolve_consumption_billing`** → emits into the core `billable_lines`. |
| Module-key naming: dotted `mod.brokerage` (P1) vs. flat `brokerage_contracts` (P2) vs. `MOD_*` (P3) | **Dotted `core.*` / `mod.*`** (namespaced, sorts cleanly, reads as data). |
| Provisioning signature | Merged: `provision_tenant(p_name, p_slug, p_tier_key, p_admin_email, p_brand, p_legal, p_rates, p_modules)` — P1's structured jsonb seeds + P2/P3's tier expansion. |
| Storage org-prefix | Adopted (P1): `org_id` as leading path segment on new buckets. |
| `generate_document` config scope: `current_org()` vs `v_eng.org_id` | **`v_eng.org_id`** — `generate_document` is `SECURITY INVOKER`; for a service-role/BYPASSRLS caller `current_org()` follows the session GUC, not the target engagement, so it would leak. Key off the engagement row. |
| `template_variants` isolation: nullable `org_id` vs global | **Global, no `org_id`** (like `contract_templates`); tenant overrides in a separate `org_template_overrides`. A nullable `org_id` breaks the standard boundary and the meta-test. |
| Cost split source: `cost_allocation_rules` vs `horse_parties` | **`horse_parties` is the single source** (effective-dated); `cost_allocation_rules` is an explicit override layer only. Removes duplication/drift. |
| `billable_lines` → invoice | **New unit U17** `settle_billable_lines()` rolls settled lines into one `transactions` INVOICE. Previously unbuilt. |
| Brokerage gating of `create_purchase_engagement` | **Gated** by `mod.brokerage` for consistency (U7 `CREATE OR REPLACE` adds `require_module`), not left as an ungated core path. |
| Audit-trigger attachment ownership | **U14 is the sole site**; module units do not attach their own (avoids double-attach). |

**End of canonical architecture.** Downstream builders: obey §8 for every table, §10 for numbering, §11 for tests, and **§15 for the definition-of-done**. Keep everything additive and green.

---

## 15. Wiring & Verification Contract

> This section is the owner's **#1 requirement**, encoded verbatim as a top-level policy of this document **and** as the definition-of-done in every unit's `tests` field. The owner has been repeatedly burned by projects claiming "done" when buttons are dead, forms don't submit, or data is wired to the WRONG table. **"Done" is EARNED WITH AN EXECUTABLE PROOF, never asserted.**

**WIRING & VERIFICATION CONTRACT** (the owner's #1 requirement — encode it as a top section of the doc AND as the definition-of-done in every unit's tests field). The owner has been repeatedly burned by projects claiming "done" when buttons are dead, forms don't submit, or data is wired to the WRONG table. "Done" is EARNED WITH AN EXECUTABLE PROOF, never asserted. Every build unit must satisfy, as applicable:

**(1) REAL-PATH DATA TEST (no mocks at the seam):** a PGlite test that invokes the ACTUAL RPC / data path the app uses, as the CORRECT RLS role, and asserts the row lands in the RIGHT table with the RIGHT columns and reads back. This is what catches "wired to the wrong location" and "data lost".

**(2) UI-INTERACTION TEST for any frontend unit:** use the ALREADY-BUILT jsdom harness (`src/test/render.tsx` -> `renderWithRouter`/`screen`/`userEvent`; setup at `src/test/ui-setup.ts`; pattern at `src/test/harness.smoke.test.tsx`). Render the real component, fire the real click/submit, assert the real handler calls the real data function WITH THE CORRECT ARGUMENTS, and that success AND error branches render. Kills dead buttons / no-op forms. UI test files start with the docblock `// @vitest-environment jsdom`.

**(3) STATIC DEAD-END AUDIT:** no empty/no-op `onClick`, no form without `onSubmit`, no handler that only `console.log`/`alert`, no exported api fn never imported, no RPC defined-but-never-called, no TODO/placeholder stub, no swallowed errors.

**(4) INDEPENDENT SKEPTIC:** a verifier that did NOT build the unit must be able to confirm via the executable trace; builder self-certification is not accepted.

**(5) CRITICAL CHAINS get a full end-to-end test** (provision-tenant; intake->engagement->generate->sign->EXECUTED->deliver->email; payment->mark-paid->confirm; consumption->cost-allocation->billable_line->transaction).

**Also:** the existing 26 migrations and 168 tests (165 DB + 3 UI-harness) must stay green; everything additive.

### 15.1 How each unit type discharges the contract

- **`schema` units** discharge **(1)** with a `test/db/*.test.ts` that calls the real RPC/data path as the correct role (`asUser`/`asAnon`/`asServiceRole`) and asserts the row is in the right table/columns and reads back; **(3)** by grepping the migration for defined-but-never-exercised RPCs and by the §4.3 meta-tests; **(4)** because the PGlite trace is re-runnable by anyone; **(5)** for the units on a critical chain (U1, U6, U11, U17, U14 end-to-end). Schema units have no UI, so **(2)** is N/A.
- **`integration` units** (U15, U16) discharge **(2)** with jsdom UI-interaction tests (real component, real click/submit, correct args, success+error branches) using the already-built harness, **(1)** by asserting the api wrapper calls the real RPC (against a mocked supabase client asserting the exact RPC name + args, since the browser has no PGlite), **(3)** via the static dead-end audit (no dead `onClick`, no `onSubmit`-less form, no unimported exported api fn, no defined-but-uncalled RPC), **(4)** via the executable UI trace, and **(5)** for provision-tenant they add the end-to-end `/api` → `provision_tenant` → login → gated nav test.

### 15.2 The four critical chains and their owning tests

1. **provision-tenant** — `/api/admin-provision-tenant` (U16) → `provision_tenant()` (U6) → org + registry + `org_modules` + ADMIN profile; assert the tenant boots, `has_module()` matches the tier, and a login sees the gated nav (U15). Re-runnable by email (idempotent).
2. **intake → engagement → generate → sign → EXECUTED → deliver → email** — the contract engine end-to-end: a public intake (anon, addressed tenant, §8.6) → engagement → `generate_document` (U1, keyed to `v_eng.org_id`) → `record_signature` ×N → `documents.status = 'EXECUTED'` → `document_deliveries` → email. Asserts `{{ORG.*}}`/`{{FHE.SIGNATORY_NAME}}` render the ADDRESSED tenant's identity, never another's.
3. **payment → mark-paid → confirm** — the existing Stripe/Zelle reconcile path stays green; any new billing surface asserts the transaction reaches PAID and the confirmation renders.
4. **consumption → cost-allocation → billable_line → transaction** — `consumption_events` (U11, append-only) → `resolve_consumption_billing()` splitting per `horse_parties` (default) / `cost_allocation_rules` (override) into `billable_lines` per payer → `settle_billable_lines()` (U17) rolling settled lines into a `transactions` INVOICE. This is the mandate's explicit "cost_allocations reach invoices" example, now fully wired and end-to-end tested.

**End of Wiring & Verification Contract.**
