import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { submitRequest } from '../lib/api';
import { fetchIntakeRequirements } from '../lib/ops/api-public';
import { CATEGORY_FIELDS, PUBLIC_CATEGORY_OPTIONS } from '../lib/intakeCategoryFields';
import { usePropertyTerm } from '../contexts/BrandProvider';
import { toErrorMessage } from '../lib/ops/errors';
import { withArticle, type PropertyTerm } from '../lib/propertyTerm';
import type {
  RequestCategory,
  RequestChannel,
  RequestSelectionInput,
  ContactMethod,
} from '../lib/types';

/**
 * The ONE public intake form. It shape-shifts by the category dropdown and
 * carries the same fields everywhere — contact, inquiry, and cart checkout all
 * write a single `requests` row through submit_public_request. Last name is
 * required on every path (which also unblocks the staff invite, and lands kiosk
 * submitters cleanly in the inbox). Phone + a preferred contact method are
 * additionally required in "cart" mode (a purchase-intent submission).
 *
 * `intent` is a hidden analytics tag; `channel` records which form this is;
 * `entryLocation` carries the "how did you hear" preset. The embedding page sets
 * the sensible defaults (a Lessons page opens this with category='lessons').
 */

// CATEGORISE: the list moved to lib/intakeCategoryFields, which the staff inbox
// reads too, so the public words and the staff filter's words are one map.
const CATEGORIES = PUBLIC_CATEGORY_OPTIONS;

/* ⚠️ THE VISIT FORM ASKS THREE, AND ONLY THREE. Owner, 2026-09-01: *"we just need
   to know what category they go into of the three."* A visitor is here for riding,
   for their horse, or to buy or lease one — "General question", "Media" and
   "Partnership" are not reasons somebody drives out to look around, and offering
   them would put visits in buckets the barn does not prepare for. Derived from the
   one list rather than retyped, so the words stay in step with it. */
const VISIT_CATEGORIES = PUBLIC_CATEGORY_OPTIONS.filter(
  (c) => c.value === 'lessons' || c.value === 'horse_care' || c.value === 'acquisition',
);

function sourcesFor(term: PropertyTerm): { value: string; label: string }[] {
  return [
    { value: '', label: 'How did you hear about us?' },
    { value: 'referral', label: 'A friend or referral' },
    { value: 'google', label: 'Google search' },
    { value: 'social', label: 'Instagram / Facebook' },
    { value: 'event', label: 'An event or show' },
    { value: 'drive_by', label: `Saw ${withArticle(term)} nearby` },
    { value: 'returning', label: "I'm a returning client" },
    { value: 'other', label: 'Other' },
  ];
}

const MESSAGE_MAX = 4000;

/** The message prompt adapts to what they're reaching out about. */
function messagePrompt(category: RequestCategory): string {
  switch (category) {
    case 'lessons':
      return 'Tell us about the rider — age, experience, and what you’re hoping to work on.';
    case 'horse_care':
      return 'Tell us about your horse and the care you’re looking for.';
    case 'acquisition':
      return 'What are you looking to buy or sell? Budget, discipline, timeline?';
    case 'media':
      return 'Tell us about the outlet, the story, and your deadline.';
    case 'partnership':
      return 'Tell us about your brand and what you have in mind.';
    default:
      return 'Anything you’d like us to know?';
  }
}

/** Derive the analytics intent tag from the category + whether it's a cart. */
function intentFor(category: RequestCategory, isCart: boolean): string {
  if (isCart) return 'purchase';
  if (category === 'media') return 'media';
  if (category === 'partnership') return 'partnership';
  return 'inquiry';
}

export interface PublicIntakeFormProps {
  channel: RequestChannel;
  defaultCategory?: RequestCategory;
  /** Lock the category (hide the dropdown) — e.g. a cart is always its funnel. */
  lockCategory?: boolean;
  entryLocation?: string;
  /** Cart selections; when present the form is in "cart" mode (more required). */
  selections?: RequestSelectionInput[];
  /** Extra content rendered above the buttons (e.g. an availability picker). */
  children?: React.ReactNode;
  /** ⚠️ VISIT MODE — owner, 2026-09-01: *"a guest who is filling this out is
   *  planning to visit the ranch and they should be able to request a date and
   *  time for the visit … a simple form submission with a calendar and date picker
   *  with option to select a timeframe from this set of options 9am-noon,
   *  noon-3pm, and 3pm-6pm."*
   *  It REPLACES the general availability block rather than adding a second one:
   *  that block asks "when are you generally free" for a lesson, and a visit is
   *  one date, once. Two pickers on one form is two answers to one question. */
  visit?: boolean;
  /** ⚠️ OFFER IT, rather than being it. Owner, 2026-09-01: the visit request
   *  *"should be an option from the contact page form."* So the contact form
   *  carries a tick-box that turns the date-and-window picker on in place, and
   *  the submission becomes a visit request — the same row, the same
   *  `entry_location`, the same activation email — without a second form or a
   *  second page. A page that IS the visit form passes `visit` instead. */
  offerVisit?: boolean;
  submitLabel?: string;
  onSubmitted?: (requestId: string) => void;
}

export function PublicIntakeForm({
  channel,
  defaultCategory = 'general',
  lockCategory = false,
  entryLocation,
  selections,
  children,
  visit = false,
  offerVisit = false,
  submitLabel = 'Send it our way',
  onSubmitted,
}: PublicIntakeFormProps) {
  const propertyTerm = usePropertyTerm();
  const sources = sourcesFor(propertyTerm);
  const isCart = !!selections && selections.length > 0;
  const [category, setCategory] = useState<RequestCategory>(defaultCategory);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<ContactMethod>('email');
  const [source, setSource] = useState('');
  const [message, setMessage] = useState('');
  // Category-specific answers (C1) — keyed by field key, folded into details.
  const [details, setDetails] = useState<Record<string, string>>({});
  const categoryFields = CATEGORY_FIELDS[category] ?? [];
  // Availability (owner spec): day/time PREFERENCES, and/or SPECIFIC date+times —
  // all optional. Either, both, or neither.
  const [days, setDays] = useState<string[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [specifics, setSpecifics] = useState<{ date: string; time: string }[]>([]);
  /** Visit mode: ONE date and ONE of the three windows the barn actually keeps. */
  const [visitDate, setVisitDate] = useState('');
  const [visitWindow, setVisitWindow] = useState('');
  /** Ticked on the contact form: this submission is a visit request. */
  const [wantsVisit, setWantsVisit] = useState(false);
  /** Visit mode is either what this page IS, or what they just asked for. */
  const asVisit = visit || (offerVisit && wantsVisit);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Age attestation — only for lesson/jumping inquiries. A rider indicates whether
  // they're 18+ or under 18; an under-18 declares their age and their parent/
  // guardian's approval. Mutually exclusive. Folds into details for the inbox.
  const showAgeBlock = category === 'lessons';
  const [ageBracket, setAgeBracket] = useState<'adult' | 'minor' | null>(null);
  const [minorAge, setMinorAge] = useState('');
  const MINOR_ATTESTATION =
    'I am under 18 and my parent or legal guardian has approved of my participation in horseback riding activities and agreed to complete the signup paperwork prior to my first ride.';
  // Reset the age answers whenever we leave the lessons category so a stale
  // selection can't travel with a different inquiry type.
  useEffect(() => {
    if (category !== 'lessons') { setAgeBracket(null); setMinorAge(''); }
  }, [category]);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function buildProposedTimes() {
    const out: { date: string; time: string; days?: string; label?: string }[] = [];
    /* One entry, already in words. `/api/request-received` renders `label` as the
       availability line and the buyer's copy repeats it, so what the barn reads
       and what the visitor was shown are the same string. */
    if (asVisit) {
      if (visitDate) {
        const when = new Date(`${visitDate}T12:00:00`).toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
        });
        out.push({
          date: visitDate,
          time: visitWindow || 'Any time',
          label: `${when}${visitWindow ? `, ${visitWindow}` : ''}`,
        });
      }
      return out;
    }
    if (days.length > 0 || times.length > 0) {
      const label = [days.join(', '), times.join(' / ')].filter(Boolean).join(' — ');
      out.push({ date: '', time: label || 'Flexible', days: days.join(', ') });
    }
    for (const s of specifics) if (s.date) out.push({ date: s.date, time: s.time || 'Any time' });
    return out;
  }

  // Which optional fields THIS channel requires is the owner's call, configured
  // in-app (intake_requirements). Base fields (first/last/email) are always
  // required; the config only ever adds to that (in practice, for 'booking').
  const [req, setReq] = useState<Record<string, boolean>>({});
  useEffect(() => {
    let active = true;
    fetchIntakeRequirements(channel)
      .then((r) => active && setReq(r))
      .catch(() => active && setReq({}));
    return () => {
      active = false;
    };
  }, [channel]);
  const needs = (field: string) => req[field] === true;

  // For lessons/jumping, an age must be indicated; an under-18 must also state
  // their age (which enters them into the guardian-approval attestation).
  const ageReady = !showAgeBlock
    || (ageBracket === 'adult')
    || (ageBracket === 'minor' && minorAge.trim() !== '');

  const ready =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    email.trim() !== '' &&
    (!needs('phone') || phone.trim() !== '') &&
    (!needs('source') || source !== '') &&
    (!needs('message') || message.trim() !== '') &&
    ageReady;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) {
      setError(showAgeBlock && !ageReady
        ? (ageBracket === null
            ? 'Please let us know whether the rider is 18 or older, or under 18.'
            : 'Please enter the rider’s age.')
        : 'Please fill in every required field (marked *).');
      return;
    }
    if (message.length > MESSAGE_MAX) {
      setError(`Your message is too long (max ${MESSAGE_MAX} characters).`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      // only the current category's answered fields travel in details
      const cleanDetails: Record<string, string> = {};
      for (const f of categoryFields) {
        const v = details[f.key]?.trim();
        if (v) cleanDetails[f.key] = v;
      }
      // Age attestation (lessons/jumping): record the bracket, and for a minor the
      // declared age + the guardian-approval acknowledgment they agreed to.
      if (showAgeBlock && ageBracket === 'adult') {
        cleanDetails.age_bracket = '18 or older';
      } else if (showAgeBlock && ageBracket === 'minor') {
        cleanDetails.age_bracket = 'Under 18';
        cleanDetails.rider_declared_age = minorAge.trim();
        cleanDetails.guardian_approval_acknowledged = 'Yes — ' + MINOR_ATTESTATION;
      }
      const { requestId } = await submitRequest(
        {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          contact_email: email.trim(),
          contact_phone: phone.trim() || undefined,
          contact_method: isCart || needs('contact_method') ? method : undefined,
          proposed_times: buildProposedTimes(),
          notes: message.trim() || undefined,
          category,
          channel,
          /* ⚠️ ATTRIBUTION IS NEVER OVERWRITTEN. Owner, 2026-09-01: *"It cannot
             wipe the attribution tagging."* This briefly wrote 'guest_visit' over
             `entry_location` when a visit was asked for, which destroyed how the
             person found us — the one fact that column exists to keep. The visit
             is recorded in `details.visit_requested` instead, which the staff
             alert and the lead card both read, and attribution stands. */
          entry_location: source || entryLocation,
          intent: intentFor(category, isCart),
          details: (() => {
            /* The visit rides in `details`, beside every other category answer,
               so it prints in the staff email (REQ.DETAILS) and on the lead
               without displacing anything. */
            const d = { ...cleanDetails };
            if (asVisit) d.visit_requested = 'Yes — would like to come and visit';
            return Object.keys(d).length ? d : undefined;
          })(),
        },
        selections ?? [],
      );
      // The ops-inbox alert email is NOT fired here any more. INBOUNDALERT moved
      // it into `submitRequest` itself (src/lib/api.ts), because this call site
      // being the only one that had it is precisely why no lead ever produced an
      // alert: every real submission came through Checkout or the kiosk, neither
      // of which called this endpoint. Same dispatch, same best-effort contract,
      // one place — and now the two paths that were missing it get it too.
      onSubmitted?.(requestId);
    } catch (err) {
      setError(toErrorMessage(err, 'Something went wrong. Please email or call us directly.'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-green-800/10 p-8" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {!lockCategory && (
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="pi-category">
              {/* Owner, 2026-09-01: on the visit form the question is what they are
                  INTERESTED IN — they are not asking for help, they are telling us
                  which side of the barn to walk them round. */}
              {asVisit ? 'What are you interested in?' : 'What can we help with?'}
            </label>
            <select
              id="pi-category"
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as RequestCategory)}
            >
              {(visit ? VISIT_CATEGORIES : CATEGORIES).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* C1 — fields distinct to the chosen category */}
        {categoryFields.map((f) => (
          <div key={f.key} className={f.type === 'select' || f.type === 'date' ? '' : 'sm:col-span-1'}>
            <label className="form-label" htmlFor={`pi-${f.key}`}>{f.label}</label>
            {f.type === 'select' ? (
              <select
                id={`pi-${f.key}`}
                className="form-input"
                value={details[f.key] ?? ''}
                onChange={(e) => setDetails((p) => ({ ...p, [f.key]: e.target.value }))}
              >
                <option value="">Select…</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                id={`pi-${f.key}`}
                type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                className="form-input"
                placeholder={f.placeholder}
                value={details[f.key] ?? ''}
                onChange={(e) => setDetails((p) => ({ ...p, [f.key]: e.target.value }))}
              />
            )}
          </div>
        ))}

        {/* Age attestation — lessons/jumping only. 18+ vs under-18 are mutually
            exclusive; under-18 reveals an age field and the guardian-approval note. */}
        {showAgeBlock && (
          <fieldset className="sm:col-span-2 border border-green-800/10 rounded-lg p-4">
            <legend className="form-label px-1">Rider’s age *</legend>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-green-700 w-4 h-4 mt-0.5 shrink-0"
                  checked={ageBracket === 'adult'}
                  onChange={(e) => setAgeBracket(e.target.checked ? 'adult' : null)}
                />
                <span className="text-sm text-green-900">I am 18 or older.</span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-green-700 w-4 h-4 mt-0.5 shrink-0"
                  checked={ageBracket === 'minor'}
                  onChange={(e) => setAgeBracket(e.target.checked ? 'minor' : null)}
                />
                <span className="text-sm text-green-900">I am under 18.</span>
              </label>

              {ageBracket === 'minor' && (
                <div className="ml-6 flex flex-col gap-2.5 border-l-2 border-green-800/10 pl-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-green-900" htmlFor="pi-minor-age">My age:</label>
                    <input
                      id="pi-minor-age"
                      type="number"
                      min={1}
                      max={17}
                      inputMode="numeric"
                      className="form-input w-20"
                      value={minorAge}
                      onChange={(e) => setMinorAge(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted leading-relaxed">{MINOR_ATTESTATION}</p>
                </div>
              )}
            </div>
          </fieldset>
        )}

        <div>
          <label className="form-label" htmlFor="pi-first">
            First name *
          </label>
          <input
            id="pi-first"
            className="form-input"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className="form-label" htmlFor="pi-last">
            Last name *
          </label>
          <input
            id="pi-last"
            className="form-input"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </div>

        <div>
          <label className="form-label" htmlFor="pi-email">
            Email *
          </label>
          <input
            id="pi-email"
            type="email"
            className="form-input"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="form-label" htmlFor="pi-phone">
            Phone {needs('phone') ? '*' : ''}
          </label>
          <input
            id="pi-phone"
            type="tel"
            className="form-input"
            required={needs('phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
          />
        </div>

        {needs('contact_method') && (
          <div className="sm:col-span-2">
            <label className="form-label" htmlFor="pi-method">
              Best way to reach you *
            </label>
            <select
              id="pi-method"
              className="form-input"
              value={method}
              onChange={(e) => setMethod(e.target.value as ContactMethod)}
            >
              <option value="email">Email</option>
              <option value="text">Text</option>
              <option value="call">Call</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="form-label" htmlFor="pi-source">
            How did you hear about us? {needs('source') ? '*' : ''}
          </label>
          <select
            id="pi-source"
            className="form-input"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="form-label" htmlFor="pi-msg">
            {messagePrompt(category)} {needs('message') ? '*' : ''}
          </label>
          <textarea
            id="pi-msg"
            rows={4}
            maxLength={MESSAGE_MAX}
            className="form-input resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="form-hint text-right">
            {message.length}/{MESSAGE_MAX}
          </p>
        </div>

        {/* The offer itself — only on a form that is not already a visit form. */}
        {offerVisit && !visit && (
          <div className="sm:col-span-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={wantsVisit}
                onChange={(e) => setWantsVisit(e.target.checked)}
              />
              <span className="text-sm text-green-900">
                I&apos;d like to come and visit
                <span className="block text-[12.5px] text-muted">
                  Pick a day and a window below and we&apos;ll be in touch to arrange it.
                </span>
              </span>
            </label>
          </div>
        )}

        {/* ── VISIT MODE: one date, one window ─────────────────────────────
            Owner, 2026-09-01. The three windows are the barn's, not a generic
            morning/afternoon/evening — they are the hours somebody can actually
            be shown around. */}
        {asVisit ? (
          <div className="sm:col-span-2">
            <span className="form-label">When would you like to visit?</span>
            <div className="grid gap-3 sm:grid-cols-2 mt-1">
              <input
                type="date"
                className="form-input"
                aria-label="Visit date"
                min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
              <div className="flex flex-wrap gap-1.5 items-center">
                {['9am–noon', 'noon–3pm', '3pm–6pm'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={visitWindow === w}
                    onClick={() => setVisitWindow((prev) => (prev === w ? '' : w))}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      visitWindow === w
                        ? 'bg-green-800 text-white border-green-800'
                        : 'bg-white text-green-800 border-green-800/30'}`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <p className="form-hint mt-2">
              We&apos;ll be in touch to agree the details — nothing is booked yet.
            </p>
          </div>
        ) : (
        /* Availability — preferences and/or specific date+times, all optional */
        <div className="sm:col-span-2">
          <span className="form-label">When works for you? (optional)</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => toggle(days, setDays, d)}
                className={`text-xs px-2 py-1 rounded-full border ${days.includes(d) ? 'bg-green-800 text-white border-green-800' : 'bg-white text-green-800 border-green-800/30'}`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {['Morning', 'Afternoon', 'Evening'].map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={times.includes(t)}
                onClick={() => toggle(times, setTimes, t)}
                className={`text-xs px-2 py-1 rounded-full border ${times.includes(t) ? 'bg-green-800 text-white border-green-800' : 'bg-white text-green-800 border-green-800/30'}`}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="form-hint mt-2">Prefer exact dates? Add them:</p>
          {specifics.map((s, i) => (
            <div key={i} className="flex gap-2 mt-1">
              <input type="date" className="form-input" value={s.date} onChange={(e) => setSpecifics((p) => p.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
              <input type="time" className="form-input" value={s.time} onChange={(e) => setSpecifics((p) => p.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              <button type="button" className="text-muted px-2" onClick={() => setSpecifics((p) => p.filter((_, j) => j !== i))} aria-label="Remove">×</button>
            </div>
          ))}
          {specifics.length < 5 && (
            <button type="button" className="text-xs text-green-800 underline mt-1.5" onClick={() => setSpecifics((p) => [...p, { date: '', time: '' }])}>
              + Add a date &amp; time
            </button>
          )}
        </div>
        )}
      </div>

      {children}

      {error && (
        <p className="form-error mt-4" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={sending || !ready}
        className="btn-primary mt-6 w-full justify-center"
      >
        {sending ? 'Sending…' : submitLabel}
        {!sending && <ArrowRight size={16} />}
      </button>
    </form>
  );
}

export default PublicIntakeForm;
