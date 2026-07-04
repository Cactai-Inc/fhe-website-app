/**
 * BookMore — Flow D entry (BOOKING_FLOWS_PLAN §2 Flow D): a signed-in member
 * books MORE of what they already ride, with near-zero friction. No contact
 * form (we already know them — profile supplies name/email/phone), just a
 * riding-lesson tier, the shared availability picker, and an optional note.
 *
 * Submit writes the SAME `requests` row the public form writes (structured
 * proposed_times JSON + a request_selections row), so it lands in the staff
 * Request Inbox (/app/ops/intake) alongside Flow A — with the notes prefixed
 * "RETURNING MEMBER — <tier> requested" so staff can approve without a call.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';
import {
  fetchOfferings, myOnboardingState, submitRequest,
  type OnboardingPurchase,
} from '../../lib/api';
import { availabilityEntries, type AvailabilitySelection } from '../../lib/availability';
import AvailabilityPicker, { useAvailabilityPicker } from '../../components/AvailabilityPicker';
import type { ContactMethod, Offering, OfferingTier } from '../../lib/types';

/** The lessons offering the member app books against (seeded catalog slug). */
const LESSON_OFFERING_SLUG = 'riding-lesson';

const CONTACT_OPTIONS: { value: ContactMethod; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
];

/** "4 lessons" (punch cards) or the cadence line — mirrors the dashboard plan card. */
function planQuantity(p: OnboardingPurchase): string | null {
  if (p.lessons_included) return `${p.lessons_included} lessons`;
  if (p.cadence) return /^\d+$/.test(String(p.cadence).trim()) ? `${p.cadence} lessons/week` : String(p.cadence);
  return null;
}

export default function BookMore() {
  useDocumentTitle('Book More');
  const { profile, user } = useAuth();
  const [purchase, setPurchase] = useState<OnboardingPurchase | null>(null);
  const [offering, setOffering] = useState<Offering | null>(null);
  const [tiers, setTiers] = useState<OfferingTier[]>([]);
  const [tierId, setTierId] = useState('');
  // Members are reached by email by default (they're already in the app).
  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const picker = useAvailabilityPicker();

  useEffect(() => {
    let active = true;
    Promise.all([
      // No purchase history is fine — the page still works with generic copy.
      myOnboardingState().catch(() => null),
      fetchOfferings().catch(() => [] as Offering[]),
    ]).then(([state, offerings]) => {
      if (!active) return;
      const p = state?.purchase ?? null;
      setPurchase(p);
      const lessons = offerings.find((o) => o.slug === LESSON_OFFERING_SLUG) ?? null;
      setOffering(lessons);
      const lessonTiers = lessons?.tiers ?? [];
      setTiers(lessonTiers);
      // Default to their current tier when it matches a live riding-lesson tier.
      const current = p ? lessonTiers.find((t) => t.label === p.tier_label) : undefined;
      setTierId((current ?? lessonTiers[0])?.id ?? '');
    });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tier = tiers.find((t) => t.id === tierId);
    if (!tier || !offering) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const contactName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim()
        || profile?.display_name
        || profile?.email
        || user?.email
        || 'Member';
      // Same structured JSON the public Checkout writes to proposed_times.
      const availability: AvailabilitySelection = {
        ...picker.buildSelection(),
        ridingExperience: null, // fit already established — never re-asked (Flow D)
      };
      // trimEnd(): no dangling newline when the member leaves the note empty.
      const notes = `RETURNING MEMBER — ${tier.label} requested\n${note.trim()}`.trimEnd();
      await submitRequest(
        {
          contact_name: contactName,
          contact_email: profile?.email || user?.email || '',
          contact_phone: profile?.phone || undefined,
          contact_method: contactMethod,
          proposed_times: availabilityEntries(availability),
          notes,
        },
        [{
          offering_id: offering.id,
          offering_slug: offering.slug,
          tier_id: tier.id,
          label: `${offering.name} — ${tier.label}`,
        }],
      );
      setSent(true);
    } catch (err) {
      console.error(err);
      setSubmitError('Something went wrong sending your request. Please try again or reach us directly.');
    } finally {
      setSubmitting(false);
    }
  }

  // Confirmation state — the request is in the staff inbox.
  if (sent) {
    return (
      <div className="max-w-2xl">
        <div className="bg-white border border-green-800/10 p-8" data-testid="book-more-confirmation">
          <p className="eyebrow mb-3 inline-flex items-center gap-2">
            <Sparkles size={13} aria-hidden="true" /> On its way
          </p>
          <h1 className="heading-card text-green-800 mb-3">
            Request sent — we&rsquo;ll confirm your times shortly.
          </h1>
          <p className="body-text text-sm mb-8">
            We&rsquo;ll be in touch by {contactMethod === 'email' ? 'email' : contactMethod === 'call' ? 'phone' : 'text'} once
            your booking is on the calendar.
          </p>
          <Link to="/app" className="btn-primary focus-ring">
            Back to your dashboard
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <p className="eyebrow mb-2">Returning rider</p>
      <h1 className="heading-section text-green-800 mb-4">Book more time in the saddle</h1>
      <p className="body-text text-sm mb-8">
        {purchase
          ? 'Pick what you’d like next and when works — we already have your details, so that’s all we need.'
          : 'Pick a lesson option and when works — we already have your details, so that’s all we need.'}
      </p>

      {/* Current plan — what they already ride (hidden when no purchase history). */}
      {purchase && (
        <div
          className="bg-white border border-green-800/10 p-5 mb-8 flex items-center justify-between gap-4"
          data-testid="current-plan-card"
        >
          <div className="flex items-center gap-3">
            <GraduationCap size={20} className="text-gold-ink flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="text-[10px] font-sans uppercase tracking-wide text-gold-ink mb-0.5">Your current plan</p>
              <p className="text-sm font-sans font-medium text-green-900">{purchase.tier_label}</p>
              {planQuantity(purchase) && <p className="text-xs text-muted mt-0.5">{planQuantity(purchase)}</p>}
            </div>
          </div>
          {purchase.paid && (
            <span className="bg-green-800 text-white text-xs font-sans px-2 py-0.5 tracking-wide whitespace-nowrap">PAID</span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="bg-white border border-green-800/10 p-8 mb-6">
          {/* Tier — riding-lesson catalog, defaulted to their current plan */}
          <div>
            <label className="form-label" htmlFor="tier">What would you like to book?</label>
            <select
              id="tier"
              className="form-input"
              value={tierId}
              onChange={(e) => setTierId(e.target.value)}
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Preferred contact method — email preselected for members */}
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

          {/* Availability — the same shared picker the public request uses */}
          <AvailabilityPicker picker={picker} />

          {/* Optional note */}
          <div className="mt-5">
            <label className="form-label" htmlFor="note">
              Anything you would like us to know?
            </label>
            <textarea
              id="note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="form-input resize-none"
              placeholder="Scheduling quirks, goals for the next stretch, anything at all…"
            />
          </div>
        </div>

        {submitError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 text-sm font-sans px-5 py-4 mb-6"
          >
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !tierId}
          className="btn-primary w-full justify-center"
        >
          {submitting ? 'Sending…' : 'Send Booking Request'}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </form>
    </div>
  );
}
