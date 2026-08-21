import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, Target } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import { lessonPlansForDay, type DayPlanRow } from '../../lib/ops/api-lessonplan';
import { formatTimeRange } from '../../lib/formatDateTime';

/**
 * TODAY'S PLANS (TASK-LESSONPLAN §2, D26) — Claire's day, with the plan on it.
 *
 * The owner asked that "the lesson schedule updates with the plan for that day".
 * This is that, and it lives on the LANDING SURFACE rather than three clicks
 * into a detail page — D26 says her dashboard is her working surface, and D17
 * says a feature nothing reaches is not shipped.
 *
 * Each row is one Riding Lesson with the plan's focus and what to lead with, and
 * says plainly whether it has been written up yet. Clicking through opens the
 * lesson's own record, which is where the plan is filled in and progress
 * recorded — this panel deliberately does not become a second place to record it
 * (§3: reuse the activity surface, do not build a third).
 */
export function TodaysPlansPanel({ heading = "Today's Riding Lessons" }: { heading?: string }) {
  const [rows, setRows] = useState<DayPlanRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    lessonPlansForDay()
      .then((r) => { if (live) setRows(r); })
      .catch((e) => { if (live) { setErr(toErrorMessage(e, 'Could not load the day.')); setRows([]); } });
    return () => { live = false; };
  }, []);

  if (rows === null) return null;
  if (err) {
    return <p role="alert" className="form-error text-xs">{err}</p>;
  }

  return (
    <div data-testid="todays-plans">
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="font-serif text-green-800 text-lg inline-flex items-center gap-1.5">
          <Target size={16} aria-hidden="true" /> {heading}
        </h2>
        <Link
          to="/app/ops/lessons/plans"
          className="text-[12px] text-gold-800 font-semibold inline-flex items-center gap-1"
        >
          All lesson plans <ChevronRight size={13} />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl px-4 py-6 text-center">
          <p className="text-[13px] text-muted">No Riding Lessons today.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.booking_id}
              className="bg-white border border-green-800/10 rounded-xl px-4 py-3 flex items-start gap-3"
            >
              <div className="text-center shrink-0 w-20">
                <p className="font-serif text-green-800 text-[13px] font-semibold leading-tight">
                  {formatTimeRange(r.starts_at, r.ends_at)}
                </p>
              </div>
              <div className="min-w-0 flex-1 border-l border-green-800/10 pl-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-medium text-green-900 truncate">
                    {r.client_name ?? 'Rider'}
                  </p>
                  {r.progress_recorded && (
                    <span className="text-[10px] text-green-800 inline-flex items-center gap-1 shrink-0">
                      <CheckCircle2 size={11} aria-hidden="true" /> Recorded
                    </span>
                  )}
                </div>
                {r.focus ? (
                  <p className="text-[12px] text-green-900/85 mt-0.5">{r.focus}</p>
                ) : (
                  <p className="text-[12px] text-gold-800 mt-0.5">
                    No plan yet —{' '}
                    <Link to="/app/ops/lessons/plans" className="underline underline-offset-2">
                      write one
                    </Link>
                  </p>
                )}
                {r.next_up && (
                  <p className="text-[11px] text-muted mt-0.5">Lead with: {r.next_up}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TodaysPlansPanel;
