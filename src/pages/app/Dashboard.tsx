import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Pin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';
import { fetchAnnouncements, fetchEvents } from '../../lib/community';
import type { Announcement, CommunityEvent } from '../../lib/community-types';

export default function Dashboard() {
  useDocumentTitle('Members');
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAnnouncements().catch(() => []), fetchEvents().catch(() => [])])
      .then(([a, e]) => {
        if (!active) return;
        setAnnouncements(a);
        setEvents(e.slice(0, 4));
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const name = profile?.display_name || profile?.first_name || 'there';

  return (
    <div className="max-w-4xl">
      <p className="eyebrow mb-2">Welcome back</p>
      <h1 className="heading-section text-green-800 mb-10">Good to see you, {name}.</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Announcements */}
        <section className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif font-medium text-green-800 text-xl">Announcements</h2>
          </div>
          {loading ? (
            <p className="body-text text-muted">Loading…</p>
          ) : announcements.length === 0 ? (
            <p className="body-text text-muted text-sm">No announcements yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {announcements.map((a) => (
                <article key={a.id} className="bg-white border border-green-800/10 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    {a.pinned && <Pin size={13} className="text-gold-ink" aria-hidden="true" />}
                    <h3 className="font-serif font-medium text-green-800 text-lg">{a.title}</h3>
                  </div>
                  <p className="body-text text-sm whitespace-pre-line">{a.body}</p>
                  <p className="text-xs text-muted mt-3">{new Date(a.created_at).toLocaleDateString()}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming + quick links */}
        <aside className="flex flex-col gap-6">
          <div>
            <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Coming up</h2>
            {events.length === 0 ? (
              <p className="body-text text-muted text-sm">Nothing on the calendar yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {events.map((e) => (
                  <Link
                    key={e.id}
                    to="/app/schedule"
                    className="bg-white border border-green-800/10 p-4 hover:shadow-md transition-shadow focus-ring block"
                  >
                    <p className="text-sm font-sans font-medium text-green-900">{e.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(e.starts_at).toLocaleString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </Link>
                ))}
              </div>
            )}
            <Link to="/app/schedule" className="link-underline mt-4">
              Full schedule <ArrowRight size={12} />
            </Link>
          </div>

          <div className="bg-green-800 text-white p-6">
            <p className="eyebrow-on-dark mb-2">The rail</p>
            <p className="text-sm text-white/[0.85] mb-4">Say hello to the group or start a thread.</p>
            <div className="flex flex-col gap-2">
              <Link to="/app/chat" className="link-underline text-gold-accent border-gold-400/40">Open the chat board <ArrowRight size={12} /></Link>
              <Link to="/app/members" className="link-underline text-gold-accent border-gold-400/40">See who's here <ArrowRight size={12} /></Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
