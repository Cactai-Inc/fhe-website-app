import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { addBookingNote, getBookingReport, type BookingReport, type BookingNote } from '../../lib/ops/api-lessons';
import { toErrorMessage } from '../../lib/ops/errors';

/* A1 — the client's read+write view of a session's report: the instructor/care
 * notes, the activities completed, and the authored-notes thread (grouped
 * before/after the lesson), with a compose box to add their own note or
 * question. Phase is derived from `startsAt` — pre while the session is still
 * upcoming, post once it has started. Available on any of the client's own
 * serviced bookings (a lesson or a horse-care session). Collapsed behind a
 * toggle; loads on expand. Shared by CalendarPage's detail panel and
 * MyLessons' upcoming-lesson cards. */
export function SessionNotesView({ bookingId, startsAt }: { bookingId: string; startsAt: string }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<BookingReport | null>(null);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  async function expand() {
    setOpen(true);
    if (report || loading) return;
    setLoading(true);
    try {
      const r = await getBookingReport(bookingId);
      setReport(r);
      setNotes(r.notes ?? []);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load the notes.'));
    } finally { setLoading(false); }
  }

  async function add() {
    if (!text.trim()) return;
    const phase: 'pre' | 'post' = Date.now() < new Date(startsAt).getTime() ? 'pre' : 'post';
    setBusy(true);
    setErr(null);
    try {
      await addBookingNote(bookingId, phase, text.trim());
      setNotes((prev) => [
        ...prev,
        { author_role: 'rider', author_name: 'You', phase, body: text.trim(), created_at: '' },
      ]);
      setText('');
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not add your note.'));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="text-sm text-green-800 underline underline-offset-2 inline-flex items-center gap-1 mt-2" onClick={() => void expand()}>
        <ClipboardList size={14} aria-hidden="true" /> Notes & questions
      </button>
    );
  }

  const activities = report?.activity_log?.activities ?? [];
  const hasReport = !!report?.report?.trim();
  const preNotes = notes.filter((n) => n.phase === 'pre');
  const postNotes = notes.filter((n) => n.phase === 'post');

  return (
    <div className="mt-3 border-t border-green-800/10 pt-3 text-sm flex flex-col gap-3">
      {loading && <p className="text-muted">Loading…</p>}
      {hasReport && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">Notes for you</p>
          <p className="text-green-900 whitespace-pre-line">{report!.report}</p>
        </div>
      )}
      {activities.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">What we did</p>
          <div className="flex flex-wrap gap-1.5">
            {activities.map((a) => (
              <span key={a} className="text-xs px-2 py-1 rounded-full bg-green-800 text-white">{a}</span>
            ))}
          </div>
        </div>
      )}

      {report && !hasReport && activities.length === 0 && notes.length === 0 && (
        <p className="text-muted">No notes yet — ask a question or leave a note for your instructor.</p>
      )}

      {preNotes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">Before the lesson</p>
          <ul className="flex flex-col gap-1.5">
            {preNotes.map((n, i) => (
              <li key={n.id ?? i} className="text-xs text-green-900/90">
                <span className="font-medium text-green-800">{n.author_name || (n.author_role === 'rider' ? 'You' : 'Instructor')}:</span>{' '}
                <span className="whitespace-pre-line">{n.body}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {postNotes.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">After the lesson</p>
          <ul className="flex flex-col gap-1.5">
            {postNotes.map((n, i) => (
              <li key={n.id ?? i} className="text-xs text-green-900/90">
                <span className="font-medium text-green-800">{n.author_name || (n.author_role === 'rider' ? 'You' : 'Instructor')}:</span>{' '}
                <span className="whitespace-pre-line">{n.body}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Ask a question or leave a note…"
          className="form-input text-sm flex-1"
        />
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || !text.trim()}
          onClick={() => void add()}
        >
          Add
        </button>
      </div>
      {err && <p className="form-error text-xs mt-1">{err}</p>}
    </div>
  );
}
