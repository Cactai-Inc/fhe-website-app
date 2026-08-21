import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { createDraftOrder } from '../lib/api';
import { ensureHorseDocuments } from '../lib/horses';
import { HorseCareSelect } from '../components/app/HorseCareSelect';
import InquiryForm from '../components/InquiryForm';
import ContinueShoppingModal from '../components/ContinueShoppingModal';
import { formatPrice } from '../lib/pricing';
import { useDocumentTitle } from '../lib/hooks';

/**
 * THE SUBMISSION PAGE, AS A ROUTE.
 *
 * CAREPATH §C2 moved the horse-care funnel's submission page IN-PAGE (BookHorse
 * step 3), because sending that visitor to a fourth screen was the confusion the
 * owner named. `/checkout` stays put for the lessons and acquisition funnels,
 * and renders the SAME `InquiryForm` component — it is the ROUTE that differs,
 * never the form. There is one form component and one submit path in the
 * product; see `components/InquiryForm.tsx`.
 *
 * What lives here and NOT in the shared form: the signed-in member's purchase
 * branch (a member does not send an inquiry — they open a draft order and go to
 * the order hub) and the cart summary rail.
 *
 * TASK-GIFTPATH (2026-08-17): there is NO gift toggle or gift line item here,
 * deliberately — do not add one. Owner: "no i want the chance to talk to a
 * person buying a gift." A gift is never self-serve; it is a conversation,
 * captured by `/gift` (`Gift.tsx`) as a `requests` row (category 'gift'), not
 * a purchase. Staff turn a reviewed gift enquiry into a real, priced gift by
 * hand (`GiftCreateForm` → `create_gift`) once they've talked to the buyer.
 */

const FUNNEL_LABELS: Record<string, string> = {
  rider: 'Rider Services',
  horse: 'Horse Care Services',
  support: 'Acquisition Support',
};

/** Where "back / add more" points for each funnel (the canonical picker pages). */
const FUNNEL_BACK: Record<string, string> = {
  rider: '/lessons',
  horse: '/horse',
  support: '/acquisition',
};

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function Checkout() {
  useDocumentTitle('Send an Inquiry');
  const { state, removeItem, clearCart, inquirySummary, setItemConfig } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  // Horse-care purchases require choosing the horse(s) so each has a Care Release.
  const isHorseCare = state.funnel === 'horse';
  const [careHorses, setCareHorses] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  // Authenticated, invited members advance into the purchase flow instead of
  // sending a request: a draft order is created and they go to the order hub
  // (documents → payment → confirmation). This is the single boundary from the spec.
  async function handleStartPurchase() {
    if (state.items.length === 0) return;
    if (isHorseCare && careHorses.length === 0) {
      setSubmitError('Please select the horse(s) this service is for (or add one).');
      requestAnimationFrame(() => errorBannerRef.current?.focus());
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Ensure a Care Release exists (to sign) for each chosen horse before the order.
      if (isHorseCare) {
        for (const horseId of careHorses) {
          await ensureHorseDocuments(horseId, { includeCare: true });
        }
      }
      const { orderId } = await createDraftOrder({
        items: state.items.map((i) => ({
          // cart.offeringId IS the offering UUID (catalog sets it from o.id) — pass
          // it as offering_id so the line links to the real offering (previously it
          // was sent as offering_slug and the slug→id lookup silently dropped it).
          offering_id: i.offeringId,
          // BUYANDBOOK §1 — the label, price and unit are no longer sent. The cart's
          // numbers are what the shopper was SHOWN; the order is priced from the
          // catalog server-side, so the two can never quietly disagree.
          ...(i.config && (i.config.address || i.config.notes) ? { config: i.config } : {}),
        })),
      });
      clearCart();
      navigate(`/order/${orderId}`);
    } catch (err) {
      console.error(err);
      setSubmitError('Something went wrong starting your order. Please try again or reach us directly.');
      requestAnimationFrame(() => errorBannerRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  // If cart is empty and no funnel, redirect
  if (state.items.length === 0 && !state.funnel) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center pt-24 pb-20">
        <div className="text-center max-w-sm">
          <p className="eyebrow mb-4">Nothing selected yet</p>
          <h2 className="heading-card text-green-800 mb-4">Your inquiry is empty</h2>
          <p className="body-text text-sm mb-8">Pick a lesson option to get started.</p>
          <Link to="/lessons" className="btn-primary focus-ring">
            Book a Lesson
            <ArrowRight size={16} />
          </Link>
          <p className="mt-5">
            <Link to="/services" className="link-underline">
              See every way to ride
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pt-24 pb-20">
      <div className="container-site max-w-5xl">

        {/* Header */}
        <div className="mb-10">
          <Link
            to={FUNNEL_BACK[state.funnel || 'rider'] ?? '/lessons'}
            className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors mb-6 focus-ring"
          >
            <ArrowLeft size={16} />
            Back to Selection
          </Link>
          <p className="eyebrow mb-2">{user ? 'Your order' : 'Almost there'}</p>
          <h1 className="heading-section text-green-800">
            {user ? 'Review & Continue' : 'Your Inquiry'}
          </h1>
          {!user && (
            <p className="body-text text-sm mt-3">
              Tell us a little about you and we will call to talk through the right
              fit, then send your approval to book.
            </p>
          )}
          {state.funnel && (
            <p className="body-text text-sm mt-2">
              Path: <span className="font-medium text-green-800">{FUNNEL_LABELS[state.funnel]}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">

          {/* ── Left: member purchase panel OR the one shared inquiry form ── */}
          <div className="lg:col-span-3">
            {user ? (
              <div className="bg-white border border-green-800/10 p-8">
                <h2 className="font-serif font-medium text-green-800 text-xl mb-3">You're signed in</h2>
                <p className="body-text text-sm mb-6">
                  We'll use the details on your account. On the next screen you'll review any
                  documents and choose how you'd like to pay. Nothing is charged until you confirm.
                </p>
                {isHorseCare && <HorseCareSelect selected={careHorses} onChange={setCareHorses} />}
                {submitError && (
                  <div
                    ref={errorBannerRef}
                    tabIndex={-1}
                    role="alert"
                    className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-5 py-4 mb-6 focus:outline-none"
                  >
                    {submitError}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleStartPurchase}
                  disabled={submitting || state.items.length === 0}
                  className="btn-primary w-full justify-center"
                >
                  {submitting ? 'Setting up your order…' : 'Continue to Your Order'}
                  {!submitting && <ArrowRight size={16} />}
                </button>
              </div>
            ) : (
              <>
                {/* §C3 — the same Continue Shopping control the horse-care
                    submission page carries, so a lessons or acquisition visitor
                    can build a mixed cart from here too. Secondary styling: the
                    form's submit is the only primary on this page. */}
                <div className="mb-6">
                  <button type="button" className="btn-outline-gold text-sm" onClick={() => setShopOpen(true)}>
                    Continue Shopping
                  </button>
                </div>
                <InquiryForm onSubmitted={() => navigate('/confirmation')} />
              </>
            )}
          </div>

          {/* ── Right: Request summary ── */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-green-800/10 p-7 sticky top-28">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your Inquiry</h2>

              {state.items.length === 0 ? (
                <p className="text-sm font-sans text-muted italic mb-6">No services selected.</p>
              ) : (
                <div className="flex flex-col gap-5 mb-6">
                  {inquirySummary.map((group) => (
                    <div key={group.unit}>
                      <p className="text-[10px] font-sans uppercase tracking-wide text-gold-ink mb-2">
                        {group.label}
                      </p>
                      <div className="flex flex-col gap-1">
                        {group.items.map((item) => (
                          <div
                            key={item.offeringId}
                            className="flex items-start justify-between gap-3 py-2 border-b border-green-800/[0.08] last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-sans font-medium text-green-900 leading-snug">{item.offeringName}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {/* COUNTFIX 1.5: a quote-priced service carries price 0 as a
                                  placeholder — never render that as "$0". */}
                              <p className={`text-sm font-serif text-green-800${item.priceOnEnquiry ? ' italic' : ''}`}>
                                {item.priceOnEnquiry ? 'Price on inquiry' : formatPrice(item.price, item.unit)}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeItem(item.offeringId)}
                                className="p-2.5 -m-1 text-green-800/40 hover:text-red-600 transition-colors focus-ring"
                                aria-label={`Remove ${item.offeringName}`}
                              >
                                <X size={14} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {/* Per-line config: off-site services (horse training/exercise)
                            can be performed away from Carmel Creek Ranch — capture the
                            address + any notes. Actual session times are booked on the
                            calendar afterward (any days, any distribution). */}
                        {user && isHorseCare && group.items.map((item) => (
                          (item.configKind === 'scheduled' || item.configKind === 'recurring') && (
                            <div key={`${item.offeringId}-cfg`} className="mt-1.5 ml-1 pl-3 border-l-2 border-green-800/10">
                              <label className="block text-[11px] font-sans text-muted mb-1">
                                {item.offeringName} — service address (leave blank if at Carmel Creek Ranch)
                              </label>
                              <input type="text" className="form-input text-sm mb-1.5"
                                placeholder="Barn / property address"
                                value={item.config?.address ?? ''}
                                onChange={(e) => setItemConfig(item.offeringId, { ...item.config, address: e.target.value })} />
                              <input type="text" className="form-input text-sm"
                                placeholder="Notes / horse availability constraints (optional)"
                                value={item.config?.notes ?? ''}
                                onChange={(e) => setItemConfig(item.offeringId, { ...item.config, notes: e.target.value })} />
                            </div>
                          )
                        ))}
                      </div>
                      {/* Per-cadence subtotal (not summed across cadences) */}
                      {!group.isEstimate && group.items.length > 1 && (
                        <div className="flex justify-between mt-1.5 pt-1.5">
                          <span className="text-[11px] font-sans text-muted">{group.label} subtotal</span>
                          <span className="text-sm font-serif text-green-800">{usd(group.total)}</span>
                        </div>
                      )}
                      {group.isEstimate && (
                        <p className="text-[10px] font-sans text-muted mt-1.5 leading-relaxed">
                          Brokering is a percentage of the final purchase price (minimum shown).
                          The figure above is a starting estimate, confirmed after consultation.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add more */}
              <div className="pt-6 border-t border-green-800/[0.08]">
                <Link
                  to={FUNNEL_BACK[state.funnel || 'rider'] ?? '/lessons'}
                  className="text-xs font-sans text-secondary hover:text-green-800 transition-colors flex items-center gap-1 focus-ring"
                >
                  + Add or modify services
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>

      <ContinueShoppingModal open={shopOpen} onClose={() => setShopOpen(false)} />
    </div>
  );
}
