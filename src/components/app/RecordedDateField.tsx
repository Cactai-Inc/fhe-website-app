/**
 * `RecordedDateField` — TASK-BACKDATE's control, split out from
 * `src/lib/recordedDate.ts` so that module can stay a pure-function module
 * (mixing the two trips `react-refresh/only-export-components` and costs three
 * lint warnings for nothing).
 */
import { barnToday, isBackdated, recordedDateNote } from '../../lib/recordedDate';

/**
 * THE CONTROL — D19's "state it before you act", as one field plus one sentence.
 *
 * ⚠️ It lives beside the rules rather than in a page, because THREE surfaces now
 * record a date against money (the staff client record's Orders tab, Payment
 * review, and the attach-offerings panel) and three copies of "is this in the
 * past, and what does that mean" is exactly how two of them would end up
 * disagreeing about whether a receipt went out.
 */
export function RecordedDateField({ value, onChange, kind, label }: {
  value: string;
  onChange: (ymd: string) => void;
  kind: 'order' | 'payment';
  label?: string;
}) {
  const future = value > barnToday();
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-wrap items-center gap-2 text-sm text-secondary">
        <span className="text-[11.5px] uppercase tracking-wide text-muted">
          {label ?? (kind === 'order' ? 'Order date' : 'Date paid')}
        </span>
        <input
          type="date"
          value={value}
          max={barnToday()}
          onChange={(e) => onChange(e.target.value)}
          className="form-input w-40 py-1 text-sm"
        />
      </label>
      <p className={`text-[11.5px] ${future ? 'text-red-700' : isBackdated(value) ? 'text-gold-900' : 'text-muted'}`}>
        {recordedDateNote(value, kind)}
      </p>
    </div>
  );
}
