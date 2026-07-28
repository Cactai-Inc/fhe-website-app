/* Write-result guard.
 *
 * LIVE DEFECT (2026-07-28): the team editor reported "Saved." while persisting
 * nothing. Supabase returns NO error when RLS filters an UPDATE to zero rows —
 * the statement is legal, it just matches nothing. Every write in this codebase
 * checked only `error`, so a silently-blocked write was indistinguishable from
 * a successful one.
 *
 * assertWrote() closes that: pass a write that RETURNS its rows (add
 * `.select()` to the query) and it throws when nothing was affected. A caller
 * that catches errors — every one of ours does — then surfaces a real message
 * instead of a success toast.
 */

export class WriteBlockedError extends Error {
  constructor(what: string) {
    super(
      `${what} did not save. You may not have permission to change this record, ` +
      `or it may have been moved. Nothing was changed.`,
    );
    this.name = 'WriteBlockedError';
  }
}

/** Throw unless the write actually affected at least one row. */
export function assertWrote<T>(
  result: { data: T[] | null; error: { message: string } | null },
  what: string,
): T[] {
  if (result.error) throw new Error(result.error.message);
  const rows = result.data ?? [];
  if (rows.length === 0) throw new WriteBlockedError(what);
  return rows;
}
