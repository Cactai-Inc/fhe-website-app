import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * CONTRACT SUBHEADER — the contract workspace's own toolbar.
 *
 * Placement (owner spec 2026-07-31): pinned directly beneath the app header and
 * never moving, FULL BLEED — flush to the side nav on the left (whatever state
 * it is in) and to the window edge on the right. It achieves that by cancelling
 * <main>'s horizontal padding with negative margins, so it spans the content
 * column edge to edge without knowing the nav's width. It is sticky at top-14,
 * which is the app header's height.
 *
 * CONTEXTUAL, NOT UNIVERSAL. It belongs to contract authoring/review only, so it
 * lives here and is rendered by ContractPage rather than by the app shell. The
 * caller decides which buttons appear: the owner creating a contract gets the
 * management actions; a party reviewing to sign gets a reduced set; a fully
 * executed contract gets none, and the subheader is not rendered at all.
 *
 * Drawers:
 *  • Exactly one open at a time — opening one closes the other.
 *  • The button label becomes "Click to close" while its drawer is open and
 *    reverts whenever it closes, including when another drawer forces it. No
 *    icon in that state: the only close-ish lucide glyphs (Undo2, RotateCcw)
 *    read as "undo", which is the wrong promise.
 *  • Width matches the page CONTENT column, not this full-bleed bar, so the
 *    drawer lines up with the card above it.
 *  • Drag-resizable from the bottom edge; the resized height is DROPPED on close
 *    so it always reopens at its original size.
 *  • The drawer is the single scroll boundary. Inner content must not add its
 *    own scroll box — scrolling anywhere over the drawer moves the drawer.
 */

export interface DrawerSpec {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Rendered only while open, so closed drawers cost nothing. */
  render: () => ReactNode;
  count?: number;
  tone?: 'gold' | 'green';
}

const DEFAULT_HEIGHT = 460;
const MIN_HEIGHT = 160;

/** One button size for every control in this bar — drawers and actions alike. */
/* One button size for every control in this bar.
   MOBILE gets bigger targets and a grid cell (w-full + centred) rather than a
   cramped row — at most three across, most often two — because a mistaken tap
   here can void a contract. Desktop keeps the compact inline size. */
export const SUBHEADER_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium focus-ring whitespace-nowrap '
  + 'w-full px-3 py-3 text-sm sm:w-auto sm:px-3.5 sm:py-2 sm:shrink-0';

export function ContractSubheader({
  drawers, extras, openRequest, viewers = [],
}: {
  drawers: DrawerSpec[];
  /** Other people looking at this contract right now. Rendered as a quiet
   *  presence chip — the point is "they can see what you are doing", so it has
   *  to be visible without competing with the actions. */
  viewers?: { key: string; name: string }[];
  /** Non-drawer actions. Rendered inside the same bar at the same button size. */
  extras?: ReactNode;
  /** Lets the page open a drawer programmatically — e.g. posting a comment opens
   *  Change requests so the author sees where it landed. Bump `nonce` to
   *  re-trigger for the same key. */
  openRequest?: { key: string; nonce: number };
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [barOpen, setBarOpen] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const nonce = openRequest?.nonce;
  const requestedKey = openRequest?.key;
  useEffect(() => {
    if (!requestedKey || nonce === undefined) return;
    setOpenKey(requestedKey);
    setHeight(DEFAULT_HEIGHT);
  }, [requestedKey, nonce]);

  const toggle = useCallback((key: string) => {
    setBarOpen(true);
    setOpenKey((cur) => {
      const next = cur === key ? null : key;
      setHeight(DEFAULT_HEIGHT);   // resized state is dropped on every close
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dragRef.current) return;
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      setHeight(Math.max(MIN_HEIGHT, dragRef.current.startH + (e.clientY - dragRef.current.startY)));
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  });

  const active = drawers.find((d) => d.key === openKey) ?? null;
  // Collapsed by default on MOBILE only: the bar is worth its space on a wide
  // screen, but on a phone it would push the document off the first screen.
  // Opening a drawer reveals the controls, so the state can never strand you.

  return (
    // -mx cancels <main>'s px so the bar reaches the nav and the window edge.
    // -mt cancels <main>'s TOP padding so the bar begins flush against the app
    // header on page load, not only once you have scrolled far enough for
    // `sticky` to engage. -mx cancels its side padding so the bar reaches the
    // nav on the left and the window edge on the right.
    <div className="sticky top-14 z-30 -mt-6 sm:-mt-9 mb-6 -mx-4 sm:-mx-8 xl:-mx-12">
      <div className="bg-cream-100/95 backdrop-blur border-b border-green-800/15 px-4 sm:px-8 xl:px-12 py-2.5">
        {/* MOBILE toggle. The bar stays sticky under the app header either way —
            collapsing hides the CONTROLS, not the bar, so the affordance to bring
            them back is always in the same place. */}
        <button type="button" onClick={() => setBarOpen((v) => !v)}
          aria-expanded={barOpen}
          className="sm:hidden w-full flex items-center justify-between py-1 text-left">
          <span className="text-[13px] font-medium text-green-900">
            {active ? active.label : 'Contract actions'}
          </span>
          <ChevronDown size={16} className={`text-muted transition-transform ${barOpen ? '' : '-rotate-90'}`} />
        </button>

        <div className={`${barOpen ? 'grid' : 'hidden'} grid-cols-2 gap-2 pt-2
                         sm:flex sm:flex-wrap sm:items-center sm:gap-2 sm:pt-0`}>
          {drawers.map((d) => {
            const isOpen = openKey === d.key;
            const tone = d.tone ?? 'green';
            return (
              <button key={d.key} type="button" aria-expanded={isOpen}
                onClick={() => toggle(d.key)}
                className={`${SUBHEADER_BTN} ${
                  isOpen
                    ? (tone === 'gold'
                        ? 'border-gold-400 bg-gold-50 text-gold-900 shadow-inner'
                        : 'border-green-700 bg-green-50 text-green-900 shadow-inner')
                    : 'border-green-800/20 bg-white text-green-900 hover:bg-green-800/5'}`}>
                {/* No icon while open — see the note above on Undo2/RotateCcw. */}
                {!isOpen && d.icon}
                {isOpen ? 'Click to close' : d.label}
                {!isOpen && d.count !== undefined && d.count > 0 && (
                  <span className="rounded-full bg-gold-400/30 px-1.5 text-[11px] tabular-nums">{d.count}</span>
                )}
              </button>
            );
          })}
          {extras}
          {viewers.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 text-[12px] text-green-800 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 shrink-0"
              title={viewers.map((v) => v.name).join(', ')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse" aria-hidden="true" />
              {viewers.length === 1
                ? `${viewers[0].name} is viewing`
                : `${viewers.length} others viewing`}
            </span>
          )}
        </div>
      </div>

      {active && (
        // Aligned to the CONTENT column (the bar's own padding), so the drawer
        // sits flush under the card rather than under the full-bleed bar.
        <div className="px-4 sm:px-8 xl:px-12">
          <div className="bg-white border-x border-b border-green-800/15 rounded-b-lg shadow-lg">
            <div style={{ height }} className="overflow-y-auto overscroll-contain">
              <div className="p-4">{active.render()}</div>
            </div>
            <div
              role="separator"
              aria-label="Resize drawer"
              onMouseDown={(e) => {
                dragRef.current = { startY: e.clientY, startH: height };
                e.preventDefault();
              }}
              className="h-2.5 cursor-ns-resize bg-green-800/5 hover:bg-green-800/15 border-t border-green-800/10 flex items-center justify-center rounded-b-lg">
              <span className="w-8 h-0.5 rounded bg-green-800/25" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
