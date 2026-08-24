import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * THE LANDING SURFACE (D26, restated by TASK-DASHBOARDBUILD §2.2).
 *
 * Owner, via D26: *"The dashboard is the LANDING SURFACE, shown on a fresh login
 * and after ~30 minutes away — not a page you navigate to."*
 *
 * DASHBOARDS-GROUND-UP-PLAN §7 attaches the guards, and they matter more than
 * the behaviour does: *"a return after ≥30 min idle re-lands ONCE per re-entry
 * (guarded — deep links and in-session navigation are never hijacked; no
 * loops)."* A landing rule that fires twice, or that steals a link somebody sent
 * you, is worse than no landing rule at all.
 *
 * SO THERE ARE EXACTLY TWO TRIGGERS, AND EACH IS FENCED:
 *
 *   FRESH ARRIVAL — a page load that lands on `/app` itself, the community
 *   index. Only `/app`. A deep link to `/app/contracts/…` or `/app/calendar` is
 *   somebody's intent and is never redirected. Fires at most once per SIGN-IN —
 *   `clearLandingFlags()` resets it from `AuthContext`'s `SIGNED_IN` handler, so
 *   a tab that already visited `/app` earlier in its life (an earlier session, a
 *   sign-out/sign-in) still lands fresh on this login. Owner, 2026-08-23: "it
 *   didn't take me there" — the flag living in `sessionStorage` alone, tied to
 *   the TAB rather than the LOGIN, was the bug; this file no longer owns
 *   clearing it, `AuthContext` does, at the one place every sign-in path
 *   (password, MFA, Google) actually passes through.
 *
 *   RETURN FROM AWAY — 30 real minutes without the person touching anything,
 *   not 30 minutes of the tab being in the background. Owner, 2026-08-23: "it
 *   didn't take me there after 30 min of inactivity" — the previous version
 *   only checked `document.visibilitychange`, which fires on switching tabs or
 *   minimizing and NEVER fires from a tab that stays open and focused while the
 *   person simply stops touching the keyboard and mouse — the exact case the
 *   owner described. Real activity (pointer, key, scroll, touch) now stamps
 *   "last seen"; a periodic check and the tab regaining visibility both compare
 *   against it. It re-arms only after another 30 idle minutes, and it never
 *   fires when the dashboard is already on screen.
 *
 * Members are not affected: this hook is only called for staff.
 */

const ARRIVED_KEY = 'fhe.dashboard.landed';
const SEEN_KEY = 'fhe.dashboard.lastSeen';
const AWAY_MS = 30 * 60 * 1000;
const CHECK_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;
const DASHBOARD = '/app/dashboard';

/** Called from `AuthContext` on `SIGNED_IN` — see the file header. Every
 *  sign-in re-arms fresh-arrival, regardless of what this tab did earlier. */
export function clearLandingFlags(): void {
  try {
    sessionStorage.removeItem(ARRIVED_KEY);
    sessionStorage.removeItem(SEEN_KEY);
  } catch { /* private mode */ }
}

function stamp() {
  try { sessionStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode */ }
}

export function useStaffLanding(enabled: boolean): void {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const landedRef = useRef(false);

  // Fresh arrival. Runs on every render but acts at most once per sign-in
  // (clearLandingFlags resets ARRIVED_KEY), and only from the community index
  // — never from a link somebody followed.
  useEffect(() => {
    if (!enabled || landedRef.current) return;
    let already = false;
    try { already = sessionStorage.getItem(ARRIVED_KEY) === '1'; } catch { /* private mode */ }
    if (already) { landedRef.current = true; stamp(); return; }

    landedRef.current = true;
    try { sessionStorage.setItem(ARRIVED_KEY, '1'); } catch { /* private mode */ }
    stamp();
    if (path === '/app') navigate(DASHBOARD, { replace: true });
  }, [enabled, path, navigate]);

  // Any navigation counts as being here — it is what stops a working session
  // from being read as thirty minutes away.
  useEffect(() => { if (enabled) stamp(); }, [enabled, path]);

  // Return from away — real inactivity, not tab-visibility alone.
  useEffect(() => {
    if (!enabled) return;

    const maybeReland = () => {
      let last = 0;
      try { last = Number(sessionStorage.getItem(SEEN_KEY) ?? '0'); } catch { /* private mode */ }
      if (!last || Date.now() - last < AWAY_MS) return;
      if (window.location.pathname === DASHBOARD) return;
      navigate(DASHBOARD);
    };

    const onActivity = () => stamp();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') { stamp(); return; }
      maybeReland();
      stamp();
    };

    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));
    document.addEventListener('visibilitychange', onVisible);
    // The tab-stays-open-and-focused case: nothing else fires without a
    // periodic check, because no browser event exists for "nobody touched
    // this in a while" short of polling.
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') maybeReland();
    }, CHECK_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(interval);
    };
  }, [enabled, navigate]);
}
