import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, X, Plus } from 'lucide-react';
import {
  dashboardAlerts, dashboardNotifications, markNotificationsSeen,
  dismissAlert, type DashboardAlert, type DashboardNotification,
} from '../../../lib/ops/api-atn';
import { listTasks, type Task } from '../../../lib/ops/api-tasks';
import { TaskModal } from '../TaskModal';

/**
 * ATN GRID — the Alerts / Notifications / Tasks rows that sit below the dashboard
 * KPI ribbon and above the zones (owner, 2026-09-13). Three rows, each a
 * horizontal scroller of cards:
 *   Alerts        — urgent; hidden when empty; click a card → modal with its task.
 *   Notifications — awareness; hidden when empty; marked seen on render (auto-clear
 *                   next load); a ✕ dismisses now.
 *   Tasks         — always shown; an Add card leads the row.
 * Cards advance ONE at a time on desktop (owner's chosen style); mobile scrolls
 * natively with the third card half-off as the affordance. Newest first (owner).
 */

/** One horizontally-advancing row of cards. On desktop a ▸ advances one card and
 *  the last visible card fades; on mobile it is a native scroll snap. */
function CardRow({ title, children, count, leading }: {
  title: string; count: number; leading?: React.ReactNode; children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = () => {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  };
  useEffect(() => { sync(); }, [children]);

  // Advance by one card width (the first child's width + gap).
  const step = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('[data-atn-card]');
    const by = first ? first.offsetWidth + 12 : el.clientWidth * 0.8;
    el.scrollBy({ left: by * dir, behavior: 'smooth' });
  };

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <h2 className="text-[11px] uppercase tracking-wide text-green-800/70 font-medium">
          {title}{count > 0 ? ` (${count})` : ''}
        </h2>
      </div>
      <div className="relative">
        {!atStart && (
          <button type="button" aria-label={`${title}: previous`} onClick={() => step(-1)}
            className="hidden md:flex absolute left-0 top-0 bottom-0 z-10 items-center pr-4 pl-1 bg-gradient-to-r from-cream via-cream/90 to-transparent">
            <ChevronLeft size={20} className="text-green-800" />
          </button>
        )}
        <div ref={scroller} onScroll={sync}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-1
                     [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {leading}
          {children}
        </div>
        {!atEnd && (
          <button type="button" aria-label={`${title}: next`} onClick={() => step(1)}
            className="hidden md:flex absolute right-0 top-0 bottom-0 z-10 items-center pl-6 pr-1 bg-gradient-to-l from-cream via-cream/90 to-transparent">
            <ChevronRight size={20} className="text-green-800" />
          </button>
        )}
      </div>
    </section>
  );
}

const CARD =
  'data-atn-card snap-start shrink-0 w-[46%] sm:w-64 rounded-xl border p-3 bg-white text-left';

function AlertCard({ a, onOpen }: { a: DashboardAlert; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}
      data-atn-card
      className={`${CARD} ${a.severity === 'priority' ? 'border-red-300' : 'border-gold-400/50'} hover:border-green-600 focus-ring`}>
      <p className="text-sm font-medium text-green-900 truncate">{a.title}</p>
      {a.body && <p className="text-[12px] text-secondary mt-0.5 line-clamp-2">{a.body}</p>}
      <p className="text-[11px] text-muted mt-1.5">{new Date(a.created_at).toLocaleDateString()}</p>
    </button>
  );
}

function NotificationCard({ n, onDismiss }: { n: DashboardNotification; onDismiss: () => void }) {
  const inner = (
    <>
      <p className="text-sm text-green-900 truncate pr-5">{n.title}</p>
      {n.body && <p className="text-[12px] text-secondary mt-0.5 line-clamp-2">{n.body}</p>}
      <p className="text-[11px] text-muted mt-1.5">{new Date(n.created_at).toLocaleDateString()}</p>
    </>
  );
  return (
    <div data-atn-card className={`${CARD} relative border-green-800/12`}>
      <button type="button" aria-label="Dismiss" onClick={onDismiss}
        className="absolute top-2 right-2 text-muted hover:text-green-800 focus-ring rounded">
        <X size={14} />
      </button>
      {n.link ? <Link to={n.link} className="block">{inner}</Link> : inner}
    </div>
  );
}

function TaskCard({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const overdue = t.due_at && new Date(t.due_at) < new Date() && t.status !== 'complete';
  return (
    <button type="button" onClick={onOpen} data-atn-card
      className={`${CARD} ${overdue ? 'border-red-300' : 'border-green-800/12'} hover:border-green-600 focus-ring`}>
      <p className="text-sm font-medium text-green-900 truncate">{t.title}</p>
      {t.category && <p className="text-[11px] text-green-800/70 mt-0.5">{t.category}</p>}
      <p className="text-[11px] text-muted mt-1.5">
        {t.due_at ? `due ${new Date(t.due_at).toLocaleDateString()}` : t.status.replace('_', ' ')}
        {overdue ? ' · overdue' : ''}
      </p>
    </button>
  );
}

function AlertModal({ a, onClose }: { a: DashboardAlert; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-cream rounded-2xl border border-green-800/15 shadow-lg w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="font-serif text-xl text-green-900">{a.title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}
            className="text-muted hover:text-green-800 focus-ring rounded"><X size={18} /></button>
        </div>
        {a.body && <p className="text-sm text-green-900 mb-3">{a.body}</p>}
        {a.has_task && (
          <p className="text-[12px] text-green-800/70 mb-3">There is an action to take on this.</p>
        )}
        <div className="flex flex-wrap gap-2">
          {a.link && (
            <Link to={a.link} onClick={onClose}
              className="btn-primary text-sm">Go to it</Link>
          )}
          <button type="button"
            onClick={() => void dismissAlert({ source: a.source, entityId: a.entity_id }).then(onClose)}
            className="text-sm text-secondary underline px-2">Dismiss</button>
        </div>
      </div>
    </div>
  );
}

export function AtnGrid() {
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);
  const [notes, setNotes] = useState<DashboardNotification[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [openAlert, setOpenAlert] = useState<DashboardAlert | null>(null);
  const [taskModal, setTaskModal] = useState<Task | null | 'new'>(null);

  const load = () => {
    dashboardAlerts().then(setAlerts).catch(() => setAlerts([]));
    dashboardNotifications().then(setNotes).catch(() => setNotes([]));
    listTasks({ statuses: ['new', 'in_progress'] }).then(setTasks).catch(() => setTasks([]));
  };
  useEffect(load, []);

  // Notifications are "seen" once rendered — stamp them so they auto-clear next load.
  useEffect(() => {
    if (notes.length === 0) return;
    void markNotificationsSeen(notes.map((n) => n.id)).catch(() => {});
  }, [notes]);

  const dismissNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="mb-6">
      {alerts.length > 0 && (
        <CardRow title="Alerts" count={alerts.length}>
          {alerts.map((a) => (
            <AlertCard key={`${a.source}:${a.entity_id ?? a.title}`} a={a} onOpen={() => setOpenAlert(a)} />
          ))}
        </CardRow>
      )}

      {notes.length > 0 && (
        <CardRow title="Notifications" count={notes.length}>
          {notes.map((n) => (
            <NotificationCard key={n.id} n={n} onDismiss={() => dismissNote(n.id)} />
          ))}
        </CardRow>
      )}

      <CardRow title="Tasks" count={tasks.length}
        leading={
          <button type="button" onClick={() => setTaskModal('new')} data-atn-card
            className={`${CARD} border-dashed border-green-400 text-green-800 hover:bg-green-50 flex flex-col items-center justify-center gap-1 focus-ring`}>
            <Plus size={20} />
            <span className="text-sm">Add a task</span>
          </button>
        }>
        {tasks.map((t) => (
          <TaskCard key={t.id} t={t} onOpen={() => setTaskModal(t)} />
        ))}
      </CardRow>

      {/* Out-of-the-way door to completed tasks and everything dismissed (owner). */}
      <div className="mt-1 text-right">
        <Link to="/app/ops/history"
          className="text-[11px] text-green-800/50 hover:text-green-800 underline focus-ring rounded">
          History
        </Link>
      </div>

      {openAlert && <AlertModal a={openAlert} onClose={() => { setOpenAlert(null); load(); }} />}
      {taskModal !== null && (
        <TaskModal task={taskModal === 'new' ? null : taskModal}
          onClose={() => setTaskModal(null)}
          onSaved={() => { setTaskModal(null); load(); }} />
      )}
    </div>
  );
}

export default AtnGrid;
