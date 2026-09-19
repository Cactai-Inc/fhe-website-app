import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * CONTRACT SUBHEADER — the contract workspace's own toolbar.
 *
 * Placement (owner spec 2026-07-31): pinned directly beneath the app header and
 * never moving, FULL BLEED — flush to the side nav on the left (whatever state
 * it is in) and to the window edge on the right. It achieves that by cancelling
 * <main>'s horizontal padding with negative margins, so it spans the content
 * column edge to edge without knowing the nav's width. It sticks at the app
 * header's own height via `--cs-hdr-h` (published on :root by
 * header-cardstock.css) rather than a hardcoded offset — the cardstock header
 * is 80px on desktop and varies per breakpoint, so the old `top-14` (56px, the
 * pre-cardstock h-14) let this bar slide under it,
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
}

/**
 * A TOOLBAR ACTION, DECLARED — not hand-placed. Each action states its own group
 * and how it looks; the bar renders every action whose caller included it (the
 * caller has already decided visibility from the document's state), grouped and
 * ordered. This replaces the old leading/extras/trailing/destructive slots, where
 * each button carried its own inline `{isOwnerSide && …}` condition and the reader
 * had to trace four render sites to know what showed when.
 *
 *   group 'primary'     — the actions you reach for: Send, Save, Accept & sign.
 *                         A `primary` tone fills; a `primary` action without it is
 *                         the outlined sibling (Save to Send's fill).
 *   group 'document'    — secondary document actions: Scroll, Add item, Generate
 *                         bill of sale, Withdraw/correct, Archive.
 *   group 'destructive' — Void / Delete, pinned to the right on whatever row.
 */
export interface ToolbarAction {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  group: 'primary' | 'document' | 'destructive';
  /** 'fill' = solid primary (Send); 'danger' = red (Void/Delete); default outline. */
  tone?: 'fill' | 'danger';
  disabled?: boolean;
  onClick: () => void;
  /** Hold a stable width so a label change (Save → Saved) does not reflow the row. */
  fixedWidth?: boolean;
}

const DEFAULT_HEIGHT = 460;
const MIN_HEIGHT = 160;

/* ONE BUTTON SIZE for every control in this bar, scaling CONTINUOUSLY with the
   viewport rather than jumping between two fixed sizes.

   The previous version set padding at `sm` and again at `lg` and called that
   scaling — it was two steps, and a fixed 8rem drawer width fought both, so the
   row still wrapped well above the intended breakpoint.

   THREE BANDS, corrected after the single-breakpoint version triggered the
   mobile grid far too early:

     < md (768px)   phone portrait and landscape — collapsed two-across grid with
                    full-size tap targets. Eight controls cannot be made readable
                    on one line here, and shrinking them until they fit leaves a
                    target too small for a button that can void a contract.
     md .. lg       iPad portrait — a WRAPPING row. Two tidy rows, not a grid and
                    not a crushed single line.
     >= lg (1024px) iPad landscape and desktop — one row, held by flex-nowrap,
                    narrowing through clamp() as the window shrinks.

   The nav rail only exists from lg up, so below that the bar has the full window
   width — the earlier sizing assumed a rail that was not there. */
/* ONE BUTTON, one comfortable size. The bar WRAPS into tidy rows rather than
   crushing every control onto one line — squeezing padding down to a few pixels
   to hold `flex-nowrap` is what made the row read as cramped and uneven. Padding,
   gap and type are steady from md up; the row wraps when it must (below). */
export const SUBHEADER_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-lg border font-medium '
  + 'focus-ring whitespace-nowrap w-full px-3 py-3 text-sm '
  // From md up: auto width, no forced shrink, a steady comfortable size.
  + 'md:w-auto md:py-2 md:px-3.5 md:text-[13px]';

/* Drawer buttons hold a consistent width so the row does not reflow when
   "Click to close" (wider than "Comments") replaces a label — but that width is
   now FLUID too. A fixed rem value was the main reason the bar wrapped early:
   three drawers at 8rem each claimed 24rem before anything else was measured. */
/* Below md: a two-across grid of full-size tap targets. From md up: a flex row
   that WRAPS — comfortable, consistent gaps, tidy rows when the controls exceed
   one line, instead of a single crushed line held by flex-nowrap. */
const ROW_CLS = 'grid-cols-2 gap-2 pt-2 min-w-0 md:flex md:grid-cols-none md:items-center md:pt-0 md:gap-2 md:flex-wrap';

const DRAWER_BTN_W = '';



export function ContractSubheader({
  drawers, actions = [], documentWidget, openRequest, viewers = [],
}: {
  drawers: DrawerSpec[];
  /** Every toolbar action the caller wants shown, in intent order. The bar groups
   *  them (primary · drawers · document · destructive) and lays them out; an action
   *  the document's state does not warrant is simply not in the list. */
  actions?: ToolbarAction[];
  /** A widget that is not a plain button (e.g. the Add-item popover) but belongs in
   *  the document group. Rendered after the document actions, styled as a button by
   *  the caller. Omit when there is none. */
  documentWidget?: ReactNode;
  /** Other people looking at this contract right now. Rendered as a quiet
   *  presence chip — the point is "they can see what you are doing", so it has
   *  to be visible without competing with the actions. */
  viewers?: { key: string; name: string }[];
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

  const toneClass = (a: ToolbarAction) =>
    a.tone === 'fill'
      ? 'border-green-800 bg-green-800 text-white hover:bg-green-700 disabled:opacity-60'
      : a.tone === 'danger'
        ? 'border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60'
        : 'border-green-800/20 bg-white text-green-900 hover:bg-green-800/5 disabled:opacity-60';
  const renderAction = (a: ToolbarAction) => (
    <button key={a.key} type="button" disabled={a.disabled} onClick={a.onClick}
      className={`${SUBHEADER_BTN} ${a.fixedWidth ? 'md:w-[7.5rem]' : ''} ${toneClass(a)}`}>
      {a.icon}{a.label}
    </button>
  );
  const primary = actions.filter((a) => a.group === 'primary');
  const documentActions = actions.filter((a) => a.group === 'document');
  const destructive = actions.filter((a) => a.group === 'destructive');
  // Collapsed by default on MOBILE only: the bar is worth its space on a wide
  // screen, but on a phone it would push the document off the first screen.
  // Opening a drawer reveals the controls, so the state can never strand you.

  return (
    // -mx cancels <main>'s px so the bar reaches the nav and the window edge.
    // -mt cancels <main>'s TOP padding so the bar begins flush against the app
    // header on page load, not only once you have scrolled far enough for
    // `sticky` to engage. -mx cancels its side padding so the bar reaches the
    // nav on the left and the window edge on the right.
    /* Escapes <main>'s padding via -mx. It must NOT use w-screen: that would
       slide the bar under the nav rail. The reading-width cap is lifted by
       ContractPage instead (it applies max-w-5xl to the document body rather
       than to the whole page), so this stays inside <main> and simply fills it. */
    <div className="sticky top-[var(--cs-hdr-h)] z-30 -mt-6 sm:-mt-9 mb-6 -mx-4 sm:-mx-8 xl:-mx-12">
      {/* Padding matches <main>'s so the buttons line up with the card below,
          but stops growing past sm: the xl:px-12 was throwing away 96px of usable
          width on each side exactly when the row needed it most. */}
      <div className="bg-cream-25 border-b border-green-800/15 px-4 sm:px-6 py-2.5 oh-subheader-shadow">
        {/* MOBILE toggle. The bar stays sticky under the app header either way —
            collapsing hides the CONTROLS, not the bar, so the affordance to bring
            them back is always in the same place.
            UIO-008: was a single ChevronDown rotated -90deg when closed (reading
            as a right arrow — "go somewhere", wrong for a block that expands in
            place) and unrotated when open (reading as down, the wrong way round).
            Swapped for the same ChevronDown/ChevronUp PAIR the nav groups use
            (AppLayout.tsx's CommunityNav toggle) instead of a rotated single
            icon — down closed, up open. Also `justify-between` -> `gap-1.5`:
            the label sat left and the arrow was pinned hard against the right
            edge of a full-width row, a big enough gap that the owner didn't
            register they were part of one control. `gap-1.5` matches this same
            bar's own icon-to-label spacing (SUBHEADER_BTN); the button keeps
            `w-full` so the tap target doesn't shrink, only where the arrow sits
            inside it changes. */}
        <button type="button" onClick={() => setBarOpen((v) => !v)}
          aria-expanded={barOpen}
          className="md:hidden w-full flex items-center gap-1.5 py-1 text-left">
          <span className="text-[13px] font-medium text-green-900">
            {active ? active.label : 'Contract actions'}
          </span>
          {barOpen
            ? <ChevronUp size={16} className="text-muted" />
            : <ChevronDown size={16} className="text-muted" />}
        </button>

        {/* ROW ONE: the controls you reach for constantly — Send, Save, and the
            three drawers. `min-w-0` lets them shrink rather than push row two's
            content down, and the shared button class scales its padding and text
            with the viewport so a standard desktop and a landscape tablet keep
            everything on one line. */}
        {/* THE SWITCH IS AT lg (1024px), NOT sm.

            The side rail itself only appears at lg — below that the bar spans the
            whole window. My earlier sizing assumed a ~256px rail was always
            taking space, so the "roomy" calculation was wrong precisely in the
            band where it mattered: at ~660px the bar was past sm, took the
            desktop row, and had barely 20px of slack. That is the in-between
            state in the owner's screenshot.

            BELOW lg — phone portrait AND landscape, iPad portrait: the collapsed
            two-across grid with full-size tap targets. Eight controls do not fit
            one readable line under 1024px however hard they are scaled, and
            shrinking them until they do produces targets too small for a control
            that can void a contract.

            lg AND UP — iPad landscape (1024px) and desktop: ONE flex row.
            clamp() in SUBHEADER_BTN narrows it with the window; `flex-nowrap`
            holds the line and `min-w-0` lets the children actually shrink. */}
        {/* `lg:grid-cols-none` is load-bearing. Switching `grid` → `lg:flex`
            does NOT cancel `grid-cols-2`: the element became a flex container
            while the stale column count still forced two tracks, so the row
            wrapped in pairs and left a gap after the last item on line one — the
            exact symptom in the owner's screenshot. flex-nowrap could not win
            against a grid template that was never reset. */}
        <div className={`${barOpen ? 'grid' : 'hidden'} ${ROW_CLS}`}>
          {/* PRIMARY — Send / Save / Accept & sign. */}
          {primary.map(renderAction)}
          {drawers.map((d) => {
            const isOpen = openKey === d.key;
            return (
              <button key={d.key} type="button" aria-expanded={isOpen}
                onClick={() => toggle(d.key)}
                className={`${SUBHEADER_BTN} ${DRAWER_BTN_W} ${
                  isOpen
                    // ONE open-state look for every drawer (owner: match the
                    // Requests treatment) — the open drawer is the same kind of
                    // state whichever one it is. UIO-018: untouched — only the
                    // hover (below) changes.
                    ? 'border-green-400 bg-green-50 text-green-900 shadow-inner'
                    // UIO-018: one hover language across both surfaces —
                    // reuses UIO-013's exact underline declaration
                    // (AppLayout.tsx's NAV_ROW_IDLE) rather than hand-tuning a
                    // second one that nearly matches. `md:` (not
                    // [@media(hover:hover)]) because this bar already
                    // restructures at that exact breakpoint — below it these
                    // are full-width touch targets in a 2-column grid, not a
                    // layout hover applies to regardless of input capability,
                    // unlike the nav rail which doesn't change shape by width.
                    : 'border-green-800/20 bg-white text-green-900 md:hover:underline md:hover:decoration-green-600 md:hover:decoration-2 md:hover:underline-offset-4'}`}>
                {/* No icon while open — see the note above on Undo2/RotateCcw. */}
                {!isOpen && d.icon}
                {/* Owner, 2026-08-08: "click" is wrong on a phone. The label is
                    resolved per input capability, not per viewport width — a
                    narrow desktop window still has a pointer, and a large tablet
                    does not. */}
                {d.label}
                {/* UIO-018: text-decoration propagates through descendant
                    boxes by default — without `no-underline` here, hovering
                    the button would draw the hover underline through this
                    pill's own digit too. The order names it explicitly as
                    not-interactive; this is what keeps it that way. */}
                {!isOpen && d.count !== undefined && d.count > 0 && (
                  <span className="rounded-full bg-green-400/30 px-1.5 text-[11px] tabular-nums no-underline">{d.count}</span>
                )}
              </button>
            );
          })}
          {/* ADD ITEM sits directly beside the drawers so it reads next to
              Requests (owner). It is a non-button widget (a popover). */}
          {documentWidget}
          {/* DOCUMENT — secondary actions (Generate BOS, Withdraw, Archive, …). */}
          {documentActions.map(renderAction)}

          {/* DESTRUCTIVE — Void / Delete, pinned to the RIGHT on whichever row
              they land, so the dangerous pair never floats into the middle. */}
          {destructive.length > 0 && (
            <span className="contents md:flex md:ml-auto md:flex-wrap md:items-center md:gap-2">
              {destructive.map(renderAction)}
            </span>
          )}

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
