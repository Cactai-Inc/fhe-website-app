import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { ZoneDef, DashboardView } from '../../../lib/dashboard/registry';
import { VIEW_LABEL, zonesFor } from '../../../lib/dashboard/registry';

/**
 * The parts every zone is made of. Kept in one file on purpose: they are small,
 * they are only ever used together, and sixteen zones importing from sixteen
 * places is how a "design system" becomes eight slightly different cards.
 *
 * The visual language is `src/index.css`'s `.dash-*` block (TASK-DASHBOARDBUILD
 * §1B) — the dawn glow, the brass hairline, the hover lift, the staggered
 * entrance. Nothing here invents a colour.
 */

/** A KPI tile. Brass hairline, serif numeral, optional delta line. */
export function Tile({
  label, value, sub, tone = 'flat', to,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'up' | 'down' | 'flat' | 'alert';
  to?: string;
}) {
  const toneCls = tone === 'up' ? 'text-green-600'
    : tone === 'down' ? 'text-red-700'
    : tone === 'alert' ? 'text-red-700'
    : 'text-green-800/50';

  const body = (
    <>
      <span className="font-serif text-[1.6rem] leading-none text-green-900">{value}</span>
      <span className="mt-1.5 block text-[0.66rem] font-semibold uppercase tracking-wide text-green-800/60">
        {label}
      </span>
      {sub && <span className={`mt-1 block text-[0.72rem] font-medium ${toneCls}`}>{sub}</span>}
    </>
  );

  return to
    ? <Link to={to} className="dash-tile block px-4 py-3 focus-ring">{body}</Link>
    : <div className="dash-tile px-4 py-3">{body}</div>;
}

/**
 * A NUMBER THAT COUNTS UP. §1B's "animated count-up on KPI numbers".
 *
 * Two things this deliberately does NOT do: it never animates when the viewer
 * asked for reduced motion, and it never animates a value that arrives as a
 * change (a refresh mid-session) — only the first real value counts up, because
 * a number re-rolling every poll is noise, not polish.
 */
export function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const fmt = format ?? ((n: number) => String(Math.round(n)));
  const [shown, setShown] = useState(value);
  const animated = useRef(false);

  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || animated.current || value === 0) {
      setShown(value);
      animated.current = true;
      return;
    }
    animated.current = true;
    const start = performance.now();
    const DUR = 620;
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DUR);
      // ease-out cubic: arrives quickly, settles slowly — the app's own curve.
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <>{fmt(shown)}</>;
}

/** A progress ring — week fill, and the one place §1B's dawn glow is allowed
 *  outside the greeting. Drawn as a conic gradient so there is no SVG and no
 *  library; the sweep animates by transitioning the angle custom property in
 *  browsers that register it, and simply appears where it should in those that
 *  do not. */
export function Ring({ pct, label }: { pct: number; label: string }) {
  const safe = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="dash-dawn flex items-center gap-3">
      <div
        className="relative grid h-14 w-14 place-items-center rounded-full"
        style={{ background: `conic-gradient(#ba9935 ${safe * 3.6}deg, rgba(13,33,24,0.08) 0deg)` }}
        role="img"
        aria-label={`${label}: ${safe} percent`}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-white font-serif text-sm text-green-900">
          {safe}%
        </span>
      </div>
      <span className="text-[0.66rem] font-semibold uppercase tracking-wide text-green-800/60">
        {label}
      </span>
    </div>
  );
}

/**
 * A ZONE. Renders its header (which is always a link — D17) and its children.
 *
 * It does not decide whether to render: `OwnerDashboard` does that, because the
 * "absent zones are absent" rule needs to know which ones were dropped in order
 * to name them in the all-quiet footer.
 */
export function Zone({
  def, count, index, children, collapsible = false,
}: {
  def: ZoneDef;
  count: number;
  index: number;
  children: ReactNode;
  /** ⚠️ OPT-IN, AND ONLY THE NOTIFICATIONS ZONE USES IT (owner, 2026-08-26:
   *  "collapsable"). Every other zone is already short — it caps its list at
   *  CAP and links onward — so a collapse control on all sixteen would be
   *  sixteen more things to click and nothing gained. The state is remembered
   *  for the session, per zone: collapse a long list once and it stays that way
   *  until the browser closes, which is the same lifetime as the view toggle's
   *  own memory and for the same reason (tomorrow is a fresh day). */
  collapsible?: boolean;
}) {
  const storageKey = `fhe.dash.zone.${def.view}.${def.key}.collapsed`;
  const [collapsed, setCollapsed] = useState(() => {
    if (!collapsible || typeof window === 'undefined') return false;
    try { return sessionStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const toggle = () => {
    setCollapsed((was) => {
      const next = !was;
      try { sessionStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* private mode */ }
      return next;
    });
  };

  return (
    <section
      className="dash-enter mb-7"
      style={{ ['--dash-i' as string]: index }}
      aria-label={def.title}
      data-testid={`zone-${def.key}`}
    >
      <div className="mb-2 flex items-baseline gap-2.5">
        <Link
          to={def.to}
          className="group inline-flex items-baseline gap-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-gold-800 focus-ring"
        >
          {def.title}
          <ChevronRight size={13} className="translate-y-px opacity-50 transition-transform duration-320 ease-glide group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
        {count > 0 && (
          <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[0.66rem] font-semibold text-gold-800">
            {count}
          </span>
        )}
        {collapsible && (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            data-testid={`zone-${def.key}-collapse`}
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.66rem] font-medium text-green-800/55 transition-colors duration-320 ease-glide hover:text-green-900 focus-ring"
          >
            <ChevronDown
              size={13}
              className={`transition-transform duration-320 ease-glide ${collapsed ? '-rotate-90' : ''}`}
              aria-hidden="true"
            />
            {collapsed ? 'Show' : 'Hide'}
          </button>
        )}
        {def.hint && (
          <span className="ml-auto hidden max-w-[46ch] text-right text-[0.72rem] text-green-800/45 sm:block">
            {def.hint}
          </span>
        )}
      </div>
      {!collapsed && children}
    </section>
  );
}

/** The card grid every list zone uses. */
export function Cards({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

/** One row of work: a title, a tag, a line of detail, and somewhere to go. */
export function Card({
  title, tag, tagTone = 'neutral', detail, to, children,
}: {
  title: ReactNode;
  tag?: string;
  tagTone?: 'urgent' | 'today' | 'new' | 'neutral';
  detail?: ReactNode;
  to?: string;
  children?: ReactNode;
}) {
  const tagCls = tagTone === 'urgent' ? 'bg-red-50 text-red-800'
    : tagTone === 'today' ? 'bg-gold-100 text-gold-800'
    : tagTone === 'new' ? 'bg-green-50 text-green-700'
    : 'bg-cream-200 text-green-800/70';

  const inner = (
    <>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-[0.86rem] font-semibold text-green-900">{title}</span>
        {tag && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-tracked ${tagCls}`}>
            {tag}
          </span>
        )}
      </div>
      {detail && <p className="mt-1 text-[0.78rem] leading-snug text-green-800/60">{detail}</p>}
      {children}
    </>
  );

  return to
    ? <Link to={to} className="dash-card block px-3.5 py-3 focus-ring">{inner}</Link>
    : <div className="dash-card px-3.5 py-3">{inner}</div>;
}

/**
 * THE ALL-QUIET FOOTER. Plan §1, principle 1: *"empty zones are absent, and a
 * one-line 'all quiet' footer names what's absent so silence is visible and
 * trusted."* Naming them is the whole point — a dashboard that simply shows less
 * when there is less to do is indistinguishable from a dashboard that broke.
 */
export function QuietFooter({ absent, view }: { absent: ZoneDef[]; view: DashboardView }) {
  if (absent.length === 0) return null;
  /* ⚠️ COUNTED, NOT HARDCODED. This read `(view === 'trainer' ? 10 : 6)` — the
     zone counts as they stood on 2026-08-22 — so adding the notifications zone
     would have silently retired "Nothing needs you right now", the one line that
     distinguishes a genuinely quiet day from a half-loaded board. The registry
     already knows how many zones a view has. */
  const total = zonesFor(view).length;
  return (
    <p className="mt-2 border-t border-green-900/12 pt-3 text-[0.76rem] leading-relaxed text-green-800/45">
      <span className="font-medium text-green-800/60">All quiet:</span>{' '}
      {absent.map((z) => z.quiet).join(' · ')}.
      {absent.length === total && ' Nothing needs you right now.'}
    </p>
  );
}

/**
 * THE VIEW TOGGLE (§2.1). Reachable on the dashboard itself, always, for both
 * accounts — neither view is gated by identity, because D26 rules that the
 * designation selects emphasis and never capability.
 *
 * It does NOT write the stored default (§2.3) — switching over to check
 * something must not silently change where you land next time; the setting
 * itself lives in Team.
 *
 * Owner, 2026-08-23: rebuilt from a two-option segmented control into one
 * small peek button — "it's not even a secondary action... it doesn't need
 * to be a full size UI element." At home it reads "Show {the other
 * person}'s Dashboard"; clicking it switches and the same button becomes a
 * plain X to return. One element throughout, never two, so it can stay
 * genuinely small — including on mobile, where the header row wraps it
 * below the greeting rather than growing it.
 */
export function ViewToggle({
  value, home, onChange,
}: { value: DashboardView; home: DashboardView; onChange: (v: DashboardView) => void }) {
  const other: DashboardView = home === 'trainer' ? 'business' : 'trainer';
  const peeking = value !== home;

  return (
    <button
      type="button"
      onClick={() => onChange(peeking ? home : other)}
      aria-label={peeking ? `Return to your own dashboard` : `Show ${VIEW_LABEL[other]}`}
      data-testid="dash-view-toggle"
      className="shrink-0 inline-flex items-center rounded-full border border-green-800/25 px-2.5 py-1 text-[0.68rem] font-medium text-green-800/70 transition-colors duration-320 ease-glide hover:border-green-800/40 hover:text-green-900 focus-ring"
    >
      {peeking ? <X size={13} aria-hidden="true" /> : `Show ${VIEW_LABEL[other]}`}
    </button>
  );
}

/** An inline failure, per zone. A tile that cannot load says so; it never
 *  renders blank and it never takes the rest of the dashboard down with it. */
export function ZoneError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[0.78rem] text-red-800">
      {message}
    </p>
  );
}
