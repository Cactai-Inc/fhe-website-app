/**
 * OPS-INTAKE — staff intake surfaces (surface `ops`, core — ungated).
 *
 * /app/ops/intake is the INBOUND queue — one chronological list of everything
 * sent to the company. The unified public form (Phase 5) writes every
 * contact / inquiry / booking / kiosk submission into the `requests` table, so
 * there is no separate form-submissions queue anymore; support requests join
 * the same list. A booking row opens the working drawer: contact + requested
 * items, the structured availability (weeks / day prefs / AM-PM prefs / riding
 * experience / visitor notes), the staff call-notes timeline (append_request_note
 * RPC), the LESSON FIT CHECKLIST (set_request_checklist RPC), "Mark contacted",
 * and the checklist-gated "Send confirmation & invite" provisioning form that
 * submits to /api/admin-send-invitation with requestId — server-side the RPC
 * stamps invitations.request_id and flips the request to 'invited'.
 */
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toErrorMessage } from '../../../lib/ops/errors';
import { DataTable, Modal, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  findClientForRequest,
  listBookingRequests,
  markRequestContacted,
  appendRequestNote,
  setRequestChecklist,
  listInboundQueue,
  type InboundQueueRow,
} from '../../../lib/ops/api-intake';
import {
  scheduleLessonSession,
  listLessonSessionsForRequest,
  listScheduleHorses,
} from '../../../lib/ops/api-lessons';
import type { LessonSession, ScheduleHorseOption } from '../../../lib/ops/api-lessons';
import { formatSessionWhen } from '../../../lib/formatDateTime';
import { categoryFieldLabel } from '../../../lib/intakeCategoryFields';
import { ScheduleSessionForm } from './lessons/ScheduleSessionForm';
import type { ScheduleSessionFormValues } from './lessons/ScheduleSessionForm';
import type {
  BookingRequest,
  BookingRequestStatus,
} from '../../../lib/ops/api-intake';
import { ProvisionClientForm } from '../../../components/app/ProvisionClientForm';
import { listSupportRequests, setSupportStatus, type SupportRequest } from '../../../lib/support';
import { BookingFieldsSettings } from './BookingFieldsSettings';
import type { ProposedTime } from '../../../lib/types';

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

/** The per-service fit checklist (BOOKING_FLOWS_PLAN §1 staff rails). Keys are
 *  what land in the requests.checklist jsonb ({key: boolean}, stored whole via
 *  set_request_checklist); labels are the staff-facing text. "Send confirmation
 *  & invite" stays disabled until every key is true. */
export const LESSON_FIT_CHECKLIST: { key: string; label: string }[] = [
  { key: 'spoke_with_client', label: 'Spoke with the client' },
  { key: 'experience_assessed', label: 'Riding experience assessed' },
  { key: 'program_identified', label: 'Right program identified' },
  { key: 'times_discussed', label: 'Date(s)/time(s) discussed' },
  { key: 'payment_agreed', label: 'Payment method agreed' },
];

const CONTACT_METHOD_LABEL: Record<string, string> = {
  text: 'Text', call: 'Call', email: 'Email',
};

/** The visitor's own words: everything before the appended availability block. */
const AVAILABILITY_MARKER = '— Availability & experience —';
function visitorNotes(notes: string | null): string | null {
  if (!notes) return null;
  const own = notes.split(AVAILABILITY_MARKER)[0].trim();
  return own || null;
}

/** Riding experience travels in the notes block ("Riding experience: 1–2 years"). */
function ridingExperience(notes: string | null): string | null {
  const m = notes?.match(/Riding experience:\s*([^\n]+)/);
  return m ? m[1].trim() : null;
}

/** Human text for one proposed-times entry: structured week window or legacy {date,time}. */
function proposedTimeText(t: ProposedTime): string {
  if (t.label) return t.label;
  if (t.end) return `${t.date} – ${t.end}`;
  return t.time ? `${t.date} (${t.time})` : t.date;
}

/** 'Riding Lessons — 4-Lesson Punch Card; …' from the embedded selections. */
function requestedSummary(r: BookingRequest): string {
  const labels = (r.request_selections ?? [])
    .map((s) => s.label ?? s.offering_slug)
    .filter((l): l is string => Boolean(l));
  return labels.length > 0 ? labels.join('; ') : '—';
}

/** First-space split of the freeform contact_name (same rule as contact heal). */
function splitContactName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceAt = trimmed.indexOf(' ');
  if (spaceAt <= 0) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, spaceAt), lastName: trimmed.slice(spaceAt + 1).trim() };
}

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

/** Structured availability, rendered readably (weeks / times / days / experience). */
function AvailabilitySection({ request }: { request: BookingRequest }) {
  const times = request.proposed_times ?? [];
  const weeks = times.filter((t) => t.date || t.label).map(proposedTimeText);
  const first = times[0];
  const experience = ridingExperience(request.notes);
  return (
    <section aria-label="Availability & experience">
      <h3 className="form-label mb-2">Availability &amp; experience</h3>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-sans font-medium text-green-800/70">Preferred weeks</dt>
          <dd className="text-sm text-green-900">
            {weeks.length > 0 ? weeks.join('; ') : 'No specific weeks requested'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-sans font-medium text-green-800/70">Times</dt>
          <dd className="text-sm text-green-900">{first?.time || 'No time-of-day preference'}</dd>
        </div>
        <div>
          <dt className="text-xs font-sans font-medium text-green-800/70">Days</dt>
          <dd className="text-sm text-green-900">{first?.days || 'Not specified'}</dd>
        </div>
        <div>
          <dt className="text-xs font-sans font-medium text-green-800/70">Riding experience</dt>
          <dd className="text-sm text-green-900">{experience ?? 'Not provided'}</dd>
        </div>
      </dl>
    </section>
  );
}

/** Name + email pre-fill carried from a submission into the shared provision
 *  form (category/offerings/paperwork/payment are handled in ProvisionClientForm). */
interface InviteFormState {
  firstName: string;
  lastName: string;
  email: string;
}

function inviteFormFor(r: BookingRequest): InviteFormState {
  // The unified intake stores first/last directly; fall back to the legacy
  // first-space split only for older rows that predate the split.
  const split = splitContactName(r.contact_name);
  return {
    firstName: r.contact_first_name?.trim() || split.firstName,
    lastName: r.contact_last_name?.trim() || split.lastName,
    email: r.contact_email,
  };
}

function RequestInbox({ openId }: { openId?: string } = {}) {
  // Inbound focus: auto-open one request when handed an id (runs once per id).
  const [autoOpened, setAutoOpened] = useState<string | null>(null);
  const [rows, setRows] = useState<BookingRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestFilter>('new');
  const [selected, setSelected] = useState<BookingRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteFormState | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    url: string; emailed: boolean; offeringLabel?: string;
  } | null>(null);
  const [horses, setHorses] = useState<ScheduleHorseOption[]>([]);
  // Schedule-lesson section (invited/converted requests): the provisioned
  // client resolved via request → invitation → email → contact → client, plus
  // the sessions already booked from this request.
  const [requestClientId, setRequestClientId] = useState<string | null>(null);
  const [requestSessions, setRequestSessions] = useState<LessonSession[]>([]);

  const load = useAsync(listBookingRequests);
  const toast = useToast();

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
    listScheduleHorses()
      .then(setHorses)
      .catch(() => setHorses([]));
  }, []);

  const openRequest = (row: BookingRequest) => {
    setSelected(row);
    setChecklist(row.checklist ?? {});
    setNoteText('');
    setInviteOpen(false);
    setInvite(inviteFormFor(row));
    setInviteResult(null);
    setActionError(null);
    setRequestClientId(null);
    setRequestSessions([]);
    if (row.status === 'invited' || row.status === 'converted') {
      findClientForRequest(row.id)
        .then(setRequestClientId)
        .catch(() => setRequestClientId(null));
      listLessonSessionsForRequest(row.id)
        .then(setRequestSessions)
        .catch(() => setRequestSessions([]));
    }
  };

  const closeDrawer = () => {
    setSelected(null);
    setActionError(null);
  };

  const addNote = useAsync(appendRequestNote);
  const handleAddNote = async () => {
    if (!selected || !noteText.trim()) return;
    setActionError(null);
    try {
      const timeline = await addNote.run(selected.id, noteText.trim());
      setSelected((prev) => (prev ? { ...prev, staff_notes: timeline } : prev));
      setNoteText('');
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not add the note.'));
    }
  };

  const saveChecklist = useAsync(setRequestChecklist);
  const handleToggleItem = async (key: string) => {
    if (!selected) return;
    setActionError(null);
    const next = { ...checklist, [key]: !checklist[key] };
    setChecklist(next); // optimistic; a failed save surfaces below
    try {
      await saveChecklist.run(selected.id, next);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not save the checklist.'));
    }
  };

  const contact = useAsync(markRequestContacted);
  const handleMarkContacted = async () => {
    if (!selected) return;
    setActionError(null);
    try {
      await contact.run(selected.id);
      setSelected((prev) => (prev ? { ...prev, status: 'contacted' } : prev));
      toast.success('Request marked contacted.');
      await refresh(statusFilter);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not update the request.'));
    }
  };

  const scheduleSession = useAsync(scheduleLessonSession);
  const handleScheduleLesson = async (values: ScheduleSessionFormValues) => {
    if (!selected) return;
    setActionError(null);
    try {
      await scheduleSession.run({ ...values, request_id: selected.id });
      toast.success('Lesson scheduled — the request is converted.');
      // The RPC flipped the request server-side; mirror it locally + refresh.
      setSelected((prev) => (prev ? { ...prev, status: 'converted' } : prev));
      setRequestSessions(await listLessonSessionsForRequest(selected.id).catch(() => []));
      await refresh(statusFilter);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not schedule the lesson.'));
    }
  };

  useEffect(() => {
    if (!openId || autoOpened === openId) return;
    const row = rows.find((r) => r.id === openId);
    if (row) { setAutoOpened(openId); openRequest(row); }
  }, [openId, rows, autoOpened]);

  const busy = addNote.isPending || contact.isPending;
  const allChecked = LESSON_FIT_CHECKLIST.every((item) => checklist[item.key] === true);
  const own = selected ? visitorNotes(selected.notes) : null;

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

      {toast.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`mb-4 rounded px-4 py-2 text-sm ${
            t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
          }`}
        >
          {t.message}
        </div>
      ))}

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
        onRowClick={openRequest}
      />

      <Modal
        open={selected !== null}
        onClose={closeDrawer}
        title="Booking request"
        disableBackdropClose={busy}
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-sans font-medium text-green-900">{selected.contact_name}</p>
                <p className="text-xs text-green-800/70">
                  {selected.contact_email}
                  {selected.contact_phone ? ` · ${selected.contact_phone}` : ''}
                </p>
                {selected.contact_method && (
                  <p className="text-xs text-green-800/70 mt-1">
                    Prefers: {CONTACT_METHOD_LABEL[selected.contact_method]}
                  </p>
                )}
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <section aria-label="Requested items">
              <h3 className="form-label mb-2">Requested</h3>
              <p className="text-sm text-green-900">{requestedSummary(selected)}</p>
            </section>

            {selected.details && Object.keys(selected.details).length > 0 && (
              <section aria-label="Details">
                <h3 className="form-label mb-2">Details</h3>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                  {Object.entries(selected.details).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-green-800/70">{categoryFieldLabel(k)}</dt>
                      <dd className="text-green-900">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <AvailabilitySection request={selected} />

            <section aria-label="Visitor notes">
              <h3 className="form-label mb-2">Visitor notes</h3>
              {own ? (
                <p className="text-sm text-green-900 whitespace-pre-wrap">{own}</p>
              ) : (
                <p className="text-sm text-green-800/70">No notes from the visitor.</p>
              )}
            </section>

            <section aria-label="Staff notes">
              <h3 className="form-label mb-2">Staff notes</h3>
              {selected.staff_notes.length === 0 ? (
                <p className="text-sm text-green-800/70">No notes yet.</p>
              ) : (
                <ol className="flex flex-col gap-2">
                  {selected.staff_notes.map((n, i) => (
                    <li key={`${n.at}-${i}`} className="border-l-2 border-green-800/15 pl-3">
                      <p className="text-xs text-green-800/70">
                        {new Date(n.at).toLocaleString()} · {n.by_name}
                      </p>
                      <p className="text-sm text-green-900 whitespace-pre-wrap">{n.note}</p>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-3 flex gap-2 items-end">
                <div className="flex-1">
                  <label htmlFor="request-note" className="sr-only">
                    Add a note
                  </label>
                  <textarea
                    id="request-note"
                    rows={2}
                    className="form-input resize-none"
                    placeholder="Log a call note…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-outline-gold text-sm"
                  disabled={addNote.isPending || !noteText.trim()}
                  aria-busy={addNote.isPending}
                  onClick={handleAddNote}
                >
                  Add note
                </button>
              </div>
            </section>

            <section aria-label="Lesson fit checklist">
              <h3 className="form-label mb-2">Lesson fit checklist</h3>
              <ul className="flex flex-col gap-1.5">
                {LESSON_FIT_CHECKLIST.map((item) => (
                  <li key={item.key}>
                    <label className="flex items-center gap-2 text-sm text-green-900">
                      <input
                        type="checkbox"
                        className="accent-green-800"
                        checked={checklist[item.key] === true}
                        onChange={() => handleToggleItem(item.key)}
                      />
                      {item.label}
                    </label>
                  </li>
                ))}
              </ul>
            </section>

            {/* Schedule lesson — the invited/converted request gets its real
                date/time booked here (schedule_lesson_session RPC: overlap
                rejection, request → converted, member notified). */}
            {(selected.status === 'invited' || selected.status === 'converted') && (
              <section aria-label="Schedule lesson" className="border-t border-green-800/10 pt-4">
                <h3 className="form-label mb-2">Schedule lesson</h3>
                {requestSessions.length > 0 && (
                  <ul className="flex flex-col gap-1.5 mb-4" data-testid="request-sessions">
                    {requestSessions.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-3 text-sm text-green-900"
                      >
                        <span>{formatSessionWhen(s.starts_at, s.ends_at, s.location)}</span>
                        <StatusBadge status={s.status} />
                      </li>
                    ))}
                  </ul>
                )}
                {requestClientId ? (
                  <ScheduleSessionForm
                    fixedClientId={requestClientId}
                    horses={horses}
                    onSubmit={handleScheduleLesson}
                    submitting={scheduleSession.isPending}
                  />
                ) : (
                  <p className="text-sm text-green-800/70">
                    No provisioned client found for this request yet — the booking
                    form appears once the invitation has provisioned one.
                  </p>
                )}
              </section>
            )}

            {actionError && (
              <p role="alert" className="form-error">
                {actionError}
              </p>
            )}

            {inviteResult && (
              <div className="bg-green-50 border border-green-200 p-4 text-sm">
                <p className="text-green-800 mb-2">
                  {inviteResult.offeringLabel
                    ? `${inviteResult.offeringLabel} provisioned — invitation created`
                    : 'Invitation created'}
                  {inviteResult.emailed
                    ? ' and emailed.'
                    : '. (Email provider not configured — copy the link below.)'}
                </p>
                <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2">
                  {inviteResult.url}
                </code>
              </div>
            )}

            {!inviteResult && (
              <div className="flex flex-wrap justify-end gap-3">
                {selected.status === 'new' && (
                  <button
                    type="button"
                    className="btn-outline-gold text-sm"
                    disabled={busy}
                    aria-busy={contact.isPending}
                    onClick={handleMarkContacted}
                  >
                    Mark contacted
                  </button>
                )}
                {selected.status !== 'invited' && !inviteOpen && (
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={!allChecked || busy}
                    title={
                      allChecked
                        ? 'Open the confirmation & invitation form'
                        : 'Complete the lesson fit checklist to enable sending'
                    }
                    onClick={() => setInviteOpen(true)}
                  >
                    Send confirmation &amp; invite
                  </button>
                )}
              </div>
            )}

            {inviteOpen && !inviteResult && invite && (
              <div className="border-t border-green-800/10 pt-4">
                <p className="body-text text-sm mb-4">
                  Provision what they bought and email the registration invitation — their account
                  opens straight into onboarding with the paperwork ready to sign.
                </p>
                {/* The ONE shared provision form (source='submission'): carries the
                    request id (links + flips to invited) and the visitor's name. */}
                <ProvisionClientForm
                  source="submission"
                  requestId={selected.id}
                  email={invite.email}
                  firstName={invite.firstName}
                  lastName={invite.lastName}
                  onProvisioned={(r) => {
                    setInviteResult({ url: r.registerUrl, emailed: r.emailed, offeringLabel: r.offeringLabel ?? undefined });
                    setSelected((prev) => (prev ? { ...prev, status: 'invited' } : prev));
                    void refresh(statusFilter);
                    toast.success('Confirmation sent — invitation created.');
                  }}
                />
                <div className="flex justify-end mt-3">
                  <button type="button" className="btn-outline-gold text-sm" onClick={() => setInviteOpen(false)}>
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
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

      {stale.length > 0 && (
        <div className="rounded-xl border border-green-800/15 bg-cream-100/60 p-4">
          <p className="text-sm font-medium text-green-900 mb-1">
            {stale.length} already handled, still marked new
          </p>
          <p className="text-[12.5px] text-green-800/80">
            These people are already clients — the work is done, the row was never
            closed. Clearing them keeps the queue honest.
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

export default IntakePage;
