# DASHBOARD ENGINE CONTRACT — dashboards · elements · per-account provisioning · reports

**STATUS: STABLE** (2026-09-03) — was DRAFT; flips to `STABLE` in this file's header and in `docs/reports/FHE-TASK-DASHBOARDS-A-LEDGER.md` (`CONTRACT: STABLE @ <commit>`) the moment a consumer could build against it without a name moving. After STABLE, anything that moves is listed under `## CHANGES` at the foot; consumers re-read.

**Authored 2026-09-03 by `FHE-TASK-DASHBOARDS-A` (DSNR profile, bundle B7 `docs/orch/BUNDLE-DASHBOARDS.md`).** Requirements: `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-107 and §CR-112·A1 **#11, #12, #13** (verbatim there; this file does not paraphrase them into new requirements). Every number below was measured on production (`lrstswfxfsezdmvkvukc`) on 2026-09-03 by the query shown, read-only.

**Who reads this:** B5 SUPPLIES (its dashboard, projections, deviations and monthly report are the first consumers — see §9), HOMESHAPES (a member's home is a dashboard under this engine — §3.4), and every later bundle that puts a number or a work item on a board or into a report. **What this file does NOT decide:** the content of any particular dashboard (which elements Sales holds, what the supplies dashboard shows) — that is each consumer's spec, and for the owner boards it is the owner's list (escalation 2).

---

## 0. THE OUTCOME (the ledger, quoted — do not paraphrase)

> One engine, global and plug-and-play: dashboards are declared, elements are registered with their inputs and display variants, each ACCOUNT is provisioned its set of dashboards from a tenant default and its changes stay on the account, the selector on the dashboards page decides which dashboards each owner account can reach (access, not arrangement — allowed under D13's exception), the board self-arranges (no per-zone editor — ruled out), and a "monthly report" button generates an idempotent report — snapshot of that user's dashboard + explicit figures + per-entity statement + business snapshot — into BOTH owner accounts in their variants, stored where a company "my documents" page (shared by both owners, never co-mingled with client documents) lists it, emailed on request, as PDF/CSV/both, renamed "outdated" when backdated data arrives and "superseded"+archived on regeneration. B5's supplies dashboard, projections, deviations and report are the first consumers; a client's home (HOMESHAPES) is a later one. FIX6's held-views SET and view families are the provisioning model, with its build order (Sales/Marketing → STOP for Claire's list → Admin → Ops composed last) preserved in the chunk sequence.
> — `docs/tasks/TASK-DASHBOARDS-A-shape-the-dashboard-engine.md` §3

---

## 1. THE INCUMBENTS THIS CONVERGES (D18) — measured 2026-09-03

| Incumbent | What it is today | Fate under this contract |
|---|---|---|
| `src/lib/dashboard/registry.ts` — `DashboardView = 'trainer' \| 'business'`, `ZONES: ZoneDef[]` | **17 registry rows, 16 distinct keys** (N1 registered twice), 11 rows `trainer`, 6 rows `business` (`grep -c "{ key:" registry.ts` = 17; B6 removed 2026-08-31). Zones self-hide at count 0; header links are THE REACH; `to?` optional. | **KEPT and WIDENED.** Becomes the DASHBOARD registry + the ELEMENT registry (§2, §3). Every existing zone becomes an element by adapter; no zone is rewritten. `DashboardView` widens from a two-value union to the set of registered dashboard keys — `'trainer'` and `'business'` survive as keys (stored in `profiles.dashboard_focus`; renaming a stored value broke nine surfaces in LIFECYCLE). |
| `profiles.dashboard_focus` + `profiles_dashboard_focus_chk` `CHECK (… = ANY ('trainer','business'))` | Live: `admin@fhequestrian.com` → `business`, `hello@fhequestrian.com` → `trainer` (query in §4.1). Written only by `set_dashboard_focus(p_user_id, p_focus)` (self-or-admin, org-bounded); called only from `TeamPage.tsx` via `api-dashboard.ts:341`. | **RETAINED as the LANDING PREFERENCE** ("which held dashboard do I open on") — a different fact from "which do I hold" (FIX6 §2b; do not overload one column with both). The CHECK is **replaced** by validation inside `set_dashboard_focus` against the provisions table (§4) in the same migration that seeds the two live rows' provisions — subtractive change sequenced with its data, NOSTRIP. |
| `sessionStorage['fhe.dashboard.view']` (`OwnerDashboard.tsx:62`) + `ViewToggle` (`DashboardChrome.tsx`) | The session's chosen view; two-way "Show X's Dashboard" peek button; never writes the stored default. | **KEPT as the session memory; the two-way toggle becomes the CYCLER** over the held set (§4.3). One element throughout; when an account holds exactly one dashboard it renders nothing. |
| `instructor_surface_grants` (`org_id, user_id NULL=org-wide, nav_key, created_by, created_at`; RLS `isg_admin` write, `isg_read` self-or-admin; 8 rows) + `src/lib/grants.ts` + the Team page grants panel | The one per-ACCOUNT access-provisioning idiom in the app: a row is a grant, `user_id NULL` is the org-wide default. | **THE SHAPE IS REUSED, THE TABLE IS NOT** (its name, its reader `fetchMyGrantKeys` and its `adminOnly` semantics are about nav surfaces). `dashboard_provisions` (§4.1) copies its column shape and its two policies exactly. |
| `dash_*` reader RPCs — 22 functions (`SELECT proname FROM pg_proc WHERE proname LIKE 'dash\_%'`), all `SECURITY DEFINER`, `proacl = {postgres,authenticated,service_role}` (no `anon` — good), each returning `{count, items}` | The per-zone readers; the `api-dashboard.ts` seam wraps each in one function. | **KEPT unchanged.** Each is an element's `source` via the zero-arg adapter (§3.3). New elements use the parameterised signature (§3.3). |
| `_waiting_items()` (SQL, 9,640 chars, `side ∈ {'you','client'}`, ranked) + `dash_waiting_on_you()` / `dash_waiting_on_clients()` (376/379 chars, thin wrappers) | Live in production, **no caller in `src/`** (DB-MAP), **no migration on `main` creates them** (applied from the unmerged `b9bc9edc` WaitingZones branch; `grep -rl _waiting_items supabase/migrations` = 0). | **RETIRED IN PLACE (D32: left, never dropped; not registered).** Decided against reuse for two reasons that outrank "it is already written": (1) **D18** — every fact its UNION reads (declared payments, failed receipts, proposals, open changes, unsent/unsigned documents, failed invitations, open deals) is ALREADY read by a registered element with its own reader (C3, B1, B3, C9, B9), so registering it would be a second read path beside five correct ones; (2) **DASHFEED §3, the half-measure rule** — its rows are generic `(title, who, detail, link)` and carry no act (no Confirm, no Accept), so an element over it would announce work and send the reader elsewhere. Its one real idea — `side='you'|'client'` is the YOURS · THEIRS ask-axis — survives as `ElementDef.ask`, declared by every action element (§3.2), and the composed Ops board clusters by it (§4.3). **No migration is landed for it**; if a later thread wants it, `docs/reference/DB-MAP.md` and `b9bc9edc` say where it came from. |
| `dash_activity_readback(p_limit)` | Retained in the DB; its surface was removed 2026-08-31 (`docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md` — four conditions, all required). | **NOT registered as an element.** Wrapping it in an element meets none of the four conditions (meaningful entries, reachable records, actor shown, scoped). It stays retained; a future element may earn it back by meeting all four — this contract does not. |
| `files` / `file_links` (TASK-UPLOADS) — `files.owner_kind ∈ {'contact','org'}`, `owner_shape` CHECK, path grammar `{org}/{owner_kind}/{owner_id}/{file_id}-{name}`, bucket default `facility-files`; `file_links.subject_type` CHECK lists 14 kinds incl. `'org'`; RLS `files_staff_rw`, `files_owner_rw`, `files_org_published_read`, RESTRICTIVE org boundary on both. Live: 2 files (org-owned walk4 test photos), 2 links (`booking`). | The only file spine; "My Files" (`FilesContent.tsx`, account) and Records → Files (`FilesRecordsPage.tsx`, staff) read it. | **THE REPORT SINK for bytes.** A report's PDF/CSV is a `files` row with `owner_kind='org'` in `facility-files` (§7.2). No new bucket (the empty `reports` bucket that already exists is left alone, D32 — it has no storage policies and `facility-files` already has the staff ones). |
| `documents` (81 EXECUTED · 2 DRAFT · 1 AWAITING_SIGNATURE; `display_code` `DOC-…`) + `my_documents()` | The contract-document spine. ⚠️ **FROZEN under the signing freeze.** `my_documents()` is `proacl` `{=X, anon=X, authenticated=X, …}` — anon-executable (out of this bundle's scope; noted for VRFY of whoever owns it). | **A report is NEVER a `documents` row.** The company documents page (§7.5) reads `documents` only where the company is a party — a read, no column. |
| `assign_display_code()` trigger + a sequence per prefix | How every coded record gets `PREFIX-000001`. | **Reused** for `reports.display_code` (`RPT-`). |
| `config_keys` / `config_values` + `config_value(namespace, key)` (the value registry; `ORG`, `BRAND`, `CONTACT`, `PROPERTY` namespaces; editor: `AdminBrandingPage.tsx` via `api-admin.ts`) | Tenant-level, owner-editable scalar configuration. | **Reused for engine-level tenant settings** (§5.2, §7.4): `OPS.TIMEZONE`, `DASHBOARDS.SHOW_EMPTY`, `REPORTS.NAME_TEMPLATE`. Adding a key = a `config_keys` row + the editor page listing it (D13 — the chunk that adds a key widens the editor or names the follow-up). |
| `lookup_options` (`lookup_key, code, display_name, active, sort_order`; 5 keys live) + `add_lookup_value` (hardcoded allowlist; a new key is add-locked until widened — repo memory 2026-08-27, three places) | Owner-editable vocabularies. | **Reused for the engine's small vocabularies** (§5.1: `dashboard_period`; §3.4: `display_variant` **labels** only — the variant KEYS are code because a renderer must exist for each). The chunk seeding a key names the three allowlists it widens. |
| `src/lib/documentPdf.ts` (`renderDocumentPdf(title, body)`, `pdfFileName`, `downloadDocumentPdf`) + `api/_lib/documentPdf.ts` (same, server) — pdf-lib, pure JS | The PDF renderer the contract system uses. | **THE REPORT PDF RENDERER** (§7.3). A report body is composed as the plain-text section grammar this renderer already lays out (numbered headings, blank-line sections). No HTML renderer, no headless browser. |
| `revenueLinesToCsv` (`src/lib/ops/api-payments.ts:447`) + the Download CSV control (`PaymentReviewPage.tsx:208`) | The only CSV export in the app. | **THE CSV IDIOM** — its escaping and the "CSV from the same read the summary aggregates" rule are lifted into one shared `src/lib/dashboard/csv.ts` (new, this bundle's file); `api-payments.ts` is NOT edited (not ours). |
| `useStaffLanding()` (`src/lib/dashboard/landing.ts`) — lands `/app` → `/app/dashboard` once per sign-in and after 30 idle minutes | The landing rule. | **UNTOUCHED.** The dashboards page IS `/app/dashboard`; the landing lands on the account's `dashboard_focus` dashboard among those it holds (§4.3). |
| `pageRegistry.ts` `{ key: 'mgmt.dashboard', path: '/app/dashboard', label: 'Dashboard', group: 'management' }` | The door already has a nav row. | **KEPT.** The company documents page gets its own row (§7.5). `AppLayout.tsx` is B10's; a row in `pageRegistry.ts` is ours. |
| Schedulers: `pg_cron` **absent** (`SELECT extname FROM pg_extension WHERE extname='pg_cron'` → 0 rows); `.github/workflows/scheduled-jobs.yml` **runs and succeeds** (`gh run list --workflow=scheduled-jobs.yml`: 6 of 6 latest runs `success`, hourly, last 2026-09-03T14:46Z; effect: `notifications.kind='booking_reminder_1h'` max `2026-09-02 12:03 -07`); `vercel.json` crons declared, not relied on | The only proven scheduler. | Anything scheduled in this engine (§8) rides that workflow through a new `api/` endpoint — **outside this bundle's file ownership → escalation** (handoff §6.6); or is GATED on B11 (CR-113). Nothing in the engine's core needs a scheduler. |
| Timezone: no tenant timezone column anywhere (`information_schema.columns … column_name ~ 'timezone\|time_zone\|tz'` → 0 rows in `public`); DB `SHOW timezone` = `America/Los_Angeles`; `api/calendar-reminders.ts` hardcodes `America/Los_Angeles`; `windows.ts` uses the browser's local time; owner ruled 2026-08-24 (DAYSHEET) *"all activity is rooted in pst"* — store as tenant config, IANA name | X6 stands. | **§5.2 names the month boundary:** `config_value('OPS','TIMEZONE')` with fallback `America/Los_Angeles`, computed in ONE database function every period-bound element and every report calls. |

---

## 2. WHAT A DASHBOARD IS

A **dashboard** is a named, declared set of elements that renders for one account. It is **declared in code** in `src/lib/dashboard/registry.ts` (the `pageRegistry` idiom: code creates the thing, so a table listing it would be a second source of truth) — and **provisioned in data** (§4): which accounts hold it is a row, never a constant.

```ts
export interface DashboardDef {
  /** Stored in profiles.dashboard_focus and dashboard_provisions.dashboard_key. NEVER renamed once shipped. */
  key: string;                       // 'trainer' | 'business' | 'sales' | 'marketing' | 'admin_desk' | 'ops' | 'instructor' | 'caretaker' | 'member_home' | 'supplies' | …
  /** Owner-facing label. Owner 2026-08-23: by person, not role, for the two live ones — "Claire's Dashboard", "CJ's Dashboard" (VIEW_LABEL today). */
  label: string;
  /** FIX6 §2b: BUSINESS LENSES are cycled by one person; JOB ROLES are held one-per-person; MEMBER is a client's home (HOMESHAPES). */
  family: 'lens' | 'role' | 'member';
  /** Who may hold it at all. my_dashboards() filters by has_staff_access(). */
  audience: 'staff' | 'member';
  /** FIX6: Ops is COMPOSED, never authored — the union of the elements of every OTHER dashboard the account holds, filtered to what has something to show. A composed dashboard lists no elements of its own. */
  composed?: true;
  /** Which bundle owns its content (so a spec knows whose file it is). */
  owner: 'B7' | 'B5' | 'HOMESHAPES' | string;
  /** Whether the "monthly report" button appears on it (§7). Default true for staff dashboards. */
  reportable?: boolean;
}
export const DASHBOARDS: DashboardDef[];
```

**Rules a dashboard obeys:**
1. **It self-arranges.** Elements render in registry order, and an element with nothing to show is absent — the all-quiet footer names what is absent (`QuietFooter`). There is no per-zone arrangement editor (D13 recorded exception; `dashboard_prefs` is ruled out, not deferred). ⚠️ **DASHFEED §4b's testing posture — "everything visible, zero or not" — is a tenant setting, not a rewrite:** `config_value('DASHBOARDS','SHOW_EMPTY')` (`true` during testing, the owner's word *"temporarily"*); when true, absent elements render with their `quiet` line in place of content and the footer is empty. It was never built (`grep -rn SHOW_EMPTY src` = 0) — the ENGINE chunk builds it.
2. **Stats group by domain; actions cluster by ask** (DASHFEED §4b). The registry order for a dashboard is: the numbers strip (stat elements, grouped by `domain`), then the action clusters in the order YOURS · THEIRS · TODAY, then reference lists. A dashboard never scatters numbers among action clusters.
3. **Shared facts are registered once and listed on many dashboards** (the N1 pattern, made explicit by `ElementDef.dashboards: string[]`). 04-OPEN §2's overlap — money, invite claimed, contract signed — is three elements each listed on both owner boards, not six.
4. **Every element goes somewhere or says it does not** (`to?` — a title with no destination renders as text; registry comment on N1).
5. **Landing** (D26, `landing.ts`): `/app/dashboard` opens the account's `dashboard_focus` if held, else the first held dashboard in registry order, else — for staff holding nothing — the tenant default set (§4.1).

---

## 3. WHAT AN ELEMENT IS

An **element** is one registered read with one renderer: the unit a dashboard lists, a report snapshots, and the owner configures. It replaces `ZoneDef` (every existing zone becomes an element through the adapter in §3.3; the sixteen renderers in `TrainerZones.tsx` / `BusinessZones.tsx` / `NotificationsZone.tsx` are untouched).

### 3.1 The definition (code, `registry.ts`)

```ts
export type ElementKind = 'stat' | 'action' | 'list';
export type Ask = 'yours' | 'theirs' | 'today';                 // DASHFEED §4b
export type Domain = 'money' | 'lessons' | 'clients' | 'horses' | 'documents' | 'supplies' | 'property' | 'app' | 'marketing' | 'community';
export type DisplayVariant = 'raw_total' | 'totals_over_months' | 'component_matrix' | 'pie' | 'stacked_bar' | 'line';  // CR-112 #11, verbatim list
export type Cadence = 'live' | 'monthly';

export interface ElementDef {
  key: string;                          // 'C1', 'B3', 'M_MONEY', 'SUP_ONHAND_ITEM' … stable forever (stored in config + snapshots)
  title: string;
  kind: ElementKind;
  domain: Domain;                       // stats group by this
  ask?: Ask;                            // actions cluster by this (required when kind='action')
  dashboards: string[];                 // DashboardDef.key[] — listed on each; registered ONCE
  order: number;                        // within its group/cluster
  /** THE SOURCE — one named RPC. §3.3 for the two admitted signatures. */
  source: { fn: string; shape: 'zone' | 'element' };
  /** THE INPUTS the owner may set per account (CR-112 #11 "inputs feeding the element"). Each has a key, a label, a type and a default; values live in dashboard_element_config.inputs (§4.2). */
  inputs?: InputDef[];                  // e.g. { key:'period', type:'period', default:'last_month' }, { key:'item_ids', type:'ref[]', ref:'resource' }, { key:'months', type:'int', default:3 }
  /** THE DISPLAY VARIANTS it can render; the first is the default. `vsTotal` says the variant may render "vs total". An element with one variant has no variant control. */
  variants: DisplayVariant[];
  vsTotal?: boolean;
  cadence: Cadence;                     // 'monthly' elements render the last CLOSED month by default (§5)
  quiet: string;                        // the all-quiet line, lower case, no full stop
  hint?: string;
  to?: string;                          // THE REACH; absent = no destination (renders as text)
  /** Report participation (§7.1). Default: snapshot=true, figures=[]. */
  report?: { snapshot?: boolean; figures?: FigureDef[] };
  owner: string;                        // bundle
  /** Not-yet-measurable inputs (04-OPEN §3; DASHFEED §4b): an element whose input is uncaptured says so instead of rendering a zero. */
  notYetMeasurable?: (ctx: TenantFacts) => string | null;
}
```

### 3.2 The element contract — what every element must satisfy
- **An element that announces a thing carries the thing and the act** (DASHFEED §3, the half-measure rule; CR-74 "a modal can be the work"). An `action` element's row renders its content and its control inline (Mark paid, Reply, Approve) and on send closes or pins — it never only links away. A `stat` element's number has a "…so I should ___" (DASHFEED §5.4) or it is not a stat.
- **A stat that cannot yet be computed says "not yet measurable — <why>"** (04-OPEN §3: an uncaptured input renders a zero indistinguishable from a real zero). `notYetMeasurable` returns the reason; the renderer prints it in place of the number; a report prints it in place of the figure.
- **D25 on staff surfaces**: `serviceWording()` for every service row; "booking" never reaches a person.
- **The ask axis is declared per action element** (`ask: 'yours' | 'theirs' | 'today'`), not computed: C3 money-to-confirm, C4 people waiting on a reply, C9 unsigned paperwork, B3 deals waiting are `yours`; a "we are waiting on the client" element (an invitation sent and unclaimed, a payment requested and undeclared) is `theirs`; C1 is `today`. `_waiting_items.side` had the same idea and is retired in place (§1) — the axis lives in the registry, where the act lives.
- **One computation, one source** (D18): an element's `source.fn` is the only place its number is computed; any other surface showing that number calls the same function (`revenue_summary` is the standing example — the calendar strip and the ribbon call it with the same window from `windows.ts`).
- **A TODAY element advances** (DAYSHEET §3 residual — unbuilt: `dash_today_plan` reads `lesson_plans_for_day(current_date)` with no time filter, and C1's "next up" is the plan's next-up TEXT, not a next-item card): the renderer shows the single next item prominently, drops passed items from the forward list, and lists them below as "done today", each row still actionable. This is renderer behaviour under `ask:'today'`, specced in chunk D for C1.

### 3.3 The source — two admitted signatures, nothing else
| Shape | Signature | Who uses it |
|---|---|---|
| `'zone'` (adapter) | `fn() RETURNS jsonb {count int, items jsonb[]}` — the 22 existing `dash_*` readers, unchanged | Every existing zone. The adapter passes no inputs and ignores variants (they render as they do today). |
| `'element'` | `fn(p_from timestamptz, p_to timestamptz, p_inputs jsonb) RETURNS jsonb {count int, items jsonb[], figures jsonb, not_yet_measurable text}` | Every NEW element. `p_from`/`p_to` come from §5's period resolution; `p_inputs` is the merged per-account config (§4.2). `figures` is `[{key, label, value numeric, unit text, period text}]` — the element's contribution to a report's explicit figures. |

Every source is `SECURITY DEFINER`, begins `IF NOT coalesce(has_staff_access(), false) THEN RAISE …` (member-audience elements gate on the member predicate their reads already use), and its migration ends with `REVOKE EXECUTE ON FUNCTION … FROM PUBLIC, anon;` — **`REVOKE FROM PUBLIC` alone is not enough; a fresh function inherits `anon` via Supabase default privileges; DROP+CREATE resets the ACL** (CLAUDE.md, TASK-BOOKS1/ORIGIN). VRFY re-checks `pg_proc.proacl` on every one.

### 3.4 Display variants — what the engine renders
`raw_total` (one number) · `totals_over_months` (N monthly numbers, N = `inputs.months`) · `component_matrix` (rows × components) · `pie` · `stacked_bar` · `line` — each with `vs_total` where the element declares it. **The variant KEYS are code** (a renderer must exist per key); **their labels** are `lookup_options.lookup_key='display_variant'` so the owner can word them (D13). The chart renderers are this bundle's (`src/components/app/dashboard/charts/*`, new) and are the only chart code any consumer uses — a consumer registers an element and picks variants; it never draws.

---

## 4. PER-ACCOUNT PROVISIONING FROM A TENANT DEFAULT

### 4.1 `dashboard_provisions` — the SET of dashboards an account holds (FIX6 §2b; CR-107)

**Measured 2026-09-03 — the two owner accounts exist and are distinct logins:**
```sql
SELECT p.user_id, u.email, p.role, p.dashboard_focus, u.last_sign_in_at
  FROM profiles p JOIN auth.users u ON u.id=p.user_id
 WHERE p.role IN ('ADMIN','SUPER_ADMIN') OR p.dashboard_focus IS NOT NULL ORDER BY u.email;
-- admin@fhequestrian.com | ADMIN | business | 2026-09-01 15:48 -07
-- hello@fhequestrian.com | ADMIN | trainer  | 2026-08-31 10:59 -07
-- (admin@cactai.io is SUPER_ADMIN, org_id NULL — the platform owner, never a tenant identity, D1a)
```
So "per-account for Claire and myself" has two accounts to provision. (Whether one PERSON sometimes uses the other login is the shared-login audit gap — provisioning follows the LOGIN, and this contract says so plainly rather than inventing a per-person layer.)

```sql
CREATE TABLE dashboard_provisions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  user_id       uuid REFERENCES auth.users(id),      -- NULL = THE TENANT DEFAULT for this dashboard
  dashboard_key text NOT NULL,                        -- DashboardDef.key; validated by the RPC against the registry mirror the app passes (no FK — the registry is code)
  created_by    uuid DEFAULT auth.uid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  revoked_at    timestamptz,                          -- D32: a held dashboard is revoked, never deleted
  revoked_by    uuid,
  UNIQUE (org_id, user_id, dashboard_key)             -- NULLS NOT DISTINCT on user_id (one tenant-default row per dashboard)
);
-- RLS: RESTRICTIVE org boundary; SELECT self-or-admin (isg_read's shape); ALL for is_admin() (isg_admin's shape).
```
- **Resolution for account U:** `held(U) = {rows WHERE user_id=U AND revoked_at IS NULL} ∪ {rows WHERE user_id IS NULL AND revoked_at IS NULL AND NOT EXISTS (a revoked row for U on that key)}` — i.e. the tenant default applies until the account has its own row on that key; an account-level revoke of a default is an explicit revoked row. `my_dashboards()` returns held(U) filtered by `audience` (§2) and by the registry keys the app passes (so a stale row for a retired dashboard is invisible, never deleted).
- **"Changes saved to the account, not the tenant" (CR-112 #11):** `set_dashboard_provision(p_user_id, p_dashboard_key, p_held boolean)` — self-or-admin, org-bounded, exactly `set_dashboard_focus`'s guard — writes ONLY rows with `user_id = p_user_id`. **The tenant default (`user_id IS NULL`) is written only by `set_dashboard_default(p_dashboard_key, p_held)`**, admin-only, from the Team page's "Defaults for new accounts" control. Two RPCs so the surface cannot write the wrong row by accident; VRFY proves on production that a change from the dashboards page lands on the account row.
- **Seed (ENGINE chunk migration, same transaction as the CHECK replacement):** `('trainer', hello@)`, `('business', admin@)` as account rows — so neither owner loses their board (NOSTRIP) — plus tenant defaults `('trainer', NULL)`, `('business', NULL)` so a third staff account lands where it does today (the `role === 'ADMIN' ? 'business' : 'trainer'` fallback in `OwnerDashboard.tsx:106` retires into data). `audience:'member'` dashboards need no rows — the audience IS the default; a member's revocation is a revoked row.
- **The cycler appears only when `held(U)` has more than one entry** (FIX6). The toggle's session memory (`fhe.dashboard.view`) is kept; a remembered key not in `held(U)` is ignored.

### 4.2 `dashboard_element_config` — per-account element configuration (CR-112 #11 ELEMENT CONFIG)

```sql
CREATE TABLE dashboard_element_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  user_id       uuid REFERENCES auth.users(id),      -- NULL = tenant default
  dashboard_key text NOT NULL,
  element_key   text NOT NULL,
  shown         boolean,                              -- the per-item "show on dashboard" toggle (#11); NULL = registry default
  variant       text,                                 -- DisplayVariant; NULL = element's first
  vs_total      boolean,
  inputs        jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {input_key: value}; validated against ElementDef.inputs by the RPC
  updated_by    uuid DEFAULT auth.uid(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, dashboard_key, element_key)  -- NULLS NOT DISTINCT
);
-- RLS as dashboard_provisions.
```
- **Resolution:** account row ⟶ tenant-default row ⟶ registry default, field by field (a NULL field falls through). `my_element_config(p_dashboard_key)` returns the merged config for the caller in one call; the dashboard fires it beside `my_dashboards()`.
- **Writes:** `set_element_config(p_user_id, p_dashboard_key, p_element_key, p_patch jsonb)` self-or-admin; `set_element_default(…)` admin-only. Same two-RPC split as §4.1, same reason.
- ⚠️ **This is a per-element EDITOR and it is D13 territory, not the D13 exception** (the exception excludes ARRANGEMENT only — CLAUDE.md D13). Escalation 4 puts the three-row boundary in front of the owner: selector = access (allowed) · element config = content/formula (D13 says owner-editable) · arrangement (excluded). **The tables ship in the ENGINE chunk regardless** (a consumer's per-account default needs them); **the editing SURFACE is chunk F, gated on his "in force?"**.
- **Consumers declare per-account defaults as tenant-default rows in their own migration** (`user_id IS NULL`), e.g. B5 seeds `shown=false` for "Recent entries" and the owner's account row flips it on — *"Recent entries: useful to the owner, useless to Claire (hence per-account)"* (A1 #11).

### 4.3 The dashboards page, the cycler and the selector (CR-107 — "the door")
- **The page is `/app/dashboard`** (`DashboardHome` → `OwnerDashboard` for staff; nav row `mgmt.dashboard` exists; landing unchanged). It is not a new route: CR-107's "dashboards page" and D26's landing surface are the same door.
- **The cycler** replaces `ViewToggle` when `held(U).length > 1`: one small control (owner 2026-08-23: *"not even a secondary action"*) that cycles `held(U)` in registry order (lenses first, then roles) and shows the current label; a two-entry set renders exactly today's "Show X's Dashboard" / ✕ shape.
- **The selector** (CR-107: *"choose which ones we want to have accessible from the dashboards page using a selector of some kind"*) is a "Dashboards…" control beside the cycler listing every `audience:'staff'` dashboard with held/not-held for the signed-in account. It calls `set_dashboard_provision(auth.uid(), key, held)`. Admins may also open it for another account **from the Team page** (FIX6: *"provision any user's view … this applies to me and to claire"*), where the existing "Default dashboard" control widens from a two-option select to: the held SET (checkboxes) + the landing default (a select over the held set). **One mechanism, two doors; the words that survive are FIX6's — a dashboard is PROVISIONED to an account, any number, and the toggle appears only when an account holds more than one; CR-107's "selector" is the self-service door to the same rows.**
- **Composed Ops** (FIX6): `composed:true` — `zonesFor('ops')` = the union of elements listed on every OTHER dashboard in `held(U)`, de-duplicated by key, ordered by §2 rule 2. It is never authored. It is built LAST, after the owner's list (chunk D3, stub only until then).

---

## 5. CADENCE AND PERIODS (CR-112 #11: monthly, not month-to-date; MoM · QoQ · same-period-last-year · user-defined)

### 5.1 The period vocabulary
`lookup_options.lookup_key = 'dashboard_period'` (owner-editable labels; keys are code): `last_month` (default for `cadence:'monthly'`) · `this_month_to_date` (only for `cadence:'live'` stats) · `month_over_month` · `quarter_over_quarter` · `same_period_last_year` · `custom` (from/to). An element input of `type:'period'` renders as this list plus a date pair for `custom`. A report's period is the same vocabulary.

### 5.2 The month boundary — ONE function
```sql
CREATE FUNCTION period_bounds(p_period text, p_ref date DEFAULT current_date, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
  RETURNS TABLE (from_ts timestamptz, to_ts timestamptz, prior_from timestamptz, prior_to timestamptz, label text)
-- tz := coalesce(config_value('OPS','TIMEZONE'), 'America/Los_Angeles');  -- X6: the owner's DAYSHEET ruling, stored as tenant config, IANA name
-- 'last_month'  → [date_trunc('month', p_ref - interval '1 month'), date_trunc('month', p_ref)) AT TIME ZONE tz; prior = the month before
-- 'quarter_over_quarter', 'same_period_last_year' → the analogous pairs; 'custom' → [p_from, p_to+1 day)
```
`OPS.TIMEZONE` is a new `config_keys` row (namespace `OPS`, key `TIMEZONE`, `expected_type text`) — editable where the other org keys are edited (`AdminBrandingPage.tsx` → `api-admin.ts`; the ENGINE chunk adds the key to that page's list or names the follow-up, D13). `windows.ts` keeps computing the LIVE week/month in browser time for the two live ribbons (the plan's ruling, correct for the two owners); **every `cadence:'monthly'` element and every report uses `period_bounds()`** so a report generated in a browser in another timezone still closes the month where the ranch does.

---

## 6. THE REPORT GENERATOR (CR-112 #12, the shape that REPLACED the rejected field list)

### 6.1 What a report is
> A report is a SNAPSHOT OF THE USER'S DASHBOARD as it appears to them + a set of explicit monthly usage and cost figures for items of business importance regardless of dashboard + the per-horse statement + a business monthly snapshot. — CR-112·A1 #12

Concretely, one `reports` row (§7.1) whose `snapshot` is:
```jsonc
{
  "dashboard":  { "key": "supplies", "label": "…", "for_user_id": "…", "period": {…},
                  "elements": [ { "key": "…", "title": "…", "variant": "line", "vs_total": false, "inputs": {…}, "data": {count, items, figures} } ] },
  "figures":    [ { "key": "…", "label": "…", "value": 123.45, "unit": "usd", "period": "2026-08", "source": "fn" } ],   // §6.3 — regardless of dashboard
  "statements": [ { "entity_kind": "horse", "entity_id": "…", "label": "…", "lines": [ {…} ] } ],                       // §6.4 — per-entity
  "business":   { "figures": [ … ] }                                                                                     // §6.5 — the business monthly snapshot
}
```
The snapshot is the **frozen data**, not a picture: PDF and CSV are rendered FROM it, and it is what `report_freshness_check` (§7.4) compares against later.

### 6.2 The trigger and the modal
- **The "Monthly report" button** sits on every `reportable` dashboard's header. *"clicked after the month's usage/received/non-inventory entries are added (no gating, no logic)"* — it never checks whether entries were made.
- **The generate modal** (THE SHAPE is in `TASK-DASHBOARDS-C`, owner's eyes before build): **parameters on the primary surface** — period (default `last_month`), **me / both accounts** toggle (both = one report per owner account, each in that account's variant — that account's held elements and config), **email + store** (store is always on; email is opt-in), **PDF / CSV / both** (default: digital copy to documents = PDF stored, no email); **inclusions in a large modal/page off it** — the element list of the chosen dashboard(s) with checkboxes (pre-checked from `shown`), plus the explicit-figure list (§6.3) and the entity statements (§6.4) as their own sections. The modal **states what it will do before it does it** (D19): "This will generate *Monthly report — August 2026* for CJ and Claire, PDF, stored to Company documents. The current August report will be marked superseded and kept."
- **Idempotent** (§7.1): generating the same `(report_key, dashboard_key, for_user_id, period)` twice leaves exactly one `current` and one `superseded`; the superseded one is archived-retrievable, never deleted (D32); the new one carries the original name.

### 6.3 Explicit figures "regardless of dashboard"
A registry of figures, in code beside the elements: `REPORT_FIGURES: FigureDef[]` — `{ key, label, source: fn(p_from, p_to) → {value, unit}, domain, owner, cadence:'monthly' }`. Consumers register theirs (B5: monthly usage and cost per item of business importance — its list); the engine ships `revenue_month` (from `revenue_summary`), `revenue_prior_month`, `declared_unconfirmed_total`. The generate modal lists them under "Figures"; a report includes the checked ones whether or not any dashboard shows them.

### 6.4 Per-entity statements
`ENTITY_STATEMENTS: StatementDef[]` — `{ key, entity_kind: 'horse' | 'client' | 'item' | …, label, source: fn(p_entity_id, p_from, p_to) → {lines}, owner }`. The engine defines the shape and the section renderer; **B5 registers the per-horse statement** (its instance; the engine has no statement of its own at first). The modal offers each registered statement kind with an entity picker (all / chosen).

### 6.5 The business monthly snapshot
The figures registered with `domain` in `{money, clients, marketing}` for the period plus the counts of every `stat` element on the `business` dashboard — computed with the TENANT-DEFAULT config, so it is the same for both accounts (the "business" section is what does not vary by variant).

---

## 7. STORAGE, NAMING, SUPERSESSION, IDEMPOTENCY (CR-112 #12–#13)

### 7.1 `reports` — the row (NEW table; this bundle's)
```sql
CREATE SEQUENCE reports_display_code_seq;
CREATE TABLE reports (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  display_code          text UNIQUE,                                       -- 'RPT-000001' via assign_display_code('RPT-', 'reports_display_code_seq')
  report_key            text NOT NULL,                                     -- 'dashboard_monthly' (the engine's) | a consumer's key ('supplies_monthly')
  dashboard_key         text NOT NULL,
  for_user_id           uuid REFERENCES auth.users(id),                    -- the VARIANT: whose dashboard was snapshotted; NULL = business-only
  period_key            text NOT NULL,                                     -- §5.1
  period_from           timestamptz NOT NULL,
  period_to             timestamptz NOT NULL,
  period_label          text NOT NULL,                                     -- 'August 2026'
  name                  text NOT NULL,                                     -- the display name (§7.3); the ORIGINAL name is reused on regeneration
  inclusions            jsonb NOT NULL,                                    -- element keys, figure keys, statement keys chosen
  snapshot              jsonb NOT NULL,                                    -- §6.1
  formats               text[] NOT NULL,                                   -- {'pdf'} | {'csv'} | {'pdf','csv'}
  pdf_file_id           uuid REFERENCES files(id),
  csv_file_id           uuid REFERENCES files(id),
  status                text NOT NULL DEFAULT 'current' CHECK (status IN ('current','superseded','outdated')),
  superseded_by_id      uuid REFERENCES reports(id),
  superseded_at         timestamptz,
  outdated_at           timestamptz,
  outdated_reason       text,                                              -- which source moved, by key
  archived_at           timestamptz,                                       -- set when superseded; archived = listed under "Archived", retrievable
  generated_by_user_id  uuid NOT NULL DEFAULT auth.uid(),
  generated_at          timestamptz NOT NULL DEFAULT now(),
  reason                text,                                              -- D19: why it was generated ("month close", "regenerated after backdated feed entries")
  emailed_to            text[],
  emailed_at            timestamptz,
  deleted_at            timestamptz                                        -- never set by the app (D32); exists so the shape matches every other table
);
CREATE UNIQUE INDEX reports_one_current
  ON reports (org_id, report_key, dashboard_key, coalesce(for_user_id, '00000000-0000-0000-0000-000000000000'::uuid), period_from, period_to)
  WHERE status = 'current';                                                -- IDEMPOTENCY, enforced by the database
-- RLS: RESTRICTIVE org boundary; SELECT/INSERT/UPDATE for has_staff_access(); NO DELETE policy; no member policy at all —
-- a client can never read an owner's report (TASK-AUTHORITY: RLS is the "can't reach" bug more than once — the test is in every spec).
```
Naming is not a column trick: `name` is written once from the template; supersession and outdating rewrite `name` on the OLD row only (§7.3).

### 7.2 Where the bytes live
`files` rows, `owner_kind='org'`, `owner_contact_id NULL`, bucket `facility-files`, path `{org}/org/{org}/{file_id}-{safe name}.pdf|.csv`, `uploaded_by_user_id = generator`, `title = reports.name`, `mime_type` `application/pdf` / `text/csv` — exactly `uploadCompanyResource`'s shape (`src/lib/files.ts:308`). `files_staff_rw` already admits staff and nothing else admits members (`files_org_published_read` requires a published `content_resources` row, which a report never has). **No new bucket, no new storage policy.** Records → Files will list report files as company files (it lists everything) — acceptable; the company documents page is the curated read.

### 7.3 Naming and rendering
- **The name template** is `config_value('REPORTS','NAME_TEMPLATE')`, default `{report} — {period} — {variant}` → *"Monthly report — August 2026 — CJ"* (variant = the account's `first_name`/`display_name`; business-only = "Business"). Owner-editable (D13; new `config_keys` row, same editor as §5.2).
- **Supersession** (#13): on regeneration the OLD row → `status='superseded'`, `superseded_by_id`, `superseded_at`, `archived_at = now()`, `name = name || ' — superseded ' || to_char(now(), 'YYYY-MM-DD')`; the NEW row takes the ORIGINAL name. The old PDF/CSV files are untouched (retrievable under "Archived").
- **Outdated** (#13): when backdated data arrives, the current row → `status='outdated'`, `outdated_at`, `outdated_reason`, `name = name || ' — outdated'`. It stays `current`-listed (it is still the latest report) but is visibly stale; regenerating supersedes it as above. The unique index admits it (status ≠ current is not required — `outdated` rows are excluded from the `current` predicate; exactly one of {current, outdated} per key is enforced by the RPC, not the index — VRFY tests it).
- **PDF**: `renderDocumentPdf(title, body)` (`src/lib/documentPdf.ts`) over a body composed by `src/lib/dashboard/reportBody.ts` (new): numbered section headings (the renderer bolds them), one section per snapshot part, tables as aligned plain text, charts as their `component_matrix` numbers (this renderer draws no charts — stated, not hidden). **CSV**: `src/lib/dashboard/csv.ts` (new; the escaping lifted from `revenueLinesToCsv`) — one row per figure/element datum, columns `section, element_key, label, period, value, unit`.
- **Generation runs in the client, commits in one RPC.** The signed-in browser already holds every element's data for its own account and can read the other owner's config (staff RLS) to compute the "both" variant with that account's inputs; it renders the PDF/CSV, uploads them through the files spine, then calls **`generate_report(p_report_key, p_dashboard_key, p_for_user_id, p_period_key, p_from, p_to, p_name, p_inclusions, p_snapshot, p_formats, p_pdf_file_id, p_csv_file_id, p_reason)`** — one transaction: supersede the current row for that key (§7.3) → insert the new row → return it. A failed RPC leaves org files that the generator soft-deletes (`softDeleteFile`); the modal reports the failure (Supabase errors are not `Error` instances — `useAsync.ts`). `REVOKE … FROM PUBLIC, anon`; `proacl` proven.
- **Email on request**: needs a server send (`api/_lib/email.ts`, the `deliver-my-document.ts` idiom: authenticated self-send, attachment from storage). **A new `api/deliver-report.ts` is outside this bundle's file ownership → escalation (handoff §6.6).** Store-only is the default and ships without it; `emailed_at`/`emailed_to` are stamped by that endpoint when it exists.

### 7.4 Freshness — how "backdated data" is detected without a trigger on tables this bundle does not own
- **`mark_reports_outdated(p_from timestamptz, p_to timestamptz, p_source text)`** — engine RPC (staff/definer; also callable from a consumer's trigger). Marks every `current` report whose period overlaps `[p_from, p_to)` as outdated with `outdated_reason = p_source`. **Consumers wire it from their own ledgers' triggers** (B5: an `INSERT` on `consumption_events` whose `occurred_at` < the current month's start → `mark_reports_outdated(occurred_at, occurred_at, 'consumption_events')`; ⚠️ `UPDATE OF <col>` fires on the columns the STATEMENT names — ORCHESTRATOR.md §3c — a consumer's trigger spec proves its firing statement). The engine's own sources (`purchases` — BACKDATE put real dates on orders/payments) are not this bundle's tables; the engine covers them by the check below.
- **`report_freshness_check(p_report_id)`** — recomputes the report's `figures` and `business.figures` from their registered sources for the stored period and compares to the snapshot; on any difference beyond rounding → the report is marked outdated with the differing figure keys as the reason. **Called lazily**: when the company documents page lists current reports and when the generate modal opens for a period that already has one. No scheduler needed for the guarantee; a scheduled sweep (§8) is a later nicety.

### 7.5 The company documents page — where a report is reached (CR-112 #12: *"company documents do NOT co-mingle with client documents"*)
- **A NEW owner-only page** (name and place = escalation 5; recommendation in the handoff: **"Company documents"**, group `management`, path `/app/ops/company-documents`, registry key `mgmt.company_documents`), shared by both owner accounts — it reads by org, not by caller. Three lists, in this order: **Reports** (`reports` where `status IN ('current','outdated')`, newest period first; a report row shows name · period · variant · generated by/when · status chip · PDF/CSV open (signed URL via `fileDownloadUrl`) · Regenerate · Email…), **Company files** (`files` with `owner_kind='org'` linked to `subject_type='org'`, i.e. `listOrgFiles()` filtered to org-owned — the Content store's uploads), **Shared documents** (`documents` where a `document_parties` row names `organizations.company_contact_id` — a lease appears here AND on the client's My Documents; a pure read of the frozen table), and an **Archived** section (superseded reports, retrievable). **Nothing owned by a contact is ever listed** — that is the co-mingling rule, enforced by the reads (`owner_kind='org'`, `for_user_id ∈ owners`, company-party), and by RLS on `reports` (no member policy).
- **Reports identifiable by owner variant in the name** — the `{variant}` token in the template.
- **THE REACH**: the nav row `mgmt.company_documents` (ours: `pageRegistry.ts`; the rail reads registry rows through `MANAGEMENT_GROUP` in `AppLayout.tsx` — B10's file; if the row does not appear without an `AppLayout.tsx` edit, that is an escalation, not a quiet edit) + a "Reports" link from the generate modal's success state + a link from each `reportable` dashboard header.

---

## 8. WHAT NEEDS A SCHEDULER, AND WHICH ONE (measured)
| Behaviour (CR-112 #12) | Rides | State |
|---|---|---|
| The monthly report button, supersession, outdating by consumer trigger, lazy freshness check | nothing scheduled | **In the engine.** |
| *"Dashboards without manual inputs auto-generate reports"* | `.github/workflows/scheduled-jobs.yml` (proven hourly) → a new `api/reports-monthly.ts` (server-side generation on the 1st, `period_bounds('last_month')`, both owner accounts, store-only) | **GATED: file outside ownership → escalation §6.6.** The endpoint would need a server-side renderer — `api/_lib/documentPdf.ts` exists — and a server-side element evaluation (the RPCs are callable with the service role). Specced as chunk E-auto, dispatched only after ORCH assigns the file. |
| *"a reminder the day before and a deadline one minute before generation"* | B11 / CR-113's notification-preference scheduler (`notifications` row kind `report_due` → the daily digest at 16:00 UTC via `notifications-nudge`, or real-time per CR-113's choices) | **GATED on B11.** The engine writes the `notifications` row (`kind='report_due'`, `link='/app/dashboard'`) from the same endpoint; B11 decides delivery. |

---

## 9. THE CONSUMER INTERFACE — for a bundle that has never seen this one

**What you touch:** `src/lib/dashboard/registry.ts` — append to `DASHBOARDS`, `ELEMENTS`, `REPORT_FIGURES`, `ENTITY_STATEMENTS` (one commit, additive, one block per bundle with the bundle's name in a comment); your own zone renderer files under `src/components/app/dashboard/<bundle>/` (the `renderZone` switch in `OwnerDashboard.tsx` becomes a registry-driven map keyed by element key — you add your renderer to the map in your block); your own reader RPCs in your own migrations; tenant-default rows in `dashboard_provisions` / `dashboard_element_config` in your own migration; your own triggers calling `mark_reports_outdated`.
**What you never touch:** the engine tables' shape; `generate_report` / `my_dashboards` / `my_element_config` / `period_bounds` / the `set_*` RPCs; `DashboardChrome.tsx`; the chart renderers; `reports` rows directly (only through `generate_report`); `documents`.

1. **Register a dashboard** — `DASHBOARDS.push({ key:'supplies', label:'Supplies', family:'lens', audience:'staff', owner:'B5', reportable:true })`. Seed who holds it: a migration inserting `dashboard_provisions (user_id NULL, dashboard_key 'supplies')` for the tenant default, or per-account rows.
2. **Register an element** — `ELEMENTS.push({ key:'SUP_ITEM_ONHAND', title:…, kind:'stat', domain:'supplies', dashboards:['supplies','ops'], order:20, source:{ fn:'sup_item_onhand', shape:'element' }, inputs:[{key:'item_ids', type:'ref[]', ref:'resource', label:'Items'}], variants:['raw_total','line','totals_over_months'], vsTotal:true, cadence:'monthly', quiet:'no items are tracked', to:'/app/ops/…', report:{ snapshot:true }, owner:'B5' })`. Your RPC: `sup_item_onhand(p_from timestamptz, p_to timestamptz, p_inputs jsonb) RETURNS jsonb {count, items, figures, not_yet_measurable}` — `SECURITY DEFINER`, staff-gated, `REVOKE … FROM PUBLIC, anon`, `proacl` proof in your report. `items` shape is yours; your renderer reads it. For `line`/`totals_over_months`, `items` is `[{period:'2026-06', value, component?}]`; for `component_matrix`/`stacked_bar`/`pie`, `[{row, component, value}]` — the chart renderers read exactly these two shapes.
3. **Declare per-account defaults** — a migration: `INSERT INTO dashboard_element_config (user_id, dashboard_key, element_key, shown, variant, inputs) VALUES (NULL, 'supplies', 'SUP_RECENT_ENTRIES', false, NULL, '{}')`; the owner turns it on for his own account from the element-config surface (chunk F) or, until that ships, an admin sets his account row through `set_element_config` from the Team page.
4. **Contribute report figures and a per-entity statement** — `REPORT_FIGURES.push({ key:'sup_cost_month', label:'Supplies cost (month)', source:{ fn:'sup_cost_month' }, domain:'supplies', owner:'B5' })` with `sup_cost_month(p_from, p_to) RETURNS jsonb {value, unit}`; `ENTITY_STATEMENTS.push({ key:'horse_supplies', entity_kind:'horse', label:'Per-horse supplies statement', source:{ fn:'horse_supplies_statement' }, owner:'B5' })` with `horse_supplies_statement(p_horse_id, p_from, p_to) RETURNS jsonb {lines:[{label, qty, unit, cost, billed}]}`.
5. **What the report generator calls** — nothing of yours directly except the RPCs above, through the registry: your element sources with the account's merged inputs and `period_bounds()`'s window, your figure sources, your statement sources. Your dashboard's "Monthly report" button is the engine's; your `report_key` is `'<dashboard_key>_monthly'` unless you register another.
6. **Backdated data** — your ledger's trigger calls `mark_reports_outdated(occurred_at, occurred_at, '<your table>')` when an entry lands inside a period that already has a current report; prove the firing statement.
7. **Nothing you build is reachable until it is on a held dashboard** — a registered element on a dashboard nobody holds is the eighth kind of unreachable (D17). Your spec's THE REACH names the provisions row.

**B5's side (`docs/reports/FHE-DSNR-SUPPLIES-HANDOFF.md` §7):** not on `origin/main` nor `origin/bundle/supplies` on 2026-09-03 (`git show origin/main:docs/reports/FHE-DSNR-SUPPLIES-HANDOFF.md` → does not exist; `wt-4`'s branch holds only its ledger). **`AWAITING B5 RECONCILE`** — when it lands, MGMT hands it to this task's lineage; disagreements are listed under `## CHANGES`.

---

## 10. WHAT THE ENGINE DOES NOT DECIDE
- The content of any dashboard: which elements Sales, Marketing, Admin, Ops, Trainer, Instructor, Care-taker, the supplies dashboard or a member's home list — the owner's list (escalation 2 / FIX6's STOP) and each consumer's spec.
- The seven view names and the "Admin" collision with the nav section (FIX6 raised it; escalation 6 — this file uses `admin_desk` as the KEY so the label can be anything).
- Whether a CLIENT dashboard/report ships in this bundle (escalation 6) — the engine can hold one (`audience:'member'`, `family:'member'`; HOMESHAPES §3's eight zones become elements with `dashboards:['member_home']`).
- Messaging convergence (04-OPEN §1, after T3) — the engine only needs an `action` element able to render a thread inline; it does not build the store.
- The tasks/reminders substrate (plan §5) — not in any CR; a proposal in the handoff.
- Delivery of reminders (B11), analytics tiles' inputs (B4), the requests inbox element's content (B6 — the engine provides the slot: an `action` element with `ask:'yours'`, `domain:'clients'`, `dashboards:['trainer','ops']`).

---

## CHANGES
*(empty — nothing has moved since STABLE)*
