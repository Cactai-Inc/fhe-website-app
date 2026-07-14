import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  GraduationCap, CalendarDays, Contact, Mail, ChevronRight, Clock, MapPin,
  CheckCircle2, CircleDot,
} from 'lucide-react';
import { listLessonSessions, type LessonSession } from '../../lib/ops/api-lessons';
import { zoneLabel } from '../../lib/formatDateTime';
import { listContacts, listIntake } from '../../lib/api';
import { SEED_ENABLED } from '../../lib/seed';
import { SEED_INSTRUCTOR_SESSIONS, type SeedSession } from '../../lib/seed';

/**
 * INSTRUCTOR HOME — the servicing-scoped management home for trainers (role
 * MANAGER/EMPLOYEE, isTrainer). Distinct from the admin OpsDashboard: this surfaces
 * what a trainer does day-to-day — today's + upcoming lessons, quick servicing
 * actions, clients to reach — not tenant KPIs (billing, moderation, oversight).
 * Read paths use the real servicing seams (listLessonSessions/listContacts/listIntake)
 * with seed fallback when a list is empty.
 */

function fmtDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(iso: string): string {
  return `${new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} ${zoneLabel(iso)}`.trim();
}
function isToday(iso: string): boolean {
  const d = new Date(iso); const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

const STATUS_CHIP: Record<string, { label: string; cls: string; icon: typeof CircleDot }> = {
  scheduled: { label: 'Scheduled', cls: 'text-green-800 bg-green-50 border-green-200', icon: CircleDot },
  completed: { label: 'Completed', cls: 'text-secondary bg-cream-200 border-green-800/15', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', cls: 'text-red-700 bg-red-50 border-red-200', icon: CircleDot },
};

interface Row { id: string; starts_at: string; ends_at: string; status: string; location: string | null; who: string; notes: string | null; }

function toRow(s: LessonSession): Row {
  return { id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, status: s.status, location: s.location, who: 'Client', notes: s.notes };
}
function seedToRow(s: SeedSession): Row {
  return { id: s.id, starts_at: s.starts_at, ends_at: s.ends_at, status: s.status, location: s.location, who: s.rider, notes: s.focus };
}

function ActionTile({ to, icon: Icon, label, sub }: { to: string; icon: typeof Mail; label: string; sub: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 bg-white border border-green-800/10 rounded-xl px-4 py-3.5 hover:border-green-800/25 hover:shadow-sm transition-all focus-ring">
      <span className="w-10 h-10 rounded-lg bg-cream-100 grid place-items-center text-green-700 shrink-0"><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-green-900">{label}</span>
        <span className="block text-[11.5px] text-muted">{sub}</span>
      </span>
      <ChevronRight size={16} className="text-muted shrink-0" />
    </Link>
  );
}

function LessonRow({ r }: { r: Row }) {
  const chip = STATUS_CHIP[r.status] ?? STATUS_CHIP.scheduled;
  return (
    <div className="flex items-start gap-3 bg-white border border-green-800/10 rounded-xl px-4 py-3">
      <div className="text-center shrink-0 w-14">
        <p className="font-serif text-green-800 text-[15px] font-semibold leading-none">{fmtTime(r.starts_at)}</p>
        <p className="text-[10px] text-muted mt-1">{fmtDay(r.starts_at)}</p>
      </div>
      <div className="min-w-0 flex-1 border-l border-green-800/10 pl-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-green-900 truncate">{r.who}</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold shrink-0 inline-flex items-center gap-1 ${chip.cls}`}>
            <chip.icon size={10} /> {chip.label}
          </span>
        </div>
        {r.notes && <p className="text-[11.5px] text-muted mt-0.5 line-clamp-1">{r.notes}</p>}
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1"><Clock size={11} /> {fmtTime(r.starts_at)}–{fmtTime(r.ends_at)}</span>
          {r.location && <span className="inline-flex items-center gap-1"><MapPin size={11} /> {r.location}</span>}
        </div>
      </div>
    </div>
  );
}

export default function InstructorHome() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [intakeCount, setIntakeCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    listLessonSessions()
      .then((s) => { if (active) setRows(s.map(toRow)); })
      .catch(() => { if (active) setRows([]); });
    listContacts().then((c) => active && setClientCount(c.length)).catch(() => active && setClientCount(null));
    listIntake().then((i) => active && setIntakeCount(i.filter((r) => r.status === 'new' || r.status === 'contacted').length)).catch(() => active && setIntakeCount(null));
    return () => { active = false; };
  }, []);

  const effectiveRows: Row[] = (rows && rows.length > 0)
    ? rows
    : (SEED_ENABLED ? SEED_INSTRUCTOR_SESSIONS.map(seedToRow) : []);

  const today = effectiveRows.filter((r) => isToday(r.starts_at)).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const upcoming = effectiveRows.filter((r) => !isToday(r.starts_at) && new Date(r.starts_at) >= new Date()).sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)).slice(0, 6);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Helmet><title>Servicing · French Heritage</title></Helmet>

      <div className="mb-5">
        <h1 className="font-serif text-2xl text-green-800">Your day</h1>
        <p className="body-text text-sm text-muted mt-0.5">Lessons, clients, and requests you're servicing.</p>
      </div>

      {/* Quick servicing actions */}
      <div className="grid sm:grid-cols-2 gap-2.5 mb-6">
        <ActionTile to="/app/ops/lessons" icon={GraduationCap} label="Lessons" sub="Sessions, packages, credits" />
        <ActionTile to="/app/calendar" icon={CalendarDays} label="Availability" sub="Set the times you teach" />
        <ActionTile to="/app/ops/contacts" icon={Contact} label="Clients" sub={clientCount !== null ? `${clientCount} on file` : 'People you service'} />
        <ActionTile to="/app/ops/intake" icon={Mail} label="Requests" sub={intakeCount !== null ? `${intakeCount} to review` : 'Incoming inquiries'} />
      </div>

      {/* Today */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="font-serif text-green-800 text-lg">Today</h2>
          <Link to="/app/ops/lessons" className="text-[12px] text-gold-800 font-semibold inline-flex items-center gap-1">All sessions <ChevronRight size={13} /></Link>
        </div>
        {today.length > 0 ? (
          <div className="flex flex-col gap-2">{today.map((r) => <LessonRow key={r.id} r={r} />)}</div>
        ) : (
          <div className="bg-white border border-green-800/10 rounded-xl px-4 py-6 text-center">
            <p className="text-[13px] text-muted">No lessons scheduled today.</p>
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="font-serif text-green-800 text-lg mb-2.5">Upcoming</h2>
          <div className="flex flex-col gap-2">{upcoming.map((r) => <LessonRow key={r.id} r={r} />)}</div>
        </div>
      )}
    </div>
  );
}
