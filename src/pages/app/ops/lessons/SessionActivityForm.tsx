import { useState } from 'react';
import { ClipboardList, Trash2 } from 'lucide-react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import {
  getBookingForm,
  saveBookingForm,
  discardBookingForm,
  addBookingNote,
  getBookingReport,
  type BookingFormView,
  type BookingFormField,
  type BookingFormAnswers,
  type BookingNote,
} from '../../../../lib/ops/api-lessons';
import { recordLessonProgress, type ObjectiveOutcome } from '../../../../lib/ops/api-lessonplan';
import { LessonPlanProgress, type PlanProgressValue } from '../../../../components/app/LessonPlanProgress';

/**
 * SESSION ACTIVITY FORM (LESSONFORM) — the instructor's form for ONE booking,
 * collapsed behind a toggle on each session card. Was `LessonLogEditor`, which
 * wrote two booking columns directly and had no instance behind it.
 *
 * What changed: there is now a real row (`booking_forms`) linked to the booking,
 * so the form can be found in a backlog, filled later, moved with a reschedule
 * (automatic — the link is the booking id), discarded, or retired with its
 * cancelled booking. Everything here writes through `save_booking_form`, the one
 * writer; `bookings.activity_log` and `bookings.notes` are its projections and
 * the rider-facing surfaces keep reading them unchanged.
 *
 * The fields are RENDERED FROM THE DEFINITION (`form_definitions.ACTIVITY_SESSION`
 * via booking_form()), not hardcoded — so marking a field required in
 * /app/ops/admin/forms changes this form with no code change (D13). A `checklist`
 * field takes its options from the booking's own service checklist, which is
 * edited in `activity_checklists`, not in the definition.
 *
 * Below the form, the authored-notes thread (booking_notes) is unchanged: it is
 * the rider⇄instructor conversation, a different thing from the form's answers.
 *
 * LESSONPLAN adds the top section and the primary action. The plan the rider is
 * on rides in on the SAME read as the form (booking_form() returns both), and
 * "Record progress" calls record_lesson_progress, which saves this form through
 * save_booking_form — still the one writer — and advances the plan in the same
 * call. That is the loop: what is recorded here is what the rider's NEXT Riding
 * Lesson leads with.
 *
 * "Save" is deliberately NOT the plan-advancing button. A draft save keeps the
 * per-objective results with the form and leaves the plan alone; advancing the
 * plan is a stated, confirmed act (D19), because it changes what somebody else
 * sees on their next lesson.
 */
function noteLabel(n: BookingNote): string {
  const who = n.author_name || (n.author_role === 'rider' ? 'Rider' : 'Instructor');
  const when = n.phase === 'pre' ? 'Pre-lesson' : 'Note';
  return `${when} · ${who}`;
}

/** The one-word state Claire scans for on a collapsed card. D25: the label names
 *  what it is to a person — the plan and the record of the session — never the
 *  internal taxonomy the row is stored under. */
function formSummary(view: BookingFormView | null): string {
  const noun = view?.kind === 'lesson' ? 'Plan & record' : 'Session record';
  if (!view) return 'Plan & record';
  if (!view.form) return `${noun} · discarded`;
  if (view.form.status === 'retired') return `${noun} · kept (cancelled)`;
  if (view.form.status === 'submitted') return `${noun} · done`;
  return view.form.blank ? `${noun} · not started` : `${noun} · in progress`;
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function SessionActivityForm({
  bookingId,
  onReportChange,
  onChanged,
}: {
  bookingId: string;
  /** The rider-visible report, so a parent list can update its own copy. */
  onReportChange?: (report: string) => void;
  /** Fired when the form changes something the parent list shows (status, discard). */
  onChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<BookingFormView | null>(null);
  const [answers, setAnswers] = useState<BookingFormAnswers>({});
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newPhase, setNewPhase] = useState<'pre' | 'post'>('post');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  /** The plan half of what gets saved. Outcomes are restored from the form's own
   *  answers, so a half-filled write-up comes back exactly as it was left. */
  const [progress, setProgress] = useState<PlanProgressValue>({ outcomes: [], nextFocus: null });

  /** Take a fresh server copy as the truth. `keepFocus` preserves what Claire
   *  has typed into "what to work on next": a plain Save does not persist it
   *  anywhere (only recording progress does), so clearing it on a save would
   *  throw away her sentence without telling her. */
  function adopt(v: BookingFormView, keepFocus: string | null = null) {
    setView(v);
    setAnswers(v.form?.answers ?? {});
    setProgress({
      outcomes: (v.form?.answers?.plan_progress ?? []) as ObjectiveOutcome[],
      nextFocus: keepFocus,
    });
  }

  async function expand() {
    setOpen(true);
    if (loaded) return;
    try {
      const [v, r] = await Promise.all([getBookingForm(bookingId), getBookingReport(bookingId)]);
      adopt(v);
      setNotes(r.notes ?? []);
      setLoaded(true);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load the form.'));
    }
  }

  function setAnswer(key: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
  }

  function toggleChecklistItem(key: string, label: string) {
    setAnswers((prev) => {
      const cur = asStringArray(prev[key]);
      return {
        ...prev,
        [key]: cur.includes(label) ? cur.filter((a) => a !== label) : [...cur, label],
      };
    });
    setSaved(null);
  }

  /** A required field the definition asks for and nobody filled in. */
  function missingRequired(): string[] {
    const fields = view?.definition?.schema.sections.flatMap((s) => s.fields) ?? [];
    return fields
      .filter((f) => f.required)
      .filter((f) => {
        const v = answers[f.key];
        return Array.isArray(v) ? v.length === 0 : !asString(v).trim();
      })
      .map((f) => f.label);
  }

  /** A plain save. Keeps the per-objective results with the form and leaves the
   *  rider's plan exactly where it is — advancing it is the other button. */
  async function save(submit: boolean) {
    if (submit) {
      const missing = missingRequired();
      if (missing.length > 0) {
        setErr(`Still needed before this is done: ${missing.join(', ')}.`);
        return;
      }
    }
    setBusy(true);
    setErr(null);
    try {
      const next = await saveBookingForm(
        bookingId,
        { ...answers, plan_progress: progress.outcomes.filter((o) => o.id || o.label?.trim()) },
        submit,
      );
      adopt(next, progress.nextFocus);
      setSaved(submit ? 'Saved and marked done. The plan was left as it is.' : 'Saved.');
      onReportChange?.(asString(answers.report).trim());
      onChanged?.();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  /** THE LOOP (§4). Saves the write-up through the same one writer AND advances
   *  the rider's plan, so their next Riding Lesson leads with what was recorded
   *  here. D19: it says what it is about to do and waits for a yes, because it
   *  changes what somebody else sees. */
  async function recordProgress() {
    const missing = missingRequired();
    if (missing.length > 0) {
      setErr(`Still needed before this is done: ${missing.join(', ')}.`);
      return;
    }
    const outcomes = progress.outcomes.filter((o) => o.id || o.label?.trim());
    const achieved = outcomes.filter((o) => o.state === 'achieved').length;
    const added = outcomes.filter((o) => !o.id && o.label?.trim()).length;
    const focus = progress.nextFocus?.trim();
    const lines = [
      'Record this Riding Lesson and update the rider\'s plan?',
      '',
      achieved > 0 ? `· ${achieved} objective${achieved === 1 ? '' : 's'} marked achieved` : null,
      added > 0 ? `· ${added} new objective${added === 1 ? '' : 's'} added to the plan` : null,
      focus ? `· Next focus: “${focus}”` : '· The current focus stays as it is',
      '',
      'Their next Riding Lesson will lead with this. The plan as it stands now is kept and can be put back.',
    ].filter((l) => l !== null);
    if (!window.confirm(lines.join('\n'))) return;

    setBusy(true);
    setErr(null);
    try {
      const result = await recordLessonProgress({
        bookingId,
        answers,
        outcomes,
        nextFocus: focus || null,
        submit: true,
      });
      adopt(await getBookingForm(bookingId));
      setSaved(
        result.plan_advanced
          ? `Recorded. The plan is now version ${result.plan?.version} — the next Riding Lesson picks it up.`
          : 'Recorded. Nothing on the plan changed, so no new version was written.',
      );
      onReportChange?.(asString(answers.report).trim());
      onChanged?.();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not record the progress.'));
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    setErr(null);
    try {
      const r = await discardBookingForm(bookingId);
      // Re-read rather than guess: a blank form is gone, one that had been
      // written in is retired and still here.
      adopt(await getBookingForm(bookingId));
      setSaved(r.outcome === 'deleted' ? 'Form deleted.' : 'Form kept as a record and closed.');
      onChanged?.();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not discard the form.'));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const savedNote = await addBookingNote(bookingId, newPhase, newNote.trim());
      setNotes((prev) => [...prev, savedNote]);
      setNewNote('');
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not add the note.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-green-800 underline underline-offset-2 inline-flex items-center gap-1"
        onClick={() => void expand()}
      >
        <ClipboardList size={12} aria-hidden="true" /> {formSummary(view)}
      </button>
    );
  }

  const readOnly = view?.form?.status === 'retired';

  function renderField(f: BookingFormField) {
    // The no-show option is only offerable while cancel_lesson_session would
    // accept it. Past that, the answer is shown but cannot be changed here.
    const noShowLocked =
      f.key === 'attendance' && !view?.can_mark_no_show && view?.booking_status !== 'NO_SHOW';

    if (f.type === 'radio') {
      const opts = f.options ?? [];
      const labels = f.option_labels ?? opts;
      return (
        <div key={f.key}>
          <p className="form-label mb-1">
            {f.label}
            {f.required && <span className="text-gold-800"> *</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {opts.map((o, i) => {
              const on = asString(answers[f.key]) === o;
              const blocked = readOnly || (noShowLocked && o === 'no_show' && !on);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  disabled={blocked}
                  onClick={() => setAnswer(f.key, on ? '' : o)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                    on
                      ? 'bg-green-800 text-white border-green-800'
                      : 'bg-white text-green-800 border-green-800/30 hover:border-green-800/60'
                  }`}
                >
                  {labels[i] ?? o}
                </button>
              );
            })}
          </div>
          {f.help && <p className="text-[11px] text-muted mt-1">{f.help}</p>}
          {noShowLocked && (
            <p className="text-[11px] text-muted mt-1">
              A no-show can only be recorded while the lesson is still SCHEDULED.
            </p>
          )}
        </div>
      );
    }

    if (f.type === 'checklist') {
      const items = view?.checklist ?? [];
      if (items.length === 0) {
        return (
          <div key={f.key}>
            <p className="form-label mb-1">{f.label}</p>
            <p className="text-xs text-muted">
              No checklist for this service yet — it is set up per service and this form
              picks it up automatically once it is.
            </p>
          </div>
        );
      }
      const chosen = asStringArray(answers[f.key]);
      return (
        <div key={f.key}>
          <p className="form-label mb-1">
            {f.label}
            {f.required && <span className="text-gold-800"> *</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {items.map((label) => {
              const on = chosen.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  disabled={readOnly}
                  onClick={() => toggleChecklistItem(f.key, label)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors disabled:opacity-40 ${
                    on
                      ? 'bg-green-800 text-white border-green-800'
                      : 'bg-white text-green-800 border-green-800/30 hover:border-green-800/60'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {f.help && <p className="text-[11px] text-muted mt-1">{f.help}</p>}
        </div>
      );
    }

    return (
      <div key={f.key}>
        <label className="form-label mb-1 block" htmlFor={`${f.key}-${bookingId}`}>
          {f.label}
          {f.required && <span className="text-gold-800"> *</span>}
        </label>
        <textarea
          id={`${f.key}-${bookingId}`}
          value={asString(answers[f.key])}
          disabled={readOnly}
          onChange={(e) => setAnswer(f.key, e.target.value)}
          rows={2}
          className="form-input text-sm w-full"
        />
        {f.help && <p className="text-[11px] text-muted mt-1">{f.help}</p>}
      </div>
    );
  }

  return (
    <div className="w-full mt-2 border-t border-green-800/10 pt-3 flex flex-col gap-3">
      {!loaded && !err && <p className="text-sm text-muted">Loading…</p>}

      {view && !view.form && (
        <p className="text-sm text-muted">
          No record on this session — it was discarded, or this is not a session a form
          applies to. Saving anything below starts a fresh one.
        </p>
      )}
      {readOnly && (
        <p className="text-xs text-gold-800">
          This session was cancelled. The record had been written in, so it is kept and
          can no longer be edited.
        </p>
      )}

      {/* LESSONPLAN — the plan comes in on the same read as the form, so the two
          can never render against different copies of the same lesson. */}
      {view && view.kind === 'lesson' && (
        <LessonPlanProgress
          bookingId={bookingId}
          plan={view.plan}
          nextUp={view.plan_next_up}
          pinned={view.plan_pinned}
          readOnly={readOnly}
          value={progress}
          onChange={(v) => { setProgress(v); setSaved(null); }}
        />
      )}

      {view?.definition?.schema.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-wide text-muted">{section.heading}</p>
          {section.fields.map(renderField)}
        </section>
      ))}

      {view && !readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary text-xs" disabled={busy} onClick={() => void save(false)}>
            Save
          </button>
          {view.kind === 'lesson' ? (
            <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void recordProgress()}>
              Record progress &amp; update the plan
            </button>
          ) : (
            <button type="button" className="btn-primary text-xs" disabled={busy} onClick={() => void save(true)}>
              {view.form?.status === 'submitted' ? 'Save as done' : 'Mark done'}
            </button>
          )}
          {view.form && (
            <button
              type="button"
              className="text-xs text-green-800/70 underline underline-offset-2 inline-flex items-center gap-1"
              disabled={busy}
              onClick={() => void discard()}
              title={
                view.form.blank
                  ? 'Deletes this record — it has nothing in it'
                  : 'Closes this record and keeps what is written in it'
              }
            >
              <Trash2 size={12} aria-hidden="true" />
              {view.form.blank ? 'Delete this record' : 'Close and keep as a record'}
            </button>
          )}
          {saved && <span className="text-xs text-green-800/70">{saved}</span>}
        </div>
      )}

      {/* NOTES thread — authored, uneditable, unchanged by LESSONFORM */}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-green-800/10 pt-3">
          {notes.map((n, i) => (
            <li key={n.id ?? i} className="text-xs text-green-900/90">
              <span className="font-medium text-green-800">{noteLabel(n)}:</span>{' '}
              <span className="whitespace-pre-line">{n.body}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={1}
            placeholder="Add a note…"
            className="form-input text-sm w-full"
          />
        </div>
        <select
          value={newPhase}
          onChange={(e) => setNewPhase(e.target.value as 'pre' | 'post')}
          className="form-input text-xs w-28"
          aria-label="Note timing"
        >
          <option value="pre">Pre-lesson</option>
          <option value="post">Note</option>
        </select>
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || !newNote.trim()}
          onClick={() => void addNote()}
        >
          Add
        </button>
      </div>

      {err && <p className="form-error text-xs">{err}</p>}
      <div>
        <button
          type="button"
          className="text-xs text-green-800/70 underline underline-offset-2"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default SessionActivityForm;
