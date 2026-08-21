import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { addBookingNote, getBookingReport, type BookingReport, type BookingNote } from '../../lib/ops/api-lessons';
import { toErrorMessage } from '../../lib/ops/errors';
import { OBJECTIVE_STATE_LABEL } from '../../lib/ops/api-lessonplan';
import { fileDownloadUrl, listLessonMedia, type LessonMediaRow } from '../../lib/files';

/* A1 — the client's read+write view of a session's report: the instructor/care
 * notes, the activities completed, and the authored-notes thread (grouped
 * before/after the lesson), with a compose box to add their own note or
 * question. Phase is derived from `startsAt` — pre while the session is still
 * upcoming, post once it has started. Available on any of the client's own
 * serviced bookings (a lesson or a horse-care session). Collapsed behind a
 * toggle; loads on expand. Shared by CalendarPage's detail panel and
 * MyLessons' upcoming-lesson cards.
 *
 * LESSONPLAN adds two things a rider could not see before: WHAT THIS RIDING
 * LESSON IS FOR (the plan it carries — the live plan while the lesson is still
 * ahead, the plan it was taught against once it has been written up) and the
 * PHOTOS from it. Both come from the same server-side split the write-up already
 * used: `booking_report()` returns the plan without its staff-private notes, and
 * `lesson_media()` returns only files linked to a lesson that is theirs. */
export function SessionNotesView({ bookingId, startsAt }: { bookingId: string; startsAt: string }) {
  const [open, setOpen] = useState(false);
  const [report, setReport] = useState<BookingReport | null>(null);
  const [notes, setNotes] = useState<BookingNote[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState<{ row: LessonMediaRow; url: string }[]>([]);

  async function expand() {
    setOpen(true);
    if (report || loading) return;
    setLoading(true);
    try {
      const r = await getBookingReport(bookingId);
      setReport(r);
      setNotes(r.notes ?? []);
      // Non-blocking: the notes are the point of this panel, so a media failure
      // leaves the strip off rather than failing the panel.
      void listLessonMedia(bookingId)
        .then(async (rows) => {
          const withUrls = await Promise.all(
            rows.map(async (row) => ({ row, url: await fileDownloadUrl(row) })),
          );
          setMedia(withUrls.filter((m): m is { row: LessonMediaRow; url: string } => !!m.url));
        })
        .catch(() => undefined);
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

  const plan = report?.plan ?? null;

  return (
    <div className="mt-3 border-t border-green-800/10 pt-3 text-sm flex flex-col gap-3">
      {loading && <p className="text-muted">Loading…</p>}

      {/* What this Riding Lesson is for. */}
      {plan && (plan.focus || plan.objectives.length > 0) && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">What we're working on</p>
          {plan.focus && <p className="text-green-900">{plan.focus}</p>}
          {plan.objectives.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {plan.objectives.map((o) => (
                <li key={o.id} className="text-xs text-green-900/85">
                  · {o.label} — {OBJECTIVE_STATE_LABEL[o.state]}
                  {o.note ? ` · ${o.note}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      {media.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted mb-1">Photos</p>
          <div className="flex flex-wrap gap-2">
            {media.map(({ row, url }) =>
              (row.mime_type ?? '').startsWith('image/') ? (
                <a key={row.file_id} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={row.title || row.filename}
                    className="w-20 h-20 object-cover rounded border border-green-800/15" />
                </a>
              ) : (
                <a key={row.file_id} href={url} target="_blank" rel="noreferrer"
                  className="text-xs text-green-800 underline underline-offset-2">
                  {row.filename}
                </a>
              ),
            )}
          </div>
        </div>
      )}

      {report && !hasReport && activities.length === 0 && notes.length === 0 && !plan && (
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
