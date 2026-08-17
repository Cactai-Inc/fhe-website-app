/**
 * THE LESSON'S DETAILS, AS FIELDS — extracted from `ScheduleSessionForm`, not
 * copied beside it (LESSONREQUEST §L3).
 *
 * Two surfaces now ask for the same eight facts about one lesson:
 *   • `ScheduleSessionForm` — the ops sessions modal and the post-invitation
 *     path in the lead drawer. Fields + a client picker + its own submit.
 *   • `AgreedLessonPanel` — setting the time agreed on the phone, INSIDE the
 *     one act that also confirms the order, promotes the lead and sends the
 *     invitation. There is no client to pick yet (the act creates them) and no
 *     submit of its own (the invitation's button is the submit).
 *
 * So the fields are the shared part and the frame is not. Copying them would
 * have given the product two ideas of what a lesson records, which is exactly
 * how `BookSupport` ended up carrying `BookHorse`'s bugs.
 */
import { useEffect, useState } from 'react';
import { FormField } from '../../lib/ops';
import { usePropertyTerm } from '../../contexts/BrandProvider';
import { fetchOfferings } from '../../lib/api';
import type { Offering } from '../../lib/types';
import { fetchInstructorOptions, type InstructorOption } from '../../lib/ops/api-calendar';
import { sessionWindow, type ScheduleHorseOption } from '../../lib/ops/api-lessons';

export const DURATIONS = [30, 45, 60, 90];

export interface SessionFieldsValue {
  date: string;
  time: string;
  duration: string;
  location: string;
  note: string;
  horseId: string;
  offeringId: string;
  instructorId: string;
}

export function emptySessionFields(): SessionFieldsValue {
  return {
    date: '', time: '', duration: '60',
    location: '', note: '', horseId: '', offeringId: '', instructorId: '',
  };
}

/** The composed window, or null while date/time are incomplete. */
export function sessionFieldsWindow(v: SessionFieldsValue): { starts_at: string; ends_at: string } | null {
  if (!v.date || !v.time) return null;
  return sessionWindow(v.date, v.time, Number(v.duration));
}

/** The chosen start as a local Date (for range checking), or null. */
export function sessionFieldsStart(v: SessionFieldsValue): Date | null {
  if (!v.date || !v.time) return null;
  const d = new Date(`${v.date}T${v.time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function SessionFields({
  value,
  onChange,
  horses = [],
  disabled,
}: {
  value: SessionFieldsValue;
  onChange: (next: SessionFieldsValue) => void;
  horses?: ScheduleHorseOption[];
  disabled?: boolean;
}) {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const propertyTerm = usePropertyTerm();

  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.segment === 'rider' || o.segment === 'horse')))
      .catch(() => setOfferings([]));
    fetchInstructorOptions().then(setInstructors).catch(() => setInstructors([]));
  }, []);

  const set = <K extends keyof SessionFieldsValue>(k: K, v: SessionFieldsValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Date" required>
          {({ id }) => (
            <input id={id} type="date" className="form-input" value={value.date}
              onChange={(e) => set('date', e.target.value)} disabled={disabled} />
          )}
        </FormField>
        <FormField label="Start time" required>
          {({ id }) => (
            <input id={id} type="time" className="form-input" value={value.time}
              onChange={(e) => set('time', e.target.value)} disabled={disabled} />
          )}
        </FormField>
      </div>

      <FormField label="Duration">
        {({ id }) => (
          <select id={id} className="form-input" value={value.duration}
            onChange={(e) => set('duration', e.target.value)} disabled={disabled}>
            {DURATIONS.map((d) => <option key={d} value={d}>{d} minutes</option>)}
          </select>
        )}
      </FormField>

      <FormField label="Location" hint="Leave blank for the home property.">
        {({ id }) => (
          <input id={id} className="form-input" value={value.location}
            onChange={(e) => set('location', e.target.value)} disabled={disabled} />
        )}
      </FormField>

      {offerings.length > 0 && (
        <FormField
          label="Service"
          hint="Which service this lesson is. Recorded on the booking, and used to draw down the right line of the client's order."
        >
          {({ id }) => (
            <select id={id} className="form-input" value={value.offeringId}
              onChange={(e) => set('offeringId', e.target.value)} disabled={disabled}>
              <option value="">Not specified</option>
              {offerings.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
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
            <select id={id} className="form-input" value={value.instructorId}
              onChange={(e) => set('instructorId', e.target.value)} disabled={disabled}>
              <option value="">You (whoever schedules it)</option>
              {instructors.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)}
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
            <select id={id} className="form-input" value={value.horseId}
              onChange={(e) => set('horseId', e.target.value)} disabled={disabled}>
              <option value="">No horse yet</option>
              {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          )}
        </FormField>
      )}

      <FormField label="Lesson note (optional)">
        {({ id }) => (
          <textarea id={id} rows={2} className="form-input resize-none" value={value.note}
            onChange={(e) => set('note', e.target.value)} disabled={disabled} />
        )}
      </FormField>
    </>
  );
}

export default SessionFields;
