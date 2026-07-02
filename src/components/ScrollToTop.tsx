import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA scroll restoration: react-router keeps the window scroll position across
 * client-side navigations, so a link tapped at the bottom of one page opens the
 * next page mid-scroll. On every pathname change, jump to the top — unless the
 * navigation targets a #hash anchor, in which case scroll that element into view.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView();
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);

  return null;
}
