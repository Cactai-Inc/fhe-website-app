import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Plus, Search, UserRound,
} from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { supabase } from '../../lib/supabase';
import {
  adminSetSuspended, adminClientAccounts, adminClientItems, adminSendInvitation,
  adminExpireInvitation, adminDeleteInvitation, adminDeleteClient,
  categoryDocumentDefaults, getContactRequiredDocuments, setContactRequiredDocuments,
  type ClientAccountRow, type ClientItems, type CategoryDocDefault,
} from '../../lib/admin';
import {
  listBillingSchedules, createBillingSchedule, nextDue,
  type BillingSchedule, type BillingMode, type BillingCadence,
} from '../../lib/billing';

/**
 * CLIENTS (/app/admin) — the account-centric surface (owner rework). CLIENT
 * accounts only (staff live on Team & access under Settings). Two states:
 *
 *  LIST — every client, searchable + sortable. Clicking a row isolates it.
 *  ISOLATED — the other rows disappear; the profile renders below the selected
 *  row; account-scoped TABS appear (Overview / Billing / Bookings / Documents /
 *  Orders / Payments / Activity / Posts / Messages / Login). More tabs than fit →
 *  a "more" control slides the tab rail sideways (animated); a back control
 *  appears on the left. Each tab carries a create action where one makes sense.
 *  A clear exit control returns to the list (tabs disappear with it).
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
  membership: { tier: string | null; status: string | null; started_at: string | null } | null;
  counts: { orders: number; posts: number; documents: number; bookings: number };
}

type TabId =
  | 'overview' | 'billing' | 'bookings' | 'documents' | 'orders' | 'payments'
  | 'activity' | 'posts' | 'messages' | 'login';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'billing', label: 'Billing' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'documents', label: 'Documents' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'activity', label: 'Activity' },
  { id: 'posts', label: 'Posts' },
  { id: 'messages', label: 'Messages' },
  { id: 'login', label: 'Login' },
];
const TAB_PAGE_SIZE = 6;

const fmt = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtTs = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const memberName = (m: ClientAccountRow) =>
  m.display_name || `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim() || m.email || '—';
const rowKeyOf = (m: ClientAccountRow) => m.user_id ?? m.contact_id ?? m.email ?? '';

// ── generic row list used by several tabs ────────────────────────────────────
function RowList({ rows, empty }: { rows: { key: string; main: string; sub: string; badge?: string }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm text-green-900 truncate">{r.main}</span>
            <span className="block text-xs text-muted">{r.sub}</span>
          </span>
          {r.badge && <span className="text-[10.5px] font-sans uppercase px-2 py-0.5 rounded-full bg-cream-100 text-secondary shrink-0">{r.badge}</span>}
        </div>
      ))}
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
  if (!p) return null;
  const pairs: [string, string][] = [
    ['Email', p.email], ['Phone', p.phone ?? '—'], ['Mobile', p.mobile ?? '—'],
    ['WhatsApp', p.whatsapp ?? '—'], ['Riding level', p.riding_level ?? '—'],
    ['Joined', fmt(p.created_at)],
    ['Membership', ov.membership ? `${ov.membership.tier ?? 'member'} · ${ov.membership.status ?? '—'}` : 'None'],
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

function BillingTab({ clientId }: { clientId: string | null }) {
  const [rows, setRows] = useState<BillingSchedule[]>([]);
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<BillingMode>('request');
  const [cadence, setCadence] = useState<BillingCadence>('monthly');
  const [start, setStart] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listBillingSchedules()
      .then((all) => setRows(clientId ? all.filter((s) => s.client_id === clientId) : []))
      .catch(() => {});
  }, [clientId]);
  useEffect(load, [load]);

  if (!clientId) return <p className="text-sm text-muted">No client record yet — billing starts with their first purchase.</p>;

  async function create() {
    setErr(null);
    if (!amount || !start) { setErr('Amount and start date are required.'); return; }
    try {
      await createBillingSchedule({ client_id: clientId!, mode, cadence, amount: Number(amount), start_date: start });
      setCreating(false); setAmount(''); setStart(''); load();
    } catch { setErr('Could not create the schedule.'); }
  }

  return (
    <div>
      <TabCreate label="New billing schedule" onClick={() => setCreating((v) => !v)} />
      {creating && (
        <div className="bg-white border border-green-800/10 rounded-lg p-4 mb-3 grid sm:grid-cols-4 gap-3">
          <input type="number" placeholder="Amount $" className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select className="form-input" value={mode} onChange={(e) => setMode(e.target.value as BillingMode)}>
            <option value="request">We request</option><option value="self_recurring">They pay recurring</option>
          </select>
          <select className="form-input" value={cadence} onChange={(e) => setCadence(e.target.value as BillingCadence)}>
            <option value="monthly">Monthly</option><option value="weekly">Weekly</option>
          </select>
          <input type="date" className="form-input" value={start} onChange={(e) => setStart(e.target.value)} />
          {err && <p className="form-error text-xs sm:col-span-3">{err}</p>}
          <button type="button" className="btn-primary text-xs sm:col-start-4" onClick={() => void create()}>Create</button>
        </div>
      )}
      <RowList empty="No billing schedules."
        rows={rows.map((s) => ({
          key: s.id,
          main: `$${Number(s.amount).toFixed(2)} ${s.cadence} · ${s.mode === 'request' ? 'we request' : 'self-recurring'}`,
          sub: `next ${nextDue(s.start_date, s.cadence).toLocaleDateString()} · reminders ${s.reminders_on ? 'on' : 'off'}${s.active ? '' : ' · inactive'}`,
        }))} />
    </div>
  );
}

function RpcListTab({
  userId, rpc, map, empty, create,
}: {
  userId: string;
  rpc: string;
  map: (r: Record<string, unknown>) => { key: string; main: string; sub: string; badge?: string };
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
function InvitePanel({ row, onSent }: { row: ClientAccountRow; onSent: () => void }) {
  const [scheduled, setScheduled] = useState(row.invite_scheduled_for ?? '');
  const [days, setDays] = useState('7');
  const [result, setResult] = useState<{ url: string; emailed: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sent = row.invite_status === 'sent';
  const expired = sent && row.invite_expires_at ? new Date(row.invite_expires_at) < new Date() : false;

  async function send() {
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await adminSendInvitation({
        email: row.email!,
        expiresInDays: Number(days) || 7,
        ...(scheduled ? { scheduledFor: scheduled } : {}),
      });
      setResult({ url: r.registerUrl, emailed: r.emailed });
      onSent();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-white border border-gold-600/40 rounded-xl p-4 mt-4">
      <h3 className="font-serif text-green-800 text-base">Invitation</h3>
      <p className="text-[12px] text-muted mb-3">
        {sent
          ? `Last invite ${expired ? 'EXPIRED' : 'expires'} ${row.invite_expires_at ? new Date(row.invite_expires_at).toLocaleString() : ''} — resend any time.`
          : 'Everything attached? Send the registration invite.'}
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div>
          <span className="form-label">Agreed start date (optional)</span>
          <input type="date" className="form-input" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
        </div>
        {!scheduled && (
          <div>
            <span className="form-label">Expires in (days)</span>
            <input type="number" min={1} className="form-input" value={days} onChange={(e) => setDays(e.target.value)} />
          </div>
        )}
        {scheduled && (
          <p className="text-[11.5px] text-gold-800 self-end pb-2.5 sm:col-span-2">
            A set date puts this on the 48-hour claim &amp; pay window.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !row.email} onClick={() => void send()}
          className="btn-primary text-xs">
          {busy ? 'Sending…' : sent ? 'Resend invitation' : 'Send invitation'}
        </button>
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
      {result && (
        <div className="bg-green-50 border border-green-200 p-3 mt-3 text-sm rounded-lg">
          <p className="text-green-800 mb-1.5">
            Invitation {result.emailed ? 'sent by email.' : 'created — email not configured; copy the link:'}
          </p>
          <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2">{result.url}</code>
        </div>
      )}
    </section>
  );
}

function PaperworkEditor({ contactId }: { contactId: string }) {
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    getContactRequiredDocuments(contactId).then((keys) => setChecked(new Set(keys))).catch(() => {});
  }, [contactId]);

  const templates = (() => {
    const m = new Map<string, { title: string; categories: string[] }>();
    for (const d of defaults) {
      const t = m.get(d.template_key) ?? { title: d.title, categories: [] };
      t.categories.push(d.category);
      m.set(d.template_key, t);
    }
    return Array.from(m.entries()).map(([key, v]) => ({ key, ...v }));
  })();

  async function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setChecked(next); setSaved(false);
    try {
      await setContactRequiredDocuments(contactId, Array.from(next));
      setSaved(true);
    } catch { /* row stays visibly unsaved */ }
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-green-800 text-lg">First-login paperwork</h3>
        <span className={`text-xs ${saved ? 'text-green-700' : 'text-gold-800'}`}>{saved ? 'Saved' : 'Saving…'}</span>
      </div>
      <p className="text-sm text-muted mb-3">
        What they'll be asked to review and sign when they activate. The invitation email lists exactly this.
      </p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {templates.map((t) => (
          <label key={t.key}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border cursor-pointer ${
              checked.has(t.key) ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-green-50/50'
            }`}>
            <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
              checked={checked.has(t.key)} onChange={() => void toggle(t.key)} />
            <span className="min-w-0">
              <span className={`block text-[14px] leading-snug ${checked.has(t.key) ? 'text-green-900 font-medium' : 'text-secondary'}`}>{t.title}</span>
              <span className="block text-[11.5px] text-muted mt-0.5">Suggested for {t.categories.join(', ')}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function PendingClientView({ row, onChanged }: { row: ClientAccountRow; onChanged: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ClientItems | null>(null);
  useEffect(() => {
    if (!row.client_id) { setItems({ engagements: [], documents: [] }); return; }
    adminClientItems(row.client_id).then(setItems).catch(() => setItems({ engagements: [], documents: [] }));
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
              onClick={() => navigate(`/app/ops/engagements/new?contact=${row.contact_id}`)}>+ engagement</button>
            <button type="button" className="text-xs underline text-secondary hover:text-green-800"
              onClick={() => navigate('/app/ops/contracts/new')}>+ contract</button>
          </span>
        </div>
        <p className="text-[12px] text-muted mb-3">
          What's attached to this account so far — attach everything before inviting.
        </p>
        {items === null && <p className="text-sm text-muted">Loading…</p>}
        {items && items.engagements.length === 0 && items.documents.length === 0 && (
          <p className="text-sm text-muted">Nothing attached yet.</p>
        )}
        {items && items.engagements.map((e) => (
          <button key={e.id} type="button" onClick={() => navigate(`/app/ops/engagements/${e.id}`)}
            className="w-full flex items-center justify-between gap-3 border-b border-green-800/[0.06] py-2 text-left hover:bg-cream-100/50">
            <span className="text-sm text-green-900">{(e.service_type ?? 'Engagement').replace(/_/g, ' ')}</span>
            <span className="text-xs text-muted">{e.status}{e.start_date ? ` · starts ${e.start_date}` : ''}</span>
          </button>
        ))}
        {items && items.documents.map((d) => (
          <button key={d.id} type="button" onClick={() => navigate(`/app/contracts/${d.id}`)}
            className="w-full flex items-center justify-between gap-3 border-b border-green-800/[0.06] py-2 text-left hover:bg-cream-100/50">
            <span className="text-sm text-green-900">{d.title ?? 'Document'}</span>
            <span className="text-xs text-muted">{d.workflow_state ?? d.status}</span>
          </button>
        ))}
      </section>

      {row.contact_id && <PaperworkEditor contactId={row.contact_id} />}

      <section className="bg-white border border-green-800/10 rounded-xl p-4 mt-4">
        <h3 className="font-serif text-green-800 text-base mb-2">Billing</h3>
        <BillingTab clientId={row.client_id} />
      </section>

      <InvitePanel row={row} onSent={onChanged} />
    </div>
  );
}

// ── the page ─────────────────────────────────────────────────────────────────
type SortKey = 'name' | 'joined' | 'status';

export default function Admin() {
  useDocumentTitle('Clients');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [members, setMembers] = useState<ClientAccountRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('joined');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ov, setOv] = useState<Overview | null>(null);
  const [tab, setTab] = useState<TabId>('overview');
  const [tabPage, setTabPage] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    // login-backed clients + provisioned (no-login-yet) clients in one list
    adminClientAccounts()
      .then(setMembers)
      .catch(() => setError('Could not load clients.'));
  }, []);
  useEffect(load, [load]);

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
    setOv(null); setTab('overview'); setTabPage(0); setConfirmDelete(false);
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
      || (m.email ?? '').toLowerCase().includes(needle));
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return memberName(a).localeCompare(memberName(b));
      if (sortKey === 'status') return Number(b.membership_status === 'active') - Number(a.membership_status === 'active');
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
  }, [members, q, sortKey]);

  const clientId = selected?.client_id ?? ov?.profile?.client_id ?? null;
  const tabPages = Math.ceil(TABS.length / TAB_PAGE_SIZE);

  async function toggleSuspend() {
    if (!selected?.user_id) return;
    try {
      await adminSetSuspended(selected.user_id, !selected.is_suspended);
      load();
    } catch { setError('Could not update the account.'); }
  }

  async function deleteClient() {
    if (!selected?.contact_id) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      const { had_login } = await adminDeleteClient(selected.contact_id);
      setConfirmDelete(false);
      setSelectedId(null);
      load();
      if (had_login) {
        setError('Client removed. Their login was suspended and detached — full auth deletion needs the owner (service role).');
      }
    } catch { setError('Could not delete the client.'); }
  }

  // ── stable fetchers for query tabs ──
  const fetchOrders = useCallback(async () => {
    const { data } = await supabase.from('orders')
      .select('id, status, total, created_at').eq('user_id', selected!.user_id!).order('created_at', { ascending: false });
    return (data ?? []).map((o) => ({
      key: o.id as string,
      main: `$${Number(o.total ?? 0).toFixed(2)}`,
      sub: fmtTs(o.created_at as string), badge: String(o.status),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const fetchPayments = useCallback(async () => {
    const { data: orders } = await supabase.from('orders').select('id').eq('user_id', selected!.user_id!);
    const ids = (orders ?? []).map((o) => o.id);
    if (ids.length === 0) return [];
    const { data } = await supabase.from('payments')
      .select('id, method, amount, status, reference_code, created_at')
      .in('order_id', ids).order('created_at', { ascending: false });
    return (data ?? []).map((p) => ({
      key: p.id as string,
      main: `$${Number(p.amount).toFixed(2)} · ${p.method}${p.reference_code ? ` · ${p.reference_code}` : ''}`,
      sub: fmtTs(p.created_at as string), badge: String(p.status),
    }));
  }, [selectedId]);
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
    <div className="max-w-none">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-serif text-2xl text-green-900">Clients</h1>
        {!selected && (
          <button type="button" onClick={() => navigate('/app/ops/accounts/new')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
            <Plus size={15} /> New client
          </button>
        )}
      </div>
      <p className="text-sm text-green-800/70 mb-5">
        {selected ? 'Everything about this account, in one place.' : 'Every client account — click one to open it.'}
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {/* LIST state */}
      {!selected && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className="form-input pl-9 w-full" placeholder="Search name or email…"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex gap-1.5">
              {([['joined', 'Newest'], ['name', 'A–Z'], ['status', 'Active first']] as [SortKey, string][]).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setSortKey(k)}
                  className={`px-3 py-1.5 rounded-full text-xs font-sans ${sortKey === k ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {visible.map((m) => (
              <button key={rowKeyOf(m)} type="button" onClick={() => setSelectedId(rowKeyOf(m))}
                className="w-full flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-3 text-left hover:border-green-800/30 focus-ring">
                <span className="min-w-0 flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-green-800 text-white grid place-items-center text-sm font-sans shrink-0">
                    {(memberName(m)[0] || 'C').toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-green-900 truncate">{memberName(m)}</span>
                    <span className="block text-xs text-muted truncate">{m.email}</span>
                  </span>
                </span>
                <span className="text-right shrink-0">
                  {m.kind === 'pending' ? (
                    <span className={`block text-[10.5px] font-sans uppercase ${
                      m.invite_status === 'sent' ? 'text-gold-800' : 'text-muted'
                    }`}>
                      {m.invite_status === 'sent'
                        ? (m.invite_expires_at && new Date(m.invite_expires_at) < new Date() ? 'Invite expired' : 'Invited')
                        : m.invite_status === 'accepted' ? 'Claimed' : 'Not invited'}
                    </span>
                  ) : (
                    <span className={`block text-[10.5px] font-sans uppercase ${m.membership_status === 'active' ? 'text-green-700' : 'text-muted'}`}>
                      {m.membership_status === 'active' ? 'Active' : 'Inactive'}
                      {m.is_suspended ? ' · suspended' : ''}
                    </span>
                  )}
                  <span className="block text-[11px] text-muted">{m.kind === 'pending' ? 'created' : 'joined'} {fmt(m.created_at)}</span>
                </span>
              </button>
            ))}
            {visible.length === 0 && <p className="text-sm text-muted py-6 text-center">No clients match.</p>}
          </div>
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
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-full bg-green-800 text-white grid place-items-center font-sans shrink-0">
                  <UserRound size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-lg text-green-900 leading-tight truncate">{memberName(selected)}</span>
                  <span className="block text-xs text-muted truncate">
                    {selected.email} · {selected.kind === 'pending' ? 'Provisioned — no login yet' : 'Client'}
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
                <button type="button" onClick={() => void deleteClient()}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium focus-ring ${
                    confirmDelete
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'border border-red-300 text-red-700 hover:bg-red-50'
                  }`}>
                  {confirmDelete ? 'Confirm delete' : 'Delete'}
                </button>
              </span>
            </div>
            {confirmDelete && (
              <p className="text-[12px] text-red-700 mt-2">
                Removes this client from the app. Signed documents and history are kept.
                {selected.kind === 'account' ? ' Their login will be suspended and detached.' : ''}
              </p>
            )}
          </div>

          {selected.kind === 'pending' && (
            <PendingClientView row={selected} onChanged={load} />
          )}

          {/* sliding tab rail: pages of tabs, more → slide, back appears left */}
          {selected.kind === 'account' && (
          <div className="flex items-center gap-1 mb-4">
            {tabPage > 0 && (
              <button type="button" aria-label="Previous tabs" onClick={() => setTabPage((p) => p - 1)}
                className="p-1.5 rounded-md text-secondary hover:text-green-800 focus-ring shrink-0">
                <ChevronLeft size={16} />
              </button>
            )}
            <div className="overflow-hidden flex-1">
              <div className="flex gap-1.5 transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${tabPage * 100}%)` }}>
                {Array.from({ length: tabPages }, (_, page) => (
                  <div key={page} className="flex gap-1.5 min-w-full">
                    {TABS.slice(page * TAB_PAGE_SIZE, (page + 1) * TAB_PAGE_SIZE).map((t) => (
                      <button key={t.id} type="button" onClick={() => setTab(t.id)}
                        className={`px-3.5 py-1.5 rounded-full text-[12.5px] font-sans whitespace-nowrap focus-ring ${
                          tab === t.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
                        }`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            {tabPage < tabPages - 1 && (
              <button type="button" aria-label="More tabs" onClick={() => setTabPage((p) => p + 1)}
                className="inline-flex items-center gap-0.5 p-1.5 rounded-md text-secondary hover:text-green-800 text-xs focus-ring shrink-0">
                more <ChevronRight size={14} />
              </button>
            )}
          </div>
          )}

          {/* tab body */}
          {selected.kind === 'account' && (
          <div className="min-h-[200px]">
            {!ov && <p className="text-sm text-muted">Loading account…</p>}
            {ov && tab === 'overview' && <OverviewTab ov={ov} />}
            {ov && tab === 'billing' && <BillingTab clientId={clientId} />}
            {ov && tab === 'bookings' && (
              <RpcListTab userId={selected.user_id!} rpc="admin_client_bookings" empty="No lessons booked."
                create={{ label: 'Schedule a lesson', onClick: () => navigate('/app/ops/lessons/sessions') }}
                map={(r) => ({
                  key: String(r.id),
                  main: fmtTs(r.starts_at as string),
                  sub: (r.location as string) || '—', badge: String(r.status),
                })} />
            )}
            {ov && tab === 'documents' && (
              <RpcListTab userId={selected.user_id!} rpc="admin_client_documents" empty="No documents."
                create={{ label: 'New contract', onClick: () => navigate('/app/ops/contracts/new') }}
                map={(r) => ({
                  key: String(r.id),
                  main: String(r.title ?? 'Document'),
                  sub: fmtTs(r.created_at as string),
                  badge: String(r.workflow_state ?? r.status),
                })} />
            )}
            {ov && tab === 'orders' && (
              <QueryListTab fetcher={fetchOrders} empty="No orders." />
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
    </div>
  );
}
