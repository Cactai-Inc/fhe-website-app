import { useEffect, useRef, useState } from 'react';
import { Camera, Target, Trash2 } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  OBJECTIVE_STATE_LABEL,
  type LessonPlan,
  type ObjectiveOutcome,
  type ObjectiveState,
  type PlanObjective,
} from '../../lib/ops/api-lessonplan';
import {
  fileDownloadUrl,
  listLessonMedia,
  scrubLessonContent,
  uploadLessonMedia,
  type LessonMediaRow,
} from '../../lib/files';

/**
 * PLAN + PROGRESS (TASK-LESSONPLAN §2/§3/§4) — the part of the instructor's
 * activity form that carries the plan into the lesson and takes the result back
 * out of it.
 *
 * This is deliberately NOT a screen of its own. §3 says to reuse the
 * session-notes/activity surfaces rather than build a third, so it renders
 * inside `SessionActivityForm`, which already has a home on the lessons list, in
 * the calendar's lesson panel and in the forms backlog. The parent owns saving;
 * this component owns the plan half of what gets saved.
 *
 * THE TWO STATES A LESSON CAN BE IN, and why the screen says which:
 *   not yet recorded  the plan shown is the rider's CURRENT plan, live. It will
 *                     change if the plan changes before the lesson.
 *   recorded (pinned) the plan shown is the one this lesson was TAUGHT AGAINST.
 *                     It no longer moves, which is what makes the write-up true
 *                     afterwards.
 *
 * PHOTOS are org-owned files linked to the lesson (`file_links`), and the rider
 * can see them — that is the one new visibility this task adds. "Scrub" beside a
 * photo is D27's narrow liability exception, not a delete button: it asks for a
 * reason, it is logged, and it is the only thing in this feature that destroys
 * anything.
 */

const STATES: ObjectiveState[] = ['planned', 'working', 'achieved'];

export interface PlanProgressValue {
  outcomes: ObjectiveOutcome[];
  nextFocus: string | null;
}

function outcomeFor(outcomes: ObjectiveOutcome[], id: string): ObjectiveOutcome | undefined {
  return outcomes.find((o) => o.id === id);
}

function MediaTile({
  m,
  readOnly,
  onScrubbed,
}: {
  m: LessonMediaRow;
  readOnly: boolean;
  onScrubbed: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fileDownloadUrl({ bucket_id: m.bucket_id, storage_path: m.storage_path })
      .then((u) => { if (live) setUrl(u); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [m.bucket_id, m.storage_path]);

  const isImage = (m.mime_type ?? '').startsWith('image/');

  async function scrub() {
    // D19: say what it will do BEFORE doing it, and capture a reason.
    const reason = window.prompt(
      `Scrubbing "${m.title || m.filename}" destroys it permanently — it is for content that should never have been captured. Why is it being removed?`,
    );
    if (!reason || !reason.trim()) return;
    setBusy(true);
    try {
      await scrubLessonContent({ kind: 'media', subjectId: m.file_id, reason: reason.trim() });
      onScrubbed();
    } catch (e) {
      window.alert(toErrorMessage(e, 'Could not remove that.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative w-24">
      {url && isImage ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={m.title || m.filename}
            className="w-24 h-24 object-cover rounded border border-green-800/15" />
        </a>
      ) : (
        <a href={url ?? '#'} target="_blank" rel="noreferrer"
          className="w-24 h-24 rounded border border-green-800/15 bg-cream-100 grid place-items-center text-[10px] text-muted p-1 text-center break-all">
          {m.filename}
        </a>
      )}
      {!readOnly && (
        <button
          type="button"
          className="absolute -top-1.5 -right-1.5 bg-white border border-green-800/20 rounded-full p-1 text-green-800/60 hover:text-red-700 focus-ring"
          aria-label={`Scrub ${m.title || m.filename}`}
          disabled={busy}
          onClick={() => void scrub()}
          title="Permanently remove this — for content that should never have been captured"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}

export function LessonPlanProgress({
  bookingId,
  plan,
  nextUp,
  pinned,
  readOnly,
  value,
  onChange,
}: {
  bookingId: string;
  plan: LessonPlan | null;
  nextUp: PlanObjective | null;
  pinned: boolean;
  readOnly: boolean;
  value: PlanProgressValue;
  onChange: (v: PlanProgressValue) => void;
}) {
  const [media, setMedia] = useState<LessonMediaRow[]>([]);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reloadMedia = () => {
    void listLessonMedia(bookingId).then(setMedia).catch(() => setMedia([]));
  };
  useEffect(reloadMedia, [bookingId]);

  function setOutcome(id: string, patch: Partial<ObjectiveOutcome>) {
    const existing = outcomeFor(value.outcomes, id);
    const outcomes = existing
      ? value.outcomes.map((o) => (o.id === id ? { ...o, ...patch } : o))
      : [...value.outcomes, { id, ...patch }];
    onChange({ ...value, outcomes });
  }

  function addDiscovered() {
    onChange({ ...value, outcomes: [...value.outcomes, { label: '', state: 'planned' }] });
  }
  function editDiscovered(index: number, patch: Partial<ObjectiveOutcome>) {
    onChange({ ...value, outcomes: value.outcomes.map((o, i) => (i === index ? { ...o, ...patch } : o)) });
  }
  function removeDiscovered(index: number) {
    onChange({ ...value, outcomes: value.outcomes.filter((_, i) => i !== index) });
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadErr(null);
    try {
      for (const f of Array.from(files)) {
        await uploadLessonMedia(bookingId, f);
      }
      reloadMedia();
    } catch (e) {
      setUploadErr(toErrorMessage(e, 'Could not add that.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const discovered = value.outcomes
    .map((o, i) => ({ o, i }))
    .filter(({ o }) => !o.id);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-green-800/15 bg-cream-100/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted inline-flex items-center gap-1">
          <Target size={12} aria-hidden="true" /> The plan for this Riding Lesson
        </p>
        {plan && (
          <span className="text-[10.5px] text-muted shrink-0">
            {pinned ? `Taught against version ${plan.version}` : `Version ${plan.version} · current`}
          </span>
        )}
      </div>

      {!plan ? (
        <p className="text-sm text-muted">
          This rider has no plan yet. Write what happened below, and put where they are
          going in “What to work on next” — that starts their plan.
        </p>
      ) : (
        <>
          {plan.focus && <p className="text-sm text-green-900 font-medium">{plan.focus}</p>}
          {nextUp && !pinned && (
            <p className="text-[11.5px] text-muted">Lead with: {nextUp.label}</p>
          )}

          {plan.objectives.length === 0 ? (
            <p className="text-xs text-muted">Nothing on the plan yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {plan.objectives.map((o) => {
                const out = outcomeFor(value.outcomes, o.id);
                const state = (out?.state ?? o.state) as ObjectiveState;
                return (
                  <li key={o.id} className="flex flex-col gap-1">
                    <p className="text-sm text-green-900">{o.label}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {STATES.map((s) => (
                        <button
                          key={s}
                          type="button"
                          aria-pressed={state === s}
                          disabled={readOnly}
                          onClick={() => setOutcome(o.id, { state: s })}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors disabled:opacity-40 ${
                            state === s
                              ? 'bg-green-800 text-white border-green-800'
                              : 'bg-white text-green-800 border-green-800/25 hover:border-green-800/60'
                          }`}
                        >
                          {OBJECTIVE_STATE_LABEL[s]}
                        </button>
                      ))}
                      <input
                        className="form-input text-xs flex-1 min-w-[9rem]"
                        disabled={readOnly}
                        value={out?.note ?? o.note ?? ''}
                        placeholder="How it went (the rider sees this)"
                        onChange={(e) => setOutcome(o.id, { note: e.target.value })}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {/* Something Claire noticed during the lesson — captured here, because
          making her leave the form to add it is how it stops being recorded. */}
      {discovered.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {discovered.map(({ o, i }) => (
            <li key={`new-${i}`} className="flex items-center gap-1.5">
              <input
                className="form-input text-xs flex-1"
                disabled={readOnly}
                value={o.label ?? ''}
                placeholder="Something new to work on"
                onChange={(e) => editDiscovered(i, { label: e.target.value })}
              />
              <button type="button" className="p-1 text-green-800/60 hover:text-red-700 focus-ring"
                aria-label="Remove this" disabled={readOnly} onClick={() => removeDiscovered(i)}>
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <button type="button" className="text-xs text-green-800 underline underline-offset-2 self-start"
          onClick={addDiscovered}>
          + Add something new to the plan
        </button>
      )}

      <div>
        <label className="form-label mb-1 block" htmlFor={`nextfocus-${bookingId}`}>
          What to work on next
        </label>
        <input
          id={`nextfocus-${bookingId}`}
          className="form-input text-sm w-full"
          disabled={readOnly}
          value={value.nextFocus ?? ''}
          placeholder={plan?.focus ?? 'Where this rider goes next'}
          onChange={(e) => onChange({ ...value, nextFocus: e.target.value })}
        />
        <p className="text-[11px] text-muted mt-1">
          Leave it as it is to keep the current focus. This is what the rider's next
          Riding Lesson leads with.
        </p>
      </div>

      {/* PHOTOS AND VIDEO (§3 / D27 item 5) */}
      <div>
        <p className="form-label mb-1">Photos and video</p>
        {media.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {media.map((m) => (
              <MediaTile key={m.file_id} m={m} readOnly={readOnly} onScrubbed={reloadMedia} />
            ))}
          </div>
        )}
        {!readOnly && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => void upload(e.target.files)}
            />
            <button
              type="button"
              className="btn-secondary text-xs inline-flex items-center gap-1"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={12} aria-hidden="true" />
              {uploading ? 'Adding…' : media.length > 0 ? 'Add more' : 'Add a photo or video'}
            </button>
            <p className="text-[11px] text-muted mt-1">The rider sees these on their own lesson.</p>
          </>
        )}
        {media.length === 0 && readOnly && <p className="text-xs text-muted">None.</p>}
        {uploadErr && <p className="form-error text-xs mt-1">{uploadErr}</p>}
      </div>
    </section>
  );
}

export default LessonPlanProgress;
