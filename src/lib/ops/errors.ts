/** Normalize anything thrown into a human-readable message.
 *
 * Supabase/PostgREST rejections are plain objects ({ message, details, hint,
 * code }), not Error instances — String(err) renders "[object Object]" and
 * instanceof-Error branches fall through to generic fallbacks, hiding the real
 * cause (owner-reported). Every catch branch should surface THIS instead.
 *
 * ⚠️ AND EVERY CATCH BRANCH THAT MATCHES A MACHINE CODE MUST READ IT THROUGH HERE
 * TOO. `supabase-js` builds a real `PostgrestError` only when `.throwOnError()` was
 * used; every wrapper in this codebase does `if (error) throw error`, which throws
 * the plain object PostgREST parsed out of the response body. So a branch written
 * as `const msg = e instanceof Error ? e.message : ''` sees an EMPTY STRING, every
 * `msg.includes('SOME_CODE')` test fails, and the fallback prints the raw message —
 * which is the machine token itself. That is what WALK1 photographed: the literal
 * string `NO_CREDITS` on the calendar, with the mapped "You don't have any lesson
 * credits" panel sitting right there, unreachable (BUYANDBOOK §5).
 */
export function toErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === 'string') return err || fallback;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const msg = [o.message, o.error_description, o.error, o.details]
      .find((v): v is string => typeof v === 'string' && v.length > 0);
    if (msg) {
      const hint = typeof o.hint === 'string' && o.hint ? ` (${o.hint})` : '';
      return msg + hint;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
