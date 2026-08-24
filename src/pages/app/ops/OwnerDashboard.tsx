import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../../contexts/AuthContext';
import {
  fetchTodayPlan, fetchWeekStrip, fetchMoneyWaiting, fetchPeopleWaiting,
  fetchNotesLoop, fetchStableBoard, fetchDocumentsOnboarding, fetchCommunityPulse,
  fetchEvaluationsDue, fetchGifts, fetchMoneyHealth, fetchClairesPlate,
  fetchDealsContracts, fetchActivityReadback, fetchCatalogHygiene,
  fetchOnboardingPipeline, fetchTrainerKpis, fetchBusinessKpis,
  type ZoneResult, type TrainerKpis, type BusinessKpis, type RevenueWindow,
} from '../../../lib/ops/api-dashboard';
import { fetchRevenue } from '../../../lib/ops/api-calendar';
import { weekWindow, monthWindow } from '../../../lib/dashboard/windows';
import {
  zonesFor, type DashboardView,
} from '../../../lib/dashboard/registry';
import {
  Zone, Tile, Ring, CountUp, ViewToggle, QuietFooter, ZoneError,
} from '../../../components/app/dashboard/DashboardChrome';
import { usd, ageLabel } from '../../../lib/dashboard/format';
import {
  TodayZone, WeekZone, MoneyZone, PeopleZone, NotesZone, StableZone,
  DocumentsZone, CommunityZone, EvaluationsZone, GiftsZone,
} from '../../../components/app/dashboard/TrainerZones';
import {
  MoneyHealthZone, MirrorZone, DealsZone, PipelineZone, HygieneZone, ActivityZone,
} from '../../../components/app/dashboard/BusinessZones';
import { toErrorMessage } from '../../../lib/ops/errors';
import { timeOfDayWord } from '../../../lib/formatDateTime';

/**
 * THE OWNER DASHBOARD (TASK-DASHBOARDBUILD, Phase 1 of DASHBOARDS-GROUND-UP-PLAN).
 *
 * Two role-tuned working surfaces for the two people who run FHE (D26), one
 * toggle between them, and a per-account setting that decides which one you land
 * on (§2). Both views are reachable by both accounts, always — the designation
 * selects emphasis, never capability.
 *
 * THREE RULES THIS FILE ENFORCES, AND THEY ARE THE WHOLE DESIGN:
 *
 *   1. A ZONE RENDERS ONLY WHEN IT HAS SOMETHING TO SHOW. Absent zones are
 *      absent, and the all-quiet footer names them — silence has to be visible
 *      or a quiet dashboard is indistinguishable from a broken one.
 *   2. EVERY NUMBER IS ONE NAMED RPC (D18). Nothing here counts, sums or filters;
 *      `count` comes from the reader. The KPI ribbon reads the same functions the
 *      zones do, so a ribbon and a zone cannot disagree.
 *   3. EVERY ZONE GOES SOMEWHERE (D17). Zone headings and rows are links, and
 *      the routes are resolved in `lib/dashboard/registry.ts` against the real
 *      route table.
 *
 * ONE ZONE FAILING NEVER TAKES THE PAGE DOWN. Each loader is settled
 * independently, and a rejected zone renders an inline error where its content
 * would have been — the OpsDashboard tile rule ("never a blank tile"), applied
 * to a whole board.
 */

/** The session's chosen view. Sits in `sessionStorage`, NOT in the database —
 *  §2.3: the toggle persists the choice for the session and never overwrites
 *  the stored default. Closing the browser forgets it, which is exactly right:
 *  tomorrow you land on your default again. */
const SESSION_VIEW_KEY = 'fhe.dashboard.view';

type Loader = () => Promise<ZoneResult<unknown>>;

const LOADERS: Record<string, Loader> = {
  C1: fetchTodayPlan as Loader,
  C2: fetchWeekStrip as Loader,
  C3: fetchMoneyWaiting as Loader,
  C4: fetchPeopleWaiting as Loader,
  C6: fetchNotesLoop as Loader,
  C7: fetchStableBoard as Loader,
  C9: fetchDocumentsOnboarding as Loader,
  C11: fetchCommunityPulse as Loader,
  C12: fetchEvaluationsDue as Loader,
  C13: fetchGifts as Loader,
  B1: fetchMoneyHealth as Loader,
  B2: fetchClairesPlate as Loader,
  B3: fetchDealsContracts as Loader,
  B6: (() => fetchActivityReadback(40)) as Loader,
  B8: fetchCatalogHygiene as Loader,
  B9: fetchOnboardingPipeline as Loader,
};

interface ZoneState { result: ZoneResult<unknown> | null; error: string | null }

const DAYPART: Record<ReturnType<typeof timeOfDayWord>, string> = {
  morning: 'morning', afternoon: 'afternoon', evening: 'evening', night: 'evening',
};

export default function OwnerDashboard() {
  const { profile, user } = useAuth();

  /** The stored default (§2.2). `profiles.dashboard_focus`, read straight off the
   *  profile the AuthContext already loads with `select('*')`. NULL falls back by
   *  role rather than by email — a hardcoded email switch in the component tree
   *  is precisely what §2.2 refuses. */
  const storedDefault: DashboardView = useMemo(() => {
    /* `dashboard_focus` and `role` are both columns AuthContext's `select('*')`
       returns but the base `Profile` type does not declare — the same projection
       AuthContext itself does for `role`/`org_id`. */
    const p = profile as (typeof profile & { dashboard_focus?: string | null; role?: string | null }) | null;
    const stored = p?.dashboard_focus;
    if (stored === 'trainer' || stored === 'business') return stored;
    // No stored default: an admin runs the business desk, other staff train.
    // Both FHE owners are seeded explicitly, so this is the fallback for a staff
    // account nobody has set a view for — never an identity check.
    return p?.role === 'ADMIN' ? 'business' : 'trainer';
  }, [profile]);

  const [view, setView] = useState<DashboardView>(() => {
    const s = typeof window !== 'undefined' ? sessionStorage.getItem(SESSION_VIEW_KEY) : null;
    return s === 'trainer' || s === 'business' ? s : 'business';
  });
  /** Until the profile has loaded we do not know the default, so the first
   *  render must not lock in a guess. This flips once, on the first profile we
   *  see, and only when the session has no explicit choice of its own. */
  const [viewSettled, setViewSettled] = useState(
    () => typeof window !== 'undefined' && !!sessionStorage.getItem(SESSION_VIEW_KEY),
  );

  useEffect(() => {
    if (viewSettled || !profile) return;
    setView(storedDefault);
    setViewSettled(true);
  }, [profile, storedDefault, viewSettled]);

  const chooseView = useCallback((v: DashboardView) => {
    setView(v);
    setViewSettled(true);
    try { sessionStorage.setItem(SESSION_VIEW_KEY, v); } catch { /* private mode */ }
  }, []);

  const [zones, setZones] = useState<Record<string, ZoneState>>({});
  const [trainerKpis, setTrainerKpis] = useState<TrainerKpis | null>(null);
  const [businessKpis, setBusinessKpis] = useState<BusinessKpis | null>(null);
  /* §7.4 — revenue is fetched HERE, with the shared window, rather than inside
     `dash_business_kpis`, so this tile and the calendar's money strip are two
     renderings of one call. See `lib/dashboard/windows.ts`. */
  const [revenue, setRevenue] = useState<{ week: RevenueWindow; month: RevenueWindow } | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  const defs = useMemo(() => zonesFor(view), [view]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const keys = defs.map((d) => d.key);

    Promise.all(keys.map(async (k): Promise<[string, ZoneState]> => {
      try {
        return [k, { result: await LOADERS[k](), error: null }];
      } catch (e) {
        return [k, { result: null, error: toErrorMessage(e, 'This zone could not load.') }];
      }
    })).then((entries) => {
      if (!live) return;
      setZones(Object.fromEntries(entries));
      setLoading(false);
    });

    if (view === 'trainer') {
      fetchTrainerKpis().then((k) => live && setTrainerKpis(k)).catch(() => live && setTrainerKpis(null));
    } else {
      fetchBusinessKpis().then((k) => live && setBusinessKpis(k)).catch(() => live && setBusinessKpis(null));
      const wk = weekWindow();
      const mo = monthWindow();
      Promise.all([fetchRevenue(wk.from, wk.to), fetchRevenue(mo.from, mo.to)])
        .then(([week, month]) => live && setRevenue({ week: week as RevenueWindow, month: month as RevenueWindow }))
        .catch(() => live && setRevenue(null));
    }

    return () => { live = false; };
  }, [defs, view, reloadKey]);

  const present = defs.filter((d) => (zones[d.key]?.result?.count ?? 0) > 0 || zones[d.key]?.error);
  const absent = defs.filter((d) => !zones[d.key]?.error && (zones[d.key]?.result?.count ?? 0) === 0);

  const firstName = profile?.first_name || profile?.display_name || null;

  return (
    <div>
      <Helmet><title>Dashboard</title></Helmet>

      <header className="dash-sticky -mx-4 mb-5 px-4 pb-3 pt-1 sm:-mx-6 sm:px-6">
        <div className="dash-dawn pb-3 pt-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="font-serif text-[1.7rem] leading-tight text-green-900">
              Good {DAYPART[timeOfDayWord()]}{firstName ? `, ${firstName}` : ''}
            </h1>
            <ViewToggle value={view} onChange={chooseView} />
          </div>
          <p className="mt-4 font-serif text-[1.25rem] text-green-800/70">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="mt-3">
          {view === 'trainer'
            ? <TrainerRibbon k={trainerKpis} />
            : <BusinessRibbon k={businessKpis} revenue={revenue} />}
        </div>
      </header>

      {loading && (
        <p className="py-8 text-center text-sm text-green-800/50">Reading the day&hellip;</p>
      )}

      {!loading && present.map((def, i) => {
        const st = zones[def.key];
        return (
          <Zone key={def.key} def={def} count={st?.result?.count ?? 0} index={i}>
            {st?.error
              ? <ZoneError message={st.error} />
              : renderZone(def.key, st?.result?.items ?? [], refresh, chooseView)}
          </Zone>
        );
      })}

      {!loading && <QuietFooter absent={absent} view={view} />}

      {!loading && user && (
        <p className="mt-6 text-[0.7rem] text-green-800/35">
          Both views are open to every staff account — the setting only chooses where you land.
        </p>
      )}
    </div>
  );
}

/** The zone key → its renderer. Kept as a function rather than a map of
 *  components because each zone's props differ, and a lowest-common-denominator
 *  prop type would erase exactly the differences that make the zones useful. */
function renderZone(
  key: string,
  items: unknown[],
  refresh: () => void,
  chooseView: (v: DashboardView) => void,
) {
  switch (key) {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    case 'C1':  return <TodayZone items={items as any} />;
    case 'C2':  return <WeekZone items={items as any} />;
    case 'C3':  return <MoneyZone items={items as any} onDone={refresh} />;
    case 'C4':  return <PeopleZone items={items as any} />;
    case 'C6':  return <NotesZone items={items as any} onDone={refresh} />;
    case 'C7':  return <StableZone items={items as any} />;
    case 'C9':  return <DocumentsZone items={items as any} />;
    case 'C11': return <CommunityZone items={items as any} />;
    case 'C12': return <EvaluationsZone items={items as any} />;
    case 'C13': return <GiftsZone items={items as any} />;
    case 'B1':  return <MoneyHealthZone items={items as any} />;
    case 'B2':  return <MirrorZone items={items as any} onOpenTrainer={chooseView} />;
    case 'B3':  return <DealsZone items={items as any} />;
    case 'B6':  return <ActivityZone items={items as any} />;
    case 'B8':  return <HygieneZone items={items as any} />;
    case 'B9':  return <PipelineZone items={items as any} />;
    /* eslint-enable @typescript-eslint/no-explicit-any */
    default:    return null;
  }
}

/** Plan §2's four numbers. Week fill is the ring, because a fraction of capacity
 *  is the one figure here that is naturally a proportion.
 *
 *  Owner, 2026-08-23: "no KPI's should be shown, just like nothing else should
 *  be shown, when the value is zero, the count list is null, theres nothing to
 *  show." A zero-value tile is the same "nothing to act on" case a zone hides
 *  for — so each tile renders only when its number is non-zero, and the whole
 *  ribbon renders only when at least one does. */
function TrainerRibbon({ k }: { k: TrainerKpis | null }) {
  if (!k) return null;
  const fill = k.week_capacity > 0 ? (k.week_booked / k.week_capacity) * 100 : 0;
  const tiles = [
    k.today_lessons > 0 && (
      <Tile key="today" label="Today" value={<CountUp value={k.today_lessons} />}
            sub={k.today_lessons === 1 ? 'session' : 'sessions'} to="/app/calendar" />
    ),
    k.week_booked > 0 && (
      <div key="week" className="dash-tile flex items-center px-4 py-3">
        <Ring pct={fill} label={`Week fill · ${k.week_booked}/${k.week_capacity}`} />
      </div>
    ),
    k.awaiting_confirmation > 0 && (
      <Tile key="awaiting" label="Awaiting confirmation"
            value={<CountUp value={k.awaiting_confirmation} format={usd} />}
            sub="declared, not yet confirmed" tone="alert" to="/app/ops/payments/review" />
    ),
    k.people_waiting > 0 && (
      <Tile key="waiting" label="People waiting" value={<CountUp value={k.people_waiting} />}
            sub={`oldest ${ageLabel(k.people_oldest_hours)}`}
            tone={k.people_oldest_hours > 24 ? 'alert' : 'flat'}
            to="/app/records/leads" />
    ),
  ].filter(Boolean);
  if (tiles.length === 0) return null;
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{tiles}</div>;
}

/** Plan §3's ribbon. Revenue is `revenue_summary` and nothing else — the same
 *  function the calendar's money strip now calls (§5). */
/** Same rule as TrainerRibbon: a zero-value tile does not render, and the
 *  ribbon itself renders only if something in it is non-zero. */
function BusinessRibbon({ k, revenue }: {
  k: BusinessKpis | null;
  revenue: { week: RevenueWindow; month: RevenueWindow } | null;
}) {
  if (!k || !revenue) return null;
  const delta = (d: number, pct: number | null) =>
    d === 0 ? 'level with the period before'
      : `${d > 0 ? '▲' : '▼'} ${usd(Math.abs(d))}${pct === null ? '' : ` (${Math.abs(pct)}%)`} vs the period before`;
  const tiles = [
    revenue.week.total > 0 && (
      <Tile key="rev-week" label="Revenue · this week"
            value={<CountUp value={revenue.week.total} format={usd} />}
            sub={delta(revenue.week.delta, revenue.week.delta_pct)}
            tone={revenue.week.delta > 0 ? 'up' : revenue.week.delta < 0 ? 'down' : 'flat'}
            to="/app/ops/payments/review" />
    ),
    revenue.month.total > 0 && (
      <Tile key="rev-month" label="Revenue · this month"
            value={<CountUp value={revenue.month.total} format={usd} />}
            sub={delta(revenue.month.delta, revenue.month.delta_pct)}
            tone={revenue.month.delta > 0 ? 'up' : revenue.month.delta < 0 ? 'down' : 'flat'}
            to="/app/ops/payments/review" />
    ),
    k.new_clients_month > 0 && (
      <Tile key="new-clients" label="New clients this month" value={<CountUp value={k.new_clients_month} />}
            sub={`${k.converted_90d} of ${k.leads_90d} inquiries became clients (90 days)`}
            to="/app/records/clients" />
    ),
    k.open_pipeline > 0 && (
      <Tile key="pipeline" label="Open pipeline" value={<CountUp value={k.open_pipeline} format={usd} />}
            sub={k.declared_unconfirmed > 0
              ? `${usd(k.declared_unconfirmed)} declared, awaiting confirmation`
              : 'nothing declared and unconfirmed'}
            tone={k.declared_unconfirmed > 0 ? 'alert' : 'flat'}
            to="/app/ops/payments/review" />
    ),
  ].filter(Boolean);
  if (tiles.length === 0) return null;
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{tiles}</div>;
}
