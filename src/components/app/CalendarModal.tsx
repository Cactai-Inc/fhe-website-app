/* Calendar modal — the top-right calendar affordance in the app shell. Aggregates
 * EVERYTHING with a date for the member, whether or not they RSVP'd: scheduled
 * lessons, community events, payment/billing due dates, confirmation dates, and
 * expiration dates (holds, documents). Live sources (lessons + events) are layered
 * with the account's dated obligations; the preview falls back to seed data so the
 * calendar is populated before all sources are wired. Newest-first upcoming view. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  X, CalendarDays, GraduationCap, MapPin, ArrowRight,
  CreditCard, BadgeCheck, Clock, ChevronRight,
} from 'lucide-react';
import { fetchEvents } from '../../lib/community';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import { listBillingSchedules, nextDue, type BillingSchedule } from '../../lib/billing';
import type { CommunityEvent } from '../../lib/community-types';
import { SEED_ENABLED, SEED_CALENDAR, type SeedCalKind } from '../../lib/seed';

type Kind = SeedCalKind; // 'lesson' | 'event' | 'payment' | 'expiration' | 'confirmation'

interface Entry { key: string; when: Date; title: string; detail: string; kind: Kind; href: string; }

const ICON: Record<Kind, typeof CalendarDays> = {
  lesson: GraduationCap, event: MapPin, payment: CreditCard, confirmation: BadgeCheck, expiration: Clock,
};
const TINT: Record<Kind, string> = {
  lesson: 'text-green-800', event: 'text-green-800',
  payment: 'text-gold-800', confirmation: 'text-green-700', expiration: 'text-red-700',
};

function fmt(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
function fmtDay(d: Date): string {
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function CalendarModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      myLessonSessions().catch(() => [] as MemberLessonSession[]),
      fetchEvents().catch(() => [] as CommunityEvent[]),
      listBillingSchedules().catch(() => [] as BillingSchedule[]),
    ]).then(([sessions, events, schedules]) => {
      if (!active) return;
      const now = Date.now();
      const rows: Entry[] = [];
      for (const s of sessions) {
        if (s.status === 'CANCELLED') continue;
        rows.push({ key: `lesson-${s.id}`, when: new Date(s.starts_at), kind: 'lesson',
          title: 'Lesson', detail: s.status === 'SCHEDULED' ? 'Scheduled' : s.status.toLowerCase(), href: '/app/schedule' });
      }
      for (const e of events) {
        if (!e.starts_at) continue;
        rows.push({ key: `event-${e.id}`, when: new Date(e.starts_at), kind: 'event',
          title: e.title, detail: e.location || 'Community event', href: '/app/schedule' });
      }
      // Real payment dates: the member's own billing schedules (RLS-scoped) — the
      // next due date per active schedule. (Expirations/confirmations get a live
      // source when a member-readable one exists; today they only show as seed.)
      for (const b of schedules) {
        if (!b.active) continue;
        rows.push({
          key: `payment-${b.id}`, when: nextDue(b.start_date, b.cadence), kind: 'payment',
          title: `Payment due · $${Number(b.amount).toFixed(0)}`,
          detail: b.mode === 'request' ? "We'll send a Zelle request" : 'Zelle payment',
          href: '/app/balance',
        });
      }
      // Seed fallback: if live sources are empty (preview), show the full sample set
      // of dated items across every kind so the calendar reads as populated.
      if (SEED_ENABLED && rows.length === 0) {
        for (const c of SEED_CALENDAR) {
          rows.push({ key: c.id, when: new Date(`${c.date}T09:00:00`), kind: c.kind,
            title: c.title, detail: c.sub || '', href: '/app/schedule' });
        }
      }
      rows.sort((a, b) => a.when.getTime() - b.when.getTime());
      setEntries(rows.filter((r) => r.when.getTime() >= now - 24 * 3600 * 1000));
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:pt-20" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md rounded-lg max-h-[80vh] overflow-y-auto shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream">
          <h2 className="font-serif text-green-800 flex items-center gap-2"><CalendarDays size={18} /> Your calendar</h2>
          <button type="button" onClick={onClose} aria-label="Close calendar"><X size={20} /></button>
        </div>
        <div className="p-4">
          {entries === null && <p className="body-text text-sm text-muted">Loading…</p>}
          {entries?.length === 0 && <p className="body-text text-sm text-muted">Nothing scheduled yet.</p>}
          <ul className="flex flex-col gap-2">
            {entries?.map((e) => {
              const Icon = ICON[e.kind];
              return (
                <li key={e.key}>
                  <Link to={e.href} onClick={onClose}
                    className="flex items-start gap-3 p-3 bg-white border border-green-800/10 rounded-md hover:border-green-800/30">
                    <span className={`mt-0.5 ${TINT[e.kind]}`}><Icon size={16} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-green-900 truncate">{e.title}</span>
                      <span className="block text-xs text-muted">
                        {e.kind === 'payment' || e.kind === 'expiration' ? fmtDay(e.when) : fmt(e.when)}
                        {e.detail && <> · {e.detail}</>}
                      </span>
                    </span>
                    <ChevronRight size={15} className="text-muted mt-1 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link to="/app/schedule" onClick={onClose} className="mt-4 inline-flex items-center gap-1 text-sm text-gold-ink font-sans">
            Full schedule <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
