import { useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import { Link } from 'react-router-dom';
import { ArrowRight, Receipt } from 'lucide-react';
import { Money, StatusBadge, EmptyState } from '../../lib/ops';
import { useDocumentTitle } from '../../lib/hooks';
import {
  listMyOpenBillableLines, listMyEngagements, listMyTransactions, listMyPayments,
} from '../../lib/ops/api-balance';
import type {
  OpenBillableLine, MyEngagement, MyTransaction, MyPayment,
} from '../../lib/ops/api-balance';
import {
  listBillingSchedules, setBillingReminders, nextDue, type BillingSchedule,
} from '../../lib/billing';

const SOURCE_LABEL: Record<string, string> = {
  consumption: 'Supplies & consumption',
  board: 'Board',
  lesson: 'Lessons',
  fee: 'Fee',
};
const METHOD_LABEL: Record<string, string> = { zelle: 'Zelle', stripe: 'Card (Stripe)' };
const TXN_LABEL: Record<string, string> = {
  INVOICE: 'Invoice', PURCHASE: 'Purchase', SALE: 'Sale', LEASE: 'Lease',
};

const engagementTitle = (e: MyEngagement) =>
  `${e.display_code ?? 'Engagement'} · ${e.service_type
    ? e.service_type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : 'General'}`;

interface Group {
  key: string;
  engagement: MyEngagement | null; // null = charges not tied to one engagement
  lines: OpenBillableLine[];
  transactions: MyTransaction[];
}

/** Group open lines + transactions by engagement. A line's engagement is
 *  inferred from its horse (engagement.primary_horse_id), the same derivation
 *  settle_billable_lines uses; anything un-tied lands in a General group. */
function groupByEngagement(
  engagements: MyEngagement[], lines: OpenBillableLine[], transactions: MyTransaction[],
): Group[] {
  const groups = new Map<string, Group>();
  const forKey = (key: string, engagement: MyEngagement | null): Group => {
    let g = groups.get(key);
    if (!g) { g = { key, engagement, lines: [], transactions: [] }; groups.set(key, g); }
    return g;
  };
  const byHorse = new Map(engagements.filter((e) => e.primary_horse_id)
    .map((e) => [e.primary_horse_id as string, e]));
  const byId = new Map(engagements.map((e) => [e.id, e]));

  for (const l of lines) {
    const eng = l.horse_id ? byHorse.get(l.horse_id) ?? null : null;
    forKey(eng ? eng.id : 'general', eng).lines.push(l);
  }
  for (const t of transactions) {
    const eng = t.engagement_id ? byId.get(t.engagement_id) ?? null : null;
    forKey(eng ? eng.id : 'general', eng).transactions.push(t);
  }
  // engagement groups in engagement order, the General bucket last.
  const ordered: Group[] = [];
  for (const e of engagements) { const g = groups.get(e.id); if (g) ordered.push(g); }
  const general = groups.get('general');
  if (general) ordered.push(general);
  return ordered;
}

export default function MyBalance() {
  useDocumentTitle('My Balance');
  const [lines, setLines] = useState<OpenBillableLine[]>([]);
  const [engagements, setEngagements] = useState<MyEngagement[]>([]);
  const [transactions, setTransactions] = useState<MyTransaction[]>([]);
  const [payments, setPayments] = useState<MyPayment[]>([]);
  const [schedules, setSchedules] = useState<BillingSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      listMyOpenBillableLines(), listMyEngagements(), listMyTransactions(), listMyPayments(),
    ])
      .then(([l, e, t, p]) => {
        if (!active) return;
        setLines(l); setEngagements(e); setTransactions(t); setPayments(p);
      })
      .catch((err: unknown) => {
        if (active) setError(toErrorMessage(err, 'Could not load your balance.'));
      })
      .finally(() => active && setLoading(false));
    listBillingSchedules()
      .then((s) => active && setSchedules(s))
      .catch(() => { /* billing section just stays empty */ });
    return () => { active = false; };
  }, []);

  async function toggleReminders(s: BillingSchedule) {
    try {
      await setBillingReminders(s.id, !s.reminders_on);
      setSchedules((prev) => prev.map((x) => (x.id === s.id ? { ...x, reminders_on: !x.reminders_on } : x)));
    } catch {
      setError('Could not update reminders.');
    }
  }

  const groups = useMemo(
    () => groupByEngagement(engagements, lines, transactions),
    [engagements, lines, transactions],
  );
  const openTotal = useMemo(() => lines.reduce((sum, l) => sum + Number(l.amount), 0), [lines]);
  const isEmpty = groups.length === 0 && payments.length === 0 && schedules.length === 0;

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My balance</p>
      <h1 className="heading-section text-green-800 mb-8">Where your account stands.</h1>

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : error ? (
        <p role="alert" className="body-text text-sm text-red-700">{error}</p>
      ) : isEmpty ? (
        <div className="bg-white border border-green-800/10">
          <EmptyState
            icon={<Receipt size={24} aria-hidden="true" />}
            title="No charges yet"
            message="Open charges, invoices, and payments will appear here as your account is billed."
            action={<Link to="/services" className="btn-outline-gold">Ways to Ride <ArrowRight size={16} /></Link>}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {/* Open balance summary */}
          <div className="bg-white border border-green-800/10 p-5 flex items-center justify-between">
            <p className="text-sm font-sans font-medium text-green-900">Open balance</p>
            <Money amount={openTotal} className="text-lg font-serif text-green-800" />
          </div>

          {/* Per-engagement groups */}
          {groups.map((g) => (
            <section key={g.key} aria-label={g.engagement ? engagementTitle(g.engagement) : 'General account'}>
              <h2 className="text-sm font-sans font-semibold text-green-900 mb-3">
                {g.engagement ? engagementTitle(g.engagement) : 'General account'}
              </h2>
              <div className="flex flex-col gap-2">
                {g.lines.map((l) => (
                  <div key={l.id} className="bg-white border border-green-800/10 p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-sans font-medium text-green-900">
                        {SOURCE_LABEL[l.source_kind] ?? l.source_kind}
                        {Number(l.qty) !== 1 && (
                          <span className="text-muted font-normal"> · {Number(l.qty)} × <Money amount={Number(l.unit_amount)} /></span>
                        )}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Open charge · {new Date(l.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Money amount={Number(l.amount)} className="text-sm font-serif text-green-800" />
                  </div>
                ))}
                {g.transactions.map((t) => (
                  <div key={t.id} className="bg-white border border-green-800/10 p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-sans font-medium text-green-900">
                        {TXN_LABEL[t.txn_type] ?? t.txn_type}{t.display_code ? ` · ${t.display_code}` : ''}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={t.status} />
                      <Money amount={t.amount === null ? null : Number(t.amount)} className="text-sm font-serif text-green-800" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Recurring billing (Zelle) — the member's schedules + reminder toggle. */}
          {schedules.length > 0 && (
            <section aria-label="Recurring billing">
              <h2 className="text-sm font-sans font-semibold text-green-900 mb-3">Recurring billing</h2>
              <div className="flex flex-col gap-2">
                {schedules.map((s) => (
                  <div key={s.id} className="bg-white border border-green-800/10 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-sans font-medium text-green-900">
                        <Money amount={Number(s.amount)} /> {s.cadence}
                        {s.two_months_upfront ? ' · 2 months upfront' : ''}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {s.mode === 'request' ? "We'll send a Zelle request each period" : 'You pay by Zelle each period'}
                        {' · next '}{nextDue(s.start_date, s.cadence).toLocaleDateString()}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleReminders(s)}
                      className={`text-xs font-sans px-3 py-1.5 rounded-full whitespace-nowrap ${
                        s.reminders_on ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800'
                      }`}>
                      {s.reminders_on ? 'Reminders on' : 'Reminders off'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Payments history */}
          <section aria-label="Payment history">
            <h2 className="text-sm font-sans font-semibold text-green-900 mb-3">Payment history</h2>
            {payments.length === 0 ? (
              <p className="body-text text-muted text-sm">No payments yet.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {payments.map((p) => (
                  <div key={p.id} className="bg-white border border-green-800/10 p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-sans font-medium text-green-900">
                        {METHOD_LABEL[p.method] ?? p.method}
                        {p.reference_code ? ` · ${p.reference_code}` : ''}
                      </p>
                      <p className="text-xs text-muted mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={p.status} />
                      <Money amount={Number(p.amount)} className="text-sm font-serif text-green-800" />
                      <Link to={`/order/${p.order_id}`} className="link-underline whitespace-nowrap">View order</Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
