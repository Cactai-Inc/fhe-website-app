import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Handshake, Mail, Phone, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Modal, useAsync, useToast } from '../../../lib/ops';
import {
  createContact, updateContact, deleteContact, staffContactDirectory, type DirectoryContact,
} from '../../../lib/api';
import { contactName } from '../../../lib/ops/types';
import type { Contact, ContactInput } from '../../../lib/ops/types';
import { ContactForm } from '../../../components/ops/contacts/ContactForm';

/**
 * The bulk "contacts" catchall is gone — split into two FOCUSED directories
 * (mirroring the community's members/resources directory pattern). Clients
 * and Team have their own pages; these cover everyone else:
 *
 *   DIRECTORY (/app/ops/contacts) — everyone we DO BUSINESS with who isn't
 *   a client: contract counterparties (lessors, sellers), horse owners,
 *   lessees. Designations are derived from the real wiring, never assigned.
 *
 *   MARKETING LEADS (/app/ops/leads) — people who came in (forms, intake,
 *   manual entry) and have NO business relationship yet. The work-them-toward-
 *   matriculation list; inviting one to an account is the primary action.
 *
 * Both: filter buttons desktop / dropdown mobile, search, sort, visible tag
 * chips, and a dossier behind every card (depth counts, notes, actions).
 */
type DirectoryMode = 'business' | 'leads';

type Designation = 'Client' | 'Team' | 'Counterparty' | 'Horse owner' | 'Lessee' | 'Lead';
const BUSINESS_FILTERS = ['All', 'Counterparties', 'Horse owners', 'Lessees'];

// filter label → designation match
const FILTER_MAP: Record<string, Designation | null> = {
  All: null, Counterparties: 'Counterparty', 'Horse owners': 'Horse owner', Lessees: 'Lessee',
};

const NON_PARTY_ROLES = ['CLIENT', 'COMPANY', 'FHE'];

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

const CHIP_TONE: Record<Designation, string> = {
  Client: 'bg-green-50 text-green-800 border-green-200',
  Team: 'bg-green-800 text-white border-green-800',
  Counterparty: 'bg-gold-50 text-gold-800 border-gold-200',
  'Horse owner': 'bg-cream-100 text-secondary border-green-800/15',
  Lessee: 'bg-cream-100 text-secondary border-green-800/15',
  Lead: 'bg-white text-muted border-green-800/20 border-dashed',
};

function Chips({ r }: { r: DirectoryContact }) {
  return (
    <span className="flex flex-wrap gap-1">
      {designations(r).map((d) => (
        <span key={d} className={`text-[10px] font-sans uppercase tracking-wide px-2 py-0.5 rounded-full border ${CHIP_TONE[d]}`}>{d}</span>
      ))}
      {(r.tags ?? []).map((t) => (
        <span key={t} className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-cream-100 text-secondary border border-green-800/10">{t}</span>
      ))}
    </span>
  );
}

function depthLine(r: DirectoryContact): string {
  const bits: string[] = [];
  if (r.engagement_count > 0) bits.push(`${r.engagement_count} engagement${r.engagement_count === 1 ? '' : 's'}`);
  if (r.document_count > 0) bits.push(`${r.document_count} document${r.document_count === 1 ? '' : 's'}`);
  const horses = r.horses_owned + r.horses_leased;
  if (horses > 0) bits.push(`${horses} horse${horses === 1 ? '' : 's'}`);
  return bits.join(' · ');
}

function initials(r: DirectoryContact): string {
  return (((r.first_name?.[0] ?? '') + (r.last_name?.[0] ?? '')).toUpperCase()) || '·';
}

type SortKey = 'name' | 'newest';

function ContactDirectory({ mode }: { mode: DirectoryMode }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rows, setRows] = useState<DirectoryContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>(mode === 'leads' ? 'newest' : 'name');
  const [open, setOpenRaw] = useState<DirectoryContact | null>(null);
  const setOpen = (r: DirectoryContact | null) => { setConfirmDelete(false); setOpenRaw(r); };
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    staffContactDirectory()
      .then((all) => setRows(all.filter((r) => {
        const d = designations(r);
        // clients + team live on their own pages — never here
        if (d.includes('Client') || d.includes('Team')) return false;
        return mode === 'leads' ? d.includes('Lead') : !d.includes('Lead');
      })))
      .catch(() => setError('Could not load the directory.'));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [mode]);

  const save = useAsync(async (input: ContactInput, existing: DirectoryContact | null) => {
    return existing ? updateContact(existing.id, input) : createContact(input);
  });

  // leads have one designation by definition — no filter row there
  const filters = mode === 'business' ? BUSINESS_FILTERS : [];

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const want = FILTER_MAP[filter];
    const filtered = (rows ?? []).filter((r) => {
      if (want && !designations(r).includes(want)) return false;
      if (!q) return true;
      return contactName(r).toLowerCase().includes(q)
        || (r.email ?? '').toLowerCase().includes(q)
        || (r.phone ?? '').toLowerCase().includes(q)
        || (r.tags ?? []).some((t) => t.toLowerCase().includes(q));
    });
    return [...filtered].sort((a, b) => sortKey === 'newest'
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : contactName(a).localeCompare(contactName(b)));
  }, [rows, query, filter, sortKey]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of filters) m.set(f, 0);
    for (const r of rows ?? []) {
      m.set('All', (m.get('All') ?? 0) + 1);
      for (const d of designations(r)) {
        for (const [label, match] of Object.entries(FILTER_MAP)) {
          if (match === d) m.set(label, (m.get(label) ?? 0) + 1);
        }
      }
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  async function handleSubmit(input: ContactInput) {
    setFormError(null);
    try {
      await save.run(input, editing);
      toast.success(editing ? 'Contact updated.' : 'Contact created.');
      setEditing(null); setCreating(false); setOpen(null);
      load();
    } catch (err) {
      setFormError(toErrorMessage(err, 'Could not save contact.'));
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-green-900">{mode === 'business' ? 'Directory' : 'Marketing leads'}</h1>
        <button type="button" className="btn-primary" onClick={() => { setFormError(null); setCreating(true); }}>
          {mode === 'business' ? 'New contact' : 'New lead'}
        </button>
      </div>
      <p className="text-sm text-green-800/70 mb-5">
        {mode === 'business'
          ? 'Everyone we do business with who isn\u2019t a client — counterparties, horse owners, lessees.'
          : 'People who\u2019ve come in but haven\u2019t matriculated — work them toward an account.'}
      </p>

      {/* filter — buttons on desktop, dropdown on mobile; sort row below */}
      <div className="hidden sm:flex flex-wrap gap-1.5 mb-2">
        {filters.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
              filter === f ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {f}{counts.get(f) ? ` (${counts.get(f)})` : ''}
          </button>
        ))}
      </div>
      {filters.length > 0 && (
        <select className="form-input sm:hidden mb-2" value={filter} aria-label="Filter"
          onChange={(e) => setFilter(e.target.value)}>
          {filters.map((f) => <option key={f} value={f}>{f}{counts.get(f) ? ` (${counts.get(f)})` : ''}</option>)}
        </select>
      )}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <input
          type="search"
          className="form-input flex-1 min-w-[200px]"
          placeholder="Search name, email, phone, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search contacts"
        />
        <div className="flex gap-1.5">
          {([['name', 'A–Z'], ['newest', 'Newest']] as [SortKey, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setSortKey(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-sans focus-ring ${
                sortKey === k ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {toast.toasts.map((t) => (
        <div key={t.id} role="status"
          className={`mb-4 rounded px-4 py-2 text-sm ${t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'}`}>
          {t.message}
        </div>
      ))}
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
            </div>
            <Chips r={r} />
            {depthLine(r) && <p className="text-[11px] text-muted mt-2">{depthLine(r)}</p>}
          </button>
        ))}
      </div>
      {rows !== null && visible.length === 0 && (
        <p className="text-sm text-muted py-8 text-center">No contacts match.</p>
      )}

      {/* dossier — the depth behind the card */}
      <Modal open={open !== null && !editing} onClose={() => setOpen(null)}
        title={open ? (contactName(open) || open.email || 'Contact') : 'Contact'}>
        {open && (
          <div>
            <div className="mb-3"><Chips r={open} /></div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm mb-4">
              {([
                ['Email', open.email ?? '—'],
                ['Phone', open.phone ?? '—'],
                ['Code', open.display_code ?? '—'],
                ['Added', new Date(open.created_at).toLocaleDateString()],
                ['Account', open.linked_user_id
                  ? (open.linked_role === 'USER' ? 'Client login' : `Staff login (${open.linked_role})`)
                  : 'No login'],
                ['As party', (open.party_roles ?? []).filter((x) => !NON_PARTY_ROLES.includes(x)).join(', ') || '—'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-b border-green-800/[0.06] py-1">
                  <span className="text-muted">{k}</span><span className="text-green-900 text-right truncate">{v}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {([
                ['Engagements', open.engagement_count, Handshake],
                ['Documents', open.document_count, FileText],
                ['Horses', open.horses_owned + open.horses_leased, UserPlus],
              ] as [string, number, typeof Mail][]).map(([k, v]) => (
                <div key={k as string} className="text-center border border-green-800/10 rounded-lg py-2.5">
                  <p className="font-serif text-xl text-green-800">{v as number}</p>
                  <p className="text-[10px] tracking-wide uppercase text-muted font-semibold">{k as string}</p>
                </div>
              ))}
            </div>
            {open.notes && <p className="text-sm text-secondary whitespace-pre-line bg-cream-100/60 rounded-lg p-3 mb-4">{open.notes}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary text-xs" onClick={() => { setFormError(null); setEditing(open); }}>
                Edit contact
              </button>
              {open.email && (
                <a href={`mailto:${open.email}`} className="px-3.5 py-2 rounded-lg border border-green-800/20 text-green-800 text-xs inline-flex items-center gap-1.5 hover:bg-green-50 focus-ring">
                  <Mail size={13} /> Email
                </a>
              )}
              {open.phone && (
                <a href={`tel:${open.phone}`} className="px-3.5 py-2 rounded-lg border border-green-800/20 text-green-800 text-xs inline-flex items-center gap-1.5 hover:bg-green-50 focus-ring">
                  <Phone size={13} /> Call
                </a>
              )}
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
                  className={`px-3.5 py-2 rounded-lg text-xs inline-flex items-center gap-1.5 focus-ring ml-auto ${
                    confirmDelete
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'border border-red-300 text-red-700 hover:bg-red-50'
                  }`}>
                  <Trash2 size={13} /> {confirmDelete ? 'Really delete?' : 'Delete lead'}
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* create / edit — the existing full-field form */}
      <Modal
        open={creating || editing !== null}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? 'Edit contact' : 'New contact'}
        disableBackdropClose={save.isPending}
      >
        {(creating || editing) && (
          <ContactForm
            contact={editing ? (editing as unknown as Contact) : undefined}
            onSubmit={handleSubmit}
            onCancel={() => { setCreating(false); setEditing(null); }}
            submitting={save.isPending}
            error={formError}
          />
        )}
      </Modal>
    </div>
  );
}

export function ContactsPage() {
  return <ContactDirectory mode="business" />;
}
export function LeadsPage() {
  return <ContactDirectory mode="leads" />;
}
export default ContactsPage;
