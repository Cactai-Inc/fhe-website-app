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
 *   somebody's intent and is never redirected. Fires at most once per tab, and
 *   the flag lives in `sessionStorage` so a genuine new session gets it again.
 *
 *   RETURN FROM AWAY — the tab becomes visible again after ≥30 minutes of not
 *   being looked at. This one may re-land from any page, because that is what
 *   "after ~30 minutes away" means; it re-arms only after another 30 idle
 *   minutes, and it never fires when the dashboard is already on screen.
 *
 * Members are not affected: this hook is only called for staff.
 */

const ARRIVED_KEY = 'fhe.dashboard.landed';
const SEEN_KEY = 'fhe.dashboard.lastSeen';
const AWAY_MS = 30 * 60 * 1000;
const DASHBOARD = '/app/dashboard';

function stamp() {
  try { sessionStorage.setItem(SEEN_KEY, String(Date.now())); } catch { /* private mode */ }
}

export function useStaffLanding(enabled: boolean): void {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const landedRef = useRef(false);

  // Fresh arrival. Runs on every render but acts at most once, and only from
  // the community index — never from a link somebody followed.
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

  // Return from away.
  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') { stamp(); return; }
      let last = 0;
      try { last = Number(sessionStorage.getItem(SEEN_KEY) ?? '0'); } catch { /* private mode */ }
      stamp();
      if (!last || Date.now() - last < AWAY_MS) return;
      if (window.location.pathname === DASHBOARD) return;
      navigate(DASHBOARD);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, navigate]);
}
