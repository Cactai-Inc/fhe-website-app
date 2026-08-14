# FLAGHARVEST — Unviewed inventory, part 1 (artifacts 1–8)

Read-only pass. Nothing was changed. Nothing below is recommended for deletion —
these are surfaces the owner has not yet seen, documented so they can be judged.

Worktree: `/Users/Cactai/Downloads/claude-code-repo/wt-flagharvest` @ `86283dc`
Prod DB: SELECT-only queries via `.env.db`.

**Standing correction that applies to six of these eight:** the claims in the source
reports were written before TASK-REVIEWNAV shipped. `src/lib/reviewSection.ts` now
gives most of these artifacts an **admin-only nav row** under a nav group literally
labelled "Review". So "unreachable / URL-only" is no longer literally true for
artifacts 2, 3, 4, 5, 6, 7 and 8 — they are reachable, deliberately, so the owner can
look at them. Each block below states the current gate precisely.

---

## 1. myContractDocuments() + my_contract_documents RPC (`src/lib/contracts.ts:218` / prod `public.my_contract_documents()`)

- reported by: TASK-COUNTFIX-REPORT.md [INV batch1.md#1]
- reachability: **verified — the TS wrapper has zero call sites.** `grep -rn "myContractDocuments" src api test` returns only (a) its own definition at `src/lib/contracts.ts:218`, (b) a prose mention in a comment block at `src/lib/api.ts:2119`, and (c) a prose mention at `src/pages/app/DealHome.tsx:15`. There is no gate or flag — it is simply un-called. It is not dead in the DB, though: `test/db/contract_workflow.test.ts:418-423` still exercises the RPC directly (`select my_contract_documents()`), so the SQL side has a live test.
- exists: **yes — both.** Prod confirms `my_contract_documents` exists, returns `jsonb`, `prosecdef = true` (SECURITY DEFINER).
- content:

The TS wrapper, with the annotation COUNTFIX left on it (this comment is the artifact —
it names the two traps for anyone who re-wires it):

```ts
export interface MyContractRow {
  document_id: string;
  title: string;
  workflow_state: string;
  status: string;
  created_at?: string;
}

/** NO LONGER A LIST READER (COUNTFIX 1.4). `/app/deal` was its only consumer and
 *  now reads `my_documents()` filtered to `is_contract`, so a member's documents
 *  have exactly one definition. Kept — not deleted — because the RPC carries
 *  per-party fields (`my_roles`, `is_originator`, `open_change_requests`,
 *  `my_archived_at`) that no other reader exposes, and a future
 *  contracts-specific surface may want them. Two cautions if it is ever wired up
 *  again: it has NO void filter (it returned two VOIDED leases as agreements
 *  needing signature), and its staff branch returns the whole org, not "mine". */
export async function myContractDocuments(): Promise<MyContractRow[]> {
  const { data, error } = await supabase.rpc('my_contract_documents');
  if (error) throw error;
  return (data ?? []) as MyContractRow[];
}
```

The RPC as it stands in **production right now** (`select proname, pg_get_function_result(oid), prosecdef`):

```
my_contract_documents | jsonb | t
```

Its production COMMENT — i.e. what the database itself says this function is for:

```
The caller's contract documents (those carrying structured contract_fields where they
are a party): document_id, title, status, workflow_state, recipient_editing,
execution_hash, is_originator, my_roles (csv), open_change_requests. jsonb array,
newest first. The list read model a UI binds to.
```

Note the mismatch worth the owner's eye: the DB comment still calls it *"the list read
model a UI binds to"*, and no UI binds to it. The RPC has been rewritten by at least
seven migrations (`20260705010000`, `20260713190000`, `20260715160000`,
`20260716170001`, `20260723570000`, `20260729043000`, `20260729050000`) — it is a
heavily-maintained function with no frontend reader.

---

## 2. HorsesPage — /app/ops/horses (`src/pages/app/ops/HorsesPage.tsx`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#2], TASK-REVIEWNAV-REPORT.md [INV batch2.md#37]
- reachability: **verified — the "zero references" claim is now STALE.** It is routed at `src/App.tsx:306` (`<Route path="ops/horses" ... requireStaff>`), and it now has exactly one linker: `src/lib/reviewSection.ts:106`, the Review nav entry `slot: 'B', label: 'Horses B · 07-01 original', to: '/app/ops/horses'`. That array feeds `REVIEW_NAV_ITEMS` (`reviewSection.ts:356-361`, every row hard-coded `adminOnly: true`), which is rendered as the `review` nav group at `src/components/app/AppLayout.tsx:696-702`. So today: **admin-only nav row, present and clickable.** Outside Review, still nothing points at it — grep for `/app/ops/horses` across `src` and `api` returns only App.tsx:306 and reviewSection.ts:106. The nav's own Horses row goes elsewhere: `AppLayout.tsx:511` → `/app/ops/horse-records`.
- exists: **yes**
- content:

The whole page is 127 lines. Its render section and every user-visible string:

```tsx
  return (
    <div className="space-y-6">
      <Helmet>
        <title>Horses · Ops</title>
      </Helmet>

      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Horses</h1>
          <p className="text-sm text-green-800/70">Roster of horses {propertyTerm.preposition} your {propertyTerm.term}.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setModal({ mode: 'create' })}>
          New horse
        </button>
      </header>

      {loadError ? (
        <div role="alert" className="form-error">
          {loadError}
        </div>
      ) : (
        <HorseTable
          horses={horses}
          breeds={breeds}
          colors={colors}
          owners={owners}
          loading={loading}
          onRowClick={(horse) => setModal({ mode: 'edit', horse })}
        />
      )}

      <Modal
        open={modal.mode !== 'closed'}
        onClose={() => setModal({ mode: 'closed' })}
        title={modal.mode === 'edit' ? 'Edit horse' : 'New horse'}
        disableBackdropClose
      >
        {modal.mode !== 'closed' && (
          <HorseForm
            breeds={breeds}
            colors={colors}
            owners={owners}
            horse={modal.mode === 'edit' ? modal.horse : null}
            onSubmit={modal.mode === 'edit' ? handleUpdate(modal.horse.id) : handleCreate}
            onCancel={() => setModal({ mode: 'closed' })}
          />
        )}
      </Modal>
    </div>
  );
```

Its loader — the reason it can resolve lookups at all, i.e. it fetches the two lookup
tables alongside the roster, which the other two horse pages do not:

```tsx
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [h, b, c, o] = await Promise.all([
        listHorses(),
        listHorseBreeds(),
        listHorseColors(),
        listContacts(),
      ]);
      setHorses(h);
      setBreeds(b);
      setColors(c);
      setOwners(o);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load horses.'));
    } finally {
      setLoading(false);
    }
  }, []);
```

**The claimed unique value — breed/colour code→name resolution.** It does not live in
HorsesPage itself; it lives in the table component HorsesPage is the only caller of,
`src/components/ops/horses/HorseTable.tsx`. Both files are part of the artifact:

```tsx
/**
 * Roster table for horses: name (barn / registered), breed, color, primary
 * owner. Breed/color codes are resolved to display names via the injected
 * lookups; the owner id resolves against the contacts list. Clicking a row
 * invokes `onRowClick(horse)` (the edit path).
 */
export interface HorseTableProps {
  horses: Horse[];
  breeds: LookupCode[];
  colors: LookupCode[];
  owners: Contact[];
  loading?: boolean;
  onRowClick: (horse: Horse) => void;
}

function lookupName(list: LookupCode[], code: string | null): string {
  if (!code) return '—';
  return list.find((l) => l.code === code)?.display_name ?? code;
}

export function HorseTable({ horses, breeds, colors, owners, loading, onRowClick }: HorseTableProps) {
  const columns: Column<Horse>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (h) => (
        <span className="font-medium">
          {h.nickname ?? h.registered_name ?? '—'}
        </span>
      ),
    },
    { key: 'breed', header: 'Breed', render: (h) => lookupName(breeds, h.breed) },
    { key: 'color', header: 'Color', render: (h) => lookupName(colors, h.color) },
    {
      key: 'owner',
      header: 'Primary owner',
      render: (h) => {
        if (!h.current_owner_contact_id) return '—';
        const owner = owners.find((o) => o.id === h.current_owner_contact_id);
        return owner ? contactName(owner) || '—' : '—';
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={horses}
      rowKey={(h) => h.id}
      loading={loading}
      onRowClick={onRowClick}
      emptyTitle="No horses yet"
      emptyMessage="Add your first horse to build the roster."
    />
  );
```

`lookupName` is a three-line fallback-to-code resolver — that is the entirety of the
"only implementation that resolves breed/colour lookups to names" claim.

---

## 3. OpsHome + OpsDashboard — /app/ops (`src/pages/app/OpsHome.tsx`, `src/pages/app/ops/OpsDashboard.tsx`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#3], TASK-ADMINSWEEP-PHASE2.md [INV batch4.md#65]
- reachability: **verified on both halves.** (a) The **permanent nav still has no `/app/ops` row** — `grep -n "to: '/app/ops'" src/components/app/AppLayout.tsx` returns nothing (every hit in that file is a deeper path like `/app/ops/documents`). The row ADMINSWEEP Phase 2 specified, `{ to: '/app/ops', label: 'Operations', icon: Gauge }` (`docs/reports/TASK-ADMINSWEEP-PHASE2.md:182`), was **never applied** — confirmed absent. (b) It nonetheless has an admin-only Review row today: `src/lib/reviewSection.ts:128-130`, `slot: 'B', label: 'Staff home B · OpsDashboard', to: '/app/ops'`, plus a second non-nav entry as Inbound slot D (`reviewSection.ts:158-160`, `navRow: false`). Route: `src/App.tsx:279`, `requireStaff`. So: **no permanent nav entry; one temporary admin-only Review entry; otherwise URL-only.**
- exists: **yes — both files.**
- content:

`OpsHome.tsx` in full (14 lines — it is a role switch, nothing more):

```tsx
import { useAuth } from '../../contexts/AuthContext';
import OpsDashboard from './ops/OpsDashboard';
import InstructorHome from './InstructorHome';

/**
 * OPS HOME — role-adaptive management landing at /app/ops.
 *  - Admins (isAdmin) get the full tenant OpsDashboard (KPIs + module launcher).
 *  - Trainers (isStaff && !isAdmin) get the servicing-scoped InstructorHome.
 * Both are operators; this only chooses the appropriate home surface.
 */
export default function OpsHome() {
  const { isAdmin } = useAuth();
  return isAdmin ? <OpsDashboard /> : <InstructorHome />;
}
```

`OpsDashboard.tsx` — the KPI list and the rendered page, with every user-visible string:

```tsx
export default function OpsDashboard({
  counts = DEFAULT_COUNTS,
  hubRoutes = MODULE_HUB_ROUTES,
}: OpsDashboardProps) {
  const modules = useModules();
  const { isPageHidden } = useAuth();

  const kpis: KpiSpec[] = [
    // COUNTFIX 1.1: same number, same words, same destination as the Dashboard
    // badge and band. `/app/ops/intake` is retired (INTAKE_PAGE_RETIRED) and
    // redirects to the dashboard — link there directly rather than via a bounce.
    { key: 'intake', label: 'Inbound work waiting', to: '/app/dashboard', load: counts.inboundOpen },
    { key: 'documents', label: 'Documents awaiting signature', to: '/app/ops/documents', load: counts.draftDocuments },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Operations</title>
      </Helmet>

      <header>
        <h1 className="font-serif text-2xl text-green-900">Operations</h1>
        <p className="mt-1 text-sm text-green-800/70">Your tenant at a glance.</p>
      </header>

      <section aria-label="Key metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((spec) => (
            <KpiTile key={spec.key} spec={spec} />
          ))}
        </div>
      </section>

      <section aria-label="Modules">
        <h2 className="font-serif text-lg text-green-900">Modules</h2>
        <p className="mt-1 text-sm text-green-800/70">
          <span className="uppercase tracking-wide text-xs">Locked</span> means your plan does not
          include it. <span className="uppercase tracking-wide text-xs">Hidden</span> means you
          have it and put it away — it still opens, and you can bring its menu entry back under{' '}
          <Link to="/app/ops/admin/pages" className="underline">Settings &rarr; Page visibility</Link>.
        </p>
```

The six module tiles it launches, and the four states each can be in:

```tsx
const MODULE_TILES: { moduleKey: string; label: string }[] = [
  { moduleKey: 'mod.brokerage', label: 'Brokerage' },
  { moduleKey: 'mod.lessons', label: 'Lessons' },
  { moduleKey: 'mod.boarding', label: 'Boarding' },
  { moduleKey: 'mod.barnops', label: 'Barn Ops' },
  { moduleKey: 'mod.horserecords', label: 'Records' },
  { moduleKey: 'mod.employees', label: 'Employees' },
];
```

Tile copy, in order of the four branches — locked / hidden / linked / enabled-no-hub:

```tsx
                    <span className="font-serif">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide">Locked</span>
...
                    <span className="font-serif text-green-800/70">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">
                      Hidden
                    </span>
...
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span aria-hidden className="text-green-800/40">&rarr;</span>
...
                  /* Enabled module, hub not shipped: status tile, never a dead link. */
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">
                      Enabled
                    </span>
```

And the KPI tile's own error copy (deliberately never a blank tile):

```tsx
        <span className="text-sm text-green-800/70">{spec.label}</span>
      {error ? (
        <span data-testid={`kpi-${spec.key}-error`} role="alert" className="mt-2 text-sm text-red-700">
          Couldn&rsquo;t load
        </span>
      ) : (
        <span data-testid={`kpi-${spec.key}-value`} className="mt-2 font-serif text-3xl text-green-900">
          {isPending || data === null ? '—' : data}
        </span>
      )}
```

Worth the owner's attention: this page has had at least two recent tasks maintain it
(COUNTFIX 1.1 repointed its inbound count; PAGEVIS added the whole fourth "Hidden"
tile state and its explanatory paragraph) — that work has never been seen, because the
page has no nav entry.

---

## 4. InstructorHome + InstructorHomePreview (`src/pages/app/InstructorHome.tsx`, `src/pages/app/ops/InstructorHomePreview.tsx`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#4], TASK-REVIEWNAV-REPORT.md [INV batch2.md#38], TASK-ADMINSWEEP-PHASE2.md [INV batch4.md#64]
- reachability: **verified, and the "no such account exists" claim is CONFIRMED against prod.** The gate is `src/pages/app/OpsHome.tsx:13` — `return isAdmin ? <OpsDashboard /> : <InstructorHome />;` — over `isAdmin` derived at `src/contexts/AuthContext.tsx:191` (`role === 'ADMIN' || role === 'SUPER_ADMIN'`) and `isStaff` at `:194` (`SUPER_ADMIN | ADMIN | MANAGER | EMPLOYEE`), with `isTrainer = isStaff && !isAdmin` at `:195`. **Prod role census (13 accounts): `USER` ×10, `ADMIN` ×2, `SUPER_ADMIN` ×1. Zero `MANAGER`, zero `EMPLOYEE`.** So no account in production can reach it through `/app/ops`. The preview wrapper is routed at `src/App.tsx:286` (`ops/preview/instructor-home`, `requireStaff`), and — contrary to its own docstring "DELIBERATELY NOT AN ENTRY POINT… nothing links here" — it **now has an admin-only Review nav row**: `src/lib/reviewSection.ts:132-135`, `slot: 'C', label: 'Staff home C · Instructor preview'`.
- exists: **yes — both files.**
- content:

`InstructorHomePreview.tsx` — the wrapper's docstring is the primary artifact here,
because it is where the "no such account exists" reasoning was recorded:

```tsx
/**
 * INSTRUCTOR HOME — PREVIEW (/app/ops/preview/instructor-home).
 *
 * WHY THIS EXISTS (TASK-ADMINSWEEP Phase 2, owner 2026-08-11: "Lets see
 * OpsDashboard and InstructorHome wired up before we make a decision").
 * `InstructorHome` renders only for non-admin staff — `OpsHome` picks it when
 * `isAdmin` is false — and production `profiles.role` holds only ADMIN,
 * SUPER_ADMIN and USER. There is no account in existence that renders it, so
 * there was no way to look at the page before deciding its future.
 *
 * WHAT THIS IS NOT. It does not fake a role, shadow `isAdmin`, or write to
 * `profiles.role` — the owner ruled that out and it would be a lie about
 * access rather than a preview of a page. It mounts the real component
 * unmodified and puts a banner over it.
 *
 * THE LIMIT THAT MATTERS, and it is on the banner as well as here: every query
 * inside InstructorHome runs as the SIGNED-IN VIEWER. An admin previewing this
 * sees admin-scoped rows. A real trainer's RLS scope may return a different
 * set. So this shows the page's LAYOUT and BEHAVIOUR faithfully and its DATA
 * only approximately.
 *
 * DELIBERATELY NOT AN ENTRY POINT. No nav entry, and nothing links here — the
 * route is reached by typing the URL. TASK-LEADCLEAN is consolidating the
 * staff landing surfaces onto DashboardPanel; a second discoverable home would
 * recreate the duplication it is removing. If the owner keeps this page, the
 * preview wrapper is what gets deleted, not the page.
 */
```

Its banner, i.e. what the owner would actually read on screen:

```tsx
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-gold-800">
          <Eye size={14} aria-hidden="true" />
          Preview — not a live page
        </p>
        <p className="text-[13px] text-green-900 mt-1.5">
          This is the <strong>trainer&rsquo;s home</strong> (<code>InstructorHome</code>), which
          normally renders only for staff who are not admins. No such account exists in
          production, so this route mounts the page for evaluation.
        </p>
        <p className="text-[12px] text-green-800/80 mt-1.5">
          <strong>Its data is yours, not a trainer&rsquo;s.</strong> Every query below runs as
          your signed-in account, so the rows are admin-scoped. Read the layout and the
          behaviour as accurate; treat the specific rows as indicative only.
        </p>
```

`InstructorHome.tsx` — the page itself, render section with all copy:

```tsx
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Helmet><title>Servicing · French Heritage</title></Helmet>

      <div className="mb-5">
        <h1 className="font-serif text-2xl text-green-800">Your day</h1>
        <p className="body-text text-sm text-muted mt-0.5">Lessons, clients, and requests you're servicing.</p>
      </div>

      {/* Quick servicing actions */}
      <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
        <ActionTile to="/app/ops/lessons" icon={GraduationCap} label="Lessons" sub="Sessions, packages, credits" />
        <ActionTile to="/app/calendar" icon={CalendarDays} label="Availability" sub="Set the times you teach" />
        <ActionTile to="/app/ops/contacts" icon={Contact} label="Clients" sub={clientCount !== null ? `${clientCount} on file` : 'People you service'} />
        <ActionTile to="/app/dashboard" icon={Mail} label="Requests" sub={requests.length > 0 ? `${requests.length} to review` : 'Incoming inquiries'} />
      </div>

      {/* Today */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-serif text-green-800 text-lg">Today</h2>
          <Link to="/app/ops/lessons" className="text-[12px] text-gold-800 font-semibold inline-flex items-center gap-1">All sessions <ChevronRight size={13} /></Link>
        </div>
        {today.length > 0 ? (
          <div className="flex flex-col gap-2">{today.map((r) => <LessonRow key={r.id} r={r} />)}</div>
        ) : (
          <div className="bg-white border border-green-800/10 rounded-xl px-4 py-6 text-center">
            <p className="text-[13px] text-muted">No lessons scheduled today.</p>
          </div>
        )}
      </div>

      {requests.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="font-serif text-green-800 text-lg">Requests</h2>
            <Link to="/app/dashboard" className="text-[12px] text-gold-800 font-semibold inline-flex items-center gap-1">All requests <ChevronRight size={13} /></Link>
          </div>
          <div className="flex flex-col gap-2">{requests.slice(0, 6).map((r) => <RequestRow key={r.id} r={r} />)}</div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="font-serif text-green-800 text-lg mb-2.5">Upcoming</h2>
          <div className="flex flex-col gap-2">{upcoming.map((r) => <LessonRow key={r.id} r={r} />)}</div>
        </div>
      )}
    </div>
  );
```

Two things in there the owner has never had a chance to see and may want to rule on:

```tsx
        <ActionTile to="/app/ops/contacts" icon={Contact} label="Clients" ... />
```
— that tile points at `/app/ops/contacts`, which is retired (artifact 5) and now
redirects to `/app/records/clients`. It works, via a bounce.

```tsx
  const effectiveRows: Row[] = (rows && rows.length > 0)
    ? rows
    : (SEED_ENABLED ? SEED_INSTRUCTOR_SESSIONS.map(seedToRow) : []);
```
— when the real lesson list is empty this page falls back to **seed/demo sessions**
(`src/lib/seed.ts`), so an empty day can render fabricated lessons.

---

## 5. ContactsPage, retired behind CONTACTS_PAGE_RETIRED (`src/pages/app/ops/ContactsPage.tsx:563`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#5], TASK-REVIEWNAV-REPORT.md [INV batch2.md#33], TASK-ROSTERCARD-REPORT.md [INV batch2.md#43]
- reachability: **verified — and one detail of the claim is now out of date.** The flag is `export const CONTACTS_PAGE_RETIRED = true;` at `src/pages/app/ops/ContactsPage.tsx:563`. The route consumes it at `src/App.tsx:297-299`. **The redirect target is NOT `/app/admin` any more — it is `/app/records/clients`**, repointed 2026-08-12 by TASK-RECORDS (the App.tsx comment says so explicitly; `/app/admin` itself now redirects there too, so this avoids a double hop). The nav row is indeed gone: `ACCOUNTS_GROUP` (`AppLayout.tsx:537-570`) now contains exactly one row, `{ to: '/app/records', label: 'Records', icon: BookOpen }`, and the ADMINSWEEP X-1 removal is documented in the comment at `AppLayout.tsx:538-553`. It is mounted for review at `/app/ops/review/contacts` (`src/App.tsx:366` → `ReviewContactsPage` in `src/pages/app/ops/review/ReviewMounts.tsx:30`), which has an admin-only nav row via `reviewSection.ts:181-184`. `LeadsPage` and `DirectoryPage` are still exported and un-retired — confirmed at `ContactsPage.tsx:569` and `:590`.
- exists: **yes**
- content:

The flag and its ruling, verbatim:

```tsx
/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33).
 *  Owner ruling 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD): the
 *  Clients page (/app/admin) won — it now shows every contact, so this page's
 *  population moved there. While true: the /app/ops/contacts route redirects
 *  to /app/admin and the nav item is hidden. DirectoryPage and LeadsPage below
 *  are NOT retired. */
export const CONTACTS_PAGE_RETIRED = true;
```

(Note the comment itself still says `/app/admin` — the code moved on, the comment did not.)

All seven exports from this one file, so it is clear what is retired and what is not —
six of these seven are live surfaces:

```tsx
/** The rolodex: external providers — farriers, vets, suppliers, event organizers.
 *  No live route points here any more (TASK-RECORDS split it into Vendors and
 *  Partners below) — kept, not deleted, since 'directory' is still a valid mode
 *  and DIRECTORY a still-accepted (deprecated) contact_type. */
export function DirectoryPage() {
  return <ContactDirectory mode="directory" />;
}
/** People and businesses we pay. Records tab. */
export function VendorsPage() {
  return <ContactDirectory mode="vendors" />;
}
/** People and businesses we work alongside. Records tab. */
export function PartnersPage() {
  return <ContactDirectory mode="partners" />;
}
/** Every lead, client, partner and vendor, one flat list. Records "All" tab. */
export function AllRecordsPage() {
  return <ContactDirectory mode="all" />;
}
/** The people we serve: clients, members, horse owners, counterparties.
 *  Retired — see CONTACTS_PAGE_RETIRED. */
export function ContactsPage() {
  return <ContactDirectory mode="contacts" />;
}
/** Potential future clients — the campaign list. */
export function LeadsPage() {
  return <ContactDirectory mode="leads" />;
}
export default ContactsPage;
```

The route that consumes the flag (`src/App.tsx:291-299`):

```tsx
              {/* RETIRED 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD):
                  the Clients page won and now shows every contact. Route
                  redirects rather than 404s so old links land on the winning
                  page; flip the boolean to restore. Target repointed 2026-08-12
                  (TASK-RECORDS) to the Clients tab directly — /app/admin itself
                  now just redirects here too, so this avoids a double hop. */}
              <Route path="ops/contacts" element={CONTACTS_PAGE_RETIRED
                ? <Navigate to="/app/records/clients" replace />
                : <ProtectedRoute requireStaff><ContactsPage /></ProtectedRoute>} />
```

The buried surface inside it the owner has not seen — the drawer's action row,
including an admin-only **hard delete** with a two-click confirm
(`ContactsPage.tsx:504-529`):

```tsx
              {!open.linked_user_id && designations(open).includes('Lead') && (
                <button type="button" onClick={() => navigate('/app/ops/accounts/new')}
                  className="px-3.5 py-2 rounded-lg border border-gold-600/50 text-gold-800 text-xs inline-flex items-center gap-1.5 hover:bg-gold-50 focus-ring">
                  <UserPlus size={13} /> Invite to an account
                </button>
              )}
              {mode === 'leads' && isAdmin && (
                <button type="button"
                  onClick={async () => {
                    if (!confirmDelete) { setConfirmDelete(true); return; }
                    try {
                      await deleteContact(open.id);
                      toast.success('Lead deleted.');
                      setOpen(null);
                      load();
                    } catch {
                      toast.error('Could not delete the lead.');
                    }
                  }}
                  ...>
                  <Trash2 size={13} /> {confirmDelete ? 'Really delete?' : 'Delete lead'}
                </button>
              )}
```

The review mount's own on-screen banner copy (`ReviewMounts.tsx:30-41`):

```tsx
      <ReviewBanner title="People slot B — the retired contact directory (ContactDirectory, mode &quot;contacts&quot;).">
        Still retired: <code>CONTACTS_PAGE_RETIRED</code> is untouched at <code>true</code>, so
        /app/ops/contacts still redirects to the Clients page for everyone. This route mounts the
        component so it can be compared against People A; it does not put the page back.
      </ReviewBanner>
```

---

## 6. IntakePage, retired behind INTAKE_PAGE_RETIRED (`src/pages/app/ops/IntakePage.tsx:447`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#6], TASK-LEADCLEAN-REPORT.md [INV batch1.md#18], TASK-REVIEWNAV-REPORT.md [INV batch2.md#34]
- reachability: **verified in full, including the five DB functions.** Flag: `export const INTAKE_PAGE_RETIRED = true;` at `src/pages/app/ops/IntakePage.tsx:447`. Route at `src/App.tsx:316-318` renders `<IntakeRetiredRedirect />` while true. **Prod DB confirms all five functions still emit the link** — `select proname from pg_proc where prosrc like '%/app/ops/intake%'` returns exactly: `create_gift`, `provision_client_invitation`, `redeem_gift`, `sign_start_register_attempt`, `submit_public_request`. The sixth emitter, the staff email, is `api/request-received.ts:197` — `'MSG.LINK': ${identity.siteUrl ?? origin}/app/ops/intake?request=${r.id}`. `RequestInbox` is defined at `IntakePage.tsx:95` and used only at `:330`, inside the retired page. Review mount: `/app/ops/review/intake` (`src/App.tsx:367` → `ReviewIntakePage`, `ReviewMounts.tsx:44`), admin-only nav row at `reviewSection.ts:148-151`.
- exists: **yes**
- content:

The flag and the ruling behind it:

```tsx
/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33, and the
 *  shape CONTACTS_PAGE_RETIRED already uses).
 *
 *  Owner ruling 2026-08-11 (TASK-LEADCLEAN): *"inbound goes away. its my
 *  management dashboard"* — three surfaces (this page, DashboardPanel, and the
 *  Leads contact list) showed one dataset with three different filters and none
 *  of them acted on the conversion signal the database was already computing.
 *  The dashboard won. While this is true, /app/ops/intake redirects to
 *  /app/dashboard and this page renders nowhere. It is not deleted: the code
 *  below still compiles, and flipping this to false restores the page whole.
 *
 *  The Inbound NAV item was already removed (AppLayout.tsx, UIO-012 item 2);
 *  this closes the route half of the same retirement. */
export const INTAKE_PAGE_RETIRED = true;

/**
 * The retirement redirect, as its own component so deep links survive it.
 * Several notification writers still emit `/app/ops/intake?request=<id>` links
 * (submit_public_request, create_gift, redeem_gift, provision_client_invitation,
 * sign_start_register_attempt) — carrying the `request` param through to the
 * dashboard keeps every one of those links landing on that lead's drawer rather
 * than on a bare page. Plain `/app/ops/intake` lands on the dashboard.
 */
export function IntakeRetiredRedirect() {
  const [params] = useSearchParams();
  const request = params.get('request');
  return <Navigate to={request ? `/app/dashboard?request=${request}` : '/app/dashboard'} replace />;
}
```

**RequestInbox — the buried surface, in full** (`IntakePage.tsx:95-172`):

```tsx
function RequestInbox({ openId }: { openId?: string } = {}) {
  // Inbound focus: auto-open one request when handed an id (runs once per id).
  const [autoOpened, setAutoOpened] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestFilter>('new');
  const [selected, setSelected] = useState<BookingRequest | null>(null);

  const load = useAsync(listBookingRequests);

  const refresh = useCallback(
    async (filter: RequestFilter) => {
      const data = await load.run(filter === 'ALL' ? undefined : filter);
      setRows(data);
    },
    [load],
  );

  useEffect(() => {
    refresh(statusFilter).catch(() => {
      /* surfaced via load.isError */
    });
  }, [statusFilter]);

  useEffect(() => {
    if (!openId || autoOpened === openId) return;
    const row = rows.find((r) => r.id === openId);
    if (row) { setAutoOpened(openId); setSelected(row); }
  }, [openId, rows, autoOpened]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4" aria-label="Filter requests by status">
        {REQUEST_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={statusFilter === f.id}
            onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-sans transition-colors focus-ring ${
              statusFilter === f.id
                ? 'bg-green-800 text-white'
                : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {load.isError && (
        <p role="alert" className="form-error mb-4">
          {load.error?.message ?? 'Could not load booking requests.'}
        </p>
      )}

      <DataTable
        columns={REQUEST_COLUMNS}
        rows={rows}
        loading={load.isPending && rows.length === 0}
        rowKey={(r) => r.id}
        emptyTitle="No requests"
        emptyMessage="No booking requests in this status."
        onRowClick={setSelected}
      />

      {/* The working drawer — the SAME component the dashboard lead card opens.
          Its own toasts render inside it now, rather than behind the modal. */}
      {selected && (
        <LeadWorkDrawer
          request={selected}
          onClose={() => setSelected(null)}
          onChanged={() => { void refresh(statusFilter); }}
        />
      )}
    </div>
  );
}
```

Its columns (defined just above, `IntakePage.tsx:91-93`):

```tsx
  { key: 'requested', header: 'Requested', render: (r) => requestedSummary(r) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
```

And where `RequestInbox` is reached from inside the retired page — the "focused"
hand-off branch (`IntakePage.tsx:321-333`):

```tsx
  // focused: hand off to the existing full workflow with the row pre-opened
  if (focus?.kind === 'booking') {
    return (
      <div className="max-w-5xl">
        <button type="button" onClick={() => { setFocus(null); void loadInbound(); }}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
          ← Inbound
        </button>
        <h1 className="font-serif text-2xl text-green-900 mb-6">Booking request</h1>
        <RequestInbox openId={focus.id} />
      </div>
    );
  }
```

The page's own header copy and its "needs attention" band, which the owner has also
never seen (`IntakePage.tsx:334-352`, and `InboundAttention` at `:206-269`):

```tsx
      <h1 className="font-serif text-2xl text-green-900 mb-1">Inbound</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Everything sent to the company — booking requests, contact/inquiry notes,
        kiosk signers, and support. This is a queue: it should reach zero.
      </p>
```

```tsx
          <p className="text-sm font-medium text-red-900 mb-1">
            {overdue.length} waiting on us
          </p>
          <p className="text-[12.5px] text-red-900/85 mb-3">
            No one has picked these up, and the person never became a client.
            Oldest first.
          </p>
...
          <p className="text-sm font-medium text-green-900 mb-1">
            {stale.length} already became clients
          </p>
          <p className="text-[12.5px] text-green-800/80">
            The work is done and the row was never closed by hand. Nothing to do —
            the dashboard has already retired these cards from its open list, and
            the requests themselves are kept as history.
          </p>
```

---

## 7. Schedule.tsx — /app/schedule (`src/pages/app/Schedule.tsx`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#7], TASK-REVIEWNAV-REPORT.md [INV batch2.md#39]
- reachability: **verified.** Routed at `src/App.tsx:221` (`<Route path="schedule" element={<Schedule />} />`, inside the `/app` shell). `grep -rn "/app/schedule" src api` returns exactly four hits: the two DashboardPanel tiles at `src/components/app/DashboardPanel.tsx:289` and `:297`, the Review nav entry at `src/lib/reviewSection.ts:232` (`slot: 'B', label: 'Time B · Schedule'`, admin-only), and a prose comment at `src/lib/ops/api-lessons.ts:306`. **No nav table entry** — the nav's time surface is `/app/calendar` (`reviewSection.ts:229` records that its Calendar row was moved into Review from `AppLayout StaffNavItems`). So: two dashboard tiles + one admin-only Review row, and nothing else.
- exists: **yes**
- content:

The two tiles that link here (`DashboardPanel.tsx:283-300`) — note both use `to: '/app/schedule'`:

```tsx
      // ── coming up: next lessons + next events ──
      const up: Tile[] = [];
      for (const s of sessions) {
        if (s.status !== 'SCHEDULED') continue;
        const t = new Date(s.starts_at);
        if (t.getTime() < now) continue;
        up.push({
          id: `l-${s.id}`, kind: 'lesson', title: fmtTime(t),
          sub: s.location ?? undefined, cta: 'Schedule', to: '/app/schedule',
        });
        if (up.length >= 2) break;
      }
      for (const e of events) {
        if (!e.starts_at || new Date(e.starts_at).getTime() < now) continue;
        up.push({
          id: `e-${e.id}`, kind: 'event', title: e.title,
          sub: fmtTime(new Date(e.starts_at)), cta: 'Details', to: '/app/schedule',
        });
        if (up.length >= 4) break;
      }
```

**THE RSVP SURFACE — the claimed unique value.** The options, the writer, and the
rendered radiogroup:

```tsx
const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't" },
];
```

```tsx
  async function choose(eventId: string, status: RsvpStatus) {
    setRsvps((prev) => ({ ...prev, [eventId]: status }));
    try {
      await setRsvp(eventId, status);
    } catch {
      // revert on failure
      setRsvps((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  }
```

```tsx
      <section aria-label={`${titleCase(propertyTerm)} events`}>
        <h2 className="font-serif font-medium text-green-800 text-xl mb-4">{titleCase(propertyTerm)} events</h2>
        {loading ? (
          <p className="body-text text-muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="body-text text-muted text-sm">Nothing on the calendar yet. Check back soon.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((e) => {
              const mine = rsvps[e.id];
              return (
                <article key={e.id} className="bg-white border border-green-800/10 p-6">
                  <p className="text-xs font-sans uppercase tracking-wide text-gold-ink mb-1">
                    {new Date(e.starts_at).toLocaleString(undefined, {
                      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                  <h3 className="font-serif font-medium text-green-800 text-xl mb-2">{e.title}</h3>
                  {e.description && <p className="body-text text-sm mb-3">{e.description}</p>}
                  {e.location && (
                    <p className="text-xs text-muted inline-flex items-center gap-1.5 mb-4">
                      <MapPin size={12} aria-hidden="true" /> {e.location}
                    </p>
                  )}
                  <div role="radiogroup" aria-label={`RSVP for ${e.title}`} className="flex gap-2">
                    {RSVP_OPTIONS.map((opt) => {
                      const selected = mine === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => choose(e.id, opt.value)}
                          className={`px-4 py-2 text-sm font-sans border transition-colors focus-ring ${
                            selected ? 'border-green-800 bg-green-800 text-white' : 'border-green-800/20 text-secondary hover:border-green-800/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
```

The rest of the page — header and the member's-own-lessons section, with all copy:

```tsx
    <div className="max-w-3xl mx-auto">
      <p className="eyebrow mb-2">Schedule</p>
      <h1 className="heading-section text-green-800 mb-8">Here's what's coming up.</h1>

      {/* Your lessons — the member's own confirmed sessions, first. */}
      <section aria-label="Your lessons" className="mb-10" data-testid="my-lessons-section">
        <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Your lessons</h2>
        {loading ? (
          <p className="body-text text-muted">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="body-text text-muted text-sm">
            No lessons booked yet.{' '}
            <Link to="/app/calendar" className="link-underline">
              Book a lesson <ArrowRight size={12} />
            </Link>
          </p>
```

It is also role-aware, which is easy to miss (`Schedule.tsx:41-42, 54-57`):

```tsx
  // Staff see the whole property's sessions (org-wide); members see their own.
  const { isStaff } = useAuth();
...
      (isStaff
        ? listLessonSessions().then((rows) => rows as unknown as MemberLessonSession[])
        : myLessonSessions()
      ).catch(() => [] as MemberLessonSession[]),
```

---

## 8. Account.tsx — /account (`src/pages/Account.tsx`)

- reported by: TASK-DUPECENSUS-REPORT.md [INV batch1.md#8], PROMPT_A_STAGES_4-5.md [INV batch2.md#26]
- reachability: **verified — and the "URL-only" claim is WRONG. `/account` is the default post-authentication landing route.** Confirmed linkers: `src/pages/Login.tsx:15` (`const from = (location.state as { from?: string })?.from || '/account';`), `src/pages/ResetPassword.tsx:46` (`navigate('/account', { replace: true })`), `src/lib/auth.ts:36` (sign-up `emailRedirectTo: appUrl('/account')`), `src/lib/auth.ts:54/62/123` (OAuth `redirectTo = '/account'` — Google and Apple), and `src/pages/OrderDetail.tsx:57` and `:71` ("Back to your account"). Plus the Review nav row at `reviewSection.ts:215`. **What makes it unseen is not the routing — it is the `isMember` guard at `src/pages/Account.tsx:67-69`,** which bounces every member to `/app` before render. Route: `src/App.tsx:191`, `<ProtectedRoute>` (signed-in, no staff/admin requirement).
- exists: **yes**
- content — the legacy comment and the redirect condition, verbatim:

```tsx
  // Members belong in the app — this legacy public-site account page only
  // serves signed-in users WITHOUT an active membership (owner 2026-07-03:
  // "it should be /app/account"). ProtectedRoute waits out auth loading, so
  // isMember is settled by the time we render. After every hook, per the
  // rules of hooks.
  if (isMember) {
    return <Navigate to="/app" replace />;
  }
```

`isMember` is derived at `src/contexts/AuthContext.tsx:213`:

```ts
        isMember: (!profile?.is_suspended) && (isStaff || member?.status === 'active'),
```

**Prod audience check — the "3 synthetic test accounts" claim is CONFIRMED.**
All 13 production accounts, with role and membership status:

```
admin@fhequestrian.com          | ADMIN       | active          -> isStaff  -> bounced
hello@fhequestrian.com          | ADMIN       | active          -> isStaff  -> bounced
admin@cactai.io                 | SUPER_ADMIN | (no members row)-> isStaff  -> bounced
cjzigs@icloud.com               | USER        | active          -> bounced
cjzigs+inviteworks@icloud.com   | USER        | active          -> bounced
cjzigs+inviteworks2@icloud.com  | USER        | active          -> bounced
claire.bourdon21@gmail.com      | USER        | active          -> bounced
madelinedo@gmail.com            | USER        | active          -> bounced
maeboon@gmail.com               | USER        | active          -> bounced
sarahrosengard@gmail.com        | USER        | active          -> bounced
zz-test-buyer@example.invalid   | USER        | (no members row)-> RENDERS
zz-test-cobuyer@example.invalid | USER        | (no members row)-> RENDERS
zz-test-seller@example.invalid  | USER        | (no members row)-> RENDERS
```

Exactly three accounts can see this page, and all three are the synthetic
`zz-test-*@example.invalid` sale-flow fixtures. Every real person is redirected.

**The page's user-visible copy in full** — this is what a brand-new signed-in
non-member would see, and it is what the OAuth/sign-up redirect lands on before
membership exists:

```tsx
    <div className="min-h-screen bg-cream pt-28 pb-20">
      <div className="container-site max-w-4xl">
        <div className="flex items-start justify-between mb-10 gap-4">
          <div>
            <p className="eyebrow mb-2">Your account</p>
            <h1 className="heading-section text-green-800">Welcome, {greetingName}.</h1>
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring whitespace-nowrap"
          >
            <LogOut size={15} aria-hidden="true" />
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Orders */}
          <div className="lg:col-span-3">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Your activity</h2>
            {loadingOrders ? (
              <p className="body-text text-muted">Loading…</p>
            ) : orders.length === 0 ? (
              <div className="bg-white border border-green-800/10 p-8 text-center">
                <p className="body-text text-sm mb-6">
                  Nothing here yet. When you're ready, choose how you'd like to ride with us.
                </p>
                <Link to="/services" className="btn-outline-gold">
                  Ways to Ride
                  <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {orders.map((o) => (
                  <Link key={o.id} to={`/order/${o.id}`} ...>
                      <p className="text-sm font-sans font-medium text-green-900">
                        Order · {new Date(o.created_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs font-sans text-muted mt-0.5">
                        {ORDER_STATUS_LABEL[o.status] ?? o.status}
                      </p>
```

```tsx
          {/* Profile */}
          <div className="lg:col-span-2">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Your details</h2>
            <form onSubmit={saveProfile} className="bg-white border border-green-800/10 p-6">
                <label className="form-label" htmlFor="acc_first">First Name</label>
                <label className="form-label" htmlFor="acc_last">Last Name</label>
                <label className="form-label" htmlFor="acc_phone">Phone</label>
                <label className="form-label" htmlFor="acc_email">Email</label>
              <button type="submit" disabled={saving} className="btn-primary w-full justify-center">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <div aria-live="polite" className="min-h-[1.25rem]">
                {saved && <p className="text-xs text-green-700 mt-2 text-center">Saved.</p>}
              </div>
            </form>

            {/* Security */}
            <div className="mt-6">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-5">Security</h2>
              <TwoFactorSettings />
            </div>
```

The order status vocabulary it displays — note this is the **retired `orders` table's**
vocabulary (`orders` is listed under RETIRED in CLAUDE.md), still hard-coded here:

```tsx
const ORDER_STATUS_LABEL: Record<string, string> = {
  draft: 'In progress',
  awaiting_payment: 'Awaiting payment',
  paid: 'Paid',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};
```

It also carries a live, maintained data path — phone reads/writes go to the contact
record, not `profiles.phone` (`Account.tsx:40-49`), and it mounts the real
`TwoFactorSettings` component:

```tsx
  // U7 Stage 5: phone is repointed from profiles.phone (retired, see below) to
  // the person's contact record — docs/PERSON_DATA_CONSOLIDATION.md is the
  // single source of truth for a person's phone number.
```

---

### Corrections to the source reports, collected

1. **#2 HorsesPage "zero references"** — stale. `src/lib/reviewSection.ts:106` links it; it has an admin-only nav row.
2. **#4 InstructorHomePreview "nothing links here"** — its own docstring is now stale; `reviewSection.ts:132` gives it a nav row. The "no MANAGER/EMPLOYEE account exists" claim is **confirmed** against prod.
3. **#5 ContactsPage redirect target** — the report says `/app/admin`; the code says `/app/records/clients` (`App.tsx:298`, repointed by TASK-RECORDS). The in-file comment at `ContactsPage.tsx:558` still says `/app/admin` and is itself stale.
4. **#8 Account.tsx "URL-only"** — wrong. It is the default post-login, post-password-reset, post-sign-up-confirmation and OAuth redirect target (`Login.tsx:15`, `ResetPassword.tsx:46`, `auth.ts:36/54/62/123`). It is invisible because of the `isMember` guard, not because nothing points at it.
5. **#3 ADMINSWEEP nav entry** — confirmed **not applied**: `{ to: '/app/ops', label: 'Operations', icon: Gauge }` (specified at `docs/reports/TASK-ADMINSWEEP-PHASE2.md:182`) does not appear anywhere in `AppLayout.tsx`.
