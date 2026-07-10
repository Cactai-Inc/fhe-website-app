import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { myNotifications, type AppNotification } from '../../lib/api';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import { fetchEvents } from '../../lib/community';
import { listBillingSchedules, nextDue, type BillingSchedule } from '../../lib/billing';
import type { CommunityEvent } from '../../lib/community-types';
import { supabase } from '../../lib/supabase';
import { useNavigate as useNav } from 'react-router-dom';

/**
 * DASHBOARD PANEL — the thin, high-value strip above the community feed on the
 * main page. Two bands, LIVE-wired and clickable:
 *   "Needs your attention" — unread notifications (each links to its target) and
 *   a billing due-date inside the next 7 days.
 *   "Coming up" — the next scheduled lessons and community events.
 * Renders nothing when there is truly nothing (no placeholder filler).
 */

interface Tile {
  id: string;
  kind: string;
  title: string;
  sub?: string;
  cta: string;
  to: string;
  gold?: boolean;
}

function TileCard({ tile }: { tile: Tile }) {
  const navigate = useNavigate();
  return (
    <div
      className={`rounded-xl p-4 border ${
        tile.gold
          ? 'border-gold-400 shadow-[0_0_0_1px_theme(colors.gold.400)] bg-gradient-to-br from-gold-50 to-white'
          : 'border-green-800/10 bg-white'
      }`}
    >
      <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold mb-1.5">{tile.kind}</p>
      <p className="font-serif text-green-800 text-xl leading-tight font-semibold">{tile.title}</p>
      {tile.sub && <p className="text-sm text-muted mt-1">{tile.sub}</p>}
      <button
        type="button"
        onClick={() => navigate(tile.to)}
        className="inline-flex mt-3 text-[10.5px] tracking-wide uppercase text-white bg-green-800 px-3.5 py-2 rounded-lg font-medium hover:bg-green-700 focus-ring"
      >
        {tile.cta} →
      </button>
    </div>
  );
}

interface ChecklistRow {
  kind: string; id: string; title: string; action: string; link: string; done: boolean;
}

/** ONE card for everything assigned to the member — the same checklist their
 *  invitation email listed. Ticks itself off live; each row opens its item.
 *  One card instead of a tile per item. */
function ChecklistCard({ rows }: { rows: ChecklistRow[] }) {
  const navigate = useNav();
  const remaining = rows.filter((r) => !r.done).length;
  return (
    <div className="rounded-xl p-4 border border-gold-400 shadow-[0_0_0_1px_theme(colors.gold.400)] bg-gradient-to-br from-gold-50 to-white sm:col-span-2 lg:col-span-3">
      <p className="text-[9px] tracking-widest uppercase text-gold-800 font-semibold mb-1.5">Your checklist</p>
      <p className="font-serif text-green-800 text-xl leading-tight font-semibold mb-2.5">
        {remaining === 0 ? 'All done ✓' : `${remaining} thing${remaining === 1 ? '' : 's'} to take care of`}
      </p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <button key={`${r.kind}-${r.id}`} type="button" onClick={() => navigate(r.link)}
            className="flex items-center gap-2.5 text-left px-2.5 py-2 rounded-lg hover:bg-white/70 focus-ring">
            <span className={`w-[18px] h-[18px] rounded-full grid place-items-center text-[11px] shrink-0 ${
              r.done ? 'bg-green-700 text-white' : 'border-2 border-gold-600/60 text-transparent'
            }`}>
              ✓
            </span>
            <span className="min-w-0">
              <span className={`block text-sm ${r.done ? 'text-muted line-through' : 'text-green-900 font-medium'}`}>{r.title}</span>
              {!r.done && <span className="block text-[11.5px] text-muted">{r.action}</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtTime(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function DashboardPanel() {
  const [attention, setAttention] = useState<Tile[]>([]);
  const [comingUp, setComingUp] = useState<Tile[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      myNotifications().catch(() => [] as AppNotification[]),
      myLessonSessions().catch(() => [] as MemberLessonSession[]),
      fetchEvents().catch(() => [] as CommunityEvent[]),
      listBillingSchedules().catch(() => [] as BillingSchedule[]),
      supabase.rpc('my_onboarding_checklist')
        .then(({ data, error }) => (error ? [] : ((data as ChecklistRow[]) ?? []))) as Promise<ChecklistRow[]>,
    ]).then(([notifications, sessions, events, schedules, cl]) => {
      if (active) setChecklist(cl.some((r) => !r.done) ? cl : []);
      if (!active) return;
      const now = Date.now();

      // ── needs attention: unread notifications (linked) + imminent billing ──
      const att: Tile[] = notifications
        .filter((n) => !n.read_at)
        .slice(0, 3)
        .map((n) => ({
          id: `n-${n.id}`, kind: n.kind.replace(/_/g, ' '), title: n.title,
          sub: n.body ?? undefined, cta: 'Open', to: n.link || '/app', gold: true,
        }));
      for (const b of schedules) {
        if (!b.active || !b.reminders_on) continue;
        const due = nextDue(b.start_date, b.cadence);
        const days = Math.ceil((due.getTime() - now) / 86400000);
        if (days >= 0 && days <= 7) {
          att.push({
            id: `bill-${b.id}`, kind: 'payment', gold: true,
            title: `$${Number(b.amount).toFixed(0)} due ${fmtDay(due)}`,
            sub: b.mode === 'request' ? "We'll send a Zelle request" : 'Zelle payment',
            cta: 'View billing', to: '/app/balance',
          });
        }
      }

      // ── coming up: next lessons + next events ──
      const up: Tile[] = [];
      for (const s of sessions) {
        if (s.status !== 'SCHEDULED') continue;
        const t = new Date(s.starts_at);
        if (t.getTime() < now) continue;
        up.push({
          id: `l-${s.id}`, kind: 'lesson', title: fmtTime(t),
          sub: s.location ?? undefined, cta: 'Schedule', to: '/app/schedule',
        });
        if (up.length >= 2) break;
      }
      for (const e of events) {
        if (!e.starts_at || new Date(e.starts_at).getTime() < now) continue;
        up.push({
          id: `e-${e.id}`, kind: 'event', title: e.title,
          sub: fmtTime(new Date(e.starts_at)), cta: 'Details', to: '/app/schedule',
        });
        if (up.length >= 4) break;
      }

      setAttention(att.slice(0, 3));
      setComingUp(up.slice(0, 3));
    });
    return () => { active = false; };
  }, []);

  if (attention.length === 0 && comingUp.length === 0 && checklist.length === 0) return null;

  return (
    <div className="rounded-2xl border border-green-800/10 shadow-[0_14px_34px_-14px_rgba(13,33,24,0.22)] bg-gradient-to-br from-white to-cream-100 p-5 sm:p-6 mb-6 sm:mb-7">
      {(attention.length > 0 || checklist.length > 0) && (
        <>
          <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mb-3">Needs your attention</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {checklist.length > 0 && <ChecklistCard rows={checklist} />}
            {attention.map((t) => <TileCard key={t.id} tile={t} />)}
          </div>
        </>
      )}
      {comingUp.length > 0 && (
        <>
          <p className={`text-[10px] tracking-widest uppercase text-muted font-semibold mb-3 ${attention.length > 0 ? 'mt-5' : ''}`}>Coming up</p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {comingUp.map((t) => <TileCard key={t.id} tile={t} />)}
          </div>
        </>
      )}
    </div>
  );
}
