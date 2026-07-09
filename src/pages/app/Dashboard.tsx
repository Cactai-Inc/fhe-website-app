import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarClock, FileText, GraduationCap, MapPin, Pin, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';
import { fetchAnnouncements, fetchEvents } from '../../lib/community';
import { myOnboardingState, type OnboardingState } from '../../lib/api';
import {
  myLessonSessions,
  myLessonsOverview,
  type MemberLessonSession,
  type MyLessonsOverview,
} from '../../lib/ops/api-member';
import type { Announcement, CommunityEvent } from '../../lib/community-types';
import { useViewSurfaces } from '../../lib/surfaces';

/** "4 lessons" (punch cards) or the cadence line (subscriptions). */
function planQuantity(p: NonNullable<OnboardingState['purchase']>): string | null {
  if (p.lessons_included) return `${p.lessons_included} lessons`;
  if (p.cadence) return /^\d+$/.test(String(p.cadence).trim()) ? `${p.cadence} lessons/week` : String(p.cadence);
  return null;
}

/** The soonest upcoming SCHEDULED session (my_lesson_sessions is upcoming-first). */
function nextLesson(sessions: MemberLessonSession[]): MemberLessonSession | null {
  const now = Date.now();
  return (
    sessions.find((s) => s.status === 'SCHEDULED' && new Date(s.starts_at).getTime() >= now) ?? null
  );
}

/** Dashboard state machine (BOOKING_FLOWS_PLAN §6): once every onboarding doc
 *  is EXECUTED and the purchase is paid, the "what to expect at your first
 *  visit" card shows — until the member dismisses it. */
const FIRST_VISIT_DISMISS_KEY = 'fhe-first-visit-card-dismissed';

function isAllSet(s: OnboardingState | null): boolean {
  return Boolean(
    s && !s.needed
    && s.documents.length > 0
    && s.documents.every((d) => d.status === 'EXECUTED')
    && s.purchase?.paid,
  );
}

export default function Dashboard() {
  useDocumentTitle('Dashboard');
  const { profile } = useAuth();
  const { surfaces } = useViewSurfaces();
  const showCommunity = surfaces.has_community;
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [sessions, setSessions] = useState<MemberLessonSession[]>([]);
  const [lessons, setLessons] = useState<MyLessonsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstVisitDismissed, setFirstVisitDismissed] = useState(
    () => Boolean(window.localStorage.getItem(FIRST_VISIT_DISMISS_KEY)),
  );

  useEffect(() => {
    let active = true;
    Promise.all([fetchAnnouncements().catch(() => []), fetchEvents().catch(() => [])])
      .then(([a, e]) => {
        if (!active) return;
        setAnnouncements(a);
        setEvents(e.slice(0, 4));
      })
      .finally(() => active && setLoading(false));
    myOnboardingState()
      .then((s) => active && setOnboarding(s))
      .catch(() => { /* no onboarding surface — dashboard renders as usual */ });
    // lesson-session spine: the next confirmed lesson + the LIVE credits ledger
    myLessonSessions()
      .then((s) => active && setSessions(s))
      .catch(() => { /* no sessions card — dashboard renders as usual */ });
    myLessonsOverview()
      .then((o) => active && setLessons(o))
      .catch(() => { /* fall back to the static purchase snapshot */ });
    return () => {
      active = false;
    };
  }, []);

  // Post-registration landing: a member with pending onboarding is walked
  // straight into the flow (once per session — afterwards the card below is
  // the nudge, so they can still browse the rest of the app).
  useEffect(() => {
    if (!onboarding?.needed) return;
    if (window.sessionStorage.getItem('fhe-onboarding-redirected')) return;
    window.sessionStorage.setItem('fhe-onboarding-redirected', '1');
    navigate('/app/onboarding');
  }, [onboarding, navigate]);

  const name = profile?.display_name || profile?.first_name || 'there';
  const purchase = onboarding?.purchase ?? null;
  const upcoming = nextLesson(sessions);
  // The LIVE punch-card ledger beats the static lessons_included snapshot.
  const liveCredits = lessons && lessons.credits.length > 0 ? lessons.creditsRemaining : null;

  return (
    <div className="max-w-4xl">
      {/* Onboarding pending — the first thing on the page. */}
      {onboarding?.needed && (
        <Link
          to="/app/onboarding"
          data-testid="onboarding-nudge"
          className="block bg-green-800 text-white p-6 mb-8 hover:shadow-md transition-shadow focus-ring"
        >
          <p className="eyebrow-on-dark mb-1 inline-flex items-center gap-2">
            <FileText size={13} aria-hidden="true" /> One more step
          </p>
          <p className="font-serif text-lg">
            Finish setting up your account — review and sign your documents{' '}
            <ArrowRight size={14} className="inline" aria-hidden="true" />
          </p>
        </Link>
      )}

      <p className="eyebrow mb-2">Welcome back</p>
      <h1 className="heading-section text-green-800 mb-10">Good to see you, {name}.</h1>

      {/* Next lesson — the soonest upcoming confirmed session, above the plan. */}
      {upcoming && (
        <div
          className="bg-white border border-green-800/10 p-5 mb-8 flex items-center justify-between gap-4"
          data-testid="next-lesson-card"
        >
          <div className="flex items-center gap-3">
            <CalendarClock size={20} className="text-gold-ink flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="eyebrow mb-0.5">Next lesson</p>
              <p className="text-sm font-sans font-medium text-green-900">
                {new Date(upcoming.starts_at).toLocaleString(undefined, {
                  weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                })}
              </p>
              {upcoming.location && (
                <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-1.5">
                  <MapPin size={12} aria-hidden="true" /> {upcoming.location}
                </p>
              )}
            </div>
          </div>
          <Link to="/app/schedule" className="link-underline whitespace-nowrap">
            See schedule <ArrowRight size={12} />
          </Link>
        </div>
      )}

      {/* Plan card — what they bought (provisioned invite purchase). */}
      {purchase && (
        <div
          className="bg-white border border-green-800/10 p-5 mb-8 flex items-center justify-between gap-4"
          data-testid="plan-card"
        >
          <div className="flex items-center gap-3">
            <GraduationCap size={20} className="text-gold-ink flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-sans font-medium text-green-900">{purchase.tier_label}</p>
              {liveCredits !== null ? (
                <p className="text-xs text-muted mt-0.5" data-testid="lessons-remaining">
                  {liveCredits} lesson{liveCredits === 1 ? '' : 's'} remaining
                </p>
              ) : (
                planQuantity(purchase) && <p className="text-xs text-muted mt-0.5">{planQuantity(purchase)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {purchase.paid && (
              <span className="bg-green-800 text-white text-xs font-sans px-2 py-0.5 tracking-wide whitespace-nowrap">PAID</span>
            )}
            {/* Flow D entry (BOOKING_FLOWS_PLAN §2 Flow D): rebook with near-zero friction. */}
            <Link
              to="/app/book"
              data-testid="book-more-link"
              className="btn-primary px-4 py-2 whitespace-nowrap"
            >
              {purchase.lessons_included ? 'Book another lesson' : 'Add to your plan'}
            </Link>
          </div>
        </div>
      )}

      {/* All set (docs executed + paid) — first-visit expectations, until dismissed. */}
      {isAllSet(onboarding) && !firstVisitDismissed && (
        <div className="bg-white border border-green-800/10 p-6 mb-8" data-testid="first-visit-card">
          <div className="flex items-start justify-between gap-4">
            <p className="eyebrow mb-2 inline-flex items-center gap-2">
              <Sparkles size={13} aria-hidden="true" /> You're all set
            </p>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem(FIRST_VISIT_DISMISS_KEY, '1');
                setFirstVisitDismissed(true);
              }}
              className="p-1 -mt-1 -mr-1 text-muted hover:text-green-800 focus-ring rounded-md"
              aria-label="Dismiss"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="font-serif text-lg text-green-800 mb-3">
            Here's what to expect at your first visit.
          </p>
          <ul className="body-text text-sm flex flex-col gap-2 list-disc pl-5">
            <li>
              Directions arrive with your booking confirmation — plan to arrive
              about 15 minutes early to check in.
            </li>
            <li>
              Wear long pants and closed-toe boots with a heel; shorts, tank
              tops, and loose accessories aren't permitted.
            </li>
            <li>
              An ASTM/SEI-certified riding helmet is required for all mounted
              activities — bring your own, properly fitted.
            </li>
            <li>Long hair should be tied back; gloves are recommended.</li>
          </ul>
        </div>
      )}

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

          {/* Community rail — riders/operators (community surface) get it. The
              purchase-driven view model decides who; this is just a shortcut. */}
          {showCommunity && (
            <div className="bg-green-800 text-white p-6">
              <p className="eyebrow-on-dark mb-2">The rail</p>
              <p className="text-sm text-white/[0.85] mb-4">Say hello to the group or start a thread.</p>
              <div className="flex flex-col gap-2">
                <Link to="/app/community" className="link-underline text-gold-accent border-gold-400/40">Open the community <ArrowRight size={12} /></Link>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
