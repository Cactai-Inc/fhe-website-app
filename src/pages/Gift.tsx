import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Gift as GiftIcon, ArrowRight } from 'lucide-react';
import { requestGift } from '../lib/gifts';
import { BRAND } from '../lib/brand';
import Seo from '../components/Seo';

/* Owner, 2026-08-16: "what is most common is a spouse or parent purchasing a
 * riding 4 or 8 lesson punch card for someone… its not about the money or the
 * exact item, thats why i want to speak with the person because we will help
 * them make the decision."
 *
 * So this list is NOT a product picker — it is a starting point for that
 * conversation. The common case leads, the packs are named because that is what
 * people actually buy, and "help me choose" is a real answer rather than a dead
 * end. 'Rider community membership' is gone: there is no membership product (D4
 * defers it), and it was removed from the Story cards on 2026-08-15 for the same
 * reason — offering it here would promise something that cannot be sold. */
const GIFT_ITEMS: { value: string; label: string }[] = [
  { value: 'lessons', label: 'Riding lessons — a 4 or 8 lesson package' },
  { value: 'lesson_single', label: 'A single riding lesson' },
  { value: 'certificate', label: 'A gift certificate, amount up to you' },
  { value: 'horse', label: 'Horse care services' },
  { value: 'acquisition', label: 'Help finding or buying a horse' },
  { value: 'unsure', label: "Not sure yet — I'd like help choosing" },
];

export default function Gift() {
  const [params] = useSearchParams();
  const preset = params.get('item') || 'lessons';

  const [itemType, setItemType] = useState(GIFT_ITEMS.some((i) => i.value === preset) ? preset : 'lessons');
  const [f, setF] = useState({
    buyerName: '', buyerEmail: '', buyerPhone: '',
    recipientName: '', recipientEmail: '', message: '', occasion: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // TASK-GIFTPATH P3 — the confirmation must reflect what actually happened,
  // not assume it. null = the request row is saved but the staff alert hasn't
  // reported back yet; true/false is the real, provable outcome.
  const [staffAlerted, setStaffAlerted] = useState<boolean | null>(null);
  const upd = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));

  const requiredOk = f.buyerName.trim() && f.buyerEmail.trim() && f.buyerPhone.trim() && f.recipientName.trim();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!requiredOk) return;
    setSending(true);
    setError(null);
    try {
      const { sends } = await requestGift({
        itemType,
        itemLabel: GIFT_ITEMS.find((i) => i.value === itemType)?.label ?? itemType,
        buyerName: f.buyerName.trim(),
        buyerEmail: f.buyerEmail.trim(),
        buyerPhone: f.buyerPhone.trim(),
        recipientName: f.recipientName.trim(),
        recipientEmail: f.recipientEmail.trim() || undefined,
        message: f.message.trim() || undefined,
        occasion: f.occasion.trim() || undefined,
      });
      setSent(true);
      void sends.then((outcome) => setStaffAlerted(outcome.staff));
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : 'Something went wrong sending your gift request. Please try again or call us directly.',
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Seo title="Give the Gift of Riding | French Heritage Equestrian" description="Gift riding lessons, horse care, or any of our services. A beautiful digital gift the recipient opens, then redeems to book." path="/gift" noindex />
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
              {/* P3 — honest, not optimistic. staffAlerted is null until the
                  alert endpoint has actually reported back (it may take a
                  moment), true once it has provably reached the team, and
                  false when it could not be confirmed — in which case we say
                  so and give the visitor a way to make sure it doesn't fall
                  through. */}
              {staffAlerted === false ? (
                <p className="body-text text-sm mb-4">
                  Your request is saved, but we couldn't confirm it reached our team
                  automatically. To be sure it doesn't get missed, please also call us at{' '}
                  <a href={BRAND.phoneHref} className="link-underline">{BRAND.phoneDisplay}</a> or email{' '}
                  <a href={BRAND.emailHref} className="link-underline">{BRAND.email}</a>.
                </p>
              ) : (
                <p className="body-text text-sm mb-4">
                  We'll be in touch to talk through the details, then prepare a beautiful
                  digital gift your recipient gets to open. You'll have everything you need
                  to give it in time.
                </p>
              )}
              <Link to="/" className="link-underline">Back home <ArrowRight size={12} aria-hidden="true" /></Link>
            </div>
          ) : (
            <form onSubmit={submit} className="bg-white border border-green-800/10 p-8">
              <div className="mb-5">
                <label className="form-label" htmlFor="g-item">What do you have in mind?</label>
                <select id="g-item" className="form-input" value={itemType} onChange={(e) => setItemType(e.target.value)}>
                  {GIFT_ITEMS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                </select>
              </div>
              <div className="mb-5">
                <label className="form-label" htmlFor="g-occasion">When is this for? (optional)</label>
                <input id="g-occasion" className="form-input" value={f.occasion} onChange={(e) => upd('occasion', e.target.value)} placeholder="Birthday in two weeks, anytime this month…" />
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
                <div className="sm:col-span-2">
                  {/* Owner, 2026-08-16: "i want the chance to talk to a person
                      buying a gift" — a phone number is what makes that call
                      possible, not optional for a path whose entire point is
                      the conversation. */}
                  <label className="form-label" htmlFor="g-bphone">Your phone *</label>
                  <input id="g-bphone" type="tel" className="form-input" required value={f.buyerPhone} onChange={(e) => upd('buyerPhone', e.target.value)} autoComplete="tel" placeholder="So we can call you" />
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

              <button type="submit" disabled={sending || !requiredOk} className="btn-primary mt-7 w-full justify-center">
                {sending ? 'Sending…' : 'Send my gift request'}
                {!sending && <ArrowRight size={16} />}
              </button>
              {error && <p className="form-error mt-3 text-center" role="alert">{error}</p>}
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
