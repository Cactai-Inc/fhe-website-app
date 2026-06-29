import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { fetchEvents, fetchMyRsvps, setRsvp } from '../../lib/community';
import { useDocumentTitle } from '../../lib/hooks';
import type { CommunityEvent, EventRsvp, RsvpStatus } from '../../lib/community-types';

const RSVP_OPTIONS: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't" },
];

export default function Schedule() {
  useDocumentTitle('Schedule');
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchEvents().catch(() => []), fetchMyRsvps().catch(() => [] as EventRsvp[])])
      .then(([e, r]) => {
        if (!active) return;
        setEvents(e);
        setRsvps(Object.fromEntries(r.map((x) => [x.event_id, x.status])));
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

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
                <h2 className="font-serif font-medium text-green-800 text-xl mb-2">{e.title}</h2>
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
    </div>
  );
}
