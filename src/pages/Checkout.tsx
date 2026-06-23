import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, X, ShieldCheck } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { submitBooking } from '../lib/supabase';
import { formatPrice } from '../lib/services';

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
}

const FUNNEL_LABELS: Record<string, string> = {
  rider: 'Rider Services',
  horse: 'Horse Services',
  support: 'Rider Support',
};

export default function Checkout() {
  const { state, removeItem, subtotal, toSelectedServices, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormState]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<FormState> = {};
    if (!form.first_name.trim()) newErrors.first_name = 'First name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    if (state.items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await submitBooking({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        funnel_type: state.funnel || 'rider',
        selected_services: toSelectedServices(),
        qualifier_answers: state.qualifierAnswers,
        subtotal,
        notes: form.notes.trim() || undefined,
      });
      clearCart();
      navigate('/confirmation');
    } catch (err) {
      console.error(err);
      setSubmitError('Something went wrong submitting your request. Please try again or contact us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  // If cart is empty and no funnel, redirect
  if (state.items.length === 0 && !state.funnel) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center pt-24 pb-20">
        <div className="text-center max-w-sm">
          <p className="eyebrow mb-4">Your Cart Is Empty</p>
          <h2 className="heading-card text-green-800 mb-4">Nothing selected yet</h2>
          <p className="body-text text-sm mb-8">Choose a service path to get started.</p>
          <Link to="/services" className="btn-primary">
            View Services
            <ArrowRight size={16} />
          </Link>
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
            to={`/book/${state.funnel || 'rider'}`}
            className="inline-flex items-center gap-2 text-sm font-sans text-green-800/60 hover:text-green-800 transition-colors mb-6"
          >
            <ArrowLeft size={16} />
            Back to Selection
          </Link>
          <p className="eyebrow mb-2">Checkout</p>
          <h1 className="heading-section text-green-800">Complete Your Booking Request</h1>
          {state.funnel && (
            <p className="body-text text-sm mt-2">
              Path: <span className="font-medium text-green-800">{FUNNEL_LABELS[state.funnel]}</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-14">

          {/* ── Left: Contact form ── */}
          <div className="lg:col-span-3">
            <form onSubmit={handleSubmit} noValidate>
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your Information</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* First name */}
                  <div>
                    <label className="form-label" htmlFor="first_name">First Name *</label>
                    <input
                      id="first_name"
                      name="first_name"
                      type="text"
                      value={form.first_name}
                      onChange={handleChange}
                      className={`form-input ${errors.first_name ? 'border-red-400' : ''}`}
                      placeholder="First name"
                      autoComplete="given-name"
                    />
                    {errors.first_name && (
                      <p className="text-xs text-red-500 mt-1">{errors.first_name}</p>
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
                      id="email"
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={handleChange}
                      className={`form-input ${errors.email ? 'border-red-400' : ''}`}
                      placeholder="your@email.com"
                      autoComplete="email"
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="form-label" htmlFor="phone">Phone Number *</label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={handleChange}
                      className={`form-input ${errors.phone ? 'border-red-400' : ''}`}
                      placeholder="(619) 555-0000"
                      autoComplete="tel"
                    />
                    {errors.phone && (
                      <p className="text-xs text-red-500 mt-1">{errors.phone}</p>
                    )}
                  </div>
                </div>

                {/* Notes */}
                <div className="mt-5">
                  <label className="form-label" htmlFor="notes">
                    Anything else you would like us to know?
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={form.notes}
                    onChange={handleChange}
                    rows={4}
                    className="form-input resize-none"
                    placeholder="Your horse's name, experience level, scheduling preferences, questions…"
                  />
                </div>
              </div>

              {/* Trust note */}
              <div className="flex items-start gap-3 mb-6 px-1">
                <ShieldCheck size={18} className="text-gold-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-sans text-green-800/60 leading-relaxed">
                  This is a booking request, not a payment. A member of our team will reach out within one business day to confirm your schedule and discuss next steps. French Heritage Equestrian is a fully licensed and insured equestrian business.
                </p>
              </div>

              {submitError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-5 py-4 mb-6">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || state.items.length === 0}
                className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting…' : 'Submit Booking Request'}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          </div>

          {/* ── Right: Order summary ── */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-green-800/10 p-7 sticky top-28">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your Selection</h2>

              {state.items.length === 0 ? (
                <p className="text-sm font-sans text-green-800/50 italic mb-6">
                  No services selected.
                </p>
              ) : (
                <div className="flex flex-col gap-1 mb-6">
                  {state.items.map((item) => (
                    <div
                      key={`${item.serviceId}-${item.tierId}`}
                      className="flex items-start justify-between gap-3 py-3 border-b border-green-800/8 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-sans font-medium text-green-900 leading-snug">{item.tierLabel}</p>
                        <p className="text-xs font-sans text-green-800/50 mt-0.5 truncate">{item.serviceName}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <p className="text-sm font-serif text-green-800" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                          {formatPrice(item.price, item.unit as any)}
                        </p>
                        <button
                          onClick={() => removeItem(item.serviceId, item.tierId)}
                          className="text-green-800/30 hover:text-red-400 transition-colors"
                          aria-label="Remove item"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtotal */}
              <div className="border-t border-green-800/10 pt-5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-sans text-green-800/60 uppercase tracking-wide">Estimated Total</span>
                  <span
                    className="text-xl font-serif font-medium text-green-800"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(subtotal)}
                  </span>
                </div>
                <p className="text-[10px] font-sans text-green-800/40 leading-relaxed">
                  Prices are estimates. Monthly and pack rates apply as listed. Final pricing confirmed upon booking.
                </p>
              </div>

              {/* Add more */}
              <div className="mt-6 pt-6 border-t border-green-800/8">
                <Link
                  to={`/book/${state.funnel || 'rider'}`}
                  className="text-xs font-sans text-green-800/50 hover:text-green-800 transition-colors flex items-center gap-1"
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
