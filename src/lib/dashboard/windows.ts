/**
 * THE REVENUE WINDOWS — computed once, used by both surfaces.
 *
 * TASK-DASHBOARDBUILD §7.4: *"the dashboard tile and the calendar tile show the
 * identical number, both derived from paid purchases at payment date."*
 *
 * `revenue_summary` guarantees the second half. THIS FILE GUARANTEES THE FIRST.
 * Two surfaces calling one correct function still print two different figures if
 * each decides for itself when the week begins — and X6 records that this tenant
 * has no timezone of its own, so "the database's idea of Sunday" and "the
 * browser's idea of Sunday" are not guaranteed to be the same instant.
 *
 * So the window is a client-side fact, derived in the viewer's local time (which
 * the plan states is correct for the two owners), and both the dashboard ribbon
 * and the calendar money strip pass the SAME bounds to the SAME RPC.
 *
 * Sunday-start, matching `CalendarPage`'s own `startOfWeek` and the barn's week.
 */

export interface Window { from: string; to: string }

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function weekWindow(now: Date = new Date()): Window {
  const s = startOfDay(now);
  const from = new Date(s.getFullYear(), s.getMonth(), s.getDate() - s.getDay());
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function monthWindow(now: Date = new Date()): Window {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}
