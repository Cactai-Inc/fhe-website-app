/**
 * LEAD WORK DRAWER — everything staff can do to one inbound lead, in one place.
 *
 * This is the working machinery that used to live inside `ops/IntakePage.tsx`'s
 * RequestInbox: the contact and what they asked for, the structured availability,
 * the staff call-notes timeline (append_request_note), the LESSON FIT CHECKLIST
 * (set_request_checklist), "Mark contacted", "Send as gift" (GiftCreateForm), the
 * checklist-gated "Send confirmation & invite" (ProvisionClientForm), and — once
 * a client has been provisioned — the schedule-a-lesson path
 * (findClientForRequest → ScheduleSessionForm → schedule_lesson_session).
 *
 * It was EXTRACTED rather than copied (TASK-LEADCLEAN). The Inbound page is
 * retired, but none of this is: the dashboard's lead card opens the same
 * component, so there is exactly one implementation of "work a lead" and
 * retiring a page cannot quietly cost the product a capability.
 */
import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import { Modal, StatusBadge, useAsync, useToast } from '../../lib/ops';
import {
  findClientForRequest,
  markRequestContacted,
  appendRequestNote,
  setRequestChecklist,
  listRequestCategories,
  type BookingRequest,
  type RequestCategoryRow,
} from '../../lib/ops/api-intake';
import {
  scheduleLessonSession,
  listLessonSessionsForRequest,
  listScheduleHorses,
} from '../../lib/ops/api-lessons';
import type { LessonSession, ScheduleHorseOption } from '../../lib/ops/api-lessons';
import { formatSessionWhen } from '../../lib/formatDateTime';
import { categoryFieldLabel, requestCategoryLabel } from '../../lib/intakeCategoryFields';
import { ScheduleSessionForm } from '../../pages/app/ops/lessons/ScheduleSessionForm';
import type { ScheduleSessionFormValues } from '../../pages/app/ops/lessons/ScheduleSessionForm';
import { ProvisionClientForm } from './ProvisionClientForm';
import { LeadOrderPanel } from './LeadOrderPanel';
import { GiftCreateForm } from './GiftCreateForm';
import { AgreedLessonPanel, agreedLessonFrom } from './AgreedLessonPanel';
import { emptySessionFields, type SessionFieldsValue } from './SessionFields';
import { useAuth } from '../../contexts/AuthContext';
import type { ProposedTime } from '../../lib/types';

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

export const CONTACT_METHOD_LABEL: Record<string, string> = {
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
export function requestedSummary(r: BookingRequest): string {
  const labels = (r.request_selections ?? [])
    .map((s) => s.label ?? s.offering_slug)
    .filter((l): l is string => Boolean(l));
  return labels.length > 0 ? labels.join('; ') : '—';
}

/** CATEGORISE §6 — the derived category membership of one inquiry, in words.
 *
 *  Reads `request_categories` (the plural derivation), never `requests.category`
 *  (the single funnel-chosen value). Renders nothing at all when the derivation
 *  has nothing to say, rather than a row of empty furniture. */
function RequestCategoriesLine({ requestId }: { requestId: string }) {
  const [cats, setCats] = useState<RequestCategoryRow[]>([]);
  useEffect(() => {
    let active = true;
    listRequestCategories()
      .then((m) => { if (active) setCats(m.get(requestId) ?? []); })
      .catch(() => { /* the summary above is still the truth */ });
    return () => { active = false; };
  }, [requestId]);
  if (cats.length === 0) return null;
  return (
    <p className="text-xs text-green-800/70 mt-1.5">
      Categories:{' '}
      {cats.map((c, i) => (
        <span key={c.category}>
          {i > 0 ? ' · ' : ''}
          <span className="text-green-900">{requestCategoryLabel(c.category)}</span>
          <span className="text-green-800/60">
            {c.from_cart ? ' (from what they asked for)' : ' (from the page they came from)'}
          </span>
        </span>
      ))}
    </p>
  );
}

/** First-space split of the freeform contact_name (same rule as contact heal). */
function splitContactName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceAt = trimmed.indexOf(' ');
  if (spaceAt <= 0) return { firstName: trimmed, lastName: '' };
  return { firstName: trimmed.slice(0, spaceAt), lastName: trimmed.slice(spaceAt + 1).trim() };
}

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

export interface LeadWorkDrawerProps {
  /** The lead being worked. Changing its id resets the drawer. */
  request: BookingRequest;
  onClose: () => void;
  /** Fires after anything the host's list would render differently. */
  onChanged?: () => void;
}

export function LeadWorkDrawer({ request, onClose, onChanged }: LeadWorkDrawerProps) {
  // A local copy so the drawer's own buttons react to a status change without
  // waiting for the host to re-fetch; the host is told separately via onChanged.
  const [selected, setSelected] = useState<BookingRequest>(request);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>(request.checklist ?? {});
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState<InviteFormState>(() => inviteFormFor(request));
  const [inviteResult, setInviteResult] = useState<{
    url: string; emailed: boolean; offeringLabel?: string;
    /** §L3 — set iff the act reported it actually booked the lesson. */
    agreedSlot?: string;
  } | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [horses, setHorses] = useState<ScheduleHorseOption[]>([]);
  // Schedule-lesson section (invited/converted requests): the provisioned
  // client resolved via request → invitation → email → contact → client, plus
  // the sessions already booked from this request.
  const [requestClientId, setRequestClientId] = useState<string | null>(null);
  const [requestSessions, setRequestSessions] = useState<LessonSession[]>([]);
  // LESSONREQUEST §L3 — the slot agreed on the call. Held HERE rather than
  // inside ProvisionClientForm so the ranges the visitor gave can sit beside
  // the picker; the form only carries it into the one act.
  const [agreedFields, setAgreedFields] = useState<SessionFieldsValue>(emptySessionFields);

  const toast = useToast();
  const { user } = useAuth();

  // Reset when the host swaps in a different lead (same mount, new row).
  useEffect(() => {
    setSelected(request);
    setChecklist(request.checklist ?? {});
    setInvite(inviteFormFor(request));
    setNoteText('');
    setInviteOpen(false);
    setInviteResult(null);
    setGiftOpen(false);
    setActionError(null);
    setRequestClientId(null);
    setRequestSessions([]);
    setAgreedFields(emptySessionFields());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  // The provisioned client + already-booked sessions, once there is an
  // invitation to walk. Only invited/converted rows can have one.
  const scheduleReady = selected.status === 'invited' || selected.status === 'converted';
  useEffect(() => {
    if (!scheduleReady) return;
    let active = true;
    findClientForRequest(selected.id)
      .then((id) => { if (active) setRequestClientId(id); })
      .catch(() => { if (active) setRequestClientId(null); });
    listLessonSessionsForRequest(selected.id)
      .then((s) => { if (active) setRequestSessions(s); })
      .catch(() => { if (active) setRequestSessions([]); });
    return () => { active = false; };
  }, [scheduleReady, selected.id]);

  // The horse roster is needed BEFORE provisioning now — §L3's agreed-time
  // panel offers it on the pre-invitation path, where `scheduleReady` is false
  // by definition. Fetched once per open drawer rather than per section.
  useEffect(() => {
    let active = true;
    listScheduleHorses()
      .then((h) => { if (active) setHorses(h); })
      .catch(() => { if (active) setHorses([]); });
    return () => { active = false; };
  }, []);

  const changed = useCallback((next: BookingRequest) => {
    setSelected(next);
    onChanged?.();
  }, [onChanged]);

  const addNote = useAsync(appendRequestNote);
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setActionError(null);
    try {
      const timeline = await addNote.run(selected.id, noteText.trim());
      setSelected((prev) => ({ ...prev, staff_notes: timeline }));
      setNoteText('');
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not add the note.'));
    }
  };

  const saveChecklist = useAsync(setRequestChecklist);
  const handleToggleItem = async (key: string) => {
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
    setActionError(null);
    try {
      await contact.run(selected.id);
      changed({ ...selected, status: 'contacted' });
      toast.success('Request marked contacted.');
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not update the request.'));
    }
  };

  const scheduleSession = useAsync(scheduleLessonSession);
  const handleScheduleLesson = async (values: ScheduleSessionFormValues) => {
    setActionError(null);
    try {
      await scheduleSession.run({ ...values, request_id: selected.id });
      toast.success('Lesson scheduled — the request is converted.');
      // The RPC flipped the request server-side; mirror it locally + tell the host.
      changed({ ...selected, status: 'converted' });
      setRequestSessions(await listLessonSessionsForRequest(selected.id).catch(() => []));
    } catch (err) {
      setActionError(toErrorMessage(err, 'Could not schedule the lesson.'));
    }
  };

  const busy = addNote.isPending || contact.isPending;
  const allChecked = LESSON_FIT_CHECKLIST.every((item) => checklist[item.key] === true);
  const own = visitorNotes(selected.notes);
  // §L3 — null until a date and a start time are both set, which is what makes
  // the agreed time OPTIONAL: an inquiry that is not ready to be booked still
  // gets its invitation, exactly as before.
  const agreedLesson = agreedLessonFrom(agreedFields, user?.id ?? null);

  return (
    <Modal open onClose={onClose} title="Booking request">
      <div className="flex flex-col gap-5">
        {toast.toasts.map((t) => (
          <div key={t.id} role="status"
            className={`rounded px-4 py-2 text-sm ${
              t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
            }`}>
            {t.message}
          </div>
        ))}

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
          {/* ⚠️ CATEGORISE §6 (THE REACH) — WHAT THE CART MAKES THIS PERSON.
              The categories are not a filing label: they select the legal
              documents this person must execute before they set foot on the
              property. A cart holding a lesson and a clipping is BOTH, and
              staff have never been able to see that here — the row carried one
              value, chosen from whichever page the visitor happened to be on. */}
          <RequestCategoriesLine requestId={selected.id} />
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

        {/* CAREPATH §C6 — the submission AND the order, together, on the one
            lead page. Before §C5 an inquiry had no order to show. */}
        <LeadOrderPanel requestId={selected.id} />

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
        {scheduleReady && (
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
            {/* §L3 — say whether the lesson was actually booked, from what the
                act REPORTED, never from what was sent to it. */}
            {inviteResult.agreedSlot && (
              <p className="text-green-800 mb-2">
                Their first lesson is booked for{' '}
                <span className="font-medium">{inviteResult.agreedSlot}</span>
                {inviteResult.emailed
                  ? ' — the invitation email says so at the top.'
                  : ' — but the email did not go out, so tell them yourself.'}
              </p>
            )}
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
            {selected.status !== 'converted' && !inviteOpen && !giftOpen && (
              <button
                type="button"
                className="btn-outline-gold text-sm"
                disabled={busy}
                onClick={() => setGiftOpen(true)}
              >
                Send as gift
              </button>
            )}
            {selected.status !== 'invited' && !inviteOpen && !giftOpen && (
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

        {giftOpen && (
          <div className="border-t border-green-800/10 pt-4">
            <p className="body-text text-sm mb-4">
              Turn this inquiry into a gift — pick what they're buying, confirm who it's
              for, and get a claim link to send. The recipient redeems it themselves.
            </p>
            <GiftCreateForm
              requestId={selected.id}
              buyerName={selected.contact_name}
              buyerEmail={selected.contact_email}
              onCreated={() => {
                changed({ ...selected, status: 'converted' });
                toast.success('Gift created.');
              }}
            />
            <div className="flex justify-end mt-3">
              <button type="button" className="btn-outline-gold text-sm" onClick={() => setGiftOpen(false)}>
                Back
              </button>
            </div>
          </div>
        )}

        {inviteOpen && !inviteResult && (
          <div className="border-t border-green-800/10 pt-4">
            <p className="body-text text-sm mb-4">
              Set the time you agreed on the call, provision what they bought, and email the
              registration invitation — one action. Their account opens straight into onboarding
              with the paperwork ready to sign, and the lesson already on the calendar.
            </p>
            {/* The ONE shared provision form (source='submission'): carries the
                request id (links + flips to invited) and the visitor's name.
                §L3 puts the agreed-time panel INSIDE it, above the fields, so
                one button does the whole act — the order confirms, the lead
                promotes, the lesson is booked and the invite sends together. */}
            <ProvisionClientForm
              source="submission"
              requestId={selected.id}
              email={invite.email}
              firstName={invite.firstName}
              lastName={invite.lastName}
              agreedLesson={agreedLesson}
              onProvisioned={(r) => {
                /* PAMELA §A: a SAVE sent nothing. Reporting "confirmation sent"
                   and flipping the lead to `invited` would be a false statement
                   about an email that deliberately did not happen — the form
                   shows its own saved confirmation instead. */
                if (r.inviteStatus === 'draft') { changed({ ...selected }); return; }
                setInviteResult({
                  url: r.registerUrl ?? '',
                  emailed: r.emailed,
                  offeringLabel: r.offeringLabel ?? undefined,
                  // From what the act RETURNED, not from what we sent it.
                  agreedSlot: r.agreedLesson && agreedLesson ? agreedLesson.display : undefined,
                });
                changed({ ...selected, status: 'invited' });
                toast.success(
                  r.agreedLesson
                    ? 'Lesson booked, confirmation sent — invitation created.'
                    : 'Confirmation sent — invitation created.',
                );
              }}
              /* PAMELA §A — the agreed-time panel moves to the gated `scheduling`
                 slot: it renders for a rider or a scheduling-shaped order and not
                 otherwise. A lead who asked about a lease or a clipping is not
                 asked to pick a lesson time. */
              scheduling={(
                <AgreedLessonPanel
                  proposedTimes={selected.proposed_times}
                  ridingExperience={ridingExperience(selected.notes)}
                  value={agreedFields}
                  onChange={setAgreedFields}
                  horses={horses}
                />
              )}
            />
            <div className="flex justify-end mt-3">
              <button type="button" className="btn-outline-gold text-sm" onClick={() => setInviteOpen(false)}>
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default LeadWorkDrawer;
