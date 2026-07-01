import { useEffect, useState } from 'react';

/**
 * Returns true when the user has requested reduced motion.
 * Use to gate parallax, smooth-scroll, and any JS-driven transform.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

const BASE_TITLE = 'French Heritage Equestrian';

/**
 * Sets the document title to "<page> | French Heritage Equestrian".
 * Pass the page-specific part only; restores the base title on unmount.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
