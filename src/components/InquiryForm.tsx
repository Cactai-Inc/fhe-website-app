/**
 * THE ONE SUBMISSION FORM — CAREPATH §C2/§C4, ASKRIGHT §A0.
 *
 * Owner, 2026-08-16: *"the lesson submission form has all the information that
 * the other forms will collect so there is only one form on the final
 * submission page… and its one submission to us for review."*
 *
 * This component was EXTRACTED from `Checkout.tsx`, not written beside it.
 * `/checkout` still renders it (the lessons and acquisition funnels end there);
 * the horse-care funnel now renders the SAME component in-page as its step 3,
 * because §C2 keeps the submission page inside the funnel rather than sending a
 * horse-care visitor to a fourth screen the tracker never admitted to. There is
 * one form component, one submit path, and one `requests` row per submission —
 * a mixed cart included.
 *
 * WHAT VARIES IS CONFIGURATION, NOT A SECOND FORM:
 *   • name / email / phone / preferred contact method / notes — ALWAYS.
 *   • riding experience (years) + the availability RANGES — only when a LESSON
 *     is in the cart. Owner: *"the only flow with a date selection portion is
 *     the lessons page. and that is by design."* A horse-care buyer picks no
 *     date and no range; staff set the schedule on the call (§C7).
 *   • the notes placeholder follows the cart, so a horse owner booking a clip is
 *     not prompted about "where you are in your riding".
 *
 * ⚠️ The riding fields are CONFIGURATION, NOT DELETION — the lesson funnel still
 * needs them, and the lesson task must be able to switch them back on.
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import type { ContactMethod } from '../lib/supabase';
import { submitRequest } from '../lib/api';
import { fetchIntakeRequirements } from '../lib/ops/api-public';
import type { RequestCategory } from '../lib/types';
import { inquiryLabel, hasLessonItem } from '../lib/inquiry';
import { buildSubmission } from '../lib/questionSets';
import { rememberInquiryReceipt } from '../lib/inquiryReceipt';
import {
  EXPERIENCE_OPTIONS,
  availabilityEntries,
  availabilityText,
  type AvailabilitySelection,
  type ExperienceValue,
} from '../lib/availability';
import AvailabilityPicker, { useAvailabilityPicker } from './AvailabilityPicker';

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
}

const CONTACT_OPTIONS: { value: ContactMethod; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
];

/** §C4 — the notes prompt follows the CART, not the page. The riding-shaped
 *  prompt is the lesson buyer's; a horse-care buyer gets one about their horse. */
const NOTES_PLACEHOLDER = {
  lessons: 'Where you are in your riding, what you are hoping for, any questions at all…',
  horse: 'Anything about your horse or your situation that would help us — access, timing, temperament, questions.',
} as const;

/** `requests.notes` carries a 4000-character CHECK constraint server-side, and
 *  the notes hold the visitor's own note, their page-2 answers and (for lessons)
 *  their availability. Capping here turns a would-be RPC exception — raised
 *  after they pressed submit, losing the inquiry — into a slightly shortened
 *  note. The structured copy in `requests.details` is never truncated by this. */
function capNotes(text: string): string {
  const MAX = 3900;
  return text.length <= MAX ? text : `${text.slice(0, MAX)}\n…(truncated)`;
}

export interface InquiryFormProps {
  /** Called once the submission has landed and the receipt has been stashed.
   *  The host navigates — the form never routes itself, so the same component
   *  works in-page (BookHorse step 3) and on its own route (/checkout). */
  onSubmitted: () => void;
  /** Rendered between the fields and the submit button (BookHorse puts nothing
   *  here today; kept so the host owns its own layout rather than this file
   *  growing per-funnel branches). */
  children?: React.ReactNode;
}

export default function InquiryForm({ onSubmitted, children }: InquiryFormProps) {
  const { state, subtotal, clearCart } = useCart();
  const inquiryCta = inquiryLabel(state.items);
  // The ONE condition this form varies on. A mixed cart shows the UNION: a
  // lesson plus horse care gets the availability block, because a lesson is
  // present. It is not either/or.
  const showLessonFields = hasLessonItem(state.items);

  const [form, setForm] = useState<FormState>({
    first_name: '', last_name: '', email: '', phone: '', notes: '',
  });
  const [contactMethod, setContactMethod] = useState<ContactMethod>('text');
  const [experience, setExperience] = useState<ExperienceValue | null>(null);
  const picker = useAvailabilityPicker();
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Which extra fields a booking submission requires is owner-configured
  // (intake_requirements, channel='booking').
  const [bookingReq, setBookingReq] = useState<Record<string, boolean>>({ phone: true });
  useEffect(() => {
    let active = true;
    fetchIntakeRequirements('booking')
      .then((r) => active && setBookingReq(r))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  function buildAvailability(): AvailabilitySelection {
    return { ...picker.buildSelection(), ridingExperience: experience };
  }

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
    if (!form.last_name.trim()) newErrors.last_name = 'Last name is required';
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (bookingReq.phone && !form.phone.trim()) newErrors.phone = 'Phone number is required';
    if (bookingReq.message && !form.notes.trim()) newErrors.notes = 'Please add a note';
    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newErrors = validate();
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      if (newErrors.first_name) firstNameRef.current?.focus();
      else if (newErrors.email) emailRef.current?.focus();
      else if (newErrors.phone) phoneRef.current?.focus();
      return;
    }
    const avail = buildAvailability();
    const hasAvailability =
      avail.weeks.length > 0 || avail.anyDay || avail.days.length > 0 ||
      avail.prefs.weekdayAm || avail.prefs.weekdayPm || avail.prefs.weekendAm || avail.prefs.weekendPm;
    if (showLessonFields && bookingReq.availability && !hasAvailability) {
      setSubmitError('Please share when you’re available.');
      requestAnimationFrame(() => errorBannerRef.current?.focus());
      return;
    }
    if (showLessonFields && bookingReq.experience && !experience) {
      setSubmitError('Please tell us the rider’s experience level.');
      requestAnimationFrame(() => errorBannerRef.current?.focus());
      return;
    }
    if (state.items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const availability = buildAvailability();
      const availabilityBlock = showLessonFields ? availabilityText(availability) : '';
      // ASKRIGHT §A5 — the page-2 answers, for the offerings STILL in the cart.
      // They travel twice: structured into `requests.details`, and as ordered
      // prose in the notes (jsonb does not preserve key order).
      const submission = buildSubmission(state.items, state.qualifierAnswers, state.answerOrigins);
      // LESSONREQUEST §L1 — riding experience becomes STRUCTURED, not only prose.
      // It already travelled inside the notes block, where the only way to read
      // it back was a regex (`LeadWorkDrawer.ridingExperience`), which is not
      // something a server-side requirement check can be built on. It now goes
      // into `requests.details` as well, alongside the page-2 answers — the same
      // deliberate duplication those answers already have, for the same reason
      // (jsonb does not preserve key order, so the notes copy stays the ordered
      // one staff read). Lessons only: the field itself is lesson-gated.
      const experienceText = EXPERIENCE_OPTIONS.find((o) => o.value === experience)?.text;
      if (showLessonFields && experienceText) {
        submission.details['Riding experience (years)'] = experienceText;
      }
      const combinedNotes = capNotes([
        form.notes.trim(),
        submission.notesBlock ? `— Your answers —\n${submission.notesBlock}` : '',
        availabilityBlock ? `— Availability & experience —\n${availabilityBlock}` : '',
      ].filter(Boolean).join('\n\n'));
      // ⚠️ F8 (ASKRIGHT), unchanged and still true: a MIXED cart is filed under
      // the funnel the visitor happens to be standing in, because
      // `requests_category_check` has no `mixed` value and one must win. Staff
      // filters therefore under-count mixed orders. Reported, not silently
      // half-fixed — the combined form is THREEFORMS F1b.
      const funnelCategory: RequestCategory =
        state.funnel === 'horse' ? 'horse_care' : state.funnel === 'support' ? 'acquisition' : 'lessons';
      const { requestId, sends } = await submitRequest(
        {
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          contact_email: form.email.trim(),
          contact_phone: form.phone.trim(),
          contact_method: contactMethod,
          proposed_times: showLessonFields ? availabilityEntries(availability) : [],
          notes: combinedNotes || undefined,
          details: submission.details,
          category: funnelCategory,
          channel: 'booking',
          entry_location: 'checkout',
          intent: 'purchase',
        },
        state.items.map((i) => ({
          // F3 (ASKRIGHT): this used to send the offering UUID in the
          // `offering_slug` key, so the RPC's slug lookup never matched and every
          // production selection carries a NULL offering_id. §C5 needs the real
          // id to open an order, so BOTH are sent and the RPC resolves either.
          offering_id: i.offeringId,
          offering_slug: i.offeringSlug ?? undefined,
          label: i.offeringName,
        })),
      );

      // §C6b — the confirmation screen shows what happened, honestly. The items,
      // every answer given, the chosen contact method, and the REAL send outcome
      // of both emails. Nothing here is optimistic: `sends` resolves to what the
      // two endpoints actually reported, and `null` means "not yet confirmed",
      // which the screen says in those words rather than claiming a delivery.
      rememberInquiryReceipt({
        requestId,
        contactMethod,
        items: state.items.map((i) => ({
          name: i.offeringName,
          price: i.price,
          unit: i.unit,
          priceOnEnquiry: Boolean(i.priceOnEnquiry),
        })),
        answers: submission.details,
        notes: form.notes.trim(),
        availability: availabilityBlock,
        subtotal,
        sends: { staff: null, buyer: null },
      });
      clearCart();
      onSubmitted();
      // Resolves after the confirmation screen has already mounted; it updates
      // the stashed receipt in place and the screen re-reads it.
      void sends.then((outcome) => rememberInquiryReceipt({ sends: outcome }));
    } catch (err) {
      console.error(err);
      setSubmitError('Something went wrong sending your inquiry. Please try again or reach us directly.');
      requestAnimationFrame(() => errorBannerRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="text-xs font-sans text-muted mb-4">Fields marked * are required.</p>
      <div className="bg-white border border-green-800/10 p-8 mb-6">
        <h2 className="font-serif font-medium text-green-800 text-xl mb-6">Your Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="form-label" htmlFor="first_name">First Name *</label>
            <input
              ref={firstNameRef} id="first_name" name="first_name" type="text" required
              value={form.first_name} onChange={handleChange}
              aria-invalid={!!errors.first_name}
              aria-describedby={errors.first_name ? 'first_name-error' : undefined}
              className={`form-input ${errors.first_name ? 'form-input-error' : ''}`}
              placeholder="First name" autoComplete="given-name"
            />
            {errors.first_name && <p id="first_name-error" className="form-error">{errors.first_name}</p>}
          </div>

          <div>
            <label className="form-label" htmlFor="last_name">Last Name *</label>
            <input
              id="last_name" name="last_name" type="text"
              value={form.last_name} onChange={handleChange}
              aria-invalid={!!errors.last_name}
              aria-describedby={errors.last_name ? 'last_name-error' : undefined}
              className={`form-input ${errors.last_name ? 'form-input-error' : ''}`}
              placeholder="Last name" autoComplete="family-name"
            />
            {errors.last_name && <p id="last_name-error" className="form-error">{errors.last_name}</p>}
          </div>

          <div>
            <label className="form-label" htmlFor="email">Email Address *</label>
            <input
              ref={emailRef} id="email" name="email" type="email" required
              value={form.email} onChange={handleChange}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`form-input ${errors.email ? 'form-input-error' : ''}`}
              placeholder="your@email.com" autoComplete="email"
            />
            {errors.email && <p id="email-error" className="form-error">{errors.email}</p>}
          </div>

          <div>
            <label className="form-label" htmlFor="phone">Phone Number *</label>
            <input
              ref={phoneRef} id="phone" name="phone" type="tel" required
              value={form.phone} onChange={handleChange}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              className={`form-input ${errors.phone ? 'form-input-error' : ''}`}
              placeholder="858-555-0000" autoComplete="tel"
            />
            {errors.phone && <p id="phone-error" className="form-error">{errors.phone}</p>}
          </div>
        </div>

        <fieldset className="mt-6">
          <legend className="form-label mb-2">How should we reach you?</legend>
          <div role="radiogroup" aria-label="Preferred contact method" className="grid grid-cols-3 gap-3">
            {CONTACT_OPTIONS.map((opt) => {
              const selected = contactMethod === opt.value;
              return (
                <button
                  key={opt.value} type="button" role="radio" aria-checked={selected}
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

        {/* Riding experience — single-select, in YEARS. A DIFFERENT FACT from
            the acquisition sets' "Which best matches your equestrian
            experience?", which is about owning horses: a lesson-plus-evaluation
            order legitimately answers both, and the two are never merged.
            LESSONS ONLY — a horse-care buyer is never asked how long they have
            been riding (§C4, test 5). */}
        {showLessonFields && (
          <fieldset className="mt-6">
            <legend className="form-label mb-2">Riding experience (years)</legend>
            <div role="radiogroup" aria-label="Riding experience in years" className="grid grid-cols-5 gap-2 sm:gap-3">
              {EXPERIENCE_OPTIONS.map((opt) => {
                const selected = experience === opt.value;
                return (
                  <button
                    key={opt.value} type="button" role="radio" aria-checked={selected}
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
        )}

        {/* Availability — RANGES, never a date picker, and lessons only. */}
        {showLessonFields && <AvailabilityPicker picker={picker} />}

        <div className="mt-5">
          <label className="form-label" htmlFor="notes">Anything you would like us to know?</label>
          <textarea
            id="notes" name="notes" value={form.notes} onChange={handleChange} rows={4}
            className="form-input resize-none"
            placeholder={showLessonFields ? NOTES_PLACEHOLDER.lessons : NOTES_PLACEHOLDER.horse}
          />
        </div>
      </div>

      {children}

      <div aria-live="assertive" role={hasErrors ? 'alert' : undefined}>
        {hasErrors && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-5 py-3 mb-6">
            Please correct the highlighted fields above.
          </div>
        )}
      </div>

      {submitError && (
        <div
          ref={errorBannerRef} tabIndex={-1} role="alert"
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
  );
}
