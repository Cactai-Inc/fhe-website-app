import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Gift as GiftIcon, ArrowRight } from 'lucide-react';
import { requestGift } from '../lib/gifts';
import Seo from '../components/Seo';

const GIFT_ITEMS: { value: string; label: string }[] = [
  { value: 'lessons', label: 'Riding lessons' },
  { value: 'membership', label: 'Rider community membership' },
  { value: 'horse', label: 'Horse care' },
  { value: 'acquisition', label: 'Acquisition support' },
];

export default function Gift() {
  const [params] = useSearchParams();
  const preset = params.get('item') || 'lessons';

  const [itemType, setItemType] = useState(GIFT_ITEMS.some((i) => i.value === preset) ? preset : 'lessons');
  const [f, setF] = useState({ buyerName: '', buyerEmail: '', recipientName: '', recipientEmail: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const upd = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.buyerName.trim() || !f.buyerEmail.trim() || !f.recipientName.trim()) return;
    setSending(true);
    try {
      await requestGift({
        itemType,
        itemLabel: GIFT_ITEMS.find((i) => i.value === itemType)?.label ?? itemType,
        buyerName: f.buyerName.trim(),
        buyerEmail: f.buyerEmail.trim(),
        recipientName: f.recipientName.trim(),
        recipientEmail: f.recipientEmail.trim() || undefined,
        message: f.message.trim() || undefined,
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Seo title="Give the Gift of Riding | French Heritage Equestrian" description="Gift riding lessons, a membership, or any of our services. A beautiful digital gift the recipient opens, then redeems to book." path="/gift" noindex />
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="container-site max-w-xl">
          <div className="text-center mb-10">
            <GiftIcon size={28} className="text-gold-ink mx-auto mb-4" aria-hidden="true" />
            <p className="eyebrow mb-2">A gift they'll remember</p>
            <h1 className="heading-section text-green-800">Give the gift of riding.</h1>
          </div>

          {sent ? (
            <div className="bg-green-50 border border-green-200 p-8 text-center">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-2">Wonderful — we're on it.</h2>
              <p className="body-text text-sm mb-4">
                We'll confirm the details with you and prepare a beautiful digital gift your
                recipient gets to open. You'll have everything you need to give it in time.
              </p>
              <Link to="/" className="link-underline">Back home <ArrowRight size={12} aria-hidden="true" /></Link>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white border border-green-800/10 p-8">
              <div className="mb-5">
                <label className="form-label" htmlFor="g-item">What would you like to gift?</label>
                <select id="g-item" className="form-input" value={itemType} onChange={(e) => setItemType(e.target.value)}>
                  {GIFT_ITEMS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>

              <p className="eyebrow mb-3 mt-8">From you</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="form-label" htmlFor="g-bname">Your name *</label>
                  <input id="g-bname" className="form-input" required value={f.buyerName} onChange={(e) => upd('buyerName', e.target.value)} autoComplete="name" />
                </div>
                <div>
                  <label className="form-label" htmlFor="g-bemail">Your email *</label>
                  <input id="g-bemail" type="email" className="form-input" required value={f.buyerEmail} onChange={(e) => upd('buyerEmail', e.target.value)} autoComplete="email" />
                </div>
              </div>

              <p className="eyebrow mb-3 mt-8">For them</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="form-label" htmlFor="g-rname">Recipient's name *</label>
                  <input id="g-rname" className="form-input" required value={f.recipientName} onChange={(e) => upd('recipientName', e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="g-remail">Recipient's email</label>
                  <input id="g-remail" type="email" className="form-input" value={f.recipientEmail} onChange={(e) => upd('recipientEmail', e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label" htmlFor="g-msg">A note to include</label>
                  <textarea id="g-msg" rows={3} className="form-input resize-none" value={f.message} onChange={(e) => upd('message', e.target.value)} placeholder="Make it personal…" />
                </div>
              </div>

              <button type="submit" disabled={sending || !f.buyerName.trim() || !f.buyerEmail.trim() || !f.recipientName.trim()} className="btn-primary mt-7 w-full justify-center">
                {sending ? 'Sending…' : 'Send my gift request'}
                {!sending && <ArrowRight size={16} />}
              </button>
              <p className="form-hint mt-3 text-center">
                We'll confirm the details and payment with you, then prepare the gift to give.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
