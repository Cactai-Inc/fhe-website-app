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
import {
  listTaskReminders, setTaskReminders,
  type ReminderInput, type ReminderOffset, type ReminderUnit,
} from '../../lib/ops/api-atn';

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
  // A self-authored type: the category select offers "+ Add a type…", which
  // reveals this free-text box. The typed value is saved as the task's category.
  const [addingType, setAddingType] = useState(false);
  const [customType, setCustomType] = useState('');
  const [body, setBody] = useState(task?.body ?? '');
  const [date, setDate] = useState(toDateInput(task?.scheduled_at ?? null) || defaultDate || '');
  const [time, setTime] = useState(toTimeInput(task?.scheduled_at ?? null));
  const [endTime, setEndTime] = useState(toTimeInput(task?.scheduled_end ?? null));
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
  // Reminders (one-time or recurring, independent of alerts). Loaded for an
  // existing task; a fresh task starts with none.
  const [reminders, setReminders] = useState<ReminderInput[]>([]);

  useEffect(() => {
    listTaskCategories().then(setCategories).catch(() => setCategories([]));
    fetchInstructorOptions().then(setStaff).catch(() => setStaff([]));
    listLessonClients().then(setClients).catch(() => setClients([]));
    listScheduleHorses().then(setHorses).catch(() => setHorses([]));
    if (task) {
      listTaskReminders(task.id)
        .then((rs) => setReminders(rs.map((r) => ({
          user_id: r.user_id, contact_id: r.contact_id, offset_kind: r.offset_kind,
          value: r.value, unit: r.unit, recurring: r.recurring,
          via_dashboard: r.via_dashboard, via_modal: r.via_modal, via_email: r.via_email,
        }))))
        .catch(() => setReminders([]));
    }
  }, [task]);

  const addReminder = () => setReminders((prev) => [...prev, {
    user_id: null, contact_id: null, offset_kind: 'after_create' as ReminderOffset,
    value: 1, unit: 'weeks' as ReminderUnit, recurring: false,
    via_dashboard: true, via_modal: false, via_email: false,
  }]);
  const editReminder = (i: number, patch: Partial<ReminderInput>) =>
    setReminders((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeReminder = (i: number) => setReminders((prev) => prev.filter((_, j) => j !== i));

  function scheduledIso(): string | null {
    if (!date) return null;
    return new Date(`${date}T${time || '00:00'}`).toISOString();
  }
  function scheduledEndIso(): string | null {
    if (!date || !time) return null;
    // An explicit end time when given; otherwise a 30-minute block. An all-day
    // task (no time) has no end.
    if (endTime) return new Date(`${date}T${endTime}`).toISOString();
    return new Date(new Date(`${date}T${time}`).getTime() + 30 * 60_000).toISOString();
  }

  function toggleAssignee(userId: string) {
    setAssignees((prev) => (prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]));
  }

  // Picking a horse whose owner or lessee is a client auto-selects that client,
  // so the two links stay consistent (the horse list is tied to the client list).
  function pickHorse(id: string) {
    setHorseId(id);
    if (!id) return;
    const h = horses.find((x) => x.id === id);
    if (!h) return;
    const owner = h.owner_contact_id ?? h.lessee_contact_id;
    if (!owner) return;
    const match = clients.find((c) => c.contact_id === owner);
    if (match) setClientId(match.id);
  }

  async function save() {
    if (!title.trim()) { setErr('Give the task a title.'); return; }
    setBusy(true); setErr(null);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        category: (addingType ? customType.trim() : category) || null,
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
      await setTaskReminders(saved.id, reminders);
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
          {addingType ? (
            <div className="flex gap-2">
              <input className="form-input flex-1" value={customType} autoFocus
                placeholder="Name the new type"
                onChange={(e) => setCustomType(e.target.value)} />
              <button type="button" className="text-sm text-secondary px-3 underline"
                onClick={() => { setAddingType(false); setCustomType(''); }}>Cancel</button>
            </div>
          ) : (
            <select className="form-input" value={category}
              onChange={(e) => {
                if (e.target.value === '__add__') { setAddingType(true); setCategory(''); return; }
                setCategory(e.target.value);
              }}>
              <option value="">General</option>
              {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              <option value="__add__">+ Add a type…</option>
            </select>
          )}
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
          <div className="grid grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="form-label">Date</span>
              <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="form-label">Start</span>
              <input type="time" step={900} className="form-input" value={time}
                onChange={(e) => setTime(e.target.value)} disabled={!date} />
            </label>
            <label className="text-sm">
              <span className="form-label">End</span>
              <input type="time" step={900} className="form-input" value={endTime}
                onChange={(e) => setEndTime(e.target.value)} disabled={!date || !time} />
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
            <select className="form-input" value={horseId} onChange={(e) => pickHorse(e.target.value)}>
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
          <span className="form-label">Assign to</span>
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

        {/* REMINDERS — one-time or recurring, independent of alerts. Each fires via
            the dashboard, a login modal, and/or email. A recurring reminder pushes
            every value·unit until the task is done; a one-time fires once. */}
        <div className="text-sm">
          <span className="form-label">Reminders</span>
          <div className="flex flex-col gap-2">
            {reminders.map((r, i) => (
              <div key={i} className="rounded-lg border border-green-800/12 p-2.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <select className="form-input w-auto" value={r.recurring ? 'every' : 'once'}
                    onChange={(e) => editReminder(i, { recurring: e.target.value === 'every' })}>
                    <option value="once">Once</option>
                    <option value="every">Every</option>
                  </select>
                  <input type="number" min={1} className="form-input w-16" value={r.value}
                    onChange={(e) => editReminder(i, { value: Math.max(1, Number(e.target.value) || 1) })} />
                  <select className="form-input w-auto" value={r.unit}
                    onChange={(e) => editReminder(i, { unit: e.target.value as ReminderUnit })}>
                    <option value="days">days</option>
                    <option value="weeks">weeks</option>
                    <option value="months">months</option>
                  </select>
                  <select className="form-input w-auto" value={r.offset_kind}
                    onChange={(e) => editReminder(i, { offset_kind: e.target.value as ReminderOffset })}>
                    <option value="after_create">from now</option>
                    <option value="before_due">before it&apos;s due</option>
                  </select>
                  <button type="button" className="text-muted hover:text-red-700 text-xs ml-auto"
                    onClick={() => removeReminder(i)} title="Remove reminder">✕</button>
                </div>
                <div className="flex flex-wrap gap-3 text-[12px] text-green-900">
                  {([['via_dashboard', 'Dashboard'], ['via_modal', 'On login'], ['via_email', 'Email']] as const).map(([k, label]) => (
                    <label key={k} className="inline-flex items-center gap-1.5">
                      <input type="checkbox" className="accent-green-700" checked={r[k]}
                        onChange={(e) => editReminder(i, { [k]: e.target.checked })} />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={addReminder}
              className="self-start text-sm text-green-800 border border-dashed border-green-400 rounded-lg px-3 py-1.5 hover:bg-green-50 focus-ring">
              ＋ Add a reminder
            </button>
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
          {/* Mark complete (owner): completing moves the task to the hidden
              Completed/History list. Available once the task exists. */}
          {editing && task!.status !== 'complete' && (
            <button type="button" className="text-sm text-green-800 border border-green-800/25 px-3 py-2 rounded-md hover:bg-green-50"
              disabled={busy}
              onClick={() => void (async () => {
                setBusy(true); setErr(null);
                try { await setTaskStatus(task!.id, 'complete'); onSaved(); }
                catch (e) { setErr(toErrorMessage(e, 'Could not complete the task.')); }
                finally { setBusy(false); }
              })()}>
              Mark complete
            </button>
          )}
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
