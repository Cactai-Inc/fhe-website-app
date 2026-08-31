import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageLayout } from '../../components/app/PageLayout';
import { useDocumentTitle } from '../../lib/hooks';
import { supabase } from '../../lib/supabase';
import { adminClientAccounts, type ClientAccountRow } from '../../lib/admin';
import { listLookupOptionsAll } from '../../lib/api';
import { lookupName, type LookupCode } from '../../lib/ops/types';
import { ContactDossierModal } from '../../components/app/ContactDossierModal';
import {
  RosterCard, rowKeyOf, memberName, EMPTY_SUPPLEMENT, type RosterSupplement,
} from '../../components/app/RosterCard';

/**
 * CLIENTS (/app/records/clients) — THE one people page (TASK-ROSTER /
 * TASK-ROSTERCARD, owner ruling 2026-08-10). Shows every contact we serve —
 * login-backed accounts, provisioned clients, and bare contacts with neither.
 * Deliberate exclusions: LEAD (Leads page, until worked), TEAM (Team & access),
 * DIRECTORY (rolodex).
 *
 * THIS IS A TRIAGE VIEW, NOT A DIRECTORY (owner). The grid of cards exists to
 * make two groups jump out: who is stuck, and who is engaging most. The ring
 * around each avatar carries the relationship; badges show what's DERIVED (never
 * free-text tags); flags surface only what can be acted on today. See
 * RosterCard.tsx and docs/reports/TASK-ROSTERCARD-REPORT.md.
 *
 * ⚠️ TASK-FIX2 §3 — THE ISOLATED VIEW IS GONE, AND WHY.
 *
 * Clicking a card used to isolate it and render a SECOND record surface here:
 * nine account-keyed tabs wrapped in `{selected.kind === 'account' && …}` at
 * `:1018` and `:1033`, plus a `PendingClientView` under
 * `{selected.kind !== 'account' && …}` whose provisioning form was itself gated
 * on `neverInvited || isDraft`. Measured 2026-08-30 against production:
 *
 *   • 17 of 24 people had NO tabs at all — not empty tabs, absent ones.
 *   • 9 of 24 had no provisioning surface: the 7 with a login (the form closes
 *     permanently once someone signs in) and the 2 whose invitation had gone out.
 *   • Pamela Godde and Charlotte Caddell sat behind BOTH gates.
 *   • And `ContactDossierModal` — the only surface carrying the 30-field record,
 *     relationships, paperwork, orders with line items and the standing weekly
 *     slot — could not be opened for a single one of the 24, because its live
 *     doors were Leads, Horses and Archived and all 24 are `contact_type='CONTACT'`.
 *
 * The rule deciding which surface you got was never anything about the person; it
 * was which tab you clicked through. So the list stays and the second surface
 * goes: a card opens THE record, the same one Records › Horses and Records ›
 * Leads open. Everything the retired layout held alone moved into it — the
 * invitation lifecycle, Bookings, Payments, Messages, sign-in detail, and
 * suspend / remove / archive / hard delete. See `ContactDossierModal`'s header.
 */

// ── the page ─────────────────────────────────────────────────────────────────
// Sort PORTED from ContactsPage (TASK-ROSTER): A–Z on display name by default,
// or newest-first. The old Active-first sort key is gone with the port.
type SortKey = 'name' | 'newest';

export default function Admin() {
  useDocumentTitle('Clients');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [members, setMembers] = useState<ClientAccountRow[]>([]);
  const [supplement, setSupplement] = useState<RosterSupplement>(EMPTY_SUPPLEMENT);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  /** The contact whose record is open. A contact id, never a row key — the record
   *  keys on the person, not on whether they happen to have a login. */
  const [openContactId, setOpenContactId] = useState<string | null>(null);

  const load = useCallback(() => {
    // login-backed accounts + provisioned clients + bare contacts, one list
    adminClientAccounts()
      .then(setMembers)
      .catch(() => setError('Could not load clients.'));
  }, []);
  useEffect(load, [load]);

  // TASK-ORIGIN §6 — origin/channel filters, unfiltered by active (T4: a
  // deactivated code must stay findable on the records that already carry
  // it), same pattern as the Leads tab (ContactsPage.tsx).
  const [originOpts, setOriginOpts] = useState<LookupCode[]>([]);
  const [channelOpts, setChannelOpts] = useState<LookupCode[]>([]);
  useEffect(() => {
    listLookupOptionsAll('client_origin').then(setOriginOpts).catch(() => setOriginOpts([]));
    listLookupOptionsAll('contact_channel').then(setChannelOpts).catch(() => setChannelOpts([]));
  }, []);
  const [originFilter, setOriginFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  // Everything the card needs beyond admin_client_accounts (TASK-ROSTERCARD:
  // no DB work, so this is read directly under the same admin RLS the RPC
  // itself requires). Reconciled against direct SQL in the report.
  useEffect(() => {
    if (members.length === 0) { setSupplement(EMPTY_SUPPLEMENT); return; }
    let active = true;
    const contactIds = members.map((m) => m.contact_id).filter((id): id is string => !!id);
    const userIds = members.map((m) => m.user_id).filter((id): id is string => !!id);

    Promise.all([
      supabase.from('groups').select('contact_id, group_type'),
      supabase.from('contacts').select('id, first_name, last_name, display_name, guardian_contact_id')
        .is('deleted_at', null),
      supabase.from('horses').select('registered_name, nickname, current_owner_contact_id, lessee_contact_id')
        .is('deleted_at', null),
      supabase.from('document_parties').select('contact_id, party_role, documents(status, deleted_at)')
        .in('contact_id', contactIds),
      supabase.from('documents').select('contact_id, status').in('contact_id', contactIds).is('deleted_at', null),
      supabase.from('purchases').select('buyer_contact_id').eq('status', 'awaiting_payment').is('deleted_at', null),
      userIds.length > 0
        ? supabase.from('audit_logs').select('actor_user_id, occurred_at')
            .in('actor_user_id', userIds).order('occurred_at', { ascending: false }).limit(2000)
        : Promise.resolve({ data: [] as { actor_user_id: string; occurred_at: string }[] }),
    ]).then(([groupsRes, contactsRes, horsesRes, partiesRes, docsRes, purchasesRes, auditRes]) => {
      if (!active) return;

      const groups = new Map<string, string[]>();
      for (const r of groupsRes.data ?? []) {
        const list = groups.get(r.contact_id) ?? [];
        list.push(r.group_type);
        groups.set(r.contact_id, list);
      }

      const contactNames = new Map<string, string>();
      const guardianOf = new Map<string, string>();
      const dependentsOf = new Map<string, string[]>();
      for (const c of contactsRes.data ?? []) {
        const name = c.display_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || 'Unnamed';
        contactNames.set(c.id, name);
        if (c.guardian_contact_id) {
          guardianOf.set(c.id, c.guardian_contact_id);
          const kids = dependentsOf.get(c.guardian_contact_id) ?? [];
          kids.push(c.id);
          dependentsOf.set(c.guardian_contact_id, kids);
        }
      }

      const horsesOwned = new Map<string, string[]>();
      const horsesLeased = new Map<string, string[]>();
      for (const h of horsesRes.data ?? []) {
        const label = h.nickname || h.registered_name || 'Unnamed horse';
        if (h.current_owner_contact_id) {
          const list = horsesOwned.get(h.current_owner_contact_id) ?? [];
          list.push(label);
          horsesOwned.set(h.current_owner_contact_id, list);
        }
        if (h.lessee_contact_id) {
          const list = horsesLeased.get(h.lessee_contact_id) ?? [];
          list.push(label);
          horsesLeased.set(h.lessee_contact_id, list);
        }
      }

      const dealParty = new Set<string>();
      // TASK-ROLEBUNDLE: the four roles `contract_role_documents` is keyed on —
      // the same set the DB reader uses, so the badge and the contract's own
      // paperwork panel can never disagree about who is a party to a deal.
      const CONTRACT_ROLES = new Set(['BUYER', 'LESSEE', 'LESSOR', 'SELLER']);
      const contractRole = new Set<string>();
      const outstandingDocs = new Set<string>();
      const OUTSTANDING = new Set(['DRAFT', 'AWAITING_SIGNATURE']);
      type PartyRow = { contact_id: string; party_role: string | null; documents: { status: string; deleted_at: string | null } | { status: string; deleted_at: string | null }[] | null };
      for (const r of (partiesRes.data ?? []) as PartyRow[]) {
        dealParty.add(r.contact_id);
        if (r.party_role && CONTRACT_ROLES.has(r.party_role)) contractRole.add(r.contact_id);
        const docs = Array.isArray(r.documents) ? r.documents : (r.documents ? [r.documents] : []);
        for (const d of docs) {
          if (!d.deleted_at && OUTSTANDING.has(d.status)) outstandingDocs.add(r.contact_id);
        }
      }
      for (const d of (docsRes.data ?? []) as { contact_id: string | null; status: string }[]) {
        if (d.contact_id && OUTSTANDING.has(d.status)) outstandingDocs.add(d.contact_id);
      }

      const unpaidContacts = new Set<string>();
      for (const p of (purchasesRes.data ?? []) as { buyer_contact_id: string | null }[]) {
        if (p.buyer_contact_id) unpaidContacts.add(p.buyer_contact_id);
      }

      const lastActive = new Map<string, string>();
      for (const a of (auditRes.data ?? []) as { actor_user_id: string; occurred_at: string }[]) {
        if (!lastActive.has(a.actor_user_id)) lastActive.set(a.actor_user_id, a.occurred_at);
      }

      setSupplement({
        groups, guardianOf, dependentsOf, contactNames, dealParty, contractRole, outstandingDocs,
        unpaidContacts, horsesOwned, horsesLeased, lastActive,
      });
    });
    return () => { active = false; };
  }, [members]);

  /* ⚠️ TASK-FIX2 §4 — `?open=<contactId>` LANDS ON THE PERSON, LIST OR NO LIST.
     The dashboard's "People waiting on a reply" zone builds its links with
     `contactHref` (`dashboard/registry.ts:177`), which points here. This effect
     used to require `members.some(...)` — membership of `admin_client_accounts()`
     — and that function's third arm admits only `contact_type = 'CONTACT'`. Both
     people on the zone today are filed `LEAD`:

         Rachel Page   28712509-…  LEAD  inquiry, waiting 208 hours
         Casey Caddell 1d88cfc6-…  LEAD  inquiry, waiting  59 hours

     so the Open link on every row was dead. The record does not need the list:
     `contact_dossier` keys on the contact and already serves every kind (AR2 F12),
     so an id that is not on the list opens anyway. ⚠️ A user id still resolves,
     via the row it belongs to, because that is what the roster's own links pass. */
  /* Consumed ONCE. Saving the record calls `load()`, which replaces `members`; if
     this effect could fire again on that it would reopen the record the moment
     staff closed it. */
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    const open = params.get('open');
    if (!open || deepLinkHandled.current || members.length === 0) return;
    const row = members.find((m) => rowKeyOf(m) === open || m.contact_id === open);
    if (row?.contact_id) { deepLinkHandled.current = true; setOpenContactId(row.contact_id); return; }
    // Not on this list. If it looks like an id at all, it is still a person.
    if (/^[0-9a-f-]{36}$/i.test(open)) { deepLinkHandled.current = true; setOpenContactId(open); }
  }, [members, params]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (originFilter && m.client_origin !== originFilter) return false;
      if (channelFilter && m.contact_channel !== channelFilter) return false;
      return !needle
        || memberName(m).toLowerCase().includes(needle)
        || (m.email ?? '').toLowerCase().includes(needle)
        || (m.tags ?? []).some((t) => t.toLowerCase().includes(needle));
    });
    // ContactsPage's sort, ported verbatim: newest by created_at, else name A–Z.
    return [...filtered].sort((a, b) => sortKey === 'newest'
      ? new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      : memberName(a).localeCompare(memberName(b)));
  }, [members, q, sortKey, originFilter, channelFilter]);


  return (
    <PageLayout
      name="Clients"
      description="Everyone on file — click a card to open their record."
      width="full"
      onAdd={() => navigate('/app/ops/accounts/new')}
      addLabel="client"
    >
      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {/* LIST — a grid of triage cards (TASK-ROSTERCARD). The owner reversed the
          earlier positional-row build (TASK-ROSTER, task/roster, unmerged) in
          favour of this: the data volume he wants per person does not fit a row. */}
      <div className="flex flex-wrap gap-2 mb-2">
        <select className="form-input w-auto text-xs" aria-label="Filter by origin"
          value={originFilter} onChange={(e) => setOriginFilter(e.target.value)}>
          <option value="">Origin: all</option>
          {originOpts.map((o) => <option key={o.code} value={o.code}>{o.display_name}</option>)}
        </select>
        <select className="form-input w-auto text-xs" aria-label="Filter by channel"
          value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)}>
          <option value="">Channel: all</option>
          {channelOpts.map((o) => <option key={o.code} value={o.code}>{o.display_name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input className="form-input pl-9 w-full" placeholder="Search name, email, or tag…"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {([['name', 'A–Z'], ['newest', 'Newest']] as [SortKey, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSortKey(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans ${sortKey === k ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          /* ⚠️ TASK-FIX2 §3: the card opens THE record — the same component
             Records › Horses and Records › Leads open, for every one of the 24
             people on this list, whatever stage they are at. `rowKeyOf` is still
             the React key (a bare contact has no user_id), but what gets opened
             is always the contact. */
          <RosterCard key={rowKeyOf(m)} m={m} supplement={supplement}
            onOpen={() => setOpenContactId(m.contact_id)}
            originLabel={m.client_origin ? lookupName(originOpts, m.client_origin) : null}
            channelLabel={m.contact_channel ? lookupName(channelOpts, m.contact_channel) : null} />
        ))}
      </div>
      {visible.length === 0 && <p className="text-sm text-muted py-6 text-center">No one matches.</p>}

      {openContactId && (
        <ContactDossierModal
          contactId={openContactId}
          onClose={() => setOpenContactId(null)}
          onChanged={load} />
      )}
    </PageLayout>
  );
}
