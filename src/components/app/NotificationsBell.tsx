/**
 * Notifications bell — the visible end of the notifications spine
 * (BOOKING_FLOWS_PLAN §1 Messaging: dashboard cards + bell, no messaging build).
 *
 * Lazy polling only: the unread count refreshes on mount and on route change;
 * the list is fetched when the panel opens. No realtime subscription.
 *
 * AppLayout renders the bell in two breakpoint-exclusive spots (mobile top bar,
 * desktop sidebar), so the STATE lives in one `useNotificationsBell()` call in
 * the layout and both instances share it — one set of RPCs, one source of truth.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, Hand } from 'lucide-react';
import {
  myNotifications, myUnreadCount, markNotificationRead, type AppNotification,
} from '../../lib/api';
import { sayHiBack } from '../../lib/communityFeed';

/** Pull the greeter's user_id out of a member_hi notification's link
 *  (/app?filter=members&hi_back=<id>). Returns null for other notifications. */
function hiBackTarget(n: AppNotification): string | null {
  if (n.kind !== 'member_hi' || !n.link) return null;
  const m = n.link.match(/hi_back=([0-9a-f-]{36})/i);
  return m ? m[1] : null;
}

/** One-click thank-you reply on a "welcome" notification. */
function SayHiBackButton({ toUserId }: { toUserId: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  async function reply(e: React.MouseEvent) {
    e.stopPropagation(); // don't trigger the notification's own navigate
    if (state !== 'idle') return;
    setState('sending');
    try { await sayHiBack(toUserId); setState('done'); }
    catch { setState('done'); /* already replied → treat as done */ }
  }
  return (
    <button type="button" onClick={reply} disabled={state !== 'idle'}
      className={`mt-2 inline-flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-1.5 focus-ring ${
        state === 'done'
          ? 'bg-green-50 text-green-700 border border-green-200'
          : 'bg-green-800 text-white hover:bg-green-700'}`}>
      <Hand size={13} aria-hidden="true" />
      {state === 'done' ? 'Thanked 👋' : state === 'sending' ? 'Sending…' : 'Say hi back'}
    </button>
  );
}

export interface NotificationsBellState {
  count: number;
  open: boolean;
  /** null until the panel has been opened once (loading state). */
  items: AppNotification[] | null;
  toggle: () => void;
  close: () => void;
  select: (n: AppNotification) => void;
}

export function useNotificationsBell(): NotificationsBellState {
  const location = useLocation();
  const navigate = useNavigate();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [open, setOpen] = useState(false);

  // lazy poll: on mount + on every route change (a failure just keeps the badge quiet)
  useEffect(() => {
    let active = true;
    myUnreadCount()
      .then((n) => active && setCount(n))
      .catch(() => { /* gate stays quiet on error */ });
    return () => {
      active = false;
    };
  }, [location.pathname]);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (!wasOpen) {
        myNotifications()
          .then(setItems)
          .catch(() => setItems([]));
      }
      return !wasOpen;
    });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const select = useCallback(
    (n: AppNotification) => {
      setOpen(false);
      if (!n.read_at) {
        markNotificationRead(n.id).catch(() => { /* stays unread server-side */ });
        setItems((prev) =>
          prev?.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)) ?? prev);
        setCount((c) => Math.max(0, c - 1));
      }
      if (n.link) navigate(n.link);
    },
    [navigate],
  );

  return { count, open, items, toggle, close, select };
}

/** Presentational bell + dropdown panel; state comes from useNotificationsBell(). */
export default function NotificationsBell({ bell }: { bell: NotificationsBellState }) {
  const { count, open, items, toggle, select } = bell;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative p-2 text-green-800 focus-ring rounded-md hover:bg-green-800/[0.06]"
        aria-label={count > 0 ? `Notifications (${count} unread)` : 'Notifications'}
        aria-expanded={open}
      >
        <Bell size={18} aria-hidden="true" />
        {count > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-green-800 text-white text-[10px] font-sans leading-[1.1rem] text-center rounded-full"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <div
          className="absolute right-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-green-800/10 shadow-md"
          role="region"
          aria-label="Notifications panel"
        >
          <p className="eyebrow px-4 pt-3 pb-2 border-b border-green-800/10">Notifications</p>
          {items === null ? (
            <p className="body-text text-muted text-sm px-4 py-3">Loading…</p>
          ) : items.length === 0 ? (
            <p className="body-text text-muted text-sm px-4 py-3">Nothing yet.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {items.map((n) => {
                const hiBack = hiBackTarget(n);
                return (
                <li key={n.id} className="border-b border-green-800/10 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => select(n)}
                    className="w-full text-left px-4 py-3 hover:bg-green-800/[0.04] focus-ring"
                  >
                    <span className={`block text-sm font-sans ${n.read_at ? 'text-muted' : 'font-medium text-green-900'}`}>
                      {n.title}
                    </span>
                    {n.body && <span className="block text-xs text-muted mt-0.5">{n.body}</span>}
                    <span className="block text-xs text-muted mt-1">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </button>
                  {/* welcome note → one-click thank-you reply */}
                  {hiBack && <div className="px-4 pb-3 -mt-1"><SayHiBackButton toUserId={hiBack} /></div>}
                </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
