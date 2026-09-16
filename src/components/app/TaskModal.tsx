import { useEffect, useState } from 'react';
import { Modal } from '../ops/kit/Modal';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  createTask, updateTask, setTaskStatus, deleteTask, setTaskLinks, setTaskAssignees,
  listTaskCategories,
  type Task, type TaskStatus, type TaskCategory, type TaskLinkType,
} from '../../lib/ops/api-tasks';
import { fetchInstructorOptions, type InstructorOption } from '../../lib/ops/api-calendar';
import { listLessonClients, listScheduleHorses } from '../../lib/ops/api-lessons';
import type { LessonClientOption, ScheduleHorseOption } from '../../lib/ops/api-lessons';

/**
 * TASK MODAL — the one create/edit surface for a task, reused by the calendar
 * (a task-typed item: farrier, vet, medications, own-horse care, or a plain
 * to-do), the Day view, and the dashboard Tasks section.
 *
 * A task is work NOT tied to a client purchase. Scheduling is optional: give it a
 * date to put it on the calendar, add a time to place it at an hour (and, if it
 * is a timed thing the person is busy during, tick "blocks my time"); leave the
 * date off and it is an untimed to-do. Category, links (a horse or a client),
 * and staff assignees are set here; reminders and alerts are a later layer.
 */
function toDateInput(iso: string | null): string {
  return iso ? new Date(iso).toISOString().slice(0, 10) : '';
}
function toTimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function TaskModal({
  task, defaultDate, presetLink, onClose, onSaved,
}: {
  /** Editing an existing task, or null to create one. */
  task: Task | null;
  /** Prefill the schedule date (e.g. the calendar day that was clicked). */
  defaultDate?: string;
  /** Prefill a link (e.g. the horse whose record opened this). */
  presetLink?: { link_type: TaskLinkType; target_id: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!task;
  const [categories, setCategories] = useState<TaskCategory[]>([]);
  const [staff, setStaff] = useState<InstructorOption[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [horses, setHorses] = useState<ScheduleHorseOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState(task?.title ?? '');
  const [category, setCategory] = useState(task?.category ?? '');
  const [body, setBody] = useState(task?.body ?? '');
  const [date, setDate] = useState(toDateInput(task?.scheduled_at ?? null) || defaultDate || '');
  const [time, setTime] = useState(toTimeInput(task?.scheduled_at ?? null));
  const [blocks, setBlocks] = useState(task?.blocks_availability ?? false);
  const [status, setStatusVal] = useState<TaskStatus>(task?.status ?? 'new');
  const [assignees, setAssignees] = useState<string[]>(task?.assignees.map((a) => a.user_id) ?? []);
  const [horseId, setHorseId] = useState(
    task?.links.find((l) => l.link_type === 'horse')?.target_id
      ?? (presetLink?.link_type === 'horse' ? presetLink.target_id : ''),
  );
  const [clientId, setClientId] = useState(
    task?.links.find((l) => l.link_type === 'client')?.target_id
      ?? (presetLink?.link_type === 'client' ? presetLink.target_id : ''),
  );

  useEffect(() => {
    listTaskCategories().then(setCategories).catch(() => setCategories([]));
    fetchInstructorOptions().then(setStaff).catch(() => setStaff([]));
    listLessonClients().then(setClients).catch(() => setClients([]));
    listScheduleHorses().then(setHorses).catch(() => setHorses([]));
  }, []);

  function scheduledIso(): string | null {
    if (!date) return null;
    return new Date(`${date}T${time || '00:00'}`).toISOString();
  }
  function scheduledEndIso(): string | null {
    if (!date || !time) return null;
    // A timed task defaults to a 30-minute block; an all-day task has no end.
    return new Date(new Date(`${date}T${time}`).getTime() + 30 * 60_000).toISOString();
  }

  function toggleAssignee(userId: string) {
    setAssignees((prev) => (prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]));
  }

  async function save() {
    if (!title.trim()) { setErr('Give the task a title.'); return; }
    setBusy(true); setErr(null);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        category: category || null,
        scheduled_at: scheduledIso(),
        scheduled_end: scheduledEndIso(),
        blocks_availability: blocks,
      };
      const saved = editing ? await updateTask(task!.id, payload) : await createTask(payload);
      const links: { link_type: TaskLinkType; target_id: string }[] = [];
      if (horseId) links.push({ link_type: 'horse', target_id: horseId });
      if (clientId) links.push({ link_type: 'client', target_id: clientId });
      await setTaskLinks(saved.id, links);
      await setTaskAssignees(saved.id, assignees.map((user_id) => ({ user_id })));
      if (editing && status !== task!.status) await setTaskStatus(saved.id, status);
      onSaved();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not save the task.'));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!task) return;
    if (!window.confirm('Delete this task? It moves to history and can be restored.')) return;
    setBusy(true); setErr(null);
    try { await deleteTask(task.id); onSaved(); }
    catch (e) { setErr(toErrorMessage(e, 'Could not delete the task.')); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={onClose} size="lg" panelClassName="bg-cream" error={err}
      title={editing ? 'Task' : 'New task'}>
      <div className="flex flex-col gap-4">
        <label className="text-sm">
          <span className="form-label">Title</span>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Farrier — Tiz, front shoes" autoFocus />
        </label>

        <label className="text-sm">
          <span className="form-label">Type</span>
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">General</option>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </label>

        <label className="text-sm">
          <span className="form-label">Notes</span>
          <textarea rows={2} className="form-input resize-none" value={body}
            onChange={(e) => setBody(e.target.value)} />
        </label>

        {/* Scheduling is optional — a date puts it on the calendar; a time places
            it at an hour; no date = an untimed to-do. */}
        <div className="rounded-lg bg-green-800/5 border border-green-800/10 p-3 flex flex-col gap-3">
          <p className="form-label mb-0">When (optional)</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="form-label">Date</span>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="form-label">Time</span>
              <input type="time" className="form-input" value={time} onChange={(e) => setTime(e.target.value)}
                disabled={!date} />
            </label>
          </div>
          {date && time && (
            <label className="inline-flex items-center gap-2 text-sm text-green-900">
              <input type="checkbox" checked={blocks} onChange={(e) => setBlocks(e.target.checked)} />
              Block my time — mark this timeframe unavailable
            </label>
          )}
          {date && !time && (
            <p className="text-xs text-muted">No time set — this shows in the day's “to do” list, not at an hour.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="form-label">Horse (optional)</span>
            <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)}>
              <option value="">None</option>
              {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="form-label">Client (optional)</span>
            <select className="form-input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">None</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <div className="text-sm">
          <span className="form-label">Assigned to</span>
          <div className="flex flex-wrap gap-1.5">
            {staff.map((s) => {
              const on = assignees.includes(s.user_id);
              return (
                <button key={s.user_id} type="button" aria-pressed={on}
                  onClick={() => toggleAssignee(s.user_id)}
                  className={`text-xs px-2.5 py-1.5 border rounded-md ${on
                    ? 'bg-green-800 text-white border-green-800'
                    : 'bg-white text-green-900 border-green-800/20 hover:border-green-800/50'}`}>
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {editing && (
          <label className="text-sm">
            <span className="form-label">Status</span>
            <select className="form-input" value={status} onChange={(e) => setStatusVal(e.target.value as TaskStatus)}>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="complete">Complete</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button type="button" className="btn-primary flex-1 justify-center" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Create task'}
          </button>
          {editing && (
            <button type="button" className="text-sm text-red-700 px-3 py-2 hover:bg-red-50 rounded-md"
              disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TaskModal;
