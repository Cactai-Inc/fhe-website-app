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
 *      - Convert to engagement    → (brokerage form_keys only) resolve the
 *        contact (findOrCreateContactByEmail), open the engagement through the
 *        REAL brokerage RPC wrappers in src/lib/api.ts, then stamp CONVERTED +
 *        converted_engagement_id via markSubmissionConverted.
 *    The brokerage RPCs self-gate on mod.brokerage server-side (require_module);
 *    a gate rejection surfaces on the drawer's error branch — nothing is faked.
 */
import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Link } from 'react-router-dom';
import { DataTable, FormField, Modal, StatusBadge, useAsync, useToast } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listIntakeSubmissions,
  markSubmissionStatus,
  markSubmissionConverted,
  findOrCreateContactByEmail,
  listBookingRequests,
  markRequestContacted,
  appendRequestNote,
  setRequestChecklist,
} from '../../../lib/ops/api-intake';
import type {
  IntakeSubmission,
  IntakeSubmissionStatus,
  BookingRequest,
  BookingRequestStatus,
} from '../../../lib/ops/api-intake';
import {
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
  fetchOfferings,
} from '../../../lib/api';
import { adminSendInvitation } from '../../../lib/admin';
import type { OfferingTier, ProposedTime } from '../../../lib/types';

// ════════════════════════════════════════════════════════════════════════════
// Booking requests — the Request Inbox (Flow A step 2)
// ════════════════════════════════════════════════════════════════════════════

type RequestFilter = BookingRequestStatus | 'ALL';

const REQUEST_FILTERS: { id: RequestFilter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'invited', label: 'Invited' },
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

/** "$500" / "$587.50" for the tier select labels (mirrors Admin InviteTab). */
function formatTierPrice(amount: number): string {
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
  tierId: string;
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
    tierId: '',
    markPaid: false,
    paymentMethod: 'Zelle',
    notes: r.notes?.trim() ?? '',
  };
}

function RequestInbox() {
  const [rows, setRows] = useState<BookingRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<RequestFilter>('new');
  const [selected, setSelected] = useState<BookingRequest | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteFormState | null>(null);
  const [inviteResult, setInviteResult] = useState<{
    url: string; emailed: boolean; tierLabel?: string;
  } | null>(null);
  const [tiers, setTiers] = useState<OfferingTier[]>([]);

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

  // Riding-lesson tiers for the provisioning select (mirrors Admin InviteTab).
  useEffect(() => {
    fetchOfferings()
      .then((offerings) => setTiers(offerings.find((o) => o.slug === 'riding-lesson')?.tiers ?? []))
      .catch(() => setTiers([]));
  }, []);

  const openRequest = (row: BookingRequest) => {
    setSelected(row);
    setChecklist(row.checklist ?? {});
    setNoteText('');
    setInviteOpen(false);
    setInvite(inviteFormFor(row));
    setInviteResult(null);
    setActionError(null);
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
        tierId: invite.tierId,
        markPaid: invite.markPaid,
        ...(invite.markPaid ? { paymentMethod: invite.paymentMethod } : {}),
        ...(invite.notes.trim() ? { notes: invite.notes.trim() } : {}),
      });
      setInviteResult({ url: r.registerUrl, emailed: r.emailed, tierLabel: r.tierLabel });
      // The RPC flipped the request server-side; mirror it locally + refresh.
      setSelected((prev) => (prev ? { ...prev, status: 'invited' } : prev));
      setInviteOpen(false);
      toast.success('Confirmation sent — invitation created.');
      await refresh(statusFilter);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not send the invitation.'));
    }
  };

  const busy = addNote.isPending || contact.isPending || send.isPending;
  const allChecked = LESSON_FIT_CHECKLIST.every((item) => checklist[item.key] === true);
  const inviteReady =
    invite !== null &&
    invite.tierId !== '' &&
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

            {actionError && (
              <p role="alert" className="form-error">
                {actionError}
              </p>
            )}

            {inviteResult && (
              <div className="bg-green-50 border border-green-200 p-4 text-sm">
                <p className="text-green-800 mb-2">
                  {inviteResult.tierLabel
                    ? `${inviteResult.tierLabel} provisioned — invitation created`
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
                      value={invite.tierId}
                      onChange={(e) => setInvite({ ...invite, tierId: e.target.value })}
                    >
                      <option value="">Select a lesson tier…</option>
                      {tiers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label} — {formatTierPrice(t.price_amount)}
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

/**
 * Brokerage form_key → engagement RPC wrapper. Direction (retained_by /
 * deal_side) is token-driven per form (§7.1) — never hard-coded per document.
 * Non-brokerage intake forms have no conversion path (the button is not
 * rendered for them).
 */
const BROKERAGE_CONVERSIONS: Record<string, (contactId: string) => Promise<string>> = {
  INTAKE_HORSE_PURCHASE: (contactId) => createPurchaseEngagement({ buyerContactId: contactId }),
  INTAKE_HORSE_FINDER: (contactId) =>
    createSearchEngagement({ clientContactId: contactId, retainedBy: 'buyer', dealSide: 'BUY' }),
  INTAKE_HORSE_SALE: (contactId) =>
    createSearchEngagement({ clientContactId: contactId, retainedBy: 'owner', dealSide: 'SELL' }),
  INTAKE_HORSE_LEASE_IN: (contactId) =>
    createLeaseEngagement({ clientContactId: contactId, dealSide: 'LEASE_IN' }),
  INTAKE_HORSE_LEASE_OUT: (contactId) =>
    createLeaseEngagement({ clientContactId: contactId, dealSide: 'LEASE_OUT' }),
};

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

function SubmissionsQueue() {
  const [rows, setRows] = useState<IntakeSubmission[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('NEW');
  const [selected, setSelected] = useState<IntakeSubmission | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useAsync(listIntakeSubmissions);
  const toast = useToast();

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

  const convert = useAsync(async (sub: IntakeSubmission) => {
    const toEngagement = BROKERAGE_CONVERSIONS[sub.form_key];
    if (!toEngagement) {
      throw new Error(`No engagement conversion is defined for ${sub.form_key}.`);
    }
    const contactId = await findOrCreateContactByEmail(submitterName(sub), sub.contact_email);
    const engagementId = await toEngagement(contactId);
    await markSubmissionConverted(sub.id, engagementId);
    return engagementId;
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

  const handleConvert = async (sub: IntakeSubmission) => {
    setActionError(null);
    try {
      const engagementId = await convert.run(sub);
      toast.success(`Converted to engagement ${engagementId.slice(0, 8)}.`);
      setSelected(null);
      await refresh(statusFilter);
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not convert submission.'));
    }
  };

  const busy = review.isPending || convert.isPending;
  const convertible =
    selected !== null &&
    BROKERAGE_CONVERSIONS[selected.form_key] !== undefined &&
    (selected.status === 'NEW' || selected.status === 'REVIEWED');
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

            {selected.converted_engagement_id && (
              <p className="text-sm">
                <Link
                  to={`/app/ops/engagements/${selected.converted_engagement_id}`}
                  className="link-underline"
                >
                  View converted engagement
                </Link>
              </p>
            )}

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
              {convertible && (
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={busy}
                  aria-busy={convert.isPending}
                  onClick={() => handleConvert(selected)}
                >
                  {convert.isPending ? 'Converting…' : 'Convert to engagement'}
                </button>
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

type IntakeView = 'requests' | 'submissions';

const VIEWS: { id: IntakeView; label: string }[] = [
  { id: 'requests', label: 'Booking requests' },
  { id: 'submissions', label: 'Form submissions' },
];

export function IntakePage() {
  useDocumentTitle('Intake');
  const [view, setView] = useState<IntakeView>('requests');

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif text-2xl text-green-900 mb-6">Intake</h1>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-green-800/10">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`px-4 py-2 text-sm font-sans -mb-px border-b-2 transition-colors focus-ring ${
              view === v.id
                ? 'border-green-800 text-green-800 font-medium'
                : 'border-transparent text-muted hover:text-green-800'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'requests' ? <RequestInbox /> : <SubmissionsQueue />}
    </div>
  );
}

export default IntakePage;
