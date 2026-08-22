/**
 * The dashboard's two shared formatters.
 *
 * They live beside the registry rather than in `DashboardChrome.tsx` for a
 * mechanical reason worth stating: a module that exports both React components
 * and plain functions breaks Fast Refresh, and the repo's lint says so on every
 * file that does it. Two lines of code are not worth a warning the next person
 * has to decide whether to believe.
 */

export const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** "just now" / "7h" / "3 days" — one age vocabulary for every zone. */
export function ageLabel(hours: number): string {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.floor(hours)}h`;
  const d = Math.floor(hours / 24);
  return d === 1 ? '1 day' : `${d} days`;
}
