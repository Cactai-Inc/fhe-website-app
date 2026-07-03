import { useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { submitBooking } from '../lib/supabase';
import type { ContactMethod } from '../lib/supabase';
import { submitRequest, createDraftOrder } from '../lib/api';
import { formatPrice } from '../lib/services';
import {
  DAY_SHORT,
  EXPERIENCE_OPTIONS,
  availabilityEntries,
  availabilityText,
  weekOptions,
  type AvailabilitySelection,
  type ExperienceValue,
  type TimePreferences,
  type WeekOption,
} from '../lib/availability';
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
  horse: 'Horse Services',
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

/** Weeks shown per page of the availability picker (compact enough for phones). */
const WEEKS_PER_PAGE = 4;

const DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const usd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function Checkout() {
  useDocumentTitle('Submit a Booking Request');
  const { state, removeItem, subtotal, toSelectedServices, clearCart, inquirySummary } = useCart();
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
  // Availability — one global set of prefs + a pageable Sun–Sat week list.
  const [timePrefs, setTimePrefs] = useState<TimePreferences>({
    weekdayAm: false, weekdayPm: false, weekendAm: false, weekendPm: false,
  });
  const [weekPage, setWeekPage] = useState(0);
  const [selectedWeeks, setSelectedWeeks] = useState<Record<string, WeekOption>>({});
  const [anyDay, setAnyDay] = useState(false);
  const [days, setDays] = useState<number[]>([]);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // "Today" is fixed for the visit so the list never shifts mid-fill.
  const today = useMemo(() => new Date(), []);
  const visibleWeeks = useMemo(
    () => weekOptions(today, weekPage, WEEKS_PER_PAGE),
    [today, weekPage],
  );

  function toggleWeek(week: WeekOption) {
    setSelectedWeeks((prev) => {
      const next = { ...prev };
      if (next[week.startISO]) delete next[week.startISO];
      else next[week.startISO] = week;
      return next;
    });
  }

  function toggleDay(day: number) {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function buildAvailability(): AvailabilitySelection {
    return {
      weeks: Object.values(selectedWeeks).sort((a, b) => a.startISO.localeCompare(b.startISO)),
      prefs: timePrefs,
      anyDay,
      days: [...days].sort((a, b) => a - b),
      ridingExperience: experience,
    };
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
          offering_slug: i.serviceId,
          label: `${i.serviceName} — ${i.tierLabel}`,
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
          offering_slug: i.serviceId,
          label: `${i.serviceName} — ${i.tierLabel}`,
        })),
      );

      // Backward-compat: also record in the legacy bookings table (non-blocking).
      submitBooking({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim(),
        funnel_type: state.funnel || 'rider',
        selected_services: toSelectedServices(),
        qualifier_answers: experience
          ? { ...state.qualifierAnswers, riding_experience_years: experience }
          : state.qualifierAnswers,
        subtotal,
        notes: form.notes.trim() || undefined,
        contact_method: contactMethod,
        preferred_times: availabilityBlock ? availabilityBlock.replace(/\n/g, ' | ') : undefined,
      }).catch((e) => console.warn('legacy booking write failed', e));

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
            {user ? 'Review & Continue' : 'Submit a Booking Request'}
          </h1>
          {!user && (
            <p className="body-text text-sm mt-3">
              Send us this form and we will contact you to schedule your request.
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

                {/* Availability — global time prefs, week list, days of week */}
                <fieldset className="mt-8">
                  <legend className="form-label mb-1">When could you come out?</legend>
                  <p className="form-hint mb-4">
                    Check everything that works — we will find the exact time together.
                  </p>

                  {/* Global time-of-day preferences */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <fieldset className="border border-green-800/15 bg-white px-4 pb-3 pt-1">
                      <legend className="text-[10px] font-sans uppercase tracking-wide text-gold-ink px-1">
                        Weekdays
                      </legend>
                      <div className="flex items-center gap-5">
                        <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-green-800 focus-ring"
                            checked={timePrefs.weekdayAm}
                            onChange={() => setTimePrefs((p) => ({ ...p, weekdayAm: !p.weekdayAm }))}
                          />
                          AM
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-green-800 focus-ring"
                            checked={timePrefs.weekdayPm}
                            onChange={() => setTimePrefs((p) => ({ ...p, weekdayPm: !p.weekdayPm }))}
                          />
                          PM
                        </label>
                      </div>
                    </fieldset>
                    <fieldset className="border border-green-800/15 bg-white px-4 pb-3 pt-1">
                      <legend className="text-[10px] font-sans uppercase tracking-wide text-gold-ink px-1">
                        Weekends
                      </legend>
                      <div className="flex items-center gap-5">
                        <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-green-800 focus-ring"
                            checked={timePrefs.weekendAm}
                            onChange={() => setTimePrefs((p) => ({ ...p, weekendAm: !p.weekendAm }))}
                          />
                          AM
                        </label>
                        <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-green-800 focus-ring"
                            checked={timePrefs.weekendPm}
                            onChange={() => setTimePrefs((p) => ({ ...p, weekendPm: !p.weekendPm }))}
                          />
                          PM
                        </label>
                      </div>
                    </fieldset>
                  </div>

                  {/* Week list — Sunday-start weeks, paged forward from this week */}
                  <fieldset className="mb-5">
                    <legend className="form-label mb-0">
                      Which weeks work? <span className="normal-case tracking-normal text-green-800/60">(Sun–Sat)</span>
                    </legend>
                    <div className="flex items-center justify-between mt-2 mb-2">
                      <p className="form-hint">
                        {Object.keys(selectedWeeks).length > 0
                          ? `${Object.keys(selectedWeeks).length} week${Object.keys(selectedWeeks).length === 1 ? '' : 's'} selected`
                          : 'Check as many as you like.'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
                          disabled={weekPage === 0}
                          aria-label="Earlier weeks"
                          className="p-2 border border-green-800/15 bg-white text-green-800 transition-colors hover:border-green-800/40 disabled:opacity-30 disabled:cursor-not-allowed focus-ring"
                        >
                          <ChevronLeft size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setWeekPage((p) => p + 1)}
                          aria-label="Later weeks"
                          className="p-2 border border-green-800/15 bg-white text-green-800 transition-colors hover:border-green-800/40 focus-ring"
                        >
                          <ChevronRight size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {visibleWeeks.map((week) => {
                        const checked = !!selectedWeeks[week.startISO];
                        return (
                          <label
                            key={week.startISO}
                            className={`flex items-center gap-3 border px-4 py-3 text-sm font-sans cursor-pointer transition-all duration-200 ${
                              checked
                                ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                                : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-green-800 focus-ring"
                              checked={checked}
                              onChange={() => toggleWeek(week)}
                            />
                            {week.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Days of the week — specific days OR open to any */}
                  <fieldset>
                    <legend className="form-label mb-2">Which days of the week?</legend>
                    <label className="inline-flex items-center gap-2 text-sm font-sans text-secondary cursor-pointer mb-3">
                      <input
                        type="checkbox"
                        className="accent-green-800 focus-ring"
                        checked={anyDay}
                        onChange={() => setAnyDay((v) => !v)}
                      />
                      I&rsquo;m open to any day of the week
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {DAY_SHORT.map((label, i) => {
                        const checked = !anyDay && days.includes(i);
                        return (
                          <label
                            key={label}
                            className={`flex items-center justify-center gap-1.5 border py-2.5 px-1 text-xs font-sans uppercase tracking-wide transition-all duration-200 ${
                              anyDay
                                ? 'border-green-800/10 bg-white text-muted opacity-50 cursor-not-allowed'
                                : checked
                                  ? 'border-green-800 bg-green-800/5 text-green-900 font-medium cursor-pointer'
                                  : 'border-green-800/15 bg-white text-secondary hover:border-green-800/40 cursor-pointer'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="accent-green-800 focus-ring"
                              aria-label={DAY_FULL[i]}
                              disabled={anyDay}
                              checked={checked}
                              onChange={() => toggleDay(i)}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </fieldset>

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
                {submitting ? 'Submitting…' : 'Submit Booking Request'}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
            )}
          </div>

          {/* ── Right: Request summary ── */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-green-800/10 p-7 sticky top-28">
              <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your Request</h2>

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
                            key={`${item.serviceId}-${item.tierId}`}
                            className="flex items-start justify-between gap-3 py-2 border-b border-green-800/[0.08] last:border-b-0"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-sans font-medium text-green-900 leading-snug">{item.tierLabel}</p>
                              <p className="text-xs font-sans text-muted mt-0.5 truncate">{item.serviceName}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="text-sm font-serif text-green-800">
                                {formatPrice(item.price, item.unit)}
                              </p>
                              <button
                                type="button"
                                onClick={() => removeItem(item.serviceId, item.tierId)}
                                className="p-2.5 -m-1 text-green-800/40 hover:text-red-600 transition-colors focus-ring"
                                aria-label={`Remove ${item.tierLabel}`}
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
