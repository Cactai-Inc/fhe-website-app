# Part C — Unviewed Inventory Evidence

Read-only pass. Nothing changed. Nothing recommended for deletion.

**Three of the ten claims are STALE.** Read blocks 4, 5 and 8 first — a Review nav section
(added 2026-08-12) and a module-enable migration (also 2026-08-12) turned several
"unreachable" surfaces back on after the reports were written. Details in each block.

---

## ContactsPage / route /app/ops/contacts (src/pages/app/ops/ContactsPage.tsx)
- reported by: TASK-DOCCOLS-REPORT.md, TASK-ROSTER-REPORT.md, TASK-PAGEFRAME-REPORT.md
- reachability: **PARTIALLY STALE.** The retirement is intact, but the page is no longer
  unviewable.
  - The flag — `src/pages/app/ops/ContactsPage.tsx:563`: `export const CONTACTS_PAGE_RETIRED = true;`
  - The redirect — `src/App.tsx:297-299`. **Report is stale on the target**: it now redirects
    to `/app/records/clients`, not `/app/admin` (repointed by TASK-RECORDS to avoid a double hop).
  - The nav item is GONE, not gated. `grep -n "ops/contacts" src/components/app/AppLayout.tsx`
    finds only the removal comment at `AppLayout.tsx:539-551` — there is no `ContactsPage` NavItem
    left in `ACCOUNTS_GROUP` (`AppLayout.tsx:537-569`); the whole group is now one row,
    `AppLayout.tsx:568`: `{ to: '/app/records', label: 'Records', icon: BookOpen },`
  - **BUT it IS reachable today for admins.** `src/App.tsx:366` mounts the unmodified component at
    `/app/ops/review/contacts`, and `src/lib/reviewSection.ts:356-361` turns every review entry into
    a real admin-only nav row. So the owner can already click to it under **Review → "People B ·
    retired directory"**.
- exists: yes (593 lines; `ContactsPage()` at :586, default export at :593)
- content:

The flag and its siblings — note that four sibling pages off the SAME component are LIVE
(`src/pages/app/ops/ContactsPage.tsx:556-593`):
```tsx
/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33).
 *  Owner ruling 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD): the
 *  Clients page (/app/admin) won — it now shows every contact, so this page's
 *  population moved there. While true: the /app/ops/contacts route redirects
 *  to /app/admin and the nav item is hidden. DirectoryPage and LeadsPage below
 *  are NOT retired. */
export const CONTACTS_PAGE_RETIRED = true;

export function DirectoryPage()  { return <ContactDirectory mode="directory" />; }
export function VendorsPage()    { return <ContactDirectory mode="vendors" />; }
export function PartnersPage()   { return <ContactDirectory mode="partners" />; }
export function AllRecordsPage() { return <ContactDirectory mode="all" />; }
/** The people we serve: clients, members, horse owners, counterparties.
 *  Retired — see CONTACTS_PAGE_RETIRED. */
export function ContactsPage()   { return <ContactDirectory mode="contacts" />; }
export function LeadsPage()      { return <ContactDirectory mode="leads" />; }
export default ContactsPage;
```

The route (`src/App.tsx:291-299`):
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

**What the retired page showed that the live Clients page may not.** The page's own copy
(`ContactsPage.tsx:64-68`) and its exclusive filter row (`:82-86`, `:234`):
```tsx
contacts: {
  title: 'Contacts',
  blurb: 'The people we serve — clients, members, horse owners and counterparties who are not part of the company.',
  newLabel: 'contact',
},

type Designation = 'Client' | 'Team' | 'Counterparty' | 'Horse owner' | 'Lessee' | 'Lead';
const BUSINESS_FILTERS = ['All', 'Counterparties', 'Horse owners', 'Lessees'];
const FILTER_MAP: Record<string, Designation | null> = {
  All: null, Counterparties: 'Counterparty', 'Horse owners': 'Horse owner', Lessees: 'Lessee',
};
// ...
const filters = mode === 'contacts' ? BUSINESS_FILTERS : [];   // ← line 234
```
`filters` is EMPTY for every other mode. **The Counterparties / Horse owners / Lessees filter
buttons exist only on this retired page.** The designation chips themselves are derived, never
assigned (`:92-102`):
```tsx
function designations(r: DirectoryContact): Designation[] {
  const d: Designation[] = [];
  if (r.linked_role && r.linked_role !== 'USER') d.push('Team');
  if (r.is_client || r.linked_role === 'USER') d.push('Client');
  const outside = (r.party_roles ?? []).filter((x) => !NON_PARTY_ROLES.includes(x));
  if (outside.length > 0 && !d.includes('Client')) d.push('Counterparty');
  if (r.horses_owned > 0) d.push('Horse owner');
  if (r.horses_leased > 0) d.push('Lessee');
  if (d.length === 0) d.push('Lead');
  return d;
}
```

The rendered page (`ContactsPage.tsx:319-400`) — card grid, filters, search, sort:
```tsx
{/* filter — buttons on desktop, dropdown on mobile; sort row below */}
<div className="hidden sm:flex flex-wrap gap-1.5 mb-2">
  {filters.map((f) => (
    <button key={f} type="button" onClick={() => setFilter(f)} className={...}>
      {f}{counts.get(f) ? ` (${counts.get(f)})` : ''}
    </button>
  ))}
</div>
{filters.length > 0 && (
  <select className="form-input sm:hidden mb-2" value={filter} aria-label="Filter" ...>
    {filters.map((f) => <option key={f} value={f}>{f}{counts.get(f) ? ` (${counts.get(f)})` : ''}</option>)}
  </select>
)}
<div className="flex flex-wrap items-center gap-2 mb-5">
  <input type="search" className="form-input flex-1 min-w-[200px]"
    placeholder="Search name, email, phone, tag…"
    value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search contacts" />
  <div className="flex gap-1.5">
    {([['name', 'A–Z'], ['newest', 'Newest']] as [SortKey, string][]).map(([k, label]) => (
      <button key={k} type="button" onClick={() => setSortKey(k)} className={...}>{label}</button>
    ))}
  </div>
</div>

{error && <p role="alert" className="form-error mb-4">{error}</p>}
{rows === null && !error && <p className="text-sm text-muted">Loading directory…</p>}

{/* directory cards — same shape as the community's members directory */}
<div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
  {visible.map((r) => (
    <button key={r.id} type="button" onClick={() => setOpen(r)}
      className="bg-white border border-green-800/10 rounded-xl p-4 text-left hover:border-green-800/30 focus-ring">
      <div className="flex items-center gap-3 mb-2.5">
        <span className="w-11 h-11 rounded-full bg-green-100 text-green-800 grid place-items-center text-base font-serif font-semibold shrink-0">
          {initials(r)}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-900 truncate">{contactName(r) || r.email || '—'}</p>
          <p className="text-[11px] text-muted truncate">{r.email ?? r.phone ?? 'no contact info'}</p>
        </div>
        {mode === 'all' && r.contact_type && (
          <span className="...">{CONTACT_TYPE_LABEL[r.contact_type]}</span>
        )}
      </div>
      <Chips r={r} />
      {depthLine(r) && <p className="text-[11px] text-muted mt-2">{depthLine(r)}</p>}
    </button>
  ))}
</div>
{rows !== null && visible.length === 0 && (
  <p className="text-sm text-muted py-8 text-center">No contacts match.</p>
)}

{dossier && <ContactDossierModal contactId={dossier} onClose={() => setDossier(null)} ... />}
```

Every user-visible string on the retired page: `Contacts` · `The people we serve — clients,
members, horse owners and counterparties who are not part of the company.` · `All` ·
`Counterparties` · `Horse owners` · `Lessees` · `Search name, email, phone, tag…` · `A–Z` ·
`Newest` · `Loading directory…` · `No contacts match.` · `no contact info` · `Unnamed` · `View` ·
chips `Client` / `Team` / `Counterparty` / `Horse owner` / `Lessee` / `Lead`.

---

## The org company contact has no reachable record page (contacts row "French Heritage Equestrian")
- reported by: TASK-DOCCOLS-REPORT.md
- reachability: VERIFIED, and the claim is correct but **incomplete** — there are TWO
  independent reasons, one in the UI and one in the RPC, and either alone would be enough.
- exists: yes — one row, live, not soft-deleted.
- content:

The actual row (`psql … select … from contacts where is_company is true;` — exactly one row):
```
-[ RECORD 1 ]+-------------------------------------
id           | 352c3898-65d0-4a90-ad59-29107b7e03fe
first_name   | French Heritage Equestrian
last_name    |
is_company   | t
contact_type | TEAM
email        | hello@fhequestrian.com
phone        | (858) 439-3614
org_id       | e656f20b-ef43-4725-9029-19e7f0190d9c
deleted_at   |
created_at   | 2026-07-13 04:52:18.83059+00
```
(Note: `contacts` has no `company_name` column — the org's name lives in `first_name`.)

**Reason 1 — the UI never emits a link for it.** `src/components/ops/documents/DocumentQueueTable.tsx:77-94`.
The decision is on `party.isCompany`, which is `contacts.is_company` — NOT on `contact_type`:
```tsx
function PartyCell({ party }: { party: PartyDisplay | null }) {
  if (!party) return null;
  return (
    <span className="block">
      <span className="block text-[10px] uppercase tracking-wide text-green-800/55">{party.label}</span>
      {party.isCompany ? (
        <span className="font-medium text-green-900">{party.name}</span>
      ) : (
        <Link
          to={`/app/admin?open=${party.contactId}`}
          className="link-underline font-medium text-green-900"
        >
          {party.name}
        </Link>
      )}
    </span>
  );
}
```
The contract is stated at `src/lib/ops/partyDisplay.ts:79-82`:
```ts
  /** The org itself acting as a party (`contacts.is_company`) — render as the
   *  company, not a person: no dossier link exists for it. */
  isCompany: boolean;
```

**Reason 2 — even if it linked, the destination could not find it.** `admin_client_accounts()`
arm 3 is the only arm a bare contact can enter, and it filters on `contact_type`
(`prosrc`, arm 3):
```sql
    -- arm 3 (NEW): bare contacts — no clients row, no USER login. These were in
    -- neither arm before. LEAD / TEAM / DIRECTORY types live on their own pages.
    SELECT 'contact', NULL, c.id, NULL,
           c.first_name, c.last_name, NULL, c.email, ...
    FROM contacts c
    ...
    WHERE c.org_id = current_org() AND c.deleted_at IS NULL AND is_admin()
      AND (c.contact_type = 'CONTACT' OR c.contact_type IS NULL)
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND p.role = 'USER')
```
The row's `contact_type` is `TEAM`, so `(c.contact_type = 'CONTACT' OR c.contact_type IS NULL)`
is false and the row is excluded. Arms 1 and 2 need a `profiles` row / `clients` row
respectively, neither of which the org has. So `/app/admin?open=352c3898-…` would resolve to
nothing even if `PartyCell` did emit it.

---

## Contract-invite redemption landing page (/activate?token=…&kind=contract → src/pages/Register.tsx)
- reported by: TASK-A-PARTY-VERIFY-2-REPORT.md
- reachability: N/A — this is a public, deliberately-reachable page. The claim under test is
  "unwired", not "unreachable".
- exists: yes
- **VERDICT: the report's claim is NOT SUPPORTED by static + DB evidence. Every link in the
  chain exists and resolves.** I could not reproduce a break without a live browser. What I
  found, end to end:

**1. The URL actually sent.** `api/contract-invite.ts:113-116` — the only place a contract
invite link is built:
```ts
    const token = (inv as { token: string }).token;

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const link = `${origin}/activate?token=${token}&kind=contract`;
```
It is issued by the RPC just above (`api/contract-invite.ts:101-103`):
```ts
    const { data: inv, error: invErr } = await db.rpc('invite_contract_counterparty', {
      p_document_id: documentId, p_contact_id: party.contact_id, p_email: email,
    });
```
and injected into the `CONTRACT_INVITE` email template as `'MSG.LINK': link`
(`api/contract-invite.ts:133`).

**2. The route.** `src/App.tsx:150`:
```tsx
<Route path="/activate" element={<ActivateShell><Register /></ActivateShell>} />
```
(with `src/App.tsx:185` redirecting the legacy `/register` here, query preserved).

**3. The landing component** is `/Users/cactai/Downloads/claude-code-repo/wt-flagharvest/src/pages/Register.tsx`
(343 lines). It branches on the `kind` param at line 26 and has a contract-specific redemption
path (`Register.tsx:22-42`):
```tsx
  const token = params.get('token') || '';
  // Contract-counterparty invites (Update A, spec G): redemption links the party
  // contact instead of granting community membership, and lands on the contract.
  const isContractInvite = params.get('kind') === 'contract';

  /** Redeem per invite kind; returns the post-redemption destination. */
  async function redeemByKind(): Promise<string> {
    if (isContractInvite) {
      const documentId = await redeemContractInvitation(token);
      return `/app/contracts/${documentId}`;
    }
    await redeemInvitation(token);
    try {
      const state = await myOnboardingState();
      if (state?.needed) return '/app/onboarding';
    } catch { /* fall through to the dashboard */ }
    return '/app';
  }
```
Already-signed-in short-circuit (`Register.tsx:104-116`):
```tsx
        // Already signed in as the invited person (e.g. registered earlier but
        // membership was never granted)? Redeem straight into the app.
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionEmail = sessionData.session?.user?.email?.toLowerCase();
        if (sessionEmail && sessionEmail === inv.email.trim().toLowerCase()) {
          try {
            const dest = await redeemByKind();
            navigate(dest, { replace: true });
            return;
          } catch { /* fall through to the normal form */ }
        }
```
Already-signed-party rescue when the token is dead (`Register.tsx:83-96`):
```tsx
          // SENDGUARD §1: validate_invitation only recognises a LIVE token, so a
          // contract party who already signed and clicks an older link lands on
          // "this link isn't valid" — a dead end for someone whose signature is
          // already on file. redeem_contract_invitation now routes an
          // already-signed party to their document; give it the chance to.
          if (isContractInvite) {
            try {
              const documentId = await redeemContractInvitation(token);
              if (!active) return;
              navigate(`/app/contracts/${documentId}`, { replace: true });
              return;
            } catch { /* not signed, or not signed in — the invalid screen is right */ }
          }
```
The Google round-trip is handled too (`src/pages/RegisterComplete.tsx:82-87`):
```tsx
        if (stash.kind === 'contract') {
          // contract-counterparty invite: link the party contact, no membership,
          // and land ON the contract (Update A, spec G)
          const documentId = await redeemContractInvitation(stash.token);
          dest = `/app/contracts/${documentId}`;
        }
```

**4. Every visible string on the landing page.**

The invalid-token screen (`Register.tsx:201-263`):
```tsx
  <p className="eyebrow mb-3">Invitation</p>
  <h1 className="heading-section text-green-800 mb-4">This link isn't valid anymore</h1>
  {notice ? (
    <p className="body-text mb-3">
      Your current invitation went to <span className="font-medium text-green-800">{notice.masked_email}</span>{' '}
      on {…date…}. Look for the most recent email from us and use the link in that one.
    </p>
    // + button "Send it to me again" / "Sending…" / after: "Sent. It's on its way to that
    //   same address — give it a minute, and check your spam folder if it doesn't appear."
  ) : (
    <p className="body-text mb-8">
      {isContractInvite
        ? "This invitation may have expired or been replaced by a newer one. If you've already signed this document, sign in and we'll take you straight to it."
        : "This invitation may have expired or been replaced by a newer one — check your inbox for the most recent email. If you've already created your account, just sign in."}
    </p>
  )}
  <Link to="/login" state={isContractInvite ? { from: `/activate?token=${token}&kind=contract` } : undefined}
        className="btn-primary">Sign In <ArrowRight size={16} /></Link>
  <Link to="/contact" className="btn-outline-gold">Ask for a fresh invite</Link>
```

The normal (valid-token) screen (`Register.tsx:266-300`):
```tsx
  <p className="eyebrow mb-3">Welcome</p>
  <h1 className="heading-section text-green-800">Sign in to activate your account</h1>
  <p className="body-text text-sm mt-2">
    for <span className="font-medium text-green-800">{invitation?.email}</span>
  </p>

  {showGoogle && showPassword && authMethod === 'both' && (
    <p className="body-text text-xs text-muted text-center mb-4">
      If <span className="font-medium">{invitation?.email}</span> is a Google
      Workspace address, use “Continue with Google.” Otherwise, set a password below.
    </p>
  )}

  {showGoogle && (
    <button type="button" onClick={continueWithGoogle} className="btn-outline-gold w-full justify-center">
      Continue with Google
    </button>
    // divider: "or set a password"
  )}
```

**5. Destination route exists.** `src/App.tsx:266`:
```tsx
<Route path="contracts/:id" element={<ContractPage />} />
```

**6. DB side, prod, all present:**
```
psql -tAc "select proname from pg_proc where proname in
  ('validate_invitation','redeem_contract_invitation','invite_contract_counterparty');"
invite_contract_counterparty
redeem_contract_invitation
validate_invitation
```
And CJ's contract invitation is in `invitations` and was **redeemed**:
```
 ac6ffe4c-a234-475b-89c4-76f46d61aa02 | cjzigs@icloud.com | redeemed | CONTRACT | 2026-08-23 02:22:49 | 2026-08-09 02:22:49
 9b77775f-5e1e-41f8-8c74-f87f156579f3 | cjzigs@icloud.com | sent     | CONTRACT | 2026-08-19 09:35:27 | 2026-08-05 09:35:27
 ec81851e-e252-43b6-97fc-8732f8af2bbb | cjzigs+averify2@icloud.com | sent | CONTRACT | 2026-08-19 09:35:27 | 2026-08-05 09:35:27
 99bddcf5-1bad-464f-8022-feba33a9afd6 | hello@fhequestrian.com | sent | CONTRACT | 2026-08-23 02:22:49 | 2026-08-09 02:22:49
```

**What is and isn't wired — plainly:**
- WIRED: URL construction, email template injection, the `/activate` route, token validation,
  contract-vs-community branching, Google and password account creation, `redeem_contract_invitation`,
  the already-signed-in short-circuit, the already-signed dead-link rescue, and the final hop to
  `/app/contracts/:id` (a real route to a real `ContractPage`).
- ONE THING WORTH THE OWNER'S EYE, and it is a wording issue, not a wiring one: the valid-token
  screen's headline is **"Sign in to activate your account"** with a **"Welcome"** eyebrow. A
  contract counterparty who already has an account and is signed in never sees it (the
  short-circuit at :104 fires first) — but one who is signed out, or signed in under a *different*
  address than the invite, falls through to that account-creation screen with no
  contract-specific copy at all. `isContractInvite` is used for the *invalid* screen's copy
  (:243) but not for the valid screen's copy. That is the closest thing I found to "unwired".
- **UNRESOLVED**: whether CJ actually saw a broken page. Nothing in the code or the DB explains a
  failure, and the invitation row shows `redeemed`. Confirming or refuting the owner's report
  needs a live browser session, which I could not run.

---

## /app/ops — OpsHome, OpsDashboard, InstructorHome
- reported by: TASK-ADMINSWEEP-PHASE1.md, TASK-DASHLEADS-REPORT.md
- reachability: **STALE — these are NO LONGER DARK.** ADMINSWEEP Phase 1's grep result was true
  when written. Since then TASK-REVIEWNAV added an admin-only Review nav section that links to
  all three.
  - `src/lib/reviewSection.ts:126-136` puts both surfaces in the Review group;
    `src/lib/reviewSection.ts:356-361` turns every such entry into a live nav row:
    ```ts
    export const REVIEW_NAV_ITEMS: { to: string; label: string; icon: typeof FlaskConical; adminOnly: true }[] = [
      { to: '/app/ops/review', label: 'How to use Review', icon: FlaskConical, adminOnly: true },
      ...REVIEW_GROUPS.flatMap((g) => g.entries
        .filter((e) => e.navRow !== false)
        .map((e) => ({ to: e.to, label: e.label, icon: FlaskConical, adminOnly: true as const }))),
    ];
    ```
  - `src/components/app/AppLayout.tsx:696-704` renders that group; `AppLayout.tsx:659-662` is the
    only filter, and it passes for an admin:
    ```tsx
    const visible = (items: NavItem[]) => items.filter(
      (i) => (!i.module || hasModule(i.module))
          && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
    );
    ```
  - So today an admin sees nav rows **"Staff home B · OpsDashboard"** (`/app/ops`) and
    **"Staff home C · Instructor preview"** (`/app/ops/preview/instructor-home`).
  - InstructorHome remains unreachable *as a role*: no production `profiles.role` is non-admin
    staff, so `OpsHome` never picks it in real life. The preview route is the only way it renders.
  - `grep -rn "'/app/ops'" src/` returns only the two `reviewSection.ts` entries and the two
    doc-comments — still no `<Navigate>` or `navigate()` to it.
- exists: yes — `src/pages/app/OpsHome.tsx` (14 lines), `src/pages/app/ops/OpsDashboard.tsx`
  (275 lines), `src/pages/app/InstructorHome.tsx` (187 lines),
  `src/pages/app/ops/InstructorHomePreview.tsx` (66 lines)
- content:

**Routes** (`src/App.tsx:279` and `:280-286`):
```tsx
<Route path="ops" element={<ProtectedRoute requireStaff><OpsHome /></ProtectedRoute>} />
{/* ADMINSWEEP Phase 2 — InstructorHome renders only for non-admin
    staff, and no such account exists in production, so the owner
    could not look at it before ruling on it. This mounts the real
    component behind a preview banner. NOT a second landing page:
    no nav entry, nothing links here, reached by URL only. See
    ops/InstructorHomePreview.tsx for why it is not a role fake. */}
<Route path="ops/preview/instructor-home" element={<ProtectedRoute requireStaff><InstructorHomePreview /></ProtectedRoute>} />
```
(The comment "no nav entry, nothing links here" is now out of date — see reachability above.)

**The switch** (`src/pages/app/OpsHome.tsx`, whole file):
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

### SURFACE A — OpsDashboard (what an admin sees at /app/ops)

The module launcher catalog (`OpsDashboard.tsx:106-120`):
```tsx
// mod.brokerage has no hub page, so the registry yields no entry for it and its
// tile renders as the non-navigating "Enabled" status tile (dead links are
// forbidden). That is the same behaviour as the hand-written map this replaced.

/** The module launcher catalog: key + label. Every tile is entitlement-gated;
 *  navigation comes solely from MODULE_HUB_ROUTES. */
const MODULE_TILES: { moduleKey: string; label: string }[] = [
  { moduleKey: 'mod.brokerage', label: 'Brokerage' },
  { moduleKey: 'mod.lessons', label: 'Lessons' },
  { moduleKey: 'mod.boarding', label: 'Boarding' },
  { moduleKey: 'mod.barnops', label: 'Barn Ops' },
  { moduleKey: 'mod.horserecords', label: 'Records' },
  { moduleKey: 'mod.employees', label: 'Employees' },
];
```

The whole render (`OpsDashboard.tsx:170-275`):
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
      <Helmet><title>Operations</title></Helmet>

      <header>
        <h1 className="font-serif text-2xl text-green-900">Operations</h1>
        <p className="mt-1 text-sm text-green-800/70">Your tenant at a glance.</p>
      </header>

      <section aria-label="Key metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((spec) => <KpiTile key={spec.key} spec={spec} />)}
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
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_TILES.map((tile) => {
            const hubRoute = hubRoutes[tile.moduleKey];
            const hubPageKey = MODULE_HUB_PAGE_KEY[tile.moduleKey];
            const hidden = !!hubPageKey && isPageHidden(hubPageKey);
            return (
              <ModuleGate key={tile.moduleKey} moduleKey={tile.moduleKey} modules={modules}
                fallback={
                  <div data-testid={`module-${tile.moduleKey}-locked`} role="note"
                    className="flex items-center justify-between rounded border border-green-800/10 bg-green-800/5 px-5 py-4 text-green-800/50">
                    <span className="font-serif">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide">Locked</span>
                  </div>
                }>
                {hubRoute && hidden ? (
                  /* Entitled, built, and put away by this tenant. Still a link —
                     the route resolves and this is the way back. */
                  <Link to={hubRoute} data-testid={`module-${tile.moduleKey}-hidden`}
                    className="flex items-center justify-between rounded border border-dashed border-green-800/25 bg-cream-100/60 px-5 py-4 hover:border-green-800/50 transition-colors">
                    <span className="font-serif text-green-800/70">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">Hidden</span>
                  </Link>
                ) : hubRoute ? (
                  <Link to={hubRoute} data-testid={`module-${tile.moduleKey}-tile`}
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4 hover:border-green-800/40 transition-colors">
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span aria-hidden className="text-green-800/40">&rarr;</span>
                  </Link>
                ) : (
                  /* Enabled module, hub not shipped: status tile, never a dead link. */
                  <div data-testid={`module-${tile.moduleKey}-enabled`} role="note"
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4">
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">Enabled</span>
                  </div>
                )}
              </ModuleGate>
            );
          })}
        </div>
      </section>
    </div>
  );
}
```
KPI tile copy (`OpsDashboard.tsx:129-140`): the label, or on failure `Couldn’t load`, or `—`
while pending.

Every visible string on OpsDashboard: `Operations` (title + h1) · `Your tenant at a glance.` ·
`Inbound work waiting` · `Documents awaiting signature` · `Couldn’t load` · `—` · `Modules` ·
`Locked means your plan does not include it. Hidden means you have it and put it away — it still
opens, and you can bring its menu entry back under Settings → Page visibility.` · `Brokerage` ·
`Lessons` · `Boarding` · `Barn Ops` · `Records` · `Employees` · `Locked` · `Hidden` · `Enabled` · `→`

### SURFACE B — InstructorHome (the trainers' home nobody can reach as a trainer)

Whole render (`src/pages/app/InstructorHome.tsx:139-187`):
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

      {/* Requests — booking requests still new + support tickets not yet resolved,
          the same rows the Requests count above summarizes. TASK-DASHLEADS: this
          page's own subtitle promised "requests you're servicing" before anything
          here actually rendered one. */}
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
Lesson-row status chips (`InstructorHome.tsx:36-40`):
```tsx
const STATUS_CHIP: Record<string, { label: string; cls: string; icon: typeof CircleDot }> = {
  scheduled: { label: 'Scheduled', cls: 'text-green-800 bg-green-50 border-green-200', icon: CircleDot },
  completed: { label: 'Completed', cls: 'text-secondary bg-cream-200 border-green-800/15', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'text-red-700 bg-red-50 border-red-200', icon: CircleDot },
};
```
Note `InstructorHome.tsx:153` still links "Clients" to `/app/ops/contacts`, which now redirects
to `/app/records/clients` — a working link through a redirect, but pointing at a retired path.

Every visible string on InstructorHome: `Servicing · French Heritage` (title) · `Your day` ·
`Lessons, clients, and requests you're servicing.` · `Lessons` / `Sessions, packages, credits` ·
`Availability` / `Set the times you teach` · `Clients` / `N on file` or `People you service` ·
`Requests` / `N to review` or `Incoming inquiries` · `Today` · `All sessions` ·
`No lessons scheduled today.` · `Requests` · `All requests` · `Upcoming` · chips `Scheduled` /
`Completed` / `Cancelled`.

### The preview wrapper (`src/pages/app/ops/InstructorHomePreview.tsx`, whole banner)
```tsx
      <div role="note" aria-label="Preview notice" data-testid="instructor-preview-banner"
        className="border-2 border-dashed border-gold-400 bg-gold-50 rounded-xl px-4 py-3.5 mb-2 max-w-3xl mx-auto mt-6 sm:px-6">
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
      </div>

      <InstructorHome />
```

---

## /app/ops/horses — HorsesPage (127 lines)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **STALE.** `grep -rn "ops/horses" src/` now returns FOUR hits, one of which is a
  live nav row:
  ```
  src/App.tsx:306:              <Route path="ops/horses" element={<ProtectedRoute requireStaff><HorsesPage /></ProtectedRoute>} />
  src/lib/reviewSection.ts:106:        slot: 'B', label: 'Horses B · 07-01 original', to: '/app/ops/horses',
  src/pages/app/ops/HorsesPage.tsx:14:import { HorseTable } from '../../../components/ops/horses/HorseTable';
  src/pages/app/ops/HorsesPage.tsx:15:import { HorseForm } from '../../../components/ops/horses/HorseForm';
  ```
  `reviewSection.ts:105-108` is the entry, and `reviewSection.ts:356-361` makes it an admin nav
  row labelled **"Horses B · 07-01 original"**. Its own description confirms the original claim
  was accurate when written:
  ```ts
  {
    slot: 'B', label: 'Horses B · 07-01 original', to: '/app/ops/horses',
    what: 'HorsesPage, the 2026-07-01 original. Routed, but nothing has linked to it since. It is the only one that resolves breed/colour lookups to names.',
  },
  ```
- exists: yes (127 lines)
- **The other two horse surfaces**, for comparison (`src/lib/reviewSection.ts:99-113`):
  - **A — `/app/ops/horse-records`** → `HorseRecordsPage`. *"The roster staff use today —
    PageLayout, filters, the record drawer."* Reached today as the **Horses tab of the Records
    page** (`src/pages/app/RecordsPage.tsx:91`: `{tab === 'horses' && <HorseRecordsPage onOpenContact={setCrossContact} />}`),
    whose nav row is `AppLayout.tsx:568` `{ to: '/app/records', label: 'Records', icon: BookOpen }`.
  - **C — `/app/ops/records`** → `RecordsHubPage` (102 lines). *"the module surface: a third roster
    plus the parties/health lanes."* Its own warning: *"Gated on mod.horserecords, which is
    ENABLED for FHE — so this is a live page today, not a dark one."* Its nav row was moved into
    the Review section (`AppLayout.tsx:594` shows the removed line as a comment).
  - **B — `/app/ops/horses`** → `HorsesPage`, this one. Unique property per the review entry:
    **it is the only one of the three that resolves breed/colour lookup codes to names.**
- content — essentially the whole component (`src/pages/app/ops/HorsesPage.tsx:29-127`):
```tsx
type ModalState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; horse: Horse };

export default function HorsesPage() {
  const propertyTerm = usePropertyTerm();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  const [owners, setOwners] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [h, b, c, o] = await Promise.all([
        listHorses(), listHorseBreeds(), listHorseColors(), listContacts(),
      ]);
      setHorses(h); setBreeds(b); setColors(c); setOwners(o);
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load horses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (input: HorseInput) => {
    const created = await createHorse(input);
    setHorses((prev) => [created, ...prev]);
    setModal({ mode: 'closed' });
  };

  const handleUpdate = (id: string) => async (input: HorseInput) => {
    const updated = await updateHorse(id, input);
    setHorses((prev) => prev.map((h) => (h.id === id ? updated : h)));
    setModal({ mode: 'closed' });
  };

  return (
    <div className="space-y-6">
      <Helmet><title>Horses · Ops</title></Helmet>

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
        <div role="alert" className="form-error">{loadError}</div>
      ) : (
        <HorseTable
          horses={horses} breeds={breeds} colors={colors} owners={owners}
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
            breeds={breeds} colors={colors} owners={owners}
            horse={modal.mode === 'edit' ? modal.horse : null}
            onSubmit={modal.mode === 'edit' ? handleUpdate(modal.horse.id) : handleCreate}
            onCancel={() => setModal({ mode: 'closed' })}
          />
        )}
      </Modal>
    </div>
  );
}
```
Every visible string: `Horses · Ops` (title) · `Horses` · `Roster of horses {at/on} your
{property term}.` (tenant-configurable — TASK-FACILITYTERM) · `New horse` · `Could not load
horses.` · `Edit horse` · plus whatever `HorseTable` / `HorseForm` render (shared components,
also used elsewhere).

---

## /app/ops/availability
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **VERIFIED and still true.** `grep -rn "ops/availability" src/` returns exactly
  two hits, both being the route definition itself:
  ```
  src/App.tsx:325:              {/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}
  src/App.tsx:326:              <Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />
  ```
  No nav entry, no link, no `navigate()` call anywhere in `src/`.
- exists: the ROUTE exists; **no component backs it.** There is no `AvailabilityPage` in the repo —
  the element is a bare `<Navigate>`. Nothing was retired behind a boolean here and there is
  nothing to restore; this is a pure URL-preservation redirect.
- content — the entire artifact, both lines, verbatim:
```tsx
{/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}
<Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />
```
It redirects to `/app/calendar`. There is nothing else to show — no page, no copy, no component.
The one thing worth noting: `InstructorHome.tsx:152` labels its calendar tile **"Availability" /
"Set the times you teach"** and points at `/app/calendar` directly, so the concept survived; only
the URL was folded in.

---

## mod.brokerage (AppLayout.tsx:587-589)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **VERIFIED and still true — this is the one genuinely dark module.** The module is
  ON in prod, the nav entry is gone, and no hub page or route exists to restore it to.
- exists: the MODULE row exists and is enabled; **no brokerage page or component exists at all.**
  `grep -rn "brokerage" src/` returns only: the fixture list, the AppLayout removal comment, three
  doc-comments, `pageRegistry.ts:95` (a label), `useModules.ts:30` (catalog membership),
  `OpsDashboard.tsx:99/106/113` (the tile + the "no hub" comments), and `api.ts:2210`. **No `.tsx`
  page file, no route, no component.** So there is nothing built to turn on — only the DB
  entitlement and its server-side RPCs.
- content:

**The module row in prod** (`select m.*, om.* from modules m left join org_modules om …`):
```
 module_key    | mod.brokerage
 name          | Brokerage & Contracts
 description   | Search/evaluation/transaction-representation, engagement_stages, brokerage engagement RPCs.
 is_core       | f
 active        | t
 --- org_modules ---
 id            | 7f59085b-7ff9-4812-857a-a903794af7ff
 org_id        | e656f20b-ef43-4725-9029-19e7f0190d9c
 enabled       | t          ← ENABLED
 source        | TIER
 enabled_at    | 2026-07-02 22:24:22.560749+00
 expires_at    | (null)
```
And `my_modules()` (the RPC `AuthContext` reads) will return it — its body has no exclusion that
would drop it:
```sql
  SELECT om.module_key
    FROM org_modules om
    JOIN modules m ON m.module_key = om.module_key
    WHERE om.org_id = current_org()
      AND om.enabled
      AND (om.expires_at IS NULL OR om.expires_at > now())
      AND COALESCE(m.active, true)
    ORDER BY om.module_key
```

**The AppLayout comment** — `src/components/app/AppLayout.tsx:586-603`. (The report cited line 331;
the file has grown and it now sits at 587-589. Same text.)
```tsx
const MODULES_GROUP: NavItem[] = [
  // Brokerage has no staff hub page yet (mod.brokerage's live surfaces are the
  // client-lane engagement reads) — the entry linked to an unregistered route
  // and 404'd for every staff user with the module on. Re-add with the hub.
  { to: '/app/ops/boarding', label: 'Boarding', icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops', label: 'Barn Ops', icon: Boxes, module: 'mod.barnops' },
  /* REVIEW SECTION — MOVED OUT, not deleted (TASK-REVIEWNAV). One row LEFT
     this group for Review:
       { to: '/app/ops/records', label: 'Records', icon: FileText, module: 'mod.horserecords' }
     ... */
  { to: '/app/ops/employees', label: 'Employees', icon: Contact, module: 'mod.employees' },
];
```

**How it presents to the owner today.** Because it is enabled but has no hub route, the
OpsDashboard module launcher renders it as a non-navigating status tile
(`src/pages/app/ops/OpsDashboard.tsx:95-108`):
```tsx
/**
 * Wave-7 re-link seam: moduleKey → the module's hub route, listing ONLY routes
 * that are actually registered in App.tsx. A module tile navigates only when
 * its hub route appears here; an enabled module without an entry renders as a
 * non-navigating "Enabled" status tile (dead links are forbidden). When a hub
 * page ships, add its route to App.tsx AND one entry here, e.g.
 *   'mod.brokerage': '/app/ops/brokerage',
 */
export const MODULE_HUB_ROUTES: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_HUB_PAGE_KEY)
    .map(([moduleKey, pageKey]) => [moduleKey, pageByKey(pageKey)?.path])
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string'),
);
// mod.brokerage has no hub page, so the registry yields no entry for it and its
// tile renders as the non-navigating "Enabled" status tile (dead links are
// forbidden). That is the same behaviour as the hand-written map this replaced.
```
So on `/app/ops` the owner sees a tile reading **"Brokerage"** with the status word **"Enabled"**
and no arrow — a paid-for, server-live module with zero staff UI. Its label elsewhere is
`src/lib/pageRegistry.ts:95`: `'mod.brokerage': 'Brokerage & Contracts',`.

---

## Module-gated pages: boarding (×4), barnops (×4), employees (×3)
- reported by: TASK-ADMINSWEEP-PHASE1.md
- reachability: **STALE — THE CLAIM IS NOW WRONG. All three modules are ENABLED in prod and all
  eleven pages are LIVE and navigable today.** This is the single biggest correction in this
  report: the owner has ~3,600 lines of fully-built operations software he has probably never
  opened, and it is not behind any switch any more.

  **Proof 1 — the modules are ON.** `select … from modules m left join org_modules om …`:
  ```
   module_key    | name                  | enabled | source |          enabled_at
  ---------------+-----------------------+---------+--------+------------------------------
   mod.barnops   | Barn Ops & Inventory  | t       | GRANT  | 2026-08-12 15:02:21.285597+00
   mod.boarding  | Boarding & Facility   | t       | GRANT  | 2026-08-12 15:02:21.285597+00
   mod.employees | Employees & Scheduling| t       | GRANT  | 2026-08-12 15:02:21.285597+00
  ```
  All three flipped on 2026-08-12 by `supabase/migrations/20260812T1600_pagevis_all_modules_and_page_visibility.sql`
  (whose own header records: *"Measured before this migration: brokerage / horserecords / lessons
  TRUE"* — i.e. these three were the FALSE ones).

  **Proof 2 — nothing is hidden.** `select * from org_page_visibility;` → **0 rows**. No page is
  put away.

  **Proof 3 — the nav rows pass the filter.** The gate is `src/components/app/AppLayout.tsx:659-662`:
  ```tsx
  const visible = (items: NavItem[]) => items.filter(
    (i) => (!i.module || hasModule(i.module))
        && (!i.adminOnly || isAdmin || grantKeys.includes(i.to)),
  );
  ```
  and the rows are `AppLayout.tsx:590-591, 602`:
  ```tsx
  { to: '/app/ops/boarding',  label: 'Boarding',  icon: HomeIcon, module: 'mod.boarding' },
  { to: '/app/ops/barnops',   label: 'Barn Ops',  icon: Boxes,    module: 'mod.barnops' },
  { to: '/app/ops/employees', label: 'Employees', icon: Contact,  module: 'mod.employees' },
  ```
  With all three modules true, the **Modules** nav group renders all three hub links.

  **Proof 4 — the routes are registered.** `src/App.tsx:336-343` and `:352-354`:
  ```tsx
  <Route path="ops/boarding" element={<ProtectedRoute requireStaff><BoardingHubPage /></ProtectedRoute>} />
  <Route path="ops/boarding/facilities" element={<ProtectedRoute requireStaff><FacilitiesPage /></ProtectedRoute>} />
  <Route path="ops/boarding/agreements" element={<ProtectedRoute requireStaff><BoardAgreementsPage /></ProtectedRoute>} />
  <Route path="ops/boarding/charges" element={<ProtectedRoute requireStaff><BoardChargesPage /></ProtectedRoute>} />
  <Route path="ops/barnops" element={<ProtectedRoute requireStaff><BarnopsHubPage /></ProtectedRoute>} />
  <Route path="ops/barnops/resources" element={<ProtectedRoute requireStaff><ResourcesPage /></ProtectedRoute>} />
  <Route path="ops/barnops/consumption" element={<ProtectedRoute requireStaff><ConsumptionLogPage /></ProtectedRoute>} />
  <Route path="ops/barnops/allocation-rules" element={<ProtectedRoute requireStaff><AllocationRulesPage /></ProtectedRoute>} />
  ...
  <Route path="ops/employees" element={<ProtectedRoute requireStaff><EmployeesHubPage /></ProtectedRoute>} />
  <Route path="ops/employees/staff" element={<ProtectedRoute requireStaff><StaffPage /></ProtectedRoute>} />
  <Route path="ops/employees/schedule" element={<ProtectedRoute requireStaff><SchedulePage /></ProtectedRoute>} />
  ```
  The remaining per-page gate is a second, redundant `<ModuleGate moduleKey="mod.boarding" modules={modules}>`
  inside each page — which also passes now.
- exists: all eleven, yes. **3,573 lines across the eleven files.** Line counts per page below.
- content:

### Boarding — hub

**`/app/ops/boarding` — `src/pages/app/ops/hubs/BoardingHubPage.tsx` (137 lines)**
Section cards (`:22-37`):
```tsx
  { to: '/app/ops/boarding/facilities', title: 'Facilities & stalls',
    description: 'Manage properties and the stalls within them.' },
  { to: '/app/ops/boarding/agreements', title: 'Board agreements',
    description: 'Per-horse contracts: boarder, stall, monthly rate, status.' },
  { to: '/app/ops/boarding/charges',    title: 'Board charges',
    description: 'Generate period charges and follow them to settlement.' },
```
Visible copy: `Boarding · Ops` (title) · h1 `Boarding` · KPI labels `Stall occupancy`,
`Active agreements`, `Open board charges` · `Could not load boarding KPIs.` · the three card
titles + descriptions above · `<nav aria-label="Boarding sections">`.

### Boarding — 1/3: Facilities & stalls
**`/app/ops/boarding/facilities` — `FacilitiesPage.tsx` (453 lines)**
Two stacked tables on one page (`:353-407`):
```tsx
<section aria-labelledby="facilities-heading" className="mb-10">
  <div className="flex items-center justify-between mb-4">
    <h1 id="facilities-heading" className="font-serif text-2xl text-green-900">Facilities</h1>
    <button type="button" className="btn-primary" onClick={...}>New facility</button>
  </div>
  <DataTable columns={facilityColumns} rows={facilities} rowKey={(f) => f.id} loading={loading}
    emptyTitle="No facilities yet"
    emptyMessage="Create your first facility to start assigning stalls." ... />
</section>
...
<h2 id="stalls-heading" className="font-serif text-xl text-green-900">Stalls</h2>
  emptyTitle="No stalls yet"
  emptyMessage="Add stalls under a facility to track occupancy."
```
Column headers: `Address key`, `Facility`, + a `StatusBadge` of `ACTIVE`/`INACTIVE`.
Form fields: `Address registry key`, `Facility` (required), `Stall type`
(hint: *"e.g. 12x12, foaling, paddock."*).
Buttons/toasts: `New facility`, `New stall`, `Create facility`, `Save facility`, `Create stall`,
`Save stall`, `Saving…`, `Edit facility`, `Edit stall`, `Name is required.`,
`Facility and code are required.`, `Could not load facilities.`, `Facility created.`,
`Facility updated.`, `Could not save facility.`, `Stall created.`, `Stall updated.`,
`Could not save stall.`

### Boarding — 2/3: Board agreements
**`/app/ops/boarding/agreements` — `BoardAgreementsPage.tsx` (408 lines)**
Header (`:337-348`):
```tsx
<ModuleGate moduleKey="mod.boarding" modules={modules}>
  <div className="flex items-center justify-between mb-6">
    <div>
      <h1 className="font-serif text-2xl text-green-900">Board agreements</h1>
      <p className="text-sm text-green-800/70">
        Per-horse boarding contracts. Agreements archive by status — never delete.
      </p>
    </div>
```
Status machine + transition button labels (`:44-54`):
```tsx
  ACTIVE:    ['SUSPENDED', 'ENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'ENDED', 'CANCELLED'],
  ...
  ACTIVE: 'Reactivate',
  SUSPENDED: 'Suspend',
```
Columns: `Boarder`, `Monthly rate`, + a screen-reader-only `Transitions` column.
Form fields: `Boarder` (required, hint *"The payer contact board charges bill to."*),
`Monthly rate` (hint *"Leave blank to use the tenant default board rate from the registry."*),
`Board type` (hint *"e.g. full, pasture, training."*), `Start date`, an `Unassigned` stall option.
Empty state: `No board agreements yet` / `Create an agreement to link a horse, a payer and a stall.`
Modal title `New board agreement`; messages `Horse and boarder are required.`,
`Board agreement created.`, `Could not create the agreement.`, `Could not update the agreement.`,
`Could not load board agreements.`

### Boarding — 3/3: Board charges
**`/app/ops/boarding/charges` — `BoardChargesPage.tsx` (368 lines)**
Header (`:300-308`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Board charges</h1>
  <p className="text-sm text-green-800/70">Period charges emitted to billing.</p>
```
Columns: `Agreement`, `Billing` (a `StatusBadge` defaulting to `UNBILLED`), `Emitted`.
Form: `Agreement` (required), `Period start` (required), `Period end` (required), `Amount`
(required, hint *"Prefilled from the agreement's monthly rate."*).
Buttons/toasts: `Generate`, `Generating…`, modal `Generate board charge`, `Emit to billing`,
`Charge generated and emitted to billing.`, `Charge emitted to billing.`,
`Could not generate the charge.`, `Could not emit the charge.`, `Could not load board charges.`,
`Agreement, period and amount are required.`
Empty state: `No board charges yet` / `Generate a period charge from an active agreement.`

### Barn Ops — hub
**`/app/ops/barnops` — `BarnopsHubPage.tsx` (116 lines)** — h1 `Barn Ops`, three cards (`:23-41`):
```tsx
  { to: '/app/ops/barnops/resources', title: 'Resources & lots',
    description: 'Consumables catalog with stock levels computed from purchased lots.' },
  { to: '/app/ops/barnops/consumption', title: 'Consumption log',
    description: 'Append-only usage ledger — dumb, cheap facts priced later at resolution.' },
  { to: '/app/ops/barnops/allocation-rules', title: 'Allocation & billing',
    description: 'Cost attribution overrides + the deterministic billing resolver.' },
```

### Barn Ops — 1/3: Resources & lots
**`/app/ops/barnops/resources` — `ResourcesPage.tsx` (546 lines — the largest of the eleven)**
Header (`:372-379`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Resources</h1>
  <p className="text-sm text-green-800/70">
    Consumables catalog — stock levels are the sum of on-hand across purchased lots.
  </p>
```
Two tables. Resource columns: `Name`, `Key`, `Category`, `Unit`, `On hand`.
Lots table (h2 at `:448`) columns: `Resource`, `Vendor`, `Purchased`, `Unit cost`, `On hand`,
`Purchased at`.
Form fields: `Resource key` (req), `Name` (req), `Category` (req), `Unit of measure`, `Vendor`,
`Quantity purchased` (req), `Unit cost` (req, hint *"Cost per unit; the resolver prices
consumption from the drawn lot."*).
Empty states: `No resources yet` / `Create a resource, then record purchased lots against it.`
and `No lots yet` / `Use “Add lot” on a resource to record a purchase.`
Toasts: `Resource created.`, `Resource updated.`, `Lot recorded.`

### Barn Ops — 2/3: Consumption log
**`/app/ops/barnops/consumption` — `ConsumptionLogPage.tsx` (330 lines)**
Header (`:136-142`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Consumption log</h1>
  <p className="text-sm text-green-800/70">
    Append-only ledger — logged events cannot be edited or deleted; corrections are new
    offsetting events. Pricing happens later, at billing resolution.
  </p>
```
Capture form fields: `Resource` (req), `Lot`, `Horse` (hint *"Optional — attribution falls to the
barn when blank."*), `Quantity` (req), `Occurred at` (hint *"Leave blank to record “now”."*), `Notes`.
Log table columns: `When`, `Resource`, `Lot`, `Horse`, `Qty`, `Notes`.
Empty state: `No consumption logged yet` / `Log the first event with the form above.`
Toast: `Consumption logged.`

### Barn Ops — 3/3: Cost allocation rules
**`/app/ops/barnops/allocation-rules` — `AllocationRulesPage.tsx` (532 lines)**
Header (`:347-355`):
```tsx
  <h1 className="font-serif text-2xl text-green-900">Cost allocation rules</h1>
  <p className="text-sm text-green-800/70">
    Overrides for consumption attribution — plus the default/barn payer that absorbs
    uncovered remainders.
  </p>
```
Rules table columns: `Scope`, `Target`, `Payer`, `Share %`, `Effective`.
Form: `Scope`, `Horse` (req), `Payer` (req), `Share %` (req, hint *"Splits for a scope should sum
to 100."*), `Effective from`, `Effective to`.
Empty state — the most informative one in the set:
`No allocation rules yet` / `Without an override, attribution derives from each horse's parties;
add a 'default' rule for the barn payer.`
Second section (h2 at `:433`) — a **billing resolver preview**: field `Period (month)` (req),
result columns `Payer`, `Horse`, `Qty`, `Unit`, `Amount`, `Status`; empty state
`No billable lines produced` / `No consumption events fell inside this period.`
Toasts: `Rule created.`, `Rule updated.`, `Rule removed.`, `Could not remove the rule.`

### Employees — hub
**`/app/ops/employees` — `EmployeesHubPage.tsx` (63 lines)**, whole render:
```tsx
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Employees</h1>
        <p className="text-sm text-green-800/70">Staff, schedules and service assignments.</p>
      </div>

      <ModuleGate moduleKey="mod.employees" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load the employees summary.'}
          </p>
        )}
        {load.isPending && !kpis && (
          <p className="text-sm text-green-800/70" data-testid="hub-loading">Loading…</p>
        )}

        {kpis && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/app/ops/employees/staff" className="..." data-testid="kpi-active-staff">
              <p className="form-label mb-1">Active staff</p>
              <p className="font-serif text-3xl text-green-900">{kpis.activeStaff}</p>
            </Link>
            <Link to="/app/ops/employees/schedule" className="..." data-testid="kpi-shifts-week">
              <p className="form-label mb-1">Shifts this week</p>
              <p className="font-serif text-3xl text-green-900">{kpis.shiftsThisWeek}</p>
            </Link>
          </div>
        )}
      </ModuleGate>
```
(Note the header comment at `:8-14` promises a third KPI, *"open-assignments"*, which is not
rendered.)

### Employees — 1/2: Staff
**`/app/ops/employees/staff` — `StaffPage.tsx` (183 lines)**
```tsx
  <h1 className="font-serif text-2xl text-green-900">Staff</h1>
  <p className="text-sm text-green-800/70">Team profiles.</p>
  ...
  <button type="button" className="btn-primary" onClick={openCreate}>Add staff member</button>
  <DataTable<StaffProfile> columns={[
    { key: 'name',   header: 'Name',     render: … },
    { key: 'email',  header: 'Email',    render: … },
    { key: 'title',  header: 'Title',    render: … },
    { key: 'pay',    header: 'Pay type', render: … },
    { key: 'active', header: 'Status',   render: (r) => <StatusBadge status={r.active ? 'ACTIVE' : 'INACTIVE'} /> },
  ]}
    emptyTitle="No staff yet"
    emptyMessage="Add your first team member to schedule shifts." />
```
Form fields: `Team member account` (req), `Title`, `Pay type` (hint *"e.g. HOURLY, SALARY,
PER_SERVICE"*), `Active`.
Toasts: `Staff profile created`, `Staff profile updated`, `Could not load staff.`

### Employees — 2/2: Schedule
**`/app/ops/employees/schedule` — `SchedulePage.tsx` (237 lines)**
```tsx
  <h1 className="font-serif text-2xl text-green-900">Schedule</h1>
  <p className="text-sm text-green-800/70">
    Week of {week.start.toLocaleDateString()} – {new Date(week.end.getTime() - 1).toLocaleDateString()}
  </p>
  <div className="flex gap-2">
    <button ... onClick={...}>← Prev week</button>
    <button ... onClick={() => setAnchor(new Date())}>This week</button>
    <button ... onClick={...}>Next week →</button>
  </div>
  ...
  <button type="button" className="btn-primary" onClick={() => setShiftModal(true)}>New shift</button>
  <DataTable<Shift> columns={[
    { key: 'staff',  header: 'Staff'  }, { key: 'starts', header: 'Starts' },
    { key: 'ends',   header: 'Ends'   }, { key: 'role',   header: 'Role'   },
  ]}
    emptyTitle="No shifts this week"
    emptyMessage="Create a shift to build the week's schedule." />
```
Form fields: `Staff member` (req), `Starts` (req), `Ends`, `Role` (hint uses the tenant property
term: *"e.g. {Property} duty, Lessons, Show prep"*), and a time-entry form with `Clock in` (req)
and `Clock out`.
Toasts: `Shift created`, `Time entry recorded`, `Could not load shifts.`

**Line-count summary of this block:**
| page | file | lines |
|---|---|---|
| Boarding hub | `hubs/BoardingHubPage.tsx` | 137 |
| Facilities & stalls | `boarding/FacilitiesPage.tsx` | 453 |
| Board agreements | `boarding/BoardAgreementsPage.tsx` | 408 |
| Board charges | `boarding/BoardChargesPage.tsx` | 368 |
| Barn Ops hub | `hubs/BarnopsHubPage.tsx` | 116 |
| Resources & lots | `barnops/ResourcesPage.tsx` | 546 |
| Consumption log | `barnops/ConsumptionLogPage.tsx` | 330 |
| Cost allocation rules | `barnops/AllocationRulesPage.tsx` | 532 |
| Employees hub | `hubs/EmployeesHubPage.tsx` | 63 |
| Staff | `employees/StaffPage.tsx` | 183 |
| Schedule | `employees/SchedulePage.tsx` | 237 |
| **total** | | **3,373** |
(Plus `hubs/LessonsHubPage.tsx` 107 and `hubs/RecordsHubPage.tsx` 102, which belong to
already-live modules.)

---

## IntakePage / route /app/ops/intake (src/pages/app/ops/IntakePage.tsx)
- reported by: TASK-DASHLEADS-REPORT.md
- reachability: **The commit is VERIFIED. The "reachable via dashboard links" half is STALE — the
  page is now reachable ONLY through the admin Review mount.**
  - Commit confirmed:
    ```
    commit cefaad7b4a68ced12cae79079a61b4f48e1ab65b
    Author: Admin <admin@cactai.io>   Date: Mon Aug 10 21:24:36 2026
    feat(ui): UIO-012 item 2/2b — Dashboard moves to Management, a divider separates Add New
    ```
    Its message states the nav half precisely: *"MANAGEMENT_GROUP: Inbound entry replaced with
    Dashboard … Badge injection retargeted from /app/ops/intake to /app/dashboard"* — and flags
    that it deliberately did NOT touch the page (*"IntakePage.tsx is 870 lines of staff tooling …
    not a nav-menu change"*).
  - **The route no longer builds to the page.** A SECOND retirement landed on 2026-08-11
    (TASK-LEADCLEAN) closing the route half. `src/pages/app/ops/IntakePage.tsx:447`:
    `export const INTAKE_PAGE_RETIRED = true;` and `src/App.tsx:310-318`:
    ```tsx
    {/* RETIRED 2026-08-11 (TASK-LEADCLEAN): the owner ruled the
        dashboard is the surface and Inbound goes away. The nav item
        was already gone; this closes the route. Redirects rather than
        404s so the notification links that still point here land on
        the lead's drawer (the `request` param is carried through);
        flip the boolean to restore the page. */}
    <Route path="ops/intake" element={INTAKE_PAGE_RETIRED
      ? <IntakeRetiredRedirect />
      : <ProtectedRoute requireStaff><IntakePage /></ProtectedRoute>} />
    ```
  - **The dashboard links the report describes now EXPAND IN PLACE instead of navigating.**
    `grep -rn "ops/intake" src/` finds no `<Link>`/`navigate()` to it anywhere; every
    `DashboardPanel` hit is a comment recording the removal:
    ```
    src/components/app/DashboardPanel.tsx:26:  the ONLY surface for it (/app/ops/intake is retired) and made the list
    src/components/app/DashboardPanel.tsx:202: // to navigate to /app/ops/intake — a page that no longer exists — so the whole
    src/components/app/DashboardPanel.tsx:216: // Deep link: notification writers emit /app/ops/intake?request=<id>, which the
    src/components/app/DashboardPanel.tsx:398: {/* EXPAND, in place. This used to navigate to /app/ops/intake, which
    ```
  - **The one live way in** is the admin Review nav row **"Inbound B · retired queue"** →
    `/app/ops/review/intake` (`src/App.tsx:367`, `src/lib/reviewSection.ts:147-151`).
- exists: yes (463 lines — note the commit message's "870 lines" predates the LeadWorkDrawer
  extraction described in the file header)
- content:

The redirect component, which is what the route actually renders (`IntakePage.tsx:449-462`):
```tsx
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

The page itself (`IntakePage.tsx:333-380`) — the Inbound queue:
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
  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Inbound</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Everything sent to the company — booking requests, contact/inquiry notes,
        kiosk signers, and support. This is a queue: it should reach zero.
      </p>

      {/* NEEDS ATTENTION — the whole point of the queue. Nothing here previously
          distinguished a request that had been sitting for ten days from one
          that arrived this morning, which is how three lesson enquiries aged 6–10
          days without anyone noticing.

          `overdue` is deliberately narrow: still new, the person has NOT already
          become a client, and 2+ days old. Six of the nine rows in the live
          backlog were kiosk sign-ins whose person was already converted — work
          genuinely done, row never closed. Those are listed separately as
          bookkeeping so they never drown out real opportunity. */}
      <InboundAttention />

      <BookingFieldsSettings />

      {/* kind filter: buttons on desktop, dropdown on mobile */}
      <div className="hidden sm:flex flex-wrap gap-2 mb-5" aria-label="Filter inbound by kind">
        {KIND_FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={kind === f.id}
            onClick={() => setKind(f.id)}
```
Request status filters (`IntakePage.tsx:56-61`):
```tsx
const REQUEST_FILTERS: { id: RequestFilter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'invited', label: 'Invited' },
  { id: 'converted', label: 'Converted' },
```
Row composition (`IntakePage.tsx:295-310`) — what each queue line shows:
```tsx
        ...requests.map((r) => ({
          key: `b-${r.id}`, kind: 'booking' as const, when: r.created_at,
          who: r.contact_name || r.contact_email || 'Visitor',
          what: (r.request_selections ?? []).map((x) => x.label).filter(Boolean).slice(0, 2).join(', ')
            || 'Booking request',
          status: r.status, refId: r.id,
        })),
        ...support.map((t) => ({
          key: `s-${t.id}`, kind: 'support' as const, when: t.created_at,
          who: 'Member', what: t.subject, status: t.status, refId: t.id,
        })),
```
Visible strings: `Inbound` · `Everything sent to the company — booking requests, contact/inquiry
notes, kiosk signers, and support. This is a queue: it should reach zero.` · `← Inbound` ·
`Booking request` · `Visitor` · `Member` · filters `New` / `Contacted` / `Invited` / `Converted` ·
`Filter inbound by kind` · `Could not load the inbound queue.` · plus whatever
`InboundAttention`, `BookingFieldsSettings` and `RequestInbox` render.

Worth noting for the owner's judgment (`IntakePage.tsx:10-16`) — the machinery is NOT lost with
the page:
```
 * The WORKING MACHINERY did not retire with the page. It was extracted to
 * `components/app/LeadWorkDrawer.tsx` — the fit checklist (set_request_checklist),
 * the staff call-notes timeline, "Mark contacted", ProvisionClientForm, the gift
 * path, and the schedule-lesson path (findClientForRequest → ScheduleSessionForm)
 * — and the dashboard's lead card opens that same component. One implementation,
 * two hosts; retiring a page costs the product nothing.
```

---

## Community → Resources download control missing (src/lib/communityFeed.ts:211, src/lib/community.ts:316)
- reported by: TASK-UPLOADS-REPORT.md
- reachability: **VERIFIED — the function has exactly one occurrence in the entire `src/` tree:
  its own definition.**
  ```
  $ grep -rn "resourceDownloadUrl" src/
  src/lib/community.ts:316:export async function resourceDownloadUrl(storagePath: string): Promise<string | null> {
  ```
  No import, no call, no test. It is exported and unreferenced.

  **The upstream reason it cannot be called**: the mapper that turns a `content_resources` row into
  a feed card **discards `storage_path` and `file_id` entirely** (`src/lib/communityFeed.ts:146-152`):
  ```ts
  function fromResource(r: ContentResource): FeedCard {
    return {
      id: r.id, view: 'resources', kind: 'resource',
      title: r.title, body: r.description ?? undefined,
      ts: new Date(r.created_at).getTime(), when: ago(r.created_at),
    };
  }
  ```
  A `FeedCard` therefore carries no file reference, so no downstream component *could* render a
  download control even if one were added. The `FeedCard` shape does have a `url` field — the
  vendor mapper right below uses it (`communityFeed.ts:154-161`) — but `fromResource` does not set it.
- exists: yes, `resourceDownloadUrl` exists and (per TASK-UPLOADS) now points at a real bucket.
- **CORRECTION TO THE CLAIM: there are no published guides currently unreachable, because there are
  no rows.** `content_resources` in prod:
  ```
  columns: id | title | description | kind | url | storage_path | published | created_at | org_id | file_id
  select * from content_resources;   →  (0 rows)
  ```
  So the missing download control is a latent gap, not an active one. Nothing is stranded today;
  the first guide uploaded would be.
- content:

**`resourceDownloadUrl()` — the full body** (`src/lib/community.ts:308-320`):
```ts
/** Signed URL for a Storage-backed resource.
 *
 *  TASK-UPLOADS fixed a live defect here: this signed against a bucket named
 *  `members`, which has never existed — there are twelve buckets and that is not
 *  one of them, so every call returned null and no resource was downloadable.
 *  Company material now lives in the private `facility-files` bucket alongside
 *  the rest of the Files spine. Members reach it only while the
 *  content_resources row is published; the storage policy reads that same flag. */
export async function resourceDownloadUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
```

**The Resources card, proving no download control** (`src/components/feed/CommunityFeed.tsx:177-186`):
```tsx
  // ── RESOURCE: title + body (contact lives in the modal) ──
  if (c.kind === 'resource') {
    return (
      <article ref={ref} onClick={open}
        className={`rounded-xl border border-green-800/10 bg-white p-4 ${clickable}`}>
        <p className="font-serif text-green-800 text-[17px] font-semibold leading-snug mb-1">{c.title}</p>
        {c.body && <p className="text-[12px] text-muted line-clamp-2">{c.body}</p>}
      </article>
    );
  }
```
Title and description. No button, no link, no icon.

**The modal it opens — also no download control** (`src/components/feed/PostModal.tsx:297-311`):
```tsx
function ResourceBody({ card }: { card: FeedCard }) {
  const links = contactActions({
    communityEmail: card.communityEmail, mobileCall: card.mobileCall, mobileText: card.mobileText,
  });
  return (
    <div>
      <h3 className="font-serif text-green-800 text-xl font-semibold leading-snug mb-2">{card.title}</h3>
      {card.body && <p className="text-sm text-secondary mb-5 leading-relaxed">{card.body}</p>}
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <a key={l.method} href={l.href} className="inline-flex items-center gap-1.5 text-xs text-green-700 border border-green-800/15 rounded-lg px-3 py-2 hover:bg-green-50">
            {l.method === 'email' ? <Mail size={14} /> : <Phone size={14} />} {l.label}
          </a>
```
The only actions are email/phone links — and those come from the **vendor** share-back path
(`fromVendor` sets `communityEmail`/`mobileCall`/`mobileText`), never from a `content_resources`
row. So for an actual published guide, the modal renders a heading, a paragraph, and an empty
action row.

**The feed that lists them** (`src/lib/communityFeed.ts:209-217`):
```ts
export async function fetchViewCards(view: FeedView): Promise<FeedCard[]> {
  switch (view) {
    ...
    case 'resources': {
      // content_resources + shared vendors (share-back from My Stable) in one list
      const [resources, vendors] = await Promise.all([
        fetchResources().catch(() => []),
        listVendors(true).catch(() => [] as Vendor[]),
      ]);
      return [...resources.map(fromResource), ...vendors.map(fromVendor)];
    }
```
