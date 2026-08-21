import { useEffect, useState } from 'react';
import { Camera, ChevronDown, ChevronRight } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import { lessonActivity, type ActivityEntry } from '../../lib/ops/api-lessonplan';
import { fileDownloadUrl, listLessonMedia, type LessonMediaRow } from '../../lib/files';
import { formatSessionWhen } from '../../lib/formatDateTime';

/**
 * ACTIVITY LOG (TASK-LESSONPLAN §5, D27) — "an activity log is the minimum;
 * clicking an entry opens the content."
 *
 * One component, two audiences, and the difference is NOT enforced here: the
 * `audience` prop only decides what is LABELLED, because `lesson_activity()`
 * returns the instructor's own log as null for a rider by construction. A screen
 * that forgets to pass the right audience therefore shows less, never more.
 *
 * A rider passes no client and gets their own lessons. Staff pass a client (or a
 * horse — the horse's record carries what was done to it, which is the third
 * reader D27 names).
 */
function MediaStrip({ bookingId }: { bookingId: string }) {
  const [rows, setRows] = useState<LessonMediaRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    void listLessonMedia(bookingId)
      .then(async (m) => {
        if (!live) return;
        setRows(m);
        const entries = await Promise.all(
          m.map(async (f) => [f.file_id, await fileDownloadUrl(f)] as const),
        );
        if (live) {
          setUrls(Object.fromEntries(entries.filter((e): e is [string, string] => !!e[1])));
        }
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [bookingId]);

  if (rows.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {rows.map((m) => {
        const url = urls[m.file_id];
        const isImage = (m.mime_type ?? '').startsWith('image/');
        if (!url) return null;
        return isImage ? (
          <a key={m.file_id} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={m.title || m.filename}
              className="w-20 h-20 object-cover rounded border border-green-800/15" />
          </a>
        ) : (
          <a key={m.file_id} href={url} target="_blank" rel="noreferrer"
            className="text-xs text-green-800 underline underline-offset-2">
            {m.filename}
          </a>
        );
      })}
    </div>
  );
}

function Entry({ e, audience }: { e: ActivityEntry; audience: 'staff' | 'rider' }) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <li className="bg-white border border-green-800/10 rounded-lg">
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-start gap-2 focus-ring"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon size={14} className="text-green-800/50 shrink-0 mt-0.5" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-green-900">
            {formatSessionWhen(e.starts_at, e.ends_at, null)}
          </span>
          <span className="block text-[11.5px] text-muted mt-0.5">
            {audience === 'staff' && e.client_name ? `${e.client_name} · ` : ''}
            {e.activities.length > 0 ? e.activities.join(', ') : 'No activities logged'}
            {e.horse_name ? ` · ${e.horse_name}` : ''}
          </span>
        </span>
        {e.media_count > 0 && (
          <span className="text-[11px] text-muted shrink-0 inline-flex items-center gap-1 mt-0.5">
            <Camera size={11} aria-hidden="true" /> {e.media_count}
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-0 border-t border-green-800/10 mt-0 flex flex-col gap-2">
          {e.plan_focus && (
            <p className="text-[11.5px] text-muted mt-2">
              Plan at the time: {e.plan_focus}
              {e.plan_version ? ` (version ${e.plan_version})` : ''}
            </p>
          )}
          {e.report ? (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted mb-1">
                {audience === 'rider' ? 'Notes for you' : 'Notes the rider sees'}
              </p>
              <p className="text-sm text-green-900 whitespace-pre-line">{e.report}</p>
            </div>
          ) : (
            <p className="text-sm text-muted mt-2">No write-up on this one.</p>
          )}
          {/* Staff only, and null on the wire for a rider — not hidden here. */}
          {e.log_text && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted mb-1">
                Your own log (the rider does not see this)
              </p>
              <p className="text-sm text-green-900/80 whitespace-pre-line">{e.log_text}</p>
            </div>
          )}
          <MediaStrip bookingId={e.booking_id} />
        </div>
      )}
    </li>
  );
}

export function LessonActivityLog({
  clientId,
  horseId,
  audience,
  limit,
}: {
  clientId?: string | null;
  horseId?: string | null;
  audience: 'staff' | 'rider';
  limit?: number;
}) {
  const [rows, setRows] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    lessonActivity({ clientId, horseId, limit })
      .then((r) => { if (live) { setRows(r); setErr(null); } })
      .catch((e) => { if (live) setErr(toErrorMessage(e, 'Could not load the activity.')); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [clientId, horseId, limit]);

  if (loading) return <p className="text-sm text-muted">Loading…</p>;
  if (err) return <p role="alert" className="form-error text-xs">{err}</p>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        {audience === 'rider'
          ? 'Nothing here yet — this fills in as your Riding Lessons are written up.'
          : 'Nothing recorded yet.'}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2" data-testid="lesson-activity-log">
      {rows.map((e) => (
        <Entry key={e.booking_id} e={e} audience={audience} />
      ))}
    </ul>
  );
}

export default LessonActivityLog;
