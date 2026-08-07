/**
 * TASK-WALLRETURN — the signing wall's return-destination memory.
 *
 * AppLayout forcibly redirects a walled member to /app/onboarding, discarding
 * wherever they were actually headed (docs/tasks/TASK-WALLRETURN-preserve-destination.md).
 * This module captures that destination before the redirect and hands it back
 * once the wall clears, so a contract invitation (or any other deep link)
 * isn't silently dropped.
 *
 * sessionStorage, not a query param: signing runs through several same-URL
 * step transitions inside Onboarding.tsx (details → horse → sign → payment →
 * done) plus a possible reload, and a query param would need every one of
 * those transitions — and every `navigate()` call along the way — to keep
 * forwarding it, which is easy to drop silently. sessionStorage survives the
 * whole round trip untouched, and it never puts an internal destination in
 * the URL bar, browser history, or server logs.
 */

const STORAGE_KEY = 'fhe.wallReturnTo';

/** Internal /app/* path (optionally with a query string) only. Rejects an
 *  absolute URL, a protocol-relative path ("//host/…"), or any other scheme —
 *  the stored value must never be capable of navigating off-origin. This is
 *  the sole gate against turning stored state into an open redirect. */
export function isSafeAppDestination(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return false;
  if (/\s/.test(value)) return false;
  if (!value.startsWith('/app/')) return false;
  if (value.startsWith('//')) return false; // protocol-relative
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return false; // any "scheme:" prefix — defense in depth
  // never point back at the wall route itself — that would be a no-op loop
  if (value === '/app/onboarding' || value.startsWith('/app/onboarding?') || value.startsWith('/app/onboarding/')) {
    return false;
  }
  return /^\/app\/[A-Za-z0-9][A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/.test(value);
}

/** Capture where a walled member was headed, before AppLayout redirects them
 *  to /app/onboarding. Called on every interception, so the most recently
 *  attempted destination always wins over anything captured earlier. */
export function captureWallReturnDestination(pathname: string, search: string): void {
  const dest = `${pathname}${search}`;
  if (!isSafeAppDestination(dest)) return;
  try { sessionStorage.setItem(STORAGE_KEY, dest); } catch { /* storage unavailable — nothing to capture */ }
}

/** Read and clear the captured destination in one step, so a stale value can
 *  never be reused on a later, unrelated visit. Returns null when nothing was
 *  captured, or what was captured fails validation — both cases fall back to
 *  today's default behavior identically. */
export function consumeWallReturnDestination(): string | null {
  let dest: string | null = null;
  try {
    dest = sessionStorage.getItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    return null;
  }
  return dest && isSafeAppDestination(dest) ? dest : null;
}
