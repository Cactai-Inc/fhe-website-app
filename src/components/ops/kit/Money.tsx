/**
 * Formats a numeric amount as USD. `Money.format(15000)` → `"$15,000.00"`.
 * `null`/`undefined`/non-finite renders the `fallback` (default em dash).
 */
export interface MoneyProps {
  amount: number | null | undefined;
  /** ISO 4217 currency code. Default 'USD'. */
  currency?: string;
  /** Rendered when amount is null/undefined/NaN. Default '—'. */
  fallback?: string;
  className?: string;
}

export function formatMoney(
  amount: number | null | undefined,
  currency = 'USD',
): string | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return null;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function Money({ amount, currency = 'USD', fallback = '—', className }: MoneyProps) {
  const formatted = formatMoney(amount, currency);
  return (
    <span className={className} data-testid="money">
      {formatted ?? fallback}
    </span>
  );
}
