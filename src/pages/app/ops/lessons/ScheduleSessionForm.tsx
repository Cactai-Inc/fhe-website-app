import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../../lib/ops';
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
 */
export const DURATIONS = [30, 45, 60, 90];

export interface ScheduleSessionFormValues {
  client_id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  notes: string | null;
  horse_id: string | null;
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
  const [fieldError, setFieldError] = useState<string | null>(null);

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

      {horses.length > 0 && (
        <FormField
          label="Horse"
          hint="The horse for this lesson (barn horse or the rider's own). Internal tracking — not shown to the client. You can set or change this later."
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
