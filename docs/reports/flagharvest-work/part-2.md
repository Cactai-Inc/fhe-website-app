# FLAGHARVEST part 2 — unviewed inventory, artifacts 9–16

Worktree: `/Users/Cactai/Downloads/claude-code-repo/wt-flagharvest` @ `86283dc`
Prod DB read-only. Nothing changed. Nothing recommended for deletion.

**Three reported claims did not survive verification.** Flagged inline and summarized at the bottom.

---

## 9. serviceCatalog.ts + SERVICE_TYPES (`src/lib/serviceCatalog.ts`)
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#9], TASK-PAGETITLES-REPORT.md [INV batch3.md#47]
- reachability: **VERIFIED — claim holds.** `grep -rn "serviceCatalog\|SERVICE_TYPES\|serviceLabel\|OFFERING_SLUG_TO_SERVICE_TYPE\|serviceTypeForOfferingSlug\|SERVICE_TYPE_BY_CODE\|isServiceCode" src/ test/ api/ scripts/` returns hits in exactly two files: the module itself, and `test/db/service_catalog.test.ts:14` (`import { SERVICE_TYPES, OFFERING_SLUG_TO_SERVICE_TYPE } from '../../src/lib/serviceCatalog'`). **Zero importers in `src/`, zero in `api/`.** There is no runtime gate — it is simply never imported. The file's own docstring line 8 claims *"Every UI that names a service reads from here"*; no UI does.
- Prod cross-check: `select code, display_name, segment, requires_horse from service_types order by sort_order` returns 14 rows **byte-matching the constant below**, including `HORSE_PURCHASE_ASSISTANCE|Acquisition Assistance`. The drift-guard is green — it is guarding a constant nobody reads. All 27 active offerings carry a non-null `service_type`.
- exists: **yes**

```ts
/**
 * Single source of truth for the finalized 13-service catalog on the front end.
 *
 * Mirrors the `service_types` lookup seeded in migration 008. The structured fields
 * (code, label, segment, requiresHorse) are kept in lockstep with the database by
 * test/db/service_catalog.test.ts, which fails if the two ever drift — so this file
 * is the one place to change a service label, and the DB is the one home for the
 * longer prose description. Every UI that names a service reads from here.
 */

export type ServiceSegment = 'rider' | 'horse' | 'acquisition' | 'internal';

export interface ServiceTypeDef {
  /** Canonical code, e.g. 'RIDING_LESSON' (security-model §10). */
  code: string;
  /** Human label shown in the UI. */
  label: string;
  segment: ServiceSegment;
  /** Whether a horse record is involved (drives intake/engagement branching). */
  requiresHorse: boolean;
}

export const SERVICE_TYPES: ServiceTypeDef[] = [
  { code: 'HORSE_FINDER',              label: 'Horse Finder',              segment: 'acquisition',  requiresHorse: false },
  { code: 'HORSE_EVALUATION',         label: 'Horse Evaluation',          segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_PURCHASE_ASSISTANCE', label: 'Acquisition Assistance',    segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_SALE_ASSISTANCE',     label: 'Horse Sale Assistance',     segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_LEASE_IN_ASSISTANCE', label: 'Horse Lease-In Assistance', segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_LEASE_OUT_ASSISTANCE',label: 'Horse Lease-Out Assistance',segment: 'acquisition',  requiresHorse: true },
  { code: 'HORSE_TRAINING',           label: 'Horse Training',            segment: 'horse',    requiresHorse: true },
  { code: 'HORSE_EXERCISE',           label: 'Horse Exercise',            segment: 'horse',    requiresHorse: true },
  { code: 'HORSE_CLIPPING',           label: 'Horse Clipping',            segment: 'horse',    requiresHorse: true },
  { code: 'RIDING_LESSON',            label: 'Riding Lesson',             segment: 'rider',    requiresHorse: false },
  { code: 'JUMPER_TRAINING',          label: 'Jumper Training',           segment: 'rider',    requiresHorse: false },
  { code: 'HORSEMANSHIP_TRAINING',    label: 'Horsemanship Training',     segment: 'rider',    requiresHorse: false },
  { code: 'INDEPENDENT_CONTRACTOR',   label: 'Independent Contractor',    segment: 'internal', requiresHorse: false },
  { code: 'ONBOARDING',               label: 'Account Onboarding',        segment: 'acquisition',  requiresHorse: false },
];

export const SERVICE_TYPE_BY_CODE: Record<string, ServiceTypeDef> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s.code, s]),
);

export type ServiceTypeCode = (typeof SERVICE_TYPES)[number]['code'];

/** UI label for a service code (falls back to the code itself if unknown). */
export function serviceLabel(code: string): string {
  return SERVICE_TYPE_BY_CODE[code]?.label ?? code;
}

export function isServiceCode(code: string): boolean {
  return code in SERVICE_TYPE_BY_CODE;
}

/**
 * Maps an existing marketing offering slug → canonical service_type code. Mirrors
 * the offerings reconciliation in migration 008; this is the single bridge between
 * the public catalog (offering slugs) and the CRM service types.
 */
export const OFFERING_SLUG_TO_SERVICE_TYPE: Record<string, string> = {
  'riding-lesson': 'RIDING_LESSON',
  'hunter-jumper': 'JUMPER_TRAINING',
  'horsemanship': 'HORSEMANSHIP_TRAINING',
  'horse-training': 'HORSE_TRAINING',
  'horse-exercise': 'HORSE_EXERCISE',
  'riding-turnout': 'HORSE_EXERCISE', // turnout is exercise-family in the 13-service canon
  'hair-clipping': 'HORSE_CLIPPING',
  'horse-locator': 'HORSE_FINDER',
  'evaluation': 'HORSE_EVALUATION',
  'brokering': 'HORSE_PURCHASE_ASSISTANCE',
};

/** Canonical service code for a marketing offering slug — the one bridge between
 *  the public catalog and the CRM. Returns undefined for an unknown slug. */
export function serviceTypeForOfferingSlug(slug: string): string | undefined {
  return OFFERING_SLUG_TO_SERVICE_TYPE[slug];
}
```

Note the docstring says "13-service catalog" but the array holds **14** entries.

The drift-guard test, `test/db/service_catalog.test.ts` — its own header still lists `src/lib/services.ts` as representation #3, a file CLAUDE.md records as RETIRED:

```ts
/**
 * Single-source-of-truth enforcement for the service catalog across all three live
 * representations:
 *   1. the SQL seed (service_types in migration 008)
 *   2. src/lib/serviceCatalog.ts (the front-end canonical list)
 *   3. src/lib/services.ts (the marketing offerings)
 *   4. the DB offerings reconciliation (offerings.service_type)
 *
 * If any drifts, this fails — so a service can be changed in exactly one place and
 * stay correct everywhere.
 */
```

---

## 10. Dead dashboard count helpers — countContacts, countHorses, countOpenBillableLines (`src/lib/api.ts:1375, :1384, :1403`)
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#10]
- reachability: **VERIFIED — claim holds.** `grep -rn "countContacts\|countHorses\|countOpenBillableLines" src/ test/ api/` returns **only the three definition sites** in `src/lib/api.ts`. No gate, no flag — zero call sites anywhere including tests.
- Corroborating contrast: `countOpenDocuments`, which sits *between* them in the same block, **is** consumed — `src/pages/app/ops/OpsDashboard.tsx:5` and `:90` (`draftDocuments: countOpenDocuments`) plus a test stub at `test/ui/pagevis_settings.test.tsx:54`. That is what makes "the tail of a KPI grid that lost two tiles" the right reading: one of four survived.
- Line numbers drifted from the reported :1307/:1316/:1335 to :1375/:1384/:1403.
- exists: **yes**

```ts
// ─── Count helpers (dashboard KPI tiles) ──────────────────────────────────
// head:true + count:'exact' returns the count without transferring rows; RLS
// still scopes the count to the caller's tenant/ownership.

export async function countContacts(): Promise<number> {
  const { count, error } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function countHorses(): Promise<number> {
  const { count, error } = await supabase
    .from('horses')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function countOpenDocuments(): Promise<number> {   // ← THIS ONE IS LIVE (OpsDashboard)
  const { count, error } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)
    .neq('status', 'EXECUTED');
  if (error) throw error;
  return count ?? 0;
}

export async function countOpenBillableLines(): Promise<number> {
  const { count, error } = await supabase
    .from('billable_lines')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'OPEN')
    .is('deleted_at', null);
  if (error) throw error;
  return count ?? 0;
}
```

---

## 11. DealHome (/app/deal) + CareHome (/app/care) (`src/pages/app/DealHome.tsx`, `src/pages/app/CareHome.tsx`)
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#11]
- exists: **yes** (both)
- reachability: **VERIFIED — the redirect claim holds, with one correction: the routes are NOT gated, so both pages are reachable by typing the URL.**

**Where the redirects live** (two sites, identical logic):
- `src/pages/app/DashboardHome.tsx:30-32`
- `src/pages/app/Home.tsx:39-40`

```tsx
// DashboardHome.tsx:29-33
  // Deal/care members have their own purpose-built dashboard.
  if (!surfacesLoading && !surfaces.has_feed) {
    if (surfaces.surfaces.includes('deal_dashboard')) return <Navigate to="/app/deal" replace />;
    if (surfaces.surfaces.includes('care_dashboard')) return <Navigate to="/app/care" replace />;
  }
```

**How `has_feed` is computed** — prod `my_view_surfaces()`:

```sql
DECLARE
  v_cats     text[] := my_purchase_categories();
  v_operator boolean := has_staff_access();
  v_surfaces text[] := ARRAY['dashboard']::text[];  -- always present
BEGIN
  IF v_operator THEN
    v_cats := (SELECT ARRAY(SELECT DISTINCT unnest(v_cats || ARRAY['operator'])));
    v_surfaces := v_surfaces || ARRAY['feed', 'company', 'dashboard'];
  END IF;
  IF 'riding' = ANY(v_cats) THEN
    v_surfaces := v_surfaces || ARRAY['feed', 'community', 'library', 'dashboard'];
  END IF;
  IF 'deal' = ANY(v_cats) THEN v_surfaces := v_surfaces || ARRAY['deal_dashboard']; END IF;
  IF 'care' = ANY(v_cats) THEN v_surfaces := v_surfaces || ARRAY['care_dashboard']; END IF;
  ...
  'has_feed', ('feed' = ANY(v_surfaces)),
```

`my_purchase_categories()` derives categories from purchased `offerings.segment` (`rider`→riding, `support`→deal, `horse`→care) UNION `contacts.tags` (`Rider`→riding, `Horse owner`/`owner`→care, `buyer`/`seller`/`lessee`/`lessor`→deal).

**Prod census of every account** (email | contact tags | purchased offering segments | role):

```
admin@cactai.io              | {}                        |            | SUPER_ADMIN
admin@fhequestrian.com       | {}                        |            | ADMIN
cjzigs@icloud.com            | {Rider,"Horse owner"}     | {rider}    | USER
cjzigs+inviteworks@icloud.com| {}                        |            | USER
cjzigs+inviteworks2@icloud…  | {}                        |            | USER
claire.bourdon21@gmail.com   | {}                        | {horse,rider}| USER
hello@fhequestrian.com       | {}                        |            | ADMIN
madelinedo@gmail.com         | {}                        |            | USER
maeboon@gmail.com            | {Rider,"Horse owner"}     |            | USER
sarahrosengard@gmail.com     | {Rider,"Horse owner"}     |            | USER
zz-test-buyer@example.invalid|                           |            | USER
zz-test-cobuyer@…            |                           |            | USER
zz-test-seller@…             |                           |            | USER
```

Resolving each: the three accounts that DO get `care_dashboard` (cjzigs, maeboon, sarahrosengard — via the `Horse owner` tag) **also** get `riding` from the `Rider` tag, so `has_feed = true` and the `!surfaces.has_feed` guard blocks the redirect. claire.bourdon21 has segments `{horse, rider}` — same collision. Staff/operator accounts get `feed` unconditionally. madelinedo and the three `zz-test-*` accounts have **no** categories at all, so they get neither `deal_dashboard` nor `care_dashboard` and fall through to the normal dashboard. **No production account has a deal/care dashboard without a feed. The redirect condition is never satisfied. Claim confirmed.**

**Correction to the claim:** the routes carry no `ProtectedRoute` or surface gate (`src/App.tsx:254-256`), so any signed-in user reaching `/app/deal` or `/app/care` directly renders the page:

```tsx
              {/* Purpose-built client homes (surface model: care / deal) */}
              <Route path="care" element={<CareHome />} />
              <Route path="deal" element={<DealHome />} />
```

There is no nav link to either (`grep -rn "'/app/deal'\|/app/care" src` returns only the two redirect sites plus CareHome's own docstring). They are unlinked, not unreachable.

### DealHome — full render + copy

```tsx
/*
 * ACQUISITION HOME (/app/deal) — the home screen for a buying/selling client.
 * Where their acquisition process stands and their agreements. All agreements
 * live in Documents; this surfaces the ones that need them and links through.
 *
 * COUNTFIX 1.4 — ONE READER, ONE DEFINITION. This page used to call
 * `my_contract_documents()`, a second definition of "the member's documents".
 * Against `/app/documents` it read 5 vs 11 for one account and 0 vs 6 for three
 * others, so three members saw "nothing here yet" while their Documents page
 * listed six, six and four. It also had no void filter, so both of cjzigs@'s
 * VOIDED leases were rendered under "Agreements that need you" — the page was
 * asking a member to sign two dead documents.
 *
 * It now reads `my_documents()` — the one definition of a member's documents —
 * and filters it to `is_contract`. The count here is deliberately NARROWER than
 * `/app/documents`, and the page says so in words: a subset is honest, an
 * unexplained different number is not.
 */
export default function DealHome() {
  useDocumentTitle('Acquisition');
  ...
  const docs = (rows ?? []).filter((d) => d.is_contract && d.document_id);
  const toSign = docs.filter((d) => d.kind !== 'executed');
  const signed = docs.filter((d) => d.kind === 'executed');
  const totalDocs = (rows ?? []).length;

  return (
    <div className="max-w-4xl mx-auto">
      <header className="mb-6">
        <p className="eyebrow">Acquisition</p>
        <h1 className="font-serif text-2xl text-green-900 mt-0.5">
          {first ? `Welcome, ${first}` : 'Your acquisition'}
        </h1>
      </header>

      {toSign.length > 0 && (
        <section className="bg-gold-50 border border-gold-200 rounded-xl p-5 mb-5">
          <p className="font-medium text-gold-900 mb-2">Agreements that need you</p>
          <ul className="flex flex-col gap-2">
            {toSign.map((d) => (
              <li key={d.document_id}>
                <Link to={`/app/contracts/${d.document_id}`} state={fromHere(location)} className="...">
                  <span className="..."><FileSignature size={16} className="text-green-700" /> {d.title}</span>
                  <span className="text-xs text-gold-800 font-medium">Review &amp; sign →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid sm:grid-cols-2 gap-3 mb-5">
        <Link to="/app/documents" className="...">
          <FileText size={20} className="text-green-700 mb-2" />
          <p className="font-medium text-green-900">Documents</p>
          <p className="text-sm text-muted mt-0.5">Every agreement — to review, sign, or read.</p>
        </Link>
        <Link to="/app/support" className="...">
          <MessageSquare size={20} className="text-green-700 mb-2" />
          <p className="font-medium text-green-900">Talk to us</p>
          <p className="text-sm text-muted mt-0.5">Questions about your buy or sell? Reach our team.</p>
        </Link>
      </section>

      {signed.length > 0 && (
        <section>
          <h2 className="font-serif text-lg text-green-900 mb-2">Signed agreements</h2>
          <ul className="flex flex-col gap-2">
            {signed.map((d) => (
              <li key={d.document_id}>
                <Link to={`/app/contracts/${d.document_id}`} className="...">
                  <span className="..."><CheckCircle2 size={16} className="text-green-700" /> {d.title}</span>
                  <span className="text-xs text-muted">{d.superseded ? 'Signed · superseded' : 'Signed'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* COUNTFIX 1.4: this page shows the CONTRACT subset. When it is empty but
          the member has documents, say which is which — never let two numbers
          that mean different things sit unexplained on two screens. */}
      {rows !== null && docs.length === 0 && (
        <p className="text-sm text-muted">
          {totalDocs > 0 ? (
            <>
              No negotiable agreements yet — your acquisition paperwork will appear here as it
              progresses. Your other {totalDocs} document{totalDocs === 1 ? '' : 's'} {totalDocs === 1 ? 'is' : 'are'} in{' '}
              <Link to="/app/documents" className="link-underline">Documents</Link>.
            </>
          ) : (
            <>Nothing here yet — your agreements and next steps will appear as your acquisition progresses.</>
          )}
        </p>
      )}
    </div>
  );
}
```

### CareHome — full render + copy

```tsx
/*
 * HORSE-CARE HOME (/app/care) — the home screen for a horse-care-services client.
 * Their horses, the documents their horses need signed (services can't begin
 * until those are), and a way to request a care service. Care is booked from
 * here (not the rigid lesson calendar): a request with the horse(s) and the
 * day/date it's wanted — the time is looser than a lesson.
 */
export default function CareHome() {
  useDocumentTitle('Horse care');
  ...
  return (
    <PageLayout
      name="Horse care"
      title={first ? `Welcome, ${first}` : 'Your horse care'}
      onAdd={() => navigate('/app/horse-intake')}
      addLabel="horse"
    >
      {/* documents that gate services */}
      {(pendingDocs.length > 0 || state?.service_blocked) && (
        <section className="bg-gold-50 border border-gold-200 rounded-xl p-5 mb-5">
          <p className="inline-flex items-center gap-2 font-medium text-gold-900 mb-1">
            <AlertTriangle size={17} aria-hidden="true" /> Documents to sign
          </p>
          <p className="text-sm text-gold-900/80 mb-3">
            {state?.service_blocked
              ? 'Your purchased care service can’t begin until these are completed and signed.'
              : 'Please review and sign your horse’s documents.'}
          </p>
          <ul className="flex flex-col gap-2">
            {pendingDocs.map((d) => (
              <li key={d.document_id}>
                <Link to={d.link} className="...">
                  <span className="..."><FileSignature size={16} className="text-green-700" /> {d.title}</span>
                  <span className="text-xs text-gold-800 font-medium">Review &amp; sign →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* request a care service */}
      <section className="bg-white border border-green-800/10 rounded-xl p-5 mb-5">
        <h2 className="font-serif text-lg text-green-900 mb-1">Request a care service</h2>
        <p className="text-sm text-muted mb-3">
          Tell us what you need and which horse it’s for. Choose the day or date you’d like it done —
          care services aren’t tied to a rigid time the way lessons are.
        </p>
        <Link to="/horse-care" className="btn-primary text-sm justify-center inline-flex">
          <CalendarPlus size={16} /> Request a service
        </Link>
      </section>

      {/* my horses */}
      <section>
        <h2 className="font-serif text-lg text-green-900 mb-2">Your horses</h2>
        {horses === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : horses.length === 0 ? (
          <div className="bg-white border border-green-800/10 rounded-lg p-5 text-sm text-muted">
            <p className="mb-3">No horses on file yet. Add your horse so we can prepare its documents and care.</p>
            <Link to="/app/horse-intake" className="btn-secondary text-sm justify-center inline-flex"><Plus size={15} /> Add your horse</Link>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {horses.map((h) => (
              <li key={h.id} className="bg-white border border-green-800/10 rounded-lg px-4 py-3">
                <span className="inline-flex items-center gap-2 text-green-900"><Boxes size={16} className="text-green-700" /> {h.name}</span>
                {h.nickname && h.nickname !== h.name && <span className="block text-xs text-muted mt-0.5">Barn: {h.nickname}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageLayout>
  );
}
```

---

## 12. StaffPage — /app/ops/employees/staff (`src/pages/app/ops/employees/StaffPage.tsx`)
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#12], TASK-REVIEWNAV-REPORT.md [INV batch2.md#42]
- exists: **yes** (path is `src/pages/app/ops/employees/StaffPage.tsx`, not the reported `src/pages/app/ops/StaffPage.tsx`; 183 lines, matching the reported ~184)
- reachability: **CLAIM DOES NOT HOLD ANY MORE — `mod.employees` is ENABLED in prod.**

The route is registered at `src/App.tsx:354`:
```tsx
<Route path="ops/employees/staff" element={<ProtectedRoute requireStaff><StaffPage /></ProtectedRoute>} />
```

The gate is `ModuleGate moduleKey="mod.employees"` at `StaffPage.tsx:92`, fed by `useModules()` → `AuthContext.modules` → the `my_modules()` RPC. Prod:

```
-- select module_key, enabled, source, enabled_at from org_modules
mod.lessons      | t | TIER  | 2026-07-02
mod.brokerage    | t | TIER  | 2026-07-02
mod.horserecords | t | TIER  | 2026-07-02
mod.boarding     | t | GRANT | 2026-08-12 15:02:21+00
mod.barnops      | t | GRANT | 2026-08-12 15:02:21+00
mod.employees    | t | GRANT | 2026-08-12 15:02:21+00     ← ENABLED
```
`expires_at` is NULL on all six, and `my_modules()`'s other condition (`modules.active`) is `t` for all 12 catalog keys. So `my_modules()` returns `mod.employees` and the gate **opens**.

`org_page_visibility` has **0 rows**, so no page-level hide applies either. The nav row `{ to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' }` (`src/components/app/AppLayout.tsx:602`) is therefore also live.

**This page is currently reachable by any staff user.** The report's premise was true when written; the modules were granted 2026-08-12 15:02 UTC. Two in-repo comments still assert the old state and are now stale:
- `src/lib/reviewSection.ts:328` — *"mod.employees is DISABLED for FHE, so this renders ModuleGate's locked fallback. Enabling the module in org_modules is the only way to see the page, and nothing here does that."*
- `src/components/app/AppLayout.tsx:597` — *"the other three modules here are all disabled — meaning this group is now empty for FHE and the 'Modules' heading disappears"*

The "eight shared kit components against TeamPage's zero" part of the claim holds — line 3 imports `ModuleGate, DataTable, Modal, FormField, AsyncButton, StatusBadge, useAsync, useToast`.

```tsx
/**
 * OPS-EMP-STAFF — staff profiles (module mod.employees).
 *
 * Gated by ModuleGate('mod.employees'); with the module off nothing fetches.
 * Staff table: mark an account as staff (title, pay type) and edit via row
 * click — employment fields live ON the profile since Stage 1j; the CRM
 * contact link is the account spine's identity bridge and is not edited here.
 * (Service assignments retired with the engagements teardown — staffing is
 * scheduled via shifts.)
 */

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Staff</h1>
          <p className="text-sm text-green-800/70">Team profiles.</p>
        </div>
      </div>

      <ModuleGate moduleKey="mod.employees" modules={modules}>
        {staff.isError && (
          <p role="alert" className="form-error mb-4">{staff.error?.message ?? 'Could not load staff.'}</p>
        )}

        <div className="mb-3 flex justify-end">
          <button type="button" className="btn-primary" onClick={openCreate}>Add staff member</button>
        </div>
        <DataTable<StaffProfile>
          columns={[
            { key: 'name', header: 'Name', render: (r) => staffDisplayName(r.profile, contactName(r.contact) || 'Unknown staff') },
            { key: 'email', header: 'Email', render: (r) => r.profile?.email ?? '—' },
            { key: 'title', header: 'Title', render: (r) => r.title ?? '—' },
            { key: 'pay', header: 'Pay type', render: (r) => r.pay_type ?? '—' },
            { key: 'active', header: 'Status', render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
          ]}
          rows={staff.data ?? []}
          rowKey={(r) => r.id}
          loading={staff.isPending}
          emptyTitle="No staff yet"
          emptyMessage="Add your first team member to schedule shifts."
          onRowClick={openEdit}
        />

        <Modal
          open={modal !== null}
          onClose={() => setModal(null)}
          title={modal?.mode === 'edit' ? 'Edit staff profile' : 'Add staff member'}
          footer={
            <AsyncButton className="btn-primary" onClick={submitStaff} pendingLabel="Saving…">
              {modal?.mode === 'edit' ? 'Save changes' : 'Create staff profile'}
            </AsyncButton>
          }
        >
          {formError && <p role="alert" className="form-error mb-3">{formError}</p>}
          <FormField label="Team member account" required>
            {({ id, errorClass }) => (
              <select id={id} className={`form-input ${errorClass}`} value={form.profile_user_id}
                disabled={modal?.mode === 'edit'}
                onChange={(e) => setForm((f) => ({ ...f, profile_user_id: e.target.value }))}>
                <option value="">Select an account…</option>
                {(profileOpts.data ?? []).map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.email}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <FormField label="Title"> … </FormField>
          <FormField label="Pay type" hint="e.g. HOURLY, SALARY, PER_SERVICE"> … </FormField>
          {modal?.mode === 'edit' && (
            <FormField label="Active"> …checkbox… </FormField>
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
```
Validation copy: `'Choose the team member’s account.'` · `'Staff profile updated'` · `'Staff profile created'` · `'Could not save the staff profile.'`

The locked fallback it *would* have rendered (`src/components/ops/kit/ModuleGate.tsx:47-58`):
```tsx
      <p className="font-serif text-base text-green-900">Module not enabled</p>
      <p className="mt-1 text-sm text-green-800/70">
        The <span className="font-medium">{moduleKey}</span> module is not active for this
        organization.
      </p>
```

---

## 13. Directory people page — /app/ops/directory, DirectoryPage, ContactsPage 'directory' mode
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#13], TASK-REVIEWNAV-REPORT.md [INV batch2.md#41], TASK-RECORDS-REPORT.md [INV batch3.md#48]
- exists: **yes** — `DirectoryPage` and mode `'directory'` both still in `src/pages/app/ops/ContactsPage.tsx`
- **CONTRADICTION RESOLVED: RECORDS is right, DUPECENSUS/REVIEWNAV are stale.** There is **no live nav entry and no live route** rendering DirectoryPage.

Evidence, both sides:

1. **The route no longer renders the page.** `src/App.tsx:304`:
```tsx
<Route path="ops/directory" element={<Navigate to="/app/records/vendors" replace />} />
```
The path survives (bookmarks land), but it redirects to the Records page's Vendors tab. `grep -n "DirectoryPage" src/App.tsx` → the only hit is a comment at :75 (*"TASK-RECORDS (2026-08-12): Admin (Clients), LeadsPage and DirectoryPage no…"*). **DirectoryPage is not imported by App.tsx.**

2. **The nav entry is inside a comment.** The `/app/ops/directory` string at `src/components/app/AppLayout.tsx:560` sits in a block comment listing the three rows that were removed:
```tsx
  /* REVIEW SECTION — RESOLVED, not restored (TASK-RECORDS, 2026-08-12). The
     three rows TASK-REVIEWNAV moved out —
       { to: '/app/ops/leads',     label: 'Leads',     icon: Users }
       { to: '/app/admin',         label: 'Clients',   icon: Contact }
       { to: '/app/ops/directory', label: 'Directory', icon: BookOpen }
     — do NOT come back as three rows. … The
     single row below is that resolution: one page, five tabs (Leads /
     Clients / Partners / Vendors / Horses), replacing all three old
     destinations — which is why it takes BookOpen (Directory's old icon,
     unclaimed) rather than reviving Users or Contact. */
  { to: '/app/records', label: 'Records', icon: BookOpen },
```
The earlier reports' "LIVE nav entry to an empty page" was true before TASK-RECORDS landed.

**Prod DB confirms both of the data claims:**
```
-- select contact_type, count(*) from contacts group by contact_type
CONTACT | 20
LEAD    |  8
TEAM    |  4
```
**`DIRECTORY` = 0 rows.** And the deprecated value is still accepted:
```sql
-- contacts_contact_type_check
CHECK (((contact_type IS NULL) OR (contact_type = ANY (ARRAY[
  'LEAD'::text, 'CONTACT'::text, 'TEAM'::text, 'DIRECTORY'::text,
  'VENDOR'::text, 'PARTNER'::text]))))
```

**What survives, and why** (`ContactsPage.tsx:38-44, 561-571`):
```tsx
/* TASK-RECORDS (2026-08-12): 'vendors' and 'partners' are the split of the old
 * 'directory' mode (owner: "Vendors and partners are separate"). 'directory'
 * itself stays defined — DIRECTORY is a deprecated-not-removed contact_type
 * and the retired /app/ops/review/contacts mount still reads 'contacts' — but
 * no live page routes to 'directory' any more. 'all' is new: every population
 * this file covers except TEAM, one flat list, for the Records page's All tab. */
type DirectoryMode = 'directory' | 'leads' | 'contacts' | 'vendors' | 'partners' | 'all';

const MODE_TYPE: Partial<Record<DirectoryMode, ContactType>> = {
  directory: 'DIRECTORY', leads: 'LEAD', contacts: 'CONTACT',
  vendors: 'VENDOR', partners: 'PARTNER',
};

export const CONTACTS_PAGE_RETIRED = true;

/*  Kept, not deleted, since 'directory' is still a valid mode */
export function DirectoryPage() {
  return <ContactDirectory mode="directory" />;
}
```

**The directory-mode copy the owner has never seen** — `MODE_COPY.directory`:
```tsx
const MODE_COPY: Record<DirectoryMode, { title: string; blurb: string; newLabel: string }> = {
  directory: {
    title: 'Directory',
    blurb: 'External people and businesses that provide something — farriers, veterinarians, suppliers, service providers, event organizers.',
    newLabel: 'directory entry',
  },
```

**The render it drives** (`ContactDirectory`, shared by all six modes; directory mode gets `filters = []` because `BUSINESS_FILTERS` only applies to `'contacts'`, and never hits the `mode === 'all'` type chip or the `mode === 'leads'` admin action):
```tsx
  return (
    <PageLayout
      name={MODE_COPY[mode].title}            // "Directory"
      description={MODE_COPY[mode].blurb}     // "External people and businesses that provide something — …"
      width="wide"
      onAdd={() => { setFormError(null); setCreating(true); }}
      addLabel={MODE_COPY[mode].newLabel}     // "directory entry"
    >
      {/* Unfiled: a contact with no contact_type belongs to no page, so without
          this it would be invisible everywhere. Shown on every person-page so it
          cannot be missed, with one-click filing. */}
      {unfiled.length > 0 && (
        <div className="mb-5 rounded-xl border border-gold-600/40 bg-gold-50 p-4">
          <p className="text-sm font-semibold text-gold-900 mb-2.5">
            {unfiled.length} Unfiled {unfiled.length === 1 ? 'Person' : 'People'}
          </p>
          …
      )}
      …
          <button key={r.id} type="button" onClick={() => setOpen(r)} className="…">
            <div className="flex items-center gap-3 mb-2.5">
              <span className="w-11 h-11 rounded-full bg-green-100 …">{initials(r)}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-green-900 truncate">{contactName(r) || r.email || '—'}</p>
                <p className="text-[11px] text-muted truncate">{r.email ?? r.phone ?? 'no contact info'}</p>
              </div>
            </div>
            <Chips r={r} />
            {depthLine(r) && <p className="text-[11px] text-muted mt-2">{depthLine(r)}</p>}
          </button>
        ))}
      </div>
      {rows !== null && visible.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No contacts match.</p>
      )}
```
With `DIRECTORY` at 0 rows, the page's entire body would be the `"No contacts match."` line (plus the Unfiled card if any contact had a NULL type).

Chip vocabulary it can emit (`CHIP_TONE`): `Client` · `Team` · `Counterparty` · `Horse owner` · `Lessee` · `Lead`.
Depth line format: `"N engagements · N documents · N horses"`.

---

## 14. Inline body-preview block behind INLINE_BODY_PREVIEW_RETIRED (`src/pages/app/ContractPage.tsx`)
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#14], TASK-ONEAUTHOR-REPORT.md [INV batch4.md#68]
- exists: **yes**
- reachability: **VERIFIED — claim holds.** `grep -n "INLINE_BODY_PREVIEW_RETIRED" src/pages/app/ContractPage.tsx`:
  - `:86` — `const INLINE_BODY_PREVIEW_RETIRED = true;` (module-scope const, no override, not exported, never reassigned)
  - `:2022` — `{!INLINE_BODY_PREVIEW_RETIRED && (`
  The guard is a compile-time-constant `true`, so the block is statically unreachable. Correct that it is a block inside a live page, not a page or route of its own.
- Note: the block's own state `showBody` is initialized `true` at `:297`, so had the flag been flipped the section would render **expanded**, with its toggle reading `"Hide the document text"` — not the collapsed `"Review the document text"` the reports name.

Guarded block plus its preceding rationale comment, verbatim (`:2015-2035`):

```tsx
      {/* The pre-executed "document preview" (collapsible merged_body) is gone:
          the clause-model authoring surface above IS the full document in context
          — every clause's prose renders with its inputs inline, selected and
          unselected alike.
          TASK ONEAUTHOR: the flat fall-through that used to live here moved UP into
          the one body slot, beside <ClauseDocument>, as <FlatDocument>. Retired
          behind INLINE_BODY_PREVIEW_RETIRED, never deleted. */}
      {!INLINE_BODY_PREVIEW_RETIRED && (
        <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
          <button type="button" className="font-serif text-green-800 underline-offset-4 hover:underline"
            onClick={() => setShowBody((v) => !v)}>
            {showBody ? 'Hide' : 'Review'} the document text
          </button>
          {showBody && (
            <div className="document-paper mt-3 whitespace-pre-line text-[13px] leading-relaxed text-green-950">
              <ContractBody body={doc.merged_body} />
            </div>
          )}
        </section>
      )}
```

For contrast, the live body section immediately above it (`:2005-2012`) that replaced it:
```tsx
                : state === 'locked'
                  ? 'The document is final and locked for signing. Review it below, then sign at the bottom of the page.'
                  : 'Review the full document below. It will be locked for signing once both sides are ready. To request a change, use “Suggest a change” on the item or message the other party.'}
          </p>
          <div className="document-paper whitespace-pre-line text-[13.5px] leading-relaxed text-green-950">
            <ContractBody body={doc.merged_body} />
          </div>
        </section>
      )}
```

---

## 15. Dark module pages: /app/ops/boarding/*, /app/ops/barnops/*, /app/ops/employees/*
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#15]
- exists: **yes — all 11 files (3 hubs + 8 leaves)**
- reachability: **CLAIM DOES NOT HOLD ANY MORE.** Same finding as #12: `mod.boarding`, `mod.barnops` and `mod.employees` were all **granted 2026-08-12 15:02:21 UTC** (`org_modules.source = 'GRANT'`, `enabled = t`, `expires_at` NULL). `modules.active = t` for all three. `my_modules()` returns all six tenant keys, so every `ModuleGate` below **opens**, and the two nav rows at `AppLayout.tsx:590-591` plus `:602` are live. `org_page_visibility` is empty (0 rows), so no page-level hide applies.

Every one of these 11 pages is currently reachable by a staff user. They are unviewed, not locked.

### File → route inventory

| File | Route | Registered at |
|---|---|---|
| `src/pages/app/ops/hubs/BoardingHubPage.tsx` | `/app/ops/boarding` | App.tsx:337 |
| `src/pages/app/ops/boarding/FacilitiesPage.tsx` | `/app/ops/boarding/facilities` | App.tsx:338 |
| `src/pages/app/ops/boarding/BoardAgreementsPage.tsx` | `/app/ops/boarding/agreements` | App.tsx:339 |
| `src/pages/app/ops/boarding/BoardChargesPage.tsx` | `/app/ops/boarding/charges` | App.tsx:340 |
| `src/pages/app/ops/hubs/BarnopsHubPage.tsx` | `/app/ops/barnops` | App.tsx:341 |
| `src/pages/app/ops/barnops/ResourcesPage.tsx` | `/app/ops/barnops/resources` | App.tsx:342 |
| `src/pages/app/ops/barnops/ConsumptionLogPage.tsx` | `/app/ops/barnops/consumption` | App.tsx:343 |
| `src/pages/app/ops/barnops/AllocationRulesPage.tsx` | `/app/ops/barnops/allocation-rules` | App.tsx:344 |
| `src/pages/app/ops/hubs/EmployeesHubPage.tsx` | `/app/ops/employees` | App.tsx:353 |
| `src/pages/app/ops/employees/StaffPage.tsx` | `/app/ops/employees/staff` | App.tsx:354 (see #12) |
| `src/pages/app/ops/employees/SchedulePage.tsx` | `/app/ops/employees/schedule` | App.tsx:355 |

All eleven are wrapped `<ProtectedRoute requireStaff>` in App.tsx. There is **no** `/app/ops/brokerage` hub — deliberately, per `AppLayout.tsx:587-589`: *"Brokerage has no staff hub page yet … the entry linked to an unregistered route and 404'd for every staff user with the module on."*

Also registered in `src/lib/pageRegistry.ts:159-171` with `group: 'modules'` and the matching `module:` key, keyed `boarding.hub`, `boarding.facilities`, `boarding.agreements`, `boarding.charges`, `barnops.hub`, `barnops.resources`, `barnops.consumption`, `barnops.allocation_rules`, `employees.hub`, `employees.staff`, `employees.schedule`.

### BOARDING

**Hub — `/app/ops/boarding`** · doc title `'Boarding · Ops'`
```tsx
        <header className="mb-6">
          <h1 className="font-serif text-2xl text-green-900">Boarding</h1>
          <p className="text-sm text-green-800/70">
            Facilities, stalls, agreements and board billing.
          </p>
        </header>
```
KPI tiles: `Stall occupancy` (`{occupied} / {total} ({pct}%)`), `Active agreements`, `Open board charges` (count + `<Money>`). Loading branch `Loading…`; error `'Could not load boarding KPIs.'` Nav cards:
```tsx
const LINKS = [
  { to: '/app/ops/boarding/facilities', title: 'Facilities & stalls',
    description: 'Manage properties and the stalls within them.' },
  { to: '/app/ops/boarding/agreements', title: 'Board agreements',
    description: 'Per-horse contracts: boarder, stall, monthly rate, status.' },
  { to: '/app/ops/boarding/charges',    title: 'Board charges',
    description: 'Generate period charges and follow them to settlement.' },
] as const;
```

**Facilities & stalls — `/app/ops/boarding/facilities`** · doc title `'Facilities · Boarding'` · 453 lines
Two sections, `<h1>Facilities</h1>` and `<h2>Stalls</h2>`.
- Facilities table: `Name` · `Address key` · `Stalls`. Empty: `"No facilities yet"` / `"Create your first facility to start assigning stalls."`
- Stalls table: `Code` · `Facility` · `Type` · `Status`. Empty: `"No stalls yet"` / `"Add stalls under a facility to track occupancy."`
- Facility form: `Name` (required) · `Address registry key`, hint `"Registry key (CONTACT/ADDRESS.*) resolving the facility address."`
- Stall form: `Facility` (required, placeholder `"Select a facility…"`) · `Code` (required) · `Stall type`, hint `"e.g. 12x12, foaling, paddock."` · `Active`

**Board agreements — `/app/ops/boarding/agreements`** · doc title `'Board agreements · Boarding'` · 408 lines
```tsx
            <h1 className="font-serif text-2xl text-green-900">Board agreements</h1>
            <p className="text-sm text-green-800/70">
              Per-horse boarding contracts. Agreements archive by status — never delete.
            </p>
```
Table: `Horse` · `Boarder` · `Stall` · `Monthly rate` · `Start` · `Status` · (sr-only `Transitions`). Empty: `"No board agreements yet"` / `"Create an agreement to link a horse, a payer and a stall."`
Modal `"New board agreement"`: `Horse` (req, `"Select a horse…"`) · `Boarder` (req, hint `"The payer contact board charges bill to."`, `"Select a contact…"`) · `Stall` (`"Unassigned"`) · `Monthly rate` (hint `"Leave blank to use the tenant default board rate from the registry."`) · `Board type` (hint `"e.g. full, pasture, training."`) · `Start date`

**Board charges — `/app/ops/boarding/charges`** · doc title `'Board charges · Boarding'` · 368 lines
```tsx
            <h1 className="font-serif text-2xl text-green-900">Board charges</h1>
            <p className="text-sm text-green-800/70">
              Period charges emitted to billing.
            </p>
```
Table: `Agreement` · `Period` · `Amount` · `Billing` · (actions; settled state renders `Emitted`). Empty: `"No board charges yet"` / `"Generate a period charge from an active agreement."`
Modal `"Generate board charge"`: `Agreement` (req, `"Select an agreement…"`) · `Period start` (req) · `Period end` (req) · `Amount` (req, hint `"Prefilled from the agreement's monthly rate."`)

### BARN OPS

**Hub — `/app/ops/barnops`** · `<title>Barn Ops · Ops</title>`
```tsx
          <h1 className="font-serif text-2xl text-green-900">Barn Ops</h1>
          <p className="text-sm text-green-800/70">
            Inventory, consumption, and cost attribution for the barn.
          </p>
```
```tsx
const CARDS = [
  { to: '/app/ops/barnops/resources', title: 'Resources & lots',
    description: 'Consumables catalog with stock levels computed from purchased lots.',
    countKey: 'resources', countLabel: 'resources' },
  { to: '/app/ops/barnops/consumption', title: 'Consumption log',
    description: 'Append-only usage ledger — dumb, cheap facts priced later at resolution.',
    countKey: 'events', countLabel: 'recent events' },
  { to: '/app/ops/barnops/allocation-rules', title: 'Allocation & billing',
    description: 'Cost attribution overrides + the deterministic billing resolver.',
    countKey: 'rules', countLabel: 'rules' },
];
```
Error: `'Could not load barn ops counts.'`

**Resources — `/app/ops/barnops/resources`** · `<title>Resources · Barn Ops</title>` · 546 lines
```tsx
            <h1 className="font-serif text-2xl text-green-900">Resources</h1>
            <p className="text-sm text-green-800/70">
              Consumables catalog — stock levels are the sum of on-hand across purchased lots.
            </p>
```
Resources table: `Name` · `Key` · `Category` · `Unit` · `On hand`. Empty: `"No resources yet"` / `"Create a resource, then record purchased lots against it."`
Lots section `<h2>` + table `Resource` · `Vendor` · `Purchased` · `Unit cost` · `On hand` · `Purchased at`. Empty: `"No lots yet"` / `"Use “Add lot” on a resource to record a purchase."`
Forms: `Resource key` (req) · `Name` (req) · `Category` (req) · `Unit of measure`; lot form `Vendor` · `Quantity purchased` (req) · `Unit cost` (req, hint `"Cost per unit; the resolver prices consumption from the drawn lot."`)

**Consumption log — `/app/ops/barnops/consumption`** · `<title>Consumption log · Barn Ops</title>` · 330 lines
```tsx
          <h1 className="font-serif text-2xl text-green-900">Consumption log</h1>
          <p className="text-sm text-green-800/70">
            Append-only ledger — logged events cannot be edited or deleted; corrections are new
            offsetting events. Pricing happens later, at billing resolution.
          </p>
```
Capture form fields: `Resource` (req) · `Lot`, hint `"Optional — the drawn lot prices the event at resolution."` · `Horse`, hint `"Optional — attribution falls to the barn when blank."` · `Quantity` (req) · `Occurred at`, hint `"Leave blank to record “now”."` · `Notes`
Log table: `When` · `Resource` · `Lot` · `Horse` · `Qty` · `Notes`. Empty: `"No consumption logged yet"` / `"Log the first event with the form above."`

**Cost allocation rules — `/app/ops/barnops/allocation-rules`** · `<title>Allocation rules · Barn Ops</title>` · 532 lines
```tsx
            <h1 className="font-serif text-2xl text-green-900">Cost allocation rules</h1>
            <p className="text-sm text-green-800/70">
              Overrides for consumption attribution — plus the default/barn payer that absorbs
              uncovered remainders.
            </p>
```
Rules table: `Scope` · `Target` · `Payer` · `Share %` · `Effective`. Empty title `"No allocation rules yet"`, message:
> `"Without an override, attribution derives from each horse's parties; add a 'default' rule for the barn payer."`

Form: `Scope`, hint `"'default' names the barn payer that absorbs uncovered remainders."` · `Horse` (req) · (target id) hint `"The scoped record's UUID."` · `Payer` (req) · `Share %` (req, hint `"Splits for a scope should sum to 100."`) · `Effective from` · `Effective to`
Second section:
```tsx
          <h2 id="resolve-heading" className="font-serif text-lg text-green-900 mb-2">
            Resolve billing
          </h2>
          <p className="text-sm text-green-800/70 mb-4">
            Deterministically turns the period's consumption events into billable lines per payer
            (override → horse parties → barn default). Safe to re-run: a re-run replaces its own
            open lines for the period.
          </p>
```
Resolve form `Period (month)` (req); results table `Payer` · `Horse` · `Qty` · `Unit` · `Amount` · `Status`; empty `"No billable lines produced"`.

### EMPLOYEES

**Hub — `/app/ops/employees`**
```tsx
        <h1 className="font-serif text-2xl text-green-900">Employees</h1>
        <p className="text-sm text-green-800/70">Staff, schedules and service assignments.</p>
```
Two KPI link-tiles: `Active staff` → `/app/ops/employees/staff`, `Shifts this week` → `/app/ops/employees/schedule`. Error: `'Could not load the employees summary.'` Loading: `Loading…`
(Copy is stale against the code: the subtitle still promises "service assignments", which StaffPage's own docstring says were "retired with the engagements teardown".)

**Staff — `/app/ops/employees/staff`** — full content in artifact **#12** above.

**Schedule — `/app/ops/employees/schedule`** · 237 lines
```tsx
          <h1 className="font-serif text-2xl text-green-900">Schedule</h1>
          <p className="text-sm text-green-800/70">
            Week of {week.start.toLocaleDateString()} – {new Date(week.end.getTime() - 1).toLocaleDateString()}
          </p>
```
Week nav `← Prev week` / (next). Button `New shift`. Table: `Staff` · `Starts` · `Ends` · `Role`. Empty: `"No shifts this week"` / `"Create a shift to build the week's schedule."`
Modal `"New shift"`: `Staff member` (req, `"Select…"`) · `Starts` (req) · `Ends` · `Role`, hint interpolates the tenant facility word — `` hint={`e.g. ${titleCase(propertyTerm)} duty, Lessons, Show prep`} `` (the TASK-FACILITYTERM tenant-chosen term).
Time entries: `Clock in` (req) · `Clock out`; empty `"No entries yet."`; buttons `"Creating…"` / `"Recording…"`.

---

## 16. PDF body renderer (`src/lib/documentPdf.ts`)
- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#16]
- exists: **yes** (140 lines)
- reachability: **The "no route, cannot be mounted as a page" half is correct. The implied "unreachable" is NOT — it has four live call sites and runs whenever a member clicks Download PDF.**

Live callers of the **client** module (all dynamic or direct imports, all reachable):
- `src/components/app/DocumentsContent.tsx:125-126` — `const { downloadDocumentPdf } = await import('../../lib/documentPdf'); await downloadDocumentPdf(doc.title, text);`
- `src/components/app/DocumentsContent.tsx:268-269` — same, `doc.title ?? 'Document'`, `doc.merged_body ?? ''`
- `src/lib/acquisition.ts:80` (static import) and `:173` — `await downloadDocumentPdf(heading, report.body ?? '')`

The REVIEWNAV slot note is the source of the claim (`src/lib/reviewSection.ts:283-287`):
```ts
        slot: 'C', label: 'Body C · the PDF renderer', to: '', navRow: false,
        what: 'src/lib/documentPdf.ts — a third implementation of the same plain-text body regex, and the third one that disagrees with the other two.',
        warn: 'NOT MOUNTED. It is a non-React PDF writer with no component and no route; nothing was invented to give it one. To compare it, email or download a signed copy of the same document.',
```
That is accurate as written — it cannot be put in the review nav — but it is not dark code. What the owner has never *seen side by side with slots A and B* is its layout, which differs from both.

There is a **separate server twin** at `api/_lib/documentPdf.ts` (same layout by design, plus a `partyPdfFileName`), used by `api/deliver-documents.ts`, `api/deliver-evaluation-report.ts`, `api/delete-document-with-copy.ts`, `api/contract-working-copy.ts`, `api/_lib/delivery.ts`.

### Layout / typography constants and the literal output

```ts
/* documentPdf (client) — render a document's plain-text merged_body to a PDF in
 * the browser and trigger a download. This is the client twin of
 * api/_lib/documentPdf.ts (same pdf-lib layout) so the in-app "Download PDF"
 * matches the emailed copy. Render-on-demand: the DB merged_body (+ its
 * execution_hash) is the canonical record; the PDF is produced on the fly.
 *
 * This module imports pdf-lib, so callers should DYNAMIC-import it
 * (`await import('../lib/documentPdf')`) — pdf-lib then code-splits out of the
 * main bundle and only loads when a member actually clicks Download.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 54; // 0.75"
const FONT_SIZE = 10;
const LINE_H = 14;
const HEADING_SIZE = 11;

function isHeading(line: string): boolean {
  const t = line.trim();
  if (t === '') return false;
  if (/^\d+\.\s+[A-Z]/.test(t)) return true;
  if (t.length <= 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  return false;
}

const SIGNATURE_LINE = /^(\s*(?:Signature|By \(signature\)):\s*)(.+)$/;
function signatureSplit(line: string): [string, string] | null {
  const m = SIGNATURE_LINE.exec(line);
  return m ? [m[1], m[2]] : null;
}
```

```ts
/** Render one document body to PDF bytes, with the document title as a centered
 *  heading at the top (the composed body does not include the title). */
export async function renderDocumentPdf(title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font   = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold   = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const maxWidth = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Document title — centered heading at the very top, then a little gap.
  const titleText = (title || 'Document').trim();
  if (titleText) {
    const TITLE_SIZE = 16;
    const tw = bold.widthOfTextAtSize(titleText, TITLE_SIZE);
    page.drawText(titleText, {
      x: Math.max(MARGIN, (PAGE_W - tw) / 2),
      y, size: TITLE_SIZE, font: bold, color: rgb(0.1, 0.12, 0.1),
    });
    y -= TITLE_SIZE + 10;
  }

  const newlineIfNeeded = () => {
    if (y < MARGIN + LINE_H) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const drawLine = (text: string, whichFont: PDFFont, size: number) => {
    newlineIfNeeded();
    if (text !== '') {
      page.drawText(text, { x: MARGIN, y, size, font: whichFont, color: rgb(0.1, 0.12, 0.1) });
    }
    y -= size === HEADING_SIZE ? LINE_H + 2 : LINE_H;
  };
  const drawSignatureLine = (label: string, value: string) => {
    newlineIfNeeded();
    const labelW = font.widthOfTextAtSize(label, FONT_SIZE);
    page.drawText(label, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.1, 0.12, 0.1) });
    page.drawText(value, { x: MARGIN + labelW, y: y - 1, size: FONT_SIZE + 3, font: italic, color: rgb(0.12, 0.14, 0.28) });
    y -= LINE_H + 2;
  };

  for (const raw of (body || '').replace(/\r\n/g, '\n').split('\n')) {
    if (raw.trim() === '') { y -= LINE_H * 0.5; continue; }
    const sig = signatureSplit(raw);
    if (sig) { drawSignatureLine(sig[0], sig[1]); continue; }
    const heading = isHeading(raw);
    const size = heading ? HEADING_SIZE : FONT_SIZE;
    const useFont = heading ? bold : font;
    for (const wrapped of wrap(raw, useFont, size, maxWidth)) drawLine(wrapped, useFont, size);
  }

  return pdf.save();
}

export function pdfFileName(title: string): string {
  const base = (title || 'Document').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return `${base || 'Document'}.pdf`;
}

/** Render `body` and trigger a browser download named from `title`. */
export async function downloadDocumentPdf(title: string, body: string): Promise<void> {
  const bytes = await renderDocumentPdf(title, body);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFileName(title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

**Every literal string this module prints or produces** — the complete list, which is short and is the point:
- **Title text**: the passed `title`, or the literal fallback **`'Document'`**. Times-Roman **Bold 16pt**, horizontally centered, at the top margin of page 1 only.
- **Filename**: `<title sanitized to [A-Za-z0-9-], ≤80 chars>.pdf`, or the literal **`'Document.pdf'`** when the title sanitizes to empty.
- **Everything else is passthrough from `merged_body`.** The renderer prints **no header, no footer, no page numbers, and no signature-block labels of its own.**

**Owner-relevant consequences of that last point:**
1. **There is no page numbering and no running header/footer.** A multi-page executed agreement's pages are not numbered or identified. Page breaks are purely mechanical (`y < MARGIN + LINE_H` → new page); there is no widow/orphan or keep-with-heading logic, so a numbered clause heading can land as the last line of a page.
2. **Signature block labels are not printed by this file — they are matched.** `SIGNATURE_LINE` only recognizes the two literal prefixes **`Signature:`** and **`By (signature):`** (leading whitespace allowed). A matching line is split and the *value* re-drawn in **Times-Roman Italic at 13pt** (FONT_SIZE + 3) in a blue-black (`rgb(0.12,0.14,0.28)`) versus the body's near-black (`rgb(0.1,0.12,0.1)`) — the signature-script effect. **Any other signature label wording in a template renders as ordinary 10pt body text with no script styling.**
3. **Heading detection is heuristic, not structural**: a line is bolded at 11pt if it matches `^\d+\.\s+[A-Z]` **or** is ≤60 chars and entirely uppercase. An all-caps line of legal boilerplate under 60 chars will be styled as a heading.
4. `execution_hash` is named in the docstring as the canonical anchor but is **not printed on the PDF**.

---

# Verification corrections — three reported claims are now stale

1. **#12 StaffPage and #15 dark module pages are NOT module-locked.** `mod.boarding`, `mod.barnops` and `mod.employees` were all granted in prod on **2026-08-12 15:02:21 UTC** (`org_modules.source='GRANT'`, `enabled=t`, `expires_at` NULL; `modules.active=t`). `my_modules()` returns them, so all 11 pages plus their two nav rows are **live for staff today**. `org_page_visibility` is empty (0 rows). Stale assertions still in the code: `src/lib/reviewSection.ts:328` and `src/components/app/AppLayout.tsx:597`.
2. **#13 Directory contradiction resolved in RECORDS' favour.** No live route (`src/App.tsx:304` redirects `/app/ops/directory` → `/app/records/vendors`), and the nav row exists only inside a comment (`src/components/app/AppLayout.tsx:560`). The earlier "LIVE nav entry" was true pre-TASK-RECORDS. Both DB claims confirmed: `contact_type='DIRECTORY'` = **0 rows**, and `contacts_contact_type_check` still accepts `'DIRECTORY'`.
3. **#16 documentPdf.ts is not dark.** It has four live call sites (`DocumentsContent.tsx:125,268`; `acquisition.ts:80,173`) and runs on every in-app Download PDF. Only the narrow REVIEWNAV claim — that it cannot be *mounted as a page for side-by-side comparison* — is correct.

Confirmed as reported, unchanged: **#9** (zero `src/` importers, test-only), **#10** (zero call sites for all three; `countOpenDocuments` beside them is live), **#11** (`!surfaces.has_feed` never true for any of the 13 prod accounts — though the routes themselves are ungated and directly navigable), **#14** (`INLINE_BODY_PREVIEW_RETIRED = true` module const, statically unreachable).

Nothing was changed. Nothing is recommended for deletion.
