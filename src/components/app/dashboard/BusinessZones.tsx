import { Link } from 'react-router-dom';
import type {
  MoneyHealthRow, MirrorRow, DealRow, HygieneRow, PipelineRow,
} from '../../../lib/ops/api-dashboard';
import { contactHref, documentHref, dealHref } from '../../../lib/dashboard/registry';
import type { DashboardView } from '../../../lib/dashboard/registry';
import { Cards, Card } from './DashboardChrome';
import { usd } from '../../../lib/dashboard/format';

/**
 * CJ'S ZONES — the business desk.
 *
 * Same contract as the trainer zones: the renderer draws what its reader
 * returned and derives nothing. B1's revenue figure is NOT here — it is a KPI,
 * computed by `revenue_summary` and rendered in the ribbon, because a number the
 * calendar also shows must come from one function or the two will drift (D18,
 * and §5's whole reason for existing).
 */

const CAP = 9;

function More({ count, shown, to }: { count: number; shown: number; to: string }) {
  if (count <= shown) return null;
  return (
    <Link to={to} className="dash-card grid place-items-center px-3.5 py-3 text-[0.78rem] font-medium text-green-800/70 focus-ring">
      +{count - shown} more &rarr;
    </Link>
  );
}

/* ── B1 · MONEY THAT HAS NOT LANDED ─────────────────────────────────────── */
const MONEY_TAG: Record<MoneyHealthRow['kind'], { tag: string; tone: 'urgent' | 'today' | 'new' }> = {
  declared: { tag: 'Declared, unconfirmed', tone: 'today' },
  unpaid_aging: { tag: 'Unpaid & ageing', tone: 'urgent' },
  receipt_failed: { tag: 'Receipt failed', tone: 'urgent' },
};

export function MoneyHealthZone({ items }: { items: MoneyHealthRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => {
        const t = MONEY_TAG[r.kind];
        return (
          <Card
            key={`${r.kind}-${r.id}`}
            to="/app/ops/payments/review"
            title={`${r.who ?? 'Someone'}${r.amount ? ` · ${usd(r.amount)}` : ''}`}
            tag={t.tag}
            tagTone={t.tone}
            detail={
              <>
                {r.display_code ?? ''}
                {r.method ? ` · ${r.method}` : ''}
                {r.detail ? ` · ${r.detail}` : ''}
                {` · ${r.age_days} day${r.age_days === 1 ? '' : 's'}`}
              </>
            }
          />
        );
      })}
      <More count={items.length} shown={CAP} to="/app/ops/payments/review" />
    </Cards>
  );
}

/* ── B2 · CLAIRE'S PLATE ────────────────────────────────────────────────── */
/**
 * The mirror. It carries ONE control that is not a link: "Open her view", which
 * flips the toggle rather than navigating — because both views belong to both
 * accounts (§2.1) and the fastest way to see her board is to look at it.
 */
export function MirrorZone({ items, onOpenTrainer }: {
  items: MirrorRow[];
  onOpenTrainer: (v: DashboardView) => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-gold-600/70 bg-gold-50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {items.map((m) => (
          <span key={m.kind} className="text-[0.82rem] text-green-800">
            <strong className={`font-serif text-[1.15rem] ${m.breach ? 'text-red-700' : 'text-green-900'}`}>
              {m.count}
            </strong>{' '}
            {m.label.toLowerCase()}
            {m.amount ? ` (${usd(m.amount)})` : ''}
            {typeof m.oldest_hours === 'number' && m.oldest_hours > 0
              ? ` · oldest ${m.oldest_hours >= 24 ? `${Math.floor(m.oldest_hours / 24)}d` : `${m.oldest_hours}h`}`
              : ''}
            {typeof m.oldest_days === 'number' && m.oldest_days > 0 ? ` · oldest ${m.oldest_days}d` : ''}
          </span>
        ))}
        <button
          type="button"
          onClick={() => onOpenTrainer('trainer')}
          className="ml-auto rounded-lg border border-green-600 px-2.5 py-1 text-[0.72rem] font-semibold text-green-700 focus-ring"
        >
          Open her view
        </button>
      </div>
    </div>
  );
}

/* ── B3 · DEALS & CONTRACTS ─────────────────────────────────────────────── */
/* ⚠️ A `deal_open` ROW IS NOW ALWAYS A THING TO DO (owner, 2026-08-26: "I dont
   need to see the deal unless there is something to do for it that isnt
   involving a signable document"). `dash_deals_contracts` suppresses the deal
   whenever its governing document is already listed here on its own, so the
   envelope and the contract stopped being two cards for one fact. The tag was
   "Deal in motion", which described a state rather than an ask — the row now
   carries its reason in `detail` ("No lessee named", "Not sent for signature
   yet", "Signed by everyone — ready to close"), so the tag names the ask. */
const DEAL_TAG: Record<DealRow['kind'], { tag: string; tone: 'urgent' | 'today' | 'new' | 'neutral' }> = {
  proposal: { tag: 'Needs accept / reject', tone: 'urgent' },
  change_request: { tag: 'Open change', tone: 'today' },
  awaiting_signature: { tag: 'Awaiting signature', tone: 'today' },
  deal_open: { tag: 'Deal needs attention', tone: 'today' },
};

export function DealsZone({ items }: { items: DealRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => {
        const t = DEAL_TAG[r.kind];
        return (
          <Card
            key={`${r.kind}-${r.id}`}
            to={r.kind === 'deal_open' ? dealHref(r.deal_id) : documentHref(r.document_id)}
            title={r.title ?? 'Untitled'}
            tag={r.kind === 'awaiting_signature' && r.mine_to_sign ? 'Yours to sign' : t.tag}
            tagTone={r.kind === 'awaiting_signature' && r.mine_to_sign ? 'urgent' : t.tone}
            detail={
              <>
                {r.display_code ?? ''}
                {r.who ? ` · ${r.who}` : ''}
                {r.detail ? ` · ${r.detail}` : ''}
                {typeof r.age_days === 'number' ? ` · day ${r.age_days + 1}` : ''}
              </>
            }
          />
        );
      })}
      <More count={items.length} shown={CAP} to="/app/records/deals" />
    </Cards>
  );
}

/* ── B9 · ONBOARDING PIPELINE ───────────────────────────────────────────── */
export function PipelineZone({ items }: { items: PipelineRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={contactHref(r.contact_id)}
          title={r.who ?? 'Someone'}
          tag={r.kind === 'invite_failed' ? 'Invite failed'
            : r.kind === 'invite_open' ? 'Invited, not in yet'
            : 'Pending'}
          tagTone={r.kind === 'invite_failed' ? 'urgent' : r.kind === 'invite_open' ? 'today' : 'neutral'}
          detail={r.kind === 'account_pending'
            ? `${r.unsigned ?? 0} document${(r.unsigned ?? 0) === 1 ? '' : 's'} unsigned · service features stay locked until they are`
            : (
              <>
                {r.detail ?? ''}
                {r.expires_at ? ` · expires ${new Date(r.expires_at).toLocaleDateString()}` : ''}
                {typeof r.age_days === 'number' ? ` · ${r.age_days} day${r.age_days === 1 ? '' : 's'}` : ''}
              </>
            )}
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/records/clients" />
    </Cards>
  );
}

/* ── B8 · CATALOG & TENANT SETUP ────────────────────────────────────────── */
/** Each gap names the settings page that closes it — a hygiene list you cannot
 *  act on from is a complaint, not a dashboard zone. */
const HYGIENE_TO: Record<HygieneRow['kind'], string> = {
  tile_no_skus: '/app/ops/admin/products',
  tile_no_image: '/app/ops/admin/products',
  offering_no_config: '/app/ops/admin/products',
  offering_no_price: '/app/ops/admin/products',
  staff_no_title: '/app/ops/team',
};

export function HygieneZone({ items }: { items: HygieneRow[] }) {
  return (
    <Cards>
      {items.slice(0, CAP).map((r) => (
        <Card
          key={`${r.kind}-${r.id}`}
          to={HYGIENE_TO[r.kind]}
          title={r.label ?? r.id}
          tag={r.rank === 1 ? 'Blocks selling' : r.rank === 2 ? 'Looks unfinished' : 'Tidy-up'}
          tagTone={r.rank === 1 ? 'urgent' : 'neutral'}
          detail={r.detail}
        />
      ))}
      <More count={items.length} shown={CAP} to="/app/ops/admin/products" />
    </Cards>
  );
}

/* ── B6 · WHAT THE APP HAS BEEN DOING — REMOVED 2026-08-31 (owner, TASK-FIX3)
 *
 * `ActivityZone` and its `LEDGER_LABEL` map rendered `dash_activity_readback()`
 * as a collapsed 12-row summary, with a footer link reading "Open the full
 * activity log →" that pointed at /app/ops/activity — a page showing ONE of the
 * five ledgers this zone showed, i.e. strictly less than the summary that linked
 * to it. The owner removed the activity surfaces entirely: *"they show massive
 * repeating entries with the same thing all of which doesnt actually tell me
 * anything… remove this from all surfaces… less clutter in the menus and on the
 * dashboard."*
 *
 * ⚠️ The DATABASE function `dash_activity_readback()` is retained — see
 * src/lib/ops/api-dashboard.ts and
 * docs/reference/ACTIVITY-LOG-why-it-has-no-surface.md.
 */

