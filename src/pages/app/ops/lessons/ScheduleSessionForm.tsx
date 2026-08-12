import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../../lib/ops';
import { usePropertyTerm } from '../../../../contexts/BrandProvider';
import { fetchOfferings } from '../../../../lib/api';
import type { Offering } from '../../../../lib/types';
import { fetchInstructorOptions, type InstructorOption } from '../../../../lib/ops/api-calendar';
import {
  sessionWindow,
  type LessonClientOption,
  type ScheduleHorseOption,
} from '../../../../lib/ops/api-lessons';

/**
 * The lesson-booking form shared by the ops SessionsPage modal and the
 * IntakePage request drawer: client picker (skipped when the caller already
 * knows the client), date + start time + duration (30/45/60/90, default 60) +
 * location (blank = home property) + optional note. Submits the composed
 * timestamptz window — the schedule_lesson_session RPC does the rest
 * (overlap rejection, request conversion, member notification).
 *
 * BOOKWRITE: it also captures WHICH SERVICE this is and WHO IS DELIVERING IT.
 * Both were knowable here and neither was recorded, which is why 17 of the 39
 * real bookings could not say what they were. The service and instructor lists
 * are fetched here rather than threaded through props, so neither caller's
 * shipped layout has to change.
 */
export const DURATIONS = [30, 45, 60, 90];

export interface ScheduleSessionFormValues {
  client_id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  horse_id: string | null;
  offering_id: string | null;
  instructor_user_id: string | null;
}

export function ScheduleSessionForm({
  clients = [],
  horses = [],
  fixedClientId,
  onSubmit,
  onCancel,
  submitting,
  error,
}: {
  clients?: LessonClientOption[];
  /** The org horse roster for the internal horse picker (barn + client horses). */
  horses?: ScheduleHorseOption[];
  /** When booking for a known client (e.g. a request drawer), the picker is skipped. */
  fixedClientId?: string;
  onSubmit: (input: ScheduleSessionFormValues) => Promise<void>;
  onCancel?: () => void;
  submitting?: boolean;
  error?: string | null;
}) {
  const [clientId, setClientId] = useState(fixedClientId ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [horseId, setHorseId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const propertyTerm = usePropertyTerm();

  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.segment === 'rider' || o.segment === 'horse')))
      .catch(() => setOfferings([]));
    fetchInstructorOptions().then(setInstructors).catch(() => setInstructors([]));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const client = fixedClientId ?? clientId;
    if (!client) {
      setFieldError('Pick a client.');
      return;
    }
    if (!date || !time) {
      setFieldError('Pick a date and a start time.');
      return;
    }
    setFieldError(null);
    const window = sessionWindow(date, time, Number(duration));
    await onSubmit({
      client_id: client,
      starts_at: window.starts_at,
      ends_at: window.ends_at,
      location: location.trim() || null,
      notes: note.trim() || null,
      horse_id: horseId || null,
      offering_id: offeringId || null,
      instructor_user_id: instructorId || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Schedule a lesson">
      {!fixedClientId && (
        <FormField label="Client" required>
          {({ id, describedBy, errorClass }) => (
            <select
              id={id}
              className={`form-input ${errorClass}`}
              aria-describedby={describedBy}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={submitting}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date" required>
          {({ id }) => (
            <input
              id={id}
              type="date"
              className="form-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
        <FormField label="Start time" required>
          {({ id }) => (
            <input
              id={id}
              type="time"
              className="form-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={submitting}
            />
          )}
        </FormField>
      </div>

      <FormField label="Duration">
        {({ id }) => (
          <select
            id={id}
            className="form-input"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            disabled={submitting}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        )}
      </FormField>

      <FormField label="Location" hint="Leave blank for the home property.">
        {({ id }) => (
          <input
            id={id}
            className="form-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {offerings.length > 0 && (
        <FormField
          label="Service"
          hint="Which service this lesson is. Recorded on the booking, and used to draw down the right line of the client's order."
        >
          {({ id }) => (
            <select
              id={id}
              className="form-input"
              value={offeringId}
              onChange={(e) => setOfferingId(e.target.value)}
              disabled={submitting}
            >
              <option value="">Not specified</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      {instructors.length > 0 && (
        <FormField
          label="Instructor"
          hint="Who is delivering it. Left unset, the booking records whoever schedules it."
        >
          {({ id }) => (
            <select
              id={id}
              className="form-input"
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              disabled={submitting}
            >
              <option value="">You (whoever schedules it)</option>
              {instructors.map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      {horses.length > 0 && (
        <FormField
          label="Horse"
          hint={`The horse for this lesson (${propertyTerm.term} horse or the rider's own). Internal tracking — not shown to the client. You can set or change this later.`}
        >
          {({ id }) => (
            <select
              id={id}
              className="form-input"
              value={horseId}
              onChange={(e) => setHorseId(e.target.value)}
              disabled={submitting}
            >
              <option value="">No horse yet</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}

      <FormField label="Lesson note (optional)">
        {({ id }) => (
          <textarea
            id={id}
            rows={2}
            className="form-input resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
          />
        )}
      </FormField>

      {(fieldError || error) && (
        <p role="alert" className="form-error mb-4">
          {fieldError ?? error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={submitting} aria-busy={submitting}>
          {submitting ? 'Scheduling…' : 'Schedule lesson'}
        </button>
      </div>
    </form>
  );
}

export default ScheduleSessionForm;
