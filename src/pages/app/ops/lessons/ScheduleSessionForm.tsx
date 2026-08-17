import { useState } from 'react';
import type { FormEvent } from 'react';
import { FormField } from '../../../../lib/ops';
import type { LessonClientOption, ScheduleHorseOption } from '../../../../lib/ops/api-lessons';
import {
  SessionFields,
  emptySessionFields,
  sessionFieldsWindow,
  DURATIONS,
  type SessionFieldsValue,
} from '../../../../components/app/SessionFields';

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
 * real bookings could not say what they were.
 *
 * LESSONREQUEST §L3: the FIELDS themselves moved to `components/app/
 * SessionFields.tsx`, because the agreed-time panel inside the one act asks for
 * exactly the same eight facts with a different frame (no client picker, no
 * submit of its own). What is left here is the frame: the client picker, the
 * validation, and the submit. The props and the submitted shape are unchanged,
 * so both existing callers are untouched.
 */
export { DURATIONS };

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
  const [fields, setFields] = useState<SessionFieldsValue>(emptySessionFields);
  const [fieldError, setFieldError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const client = fixedClientId ?? clientId;
    if (!client) {
      setFieldError('Pick a client.');
      return;
    }
    const window = sessionFieldsWindow(fields);
    if (!window) {
      setFieldError('Pick a date and a start time.');
      return;
    }
    setFieldError(null);
    await onSubmit({
      client_id: client,
      starts_at: window.starts_at,
      ends_at: window.ends_at,
      location: fields.location.trim() || null,
      notes: fields.note.trim() || null,
      horse_id: fields.horseId || null,
      offering_id: fields.offeringId || null,
      instructor_user_id: fields.instructorId || null,
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

      <SessionFields value={fields} onChange={setFields} horses={horses} disabled={submitting} />

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
