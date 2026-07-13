import type { PriceModel } from './types';

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

const CADENCE_LABEL: Record<string, string> = {
  one_time: '', per_session: ' / session', monthly: ' / month', per_engagement: ' / engagement',
};

/** Human-readable price text for an acquisition offering's price_model.
 *  Display-only — never used to compute a charge. */
export function formatPriceModel(pm: PriceModel | null | undefined): string {
  if (!pm || pm.kind === 'inquire') return 'Inquire';
  const cad = CADENCE_LABEL[pm.cadence ?? 'one_time'] ?? '';
  const basis = pm.basis ? ` of ${pm.basis}` : '';
  switch (pm.kind) {
    case 'fixed':
      return pm.fee_amount != null ? `${usd(pm.fee_amount)}${cad}` : 'Inquire';
    case 'percent':
      return pm.percent != null ? `${pm.percent}%${basis}` : 'Inquire';
    case 'fee_plus_percent': {
      const fee = pm.fee_amount != null ? usd(pm.fee_amount) : null;
      const pct = pm.percent != null ? `${pm.percent}%${basis}` : null;
      return [fee, pct].filter(Boolean).join(' + ') || 'Inquire';
    }
    default:
      return 'Inquire';
  }
}
