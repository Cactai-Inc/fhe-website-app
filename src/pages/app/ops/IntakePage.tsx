/**
 * OPS-INTAKE — staff intake surfaces (surface `ops`, core — ungated).
 *
 * /app/ops/intake carries two queues behind one route:
 *
 * 1. BOOKING REQUESTS (default view) — the Request Inbox of BOOKING_FLOWS_PLAN
 *    §2 Flow A step 2. Rows from the public "Submit a Booking Request" form
 *    (requests table) filtered by status tab (New default). A row opens the
 *    working drawer: contact + requested items, the structured availability
 *    (weeks / day prefs / AM-PM prefs / riding experience / visitor notes),
 *    the staff call-notes timeline (append_request_note RPC), the LESSON FIT
 *    CHECKLIST (set_request_checklist RPC), "Mark contacted", and the
 *    checklist-gated "Send confirmation & invite" provisioning form that
 *    submits to /api/admin-send-invitation with requestId — server-side the
 *    RPC stamps invitations.request_id and flips the request to 'invited'.
 *
 * 2. FORM SUBMISSIONS — the intake_submissions queue (unchanged behavior):
 *    listIntakeSubmissions filtered by status (NEW default). Clicking a row
 *    opens a detail drawer that renders the submission's payload fields plus
 *    the actions:
 *      - Mark reviewed / Dismiss  → markSubmissionStatus(id, status)
 *    (Brokerage lead conversion retired with the deal-wizard teardown — deals
 *    now start from a contract; a brokerage lead is provisioned/invited instead.)
 */
import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { DataTable, FormField, Modal, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listIntakeSubmissions,
  markSubmissionStatus,
  findClientForRequest,
  listBookingRequests,
  markRequestContacted,
  appendRequestNote,
  setRequestChecklist,
} from '../../../lib/ops/api-intake';
import {
  scheduleLessonSession,
  listLessonSessionsForRequest,
} from '../../../lib/ops/api-lessons';
import type { LessonSession } from '../../../lib/ops/api-lessons';
import { ScheduleSessionForm } from './lessons/ScheduleSessionForm';
import type { ScheduleSessionFormValues } from './lessons/ScheduleSessionForm';
import type {
  IntakeSubmission,
  IntakeSubmissionStatus,
  BookingRequest,
  BookingRequestStatus,
} from '../../../lib/ops/api-intake';
import { fetchOfferings } from '../../../lib/api';
import { adminSendInvitation } from '../../../lib/admin';
import { listSupportRequests, setSupportStatus, type SupportRequest } from '../../../lib/support';
import type { Offering, ProposedTime } from '../../../lib/types';

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

const PAYMENT_METHODS = ['Zelle', 'Cash', 'Card', 'Other'];

/** "$500" / "$587.50" for the offering select labels (mirrors Admin InviteTab). */
function formatTierPrice(amount: number | null): string {
  if (amount == null) return '';
  return `$${Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(Number(amount)) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

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

interface InviteFormState {
  firstName: string;
  lastName: string;
  email: string;
  offeringId: string;
  markPaid: boolean;
  paymentMethod: string;
  notes: string;
}

function inviteFormFor(r: BookingRequest): InviteFormState {
  const { firstName, lastName } = splitContactName(r.contact_name);
  return {
    firstName,
    lastName,
    email: r.contact_email,
    offeringId: '',
    markPaid: false,
    paymentMethod: 'Zelle',
    notes: r.notes?.trim() ?? '',
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
  const [offerings, setOfferings] = useState<Offering[]>([]);
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

  // Flat riding-lesson offerings for the provisioning select (mirrors Admin InviteTab).
  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.horse_included !== null)))
      .catch(() => setOfferings([]));
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

  const send = useAsync(adminSendInvitation);
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !invite) return;
    setActionError(null);
    try {
      const r = await send.run({
        email: invite.email.trim(),
        requestId: selected.id,
        firstName: invite.firstName.trim(),
        lastName: invite.lastName.trim(),
        offeringId: invite.offeringId,
        markPaid: invite.markPaid,
        ...(invite.markPaid ? { paymentMethod: invite.paymentMethod } : {}),
        ...(invite.notes.trim() ? { notes: invite.notes.trim() } : {}),
      });
      setInviteResult({ url: r.registerUrl, emailed: r.emailed, offeringLabel: r.offeringLabel });
      // The RPC flipped the request server-side; mirror it locally + refresh.
      setSelected((prev) => (prev ? { ...prev, status: 'invited' } : prev));
      setInviteOpen(false);
      toast.success('Confirmation sent — invitation created.');
      await refresh(statusFilter);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not send the invitation.'));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, rows, autoOpened]);

  const busy = addNote.isPending || contact.isPending || send.isPending;
  const allChecked = LESSON_FIT_CHECKLIST.every((item) => checklist[item.key] === true);
  const inviteReady =
    invite !== null &&
    invite.offeringId !== '' &&
    invite.email.trim() !== '' &&
    invite.firstName.trim() !== '' &&
    invite.lastName.trim() !== '';
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
                        <span>
                          {new Date(s.starts_at).toLocaleString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                          {s.location ? ` · ${s.location}` : ''}
                        </span>
                        <StatusBadge status={s.status} />
                      </li>
                    ))}
                  </ul>
                )}
                {requestClientId ? (
                  <ScheduleSessionForm
                    fixedClientId={requestClientId}
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
              <form
                onSubmit={handleSendInvite}
                aria-label="Send confirmation & invite"
                className="border-t border-green-800/10 pt-4"
              >
                <p className="body-text text-sm mb-4">
                  Provision what they bought and email the registration invitation — their account
                  opens straight into onboarding with the paperwork ready to sign.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="First name" required>
                    {({ id }) => (
                      <input
                        id={id}
                        className="form-input"
                        required
                        value={invite.firstName}
                        onChange={(e) => setInvite({ ...invite, firstName: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label="Last name" required>
                    {({ id }) => (
                      <input
                        id={id}
                        className="form-input"
                        required
                        value={invite.lastName}
                        onChange={(e) => setInvite({ ...invite, lastName: e.target.value })}
                      />
                    )}
                  </FormField>
                </div>
                <FormField label="Email" required>
                  {({ id }) => (
                    <input
                      id={id}
                      type="email"
                      className="form-input"
                      required
                      value={invite.email}
                      onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                    />
                  )}
                </FormField>
                <FormField label="What did they buy?" required>
                  {({ id }) => (
                    <select
                      id={id}
                      className="form-input"
                      required
                      value={invite.offeringId}
                      onChange={(e) => setInvite({ ...invite, offeringId: e.target.value })}
                    >
                      <option value="">Select a lesson…</option>
                      {offerings.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} — {formatTierPrice(o.price_amount)}
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>
                <label className="flex items-center gap-2 mb-4 text-sm text-secondary">
                  <input
                    type="checkbox"
                    checked={invite.markPaid}
                    onChange={(e) => setInvite({ ...invite, markPaid: e.target.checked })}
                    className="accent-green-800"
                  />
                  Already paid
                </label>
                {invite.markPaid && (
                  <FormField label="Payment method">
                    {({ id }) => (
                      <select
                        id={id}
                        className="form-input"
                        value={invite.paymentMethod}
                        onChange={(e) => setInvite({ ...invite, paymentMethod: e.target.value })}
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                )}
                <FormField label="Notes (optional)">
                  {({ id }) => (
                    <textarea
                      id={id}
                      rows={3}
                      className="form-input resize-none"
                      value={invite.notes}
                      onChange={(e) => setInvite({ ...invite, notes: e.target.value })}
                    />
                  )}
                </FormField>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    className="btn-outline-gold text-sm"
                    disabled={send.isPending}
                    onClick={() => setInviteOpen(false)}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="btn-primary text-sm"
                    disabled={send.isPending || !inviteReady}
                    aria-busy={send.isPending}
                  >
                    {send.isPending ? 'Sending…' : 'Send invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Form submissions — the intake_submissions queue (behavior unchanged)
// ════════════════════════════════════════════════════════════════════════════

type StatusFilter = IntakeSubmissionStatus | 'ALL';

const STATUS_FILTERS: StatusFilter[] = ['NEW', 'REVIEWED', 'CONVERTED', 'DISMISSED', 'ALL'];

/** Best-available display name for the submitter (drawer + contact creation). */
function submitterName(sub: IntakeSubmission): string {
  if (sub.contact_name) return sub.contact_name;
  const fromPayload =
    sub.payload['full_legal_name'] ?? sub.payload['full_name'] ?? sub.payload['client_name'];
  if (typeof fromPayload === 'string' && fromPayload.trim()) return fromPayload;
  return 'Intake contact';
}

function payloadValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const COLUMNS: Column<IntakeSubmission>[] = [
  {
    key: 'created_at',
    header: 'Received',
    render: (r) => new Date(r.created_at).toLocaleDateString(),
  },
  { key: 'form_key', header: 'Form', render: (r) => <span className="font-mono text-xs">{r.form_key}</span> },
  { key: 'contact_name', header: 'Name', render: (r) => submitterName(r) },
  { key: 'contact_email', header: 'Email', render: (r) => r.contact_email ?? '—' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

function SubmissionsQueue({ openId }: { openId?: string } = {}) {
  const [autoOpenedSub, setAutoOpenedSub] = useState<string | null>(null);
  const [rows, setRows] = useState<IntakeSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('NEW');
  const [selected, setSelected] = useState<IntakeSubmission | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useAsync(listIntakeSubmissions);
  const toast = useToast();

  useEffect(() => {
    if (!openId || autoOpenedSub === openId) return;
    const row = rows.find((r) => r.id === openId);
    if (row) { setAutoOpenedSub(openId); setActionError(null); setSelected(row); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, rows, autoOpenedSub]);

  const refresh = useCallback(
    async (filter: StatusFilter) => {
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

  const review = useAsync(async (sub: IntakeSubmission, status: 'REVIEWED' | 'DISMISSED') => {
    return markSubmissionStatus(sub.id, status);
  });

  const closeDrawer = () => {
    setActionError(null);
    setSelected(null);
  };

  const handleReview = async (sub: IntakeSubmission, status: 'REVIEWED' | 'DISMISSED') => {
    setActionError(null);
    try {
      await review.run(sub, status);
      toast.success(status === 'REVIEWED' ? 'Submission marked reviewed.' : 'Submission dismissed.');
      setSelected(null);
      await refresh(statusFilter);
    } catch (err) {
      // Error branch: keep the drawer open, surface the message.
      setActionError(toErrorMessage(err, 'Could not update submission.'));
    }
  };

  const busy = review.isPending;
  const actionable = selected !== null && (selected.status === 'NEW' || selected.status === 'REVIEWED');

  return (
    <div>
      <div className="flex justify-end mb-4">
        <div>
          <label htmlFor="intake-status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="intake-status-filter"
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s}
              </option>
            ))}
          </select>
        </div>
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
          {load.error?.message ?? 'Could not load intake submissions.'}
        </p>
      )}

      <DataTable
        columns={COLUMNS}
        rows={rows}
        loading={load.isPending && rows.length === 0}
        rowKey={(r) => r.id}
        emptyTitle="No submissions"
        emptyMessage="Nothing in the intake queue for this status."
        onRowClick={(row) => {
          setActionError(null);
          setSelected(row);
        }}
      />

      <Modal
        open={selected !== null}
        onClose={closeDrawer}
        title="Intake submission"
        disableBackdropClose={busy}
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-sans font-medium text-green-900">
                  {submitterName(selected)}
                </p>
                <p className="text-xs text-green-800/70">{selected.contact_email ?? 'No email'}</p>
                <p className="font-mono text-xs text-green-800/70 mt-1">{selected.form_key}</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>

            <section aria-label="Submission fields">
              <h3 className="form-label mb-2">Submitted fields</h3>
              {Object.keys(selected.payload).length === 0 ? (
                <p className="text-sm text-green-800/70">No fields submitted.</p>
              ) : (
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {Object.entries(selected.payload).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs font-sans font-medium text-green-800/70">{key}</dt>
                      <dd className="text-sm text-green-900">{payloadValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {actionError && (
              <p role="alert" className="form-error">
                {actionError}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-3">
              {actionable && (
                <>
                  {selected.status === 'NEW' && (
                    <button
                      type="button"
                      className="btn-outline-gold text-sm"
                      disabled={busy}
                      onClick={() => handleReview(selected, 'REVIEWED')}
                    >
                      Mark reviewed
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-outline-gold text-sm"
                    disabled={busy}
                    onClick={() => handleReview(selected, 'DISMISSED')}
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Page shell — Request Inbox first, form submissions alongside
// ════════════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════════
// INBOUND — one chronological list of everything sent to the company (owner
// unification): booking/purchase requests (the `requests` lifecycle pipeline),
// form submissions (the `intake_submissions` lead queue — contact-us et al.),
// and support requests. The old two-tab duality is gone; the KIND filter is
// buttons on desktop, a dropdown on mobile. Selecting a booking or form row
// drops into its existing full workflow (auto-opened); support resolves inline.
// ════════════════════════════════════════════════════════════════════════════

type InboundKind = 'all' | 'booking' | 'form' | 'support';

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
  booking: 'Booking request', form: 'Form submission', support: 'Support',
};
const KIND_FILTERS: { id: InboundKind; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'booking', label: 'Booking requests' },
  { id: 'form', label: 'Form submissions' },
  { id: 'support', label: 'Support' },
];

export function IntakePage() {
  useDocumentTitle('Inbound');
  const [kind, setKind] = useState<InboundKind>('all');
  const [rows, setRows] = useState<InboundRow[] | null>(null);
  const [inboundError, setInboundError] = useState<string | null>(null);
  // focus = drop into the existing deep workflow for one item
  const [focus, setFocus] = useState<{ kind: 'booking' | 'form'; id: string } | null>(null);
  const [supportOpen, setSupportOpen] = useState<string | null>(null);
  const [supportRows, setSupportRows] = useState<SupportRequest[]>([]);

  const loadInbound = useCallback(async () => {
    try {
      const [requests, submissions, support] = await Promise.all([
        listBookingRequests().catch(() => [] as BookingRequest[]),
        listIntakeSubmissions().catch(() => [] as IntakeSubmission[]),
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
        ...submissions.map((f) => ({
          key: `f-${f.id}`, kind: 'form' as const, when: f.created_at,
          who: f.contact_name || f.contact_email || 'Visitor',
          what: (f.form_key || 'Form').replace(/^INTAKE_/, '').replace(/_/g, ' ').toLowerCase(),
          status: f.status, refId: f.id,
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
  if (focus?.kind === 'form') {
    return (
      <div className="max-w-5xl">
        <button type="button" onClick={() => { setFocus(null); void loadInbound(); }}
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
          ← Inbound
        </button>
        <h1 className="font-serif text-2xl text-green-900 mb-6">Form submission</h1>
        <SubmissionsQueue openId={focus.id} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Inbound</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Everything sent to the company — booking requests, form submissions, and
        support — newest first.
      </p>

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
