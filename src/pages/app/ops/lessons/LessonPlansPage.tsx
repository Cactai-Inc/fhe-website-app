import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ChevronRight, Target } from 'lucide-react';
import { ModuleGate } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { useDocumentTitle } from '../../../../lib/hooks';
import { LessonPlanEditor } from '../../../../components/app/LessonPlanEditor';
import { LessonActivityLog } from '../../../../components/app/LessonActivityLog';
import { lessonPlanRoster, type PlanRosterRow } from '../../../../lib/ops/api-lessonplan';
import { formatSessionWhen } from '../../../../lib/formatDateTime';

/**
 * LESSON PLANS (/app/ops/lessons/plans) — TASK-LESSONPLAN §1, and THE REACH
 * (D17) for the whole feature.
 *
 * The owner asked for "a full lesson plan building for claire to use to generate
 * lesson plans for each client". This is that surface: every rider who has a
 * Riding Lesson on the books or a plan already, INCLUDING the ones with no plan
 * yet — because "who still needs one" is the question this page is opened on,
 * and a list that hid them would answer the wrong one.
 *
 * It is reachable from Records → Lessons (the card), and a plan can also be
 * edited from inside a lesson's own record. Neither is the only way, on purpose:
 * Claire plans ahead here and adjusts in the moment there.
 *
 * D25: nothing on this page says "booking" to a person. A lesson is a Riding
 * Lesson.
 */
function fmtDay(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function RosterRow({
  r,
  active,
  onOpen,
}: {
  r: PlanRosterRow;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={`w-full text-left bg-white border p-4 flex items-start justify-between gap-3 transition-colors focus-ring ${
        active ? 'border-green-800' : 'border-green-800/10 hover:border-green-800/30'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-sans font-medium text-green-900">
          {r.client_name ?? r.client_id.slice(0, 8)}
        </p>
        {r.plan_id ? (
          <>
            <p className="text-xs text-green-900/80 mt-0.5">{r.focus ?? 'No focus written yet'}</p>
            <p className="text-xs text-muted mt-0.5">
              Next up: {r.next_up ?? 'nothing left on the plan'}
              {' · '}
              {r.achieved_count}/{r.objective_count} achieved
              {' · v'}
              {r.plan_version}
            </p>
          </>
        ) : (
          <p className="text-xs text-gold-800 mt-0.5">No plan yet</p>
        )}
        <p className="text-[11px] text-muted mt-1 inline-flex items-center gap-1">
          <CalendarDays size={11} aria-hidden="true" />
          {r.next_lesson_at
            ? `Next Riding Lesson ${formatSessionWhen(r.next_lesson_at, null, null)}`
            : r.last_lesson_at
              ? `Last Riding Lesson ${fmtDay(r.last_lesson_at)}`
              : 'No Riding Lessons on the books'}
        </p>
      </div>
      <ChevronRight size={16} className="text-green-800/40 shrink-0 mt-1" aria-hidden="true" />
    </button>
  );
}

export function LessonPlansPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;
  useDocumentTitle('Lesson plans');

  const [rows, setRows] = useState<PlanRosterRow[]>([]);
  const [openClient, setOpenClient] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'noplan'>('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      setRows(await lessonPlanRoster());
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load the riders.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lessonsOn) return;
    void load();
  }, [lessonsOn, load]);

  const visible = useMemo(
    () => (filter === 'noplan' ? rows.filter((r) => !r.plan_id) : rows),
    [rows, filter],
  );
  const withoutPlan = rows.filter((r) => !r.plan_id).length;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900 inline-flex items-center gap-2">
          <Target size={20} aria-hidden="true" /> Lesson plans
        </h1>
        <p className="text-sm text-green-800/70">
          What each rider is working on. The plan heads their next Riding Lesson, and
          recording progress after a lesson moves it on.
        </p>
        <p className="text-xs text-green-800/60 mt-1">
          {rows.length} rider{rows.length === 1 ? '' : 's'}
          {withoutPlan > 0 && (
            <>
              {' · '}
              <button type="button" className="link-underline" onClick={() => setFilter('noplan')}>
                {withoutPlan} with no plan yet
              </button>
            </>
          )}
          {' · '}
          <Link to="/app/ops/lessons/sessions" className="link-underline">
            Riding Lessons
          </Link>
        </p>
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        {err && <p role="alert" className="form-error mb-4">{err}</p>}

        <div className="flex flex-wrap gap-2 mb-4" aria-label="Filter riders">
          {(['all', 'noplan'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-sans transition-colors focus-ring ${
                filter === f ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
              }`}
            >
              {f === 'all' ? 'Everyone' : 'No plan yet'}
            </button>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <p className="text-sm text-green-800/70">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-green-800/70" data-testid="plans-empty">
            {filter === 'noplan'
              ? 'Everyone with a Riding Lesson on the books has a plan.'
              : 'No riders yet. A rider appears here once they have a Riding Lesson on the books.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" data-testid="plans-roster">
            {visible.map((r) => (
              <li key={r.client_id} className="flex flex-col">
                <RosterRow
                  r={r}
                  active={openClient === r.client_id}
                  onOpen={() => setOpenClient((c) => (c === r.client_id ? null : r.client_id))}
                />
                {openClient === r.client_id && (
                  <div className="bg-white border border-t-0 border-green-800 p-4 flex flex-col gap-5">
                    <LessonPlanEditor clientId={r.client_id} onSaved={() => void load()} />
                    <div className="border-t border-green-800/10 pt-4">
                      <p className="text-[11px] uppercase tracking-wide text-muted mb-2">
                        What has happened so far
                      </p>
                      <LessonActivityLog clientId={r.client_id} audience="staff" />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </ModuleGate>
    </div>
  );
}

export default LessonPlansPage;
