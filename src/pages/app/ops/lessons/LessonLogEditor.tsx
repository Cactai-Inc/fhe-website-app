import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import {
  setBookingLog,
  setLessonProgressNote,
  addBookingNote,
  getBookingReport,
  type BookingReport,
  type BookingNote,
} from '../../../../lib/ops/api-lessons';

/**
 * The instructor's LOG + REPORT editor for one lesson (Phase 4), collapsed
 * behind a toggle on each session card. The LOG is the configurable activity
 * checkboxes + raw text (staff-only record); the REPORT is the rider-visible
 * "Instructor notes" (kept in bookings.notes). Below both, the authored-notes
 * thread — pre-lesson and post notes from rider and instructor, uneditable,
 * authorship-labeled. A clipping-style category with no checklist simply shows
 * no activities (report-only). Works for any serviced booking — a riding lesson
 * or a horse-care session (kind lesson|care): the checklist is resolved per the
 * booking's own category, so a care session shows its care activities.
 */
function noteLabel(n: BookingNote): string {
  const who = n.author_name || (n.author_role === 'rider' ? 'Rider' : 'Instructor');
  const when = n.phase === 'pre' ? 'Pre-lesson' : 'Note';
  return `${when} · ${who}`;
}

export function LessonLogEditor({
  bookingId,
  initialReport,
  onReportChange,
}: {
  bookingId: string;
  initialReport?: string | null;
  onReportChange?: (report: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<string[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [logText, setLogText] = useState('');
  const [report, setReport] = useState(initialReport ?? '');
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [newPhase, setNewPhase] = useState<'pre' | 'post'>('post');

  async function expand() {
    setOpen(true);
    if (loaded) return;
    try {
      const r: BookingReport = await getBookingReport(bookingId);
      setChecklist(r.checklist ?? []);
      setActivities(r.activity_log?.activities ?? []);
      setLogText(r.activity_log?.text ?? '');
      setReport(r.report ?? '');
      setNotes(r.notes ?? []);
      setLoaded(true);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load the log.'));
    }
  }

  function toggleActivity(label: string) {
    setActivities((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label],
    );
  }

  async function saveLog() {
    setBusy(true);
    setErr(null);
    try {
      await setBookingLog(bookingId, activities, logText.trim() || null);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save the log.'));
    } finally {
      setBusy(false);
    }
  }

  async function saveReport() {
    setBusy(true);
    setErr(null);
    try {
      await setLessonProgressNote(bookingId, report);
      onReportChange?.(report.trim());
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save the report.'));
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const saved = await addBookingNote(bookingId, newPhase, newNote.trim());
      setNotes((prev) => [...prev, saved]);
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
        <ClipboardList size={12} aria-hidden="true" /> Log &amp; report
      </button>
    );
  }

  return (
    <div className="w-full mt-2 border-t border-green-800/10 pt-3 flex flex-col gap-3">
      {/* LOG — activities + raw text (staff record) */}
      {checklist.length > 0 && (
        <div>
          <p className="form-label mb-1">Activities</p>
          <div className="flex flex-wrap gap-1.5">
            {checklist.map((label) => {
              const on = activities.includes(label);
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleActivity(label)}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
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
        </div>
      )}
      <div>
        <label className="form-label mb-1 block" htmlFor={`log-${bookingId}`}>
          Log (instructor record)
        </label>
        <textarea
          id={`log-${bookingId}`}
          value={logText}
          onChange={(e) => setLogText(e.target.value)}
          rows={2}
          placeholder="What happened in the session — the working record."
          className="form-input text-sm w-full"
        />
        <button
          type="button"
          className="btn-secondary text-xs mt-1"
          disabled={busy}
          onClick={() => void saveLog()}
        >
          Save log
        </button>
      </div>

      {/* REPORT — rider-visible instructor notes */}
      <div>
        <label className="form-label mb-1 block" htmlFor={`report-${bookingId}`}>
          Instructor notes (the rider sees this)
        </label>
        <textarea
          id={`report-${bookingId}`}
          value={report}
          onChange={(e) => setReport(e.target.value)}
          rows={2}
          placeholder="What they worked on, and what's next."
          className="form-input text-sm w-full"
        />
        <button
          type="button"
          className="btn-primary text-xs mt-1"
          disabled={busy}
          onClick={() => void saveReport()}
        >
          Save report
        </button>
      </div>

      {/* NOTES thread — authored, uneditable */}
      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
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

export default LessonLogEditor;
