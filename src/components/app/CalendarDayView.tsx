import { useState } from 'react';
import { X, Clock, CheckCircle2, Circle, Plus } from 'lucide-react';
import type { CalendarItem } from '../../lib/ops/api-calendar';
import type { Task } from '../../lib/ops/api-tasks';
import { BookingView } from './BookingView';
import { Modal } from '../ops/kit/Modal';

/**
 * DAY VIEW — the day as a rundown, and (on desktop) a workspace beside it.
 *
 * The day's timed items (client bookings + scheduled tasks) list in start order,
 * with the untimed "to do today" tasks in a strip above them. Selecting an item:
 *   - desktop: opens its surface in the RIGHT pane (a booking → BookingView with
 *     its activity workspace; a task → the task editor). Nothing selected → the
 *     staff member's task list fills the pane.
 *   - mobile: signals the parent to open the same surface as a modal (there is
 *     not room for a side pane).
 *
 * This is the interactive surface Claire and clients live in, so it is built
 * mobile-first and the desktop pane is the same content given more room. The
 * dashboard renders a compact version of the left rundown from the same data.
 */
export function CalendarDayView({
  bookings, tasks,
  onEditBooking, onSelectTask, onAddTask, onReload,
  compact = false,
}: {
  day: Date;
  bookings: CalendarItem[];
  tasks: Task[];
  isStaff: boolean;
  onEditBooking?: (b: CalendarItem) => void;
  /** Open the task editor (both platforms). */
  onSelectTask: (t: Task) => void;
  onAddTask: () => void;
  onReload: () => void;
  /** Dashboard rundown: left list only, no right pane, tighter chrome. */
  compact?: boolean;
}) {
  /* One selection drives both layouts: on desktop the right pane shows it, on
     mobile the same selection opens a modal. No viewport JS — CSS decides which
     is visible. */
  const [sel, setSel] = useState<{ kind: 'booking'; item: CalendarItem } | null>(null);

  const timedTasks = tasks.filter((t) => t.scheduled_at && timeOf(t.scheduled_at) !== null);
  const untimedTasks = tasks.filter((t) => !t.scheduled_at || timeOf(t.scheduled_at) === null);

  // Merge bookings + timed tasks into one start-ordered rundown.
  type Row =
    | { kind: 'booking'; at: number; item: CalendarItem }
    | { kind: 'task'; at: number; task: Task };
  const rows: Row[] = [
    ...bookings.map((b) => ({ kind: 'booking' as const, at: new Date(b.starts_at).getTime(), item: b })),
    ...timedTasks.map((t) => ({ kind: 'task' as const, at: new Date(t.scheduled_at!).getTime(), task: t })),
  ].sort((a, b) => a.at - b.at);

  function pickBooking(b: CalendarItem) {
    setSel({ kind: 'booking', item: b });
  }

  const rundown = (
    <div className="flex flex-col gap-3">
      {/* Untimed "to do today" strip, above the timed rundown. */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted">To do today</p>
          <button type="button" onClick={onAddTask}
            className="text-xs text-green-800 inline-flex items-center gap-1 hover:underline">
            <Plus size={12} /> Task
          </button>
        </div>
        {untimedTasks.length === 0 ? (
          <p className="text-xs text-muted">Nothing untimed.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {untimedTasks.map((t) => <TaskRow key={t.id} task={t} onClick={() => onSelectTask(t)} />)}
          </ul>
        )}
      </div>

      {/* Timed rundown. */}
      <div className="border-t border-green-800/10 pt-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted py-2">Nothing scheduled.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {rows.map((r) => r.kind === 'booking' ? (
              <li key={`b-${r.item.id}`}>
                <button type="button" onClick={() => pickBooking(r.item)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                    sel?.item.id === r.item.id
                      ? 'border-green-800 bg-green-800/5'
                      : 'border-green-800/15 bg-white hover:border-green-800/40'}`}>
                  <p className="text-sm font-medium text-green-900 inline-flex items-center gap-1.5">
                    <Clock size={12} className="text-green-800/60" />
                    {timeLabel(r.item.starts_at)} · {r.item.offering_name || 'Session'}
                  </p>
                  {r.item.client_name && <p className="text-xs text-green-800/70 ml-5">{r.item.client_name}</p>}
                </button>
              </li>
            ) : (
              <li key={`t-${r.task.id}`}>
                <TaskRow task={r.task} onClick={() => onSelectTask(r.task)} withTime />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  /* A function, not a computed element: reading sel.item before the null-check
     would throw and blank the page. Called only where sel is known non-null. */
  const workspace = (item: CalendarItem) => (
    <BookingView
      item={item}
      onEdit={onEditBooking ? () => onEditBooking(item) : undefined}
      onReschedule={onEditBooking ? () => onEditBooking(item) : undefined}
      onChanged={() => { setSel(null); onReload(); }}
    />
  );

  // The compact dashboard rundown: list only, but a tapped booking still opens
  // its surface as a modal (there is no pane on the dashboard).
  if (compact) {
    return (
      <>
        {rundown}
        {sel && (
          <Modal open onClose={() => setSel(null)} size="lg" panelClassName="bg-cream" title="Booking">
            {workspace(sel.item)}
          </Modal>
        )}
      </>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,22rem)_1fr] gap-4">
      <div className="lg:border-r lg:border-green-800/10 lg:pr-4">{rundown}</div>

      {/* Desktop right pane. */}
      <div className="hidden lg:block min-h-[24rem]">
        {sel ? (
          <div className="relative bg-white border border-green-800/10 rounded-xl p-5">
            <button type="button" aria-label="Close" onClick={() => setSel(null)}
              className="absolute right-3 top-3 p-1.5 rounded-lg text-green-800/60 hover:text-green-900 hover:bg-green-800/5">
              <X size={18} />
            </button>
            {workspace(sel.item)}
          </div>
        ) : (
          // Nothing selected → the staff member's task list fills the pane.
          <div className="bg-white border border-green-800/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-serif text-lg text-green-900">Tasks</p>
              <button type="button" onClick={onAddTask}
                className="btn-secondary text-xs px-3 py-1.5 inline-flex items-center gap-1">
                <Plus size={13} /> New task
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks for this day. Add one, or pick a booking on the left to work on it.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {tasks.map((t) => <TaskRow key={t.id} task={t} onClick={() => onSelectTask(t)} withTime />)}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Mobile: the same selection opens as a modal (the side pane is hidden). */}
      <div className="lg:hidden">
        {sel && (
          <Modal open onClose={() => setSel(null)} size="lg" panelClassName="bg-cream" title="Booking">
            {workspace(sel.item)}
          </Modal>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, onClick, withTime = false }: { task: Task; onClick: () => void; withTime?: boolean }) {
  const done = task.status === 'complete';
  const t = task.scheduled_at ? timeOf(task.scheduled_at) : null;
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-lg border border-green-800/15 bg-white hover:border-green-800/40 px-3 py-2 flex items-center gap-2">
      {done ? <CheckCircle2 size={14} className="text-green-700 shrink-0" />
            : <Circle size={14} className="text-green-800/40 shrink-0" />}
      <span className="min-w-0 flex-1">
        <span className={`text-sm ${done ? 'line-through text-green-800/50' : 'text-green-900'}`}>
          {withTime && t ? `${t} · ` : ''}{task.title}
        </span>
        {task.category && <span className="text-[11px] text-green-800/60 ml-1.5">{task.category.toLowerCase().replace(/_/g, ' ')}</span>}
      </span>
    </button>
  );
}

function timeOf(iso: string): string | null {
  const d = new Date(iso);
  // A midnight stamp is our "date only, no time" convention.
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return timeLabel(iso);
}
function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default CalendarDayView;
