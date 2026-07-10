/* Calendar modal (Slice 4) — the top-right calendar affordance in the app shell.
 * A light month-agnostic upcoming view: the member's scheduled lesson sessions +
 * community events they can RSVP to, newest first. Reuses the same data sources as
 * the Schedule page; this is the glanceable version reachable from anywhere. */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, CalendarDays, GraduationCap, MapPin, ArrowRight } from 'lucide-react';
import { fetchEvents } from '../../lib/community';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import type { CommunityEvent } from '../../lib/community-types';

interface Entry {
  key: string;
  when: Date;
  title: string;
  detail: string;
  kind: 'lesson' | 'event';
  href: string;
}

function fmt(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function CalendarModal({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      myLessonSessions().catch(() => [] as MemberLessonSession[]),
      fetchEvents().catch(() => [] as CommunityEvent[]),
    ]).then(([sessions, events]) => {
      if (!active) return;
      const now = Date.now();
      const rows: Entry[] = [];
      for (const s of sessions) {
        if (s.status === 'CANCELLED') continue;
        rows.push({
          key: `lesson-${s.id}`, when: new Date(s.starts_at), kind: 'lesson',
          title: 'Lesson', detail: s.status === 'SCHEDULED' ? 'Scheduled' : s.status.toLowerCase(),
          href: '/app/schedule',
        });
      }
      for (const e of events) {
        if (!e.starts_at) continue;
        rows.push({
          key: `event-${e.id}`, when: new Date(e.starts_at), kind: 'event',
          title: e.title, detail: e.location || 'Community event', href: '/app/schedule',
        });
      }
      rows.sort((a, b) => a.when.getTime() - b.when.getTime());
      setEntries(rows.filter((r) => r.when.getTime() >= now - 12 * 3600 * 1000));
    });
    return () => { active = false; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 sm:pt-20" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-md rounded-lg max-h-[80vh] overflow-y-auto shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream">
          <h2 className="font-serif text-green-800 flex items-center gap-2">
            <CalendarDays size={18} /> Upcoming
          </h2>
          <button type="button" onClick={onClose} aria-label="Close calendar"><X size={20} /></button>
        </div>
        <div className="p-4">
          {entries === null && <p className="body-text text-sm text-muted">Loading…</p>}
          {entries?.length === 0 && (
            <p className="body-text text-sm text-muted">Nothing scheduled yet.</p>
          )}
          <ul className="flex flex-col gap-2">
            {entries?.map((e) => (
              <li key={e.key}>
                <Link
                  to={e.href}
                  onClick={onClose}
                  className="flex items-start gap-3 p-3 bg-white border border-green-800/10 rounded-md hover:border-green-800/30"
                >
                  <span className="mt-0.5 text-green-800">
                    {e.kind === 'lesson' ? <GraduationCap size={16} /> : <MapPin size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-green-900 truncate">{e.title}</span>
                    <span className="block text-xs text-muted">{fmt(e.when)} · {e.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/app/schedule"
            onClick={onClose}
            className="mt-4 inline-flex items-center gap-1 text-sm text-gold-ink font-sans"
          >
            Full schedule <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
