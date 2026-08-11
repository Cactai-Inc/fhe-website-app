import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Handshake, Mail, MapPin, Phone, Trash2, UserPlus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Modal, useAsync, useToast } from '../../../lib/ops';
import {
  createContact, updateContact, deleteContact, staffContactDirectory, type DirectoryContact,
  contactAddress, formatAddress, type ContactAddress,
  setContactType, CONTACT_TYPE_LABEL, type ContactType,
} from '../../../lib/api';
import { ContactDossierModal } from '../../../components/app/ContactDossierModal';
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
/* Each page is now defined by the STORED contacts.contact_type, not by a
 * client-side leftover. The old rule was `if nothing else matched → Lead`, which
 * made the Leads page a catch-all rather than a campaign list. See
 * docs/PERSON_DATA_CONSOLIDATION.md. */
type DirectoryMode = 'directory' | 'leads' | 'contacts';

/** Which stored contact_type each page shows. */
const MODE_TYPE: Record<DirectoryMode, ContactType> = {
  directory: 'DIRECTORY', leads: 'LEAD', contacts: 'CONTACT',
};

const MODE_COPY: Record<DirectoryMode, { title: string; blurb: string; newLabel: string }> = {
  directory: {
    title: 'Directory',
    blurb: 'External people and businesses that provide something — farriers, veterinarians, suppliers, service providers, event organizers.',
    newLabel: 'New directory entry',
  },
  leads: {
    title: 'Leads',
    blurb: 'Potential future clients. People we hold information about so we can reach out or include them in a campaign.',
    newLabel: 'New lead',
  },
  contacts: {
    title: 'Contacts',
    blurb: 'The people we serve — clients, members, horse owners and counterparties who are not part of the company.',
    newLabel: 'New contact',
  },
};

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
  /* DE-DUPLICATED 2026-07-31. Two independent sources fed this: DERIVED
     designations (computed from horses, documents and the clients row) and the
     free-text `tags` column. They overlap — a contact tagged "Horse owner" who
     also owns a horse rendered the chip twice, and Sarah showed
     CLIENT · HORSE OWNER · Rider · Horse owner.
     Derived wins: it is computed from evidence and cannot go stale, whereas a
     tag is whatever someone typed. A tag only renders when nothing derived
     already says the same thing, compared case- and space-insensitively so
     "Horse owner" and "HORSE OWNER" collapse together. */
  const derived = designations(r);
  const norm = (v: string) => v.toLowerCase().replace(/[\s_-]+/g, '');
  const seen = new Set(derived.map(norm));
  const extraTags = (r.tags ?? []).filter((t) => {
    const k = norm(t);
    if (seen.has(k)) return false;
    seen.add(k);          // also collapses duplicates WITHIN tags
    return true;
  });

  return (
    <span className="flex flex-wrap gap-1">
      {derived.map((d) => (
        <span key={d} className={`text-[10px] font-sans uppercase tracking-wide px-2 py-0.5 rounded-full border ${CHIP_TONE[d]}`}>{d}</span>
      ))}
      {extraTags.map((t) => (
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
  const [unfiled, setUnfiled] = useState<DirectoryContact[]>([]);
  /** The full record modal, keyed on contact so it opens for EVERYONE — the 13
   *  of 19 contacts with no account included. */
  const [dossier, setDossier] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortKey, setSortKey] = useState<SortKey>(mode === 'leads' ? 'newest' : 'name');
  const [open, setOpenRaw] = useState<DirectoryContact | null>(null);
  // Staff address visibility: the directory RPC does not carry the address, so
  // the dossier fetches the canonical contacts row on open. undefined = loading,
  // null = none on file.
  const [openAddress, setOpenAddress] = useState<ContactAddress | null | undefined>(undefined);
  const setOpen = (r: DirectoryContact | null) => { setConfirmDelete(false); setOpenRaw(r); };
  useEffect(() => {
    if (!open) { setOpenAddress(undefined); return; }
    let active = true;
    setOpenAddress(undefined);
    contactAddress(open.id)
      .then((a) => { if (active) setOpenAddress(a); })
      .catch(() => { if (active) setOpenAddress(null); });
    return () => { active = false; };
  }, [open]);
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = () => {
    staffContactDirectory()
      // Filter on the STORED type. Previously this inferred membership from
      // derived designations, so anyone the deriver could not classify landed on
      // Leads by default. Unclassified rows (contact_type null) belong to NO
      // page — they are surfaced in the Unfiled banner so a human files them,
      // rather than silently padding a campaign list.
      .then((all) => {
        setRows(all.filter((r) => r.contact_type === MODE_TYPE[mode]));
        setUnfiled(all.filter((r) => !r.contact_type));
      })
      .catch(() => setError('Could not load the directory.'));
  };

  /** File an unclassified contact onto one of the four pages. */
  async function file(id: string, type: ContactType) {
    try {
      await setContactType(id, type);
      toast.success(`Filed under ${CONTACT_TYPE_LABEL[type]}.`);
      load();
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not file that contact.'));
    }
  }
  useEffect(load, [mode]);

  const save = useAsync(async (input: ContactInput, existing: DirectoryContact | null) => {
    return existing ? updateContact(existing.id, input) : createContact(input);
  });

  // Only the people-we-serve page has varied relationships worth filtering
  // (counterparty / horse owner / lessee). Leads and Directory are single-purpose
  // lists, so a filter row there would be chrome with nothing to do.
  const filters = mode === 'contacts' ? BUSINESS_FILTERS : [];

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
        <h1 className="font-serif text-2xl text-green-900">{MODE_COPY[mode].title}</h1>
        <button type="button" className="btn-primary" onClick={() => { setFormError(null); setCreating(true); }}>
          {MODE_COPY[mode].newLabel}
        </button>
      </div>
      <p className="text-sm text-green-800/70 mb-5">{MODE_COPY[mode].blurb}</p>

      {/* Unfiled: a contact with no contact_type belongs to no page, so without
          this it would be invisible everywhere. Shown on every person-page so it
          cannot be missed, with one-click filing. */}
      {unfiled.length > 0 && (
        <div className="mb-5 rounded-xl border border-gold-600/40 bg-gold-50 p-4">
          {/* Title only — the explainer was removed 2026-07-31 (owner): the card
              says what it is, and the row's own action says what to do. */}
          <p className="text-sm font-semibold text-gold-900 mb-2.5">
            {unfiled.length} Unfiled {unfiled.length === 1 ? 'Person' : 'People'}
          </p>
          <div className="flex flex-col gap-1.5">
            {unfiled.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm bg-white/70 rounded-lg px-3 py-2">
                <span className="text-green-900 font-medium">
                  {[r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Unnamed'}
                </span>
                {r.email && <span className="text-[11.5px] text-muted">{r.email}</span>}
                {/* One action, not four filing shortcuts. Filing is a decision
                    that needs the whole record in view — a minor attached to a
                    guardian, for instance, fits none of the four buttons that
                    used to sit here. */}
                <span className="ml-auto flex gap-1.5">
                  <button type="button" onClick={() => setDossier(r.id)}
                    className="text-[11px] px-3 py-1 rounded-full border border-green-800/25 text-green-800 hover:bg-green-800/10 focus-ring">
                    View
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {dossier && (
        <ContactDossierModal
          contactId={dossier}
          onClose={() => setDossier(null)}
          onChanged={load}
        />
      )}

      {/* quick view — the summary behind a card. "Full record" opens the dossier
          above, which is the editable, everything-in-one-place surface. */}
      <Modal open={open !== null && !editing} onClose={() => setOpen(null)}
        title={open ? (contactName(open) || open.email || 'Contact') : 'Contact'}>
        {open && (
          <div>
            <div className="mb-3"><Chips r={open} /></div>

            {/* FILING lives here, with the record in view, rather than as four
                shortcut buttons on the unfiled card. Deciding where someone
                belongs needs their details — a minor attached to a guardian fits
                none of the four buckets at a glance. */}
            <div className="mb-4 rounded-lg border border-green-800/12 bg-cream-100/40 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">
                {open.contact_type ? 'Filed under' : 'Not filed yet'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(['LEAD', 'CONTACT', 'DIRECTORY', 'TEAM'] as ContactType[]).map((t) => (
                  <button key={t} type="button" onClick={() => void file(open.id, t)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border focus-ring ${
                      open.contact_type === t
                        ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                        : 'border-green-800/25 text-green-800 hover:bg-green-800/10'}`}>
                    {CONTACT_TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            {/* The way through to the editable record. The summary below stays
                for a fast look; anything you need to CHANGE lives in there. */}
            <button type="button" className="btn-primary text-sm w-full justify-center mb-4"
              onClick={() => { const id = open.id; setOpen(null); setDossier(id); }}>
              Open full record
            </button>
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
            {/* Mailing address (staff visibility, 2026-07-29). Read from the
                canonical `contacts` columns — the same ones the onboarding
                intake writes and the contract party tokens compose from. Given
                its own full-width row because an address does not survive
                truncation in a half-width cell. Degrades cleanly: no empty
                label, never the string "null". */}
            <div className="flex items-start justify-between gap-3 border-b border-green-800/[0.06] py-1 text-sm mb-4">
              <span className="text-muted inline-flex items-center gap-1.5 shrink-0">
                <MapPin size={13} aria-hidden="true" /> Address
              </span>
              <span className={`text-right ${formatAddress(openAddress) ? 'text-green-900' : 'text-muted'}`}>
                {openAddress === undefined
                  ? 'Loading…'
                  : (formatAddress(openAddress) ?? 'Not on file')}
              </span>
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

/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33).
 *  Owner ruling 2026-08-10 (TASK-ROSTER, reaffirmed TASK-ROSTERCARD): the
 *  Clients page (/app/admin) won — it now shows every contact, so this page's
 *  population moved there. While true: the /app/ops/contacts route redirects
 *  to /app/admin and the nav item is hidden. DirectoryPage and LeadsPage below
 *  are NOT retired. */
export const CONTACTS_PAGE_RETIRED = true;

/** The rolodex: external providers — farriers, vets, suppliers, event organizers. */
export function DirectoryPage() {
  return <ContactDirectory mode="directory" />;
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
