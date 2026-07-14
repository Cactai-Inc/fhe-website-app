import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, MapPin } from 'lucide-react';
import { fetchEvents, fetchMyRsvps, setRsvp } from '../../lib/community';
import { myLessonSessions, type MemberLessonSession } from '../../lib/ops/api-member';
import { listLessonSessions } from '../../lib/ops/api-lessons';
import { formatSessionWhen } from '../../lib/formatDateTime';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';
import type { CommunityEvent, EventRsvp, RsvpStatus } from '../../lib/community-types';

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't" },
];

/** Member-friendly status labels for a lesson session. */
const SESSION_STATUS_LABEL: Record<MemberLessonSession['status'], string> = {
  SCHEDULED: 'Scheduled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'Missed',
};

const SESSION_STATUS_CLASS: Record<MemberLessonSession['status'], string> = {
  SCHEDULED: 'bg-green-800 text-white',
  COMPLETED: 'bg-green-800/10 text-green-800',
  CANCELLED: 'bg-red-50 text-red-800',
  NO_SHOW: 'bg-red-50 text-red-800',
};

function sessionWhen(s: MemberLessonSession): string {
  return formatSessionWhen(s.starts_at, s.ends_at);
}

export default function Schedule() {
  useDocumentTitle('Schedule');
  // Staff see the whole barn's sessions (org-wide); members see their own.
  const { isStaff } = useAuth();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});
  const [sessions, setSessions] = useState<MemberLessonSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchEvents().catch(() => []),
      fetchMyRsvps().catch(() => [] as EventRsvp[]),
      (isStaff
        ? listLessonSessions().then((rows) => rows as unknown as MemberLessonSession[])
        : myLessonSessions()
      ).catch(() => [] as MemberLessonSession[]),
    ])
      .then(([e, r, s]) => {
        if (!active) return;
        setEvents(e);
        setRsvps(Object.fromEntries(r.map((x) => [x.event_id, x.status])));
        setSessions(s);
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [isStaff]);

  async function choose(eventId: string, status: RsvpStatus) {
    setRsvps((prev) => ({ ...prev, [eventId]: status }));
    try {
      await setRsvp(eventId, status);
    } catch {
      // revert on failure
      setRsvps((prev) => {
        const next = { ...prev };
        delete next[eventId];
        return next;
      });
    }
  }

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Schedule</p>
      <h1 className="heading-section text-green-800 mb-8">What's coming up.</h1>

      {/* Your lessons — the member's own confirmed sessions, first. */}
      <section aria-label="Your lessons" className="mb-10" data-testid="my-lessons-section">
        <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Your lessons</h2>
        {loading ? (
          <p className="body-text text-muted">Loading…</p>
        ) : sessions.length === 0 ? (
          <p className="body-text text-muted text-sm">
            No lessons booked yet.{' '}
            <Link to="/app/book" className="link-underline">
              Book a lesson <ArrowRight size={12} />
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((s) => (
              <article
                key={s.id}
                className="bg-white border border-green-800/10 p-5 flex items-start justify-between gap-4"
              >
                <div>
                  <p className="text-xs font-sans uppercase tracking-wide text-gold-ink mb-1 inline-flex items-center gap-1.5">
                    <GraduationCap size={13} aria-hidden="true" /> Lesson
                  </p>
                  <p className="text-sm font-sans font-medium text-green-900">{sessionWhen(s)}</p>
                  {s.location && (
                    <p className="text-xs text-muted inline-flex items-center gap-1.5 mt-1">
                      <MapPin size={12} aria-hidden="true" /> {s.location}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs font-sans px-2 py-0.5 tracking-wide whitespace-nowrap ${SESSION_STATUS_CLASS[s.status]}`}
                >
                  {SESSION_STATUS_LABEL[s.status]}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Barn events — the community calendar stays below the member's lessons. */}
      <section aria-label="Barn events">
        <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Barn events</h2>
        {loading ? (
          <p className="body-text text-muted">Loading…</p>
        ) : events.length === 0 ? (
          <p className="body-text text-muted text-sm">Nothing on the calendar yet. Check back soon.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map((e) => {
              const mine = rsvps[e.id];
              return (
                <article key={e.id} className="bg-white border border-green-800/10 p-6">
                  <p className="text-xs font-sans uppercase tracking-wide text-gold-ink mb-1">
                    {new Date(e.starts_at).toLocaleString(undefined, {
                      weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </p>
                  <h3 className="font-serif font-medium text-green-800 text-xl mb-2">{e.title}</h3>
                  {e.description && <p className="body-text text-sm mb-3">{e.description}</p>}
                  {e.location && (
                    <p className="text-xs text-muted inline-flex items-center gap-1.5 mb-4">
                      <MapPin size={12} aria-hidden="true" /> {e.location}
                    </p>
                  )}
                  <div role="radiogroup" aria-label={`RSVP for ${e.title}`} className="flex gap-2">
                    {RSVP_OPTIONS.map((opt) => {
                      const selected = mine === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => choose(e.id, opt.value)}
                          className={`px-4 py-2 text-sm font-sans border transition-colors focus-ring ${
                            selected ? 'border-green-800 bg-green-800 text-white' : 'border-green-800/20 text-secondary hover:border-green-800/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
