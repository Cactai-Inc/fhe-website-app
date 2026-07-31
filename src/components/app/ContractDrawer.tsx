import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * CONTRACT DRAWER — the shared shell behind the Change-requests and
 * Change-history panels. Both look and behave identically; only the accent
 * differs, so a reader can tell them apart at a glance.
 *
 * SIZING (owner-final):
 *  • Starts SMALLER than the cap and is DYNAMIC — it tries to show the opened
 *    item's full content, capped at 35% of the visible content height.
 *  • A DRAG HANDLE lets the user pull it to full height or shrink it to a single
 *    selectable row.
 *  • When a row is open it is SEMI-STICKY to the top of the box: a magnetic stop
 *    while scrolling so the user doesn't have to position precisely.
 *
 * HOUSE-STYLE NOTE: scrollable-bounded content is against house style. These two
 * drawers are the SANCTIONED EXCEPTIONS (owner-approved). Do not introduce inner
 * scroll containers anywhere else in this codebase.
 */

/** Cap: the drawer never auto-grows past this share of the visible content area. */
const CAP_RATIO = 0.35;
/** A single collapsed row, in px — the floor the drag handle can shrink to. */
const MIN_PX = 56;
/** Within this many px of a row's top, scrolling snaps to it (the magnetic stop). */
const MAGNET_PX = 28;

export type DrawerAccent = 'requests' | 'history';

const ACCENT: Record<DrawerAccent, { ring: string; bar: string; chip: string; head: string }> = {
  // change REQUESTS — gold: an open conversation, something is being asked for.
  requests: {
    ring: 'border-gold-400/60',
    bar:  'bg-gold-400/70',
    chip: 'bg-gold-50 text-gold-900 border-gold-400/50',
    head: 'text-gold-ink',
  },
  // change HISTORY — green: a settled record of what already happened.
  history: {
    ring: 'border-green-700/40',
    bar:  'bg-green-700/60',
    chip: 'bg-green-50 text-green-900 border-green-700/30',
    head: 'text-green-800',
  },
};

/**
 * A drawer row rendered as ONE BIG BUTTON (no "show" text link): chevron-down
 * when closed, chevron-up when open.
 */
export function DrawerRow({
  open, onToggle, number, title, subtitle, accent, children, rowRef, tone,
}: {
  open: boolean;
  onToggle: () => void;
  number?: string | null;
  title: string;
  subtitle?: React.ReactNode;
  accent: DrawerAccent;
  children?: React.ReactNode;
  rowRef?: (el: HTMLDivElement | null) => void;
  /** Optional extra classes for the row shell (e.g. a closed/agreed thread). */
  tone?: string;
}) {
  const a = ACCENT[accent];
  return (
    <div ref={rowRef} data-drawer-row className={`rounded-lg border ${open ? a.ring : 'border-green-800/12'} ${tone ?? 'bg-white'}`}>
      {/* THE TILE IS THE BUTTON — the whole row toggles. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-start gap-2.5 text-left px-3 py-2.5 focus-ring rounded-lg hover:bg-green-800/[0.03]"
      >
        {number && (
          <span className={`shrink-0 mt-0.5 text-[11px] font-medium tabular-nums rounded border px-1.5 py-0.5 ${a.chip}`}>
            {number}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] text-green-950 font-medium leading-snug">{title}</span>
          {subtitle && <span className="block text-[11px] text-muted mt-0.5 leading-snug">{subtitle}</span>}
        </span>
        {open
          ? <ChevronUp size={16} className="shrink-0 mt-0.5 text-secondary" aria-hidden="true" />
          : <ChevronDown size={16} className="shrink-0 mt-0.5 text-muted" aria-hidden="true" />}
      </button>
      {open && children && <div className="px-3 pb-3 pt-0.5 border-t border-green-800/10">{children}</div>}
    </div>
  );
}

/**
 * The drawer shell: dynamic height, drag handle, semi-sticky open row.
 * `openKey` changes whenever the opened item changes — that's the cue to
 * re-measure and to magnetically bring the open row to the top.
 */
export function ContractDrawer({
  accent, children, openKey, empty, unbounded,
}: {
  accent: DrawerAccent;
  children: React.ReactNode;
  /** Identity of the currently-open row (null when all are closed). */
  openKey: string | null;
  empty?: boolean;
  /** TRUE when this already sits inside a scrolling container — the contract
   *  subheader's drawer. It then renders its rows at natural height with no
   *  scroll box and no drag handle of its own.
   *
   *  Without this the two nest: the outer drawer scrolls, and so does this,
   *  so a wheel over the list moved the INNER box while the drawer stayed put
   *  (and once the inner box hit its end, the page moved instead). One scroll
   *  boundary per drawer — the outer one. */
  unbounded?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const a = ACCENT[accent];

  // null = auto (content height, capped). A number = the user has dragged it.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [autoHeight, setAutoHeight] = useState<number>(MIN_PX * 3);
  const [capPx, setCapPx] = useState<number>(320);

  // The cap tracks the VISIBLE content height, so it adapts to the viewport.
  useEffect(() => {
    const recap = () => setCapPx(Math.max(MIN_PX * 2, Math.round(window.innerHeight * CAP_RATIO)));
    recap();
    window.addEventListener('resize', recap);
    return () => window.removeEventListener('resize', recap);
  }, []);

  // Dynamic sizing: try to show the open item in full, never past the cap.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setAutoHeight(Math.max(MIN_PX, el.scrollHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [openKey, children]);

  // SEMI-STICKY: bring the newly-opened row to the top of the box.
  useEffect(() => {
    if (!openKey) return;
    const box = scrollRef.current;
    if (!box) return;
    const row = box.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(openKey)}"]`);
    if (!row) return;
    box.scrollTo({ top: Math.max(0, row.offsetTop - box.offsetTop - 4), behavior: 'smooth' });
  }, [openKey]);

  // MAGNETIC STOP: after a scroll settles, snap to the nearest row top if we're
  // already close to it — so the reader never has to position precisely.
  const snapTimer = useRef<number | undefined>(undefined);
  const onScroll = useCallback(() => {
    const box = scrollRef.current;
    if (!box) return;
    window.clearTimeout(snapTimer.current);
    snapTimer.current = window.setTimeout(() => {
      const rows = Array.from(box.querySelectorAll<HTMLElement>('[data-drawer-row]'));
      if (rows.length === 0) return;
      const top = box.scrollTop;
      let best: number | null = null;
      for (const r of rows) {
        const rt = r.offsetTop - box.offsetTop;
        if (Math.abs(rt - top) <= MAGNET_PX && (best === null || Math.abs(rt - top) < Math.abs(best - top))) {
          best = rt;
        }
      }
      if (best !== null && Math.abs(best - top) > 1) {
        box.scrollTo({ top: Math.max(0, best - 4), behavior: 'smooth' });
      }
    }, 90);
  }, []);
  useEffect(() => () => window.clearTimeout(snapTimer.current), []);

  // ── the drag handle ────────────────────────────────────────────────────────
  const dragRef = useRef<{ y: number; h: number } | null>(null);
  const beginDrag = (clientY: number) => {
    dragRef.current = { y: clientY, h: scrollRef.current?.getBoundingClientRect().height ?? autoHeight };
  };
  const moveDrag = useCallback((clientY: number) => {
    const d = dragRef.current;
    if (!d) return;
    const next = d.h + (clientY - d.y);
    // floor = one selectable row; ceiling = full height of the viewport area.
    setDragHeight(Math.min(Math.max(MIN_PX, next), Math.round(window.innerHeight * 0.9)));
  }, []);
  const endDrag = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    const mm = (e: MouseEvent) => moveDrag(e.clientY);
    const tm = (e: TouchEvent) => { if (e.touches[0]) moveDrag(e.touches[0].clientY); };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchmove', tm, { passive: true });
    window.addEventListener('touchend', endDrag);
    return () => {
      window.removeEventListener('mousemove', mm);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('touchmove', tm);
      window.removeEventListener('touchend', endDrag);
    };
  }, [moveDrag, endDrag]);

  // Height: the user's drag wins; otherwise content height capped at 35%.
  const height = dragHeight ?? Math.min(autoHeight, capPx);

  // Inside the subheader drawer: no scroll box, no cap, no handle. The rows
  // render at their natural height and the drawer above does the scrolling.
  if (unbounded) {
    return <div className="flex flex-col gap-1.5">{children}</div>;
  }

  return (
    <div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ height: empty ? undefined : height }}
        className={`overflow-y-auto overscroll-contain rounded-lg ${empty ? '' : 'pr-0.5'}`}
      >
        <div ref={innerRef} className="flex flex-col gap-1.5">{children}</div>
      </div>

      {!empty && (
        // DRAG HANDLE — expand to full height or shrink to a single row.
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to resize"
          tabIndex={0}
          onMouseDown={(e) => { e.preventDefault(); beginDrag(e.clientY); }}
          onTouchStart={(e) => { if (e.touches[0]) beginDrag(e.touches[0].clientY); }}
          onDoubleClick={() => setDragHeight(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setDragHeight((h) => Math.min((h ?? height) + 40, Math.round(window.innerHeight * 0.9))); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); setDragHeight((h) => Math.max((h ?? height) - 40, MIN_PX)); }
            if (e.key === 'Escape')    { setDragHeight(null); }
          }}
          title="Drag to resize · double-click to fit"
          className="mt-1.5 h-4 flex items-center justify-center cursor-ns-resize focus-ring rounded group"
        >
          <span className={`h-1 w-10 rounded-full ${a.bar} opacity-50 group-hover:opacity-100 transition-opacity`} />
        </div>
      )}
    </div>
  );
}

export default ContractDrawer;
