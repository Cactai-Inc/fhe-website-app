/**
 * THE AGREED TIME — TASK-LESSONREQUEST §L3, the piece that was missing.
 *
 * The chain ran: inquiry → order → (nothing) → invitation → onboarding →
 * payment → app. Staff could book a lesson from the lead drawer, but only AFTER
 * the invitation had already gone out, as a second, separate action. So the two
 * halves of one phone call — "we agreed Tuesday at four" and "here is your
 * link" — were two acts that could half-succeed, and the invitation email could
 * never name the time, because when it was composed the time did not exist.
 *
 * ⚠️ THERE IS NOTHING TO APPROVE, AND THIS PANEL HAS NO APPROVE BUTTON.
 * Owner, 2026-08-16: *"the submission for lessons doesnt have a calendar type
 * date picker, they have ranges for every factor in the date and time
 * selection."* The visitor describes WHEN THEY ARE FREE — weeks, days,
 * mornings/afternoons — and never a slot. Staff are not accepting a proposed
 * appointment; they are CHOOSING one, ideally inside what was offered. So the
 * ranges sit beside the picker and a choice outside them is called out in
 * words — visible, never silent, and never forbidden. The phone call decides,
 * and someone may perfectly well have agreed to a time they never listed.
 *
 * ⚠️ AND IT NEVER WRITES BACK TO `proposed_times`. What was WANTED and what was
 * AGREED are different facts: the ranges stay on the request, the slot lands on
 * the booking. Overwriting the ask with the agreement is the one thing that
 * would make the conversation unauditable afterwards.
 */
import { useMemo } from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import {
  parseProposedTimes,
  agreedTimeWarnings,
  timePreferenceSummary,
  DAY_SHORT,
} from '../../lib/availability';
import {
  SessionFields,
  sessionFieldsStart,
  sessionFieldsWindow,
  type SessionFieldsValue,
} from './SessionFields';
import type { ProposedTime } from '../../lib/types';
import type { ScheduleHorseOption } from '../../lib/ops/api-lessons';

/** What travels to `provision_client_invitation(p_agreed_lesson => …)`. */
export interface AgreedLesson {
  starts_at: string;
  ends_at: string;
  offering_id?: string;
  horse_id?: string;
  instructor_user_id?: string;
  location?: string;
  notes?: string;
  /**
   * The slot in words, exactly as the staff member reading this panel sees it.
   *
   * ⚠️ NOT COSMETIC, AND NOT REDUNDANT. This database has no tenant timezone
   * column — none exists on any table — so anything the server formats renders
   * in UTC and a 4pm lesson reaches the client as 11pm. The browser doing the
   * agreeing is in the barn's own timezone, so the words the client reads in
   * the invitation email are the same words the staff member saw before
   * pressing send. The timestamps above stay the authority; this is the label.
   */
  display: string;
}

/** The one formatter for the agreed slot — the email and this panel share it. */
export function formatAgreedSlot(start: Date, end: Date): string {
  const day = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(start);
  const time = (d: Date) =>
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d);
  return `${day} at ${time(start)}–${time(end)}`;
}

/** Build the payload, or null while the date/time are incomplete. */
export function agreedLessonFrom(
  fields: SessionFieldsValue,
  fallbackInstructorId?: string | null,
): AgreedLesson | null {
  const window = sessionFieldsWindow(fields);
  const start = sessionFieldsStart(fields);
  if (!window || !start) return null;
  const end = new Date(start.getTime() + Number(fields.duration) * 60_000);
  return {
    starts_at: window.starts_at,
    ends_at: window.ends_at,
    ...(fields.offeringId ? { offering_id: fields.offeringId } : {}),
    ...(fields.horseId ? { horse_id: fields.horseId } : {}),
    // The RPC runs under the service role, where `auth.uid()` is null, so
    // "whoever schedules it" has to be named here or the booking records nobody.
    ...(fields.instructorId || fallbackInstructorId
      ? { instructor_user_id: fields.instructorId || (fallbackInstructorId as string) }
      : {}),
    ...(fields.location.trim() ? { location: fields.location.trim() } : {}),
    ...(fields.note.trim() ? { notes: fields.note.trim() } : {}),
    display: formatAgreedSlot(start, end),
  };
}

export interface AgreedLessonPanelProps {
  /** The ranges the visitor offered, straight off `requests.proposed_times`. */
  proposedTimes: ProposedTime[] | null | undefined;
  /** Riding experience, as staff already see it on the lead. */
  ridingExperience?: string | null;
  value: SessionFieldsValue;
  onChange: (next: SessionFieldsValue) => void;
  horses?: ScheduleHorseOption[];
  disabled?: boolean;
}

export function AgreedLessonPanel({
  proposedTimes, ridingExperience, value, onChange, horses, disabled,
}: AgreedLessonPanelProps) {
  const offered = useMemo(() => parseProposedTimes(proposedTimes), [proposedTimes]);
  const start = sessionFieldsStart(value);
  const warnings = useMemo(() => agreedTimeWarnings(offered, start), [offered, start]);
  // `days === null` is itself a statement ("any day of the week"), not silence.
  const hasRanges =
    offered.weeks.length > 0 || offered.days === null || offered.days.length > 0 || offered.prefs !== null;

  return (
    <section aria-label="Agreed lesson time" className="border border-green-800/15 rounded-lg p-4 mb-6">
      <h3 className="form-label mb-1 flex items-center gap-2">
        <CalendarClock size={16} aria-hidden="true" />
        Set the time you agreed on the call
      </h3>
      <p className="text-sm text-muted mb-4">
        Optional — leave the date blank to send the invitation without booking anything.
        When you set it, the lesson is booked, drawn down against their order, and named
        at the top of the invitation email, all in this one action.
      </p>

      {/* WHAT THEY OFFERED — beside the picker, never behind a click. */}
      <div className="bg-cream-100/60 border border-green-800/10 rounded p-3 mb-4">
        <p className="text-xs uppercase tracking-wide text-secondary/70 mb-2">
          When they said they are free
        </p>
        {hasRanges ? (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <div>
              <dt className="text-xs text-green-800/70">Weeks</dt>
              <dd className="text-green-900">
                {offered.weeks.length > 0
                  ? offered.weeks.map((w) => w.label).join('; ')
                  : 'No specific weeks'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-green-800/70">Days</dt>
              <dd className="text-green-900">
                {offered.days === null
                  ? 'Any day of the week'
                  : offered.days.length > 0
                    ? offered.days.slice().sort((a, b) => a - b).map((d) => DAY_SHORT[d]).join(', ')
                    : 'Not specified'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-green-800/70">Times</dt>
              <dd className="text-green-900">
                {offered.prefs ? timePreferenceSummary(offered.prefs) : 'No time-of-day preference'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-green-800/70">Riding experience</dt>
              <dd className="text-green-900">{ridingExperience || 'Not provided'}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-green-800/70">
            They gave no availability — this inquiry predates the ranges being required.
            Whatever you agreed on the call is the only source, so nothing below can be
            checked against it.
          </p>
        )}
      </div>

      <SessionFields value={value} onChange={onChange} horses={horses} disabled={disabled} />

      {warnings.length > 0 && (
        <div
          role="status"
          className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded px-3 py-2.5 mb-4"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium mb-0.5">Outside the availability they gave us</p>
            <ul className="list-disc pl-4">
              {warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
            <p className="mt-1 text-amber-800">
              That is fine if it is what you agreed on the phone — this is only here so you
              do not set it by accident.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

export default AgreedLessonPanel;
