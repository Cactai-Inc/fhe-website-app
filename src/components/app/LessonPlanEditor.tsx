import { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, History, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  getClientLessonPlan,
  saveLessonPlan,
  restoreLessonPlanVersion,
  OBJECTIVE_STATE_LABEL,
  type ClientLessonPlan,
  type ObjectiveState,
  type PlanObjectiveInput,
} from '../../lib/ops/api-lessonplan';

/**
 * LESSON PLAN EDITOR (TASK-LESSONPLAN §1) — Claire writes one rider's plan.
 *
 * THE MODEL, so the screen is not mistaken for a form: a plan belongs to the
 * RIDER, not to a lesson. It has a focus (one line) and an ORDERED list of
 * objectives; the first one not yet achieved is what comes next, which is why
 * order is an interaction here (the arrows) and not a stored field.
 *
 * EVERY SAVE THAT CHANGES SOMETHING MAKES A NEW VERSION and retains the old one
 * — the history panel below is that retention, and "Put this version back"
 * writes an old version FORWARD as a new one rather than resurrecting it, so
 * nothing is ever lost by undoing (D19). A save that changes nothing makes no
 * version at all.
 *
 * TWO LANES, LABELLED ON SCREEN (§5): the focus and the objectives are what the
 * rider sees — that is the point of a plan. "Notes just for you" is the
 * staff-private lane and never leaves the staff surface (my_lesson_plan() does
 * not return it).
 */

const STATES: ObjectiveState[] = ['planned', 'working', 'achieved'];

interface Draft {
  id?: string;
  label: string;
  state: ObjectiveState;
  note: string | null;
}

function toDraft(objectives: { id: string; label: string; state: ObjectiveState; note: string | null }[]): Draft[] {
  return objectives.map((o) => ({ id: o.id, label: o.label, state: o.state, note: o.note }));
}

function fmt(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function LessonPlanEditor({
  clientId,
  onSaved,
}: {
  clientId: string;
  /** Fired after a save, so a parent list can refresh its own copy. */
  onSaved?: (plan: ClientLessonPlan) => void;
}) {
  const [view, setView] = useState<ClientLessonPlan | null>(null);
  const [focus, setFocus] = useState('');
  const [notes, setNotes] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const adopt = useCallback((v: ClientLessonPlan) => {
    setView(v);
    setFocus(v.plan?.focus ?? '');
    setNotes(v.plan?.coach_notes ?? '');
    setDrafts(toDraft(v.plan?.objectives ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      adopt(await getClientLessonPlan(clientId));
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load the plan.'));
    } finally {
      setLoading(false);
    }
  }, [clientId, adopt]);

  useEffect(() => { void load(); }, [load]);

  function edit(i: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, n) => (n === i ? { ...d, ...patch } : d)));
    setSaved(null);
  }
  function move(i: number, by: number) {
    setDrafts((prev) => {
      const next = prev.slice();
      const j = i + by;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(null);
  }
  function remove(i: number) {
    setDrafts((prev) => prev.filter((_, n) => n !== i));
    setSaved(null);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      const payload: PlanObjectiveInput[] = drafts
        .filter((d) => d.label.trim())
        .map((d) => ({ id: d.id, label: d.label.trim(), state: d.state, note: d.note?.trim() || null }));
      const before = view?.plan?.version ?? 0;
      const next = await saveLessonPlan(clientId, focus.trim() || null, payload, notes);
      adopt(next);
      const after = next.plan?.version ?? 0;
      setSaved(
        after > before
          ? `Saved as version ${after}. Version ${before || '—'} is kept in the history below.`
          : 'Nothing had changed, so no new version was written.',
      );
      onSaved?.(next);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save the plan.'));
    } finally {
      setBusy(false);
    }
  }

  async function restore(planId: string, version: number) {
    setBusy(true);
    setErr(null);
    try {
      const next = await restoreLessonPlanVersion(planId);
      adopt(next);
      setSaved(`Version ${version} is back, written forward as version ${next.plan?.version}.`);
      onSaved?.(next);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not restore that version.'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading the plan…</p>;

  const nextUp = drafts.find((d) => d.state !== 'achieved');

  return (
    <div className="flex flex-col gap-4" data-testid="lesson-plan-editor">
      <div>
        <label className="form-label mb-1 block" htmlFor={`focus-${clientId}`}>
          What we are working on
        </label>
        <input
          id={`focus-${clientId}`}
          className="form-input w-full text-sm"
          value={focus}
          placeholder="e.g. Get secure at the canter"
          onChange={(e) => { setFocus(e.target.value); setSaved(null); }}
        />
        <p className="text-[11px] text-muted mt-1">
          One line. The rider sees this, and it heads every Riding Lesson on the schedule.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <p className="form-label">The plan, in order</p>
          {nextUp && (
            <p className="text-[11px] text-muted">
              Next up: <span className="text-green-800">{nextUp.label || '—'}</span>
            </p>
          )}
        </div>

        {drafts.length === 0 && (
          <p className="text-sm text-muted mb-2">
            Nothing on the plan yet. Add what this rider is working towards — the top of
            the list is what the next Riding Lesson leads with.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {drafts.map((d, i) => (
            <li key={d.id ?? `new-${i}`} className="border border-green-800/10 bg-white rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <span className="text-xs text-muted w-5 pt-2 shrink-0">{i + 1}.</span>
                <input
                  className="form-input text-sm flex-1"
                  value={d.label}
                  placeholder="What they are working towards"
                  onChange={(e) => edit(i, { label: e.target.value })}
                />
                <div className="flex items-center gap-0.5 shrink-0 pt-1">
                  <button type="button" className="p-1 text-green-800/60 hover:text-green-800 focus-ring"
                    aria-label={`Move "${d.label}" up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" className="p-1 text-green-800/60 hover:text-green-800 focus-ring"
                    aria-label={`Move "${d.label}" down`} disabled={i === drafts.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" className="p-1 text-green-800/60 hover:text-red-700 focus-ring"
                    aria-label={`Remove "${d.label}"`} onClick={() => remove(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pl-7">
                {STATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={d.state === s}
                    onClick={() => edit(i, { state: s })}
                    className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                      d.state === s
                        ? 'bg-green-800 text-white border-green-800'
                        : 'bg-white text-green-800 border-green-800/25 hover:border-green-800/60'
                    }`}
                  >
                    {OBJECTIVE_STATE_LABEL[s]}
                  </button>
                ))}
                <input
                  className="form-input text-xs flex-1 min-w-[10rem]"
                  value={d.note ?? ''}
                  placeholder="A note the rider sees (optional)"
                  onChange={(e) => edit(i, { note: e.target.value })}
                />
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="btn-secondary text-xs mt-2 inline-flex items-center gap-1"
          onClick={() => { setDrafts((p) => [...p, { label: '', state: 'planned', note: null }]); setSaved(null); }}
        >
          <Plus size={12} aria-hidden="true" /> Add to the plan
        </button>
      </div>

      <div>
        <label className="form-label mb-1 block" htmlFor={`coach-${clientId}`}>
          Notes just for you
        </label>
        <textarea
          id={`coach-${clientId}`}
          rows={2}
          className="form-input w-full text-sm"
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(null); }}
        />
        <p className="text-[11px] text-muted mt-1">
          Staff only — the rider never sees this. Everything above, they do.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void save()}>
          Save the plan
        </button>
        <button
          type="button"
          className="text-xs text-green-800/70 underline underline-offset-2 inline-flex items-center gap-1"
          onClick={() => setShowHistory((v) => !v)}
        >
          <History size={12} aria-hidden="true" />
          {showHistory ? 'Hide the history' : `History (${view?.versions.length ?? 0} version${(view?.versions.length ?? 0) === 1 ? '' : 's'})`}
        </button>
        {saved && <span className="text-xs text-green-800/70">{saved}</span>}
      </div>

      {err && <p role="alert" className="form-error text-xs">{err}</p>}

      {showHistory && view && (
        <div className="border-t border-green-800/10 pt-3 flex flex-col gap-3" data-testid="plan-history">
          <p className="text-[11px] uppercase tracking-wide text-muted">
            Every version is kept — nothing here is overwritten
          </p>
          <ul className="flex flex-col gap-2">
            {view.versions.map((v) => (
              <li key={v.id} className="text-xs bg-cream-100/60 border border-green-800/10 rounded p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-green-900">
                    Version {v.version}
                    {v.status === 'current' && ' · current'}
                  </span>
                  <span className="text-muted">
                    {v.advanced_from_starts_at
                      ? `After the Riding Lesson on ${fmt(v.advanced_from_starts_at)}`
                      : `Written ${fmt(v.created_at)}`}
                  </span>
                </div>
                {v.focus && <p className="text-green-900/90 mt-1">{v.focus}</p>}
                {v.objectives.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {v.objectives.map((o) => (
                      <li key={o.id} className="text-green-900/70">
                        · {o.label} — {OBJECTIVE_STATE_LABEL[o.state]}
                      </li>
                    ))}
                  </ul>
                )}
                {v.status !== 'current' && (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-green-800 underline underline-offset-2"
                    disabled={busy}
                    onClick={() => void restore(v.id, v.version)}
                    title="Writes this version forward as a new one — nothing in between is lost"
                  >
                    <RotateCcw size={11} aria-hidden="true" /> Put this version back
                  </button>
                )}
              </li>
            ))}
          </ul>

          {view.log.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Change log</p>
              <ul className="flex flex-col gap-0.5">
                {view.log.map((e, i) => (
                  <li key={i} className="text-[11px] text-green-900/70">
                    {fmt(e.at)} · {e.label}
                    {e.detail ? ` — ${e.detail}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LessonPlanEditor;
