/**
 * RETURN-TO-ORIGIN — where a contract sends you back to.
 *
 * When someone opens a contract from a dashboard notification (or any other
 * linking surface), the post-void [keep/remove] decision and the document close
 * should return them THERE, not to a generic list.
 *
 * The mechanism is router state: a linking site passes `state={fromHere(...)}`,
 * and ContractPage reads `location.state.from`, falling back to
 * `/app/documents` when it is absent or unusable.
 *
 * RESILIENCE IS THE POINT. A missing, malformed, external, or hostile origin
 * must never throw and never navigate off-app — it just falls back. So every
 * read goes through `originFrom()`, which validates before returning.
 */

/** The fallback when no usable origin was supplied. */
export const DEFAULT_ORIGIN = '/app/documents';

/** Router state carried by a link into the contract page. */
export interface FromState { from?: string }

/**
 * Build the router state for a link INTO the contract page.
 * Pass the caller's current location (`useLocation()`), or an explicit path.
 *
 *   <Link to={`/app/contracts/${id}`} state={fromHere(location)}>
 */
export function fromHere(where: { pathname: string; search?: string } | string): FromState {
  if (typeof where === 'string') return { from: where };
  return { from: `${where.pathname}${where.search ?? ''}` };
}

/**
 * Read a usable origin out of router state.
 *
 * Accepts ONLY a same-app absolute path ("/app/..."), which rules out:
 *   • absent / non-string state
 *   • protocol-relative ("//evil.example") and absolute URLs — open-redirect bait
 *   • anything not rooted at "/"
 * Anything rejected silently becomes the fallback, so a bad origin degrades to
 * the documents list rather than erroring or leaving the app.
 */
export function originFrom(state: unknown, fallback: string = DEFAULT_ORIGIN): string {
  const raw = (state as FromState | null | undefined)?.from;
  if (typeof raw !== 'string') return fallback;
  const v = raw.trim();
  if (!v.startsWith('/')) return fallback;    // must be an in-app absolute path
  if (v.startsWith('//')) return fallback;    // protocol-relative → off-site
  if (v.includes('://')) return fallback;     // absolute URL → off-site
  return v;
}
