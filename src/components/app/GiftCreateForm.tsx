import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import { createGift, type CreateGiftResult } from '../../lib/gifts';
import { fetchOfferings } from '../../lib/api';
import type { Offering } from '../../lib/types';

/**
 * CREATE GIFT — the one gift-creation path (D4, owner decision 2026-08-11:
 * staff converts a reviewed inquiry). A gift always carries a real, priced
 * offering — item_type/item_label/amount are captured from it server-side —
 * so redemption can provision a real purchase against exactly what was sold,
 * on the same spine as any other purchase.
 */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><span className="form-label">{label}</span>{children}</div>;
}
function money(n: number): string {
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export interface GiftCreateFormProps {
  requestId?: string;
  buyerName?: string;
  buyerEmail?: string;
  onCreated?: (result: CreateGiftResult) => void;
}

export function GiftCreateForm({ requestId, buyerName, buyerEmail, onCreated }: GiftCreateFormProps) {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringId, setOfferingId] = useState('');
  const [bName, setBName] = useState(buyerName ?? '');
  const [bEmail, setBEmail] = useState(buyerEmail ?? '');
  const [rName, setRName] = useState('');
  const [rEmail, setREmail] = useState('');
  const [message, setMessage] = useState('');
  const [markPaid, setMarkPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<CreateGiftResult | null>(null);

  useEffect(() => {
    fetchOfferings().then(setOfferings).catch(() => setOfferings([]));
  }, []);

  const purchasable = offerings.filter((o) => o.config_kind !== 'inquire' && o.price_amount != null);
  const selected = purchasable.find((o) => o.id === offeringId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null);
    try {
      const r = await createGift({
        offeringId,
        buyerName: bName.trim(),
        buyerEmail: bEmail.trim(),
        recipientName: rName.trim(),
        recipientEmail: rEmail.trim() || undefined,
        giftMessage: message.trim() || undefined,
        markPaid,
        requestId,
      });
      setResult(r);
      onCreated?.(r);
    } catch (err) {
      setError(toErrorMessage(err, 'Could not create the gift.'));
    } finally {
      setWorking(false);
    }
  }

  if (result) {
    const url = `${window.location.origin}${result.claimLink}`;
    return (
      <div className="bg-green-50 border border-green-200 p-5 text-sm rounded-lg">
        <p className="text-green-800 mb-2">
          Gift created — <strong>{selected?.name}</strong> for <strong>{rName}</strong>.
        </p>
        <p className="text-green-900/70 text-xs mb-1">Claim link — share this with the recipient:</p>
        <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2 rounded">
          {url}
        </code>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="mb-6">
        <span className="form-label">What are they gifting</span>
        <p className="text-sm text-muted mb-2.5">A real catalog offering — its price and mechanics become the gift.</p>
        {purchasable.length === 0 ? (
          <p className="text-sm text-muted">Loading offerings…</p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {purchasable.map((o) => (
              <label key={o.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                  offeringId === o.id ? 'border-green-700 bg-green-50 text-green-900'
                    : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                <input type="radio" name="gift-offering" className="accent-green-700 w-[17px] h-[17px]"
                  checked={offeringId === o.id} onChange={() => setOfferingId(o.id)} />
                <span className="min-w-0 flex-1">{o.name}</span>
                <span className="text-green-900 whitespace-nowrap">{money(o.price_amount ?? 0)}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <p className="eyebrow mb-3 mt-6">Buyer</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input required className="form-input" value={bName} onChange={(e) => setBName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" required className="form-input" value={bEmail} onChange={(e) => setBEmail(e.target.value)} />
        </Field>
      </div>

      <p className="eyebrow mb-3 mt-2">Recipient</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name">
          <input required className="form-input" value={rName} onChange={(e) => setRName(e.target.value)} />
        </Field>
        <Field label="Email (optional)">
          <input type="email" className="form-input" value={rEmail} onChange={(e) => setREmail(e.target.value)} />
        </Field>
      </div>
      <Field label="Message (optional)">
        <textarea rows={2} className="form-input resize-none" value={message} onChange={(e) => setMessage(e.target.value)} />
      </Field>

      <label className="flex items-center gap-2.5 text-sm text-secondary mb-5">
        <input type="checkbox" className="accent-green-700 w-[18px] h-[18px]"
          checked={markPaid} onChange={(e) => setMarkPaid(e.target.checked)} />
        Payment already received
      </label>

      <button type="submit" disabled={working || !offeringId || !bName.trim() || !bEmail.trim() || !rName.trim()}
        className="btn-primary">
        {working ? 'Creating…' : 'Create gift'}
      </button>
      {error && <p className="form-error mt-4" role="alert">{error}</p>}
    </form>
  );
}
