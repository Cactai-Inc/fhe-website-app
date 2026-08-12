import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, Plus, Search, UserRound,
} from 'lucide-react';
import { PageLayout } from '../../components/app/PageLayout';
import { useDocumentTitle } from '../../lib/hooks';
import { supabase } from '../../lib/supabase';
import {
  adminSetSuspended, adminClientAccounts, adminClientItems, adminSendInvitation,
  adminExpireInvitation, adminDeleteInvitation, adminAccountAction, adminHardDeleteClient,
  adminResendInvitation,
  type ClientAccountRow, type ClientItems,
} from '../../lib/admin';
import { contactAddress, formatAddress, type ContactAddress } from '../../lib/api';
import { docDisplay, docDisplayLabel } from '../../lib/documentStatus';
import { ProvisionClientForm } from '../../components/app/ProvisionClientForm';
import { InviteResultPanel } from '../../components/app/InviteResultPanel';
import { InvitationHistoryPanel } from '../../components/app/InvitationHistoryPanel';
/* These four moved to a shared module so the contact dossier can render them
   too. Imported here rather than duplicated — one definition, two callers. */
import {
  AssignDocumentsModal, ClientHorseRecordsCard, AttachOfferingPanel, PaperworkEditor,
} from '../../components/app/ClientRecordActions';
import {
  RosterCard, rowKeyOf, memberName, EMPTY_SUPPLEMENT, type RosterSupplement,
} from '../../components/app/RosterCard';
import { StatusLog } from '../../lib/ops';
import { entityStatusLog, type StatusLogEntry } from '../../lib/ops/api-status';

/**
 * CLIENTS (/app/admin) — THE one people page (TASK-ROSTER / TASK-ROSTERCARD,
 * owner ruling 2026-08-10: this page won over /app/ops/contacts, which is
 * retired behind CONTACTS_PAGE_RETIRED). Shows every contact we serve —
 * login-backed accounts, provisioned clients, and bare contacts with neither.
 * Deliberate exclusions: LEAD (Leads page, until worked), TEAM (Team &
 * access), DIRECTORY (rolodex).
 *
 * THIS IS A TRIAGE VIEW, NOT A DIRECTORY (owner). The grid of cards exists to
 * make two groups jump out: who is stuck, and who is engaging most. The ring
 * around each avatar carries the relationship (lead-weight grey / guest green
 * / client-or-customer gold); badges show what's DERIVED (never free-text
 * tags); flags surface only what can be acted on today. See RosterCard.tsx
 * and docs/reports/TASK-ROSTERCARD-REPORT.md.
 *
 *  LIST — every person, searchable + sortable, rendered as cards. Clicking a
 *  card isolates it.
 *  ISOLATED — the other cards disappear; the profile renders below the
 *  selected card; account-scoped TABS appear (Overview / Billing / Bookings /
 *  Documents / Orders / Payments / Activity / Posts / Messages / Login). More
 *  tabs than fit → wraps onto a second line. Each tab carries a create action
 *  where one makes sense. A clear exit control returns to the list.
 */

// ── account-scoped data shapes ────────────────────────────────────────────────
interface Overview {
  profile: {
    user_id: string; email: string; first_name: string | null; last_name: string | null;
    display_name: string | null; phone: string | null; mobile: string | null;
    whatsapp: string | null; riding_level: string | null; bio: string | null;
    role: string; is_suspended: boolean; created_at: string;
    contact_id: string | null; client_id: string | null;
  } | null;
  login: {
    providers: string[]; last_sign_in_at: string | null;
    created_at: string; email_confirmed_at: string | null;
  } | null;
  member: { status: string | null; started_at: string | null } | null;
  counts: { orders: number; posts: number; documents: number; bookings: number };
}

type TabId =
  | 'overview' | 'bookings' | 'documents' | 'orders' | 'payments'
  | 'activity' | 'posts' | 'messages' | 'login';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'documents', label: 'Documents' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'activity', label: 'Activity' },
  { id: 'posts', label: 'Posts' },
  { id: 'messages', label: 'Messages' },
  { id: 'login', label: 'Login' },
];

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtTs = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

// ── generic row list used by several tabs ────────────────────────────────────
type ListRow = { key: string; main: string; sub: string; badge?: string; href?: string };
function RowList({ rows, empty }: { rows: ListRow[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const inner = (
          <>
            <span className="min-w-0">
              <span className="block text-sm text-green-900 truncate">{r.main}</span>
              <span className="block text-xs text-muted">{r.sub}</span>
            </span>
            {r.badge && <span className="text-[10.5px] font-sans uppercase px-2 py-0.5 rounded-full bg-cream-100 text-secondary shrink-0">{r.badge}</span>}
          </>
        );
        const base = 'flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5';
        return r.href ? (
          <Link key={r.key} to={r.href} className={`${base} hover:border-green-800/30 hover:bg-green-50/40 focus-ring transition-colors`}>
            {inner}
            <ChevronRight size={15} className="text-green-800/40 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <div key={r.key} className={base}>{inner}</div>
        );
      })}
    </div>
  );
}

function TabCreate({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring mb-3">
      <Plus size={13} /> {label}
    </button>
  );
}




// ── per-tab bodies ────────────────────────────────────────────────────────────
function OverviewTab({ ov }: { ov: Overview }) {
  const p = ov.profile;
  // Mailing address (staff visibility, 2026-07-29). admin_client_overview builds
  // its profile block from `profiles`, whose look-alike address columns the
  // onboarding intake does NOT write — so the address is fetched here from the
  // canonical `contacts` row via the profile's contact_id. undefined = loading.
  const contactId = p?.contact_id ?? null;
  const [addr, setAddr] = useState<ContactAddress | null | undefined>(undefined);
  useEffect(() => {
    if (!contactId) { setAddr(null); return; }
    let active = true;
    setAddr(undefined);
    contactAddress(contactId)
      .then((a) => { if (active) setAddr(a); })
      .catch(() => { if (active) setAddr(null); });
    return () => { active = false; };
  }, [contactId]);
  if (!p) return null;
  const pairs: [string, string][] = [
    ['Email', p.email], ['Phone', p.phone ?? '—'], ['Mobile', p.mobile ?? '—'],
    ['WhatsApp', p.whatsapp ?? '—'], ['Riding level', p.riding_level ?? '—'],
    ['Joined', fmt(p.created_at)],
    ['Member', ov.member ? (ov.member.status ?? '—') : 'None'],
  ];
  return (
    <div>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-4">
        {pairs.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm border-b border-green-800/[0.06] py-1.5">
            <span className="text-muted">{k}</span><span className="text-green-900 text-right truncate">{v}</span>
          </div>
        ))}
      </div>
      {/* Full-width so the address stays readable (a half-width cell truncates
          it). Degrades cleanly: no empty label, never the string "null". */}
      <div className="flex items-start justify-between gap-3 text-sm border-b border-green-800/[0.06] py-1.5 mb-4">
        <span className="text-muted shrink-0">Address</span>
        <span className={`text-right ${formatAddress(addr) ? 'text-green-900' : 'text-muted'}`}>
          {addr === undefined ? 'Loading…' : (formatAddress(addr) ?? 'Not on file')}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(ov.counts).map(([k, v]) => (
          <div key={k} className="text-center border border-green-800/10 rounded-lg py-2.5 bg-white">
            <p className="font-serif text-xl text-green-800">{v}</p>
            <p className="text-[10px] tracking-wide uppercase text-muted font-semibold">{k}</p>
          </div>
        ))}
      </div>
      {p.bio && <p className="body-text text-sm text-secondary mt-4 whitespace-pre-line">{p.bio}</p>}
    </div>
  );
}

function RpcListTab({
  userId, rpc, map, empty, create,
}: {
  userId: string;
  rpc: string;
  map: (r: Record<string, unknown>) => ListRow;
  empty: string;
  create?: { label: string; onClick: () => void };
}) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  useEffect(() => {
    supabase.rpc(rpc, { p_user_id: userId })
      .then(({ data, error }) => setRows(error ? [] : ((data as Record<string, unknown>[]) ?? [])));
  }, [rpc, userId]);
  return (
    <div>
      {create && <TabCreate label={create.label} onClick={create.onClick} />}
      {rows === null ? <p className="text-sm text-muted">Loading…</p>
        : <RowList empty={empty} rows={rows.map(map)} />}
    </div>
  );
}

// ── documents tab: onboarding-class documents collapse into one packet ───────
// DOCPACKET (owner, 2026-08-10): the onboarding set is a packet, not N
// individual rows — but only for display. Grouping key is `wall_gating`
// (contract_templates.wall_gating, the same flag my_wall_state() reads), not
// a stored relationship, so swapping documents in/out of onboarding changes
// the packet's contents automatically. A lease (or any other contract) has
// wall_gating=false and stays listed on its own, exactly as before. Expanding
// the packet reveals the same rows this page has always rendered — nothing
// about generation, assignment or signing changes, and no row is hidden,
// merged, or deleted; DocumentsTab reuses RowList/ListRow for both the
// packet's contents and the non-packet rows, so there is no separate
// rendering path to retire.
const DOCUMENT_PACKET_NAME = 'Onboarding Packet'; // owner to confirm wording — see report.

interface AdminDocRow {
  id: string;
  title: string | null;
  status: string;
  workflow_state: string | null;
  created_at: string | null;
  wall_gating: boolean;
}

function adminDocRowToListRow(r: AdminDocRow): ListRow {
  const notStarted = r.status === 'NOT_STARTED';
  const assigned = r.status === 'ASSIGNED';
  return {
    key: r.id,
    main: r.title ?? 'Document',
    sub: notStarted ? 'Assigned — not started'
      : assigned ? 'Assigned — awaiting signature'
      : fmtTs(r.created_at),
    badge: notStarted ? 'Not started'
      : assigned ? 'Awaiting signature'
      : docDisplayLabel(r.status, r.workflow_state),
    href: (notStarted || assigned) ? undefined : `/app/ops/documents/${r.id}`,
  };
}

function DocumentsTab({
  userId, refreshKey, onAssign,
}: {
  userId: string;
  refreshKey: number;
  onAssign: () => void;
}) {
  const [rows, setRows] = useState<AdminDocRow[] | null>(null);
  const [packetOpen, setPacketOpen] = useState(false);
  useEffect(() => {
    setRows(null);
    supabase.rpc('admin_client_documents', { p_user_id: userId })
      .then(({ data, error }) => setRows(error ? [] : ((data as AdminDocRow[]) ?? [])));
  }, [userId, refreshKey]);

  const packetRows = (rows ?? []).filter((r) => r.wall_gating);
  const otherRows = (rows ?? []).filter((r) => !r.wall_gating);
  const signedCount = packetRows.filter((r) => docDisplay(r.status, r.workflow_state).tone === 'done').length;

  return (
    <div>
      <TabCreate label="Assign documents" onClick={onAssign} />
      {rows === null && <p className="text-sm text-muted">Loading…</p>}
      {rows !== null && rows.length === 0 && <p className="text-sm text-muted">No documents.</p>}
      {packetRows.length > 0 && (
        <div className="mb-1.5">
          <button type="button" onClick={() => setPacketOpen((o) => !o)} aria-expanded={packetOpen}
            className="w-full flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5 hover:border-green-800/30 hover:bg-green-50/40 focus-ring transition-colors">
            <span className="min-w-0">
              <span className="block text-sm text-green-900 truncate">{DOCUMENT_PACKET_NAME}</span>
              <span className="block text-xs text-muted">{signedCount} of {packetRows.length} signed</span>
            </span>
            <ChevronRight size={15} className={`text-green-800/40 shrink-0 transition-transform ${packetOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
          </button>
          {packetOpen && (
            <div className="pl-3 mt-1.5 ml-2 border-l-2 border-green-800/10">
              <RowList empty="" rows={packetRows.map(adminDocRowToListRow)} />
            </div>
          )}
        </div>
      )}
      {otherRows.length > 0 && <RowList empty="" rows={otherRows.map(adminDocRowToListRow)} />}
    </div>
  );
}

function QueryListTab({
  fetcher, empty, create,
}: {
  fetcher: () => Promise<{ key: string; main: string; sub: string; badge?: string }[]>;
  empty: string;
  create?: { label: string; onClick: () => void };
}) {
  const [rows, setRows] = useState<{ key: string; main: string; sub: string; badge?: string }[] | null>(null);
  useEffect(() => { fetcher().then(setRows).catch(() => setRows([])); }, [fetcher]);
  return (
    <div>
      {create && <TabCreate label={create.label} onClick={create.onClick} />}
      {rows === null ? <p className="text-sm text-muted">Loading…</p> : <RowList empty={empty} rows={rows} />}
    </div>
  );
}

function LoginTab({ ov }: { ov: Overview }) {
  const l = ov.login;
  if (!l) return <p className="text-sm text-muted">No login record.</p>;
  const pairs: [string, string][] = [
    ['Sign-in method', l.providers.length ? l.providers.join(', ') : 'password'],
    ['Last active', fmtTs(l.last_sign_in_at)],
    ['Account created', fmt(l.created_at)],
    ['Email verified', l.email_confirmed_at ? fmt(l.email_confirmed_at) : 'Not yet'],
  ];
  return (
    <div className="max-w-md">
      {pairs.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 text-sm border-b border-green-800/[0.06] py-2">
          <span className="text-muted">{k}</span><span className="text-green-900">{v}</span>
        </div>
      ))}
    </div>
  );
}

// ── provisioned-client view (no login yet): items + billing + the invite ─────
// Two states: NOT-yet-provisioned (no invitation) → the shared ProvisionClientForm
// (assign category/offerings/paperwork + send, on THIS existing contact); already
// invited → resend / expire / delete controls.
function InvitePanel({ row, onSent }: { row: ClientAccountRow; onSent: () => void }) {
  const [result, setResult] = useState<{ url: string; emailed: boolean; emailError?: string } | null>(null);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<StatusLogEntry[]>([]);

  const sent = row.invite_status === 'sent';
  const expired = sent && row.invite_expires_at ? new Date(row.invite_expires_at) < new Date() : false;
  /** A link that works right now — the one regenerating would destroy. */
  const live = sent && !expired;
  // Never invited → provision this existing contact via the shared form.
  const neverInvited = !row.invite_id && !row.invite_status;

  // Pull the invitation's lifecycle timeline (sent → resent → redeemed /
  // redeemed-unsuccessful+reason / superseded). Surfaced below the controls so
  // the live link reads above the grayed-out prior attempts.
  useEffect(() => {
    if (!row.invite_id) { setLog([]); return; }
    entityStatusLog('account', row.invite_id).then(setLog).catch(() => setLog([]));
  }, [row.invite_id]);

  if (neverInvited && row.contact_id) {
    return (
      <section className="bg-white border border-gold-600/40 rounded-xl p-4 mt-4">
        <h3 className="font-serif text-green-800 text-base mb-1">Provision & invite</h3>
        <p className="text-[12px] text-muted mb-4">
          Assign their category, paperwork, and any offerings, then send the activation invite.
        </p>
        <ProvisionClientForm source="contact" contactId={row.contact_id} email={row.email ?? undefined}
          onProvisioned={onSent} />
      </section>
    );
  }

  return (
    <section className="bg-white border border-gold-600/40 rounded-xl p-4 mt-4">
      <h3 className="font-serif text-green-800 text-base">Invitation</h3>
      <p className="text-[12px] text-muted mb-3">
        {sent
          ? `Their link ${expired ? 'EXPIRED' : 'works until'} ${row.invite_expires_at ? new Date(row.invite_expires_at).toLocaleString() : ''}.`
          : 'Send the registration invite.'}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {/* RESEND and REGENERATE are different acts and staff choose between
            them — sending again must never be what kills a working link
            (owner ruling 2026-08-11). Resend is the safe default and leads. */}
        {live && row.invite_id && (
          <button type="button" disabled={busy}
            onClick={() => void (async () => {
              setBusy(true); setErr(null); setResult(null);
              try {
                const r = await adminResendInvitation(row.invite_id!);
                setResendNote(r.emailed
                  ? `Same link emailed again to ${r.email}. It keeps working.`
                  : `NOT emailed — ${r.emailError || 'no reason reported'}. Copy the link below and send it yourself.`);
                setRefreshKey((k) => k + 1);
              } catch (e) { setErr(e instanceof Error ? e.message : 'Could not resend the invitation.'); }
              finally { setBusy(false); }
            })()}
            className="btn-primary text-xs">
            {busy ? 'Sending…' : 'Resend the same link'}
          </button>
        )}
        <button type="button" disabled={busy || !row.email}
          onClick={() => void (async () => {
            // Regenerating retires a link that may be working right now, and
            // may already be in someone's inbox. Make staff say so twice.
            if (live && !confirmRegen) { setConfirmRegen(true); return; }
            setBusy(true); setErr(null); setResult(null); setConfirmRegen(false);
            try {
              // Explicit: this button exists to REPLACE the current link.
              const r = await adminSendInvitation({
                email: row.email!, mode: live ? 'regenerate' : 'new',
              });
              setResult({ url: r.registerUrl, emailed: r.emailed, emailError: r.emailError });
              setRefreshKey((k) => k + 1);
              onSent();
            } catch (e) { setErr(e instanceof Error ? e.message : 'Could not send the invitation.'); }
            finally { setBusy(false); }
          })()}
          className={live ? 'px-3.5 py-2 rounded-lg border border-gold-600/50 text-gold-800 text-xs hover:bg-gold-50 focus-ring'
            : 'btn-primary text-xs'}>
          {busy ? 'Sending…'
            : !sent ? 'Send invitation'
            : confirmRegen ? 'Confirm — retire the current link'
            : live ? 'Regenerate link' : 'Issue a new link'}
        </button>
        {confirmRegen && (
          <button type="button" onClick={() => setConfirmRegen(false)}
            className="px-3 py-2 text-xs text-secondary hover:text-green-900 focus-ring">
            Cancel
          </button>
        )}
        {row.invite_id && sent && !expired && (
          <button type="button" disabled={busy}
            onClick={() => void (async () => {
              setBusy(true); setErr(null);
              try { await adminExpireInvitation(row.invite_id!); onSent(); }
              catch { setErr('Could not expire the invitation.'); }
              finally { setBusy(false); }
            })()}
            className="px-3.5 py-2 rounded-lg border border-gold-600/50 text-gold-800 text-xs hover:bg-gold-50 focus-ring">
            Expire now
          </button>
        )}
        {row.invite_id && (
          <button type="button" disabled={busy}
            onClick={() => void (async () => {
              setBusy(true); setErr(null);
              try { await adminDeleteInvitation(row.invite_id!); onSent(); }
              catch { setErr('Could not delete the invitation.'); }
              finally { setBusy(false); }
            })()}
            className="px-3.5 py-2 rounded-lg border border-red-300 text-red-700 text-xs hover:bg-red-50 focus-ring">
            Delete invite
          </button>
        )}
      </div>
      {err && <p role="alert" className="form-error mt-3">{err}</p>}
      {resendNote && <p role="status" className="text-[12px] text-green-800 mt-3">{resendNote}</p>}
      {result && (
        <InviteResultPanel url={result.url} emailed={result.emailed}
          emailError={result.emailError} email={row.email ?? undefined} />
      )}
      {/* Every link ever issued to this person, with the real URL on each row —
          the support view for "a client just read me a link over the phone".
          Staff-gated: invitations RLS is is_admin() AND the org boundary. */}
      <div className="mt-4 pt-3 border-t border-gold-600/20">
        <InvitationHistoryPanel contactId={row.contact_id} email={row.email}
          refreshKey={refreshKey} onResent={onSent} />
      </div>
      {log.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gold-600/20">
          <p className="text-[11px] uppercase tracking-wide text-green-800/50 mb-2">Invitation timeline</p>
          <StatusLog entries={log} compact />
        </div>
      )}
    </section>
  );
}


function PendingClientView({ row, onChanged }: { row: ClientAccountRow; onChanged: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClientItems | null>(null);
  useEffect(() => {
    if (!row.client_id) { setItems({ documents: [] }); return; }
    adminClientItems(row.client_id).then(setItems).catch(() => setItems({ documents: [] }));
  }, [row.client_id]);

  return (
    <div>
      {(row.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {(row.tags ?? []).map((t) => (
            <span key={t} className="text-[10.5px] font-sans uppercase tracking-wide px-2.5 py-1 rounded-full bg-green-50 text-green-800 border border-green-200">{t}</span>
          ))}
        </div>
      )}

      <section className="bg-white border border-green-800/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-serif text-green-800 text-base">Associated items</h3>
          <span className="flex gap-2">
            <button type="button" className="text-xs underline text-secondary hover:text-green-800"
              onClick={() => navigate('/app/ops/contracts/new')}>+ contract</button>
          </span>
        </div>
        <p className="text-[12px] text-muted mb-3">
          What's attached to this account so far — attach everything before inviting.
        </p>
        {items === null && <p className="text-sm text-muted">Loading…</p>}
        {items && items.documents.length === 0 && (
          <p className="text-sm text-muted">Nothing attached yet.</p>
        )}
        {items && items.documents.map((d) => (
          <button key={d.id} type="button" onClick={() => navigate(`/app/ops/documents/${d.id}`)}
            className="w-full flex items-center justify-between gap-3 border-b border-green-800/[0.06] py-2 text-left hover:bg-cream-100/50">
            <span className="text-sm text-green-900">{d.title ?? 'Document'}</span>
            <span className="text-xs text-muted">{docDisplayLabel(d.status, d.workflow_state)}</span>
          </button>
        ))}
      </section>

      {row.contact_id && <PaperworkEditor contactId={row.contact_id} />}

      <InvitePanel row={row} onSent={onChanged} />
    </div>
  );
}

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [assignOpen, setAssignOpen] = useState(false);
  const [tabRefresh, setTabRefresh] = useState(0);
  const [ordersKey, setOrdersKey] = useState(0); // bump to refetch the Orders list after an attach
  const [dangerOpen, setDangerOpen] = useState(false);
  const [hardConfirm, setHardConfirm] = useState('');

  const load = useCallback(() => {
    // login-backed accounts + provisioned clients + bare contacts, one list
    adminClientAccounts()
      .then(setMembers)
      .catch(() => setError('Could not load clients.'));
  }, []);
  useEffect(load, [load]);

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
      supabase.from('document_parties').select('contact_id, documents(status, deleted_at)')
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
      const outstandingDocs = new Set<string>();
      const OUTSTANDING = new Set(['DRAFT', 'AWAITING_SIGNATURE']);
      type PartyRow = { contact_id: string; documents: { status: string; deleted_at: string | null } | { status: string; deleted_at: string | null }[] | null };
      for (const r of (partiesRes.data ?? []) as PartyRow[]) {
        dealParty.add(r.contact_id);
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
        groups, guardianOf, dependentsOf, contactNames, dealParty, outstandingDocs,
        unpaidContacts, horsesOwned, horsesLeased, lastActive,
      });
    });
    return () => { active = false; };
  }, [members]);

  // /app/admin?open=<contact or user id> — auto-open (e.g. right after creation)
  useEffect(() => {
    const open = params.get('open');
    if (open && !selectedId && members.some((m) => rowKeyOf(m) === open || m.contact_id === open)) {
      const row = members.find((m) => rowKeyOf(m) === open || m.contact_id === open)!;
      setSelectedId(rowKeyOf(row));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, params]);

  const selected = members.find((m) => rowKeyOf(m) === selectedId) ?? null;

  // isolated-account overview (login-backed accounts only)
  useEffect(() => {
    setOv(null); setTab('overview'); setDangerOpen(false); setHardConfirm('');
    if (!selectedId || !selected?.user_id) return;
    supabase.rpc('admin_client_overview', { p_user_id: selected.user_id })
      .then(({ data, error: e }) => {
        if (e) setError(e.message);
        else setOv(data as Overview);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = members.filter((m) =>
      !needle
      || memberName(m).toLowerCase().includes(needle)
      || (m.email ?? '').toLowerCase().includes(needle)
      || (m.tags ?? []).some((t) => t.toLowerCase().includes(needle)));
    // ContactsPage's sort, ported verbatim: newest by created_at, else name A–Z.
    return [...filtered].sort((a, b) => sortKey === 'newest'
      ? new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      : memberName(a).localeCompare(memberName(b)));
  }, [members, q, sortKey]);


  async function toggleSuspend() {
    if (!selected?.user_id) return;
    try {
      await adminSetSuspended(selected.user_id, !selected.is_suspended);
      load();
    } catch { setError('Could not update the account.'); }
  }

  async function doRemove(action: 'remove' | 'unremove' | 'soft') {
    if (!selected?.contact_id) return;
    try {
      await adminAccountAction(selected.contact_id, action);
      setDangerOpen(false);
      if (action === 'soft') { setSelectedId(null); }
      load();
    } catch { setError('Could not update the account.'); }
  }

  async function doHardDelete() {
    if (!selected?.contact_id || hardConfirm !== 'DELETE') return;
    try {
      await adminHardDeleteClient(selected.contact_id);
      setDangerOpen(false); setHardConfirm(''); setSelectedId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete the account.');
    }
  }

  // ── stable fetchers for query tabs ──
  // Purchases are keyed by buyer_contact_id (always set by provisioning) and, once
  // the account logs in, buyer_user_id. Match on whichever identifiers we have so
  // provisioned pre-login accounts show their orders too.
  const buyerFilter = useCallback(() => {
    const parts: string[] = [];
    if (selected?.contact_id) parts.push(`buyer_contact_id.eq.${selected.contact_id}`);
    if (selected?.user_id) parts.push(`buyer_user_id.eq.${selected.user_id}`);
    return parts.join(',');
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps
  const fetchOrders = useCallback(async () => {
    const filter = buyerFilter();
    if (!filter) return [];
    const { data } = await supabase.from('purchases')
      .select('id, status, amount, amount_paid, created_at').or(filter).order('created_at', { ascending: false });
    return (data ?? []).map((o) => ({
      key: o.id as string,
      main: `$${Number(o.amount ?? 0).toFixed(2)}`,
      sub: fmtTs(o.created_at as string), badge: String(o.status),
    }));
  }, [buyerFilter]);
  const fetchPayments = useCallback(async () => {
    // Payment lives inline on the purchase row now; list the buyer's paid purchases.
    const filter = buyerFilter();
    if (!filter) return [];
    const { data } = await supabase.from('purchases')
      .select('id, payment_method, amount, payment_status, payment_reference, created_at')
      .or(filter)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false });
    return (data ?? []).map((p) => ({
      key: p.id as string,
      main: `$${Number(p.amount).toFixed(2)} · ${p.payment_method}${p.payment_reference ? ` · ${p.payment_reference}` : ''}`,
      sub: fmtTs(p.created_at as string), badge: String(p.payment_status),
    }));
  }, [buyerFilter]);
  const fetchActivity = useCallback(async () => {
    const { data } = await supabase.from('audit_logs')
      .select('id, occurred_at, action, table_name')
      .eq('actor_user_id', selected!.user_id!).order('occurred_at', { ascending: false }).limit(50);
    return (data ?? []).map((a) => ({
      key: a.id as string, main: String(a.action),
      sub: `${a.table_name ?? ''} · ${fmtTs(a.occurred_at as string)}`,
    }));
  }, [selectedId]);
  const fetchPosts = useCallback(async () => {
    const { data } = await supabase.from('feed_posts')
      .select('id, post_type, body, published, pulled_down, created_at')
      .eq('author_id', selected!.user_id!).order('created_at', { ascending: false });
    return (data ?? []).map((p) => ({
      key: p.id as string,
      main: (p.body as string | null)?.slice(0, 80) || `(${p.post_type} post)`,
      sub: fmtTs(p.created_at as string),
      badge: p.pulled_down ? 'pulled' : p.published ? 'live' : 'scheduled',
    }));
  }, [selectedId]);

  return (
    <PageLayout
      name="Clients"
      description={selected ? 'Everything about this account, in one place.' : 'Everyone on file — click a card to open their record.'}
      width="full"
      onAdd={!selected ? () => navigate('/app/ops/accounts/new') : undefined}
      addLabel="client"
    >
      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {/* LIST state — a grid of triage cards (TASK-ROSTERCARD). The owner
          reversed the earlier positional-row build (TASK-ROSTER, task/roster,
          unmerged) in favour of this: the data volume he wants per person
          does not fit a row. */}
      {!selected && (
        <>
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
              <RosterCard key={rowKeyOf(m)} m={m} supplement={supplement} onOpen={setSelectedId} />
            ))}
          </div>
          {visible.length === 0 && <p className="text-sm text-muted py-6 text-center">No one matches.</p>}
        </>
      )}

      {/* ISOLATED state */}
      {selected && (
        <div>
          <button type="button" onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-3 focus-ring rounded-md">
            <ArrowLeft size={14} /> All clients
          </button>

          {/* the selected row + profile block */}
          <div className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-3 min-w-0 flex-1 basis-full sm:basis-auto">
                <span className="w-11 h-11 rounded-full bg-green-800 text-white grid place-items-center font-sans shrink-0">
                  <UserRound size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg text-green-900 leading-tight truncate">{memberName(selected)}</span>
                  <span className="block text-xs text-muted truncate">
                    {selected.email} · {selected.kind === 'pending' ? 'Provisioned — no login yet'
                      : selected.kind === 'contact' ? 'Contact — no account' : 'Client'}
                    {selected.is_suspended ? ' · SUSPENDED' : ''}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {selected.kind === 'account' && (
                  <button type="button" onClick={() => void toggleSuspend()}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium focus-ring ${
                      selected.is_suspended
                        ? 'bg-green-800 text-white hover:bg-green-700'
                        : 'border border-red-300 text-red-700 hover:bg-red-50'
                    }`}>
                    {selected.is_suspended ? 'Reinstate' : 'Suspend'}
                  </button>
                )}
                <button type="button" onClick={() => setDangerOpen((v) => !v)}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-300 text-red-700 hover:bg-red-50 focus-ring">
                  Remove / Delete
                </button>
              </span>
            </div>

            {dangerOpen && (
              <div className="mt-4 border border-red-200 rounded-lg p-4 bg-red-50/40 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-900">Remove — reversible</p>
                    <p className="text-[12px] text-muted">Deactivates the account. Login is blocked; you can reactivate any time. Nothing is deleted.</p>
                  </div>
                  <span className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => void doRemove('remove')}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium border border-green-800/20 text-green-800 hover:bg-white focus-ring">
                      Remove
                    </button>
                    <button type="button" onClick={() => void doRemove('unremove')}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium border border-green-800/20 text-green-800 hover:bg-white focus-ring">
                      Reactivate
                    </button>
                  </span>
                </div>
                <div className="flex flex-wrap items-start justify-between gap-3 border-t border-red-200 pt-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-900">Soft delete — keep the data</p>
                    <p className="text-[12px] text-muted">Removes them from the app but preserves all history and signed documents. Recoverable only at the database.</p>
                  </div>
                  <button type="button" onClick={() => void doRemove('soft')}
                    className="px-3.5 py-2 rounded-lg text-xs font-medium border border-red-300 text-red-700 hover:bg-white focus-ring shrink-0">
                    Soft delete
                  </button>
                </div>
                <div className="border-t border-red-200 pt-3">
                  <p className="text-sm font-medium text-red-700">Hard delete — nuclear, irreversible</p>
                  <p className="text-[12px] text-muted mb-2">
                    Erases all traces: the login and their records. Refused if a signed agreement references them.
                    Type <span className="font-mono font-semibold">DELETE</span> to enable.
                  </p>
                  <div className="flex items-center gap-2">
                    <input value={hardConfirm} onChange={(e) => setHardConfirm(e.target.value)}
                      placeholder="DELETE"
                      className="px-3 py-2 rounded-lg border border-red-300 text-sm focus-ring w-32" />
                    <button type="button" disabled={hardConfirm !== 'DELETE'} onClick={() => void doHardDelete()}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 focus-ring disabled:opacity-40 disabled:cursor-not-allowed">
                      Hard delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* pending clients AND bare contacts: items + paperwork + provision/
              invite. Everything inside keys off contact_id and degrades
              without a client_id, so 'contact' reuses it as-is. */}
          {selected.kind !== 'account' && (
            <PendingClientView row={selected} onChanged={load} />
          )}

          {/* TAB RAIL — every tab visible, wrapping onto a second line when the
              width runs out.

              This replaced a paged carousel: TABS were sliced into pages of 6
              and translated horizontally, so 3 of the 9 hid behind a small
              "more ›" at the far right that was easy to miss entirely. There was
              never a need — nine short pills fit comfortably, and even when they
              do not, wrapping shows them all at once instead of hiding a third
              of the surface behind a control nobody notices. */}
          {selected.kind === 'account' && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-sans whitespace-nowrap focus-ring ${
                  tab === t.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          )}

          {/* tab body */}
          {selected.kind === 'account' && (
          <div className="min-h-[200px]">
            {!ov && <p className="text-sm text-muted">Loading account…</p>}
            {ov && tab === 'overview' && <OverviewTab ov={ov} />}
            {ov && tab === 'bookings' && (
              <RpcListTab userId={selected.user_id!} rpc="admin_client_bookings" empty="No lessons booked."
                create={{ label: 'Schedule a lesson', onClick: () => navigate('/app/ops/lessons/sessions') }}
                map={(r) => ({
                  key: String(r.id),
                  main: fmtTs(r.starts_at as string),
                  sub: (r.location as string) || '—', badge: String(r.status),
                })} />
            )}
            {ov && tab === 'documents' && selected.contact_id && assignOpen && (
              <AssignDocumentsModal contactId={selected.contact_id}
                onClose={() => setAssignOpen(false)}
                onAssigned={() => { setAssignOpen(false); setTabRefresh((n) => n + 1); }} />
            )}
            {ov && tab === 'documents' && (
              <>
                {selected.contact_id && <ClientHorseRecordsCard contactId={selected.contact_id} />}
                <DocumentsTab userId={selected.user_id!} refreshKey={tabRefresh}
                  onAssign={() => setAssignOpen(true)} />
              </>
            )}
            {ov && tab === 'orders' && (
              <div>
                {selected?.contact_id && (
                  <AttachOfferingPanel contactId={selected.contact_id}
                    onAttached={() => setOrdersKey((k) => k + 1)} />
                )}
                <QueryListTab key={ordersKey} fetcher={fetchOrders} empty="No orders." />
              </div>
            )}
            {ov && tab === 'payments' && (
              <QueryListTab fetcher={fetchPayments} empty="No payments." />
            )}
            {ov && tab === 'activity' && (
              <QueryListTab fetcher={fetchActivity} empty="No recorded activity." />
            )}
            {ov && tab === 'posts' && (
              <QueryListTab fetcher={fetchPosts} empty="No posts." />
            )}
            {ov && tab === 'messages' && (
              <RpcListTab userId={selected.user_id!} rpc="admin_client_messages" empty="No messages."
                create={{ label: 'Message them', onClick: () => navigate(`/app/messages/${selected.user_id}`) }}
                map={(r) => ({
                  key: String(r.id),
                  main: String(r.body ?? '').slice(0, 100),
                  sub: fmtTs(r.created_at as string),
                  badge: r.sender_id === selected.user_id! ? 'sent' : 'received',
                })} />
            )}
            {ov && tab === 'login' && <LoginTab ov={ov} />}
          </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
