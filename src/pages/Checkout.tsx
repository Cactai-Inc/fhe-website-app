import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import type { ContactMethod } from '../lib/supabase';
import { submitRequest, createDraftOrder } from '../lib/api';
import { formatPrice } from '../lib/services';
import { inquiryLabel } from '../lib/inquiry';
import {
  EXPERIENCE_OPTIONS,
  availabilityEntries,
  availabilityText,
  type AvailabilitySelection,
  type ExperienceValue,
} from '../lib/availability';
import AvailabilityPicker, { useAvailabilityPicker } from '../components/AvailabilityPicker';
import { useDocumentTitle } from '../lib/hooks';

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
}

const FUNNEL_LABELS: Record<string, string> = {
  rider: 'Rider Services',
  horse: 'Horse Care Services',
  support: 'Rider Support',
};

/** Where "back / add more" points for each funnel (the canonical picker pages). */
const FUNNEL_BACK: Record<string, string> = {
  rider: '/lessons',
  horse: '/horse',
  support: '/acquisition',
};

const CONTACT_OPTIONS: { value: ContactMethod; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
];

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function Checkout() {
  useDocumentTitle('Send an Inquiry');
  const { state, removeItem, subtotal, clearCart, inquirySummary } = useCart();
  // Warm, category-aware label for the submit action + heading, personalized to
  // what the visitor actually chose (never "cart"/"selection"). See lib/inquiry.
  const inquiryCta = inquiryLabel(state.items);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [contactMethod, setContactMethod] = useState<ContactMethod>('text');
  const [experience, setExperience] = useState<ExperienceValue | null>(null);
  // Availability — shared picker state (weeks / days / AM-PM), extracted so
  // the member "book more" page (Flow D) collects the identical structure.
  const picker = useAvailabilityPicker();
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function buildAvailability(): AvailabilitySelection {
    return { ...picker.buildSelection(), ridingExperience: experience };
  }

  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate(): Partial<FormState> {
    const newErrors: Partial<FormState> = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    return newErrors;
  }

  // Authenticated, invited members advance into the purchase flow instead of
  // sending a request: a draft order is created and they go to the order hub
  // (documents → payment → confirmation). This is the single boundary from the spec.
  async function handleStartPurchase() {
    if (state.items.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { orderId } = await createDraftOrder({
        items: state.items.map((i) => ({
          offering_slug: i.offeringId,
          label: i.offeringName,
          price_amount: i.price,
          // 'lesson' is a UI-only unit; the order_items check constraint knows 'session'.
          price_unit: i.unit === 'lesson' ? 'session' : i.unit,
        })),
        qualifiers: state.qualifierAnswers,
        subtotal,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Signed-in member → purchase flow (no request form needed).
    if (user) {
      await handleStartPurchase();
      return;
    }
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      // Move focus to the first errored field so keyboard/SR users are oriented.
      if (newErrors.first_name) firstNameRef.current?.focus();
      else if (newErrors.email) emailRef.current?.focus();
      else if (newErrors.phone) phoneRef.current?.focus();
      return;
    }
    if (state.items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const fullName = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(' ');
      // Structured availability travels twice: as JSON in the proposed_times
      // jsonb column AND as a clean human-readable block appended to the notes.
      const availability = buildAvailability();
      const availabilityBlock = availabilityText(availability);
      const combinedNotes = [
        form.notes.trim(),
        availabilityBlock ? `— Availability & experience —\n${availabilityBlock}` : '',
      ].filter(Boolean).join('\n\n');
      // Primary: write a structured request + selections (architecture-flow-spec).
      await submitRequest(
        {
          contact_name: fullName,
          contact_email: form.email.trim(),
          contact_phone: form.phone.trim(),
          contact_method: contactMethod,
          proposed_times: availabilityEntries(availability),
          notes: combinedNotes || undefined,
        },
        state.items.map((i) => ({
          offering_slug: i.offeringId,
          label: i.offeringName,
        })),
      );

      // Remember the chosen contact method for the confirmation copy.
      try {
        window.sessionStorage.setItem('fhe-contact-method', contactMethod);
      } catch { /* ignore */ }
      clearCart();
      navigate('/confirmation');
    } catch (err) {
      console.error(err);
      setSubmitError('Something went wrong sending your booking request. Please try again or reach us directly.');
      // Announce + focus the banner.
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
          <h2 className="heading-card text-green-800 mb-4">Your request is empty</h2>
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

  const hasErrors = Object.keys(errors).length > 0;

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
            {user ? 'Review & Continue' : 'Send us your inquiry'}
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

          {/* ── Left: member purchase panel OR guest contact form ── */}
          <div className="lg:col-span-3">
            {user ? (
              <div className="bg-white border border-green-800/10 p-8">
                <h2 className="font-serif font-medium text-green-800 text-xl mb-3">You're signed in</h2>
                <p className="body-text text-sm mb-6">
                  We'll use the details on your account. On the next screen you'll review any
                  documents and choose how you'd like to pay. Nothing is charged until you confirm.
                </p>
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
            <form onSubmit={handleSubmit} noValidate>
              <p className="text-xs font-sans text-muted mb-4">Fields marked * are required.</p>
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* First name */}
                  <div>
                    <label className="form-label" htmlFor="first_name">First Name *</label>
                    <input
                      ref={firstNameRef}
                      id="first_name"
                      name="first_name"
                      type="text"
                      required
                      value={form.first_name}
                      onChange={handleChange}
                      aria-invalid={!!errors.first_name}
                      aria-describedby={errors.first_name ? 'first_name-error' : undefined}
                      className={`form-input ${errors.first_name ? 'form-input-error' : ''}`}
                      placeholder="First name"
                      autoComplete="given-name"
                    />
                    {errors.first_name && (
                      <p id="first_name-error" className="form-error">{errors.first_name}</p>
                    )}
                  </div>

                  {/* Last name */}
                  <div>
                    <label className="form-label" htmlFor="last_name">Last Name</label>
                    <input
                      id="last_name"
                      name="last_name"
                      type="text"
                      value={form.last_name}
                      onChange={handleChange}
                      className="form-input"
                      placeholder="Last name"
                      autoComplete="family-name"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="form-label" htmlFor="email">Email Address *</label>
                    <input
                      ref={emailRef}
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      aria-invalid={!!errors.email}
                      aria-describedby={errors.email ? 'email-error' : undefined}
                      className={`form-input ${errors.email ? 'form-input-error' : ''}`}
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                    {errors.email && (
                      <p id="email-error" className="form-error">{errors.email}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="form-label" htmlFor="phone">Phone Number *</label>
                    <input
                      ref={phoneRef}
                      id="phone"
                      name="phone"
                      type="tel"
                      required
                      value={form.phone}
                      onChange={handleChange}
                      aria-invalid={!!errors.phone}
                      aria-describedby={errors.phone ? 'phone-error' : undefined}
                      className={`form-input ${errors.phone ? 'form-input-error' : ''}`}
                      placeholder="858-555-0000"
                      autoComplete="tel"
                    />
                    {errors.phone && (
                      <p id="phone-error" className="form-error">{errors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Preferred contact method */}
                <fieldset className="mt-6">
                  <legend className="form-label mb-2">How should we reach you?</legend>
                  <div role="radiogroup" aria-label="Preferred contact method" className="grid grid-cols-3 gap-3">
                    {CONTACT_OPTIONS.map((opt) => {
                      const selected = contactMethod === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setContactMethod(opt.value)}
                          className={`py-3 px-4 border text-sm font-sans text-center transition-all duration-200 focus-ring ${
                            selected
                              ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                              : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Riding experience — single-select, in years */}
                <fieldset className="mt-6">
                  <legend className="form-label mb-2">Riding experience (years)</legend>
                  <div role="radiogroup" aria-label="Riding experience in years" className="grid grid-cols-5 gap-2 sm:gap-3">
                    {EXPERIENCE_OPTIONS.map((opt) => {
                      const selected = experience === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setExperience(opt.value)}
                          className={`py-3 px-2 border text-sm font-sans text-center transition-all duration-200 focus-ring ${
                            selected
                              ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                              : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* Availability — shared picker (weeks / days / AM-PM) */}
                <AvailabilityPicker picker={picker} />

                {/* Notes */}
                <div className="mt-5">
                  <label className="form-label" htmlFor="notes">
                    Anything you would like us to know?
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    className="form-input resize-none"
                    placeholder="Where you are in your riding, what you are hoping for, any questions at all…"
                  />
                </div>
              </div>

              {/* Validation summary (announced) */}
              <div aria-live="assertive" role={hasErrors ? 'alert' : undefined}>
                {hasErrors && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-5 py-3 mb-6">
                    Please correct the highlighted fields above.
                  </div>
                )}
              </div>

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
                type="submit"
                disabled={submitting || state.items.length === 0}
                className="btn-primary w-full justify-center"
              >
                {submitting ? 'Sending…' : inquiryCta}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
            )}
          </div>

          {/* ── Right: Request summary ── */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-green-800/10 p-7 sticky top-28">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your inquiry</h2>

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
                              <p className="text-sm font-serif text-green-800">
                                {formatPrice(item.price, item.unit)}
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
    </div>
  );
}
