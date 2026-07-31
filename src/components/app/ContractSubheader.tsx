import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * CONTRACT SUBHEADER — one unit carrying every drawer control.
 *
 * Replaces the previous arrangement, which had TWO sets of the same buttons: an
 * inline pair inside the action card, and a duplicate pair in a sticky bar that
 * appeared on scroll. The sticky duplicates toggled the same state as the
 * originals, so pressing one opened a drawer back at the original location —
 * off-screen, since you had scrolled past it. There is now exactly one set of
 * buttons and the drawer opens from the subheader itself.
 *
 * Behaviour:
 *  • The subheader is sticky and stays fully visible while the page scrolls.
 *  • Exactly one drawer is open at a time — opening one closes the other.
 *  • A button's label becomes "Click to close" while its drawer is open, and
 *    reverts whenever the drawer closes, including when another drawer forces it.
 *  • The drawer is 80% of the content width and drag-resizable from its bottom
 *    edge; the resized height is DROPPED on close, so it always reopens at its
 *    original size.
 *  • Inner content is NOT independently scrollable — it renders at its natural
 *    height. Reading a list of change requests should not mean scrolling a small
 *    box inside a page that also scrolls.
 */

export interface DrawerSpec {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Rendered only while open, so closed drawers cost nothing. */
  render: () => ReactNode;
  /** Optional count pill (e.g. open change requests). */
  count?: number;
  /** Accent for the open state and the drawer's left rule. */
  tone?: 'gold' | 'green';
}

const DEFAULT_HEIGHT = 420;
const MIN_HEIGHT = 160;

export function ContractSubheader({
  drawers, extras, stickyTop = 'top-14', openRequest,
}: {
  drawers: DrawerSpec[];
  /** Non-drawer actions (sign, notify, void) — always visible, never duplicated. */
  extras?: ReactNode;
  stickyTop?: string;
  /** Lets the page open a drawer programmatically — e.g. posting a comment opens
   *  Change requests so the author sees where it landed. Bump the `nonce` to
   *  re-trigger for the same key. */
  openRequest?: { key: string; nonce: number };
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  const nonce = openRequest?.nonce;
  const requestedKey = openRequest?.key;
  useEffect(() => {
    if (!requestedKey || nonce === undefined) return;
    setOpenKey(requestedKey);
    setHeight(DEFAULT_HEIGHT);
  }, [requestedKey, nonce]);

  // Opening a drawer closes any other; closing drops the resized height so the
  // next open is always the original size.
  const toggle = useCallback((key: string) => {
    setOpenKey((cur) => {
      const next = cur === key ? null : key;
      setHeight(DEFAULT_HEIGHT);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dragRef.current) return;
    function onMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const delta = e.clientY - dragRef.current.startY;
      setHeight(Math.max(MIN_HEIGHT, dragRef.current.startH + delta));
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

  return (
    <div className={`sticky ${stickyTop} z-30 mb-4`}>
      <div className="bg-cream-100/95 backdrop-blur border-b border-green-800/15 -mx-1 px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {drawers.map((d) => {
            const isOpen = openKey === d.key;
            const tone = d.tone ?? 'green';
            return (
              <button key={d.key} type="button" aria-expanded={isOpen}
                onClick={() => toggle(d.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium focus-ring shrink-0 ${
                  isOpen
                    ? (tone === 'gold'
                        ? 'border-gold-400 bg-gold-50 text-gold-900 shadow-inner'
                        : 'border-green-700 bg-green-50 text-green-900 shadow-inner')
                    : 'border-green-800/20 text-green-900 hover:bg-green-800/5'}`}>
                {d.icon}
                {/* The label itself reports the action, so the control reads the
                    same whether you arrived by clicking it or by another drawer
                    closing it. */}
                {isOpen ? 'Click to close' : d.label}
                {!isOpen && d.count !== undefined && d.count > 0 && (
                  <span className="rounded-full bg-gold-400/30 px-1.5 text-[11px] tabular-nums">{d.count}</span>
                )}
              </button>
            );
          })}
          {extras}
        </div>
      </div>

      {active && (
        <div className="w-4/5 bg-white border-x border-b border-green-800/15 rounded-b-lg shadow-lg">
          <div style={{ height }} className="overflow-hidden">
            {/* The drawer is the scroll boundary; inner content renders at its
                natural height rather than inside a second scroll box. */}
            <div className="h-full overflow-y-auto p-4">
              {active.render()}
            </div>
          </div>
          {/* Drag handle — resizes the drawer; the size resets on close. */}
          <div
            role="separator"
            aria-label="Resize drawer"
            onMouseDown={(e) => {
              dragRef.current = { startY: e.clientY, startH: height };
              e.preventDefault();
            }}
            className="h-2.5 cursor-ns-resize bg-green-800/5 hover:bg-green-800/15 border-t border-green-800/10 flex items-center justify-center">
            <span className="w-8 h-0.5 rounded bg-green-800/25" />
          </div>
        </div>
      )}
    </div>
  );
}
