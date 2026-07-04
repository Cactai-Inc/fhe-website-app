import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Circle, FileText } from 'lucide-react';
import {
  getMyProfile,
  getDocument,
  myOnboardingState,
  updateMyOnboardingProfile,
  generateMyOnboardingDocuments,
  type OnboardingProfileInput,
  type OnboardingPurchase,
  type OnboardingState,
} from '../../lib/api';
import { signMyDocument } from '../../lib/ops/api-client';
import { BodyWithSignatures } from '../../components/ops/documents/MergedBodyView';
import { toErrorMessage } from '../../lib/ops/errors';
import { useDocumentTitle } from '../../lib/hooks';
import type { Profile } from '../../lib/types';

/**
 * RIDER ONBOARDING — /app/onboarding. A client who already paid offline lands
 * here after registering via their provisioned invite. Three steps, driven by
 * my_onboarding_state():
 *   1. "Your details"  — update_my_onboarding_profile, then regenerate the
 *      unsigned docs with the fresh profile data (names/addresses merge in).
 *      Minor riders join HERE (owner directive 2026-07-03): the parent/legal
 *      guardian toggles "This is for a minor rider" and enters the minor's
 *      name + DOB; the RPC attaches the minor as the engagement's non-signing
 *      PARTICIPANT party, so the regenerated documents keep the MINOR_*
 *      sections with the minor's identity merged in. Toggling OFF (after it
 *      was on) sends has_minor:false, which detaches the minor from unsigned
 *      engagements; leaving it untouched sends no minor keys at all.
 *   2. "Review & sign" — each non-EXECUTED doc in signing order: full merged
 *      body, then type-to-sign. record_signature enforces the typed name
 *      EXACTLY matches the printed name, so the sign button stays disabled
 *      until the typed name matches. The GUARDIAN is the CLIENT signer either
 *      way — a minor never signs. Each successful sign fires the best-effort
 *      /api/deliver-document email (Release.tsx pattern).
 *   3. "You're all set" — purchase summary (+ the minor rider's name when one
 *      is attached) + where the signed copies live.
 */

type Step = 'details' | 'sign' | 'done';

/** The plain profile fields (the minor toggle + fields are tracked apart). */
type ProfileFormFields = Omit<
  OnboardingProfileInput,
  'has_minor' | 'minor_first_name' | 'minor_last_name' | 'minor_dob'
>;

const EMPTY_FORM: Required<ProfileFormFields> = {
  phone: '',
  date_of_birth: '',
  address_street: '',
  address_city: '',
  address_state: '',
  address_zip: '',
  emergency_contact_1_name: '',
  emergency_contact_1_relationship: '',
  emergency_contact_1_phone: '',
  emergency_contact_2_name: '',
  emergency_contact_2_relationship: '',
  emergency_contact_2_phone: '',
  riding_experience_years: '',
  jump_experience: '',
  riding_background: '',
};

/** "$500" / "$587.50" — the purchase card money format. */
function formatAmount(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount);
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "4 lessons" (punch cards) or the cadence line (subscriptions). */
function planQuantity(p: OnboardingPurchase): string | null {
  if (p.lessons_included) return `${p.lessons_included} lessons`;
  if (p.cadence) return /^\d+$/.test(String(p.cadence).trim()) ? `${p.cadence} lessons/week` : String(p.cadence);
  return null;
}

/** Purchase summary card (step 3 + revisits after completion). Shows the
 *  minor rider's name when the plan is for a minor (the guardian signed). */
function PurchaseCard({ purchase, riderName }: { purchase: OnboardingPurchase; riderName?: string | null }) {
  const quantity = planQuantity(purchase);
  return (
    <div className="bg-white border border-green-800/10 p-6 mb-6" data-testid="purchase-card">
      <p className="eyebrow mb-2">Your plan</p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-xl text-green-800">{purchase.tier_label}</p>
          {quantity && <p className="text-sm text-secondary mt-1">{quantity}</p>}
          {riderName && <p className="text-sm text-secondary mt-1">Rider: {riderName}</p>}
        </div>
        <p className="font-serif text-2xl text-green-800 whitespace-nowrap">{formatAmount(purchase.amount)}</p>
      </div>
      {purchase.paid && (
        <p className="mt-3 text-xs font-sans">
          <span className="inline-block bg-green-800 text-white px-2 py-0.5 tracking-wide">PAID</span>
          {purchase.payment_method && <span className="text-muted ml-2">via {purchase.payment_method}</span>}
        </p>
      )}
    </div>
  );
}

/** Step header: which of the three steps we're on. */
function Steps({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: 'Your details' },
    { id: 'sign', label: 'Review & sign' },
    { id: 'done', label: "You're all set" },
  ];
  const idx = steps.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap gap-x-6 gap-y-1 mb-8 text-xs font-sans" aria-label="Onboarding steps">
      {steps.map((s, i) => (
        <li
          key={s.id}
          aria-current={s.id === current ? 'step' : undefined}
          className={i <= idx ? 'text-green-800 font-medium' : 'text-muted'}
        >
          {i + 1}. {s.label}
        </li>
      ))}
    </ol>
  );
}

export default function Onboarding() {
  useDocumentTitle('Welcome Aboard');
  const [state, setState] = useState<OnboardingState | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [step, setStep] = useState<Step>('details');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1 — details form
  const [form, setForm] = useState<Required<ProfileFormFields>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 1 — minor rider toggle. `hadMinor` tracks the SERVER's state (from
  // my_onboarding_state().minor) so an explicit toggle-off sends
  // has_minor:false, while never-touched sends no minor keys at all.
  const [hasMinor, setHasMinor] = useState(false);
  const [hadMinor, setHadMinor] = useState(false);
  const [minorFirst, setMinorFirst] = useState('');
  const [minorLast, setMinorLast] = useState('');
  const [minorDob, setMinorDob] = useState('');

  // Step 2 — review & sign
  const [body, setBody] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [typedName, setTypedName] = useState('');
  // E-sign consent (release-signing audit): a REQUIRED checkbox above the
  // sign button; the flag rides to record_signature, which logs a separate
  // esign_consents row. Checked once, it covers the whole signing session.
  const [esignConsent, setEsignConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([myOnboardingState(), getMyProfile().catch(() => null)])
      .then(([s, p]) => {
        if (!active) return;
        setState(s);
        setProfile(p);
        // Prefill the minor toggle from the attached PARTICIPANT (if any).
        if (s.minor) {
          setHasMinor(true);
          setHadMinor(true);
          setMinorFirst(s.minor.first_name ?? '');
          setMinorLast(s.minor.last_name ?? '');
          setMinorDob(s.minor.dob ?? '');
        }
        // Prefill the details form from what we already know about them.
        if (p) {
          setForm((prev) => ({
            ...prev,
            phone: p.phone ?? '',
            address_street: p.address_line1 ?? '',
            address_city: p.city ?? '',
            address_state: p.state ?? '',
            address_zip: p.postal_code ?? '',
          }));
        }
        if (!s.needed) setStep('done');
        else if (!s.profile_complete) setStep('details');
        else setStep('sign');
      })
      .catch((err) => active && setLoadError(toErrorMessage(err, 'Could not load your onboarding.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const documents = state?.documents ?? [];
  const currentDoc = documents.find((d) => d.status !== 'EXECUTED') ?? null;
  const currentIndex = currentDoc ? documents.indexOf(currentDoc) : -1;

  // Load the merged body of the document currently up for signature.
  useEffect(() => {
    if (step !== 'sign' || !currentDoc) return;
    let active = true;
    setBodyLoading(true);
    setBody(null);
    getDocument(currentDoc.document_id)
      .then((d) => active && setBody(d?.merged_body ?? null))
      .catch(() => active && setBody(null))
      .finally(() => active && setBodyLoading(false));
    return () => { active = false; };
  }, [step, currentDoc?.document_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const upd = (key: keyof ProfileFormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      // Minor keys ride along ONLY when the toggle is on (attach/update) or
      // was explicitly turned off after having been on (has_minor:false →
      // detach). Untouched, no minor key is sent and the server leaves the
      // minor state alone.
      const payload: OnboardingProfileInput = { ...form };
      if (hasMinor) {
        payload.has_minor = true;
        payload.minor_first_name = minorFirst;
        payload.minor_last_name = minorLast;
        payload.minor_dob = minorDob;
      } else if (hadMinor) {
        payload.has_minor = false;
      }
      await updateMyOnboardingProfile(payload);
      // Regenerate the unsigned docs so the fresh details merge into the text.
      await generateMyOnboardingDocuments();
      const next = await myOnboardingState();
      setState(next);
      setHadMinor(Boolean(next.minor));
      setStep('sign');
    } catch (err) {
      setSaveError(toErrorMessage(err, 'Could not save your details.'));
    } finally {
      setSaving(false);
    }
  }

  // The printed name on the contracts — the typed signature must match EXACTLY
  // (record_signature enforces it server-side; we gate the button the same way).
  const expectedName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const nameMatches = expectedName !== '' && typedName.trim() === expectedName;

  async function signCurrent(e: React.FormEvent) {
    e.preventDefault();
    if (!currentDoc || !nameMatches || !esignConsent || signing) return;
    setSigning(true);
    setSignError(null);
    try {
      await signMyDocument(currentDoc.document_id, 'CLIENT', typedName.trim(), true);
      // Best-effort delivery: email the executed copy. Never blocks the flow —
      // the document is safely stored either way (Release.tsx pattern).
      fetch('/api/deliver-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: currentDoc.document_id }),
      }).catch(() => { /* the document is safely stored either way */ });

      const next = await myOnboardingState();
      setState(next);
      setTypedName('');
      if (!next.documents.some((d) => d.status !== 'EXECUTED')) setStep('done');
    } catch (err) {
      setSignError(toErrorMessage(err, 'Could not record your signature.'));
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="body-text text-muted">Loading…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl">
        <p role="alert" className="form-error">{loadError}</p>
      </div>
    );
  }

  // Nothing pending and nothing purchased — a member with no onboarding to do.
  if (state && !state.needed && !state.purchase) {
    return (
      <div className="max-w-3xl">
        <p className="eyebrow mb-2">Onboarding</p>
        <h1 className="heading-section text-green-800 mb-4">Nothing to do here.</h1>
        <p className="body-text text-sm mb-8">
          You're all squared away — there's no onboarding waiting on you.
        </p>
        <Link to="/app" className="btn-primary">
          Back to your dashboard <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Welcome aboard</p>
      <h1 className="heading-section text-green-800 mb-6">Let's get you set up.</h1>
      <Steps current={step} />

      {/* ── Step 1: Your details ─────────────────────────────────────────── */}
      {step === 'details' && (
        <form onSubmit={saveDetails} className="bg-white border border-green-800/10 p-8">
          <h2 className="font-serif text-lg text-green-900 mb-1">Your details</h2>
          <p className="text-sm text-muted mb-6">
            These fill in your lesson paperwork — you'll review and sign it next.
          </p>

          <h3 className="form-label mb-3">Rider</h3>
          <label className="flex items-start gap-3 mb-4 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={hasMinor}
              onChange={(e) => setHasMinor(e.target.checked)}
            />
            <span className="body-text text-sm">
              This is for a minor rider (I am the parent/legal guardian).
            </span>
          </label>
          {hasMinor && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="form-label" htmlFor="ob-minor-first">Minor first name</label>
                <input id="ob-minor-first" required className="form-input" value={minorFirst}
                  onChange={(e) => setMinorFirst(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className="form-label" htmlFor="ob-minor-last">Minor last name</label>
                <input id="ob-minor-last" required className="form-input" value={minorLast}
                  onChange={(e) => setMinorLast(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className="form-label" htmlFor="ob-minor-dob">Minor date of birth</label>
                <input id="ob-minor-dob" type="date" required className="form-input" value={minorDob}
                  onChange={(e) => setMinorDob(e.target.value)} />
              </div>
            </div>
          )}

          <h3 className="form-label mb-3">Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <div className="mb-4">
              <label className="form-label" htmlFor="ob-phone">Phone</label>
              <input id="ob-phone" type="tel" required className="form-input" value={form.phone} onChange={upd('phone')} />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="ob-dob">Date of birth</label>
              <input id="ob-dob" type="date" required className="form-input" value={form.date_of_birth} onChange={upd('date_of_birth')} />
            </div>
          </div>
          <div className="mb-4">
            <label className="form-label" htmlFor="ob-street">Street address</label>
            <input id="ob-street" required className="form-input" value={form.address_street} onChange={upd('address_street')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="form-label" htmlFor="ob-city">City</label>
              <input id="ob-city" required className="form-input" value={form.address_city} onChange={upd('address_city')} />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-state">State</label>
              <input id="ob-state" required className="form-input" value={form.address_state} onChange={upd('address_state')} />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-zip">ZIP</label>
              <input id="ob-zip" required className="form-input" value={form.address_zip} onChange={upd('address_zip')} />
            </div>
          </div>

          <h3 className="form-label mb-3">Emergency contacts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="form-label" htmlFor="ob-ec1-name">Contact 1 name</label>
              <input id="ob-ec1-name" required className="form-input" value={form.emergency_contact_1_name} onChange={upd('emergency_contact_1_name')} />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-ec1-rel">Contact 1 relationship</label>
              <input id="ob-ec1-rel" required className="form-input" value={form.emergency_contact_1_relationship} onChange={upd('emergency_contact_1_relationship')} />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-ec1-phone">Contact 1 phone</label>
              <input id="ob-ec1-phone" type="tel" required className="form-input" value={form.emergency_contact_1_phone} onChange={upd('emergency_contact_1_phone')} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="form-label" htmlFor="ob-ec2-name">Contact 2 name (optional)</label>
              <input id="ob-ec2-name" className="form-input" value={form.emergency_contact_2_name} onChange={upd('emergency_contact_2_name')} />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-ec2-rel">Contact 2 relationship</label>
              <input id="ob-ec2-rel" className="form-input" value={form.emergency_contact_2_relationship} onChange={upd('emergency_contact_2_relationship')} />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-ec2-phone">Contact 2 phone</label>
              <input id="ob-ec2-phone" type="tel" className="form-input" value={form.emergency_contact_2_phone} onChange={upd('emergency_contact_2_phone')} />
            </div>
          </div>

          <h3 className="form-label mb-3">Riding background</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="form-label" htmlFor="ob-years">Years riding</label>
              <input id="ob-years" inputMode="numeric" className="form-input" value={form.riding_experience_years} onChange={upd('riding_experience_years')} placeholder="e.g. 3" />
            </div>
            <div>
              <label className="form-label" htmlFor="ob-jump">Jumping experience</label>
              <input id="ob-jump" className="form-input" value={form.jump_experience} onChange={upd('jump_experience')} placeholder="e.g. cross-rails, 2'6&quot; courses, none" />
            </div>
          </div>
          <div className="mb-6">
            <label className="form-label" htmlFor="ob-background">Prior instruction & show experience</label>
            <textarea id="ob-background" rows={3} className="form-input resize-none" value={form.riding_background} onChange={upd('riding_background')} placeholder="Where you've ridden, disciplines, shows — anything that helps us plan" />
          </div>

          {saveError && <p role="alert" className="form-error mb-4">{saveError}</p>}
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save & continue to documents'}
            {!saving && <ArrowRight size={16} />}
          </button>
        </form>
      )}

      {/* ── Step 2: Review & sign ────────────────────────────────────────── */}
      {step === 'sign' && (
        <section aria-labelledby="ob-sign-heading">
          <h2 id="ob-sign-heading" className="font-serif text-lg text-green-900 mb-3">Review & sign</h2>

          {/* Checklist */}
          <ol className="flex flex-col gap-1.5 mb-6">
            {documents.map((d) => (
              <li key={d.document_id} className="flex items-center gap-2 text-sm font-sans">
                {d.status === 'EXECUTED' ? (
                  <Check size={14} className="text-green-700 flex-shrink-0" aria-hidden="true" />
                ) : (
                  <Circle size={14} className="text-green-800/30 flex-shrink-0" aria-hidden="true" />
                )}
                <span className={d.status === 'EXECUTED' ? 'text-muted line-through' : 'text-green-900'}>
                  {d.title}
                </span>
              </li>
            ))}
          </ol>

          {currentDoc ? (
            <div className="bg-white border border-green-800/10 p-6" data-testid={`onboarding-sign-${currentDoc.document_id}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <FileText size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm font-sans font-medium text-green-900">{currentDoc.title}</p>
                </div>
                <p className="text-xs text-muted whitespace-nowrap">
                  Document {currentIndex + 1} of {documents.length}
                </p>
              </div>

              {/* Full merged body — same renderer as the Documents page. */}
              {bodyLoading ? (
                <p className="body-text text-muted text-sm mb-4">Loading the document…</p>
              ) : (
                <div className="rounded-lg border border-green-800/15 bg-white/60 p-6 max-h-[28rem] overflow-y-auto mb-5" data-testid="onboarding-merged-body">
                  {body ? (
                    <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-green-900">
                      <BodyWithSignatures text={body} />
                    </pre>
                  ) : (
                    <p className="text-sm text-green-800/70">This document is being prepared — try again in a moment.</p>
                  )}
                </div>
              )}

              {/* E-sign consent (release-signing audit): REQUIRED before the
                  sign button enables; the flag is logged server-side. */}
              <label className="flex items-start gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={esignConsent}
                  onChange={(e) => setEsignConsent(e.target.checked)}
                />
                <span className="body-text text-sm">
                  I agree to sign this document electronically and understand
                  my electronic signature is legally binding. *
                </span>
              </label>

              {/* Type-to-sign: must match the printed name EXACTLY (server-enforced). */}
              <form onSubmit={signCurrent} className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="ob-typed-name" className="block text-xs text-muted mb-1">
                    Type your name exactly as printed{expectedName ? <> — <span className="font-medium text-green-900">{expectedName}</span></> : null} — to sign
                  </label>
                  <input
                    id="ob-typed-name"
                    className="border border-green-800/20 px-3 py-2 text-sm w-64 max-w-full focus-ring"
                    value={typedName}
                    autoComplete="off"
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-outline-gold" disabled={!nameMatches || !esignConsent || signing}>
                  {signing ? 'Signing…' : 'Sign'}
                </button>
              </form>
              {signError && (
                <p role="alert" className="text-xs text-red-700 mt-2">Could not sign: {signError}</p>
              )}
            </div>
          ) : (
            <p className="body-text text-muted text-sm">
              Your documents are being prepared. If nothing appears, head back and save your details first.
            </p>
          )}
        </section>
      )}

      {/* ── Step 3: You're all set ───────────────────────────────────────── */}
      {step === 'done' && (
        <section aria-labelledby="ob-done-heading">
          <div className="bg-green-50 border border-green-200 p-6 mb-6">
            <h2 id="ob-done-heading" className="font-serif text-xl text-green-800 mb-1 inline-flex items-center gap-2">
              <Check size={20} aria-hidden="true" /> You're all set.
            </h2>
            <p className="body-text text-sm">
              Copies of everything you signed have been emailed to you, and they're always
              available on your Documents page.
            </p>
          </div>

          {state?.purchase && (
            <PurchaseCard
              purchase={state.purchase}
              riderName={state.minor
                ? [state.minor.first_name, state.minor.last_name].filter(Boolean).join(' ')
                : null}
            />
          )}

          <div className="flex flex-wrap gap-4">
            <Link to="/app" className="btn-primary">
              Go to your dashboard <ArrowRight size={16} />
            </Link>
            <Link to="/app/documents" className="btn-outline-gold">
              See your documents
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
