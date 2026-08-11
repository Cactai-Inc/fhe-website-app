/**
 * TASK-GOOGLEAUTH — the Google identity-link round trip.
 *
 * `linkIdentity()` sends the browser to Google and back. Everything the member
 * needs to be told about the outcome arrives in that return URL, so this module
 * owns reading it, clearing it, and turning a provider error code into a
 * sentence a member can act on.
 *
 * Two facts shape the design:
 *
 * 1. **The error survives; the success does not.** On success `_getSessionFromURL`
 *    consumes the hash and wipes it (`window.location.hash = ''`), so there is
 *    nothing left to read — success is confirmed from the SERVER's identity list,
 *    never from the URL. On failure it throws *before* the wipe, so the
 *    `error_code` / `error_description` params are still sitting there for us.
 * 2. **Nothing in the URL says "you came back from a link attempt".** A member
 *    who abandons consent returns with a bare URL, indistinguishable from someone
 *    who just opened the page. A sessionStorage flag set immediately before the
 *    redirect supplies that fact, the same round-trip pattern as `wallReturn.ts`.
 *
 * `redirectTo` is deliberately left as the plain `/app/account` path with no
 * query string — the Supabase Redirect URL allow-list is configured elsewhere and
 * a query string can fail to match it, which would dump the member on the home
 * page. The flag carries the "open My Login" intent instead of the URL.
 */

const PENDING_KEY = 'fhe.googleLink.pending';

/** Provider error params, wherever GoTrue put them. The client runs the implicit
 *  flow (auth-js default `flowType`), so these arrive in the hash — but a PKCE
 *  redirect error would arrive in the query string, and reading both costs
 *  nothing and cannot mis-read. */
const ERROR_PARAMS = ['error', 'error_code', 'error_description'] as const;

export interface GoogleLinkReturn {
  /** True only when this page load is the far side of a link attempt. */
  returned: boolean;
  /** GoTrue `error_code`, e.g. `identity_already_exists`. Null when none. */
  errorCode: string | null;
  /** GoTrue `error_description` — raw provider text, never shown unexplained. */
  errorDescription: string | null;
}

const NO_RETURN: GoogleLinkReturn = { returned: false, errorCode: null, errorDescription: null };

/** Read once per page load, then serve the same answer to every caller. Both the
 *  Account hub (deciding which section to open) and the My Login card (reporting
 *  the outcome) need this, and the first read destroys the evidence. */
let cached: GoogleLinkReturn | null = null;

/** Record that the browser is about to leave for Google, so the return can be
 *  recognised. Called immediately before `linkIdentity()` redirects. */
export function markGoogleLinkPending(): void {
  try { sessionStorage.setItem(PENDING_KEY, '1'); } catch { /* storage unavailable — return is simply not recognised */ }
}

/** Undo the mark when the redirect never happened (the server refused before
 *  the browser left), so a later visit doesn't report a return that never was. */
export function clearGoogleLinkPending(): void {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* nothing to clear */ }
}

/**
 * Read and clear the outcome of a link attempt: the pending flag plus any
 * provider error params in the URL. Idempotent for the lifetime of the page —
 * repeat callers get the same answer rather than an empty one.
 *
 * Clearing the URL params matters: left in place they would re-announce a stale
 * failure on every refresh of an account page that is otherwise fine.
 */
export function consumeGoogleLinkReturn(): GoogleLinkReturn {
  if (cached) return cached;
  if (typeof window === 'undefined') return NO_RETURN;

  let pending = false;
  try {
    pending = sessionStorage.getItem(PENDING_KEY) === '1';
    sessionStorage.removeItem(PENDING_KEY);
  } catch { /* storage unavailable — fall back to the URL params alone */ }

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const pick = (key: string) => hash.get(key) ?? query.get(key);

  const error = pick('error');
  const errorCode = pick('error_code');
  const errorDescription = pick('error_description');
  const hasError = Boolean(error || errorCode || errorDescription);

  if (hasError) stripErrorParams(hash, query);

  // A provider error with no pending flag is still a return — a member can land
  // here in a fresh tab. A pending flag with no error is the abandoned case.
  cached = (pending || hasError)
    ? { returned: true, errorCode: errorCode ?? error ?? null, errorDescription: errorDescription ?? null }
    : NO_RETURN;
  return cached;
}

/** Rewrite the address bar without the provider error params, preserving
 *  everything else in the hash and query. */
function stripErrorParams(hash: URLSearchParams, query: URLSearchParams): void {
  for (const key of ERROR_PARAMS) {
    hash.delete(key);
    query.delete(key);
  }
  const nextQuery = query.toString();
  const nextHash = hash.toString();
  const next = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${nextHash ? `#${nextHash}` : ''}`;
  try { window.history.replaceState(window.history.state, '', next); } catch { /* history unavailable — the message still shows */ }
}

/**
 * Turn a provider refusal into something a member can act on.
 *
 * The conflict case — the Google account they consented with is already attached
 * to a different account here — is a genuine identity merge and is routed to
 * staff by name. It is never resolved in this flow.
 */
export function describeLinkFailure(code: string | null, description: string | null): string {
  const raw = (description ?? '').trim();

  if (code === 'identity_already_exists' || code === 'user_already_exists'
    || /already (been )?(linked|registered|taken)/i.test(raw)) {
    return 'That Google account is already attached to a different account here. '
      + 'Joining the two is something the office has to do — contact us and we will sort it out. '
      + 'Nothing on this account has changed.';
  }

  if (code === 'manual_linking_disabled') {
    return 'Sign in with Google cannot be activated yet — identity linking is switched '
      + 'off for this site. Please let the office know. Nothing on this account has changed.';
  }

  if (code === 'access_denied' || /denied|cancel/i.test(raw)) {
    return 'You did not finish at Google, so nothing changed. Your email and password still work.';
  }

  if (code === 'bad_oauth_state') {
    return 'That sign-in link expired before you finished. Try again from this page. '
      + 'Nothing on this account has changed.';
  }

  return raw
    ? `Google sign-in could not be activated: ${raw}. Nothing on this account has changed.`
    : 'Google sign-in could not be activated. Nothing on this account has changed.';
}

/** Test seam only — the module cache is per page load in the browser. */
export function resetGoogleLinkReturnForTests(): void {
  cached = null;
}
