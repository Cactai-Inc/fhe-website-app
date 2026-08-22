import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { ZoneDef, DashboardView } from '../../../lib/dashboard/registry';
import { VIEW_LABEL } from '../../../lib/dashboard/registry';

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
  def, count, index, children,
}: { def: ZoneDef; count: number; index: number; children: ReactNode }) {
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
        {def.hint && (
          <span className="ml-auto hidden max-w-[46ch] text-right text-[0.72rem] text-green-800/45 sm:block">
            {def.hint}
          </span>
        )}
      </div>
      {children}
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
  return (
    <p className="mt-2 border-t border-green-900/12 pt-3 text-[0.76rem] leading-relaxed text-green-800/45">
      <span className="font-medium text-green-800/60">All quiet:</span>{' '}
      {absent.map((z) => z.quiet).join(' · ')}.
      {absent.length === (view === 'trainer' ? 10 : 6) && ' Nothing needs you right now.'}
    </p>
  );
}

/**
 * THE VIEW TOGGLE (§2.1). Visible on the dashboard itself, always, for both
 * accounts — neither view is gated by identity, because D26 rules that the
 * designation selects emphasis and never capability.
 *
 * It does NOT write the stored default (§2.3). Switching over to check something
 * must not silently change where you land next time; only the settings control
 * does that, and the line under this control says so.
 */
export function ViewToggle({
  value, onChange, isDefault,
}: { value: DashboardView; onChange: (v: DashboardView) => void; isDefault: boolean }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className="inline-flex rounded-full border border-gold-600/40 bg-white p-0.5"
        role="group"
        aria-label="Dashboard view"
      >
        {(['trainer', 'business'] as DashboardView[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            data-testid={`dash-view-${v}`}
            className={`rounded-full px-3.5 py-1 text-[0.72rem] font-semibold transition-colors duration-320 ease-glide focus-ring ${
              value === v ? 'bg-green-800 text-gold-100' : 'text-green-800/70 hover:text-green-900'
            }`}
          >
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      <span className="text-[0.68rem] text-green-800/45">
        {isDefault
          ? 'This is your default view.'
          : 'Switched for this session — your default is unchanged.'}
      </span>
    </div>
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
