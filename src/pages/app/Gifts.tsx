import { useEffect, useState } from 'react';
import { Gift as GiftIcon, ChevronRight } from 'lucide-react';
import { listMyGifts, type MyGift } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';

const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';
const STATUS: Record<string, string> = {
  unclaimed: 'Unclaimed', claimed: 'Ready to use', redeemed: 'Used', expired: 'Expired', pending: 'Pending',
};

export default function Gifts() {
  useDocumentTitle('Gifts');
  const [gifts, setGifts] = useState<MyGift[] | null>(null);
  const [selected, setSelected] = useState<MyGift | null>(null);

  useEffect(() => { listMyGifts().then(setGifts).catch(() => setGifts([])); }, []);

  const received = (gifts ?? []).filter((g) => g.direction === 'received');
  const given = (gifts ?? []).filter((g) => g.direction === 'given');

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Gifts</p>
      <h1 className="heading-section text-green-800 mb-8">Gifts you can use.</h1>

      {gifts === null ? (
        <p className="body-text text-muted">Loading…</p>
      ) : gifts.length === 0 ? (
        <div className="bg-white border border-green-800/10 rounded-xl p-8 text-center">
          <p className="body-text text-sm text-muted">You don't have any gifts yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <GiftGroup title="Received" gifts={received} onSelect={setSelected} />
          <GiftGroup title="Given" gifts={given} onSelect={setSelected} />
        </div>
      )}

      {selected && <GiftDetail gift={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function GiftGroup({ title, gifts, onSelect }: { title: string; gifts: MyGift[]; onSelect: (g: MyGift) => void }) {
  if (gifts.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted font-semibold mb-2">{title}</p>
      <div className="flex flex-col gap-2.5">
        {gifts.map((g) => (
          <button key={g.id} type="button" onClick={() => onSelect(g)}
            className="bg-white border border-green-800/10 rounded-xl p-4 flex items-center gap-3 text-left hover:border-green-800/30 focus-ring transition-colors">
            <span className="w-10 h-10 rounded-lg bg-gold-50 text-gold-700 grid place-items-center shrink-0"><GiftIcon size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-green-800 text-[16px] font-semibold leading-tight">
                {g.item_label || (g.amount != null ? `${usd(g.amount)} gift` : 'Gift')}
              </p>
              <p className="text-[12px] text-muted mt-0.5">
                {g.direction === 'received' ? `From ${g.buyer_name || 'someone'}` : `To ${g.recipient_name || 'someone'}`}
                {g.created_at && ` · ${fmtDate(g.created_at)}`}
              </p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-800/10 text-green-800 whitespace-nowrap">{STATUS[g.status ?? ''] ?? g.status}</span>
            <ChevronRight size={16} className="text-green-800/40 shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

function GiftDetail({ gift, onClose }: { gift: MyGift; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-12 h-12 rounded-lg bg-gold-50 text-gold-700 grid place-items-center"><GiftIcon size={22} /></span>
          <div>
            <h2 className="font-serif text-green-900 text-lg">{gift.item_label || 'Gift'}</h2>
            <p className="text-[12px] text-muted">{STATUS[gift.status ?? ''] ?? gift.status}</p>
          </div>
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          {gift.amount != null && <Detail label="Value" value={usd(gift.amount)} />}
          <Detail label={gift.direction === 'received' ? 'From' : 'To'} value={gift.direction === 'received' ? gift.buyer_name : gift.recipient_name} />
          {gift.gift_message && <Detail label="Message" value={gift.gift_message} />}
          {gift.code && gift.direction === 'received' && <Detail label="Code" value={gift.code} />}
          {gift.expires_at && <Detail label="Expires" value={fmtDate(gift.expires_at)} />}
          {gift.redeemed_at && <Detail label="Used" value={fmtDate(gift.redeemed_at)} />}
        </dl>
        {/* Using a gift is a follow-up: the redemption flow comes once confirmed. */}
        {gift.direction === 'received' && gift.status !== 'redeemed' && (
          <button type="button" disabled
            className="w-full mt-5 py-2.5 rounded-lg bg-green-800/40 text-white text-sm font-medium cursor-not-allowed"
            title="Redeeming gifts is coming soon">
            Use this gift (coming soon)
          </button>
        )}
        <button type="button" onClick={onClose} className="w-full mt-2 py-2 text-sm text-muted hover:text-green-800">Close</button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-green-900 text-right">{value}</dd>
    </div>
  );
}
