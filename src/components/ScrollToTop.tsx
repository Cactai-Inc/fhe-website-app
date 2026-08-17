import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * SPA scroll restoration.
 *
 * react-router keeps the window scroll position across client-side navigations,
 * so a link tapped at the bottom of one page opens the next page mid-scroll. On
 * a forward navigation we jump to the top — unless the URL carries a #hash, in
 * which case that element is scrolled into view.
 *
 * BACK/FORWARD IS DIFFERENT (owner, 2026-08-16: clicking a service or a nav link
 * and then pressing Back should return to the section you left, not the top of
 * the page). A POP navigation is the browser moving through history, and the
 * browser has already restored a scroll position for that entry — so we must NOT
 * override it. The one thing we still do on POP is honour a #hash, because
 * `history.scrollRestoration` cannot know about an anchor that was never
 * scrolled to natively.
 *
 * This is why the section anchors matter beyond navigation: with every section
 * addressable, a POP back to `/story#our-services` lands exactly where the
 * visitor left, instead of dumping them at the hero.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // A hash always wins — forward or back.
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    // Back/forward: leave the browser's own restored position alone.
    if (navigationType === 'POP') return;

    window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return null;
}
