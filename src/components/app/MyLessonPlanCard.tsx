import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import { myLessonPlan, OBJECTIVE_STATE_LABEL, type LessonPlan, type PlanObjective } from '../../lib/ops/api-lessonplan';

/**
 * YOUR PLAN (TASK-LESSONPLAN §5) — the rider's own view of what they are working
 * towards, and what comes next.
 *
 * THE TELL (task §7): after a Riding Lesson is written up, this is what changes
 * for the rider. An objective they worked on shows its new state, the note their
 * instructor left on it appears beside it, and "next up" moves on. They see the
 * plan; they never see the instructor's private notes about them — that is a
 * separate column which `my_lesson_plan()` does not return at all, so there is
 * nothing here to accidentally render.
 *
 * Renders NOTHING when the rider has no plan yet, rather than an empty card
 * telling them so: a rider who has not started is not missing anything.
 */
const DOT: Record<string, string> = {
  planned: 'bg-green-800/20',
  working: 'bg-gold-500',
  achieved: 'bg-green-800',
};

export function MyLessonPlanCard() {
  const [plan, setPlan] = useState<(LessonPlan & { next_up: PlanObjective | null }) | null>(null);

  useEffect(() => {
    let live = true;
    myLessonPlan()
      .then((p) => { if (live) setPlan(p); })
      .catch(() => { /* the rest of the page still renders */ });
    return () => { live = false; };
  }, []);

  if (!plan) return null;
  const hasBody = !!plan.focus || plan.objectives.length > 0;
  if (!hasBody) return null;

  return (
    <section aria-label="Your plan" className="mb-8" data-testid="my-lesson-plan">
      <h2 className="font-serif font-medium text-green-800 text-xl mb-4 inline-flex items-center gap-2">
        <Target size={18} className="text-gold-ink" aria-hidden="true" /> Your plan
      </h2>
      <div className="bg-white border border-green-800/10 p-5">
        {plan.focus && (
          <p className="body-text text-green-900 mb-3">{plan.focus}</p>
        )}
        {plan.objectives.length > 0 && (
          <ul className="flex flex-col gap-2">
            {plan.objectives.map((o) => (
              <li key={o.id} className="flex items-start gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${DOT[o.state] ?? DOT.planned}`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${
                      o.state === 'achieved' ? 'text-muted line-through' : 'text-green-900'
                    }`}
                  >
                    {o.label}
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {OBJECTIVE_STATE_LABEL[o.state]}
                    {o.note ? ` · ${o.note}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {plan.next_up && (
          <p className="text-xs text-muted mt-3 border-t border-green-800/10 pt-3">
            Next Riding Lesson leads with: <span className="text-green-800">{plan.next_up.label}</span>
          </p>
        )}
      </div>
    </section>
  );
}

export default MyLessonPlanCard;
