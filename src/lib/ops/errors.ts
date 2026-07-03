/** Normalize anything thrown into a human-readable message.
 *
 * Supabase/PostgREST rejections are plain objects ({ message, details, hint,
 * code }), not Error instances — String(err) renders "[object Object]" and
 * instanceof-Error branches fall through to generic fallbacks, hiding the real
 * cause (owner-reported). Every catch branch should surface THIS instead.
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
