import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Circle, FileText } from 'lucide-react';
import {
  getMyProfile,
  getDocument,
  myOnboardingState,
  updateMyOnboardingProfile,
  generateMyOnboardingDocuments,
  getOrder,
  getOrderPayment,
  attachPurchaseHorse,
  setMyOnboardingHorses,
  fetchMyCategories,
  myUnreadCount,
  myDocuments,
  markTourSeen,
  myNameConfirmationState,
  myNavPresence,
  pollDeliveryConfirmed,
  type OnboardingProfileInput,
  type OnboardingPurchase,
  type OnboardingState,
  type StandingCategory,
  type NavPresence,
} from '../../lib/api';
import OrderPayment from '../../components/order/OrderPayment';
import type { Order, OrderItem, Payment } from '../../lib/types';
import { signMyDocument } from '../../lib/ops/api-client';
import { BodyWithSignatures } from '../../components/ops/documents/MergedBodyView';
import { toErrorMessage } from '../../lib/ops/errors';
import { useDocumentTitle } from '../../lib/hooks';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { HorseIntakeForm } from '../../components/app/HorseIntakeForm';
import { AppOverviewModal } from '../../components/app/AppOverviewModal';
import { useAuth } from '../../contexts/AuthContext';
import { usePropertyTerm } from '../../contexts/BrandProvider';
import { withArticle } from '../../lib/propertyTerm';
import type { Profile } from '../../lib/types';
import { consumeWallReturnDestination } from '../../lib/wallReturn';

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
 *      way — a minor never signs. Once the LAST doc is signed, ONE combined
 *      email delivers every executed doc as a PDF attachment (/api/deliver-documents).
 *   3. "You're all set" — purchase summary (+ the minor rider's name when one
 *      is attached) + where the signed copies live.
 */

type Step = 'details' | 'horse' | 'sign' | 'payment' | 'done';

/** The plain profile fields (the name, minor toggle + fields are tracked apart). */
type ProfileFormFields = Omit<
  OnboardingProfileInput,
  'first_name' | 'last_name' | 'has_minor' | 'minor_first_name' | 'minor_last_name' | 'minor_dob'
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
function Steps({ current, showHorse }: { current: Step; showHorse: boolean }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'details', label: 'Your details' },
    ...(showHorse ? [{ id: 'horse' as Step, label: 'Your horse' }] : []),
    { id: 'sign', label: 'Review & sign' },
    { id: 'payment', label: 'Payment' },
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
  const navigate = useNavigate();
  const { hasModule } = useAuth();
  const propertyTerm = usePropertyTerm();
  // I6 — the app-overview modal's page list now mirrors AppLayout's canonical
  // USER nav order exactly, so this instance (the FIRST tour a member sees)
  // needs the same live presence + module gate as AppLayout threads in.
  const lessonsOn = hasModule('mod.lessons');
  const [presence, setPresence] = useState<NavPresence>({
    orders: false, documents: false, stable: false, posts: false, saved: false,
  });
  const [state, setState] = useState<OnboardingState | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<StandingCategory[]>([]);
  const [step, setStep] = useState<Step>('details');
  // App-overview welcome tour, shown once at the end of onboarding. Closing it
  // lands the member on their home: dashboard when they have notifications, else
  // the community feed (guests always land on the dashboard).
  const [showOverview, setShowOverview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Step 1 — details form
  const [form, setForm] = useState<Required<ProfileFormFields>>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Name: email-only invites arrive nameless — collect it here. Prefilled from
  // the profile when already known (Google/named invites), otherwise required.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Ask for the name when it is missing OR when we hold two conflicting versions
  // and blanked it rather than guess (contacts.name_needs_confirmation, S7).
  // The blank case already covers today's data, but the flag is the explicit
  // signal and survives someone re-entering a value we still cannot trust.
  const [nameUnconfirmed, setNameUnconfirmed] = useState(false);
  useEffect(() => {
    let active = true;
    myNameConfirmationState()
      .then((s) => { if (active) setNameUnconfirmed(s.needs_confirmation); })
      // Fail closed: if we cannot tell, ask. A wrong name on paperwork is the
      // thing this exists to prevent.
      .catch(() => { if (active) setNameUnconfirmed(true); });
    return () => { active = false; };
  }, []);
  const needsName = nameUnconfirmed
    || !((profile?.first_name ?? '').trim() && (profile?.last_name ?? '').trim());

  // Step 1 — minor rider toggle. `hadMinor` tracks the SERVER's state (from
  // my_onboarding_state().minor) so an explicit toggle-off sends
  // has_minor:false, while never-touched sends no minor keys at all.
  const [hasMinor, setHasMinor] = useState(false);
  const [hadMinor, setHadMinor] = useState(false);
  const [minorFirst, setMinorFirst] = useState('');
  const [minorLast, setMinorLast] = useState('');
  const [minorDob, setMinorDob] = useState('');

  // Step "horse" — the member's EXISTING horses (a re-invited owner already has
  // records): offer them for selection instead of forcing re-entry. Selecting
  // one opens the intake form in REVIEW mode (prefilled, autosaving) so they
  // confirm what's on file and complete the doc-required fields before signing.
  const [stableHorses, setStableHorses] = useState<StableHorse[] | null>(null);
  const [attachingHorseId, setAttachingHorseId] = useState<string | null>(null);
  const [reviewHorseId, setReviewHorseId] = useState<string | null>(null);
  const [showNewHorseForm, setShowNewHorseForm] = useState(false);

  // ── MULTI-HORSE (owner-final) ────────────────────────────────────────────
  // A member may own several horses. Rather than a staff-set horse count and N
  // forced forms, THEY drive it: add a horse, then choose "add another" or
  // "done". `chosenHorseIds` is the set they have completed this pass;
  // `deferredHorseIds` are ones they created but set aside. Nothing about the
  // documents is gated on a deferred horse.
  const [chosenHorseIds, setChosenHorseIds] = useState<string[]>([]);
  const [deferredHorseIds, setDeferredHorseIds] = useState<string[]>([]);
  // 'collect' = the add/choose loop; 'decide' = combined-vs-split, only shown
  // once they have more than one horse in hand.
  const [horsePhase, setHorsePhase] = useState<'collect' | 'decide'>('collect');
  const [bindingHorses, setBindingHorses] = useState(false);
  const [horseError, setHorseError] = useState<string | null>(null);
  const horseNameOf = (id: string) =>
    stableHorses?.find((h) => h.id === id)?.name ?? 'this horse';
  useEffect(() => {
    if (step !== 'horse' || stableHorses !== null) return;
    let active = true;
    listStableHorses()
      .then((h) => active && setStableHorses(h))
      .catch(() => active && setStableHorses([]));
    return () => { active = false; };
  }, [step, stableHorses]);

  // Step 2 — review & sign
  const [body, setBody] = useState<string | null>(null);
  const [bodyLoading, setBodyLoading] = useState(false);
  const [typedName, setTypedName] = useState('');
  // E-sign consent (release-signing audit): a REQUIRED checkbox above the
  // sign button; the flag rides to record_signature, which logs a separate
  // esign_consents row. Checked once, it covers the whole signing session.
  const [esignConsent, setEsignConsent] = useState(false);
  // Did the completion email actually go out? null = still sending / unknown,
  // true = delivered, false = failed. The done step reads this so it never
  // claims a delivery that did not happen.
  const [emailed, setEmailed] = useState<boolean | null>(null);
  // 3f re-signer pointer: template_key → the date of the version already on
  // file (executed or superseded), so returning signers see the replace copy.
  const [priorSigned, setPriorSigned] = useState<Record<string, string>>({});
  useEffect(() => {
    if (step !== 'sign') return;
    myDocuments().then((rows) => {
      const m: Record<string, string> = {};
      for (const r of rows) {
        if (r.kind === 'executed' && r.signed_at) m[r.template_key] = r.signed_at;
      }
      setPriorSigned(m);
    }).catch(() => {});
  }, [step]);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Step 3 — payment (sign-before-pay). The client pays their spine purchase
  // (surfaced by my_onboarding_state) directly — no engagement bridge.
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  // Load the purchase for the payment step, then poll for confirmation.
  async function enterPayment() {
    setPayError(null);
    const purchaseId = state?.purchase?.purchase_id ?? null;
    try {
      if (!purchaseId) { setStep('done'); return; }
      const [o, p] = await Promise.all([getOrder(purchaseId), getOrderPayment(purchaseId)]);
      setOrder(o);
      setPayment(p);
      setStep('payment');
    } catch (err) {
      setPayError(toErrorMessage(err, 'Could not start payment. You can pay from your account.'));
      setStep('done'); // never trap the user — they can pay later from Account
    }
  }

  // Re-read the order after a payment action; land on /app once confirmed.
  async function refreshPayment() {
    if (!order) return;
    const [o, p] = await Promise.all([getOrder(order.id), getOrderPayment(order.id)]);
    setOrder(o);
    setPayment(p);
    if (o && o.status === 'paid') setStep('done');
  }

  useEffect(() => {
    let active = true;
    // Presentational only — feeds the app-overview modal variant, gates nothing.
    // Failing to a guest-variant tour is the right degradation.
    fetchMyCategories().then((c) => active && setCategories(c)).catch(() => {});
    // Same quiet-catch fallback as AppLayout's useNavPresence: a failed read
    // just leaves every presence-gated tour line hidden.
    myNavPresence().then((p) => active && setPresence(p)).catch(() => {});
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
        // The CONTACT record (s.prefill) is the person record and wins — a
        // re-invited member arrives with phone/DOB/address/emergency contacts
        // already on file there; the profile fills any remaining gaps.
        const pre = s.prefill;
        if (p || pre) {
          setFirstName(pre?.first_name ?? p?.first_name ?? '');
          setLastName(pre?.last_name ?? p?.last_name ?? '');
          setForm((prev) => ({
            ...prev,
            phone: pre?.phone ?? p?.phone ?? '',
            date_of_birth: pre?.date_of_birth ?? '',
            // Address comes from the CONTACT only. `profiles` carries a
            // look-alike address block that NOTHING writes (0 of 7 rows
            // populated; update_my_onboarding_profile mirrors only the name
            // onto profiles and writes the address to contacts). Falling back
            // to it read as a second source but could only ever yield ''.
            address_street: pre?.address_street ?? '',
            address_city: pre?.address_city ?? '',
            address_state: pre?.address_state ?? '',
            address_zip: pre?.address_zip ?? '',
            emergency_contact_1_name: pre?.emergency_contact_1_name ?? '',
            emergency_contact_1_relationship: pre?.emergency_contact_1_relationship ?? '',
            emergency_contact_1_phone: pre?.emergency_contact_1_phone ?? '',
            emergency_contact_2_name: pre?.emergency_contact_2_name ?? '',
            emergency_contact_2_relationship: pre?.emergency_contact_2_relationship ?? '',
            emergency_contact_2_phone: pre?.emergency_contact_2_phone ?? '',
            riding_experience_years: pre?.riding_experience_years ?? '',
            jump_experience: pre?.jump_experience ?? '',
            riding_background: pre?.riding_background ?? '',
          }));
        }
        if (!s.needed) setStep('done');
        // 3f: the input form ALWAYS renders, prefilled, even when nothing is
        // missing — the person confirms or corrects, then advances.
        // Re-attestation is part of what the new signature means; no skip.
        else setStep('details');
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

  // Close the overview tour and land on the member's home: dashboard when they
  // have notifications, else the community feed (D8: community for every
  // account holder — no guest branch).
  //
  // TASK-WALLRETURN: this is the single exit point every onboarding path
  // (sign-only, horse + payment, "nothing to do") funnels through once the
  // member is done here. AppLayout's wall redirect (AppLayout.tsx:684)
  // captures where a walled member was actually headed before dropping them
  // here — a captured destination wins over the default landing page, and is
  // consumed (cleared) the moment it's used so it can't apply again later.
  async function enterApp() {
    setShowOverview(false);
    // A3: a fresh activation has now seen the tour — stamp it so AppLayout's
    // first-login auto-open does not show it a second time.
    try { await markTourSeen(); } catch { /* presentational marker only */ }
    const wallReturnTo = consumeWallReturnDestination();
    if (wallReturnTo) {
      navigate(wallReturnTo, { replace: true });
      return;
    }
    let unread = 0;
    try { unread = await myUnreadCount(); } catch { /* default to community */ }
    navigate(unread > 0 ? '/app/dashboard' : '/app', { replace: true });
  }

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
      // Name rides along when we collected it (email-only invites); the RPC fills
      // it only when the contact/profile name is currently blank.
      if (firstName.trim()) payload.first_name = firstName.trim();
      if (lastName.trim()) payload.last_name = lastName.trim();
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
      const [next, freshProfile] = await Promise.all([
        myOnboardingState(),
        getMyProfile().catch(() => profile),
      ]);
      setState(next);
      setProfile(freshProfile); // refreshes expectedName so type-to-sign works
      setHadMinor(Boolean(next.minor));
      setStep(next.horse_needed ? 'horse' : 'sign');
    } catch (err) {
      setSaveError(toErrorMessage(err, 'Could not save your details.'));
    } finally {
      setSaving(false);
    }
  }

  // A horse's record is complete (fresh intake or reviewed existing record).
  // It joins the chosen set; the member then decides whether to add another.
  // NOTHING is bound to the documents yet — binding happens once, when they say
  // they are done, so a member who adds two horses signs ONE set of documents.
  async function horseCompleted(horseId: string) {
    setHorseError(null);
    setChosenHorseIds((ids) => (ids.includes(horseId) ? ids : [...ids, horseId]));
    setDeferredHorseIds((ids) => ids.filter((i) => i !== horseId));
    setReviewHorseId(null);
    setShowNewHorseForm(false);
    // refresh the stable so the newly added horse is listed by name
    try { setStableHorses(await listStableHorses()); } catch { /* names only */ }
  }

  /** Existing-horse pick: same pipeline as a fresh intake, with a busy state. */
  async function attachExistingHorse(horseId: string) {
    if (attachingHorseId) return;
    setAttachingHorseId(horseId);
    try {
      await horseCompleted(horseId);
    } finally {
      setAttachingHorseId(null);
    }
  }

  /**
   * Commit the horse choices and move to signing.
   *
   * `combined` true  → every chosen horse goes on the SAME two documents; the
   *                    member signs once and that signature covers them all.
   * `combined` false → SPLIT: the documents are bound to the primary horse for
   *                    this pass and the rest are recorded as deferred, each
   *                    getting its own quick-link action item to come back to.
   * Deferred horses are never bound, so signing is never blocked on them.
   */
  async function commitHorses(combined: boolean) {
    if (bindingHorses) return;
    setBindingHorses(true);
    setHorseError(null);
    try {
      const bind = combined ? chosenHorseIds : chosenHorseIds.slice(0, 1);
      const defer = combined
        ? deferredHorseIds
        : [...chosenHorseIds.slice(1), ...deferredHorseIds];
      if (bind.length > 0) {
        await setMyOnboardingHorses(bind, defer);
        const purchaseId = state?.purchase?.purchase_id;
        if (purchaseId) {
          try { await attachPurchaseHorse(purchaseId, bind[0]); }
          catch { /* the RPC already points the purchase at the primary */ }
        }
      } else if (defer.length > 0) {
        // skipped entirely but horses exist — still raise their reminders
        await setMyOnboardingHorses([], defer);
      }
      const next = await myOnboardingState();
      setState(next);
      setStep('sign');
    } catch (err) {
      setHorseError(toErrorMessage(err, 'Could not attach your horses.'));
    } finally {
      setBindingHorses(false);
    }
  }

  /** Skip the horse step entirely — consequences were spelled out beforehand. */
  async function skipHorses() {
    if (bindingHorses) return;
    if (chosenHorseIds.length === 0 && deferredHorseIds.length === 0) {
      setStep('sign');
      return;
    }
    await commitHorses(false);
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

      const next = await myOnboardingState();
      setState(next);
      setTypedName('');
      // All docs signed → ONE combined email with every executed doc attached as
      // a PDF (unified single-send), then pay (sign-before-pay). If already paid,
      // skip straight to done. Delivery is best-effort — never blocks the flow.
      if (!next.documents.some((d) => d.status !== 'EXECUTED')) {
        // ONBOARD §4. This used to POST /api/deliver-documents itself. It was a
        // SECOND sender racing the database: the execution trigger had already
        // mailed (and written a document_deliveries row for) each document one
        // at a time, so this call found every recipient already delivered,
        // returned an empty `delivered` array, and the done step then honestly
        // reported "we could not confirm" — while the member's inbox held one
        // email per document. The trigger now HOLDS the set and sends it as one
        // email when the last signature lands, so there is nothing left to send
        // from here.
        //
        // TRUTHFUL DELIVERY (2026-07-29) is preserved as a READ: poll for the
        // delivery rows /api/deliver-documents writes, so the done step still
        // only claims delivery that actually happened. `null` = still waiting.
        setEmailed(null);
        void pollDeliveryConfirmed().then(setEmailed);

        if (next.purchase && !next.purchase.paid) {
          await enterPayment();
        } else {
          setStep('done');
        }
      }
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
      <Steps current={step} showHorse={step === 'horse' || (state?.horse_needed ?? false)} />

      {/* ── Step 1: Your details ─────────────────────────────────────────── */}
      {step === 'details' && (
        <form onSubmit={saveDetails} className="bg-white border border-green-800/10 p-8">
          <h2 className="font-serif text-lg text-green-900 mb-1">Your details</h2>
          <p className="text-sm text-muted mb-6">
            These fill in your lesson paperwork — you'll review and sign it next.
          </p>

          {needsName && (
            <>
              <h3 className="form-label mb-3">Your name</h3>
              <p className="text-sm text-muted mb-3">This is the name that appears on your documents.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="form-label" htmlFor="ob-first">First name</label>
                  <input id="ob-first" required className="form-input" value={firstName}
                    autoComplete="given-name" onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ob-last">Last name</label>
                  <input id="ob-last" required className="form-input" value={lastName}
                    autoComplete="family-name" onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            </>
          )}

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
          <button type="submit"
            disabled={saving || (needsName && (!firstName.trim() || !lastName.trim()))}
            className="btn-primary">
            {saving ? 'Saving…' : 'Save & continue to documents'}
            {!saving && <ArrowRight size={16} />}
          </button>
        </form>
      )}

      {/* ── Step: Your horse (own-horse services only) ───────────────────── */}
      {step === 'horse' && (
        <section aria-labelledby="ob-horse-heading" className="bg-white border border-green-800/10 p-6 sm:p-8">
          <p className="eyebrow mb-1">Your horse</p>
          <h2 id="ob-horse-heading" className="font-serif text-green-800 text-xl mb-1.5">Tell us about your horse.</h2>
          <p className="body-text text-sm text-muted mb-5">
            Your service is for your own horse — your paperwork and care notes stay
            attached to their record with {withArticle(propertyTerm)}. If you have more than one, you
            can add them all here and cover them with a single signature.
          </p>

          {/* WHAT YOU HAVE ADDED SO FAR — the running set, so a member adding a
              second or third horse can always see where they are. */}
          {(chosenHorseIds.length > 0 || deferredHorseIds.length > 0) && (
            <div className="mb-5 rounded-lg border border-green-800/15 bg-green-50/40 p-4">
              <h3 className="form-label mb-2">Horses on this paperwork</h3>
              <ul className="flex flex-col gap-1 mb-1">
                {chosenHorseIds.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-sm text-green-900">
                    <Check size={14} className="text-green-700 shrink-0" aria-hidden="true" />
                    <span>{horseNameOf(id)}</span>
                  </li>
                ))}
                {deferredHorseIds.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-sm text-muted">
                    <Circle size={14} className="text-green-800/30 shrink-0" aria-hidden="true" />
                    <span>{horseNameOf(id)} — set aside for later</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {horseError && <p role="alert" className="form-error mb-4">{horseError}</p>}

          {/* ── THE CHOICE: add another, or continue ──────────────────────── */}
          {horsePhase === 'collect' && chosenHorseIds.length > 0
            && !reviewHorseId && !showNewHorseForm && (
            <div className="mb-6 rounded-lg border border-gold-400/40 bg-gold-50/30 p-4">
              <h3 className="form-label mb-1">
                {chosenHorseIds.length === 1 ? 'Do you have another horse?' : 'Any more horses?'}
              </h3>
              <p className="text-sm text-muted mb-3">
                Add every horse you want this paperwork to cover. A horse you don't
                add here is not named on the horse releases and authorizations, so
                those documents will not cover that horse until it's added and its
                own paperwork is completed.
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn-outline-gold text-sm"
                  disabled={bindingHorses}
                  onClick={() => { setShowNewHorseForm(true); setReviewHorseId(null); }}>
                  Add another horse
                </button>
                <button type="button" className="btn-primary text-sm"
                  disabled={bindingHorses}
                  onClick={() => {
                    if (chosenHorseIds.length > 1) setHorsePhase('decide');
                    else void commitHorses(true);
                  }}>
                  {bindingHorses ? 'Preparing your documents…' : "Done — continue to my documents"}
                  {!bindingHorses && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* ── COMBINED vs SPLIT — only asked when there IS a choice ─────── */}
          {horsePhase === 'decide' && (
            <div className="mb-6 rounded-lg border border-gold-400/60 bg-white p-5">
              <h3 className="font-serif text-green-800 text-lg mb-1">
                How would you like to sign for {chosenHorseIds.length} horses?
              </h3>
              <p className="text-sm text-muted mb-4">
                Either works, and both are equally valid — it's about how you'd
                rather keep your records.
              </p>
              <div className="flex flex-col gap-3">
                <button type="button" disabled={bindingHorses}
                  onClick={() => void commitHorses(true)}
                  className="text-left rounded-lg border border-green-800/20 hover:border-gold-400/60 p-4 focus-ring">
                  <p className="text-sm font-medium text-green-900 mb-1">
                    One set of documents covering all {chosenHorseIds.length} horses
                  </p>
                  <p className="text-xs text-muted">
                    Every horse is named on the same release and authorization, and
                    you sign once. Recommended when the same care arrangement covers
                    all of them.
                  </p>
                </button>
                <button type="button" disabled={bindingHorses}
                  onClick={() => void commitHorses(false)}
                  className="text-left rounded-lg border border-green-800/20 hover:border-gold-400/60 p-4 focus-ring">
                  <p className="text-sm font-medium text-green-900 mb-1">
                    Separate documents for each horse
                  </p>
                  <p className="text-xs text-muted">
                    You'll sign for {horseNameOf(chosenHorseIds[0])} now. The others
                    are saved and you'll get a quick link on your dashboard to do
                    each one whenever you're ready — nothing is blocked in the
                    meantime.
                  </p>
                </button>
              </div>
              <button type="button" onClick={() => setHorsePhase('collect')}
                className="mt-3 text-xs text-muted underline underline-offset-2">
                Back — I want to change my horses
              </button>
            </div>
          )}

          {stableHorses === null ? (
            <p className="body-text text-muted text-sm mb-4">Checking for horses already on your record…</p>
          ) : stableHorses.filter((h) => !chosenHorseIds.includes(h.id)).length > 0
              && !reviewHorseId && horsePhase === 'collect' && (
            <div className="mb-6">
              <h3 className="form-label mb-2">Horses already on your record</h3>
              <p className="text-sm text-muted mb-3">
                Pick a horse this paperwork is for — you'll review what's already on
                file and fill in anything missing, instead of entering them again.
                You can come back and add another after each one.
              </p>
              <div className="flex flex-col gap-2 mb-3">
                {stableHorses.filter((h) => !chosenHorseIds.includes(h.id)).map((h) => (
                  <div key={h.id} className="flex items-center justify-between gap-3 border border-green-800/15 rounded-lg px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-green-900">{h.name}</p>
                      <p className="text-xs text-muted">
                        {[h.breed, h.sex, h.color].filter(Boolean).join(' · ') || `On file with ${withArticle(propertyTerm)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button type="button" className="btn-outline-gold text-sm whitespace-nowrap"
                        disabled={attachingHorseId !== null}
                        onClick={() => { setShowNewHorseForm(false); setReviewHorseId(h.id); }}>
                        Review &amp; use this horse
                      </button>
                      {/* PARTIAL COMPLETION: a horse the member can't finish right
                          now (missing a vet number, say) is set aside rather than
                          holding up the horses they CAN complete. */}
                      {!deferredHorseIds.includes(h.id) && (
                        <button type="button"
                          className="text-xs text-muted underline underline-offset-2 whitespace-nowrap"
                          disabled={attachingHorseId !== null}
                          onClick={() => setDeferredHorseIds((ids) =>
                            ids.includes(h.id) ? ids : [...ids, h.id])}>
                          Not now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {!showNewHorseForm && (
                <button type="button" onClick={() => setShowNewHorseForm(true)}
                  className="text-sm text-gold-800 underline underline-offset-2">
                  My horse isn't listed — add a new horse
                </button>
              )}
            </div>
          )}

          {reviewHorseId && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="form-label">Review your horse's record</h3>
                <button type="button" onClick={() => setReviewHorseId(null)}
                  className="text-xs text-muted underline underline-offset-2">Choose a different horse</button>
              </div>
              <p className="text-sm text-muted mb-4">
                This is what we have on file. Confirm or correct it and fill in the
                required fields — it saves as you go, and it merges into the documents
                you'll sign next.
              </p>
              <HorseIntakeForm key={reviewHorseId} horseId={reviewHorseId}
                submitLabel="Confirm &amp; continue"
                onDone={(id) => void attachExistingHorse(id)} />
              {attachingHorseId && <p className="text-sm text-muted mt-2">Preparing your documents…</p>}
            </div>
          )}

          {(showNewHorseForm
            || (stableHorses !== null && stableHorses.length === 0 && chosenHorseIds.length === 0))
            && !reviewHorseId && horsePhase === 'collect' && (
            <>
              {chosenHorseIds.length > 0 ? (
                <h3 className="form-label mb-2">Add another horse</h3>
              ) : stableHorses !== null && stableHorses.length > 0 && (
                <h3 className="form-label mb-2">New horse</h3>
              )}
              <p className="body-text text-sm text-muted mb-5">
                This creates their record with {withArticle(propertyTerm)}. Anything you don't know can
                stay blank — you can finish the rest later without holding up the
                horses you have ready.
              </p>
              <HorseIntakeForm submitLabel="Save &amp; continue" onDone={(id) => void horseCompleted(id)} />
              {chosenHorseIds.length > 0 && (
                <button type="button" onClick={() => setShowNewHorseForm(false)}
                  className="mt-2 text-xs text-muted underline underline-offset-2">
                  Cancel — I'm done adding horses
                </button>
              )}
            </>
          )}

          {/* SKIP — with the consequence stated BEFORE the choice is made. */}
          {horsePhase === 'collect' && (
            <>
              <button type="button" onClick={() => void skipHorses()}
                disabled={bindingHorses}
                className="mt-3 block text-sm text-muted underline underline-offset-2">
                {chosenHorseIds.length > 0
                  ? "Skip the rest — I'll add my other horses later"
                  : "Skip for now — I'll add my horse later"}
              </button>
              <p className="mt-1.5 text-xs text-muted">
                Skipping doesn't skip your paperwork: the required horse releases
                still appear in the next step. But a horse you don't add is
                <strong> not named on them</strong>, so those documents don't cover
                that horse until it's added and its own details are completed.
                You'll get a quick link on your dashboard to finish any horse you
                set aside — there's no deadline and nothing else is held up.
              </p>
            </>
          )}
        </section>
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
                <div className="rounded-lg border border-green-800/15 bg-white/60 p-6 max-h-[28rem] overflow-y-auto overscroll-contain mb-5" data-testid="onboarding-merged-body">
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

              {/* 3f re-signer pointer: anchored to the signature box, never
                  obscuring or intercepting the document; does not dismiss
                  until this document's signature completes. */}
              <div className="pointer-events-none flex items-center gap-2 mb-1 text-gold-900" data-testid="sign-pointer">
                <span aria-hidden="true" className="animate-bounce text-lg leading-none">↓</span>
                <span className="text-sm font-medium">
                  {currentDoc && priorSigned[currentDoc.template_key]
                    ? `Review and sign — this version replaces the one you signed on ${new Date(priorSigned[currentDoc.template_key]).toLocaleDateString()}`
                    : 'Review and sign'}
                </span>
              </div>
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

      {/* ── Step 3: Payment (sign-before-pay; Zelle at launch) ───────────── */}
      {step === 'payment' && (
        <section aria-labelledby="ob-pay-heading">
          <h2 id="ob-pay-heading" className="font-serif text-lg text-green-900 mb-3">Payment</h2>
          {/* PAYLOCK: this used to read "Complete payment to confirm your
              booking" — a gate the system does not have. Nothing that writes a
              booking reads payment state, and this very step ships an "I'll pay
              later — finish" bypass, so the old sentence contradicted both the
              database and the button beneath it. */}
          <p className="text-sm text-muted mb-6">
            Your documents are signed — the last step is payment. Send it below, or
            finish now and pay later; either way you can book your sessions on the{' '}
            <Link to="/app/calendar" className="text-green-800 underline">Calendar</Link>.
          </p>
          {payError && <p role="alert" className="form-error mb-4">{payError}</p>}
          {order ? (
            <OrderPayment order={order} payment={payment} onChange={refreshPayment} />
          ) : (
            <p className="body-text text-muted text-sm">Preparing your payment…</p>
          )}
          <button
            type="button"
            className="btn-outline-gold text-sm mt-2"
            onClick={() => setStep('done')}
          >
            I'll pay later — finish
          </button>
        </section>
      )}

      {/* ── Step 4: You're all set ───────────────────────────────────────── */}
      {step === 'done' && (
        <section aria-labelledby="ob-done-heading">
          <div className="bg-green-50 border border-green-200 p-6 mb-6">
            <h2 id="ob-done-heading" className="font-serif text-xl text-green-800 mb-1 inline-flex items-center gap-2">
              <Check size={20} aria-hidden="true" /> You're all set.
            </h2>
            {/* Only claim delivery when it actually succeeded. In every case the
                signed documents are recorded and available — that part is true
                unconditionally, so the fallback copy stays reassuring. */}
            <p className="body-text text-sm">
              {emailed === true ? (
                <>Copies of everything you signed have been emailed to you, and they're always
                  available on your Documents page.</>
              ) : emailed === false ? (
                <>Everything you signed is recorded and available on your Documents page.
                  We couldn't email your copies just now — nothing is lost, and you can
                  download them any time from Documents.</>
              ) : (
                <>Everything you signed is recorded and always available on your Documents
                  page. Your emailed copies are on their way.</>
              )}
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
            <button type="button" className="btn-primary" onClick={() => setShowOverview(true)}>
              Continue <ArrowRight size={16} />
            </button>
            <Link to="/app/documents" className="btn-outline-gold">
              See your documents
            </Link>
          </div>
        </section>
      )}

      <AppOverviewModal open={showOverview} onClose={enterApp} categories={categories} presence={presence} lessonsOn={lessonsOn} />
    </div>
  );
}
