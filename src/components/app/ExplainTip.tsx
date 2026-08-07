import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

/**
 * TASK TIPTAP — tap-capable replacement for every `title=` explanation in the
 * contract renderer. Native `title` never fires on iOS Safari tap, so a field
 * the viewer cannot edit ("This item is set by the Lessor.", an imported
 * value's source, the required-field asterisk…) had no way to explain itself
 * on the phones clients actually read and sign on.
 *
 * Click/tap toggles a pinned-open bubble; hovering (mouse only — gated on
 * `(hover: hover)` so touch never fires it) previews without a click; Escape
 * or a tap/click outside closes it; only one bubble is open at a time across
 * the whole page (module-level `activeClose`). `title`/`aria-label` stay on
 * the trigger unchanged, so a screen reader gets the same explanation it
 * always did regardless of the bubble's visual open state — the bubble is a
 * sighted/touch affordance layered on top, not the accessibility mechanism.
 *
 * Positioned via a `document.body` portal at `position: fixed`, so it always
 * escapes an ancestor's `overflow: auto/hidden` (the document panel scrolls)
 * and clamps to the viewport instead of overflowing a 390px screen — the
 * failure mode this task exists to fix.
 *
 * `underline` draws the dotted-underline cue this codebase already used for
 * "this value is locked, here's why" — applied by default so every converted
 * site reads the same way. Pass `false` where the trigger is already its own
 * distinct marker (an icon glyph, the required `*`, a highlighted span) so
 * the cue isn't doubled up under a single character.
 *
 * `asButton` (default true) adds `role="button"` + `aria-expanded` — skip it
 * (pass `false`) when `children` contains real (even if disabled) form
 * controls, since ARIA button semantics can suppress a screen reader's
 * separate access to descendant controls.
 */

let activeClose: (() => void) | null = null;

function activate(closeSelf: () => void) {
  if (activeClose && activeClose !== closeSelf) activeClose();
  activeClose = closeSelf;
}
function deactivate(closeSelf: () => void) {
  if (activeClose === closeSelf) activeClose = null;
}

function hoverCapable(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
}

export function ExplainTip({
  text, children, as = 'span', underline = true, asButton = true, className = '',
}: {
  /** The explanation. Falsy → renders `children` plain, no affordance at
   *  all (matches every call site's existing `tip ? … : ''` fallback). */
  text?: string | null;
  children: ReactNode;
  /** 'div' for call sites whose content is block-level (mirrors the
   *  block-vs-inline Tag choice already made at each call site); 'mark' to
   *  keep a highlighted span's semantic element when converting it. */
  as?: 'span' | 'div' | 'mark';
  underline?: boolean;
  asButton?: boolean;
  className?: string;
}) {
  // Checked per mount, not at module load — a device's hover capability
  // doesn't change mid-session, so this never needs to re-run.
  const [isHoverCapable] = useState(hoverCapable);
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovering || pinned;
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const closeSelf = useCallback(() => { setHovering(false); setPinned(false); }, []);

  useEffect(() => () => deactivate(closeSelf), [closeSelf]);

  // Two-pass position: render the bubble (measured, not yet placed), then
  // clamp against the viewport — the right-edge-field-on-a-phone case this
  // task calls out. `fixed` coordinates are viewport-relative throughout.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !bubbleRef.current) return;
    const t = triggerRef.current.getBoundingClientRect();
    const b = bubbleRef.current.getBoundingClientRect();
    const margin = 8;
    const left = Math.min(Math.max(t.left, margin), window.innerWidth - b.width - margin);
    const spaceBelow = window.innerHeight - t.bottom;
    const top = spaceBelow >= b.height + margin
      ? t.bottom + margin
      : Math.max(t.top - b.height - margin, margin);
    setPos({ top, left });
  }, [open]);

  // Dismiss on outside tap/click, Escape, or scroll — a `fixed` bubble drifts
  // out of alignment with its trigger the moment the page moves under it, so
  // scroll closes rather than leaving a stale bubble floating over new text.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (bubbleRef.current?.contains(target)) return;
      closeSelf();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeSelf(); triggerRef.current?.focus(); }
    };
    const onScroll = () => closeSelf();
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, closeSelf]);

  if (!text) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  const toggle = () => {
    setPinned((was) => {
      const next = !was;
      if (next) activate(closeSelf); else if (!hovering) deactivate(closeSelf);
      return next;
    });
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  };
  const onMouseEnter = isHoverCapable ? () => { activate(closeSelf); setHovering(true); } : undefined;
  const onMouseLeave = isHoverCapable ? () => setHovering(false) : undefined;

  const Tag = as;
  const cls = `cursor-help focus-ring rounded-sm${
    underline ? ' [text-decoration:underline_dotted] decoration-gold-500/60 underline-offset-2' : ''
  }${className ? ` ${className}` : ''}`;

  return (
    <>
      <Tag
        ref={triggerRef as never}
        tabIndex={0}
        {...(asButton ? { role: 'button' as const, 'aria-expanded': open } : {})}
        title={text}
        aria-label={text}
        className={cls}
        onClick={(e: React.MouseEvent) => { e.stopPropagation(); toggle(); }}
        onKeyDown={onKeyDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {children}
      </Tag>
      {open && createPortal(
        // Mounted (off-screen, hidden) even before `pos` is known — it has to
        // exist in the DOM for the layout effect above to measure it. Only
        // becomes visible once that measurement has placed it, so there's no
        // flash at the wrong spot.
        <div
          ref={bubbleRef}
          role="tooltip"
          style={pos
            ? { position: 'fixed', top: pos.top, left: pos.left }
            : { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }}
          className="z-[100] max-w-[min(20rem,calc(100vw-1rem))] rounded-lg border border-green-800/15 bg-white shadow-lg px-3 py-2 text-xs text-secondary font-sans leading-relaxed"
        >
          {text}
        </div>,
        document.body,
      )}
    </>
  );
}
