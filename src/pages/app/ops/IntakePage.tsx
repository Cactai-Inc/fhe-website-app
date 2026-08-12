/**
 * OPS-INTAKE — staff intake surfaces (surface `ops`, core — ungated).
 *
 * ⚠ RETIRED 2026-08-11 (TASK-LEADCLEAN) — see INTAKE_PAGE_RETIRED at the bottom.
 * The owner ruled the dashboard is the surface and Inbound goes away, so
 * /app/ops/intake now redirects to /app/dashboard. Nothing here is deleted: the
 * page still builds and flipping the boolean restores it, exactly as
 * CONTACTS_PAGE_RETIRED did for the Contacts page.
 *
 * The WORKING MACHINERY did not retire with the page. It was extracted to
 * `components/app/LeadWorkDrawer.tsx` — the fit checklist (set_request_checklist),
 * the staff call-notes timeline, "Mark contacted", ProvisionClientForm, the gift
 * path, and the schedule-lesson path (findClientForRequest → ScheduleSessionForm)
 * — and the dashboard's lead card opens that same component. One implementation,
 * two hosts; retiring a page costs the product nothing.
 *
 * /app/ops/intake WAS the INBOUND queue — one chronological list of everything
 * sent to the company. The unified public form (Phase 5) writes every
 * contact / inquiry / booking / kiosk submission into the `requests` table, so
 * there is no separate form-submissions queue anymore; support requests join
 * the same list.
 */
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { DataTable, StatusBadge, useAsync } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listBookingRequests,
  listInboundQueue,
  type InboundQueueRow,
} from '../../../lib/ops/api-intake';
import type {
  BookingRequest,
  BookingRequestStatus,
} from '../../../lib/ops/api-intake';
import {
  LeadWorkDrawer,
  LESSON_FIT_CHECKLIST,
  CONTACT_METHOD_LABEL,
  requestedSummary,
} from '../../../components/app/LeadWorkDrawer';
import { listSupportRequests, setSupportStatus, type SupportRequest } from '../../../lib/support';
import { BookingFieldsSettings } from './BookingFieldsSettings';

/* Moved to LeadWorkDrawer with the machinery it belongs to; re-exported here so
 * the original import path keeps working. */
export { LESSON_FIT_CHECKLIST };

// ════════════════════════════════════════════════════════════════════════════
// Booking requests — the Request Inbox (Flow A step 2)
// ════════════════════════════════════════════════════════════════════════════

type RequestFilter = BookingRequestStatus | 'ALL';

const REQUEST_FILTERS: { id: RequestFilter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'invited', label: 'Invited' },
  { id: 'converted', label: 'Converted' },
  { id: 'ALL', label: 'All' },
];

/* LESSON_FIT_CHECKLIST, CONTACT_METHOD_LABEL, requestedSummary, the availability
 * renderer, the visitor/experience note parsers and the name split all moved to
 * components/app/LeadWorkDrawer.tsx with the drawer that uses them. Nothing was
 * dropped — the two of them this table still needs are imported at the top. */

const REQUEST_COLUMNS: Column<BookingRequest>[] = [
  {
    key: 'created_at',
    header: 'Submitted',
    render: (r) => new Date(r.created_at).toLocaleDateString(),
  },
  { key: 'contact_name', header: 'Name', render: (r) => r.contact_name },
  {
    key: 'contact',
    header: 'Contact',
    render: (r) => (
      <span>
        {r.contact_email}
        {r.contact_phone ? ` · ${r.contact_phone}` : ''}
        {r.contact_method && (
          <span className="ml-2 inline-flex items-center rounded-full bg-green-800/10 px-2 py-0.5 text-xs font-sans text-green-800">
            {CONTACT_METHOD_LABEL[r.contact_method]}
          </span>
        )}
      </span>
    ),
  },
  { key: 'requested', header: 'Requested', render: (r) => requestedSummary(r) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

// ════════════════════════════════════════════════════════════════════════════
// INBOUND — one chronological list of everything sent to the company (owner
// unification): booking/purchase requests (the `requests` lifecycle pipeline),
// form submissions (the `intake_submissions` lead queue — contact-us et al.),
// and support requests. The old two-tab duality is gone; the KIND filter is
// buttons on desktop, a dropdown on mobile. Selecting a booking or form row
// drops into its existing full workflow (auto-opened); support resolves inline.
// ════════════════════════════════════════════════════════════════════════════

type InboundKind = 'all' | 'booking' | 'support';

interface InboundRow {
  key: string;
  kind: Exclude<InboundKind, 'all'>;
  when: string;              // ISO
  who: string;
  what: string;
  status: string;
  refId: string;
}

const KIND_LABEL: Record<Exclude<InboundKind, 'all'>, string> = {
  booking: 'Booking request', support: 'Support',
};
const KIND_FILTERS: { id: InboundKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'booking', label: 'Booking requests' },
  { id: 'support', label: 'Support' },
];

/** The queue's conscience: what has waited too long, and what is merely unclosed.
 *  Renders nothing when the queue is clean, so a healthy inbox stays quiet. */
function InboundAttention() {
  const [rows, setRows] = useState<InboundQueueRow[]>([]);
  useEffect(() => {
    let active = true;
    listInboundQueue()
      .then((r) => { if (active) setRows(r); })
      .catch(() => { /* the list below is the source of truth; stay silent */ });
    return () => { active = false; };
  }, []);

  const overdue = rows.filter((r) => r.overdue);
  const stale = rows.filter((r) => r.already_converted && r.status === 'new');
  if (overdue.length === 0 && stale.length === 0) return null;

  const name = (r: InboundQueueRow) =>
    [r.contact_first_name, r.contact_last_name].filter(Boolean).join(' ')
    || r.contact_email || 'Someone';

  return (
    <div className="mb-6 flex flex-col gap-3">
      {overdue.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-900 mb-1">
            {overdue.length} waiting on us
          </p>
          <p className="text-[12.5px] text-red-900/85 mb-3">
            No one has picked these up, and the person never became a client.
            Oldest first.
          </p>
          <div className="flex flex-col gap-1.5">
            {overdue.map((r) => (
              <div key={r.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="text-red-950 font-medium">{name(r)}</span>
                <span className="text-[11.5px] text-red-900/80">
                  {r.channel === 'booking' ? 'lesson booking' : (r.channel ?? 'enquiry')}
                  {r.contact_email ? ` · ${r.contact_email}` : ''}
                </span>
                <span className="ml-auto text-[11.5px] font-semibold text-red-800">
                  {r.days_open} {r.days_open === 1 ? 'day' : 'days'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TASK-LEADCLEAN: this used to read "{n} already handled, still marked
          new … clearing them keeps the queue honest" — the software computing
          the answer and then asking the owner to do the clearing. It no longer
          asks: the dashboard derives the same `already_converted` and retires
          those cards on its own. Kept as a statement of fact for anyone who
          flips INTAKE_PAGE_RETIRED back on. */}
      {stale.length > 0 && (
        <div className="rounded-xl border border-green-800/15 bg-cream-100/60 p-4">
          <p className="text-sm font-medium text-green-900 mb-1">
            {stale.length} already became clients
          </p>
          <p className="text-[12.5px] text-green-800/80">
            The work is done and the row was never closed by hand. Nothing to do —
            the dashboard has already retired these cards from its open list, and
            the requests themselves are kept as history.
          </p>
        </div>
      )}
    </div>
  );
}

export function IntakePage() {
  useDocumentTitle('Inbound');
  const [kind, setKind] = useState<InboundKind>('all');
  const [rows, setRows] = useState<InboundRow[] | null>(null);
  const [inboundError, setInboundError] = useState<string | null>(null);
  // focus = drop into the existing deep workflow for one item
  // Deep-link: request_new notifications link /app/ops/intake?request=<id> —
  // seed the focus from the param so the link opens that request's drawer
  // instead of landing on the flat inbound list.
  const [searchParams] = useSearchParams();
  const linkedRequest = searchParams.get('request');
  const [focus, setFocus] = useState<{ kind: 'booking'; id: string } | null>(
    linkedRequest ? { kind: 'booking', id: linkedRequest } : null,
  );
  const [supportOpen, setSupportOpen] = useState<string | null>(null);
  const [supportRows, setSupportRows] = useState<SupportRequest[]>([]);

  const loadInbound = useCallback(async () => {
    try {
      const [requests, support] = await Promise.all([
        listBookingRequests().catch(() => [] as BookingRequest[]),
        listSupportRequests().catch(() => [] as SupportRequest[]),
      ]);
      setSupportRows(support);
      const merged: InboundRow[] = [
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
      ].sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
      setRows(merged);
      setInboundError(null);
    } catch {
      setInboundError('Could not load the inbound queue.');
    }
  }, []);
  useEffect(() => { void loadInbound(); }, [loadInbound]);

  const visible = (rows ?? []).filter((r) => kind === 'all' || r.kind === kind);

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
            className={`px-3.5 py-1.5 rounded-full text-sm font-sans transition-colors focus-ring ${
              kind === f.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {f.label}
          </button>
        ))}
      </div>
      <div className="sm:hidden mb-5">
        <select className="form-input" value={kind} onChange={(e) => setKind(e.target.value as InboundKind)}>
          {KIND_FILTERS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>

      {inboundError && <p role="alert" className="form-error mb-4">{inboundError}</p>}
      {rows === null && !inboundError && <p className="text-sm text-green-800/70">Loading…</p>}
      {rows !== null && visible.length === 0 && (
        <p className="text-sm text-green-800/70">Nothing inbound{kind !== 'all' ? ' in this kind' : ''}.</p>
      )}

      <div className="flex flex-col gap-2">
        {visible.map((r) => (
          <div key={r.key} className="bg-white border border-green-800/10 rounded-lg">
            <button type="button"
              onClick={() => {
                if (r.kind === 'support') setSupportOpen(supportOpen === r.refId ? null : r.refId);
                else setFocus({ kind: r.kind, id: r.refId });
              }}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left focus-ring rounded-lg">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-green-900 truncate">
                  {r.who} <span className="text-muted font-normal">· {r.what}</span>
                </span>
                <span className="block text-xs text-muted mt-0.5">
                  {new Date(r.when).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-sans uppercase tracking-wide px-2 py-0.5 rounded-full bg-cream-100 text-secondary">
                  {KIND_LABEL[r.kind]}
                </span>
                <StatusBadge status={r.status} />
              </span>
            </button>
            {r.kind === 'support' && supportOpen === r.refId && (() => {
              const t = supportRows.find((x) => x.id === r.refId);
              if (!t) return null;
              return (
                <div className="px-4 pb-3 border-t border-green-800/[0.06]">
                  <p className="body-text text-sm text-green-900/90 whitespace-pre-line my-2">{t.body}</p>
                  <div className="flex gap-2">
                    {t.status !== 'resolved' && (
                      <button type="button" className="btn-primary text-xs"
                        onClick={() => void setSupportStatus(t.id, 'resolved').then(loadInbound)}>
                        Resolve
                      </button>
                    )}
                    {t.status === 'open' && (
                      <button type="button" className="btn-secondary text-xs"
                        onClick={() => void setSupportStatus(t.id, 'in_progress').then(loadInbound)}>
                        Start
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>
    </div>
  );
}

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

export default IntakePage;
