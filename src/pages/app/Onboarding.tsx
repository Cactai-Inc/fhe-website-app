import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  myDocuments,
  markTourSeen,
  myNameConfirmationState,
  myNavPresence,
  pollDeliveryConfirmed,
  fetchOfferings,
  createDraftOrder,
  holdMyDocumentDelivery,
  type OnboardingProfileInput,
  type OnboardingPurchase,
  type OnboardingState,
  type StandingCategory,
  type NavPresence,
} from '../../lib/api';
import type { Offering } from '../../lib/types';
import OrderPayment from '../../components/order/OrderPayment';
import type { Order, OrderItem, Payment } from '../../lib/types';
import { signMyDocument } from '../../lib/ops/api-client';
import {
  fetchMyStandingSlots,
  submitMyBookingRequest,
  type StandingSlot,
} from '../../lib/ops/api-calendar';
import { standingSlotSentence, serviceLabel } from '../../lib/standingSlots';
import { StandingSlotPicker } from '../../components/app/StandingSlotPicker';
import { BodyWithSignatures } from '../../components/ops/documents/MergedBodyView';
import { BackControl } from '../../components/app/BackControl';
import { AutoSaveIndicator } from '../../components/ops/kit/AutoSaveIndicator';
import { useFieldNormalizer, useFormDraft } from '../../lib/formState';
import { toErrorMessage } from '../../lib/ops/errors';
import { isEvaluationOffering } from '../../lib/serviceCatalog';
import { useDocumentTitle } from '../../lib/hooks';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import type { HorseIntakePayload } from '../../lib/horses';
import { HorseIntakeForm } from '../../components/app/HorseIntakeForm';
import { ActivationOrderPanel } from '../../components/app/ActivationOrderPanel';
import { SameHorseAsk } from '../../components/app/SameHorseAsk';
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

// CAREPATH §C9 — 'order' is the FIRST screen after sign-in. Owner: "they see
// their order information page with the booking information if we added it to
// the calendar and they click continue or they click a button that says 'notify
// staff this isnt correct'… either way they are taken to the screen where they
// add their horse's information."
// BUYANDBOOK §4 — 'slots' is where a WEEKLY MEMBERSHIP becomes real. Owner,
// 2026-08-20: "they pick the day or days for their weekly booking along with the
// time(s) for each at the time they onboard." It is skipped entirely — exactly as
// §C10a skips the horse step — for an order with no `recurring` line, because a
// punch-card buyer has no standing time to choose.
/* ⚠️ SIGNBOOK — TWO DOORS THROUGH ONE STEP MACHINE, AND THE DIFFERENCE IS ONE
   FACT: did they arrive with an order?

     STAFF-PROVISIONED (an order already exists at mount) — this page's original
     job, unchanged: order → details → horse → sign → PAYMENT → slots → done.
     They were sold something offline and are here to sign and pay for it.

     SELF-SERVE (`/sign/*`, no order) — CR-98 steps 3–7:
     details → horse → sign → shop → time → submit → done, and ⚠️ NO PAYMENT
     STEP AT ALL. Owner: *"then select the offering. then pick a day and time
     from the calendar. then submit the booking request."* Money happens after
     staff approve the request (TASK-REQCARDS), not here.

   ⚠️ `payment` IS NOT REMOVED (NOSTRIP). It is unreachable on the self-serve
   door and identical on the provisioned one. `OrderPayment` is the component
   TASK-REQCARDS gives a modal home; deleting it here would have to un-delete it
   there. */
type Step =
  | 'order' | 'details' | 'horse' | 'sign' | 'shop' | 'payment'
  | 'time' | 'slots' | 'submit' | 'done';

/* ⚠️ THE EVALUATION LESSON IS THE FIRST PURCHASE (owner, 2026-08-24).
   "the evaluation lesson should be highlighted with a gold outline so they know
   that is the first thing to look at and it clearly states that its the first
   thing they do for a lesson, they can purchase more than that but they should
   always purchase this before they can buy anything else... we can gate it so the
   others are not selectable and slightly grayed out but still very readable."

   Matched on SERVICE + the offering's own name rather than a hardcoded id: an id
   in a function body is a TENANT FACT HARDCODED IN CODE, and this one would silently stop
   gating anything the day the offering is re-priced into a new row. */


/* ── SIGNDOOR — THE MINOR QUESTION LIVES HERE NOW ──────────────────────────
   Owner, 2026-09-01: the /sign/* door *"was supposed to only ask for their email
   address"*, and the personal-information form is *"the first page after auth …
   the MINIMUM the DOCUMENTS require."* So FIX1 §A's question — the one AR7 was
   written about — is asked on THIS page, in the shape FIX1 gave it: two radios,
   NO DEFAULT, above the name fields, because until it is answered "First name"
   is ambiguous and that ambiguity is the whole defect.

   ⚠️ WHY IT IS SAFE HERE AND WAS NOT BEFORE. FIX1 moved this question OUT of
   onboarding and onto the door, because onboarding asked it only after the email,
   the click and the first login — "by which point the wrong person already
   exists". That was true when the DOOR captured the name. It no longer does: the
   door captures an email address and nothing else, so the first place a human
   name is typed is this form. Nothing exists to be wrong before it is answered.

   ⚠️ AND IT IS SAFER: post-auth the account is PROVABLY the guardian's, because
   they clicked a link sent to an address only they can read.

   WHICH DOORS ASK (owner ruling, 2026-08-31): *"sign/rider and sign/guest … are
   the only places a minor is applicable. the other two cannot be a minor, one is
   a horse owner for horse care services and the other is horse owner for deal
   party, both require a person to be 18+ to be horse owner."* `rider+horse` is a
   RIDER door and asks — FIX1 applied his RULE, not his count of four.

   ⚠️ THE BROWSER IS NOT THE AUTHORITY. This map decides what is RENDERED; the
   database re-decides what is ATTACHED — `_sign_path_allows_minor(text)`, read by
   `update_my_onboarding_profile` (20260901T1120). One rule, stated twice on
   purpose, exactly as the door used to state it twice. */
const MINOR_QUESTION: Record<string, { question: string; self: string; child: string }> = {
  guest: { question: 'Who is visiting?', self: 'Me', child: 'My child (I am the parent or legal guardian)' },
  rider: { question: 'Who will be riding?', self: 'Me', child: 'My child (I am the parent or legal guardian)' },
  'rider+horse': { question: 'Who will be riding?', self: 'Me', child: 'My child (I am the parent or legal guardian)' },
};

/** The two doors that never ask. ⚠️ A DENY-LIST, DELIBERATELY: an unknown path —
 *  no invitation, a staff invite with no categories — FAILS OPEN to asking, and
 *  gets the neutral wording below. Not asking is the 2026-08-28 incident; asking
 *  a horse owner one extra question is not. Mirrors the SQL of the same name. */
const NON_MINOR_PATHS = new Set(['horse', 'deal']);
const MINOR_QUESTION_FALLBACK = {
  question: 'Who are you signing up?', self: 'Me',
  child: 'My child (I am the parent or legal guardian)',
};

/** Under 18 on the day they answer. The same test `sign_release` applies to a
 *  kiosk minor release, and the same one the door applied: an "18-year-old minor"
 *  is a data error, and recording one would put an adult in the non-signing
 *  PARTICIPANT slot where nobody would ever ask them to sign for themselves. */
function isUnder18(dob: string): boolean {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  return new Date(d.getFullYear() + 18, d.getMonth(), d.getDate()) > new Date();
}

/** The plain profile fields (the name, minor toggle + fields are tracked apart). */
type ProfileFormFields = Omit<
  OnboardingProfileInput,
  'first_name' | 'last_name' | 'has_minor' | 'minor_first_name' | 'minor_last_name' | 'minor_dob'
>;

const EMPTY_FORM: Required<ProfileFormFields> = {
  phone: '',
  text_only_phone: '',
  preferred_contact: '',
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

/** "4 lessons" for a punch card. NOT a cadence string for a weekly membership:
 *  D23 — that product is a STANDING SLOT, and the honest summary of a standing slot
 *  is which days and times are theirs, which `standingSlotSummary` renders from the
 *  slot itself. "1 lessons/week" described a pool that does not exist. */
function planQuantity(p: OnboardingPurchase): string | null {
  return p.lessons_included ? `${p.lessons_included} lessons` : null;
}

/** Purchase summary card (step 3 + revisits after completion). Shows the
 *  minor rider's name when the plan is for a minor (the guardian signed). */
function PurchaseCard({ purchase, riderName, standing }: {
  purchase: OnboardingPurchase;
  riderName?: string | null;
  /** D23 — a weekly membership's line is its standing time, never a count. */
  standing?: StandingSlot[];
}) {
  const quantity = planQuantity(purchase);
  const slots = (standing ?? []).map((s) => ({ id: s.purchase_item_id, text: standingSlotSentence(s) }));
  /* D25 (SLOTREACH §4) — a weekly member is NEVER shown the SKU. "2x Weekly Lessons"
     is the internal name of what was sold; what they have is two Riding Lessons a
     week, and that is what the card says. A punch card or a one-off keeps its own
     product title, because there the count IS the thing they bought. */
  const weekly = (standing ?? [])[0] ?? null;
  const title = weekly
    ? serviceLabel(weekly, Math.max(weekly.weekly_frequency ?? 1, 1))
    : purchase.tier_label;
  return (
    <div className="bg-white border border-green-800/10 p-6 mb-6" data-testid="purchase-card">
      <p className="eyebrow mb-2">Your plan</p>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-xl text-green-800">{title}</p>
          {quantity && <p className="text-sm text-secondary mt-1">{quantity}</p>}
          {slots.map((s) => <p key={s.id} className="text-sm text-secondary mt-1">{s.text}</p>)}
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

/** THE WEEKLY MEMBERSHIP'S ONE QUESTION — which day(s) and time(s) are yours.
 *
 *  SLOTREACH §1: the picker itself moved OUT of this file into
 *  `components/app/StandingSlotPicker`, because a control that exists only inside an
 *  onboarding wizard is a control a signed client cannot reach — WALK2's finding, and
 *  the eleventh reach failure in this project (D17). The same component now also
 *  mounts on the member's Calendar and on the staff dossier. What stays here is only
 *  the wizard's own framing: the heading, and the way OUT of the step.
 */
function StandingSlotStep({ slots, onReload, onFinished }: {
  slots: StandingSlot[];
  onReload: () => void;
  onFinished: () => void;
}) {
  const nothingPending = slots.length > 0 && slots.every((p) => p.chosen);
  return (
    <section aria-labelledby="ob-slots-heading">
      <h2 id="ob-slots-heading" className="font-serif text-lg text-green-900 mb-3">
        Your weekly time
      </h2>

      <StandingSlotPicker slots={slots} onSaved={onReload} audience="client" />

      {slots.length > 0 && (
        <p className="text-xs font-sans text-muted mt-4">
          {nothingPending ? 'They are already on your ' : 'It will show up on your '}
          <Link to="/app/calendar" className="text-green-800 underline">Calendar</Link>
          , and you can change any single week from there — you are never locked into
          one session.
        </p>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        {/* Never a trap. Staff can set it from the dossier, the member can come back
            to it from their Calendar, and nothing else in onboarding waits on it. */}
        <button type="button"
          className={nothingPending ? 'btn-primary' : 'btn-outline-gold text-sm'}
          onClick={onFinished}>
          {nothingPending ? 'Continue' : "I'll decide later"}
        </button>
      </div>
    </section>
  );
}

/** THE ORDER OF THE STEPS, IN ONE PLACE.
 *
 *  ⚠️ SIGNBOOK — this list and `visibleSteps` below it are the SAME order, and
 *  they have to be: this one is what the person reads, that one is what Back
 *  walks. They disagreed before this task — the header said sign-then-payment
 *  while the machine ran sign-then-shop — which is how the spec came to believe
 *  the wizard signed AFTER shopping. It never did; only the labels said so. */
function wizardSteps(opts: {
  showHorse: boolean; showOrder: boolean; showSlots: boolean;
  showShop: boolean; showTime: boolean; selfServe: boolean;
}): { id: Step; label: string }[] {
  return [
    // §C9 — only when there IS an order to show; a member re-invited with no
    // purchase must not be walked past an empty screen.
    ...(opts.showOrder ? [{ id: 'order' as Step, label: 'Your order' }] : []),
    { id: 'details' as Step, label: 'Your details' },
    // §C10a — the horse step is skipped ENTIRELY for a client whose order
    // carries no horse-related purchase. An unanswerable form tells them we
    // were not listening.
    ...(opts.showHorse ? [{ id: 'horse' as Step, label: 'Your horse' }] : []),
    { id: 'sign' as Step, label: 'Review & sign' },
    // CR-98 step 5 — the offering comes AFTER the paperwork, and only on the
    // self-serve door: a staff-provisioned client was already sold something.
    ...(opts.showShop ? [{ id: 'shop' as Step, label: 'Choose your lesson' }] : []),
    // ⚠️ PAYMENT IS THE PROVISIONED DOOR'S STEP ONLY (CR-98: the self-serve
    // visitor pays after staff approve, not inside the wizard).
    ...(opts.selfServe ? [] : [{ id: 'payment' as Step, label: 'Payment' }]),
    // CR-98 step 6 — "then pick a day and time from the calendar".
    ...(opts.showTime ? [{ id: 'time' as Step, label: 'Pick a time' }] : []),
    // §C10a's rule, applied to the weekly membership: a step nobody can answer is a
    // step that tells them we were not listening.
    ...(opts.showSlots ? [{ id: 'slots' as Step, label: 'Your weekly time' }] : []),
    // CR-98 step 7 — "then submit the booking request".
    ...(opts.showTime ? [{ id: 'submit' as Step, label: 'Send your request' }] : []),
    { id: 'done' as Step, label: opts.selfServe ? 'Request sent' : "You're all set" },
  ];
}

/** Step header: which step we're on, out of the ones this person actually has. */
function Steps({ current, showHorse, showOrder, showSlots, showShop, showTime, selfServe }: {
  current: Step; showHorse: boolean; showOrder: boolean; showSlots: boolean;
  showShop: boolean; showTime: boolean; selfServe: boolean;
}) {
  const steps = wizardSteps({ showHorse, showOrder, showSlots, showShop, showTime, selfServe });
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
  // SLOTREACH §1 — `?step=slots` is THE REACH. The order page's "Pick your weekly
  // time" link pointed at `/app/onboarding`, the wizard's root, which for a signed
  // client resolves to "You're all set" or to "Nothing to do here" — so the only
  // door to the standing-slot picker opened onto a wall (WALK2). The link now names
  // the step, and the step machine below honours it whatever the paperwork says.
  const [searchParams] = useSearchParams();
  const wantsSlots = searchParams.get('step') === 'slots';
  /* THE REACH for the first-lesson shop (owner, 2026-08-24): the dashboard card
     links here, so somebody who closed the shop mid-flow can pick it back up.
     Same idiom as `?step=slots` — one query parameter, honoured over whatever the
     paperwork would otherwise choose. */
  const wantsShop = searchParams.get('step') === 'shop';
  const { hasModule } = useAuth();
  const propertyTerm = usePropertyTerm();
  // I6 — the app-overview modal's page list now mirrors AppLayout's canonical
  // USER nav order exactly, so this instance (the FIRST tour a member sees)
  // needs the same live presence + module gate as AppLayout threads in.
  const lessonsOn = hasModule('mod.lessons');
  const [presence, setPresence] = useState<NavPresence>({
    orders: false, payments: false, documents: false, stable: false, posts: false, saved: false,
  });
  /* ⚠️ SIGNBOOK — WHICH DOOR THIS PERSON CAME IN BY, DECIDED ONCE AT MOUNT.
     `null` until the first read lands. It must be captured from the FIRST
     `my_onboarding_state()` and never recomputed: the self-serve visitor
     acquires an order at the shop step, and re-deriving it would flip them onto
     the staff-provisioned door — and into its payment step — halfway through
     their own flow. */
  const [arrivedWithOrder, setArrivedWithOrder] = useState<boolean | null>(null);
  const selfServe = arrivedWithOrder === false;
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
  const normalize = useFieldNormalizer();
  // ── The shop step (owner, 2026-08-24). Rider offerings, evaluation first.
  const [shopOfferings, setShopOfferings] = useState<Offering[]>([]);
  const [shopPicked, setShopPicked] = useState<string[]>([]);
  const [shopBusy, setShopBusy] = useState(false);
  const [shopError, setShopError] = useState<string | null>(null);
  /** They bought through the shop step just now, so WE book the first lesson. */
  const [weBookThisOne, setWeBookThisOne] = useState(false);
  /* ── CR-98 step 6/7 — the day and time they are asking for, and what came back.
     `timeDate`/`timeClock` are LOCAL WALL-CLOCK strings straight out of the two
     inputs; they become an instant exactly the way `CalendarPage`'s "Request this
     time" does it, because there is one right answer to that and it already
     exists. ⚠️ There is no tenant timezone in this system (LESSONREQUEST), so
     both surfaces read the browser's — the same browser, the same answer. */
  const [timeDate, setTimeDate] = useState('');
  const [timeClock, setTimeClock] = useState('');
  const [timeMinutes, setTimeMinutes] = useState('60');
  const [timeNote, setTimeNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
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


  /* ── SIGNDOOR — WHO IS THIS FOR ──────────────────────────────────────────
     ⚠️ `null` is "not answered yet" and is deliberately distinct from 'self'.
     A checkbox stood here, and an unticked checkbox is an ANSWER the person never
     gave: it says "this is for me" by default, which is precisely the assumption
     that produced the 2026-08-28 incident. On a door that asks, an unanswered
     question is now REFUSED rather than assumed (FIX1 §A, held). */
  const [signingFor, setSigningFor] = useState<'self' | 'child' | null>(null);
  // `hadMinor` tracks the SERVER's state (from my_onboarding_state().minor) so an
  // explicit "Me" AFTER a child was attached sends has_minor:false, while a
  // never-answered question sends no minor keys at all.
  const [hadMinor, setHadMinor] = useState(false);
  const [minorFirst, setMinorFirst] = useState('');
  const [minorLast, setMinorLast] = useState('');
  const [minorDob, setMinorDob] = useState('');
  /* ── SIGNDOOR — the door they came in by, and therefore which questions this
     form owes them. `''` (unknown) falls through to asking; see NON_MINOR_PATHS. */
  const signPath = (state?.sign_path ?? '').trim();
  /* ⚠️ A guardian who ALREADY has a child attached is always asked, whatever the
     door said. Otherwise the block would vanish and they could neither correct
     the child's details nor detach them — a screen that silently drops an edit,
     which is this repo's most common defect shape. */
  const asksMinor = !NON_MINOR_PATHS.has(signPath) || Boolean(state?.minor);
  const minorCopy = MINOR_QUESTION[signPath] ?? MINOR_QUESTION_FALLBACK;
  const isForChild = asksMinor && signingFor === 'child';
  const minorNamesFilled = minorFirst.trim() !== '' && minorLast.trim() !== '';
  const minorDobValid = minorDob.trim() !== '' && isUnder18(minorDob);

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
  // CAREPATH §C10b — what the client already told us about a horse of THEIRS on
  // the inquiry, once they have confirmed the horse they are adding is that one.
  // `null` = not asked yet; `{}` = asked and it is a different horse (or there
  // was nothing to ask about). NEVER assumed either way.
  const [horsePrefill, setHorsePrefill] = useState<Partial<HorseIntakePayload> | null>(null);
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

  /* CR-98 step 8 — DECLARE THE RUN BEFORE THE FIRST SIGNATURE.
     The one email the owner asked for carries the documents AND the order AND
     the booking request, and the last two do not exist until three steps after
     the last signature. Holding the set is what lets one email say all of it.
     ⚠️ Self-serve only: the provisioned door still ends at payment and has
     nothing to add to the email, so its delivery is left exactly as it is.
     ⚠️ Best-effort — a failure here just means the documents mail on their own,
     which is today's behaviour, so it must never block signing. */
  useEffect(() => {
    if (step !== 'sign' || !selfServe) return;
    void holdMyDocumentDelivery().catch(() => { /* mail on its own; nothing lost */ });
  }, [step, selfServe]);

  // Step 3 — payment (sign-before-pay). The client pays their spine purchase
  // (surfaced by my_onboarding_state) directly — no engagement bridge.
  const [order, setOrder] = useState<(Order & { items: OrderItem[] }) | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  // BUYANDBOOK §4 — the slot step exists only for a client with a `recurring` line.
  // An empty list means this is a punch-card buyer and the step never appears.
  // SLOTREACH §1: loaded at MOUNT now, not when the payment step is entered, and
  // never filtered to one purchase — see the mount effect below.
  const [standing, setStanding] = useState<StandingSlot[]>([]);
  const reloadStanding = useCallback(
    () => fetchMyStandingSlots()
      .then(setStanding)
      .catch(() => { /* the picker keeps what it has; nothing is lost */ }),
    [],
  );

  // Load the purchase for the payment step, then poll for confirmation.
  async function enterPayment() {
    setPayError(null);
    const purchaseId = state?.purchase?.purchase_id ?? null;
    try {
      /* ⚠️ NO ORDER YET => GO SHOPPING, not to a dead end (owner, 2026-08-24):
         "at the end of the document signing, it should take me to the offerings
         booking page for riding lessons so i can proceed with adding something."
         A self-onboarding rider arrives with nothing bought — this used to end
         their flow on a congratulations screen with no way to buy the lesson the
         whole exercise was about. */
      if (!purchaseId) { setStep('shop'); return; }
      const [o, p, sl] = await Promise.all([
        getOrder(purchaseId), getOrderPayment(purchaseId), fetchMyStandingSlots(),
      ]);
      setOrder(o);
      setPayment(p);
      setStanding(sl);
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
    if (o && o.status === 'paid') finishPayment();
  }

  /** Load the rider catalog the first time the shop step is reached. */
  useEffect(() => {
    if (step !== 'shop' || shopOfferings.length > 0) return;
    fetchOfferings()
      .then((all) => setShopOfferings(all.filter(
        (o) => o.segment === 'rider' && o.active
          && o.config_kind !== 'inquire' && o.price_amount != null)))
      .catch(() => setShopError('We could not load the lesson options. You can browse them from the Shop.'));
  }, [step, shopOfferings.length]);

  /** Buy what they picked, then go to payment.
   *
   *  ⚠️ THE BOOKING STEP IS DELIBERATELY SKIPPED ON THIS FIRST PASS. Owner,
   *  2026-08-24: "the difference with this flow is we are sending the url for them
   *  to self onboard and they add the offering and get the payment information
   *  page but we skip booking, we handle the booking step for them on this first
   *  pass, from then on they can use the calendar to select a slot and make the
   *  request." The order opens as a DRAFT (create_my_purchase owns every
   *  money-bearing column), so staff approve it — which is also what now assigns
   *  any further paperwork and books the first lesson. */
  async function buyPicked() {
    if (shopPicked.length === 0 || shopBusy) return;
    setShopBusy(true); setShopError(null);
    try {
      const { orderId } = await createDraftOrder({
        items: shopPicked.map((id) => ({ offering_id: id, quantity: 1 })),
      });
      const [o, p] = await Promise.all([getOrder(orderId), getOrderPayment(orderId)]);
      setOrder(o); setPayment(p);
      setWeBookThisOne(true);
      /* CR-98 steps 5 → 6. The self-serve visitor has just built their draft
         order; the next thing they owe us is a time, not money. The provisioned
         door cannot reach this function (it arrives with an order), but it is
         gated rather than assumed. */
      setStep(selfServe ? 'time' : 'payment');
    } catch (err) {
      setShopError(toErrorMessage(err, 'Could not start your order. Staff can set it up for you.'));
    } finally {
      setShopBusy(false);
    }
  }

  /** The instant they asked for, built from the two inputs the way
   *  `CalendarPage`'s "Request this time" builds its own — local wall clock in,
   *  `toISOString()` out. One idiom, so a time requested here and a time
   *  requested there cannot mean different moments. */
  const requestedStart = (() => {
    if (!timeDate || !timeClock) return null;
    const d = new Date(`${timeDate}T${timeClock}`);
    return Number.isNaN(d.getTime()) ? null : d;
  })();
  const requestedEnd = requestedStart
    ? new Date(requestedStart.getTime() + Math.max(Number(timeMinutes) || 60, 15) * 60_000)
    : null;
  const requestedLabel = requestedStart
    ? requestedStart.toLocaleString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '';

  /** CR-98 step 7 — *"then submit the booking request"*, and it is ONE act.
   *
   *  ⚠️ D19: nothing here is money-shaped and the screen before it says so. The
   *  order stays a draft, no credit is minted, and the undo is that staff
   *  decline the request or the client withdraws it. What the one RPC does —
   *  the booking, the staff decision row, the staff alert, the one email — is
   *  documented on `submit_my_booking_request` itself; this is its only caller. */
  async function sendBookingRequest() {
    if (submitting || !order || !requestedStart || !requestedEnd) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitMyBookingRequest({
        purchaseId: order.id,
        startISO: requestedStart.toISOString(),
        endISO: requestedEnd.toISOString(),
        note: timeNote,
      });
      setRequestSent(true);
      // The set was held since the sign step and has just been released, so the
      // delivery rows are being written now — re-read rather than assume.
      setEmailed(null);
      void pollDeliveryConfirmed().then(setEmailed);
      setStep('done');
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'Could not send your request. Nothing was lost — try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  /** Leaving payment. A weekly membership still owes us its standing time, so that
   *  is the next step; a punch-card order goes straight to done. Either way nothing
   *  here blocks the member — D23. */
  function finishPayment() {
    setStep(standing.some((p) => !p.chosen) ? 'slots' : 'done');
  }

  useEffect(() => {
    let active = true;
    // Presentational only — feeds the app-overview modal variant, gates nothing.
    // Failing to a guest-variant tour is the right degradation.
    fetchMyCategories().then((c) => active && setCategories(c)).catch(() => {});
    // Same quiet-catch fallback as AppLayout's useNavPresence: a failed read
    // just leaves every presence-gated tour line hidden.
    myNavPresence().then((p) => active && setPresence(p)).catch(() => {});
    Promise.all([
      myOnboardingState(),
      getMyProfile().catch(() => null),
      // SLOTREACH §1 — READ UNFILTERED, AND READ IT FIRST. This used to be read only
      // when the payment step was entered, so the one fact that decides whether a
      // weekly member still owes us their standing time was unknown at exactly the
      // moment the wizard decided whether to short-circuit. Unfiltered by purchase,
      // because a member may hold a plan from an order this wizard is not about.
      fetchMyStandingSlots().catch(() => [] as StandingSlot[]),
    ])
      .then(([s, p, sl]) => {
        if (!active) return;
        setState(s);
        setProfile(p);
        // ⚠️ ONCE. See the declaration — re-deriving this after the shop step
        // would move a self-serve visitor onto the provisioned door mid-flow.
        setArrivedWithOrder((prev) => prev ?? Boolean(s.purchase?.purchase_id));
        // Prefill the minor toggle from the attached PARTICIPANT (if any).
        if (s.minor) {
          setSigningFor('child');
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
            text_only_phone: pre?.text_only_phone ?? '',
            preferred_contact: pre?.preferred_contact ?? '',
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
        setStanding(sl);
        // SLOTREACH §1 — THE PAPERWORK SHORT-CIRCUIT, FIXED AT THE CONDITION.
        // `!s.needed` means "no documents are waiting on you", and it used to end the
        // wizard outright. A weekly member whose paperwork is signed and whose
        // standing time is UNCHOSEN has the single most important thing in the
        // product still outstanding, and that is the exact client WALK2 got stuck as.
        // Asking for the step by name wins over everything; an unchosen slot wins
        // over "nothing to do".
        const slotOutstanding = sl.some((x) => !x.chosen);
        /* P1 ITEM 2 — A WAITING CONTRACT OUTRANKS THE WIZARD.
           Owner, 2026-08-25: a counterparty claims her account and "on activation
           she sees the contract". If she is here at all with a lease unsigned,
           the lease is the thing to do — so we leave, rather than walking her
           through a wizard about lessons she has not bought. Routed through the
           contract's own gate, which asks for anything the document still needs
           and forwards straight to it when nothing is missing. */
        const waiting = s.contracts_waiting ?? [];
        if (waiting.length > 0 && !s.needed && !wantsShop && !wantsSlots) {
          navigate(`/app/contracts/${waiting[0].document_id}/start`, { replace: true });
          return;
        }
        if (wantsShop) setStep('shop');
        else if (wantsSlots && sl.length > 0) setStep('slots');
        else if (!s.needed) setStep(slotOutstanding ? 'slots' : 'done');
        // §C9 — the order screen comes FIRST when there is an order to show.
        else if (s.purchase?.purchase_id) setStep('order');
        // 3f: the input form ALWAYS renders, prefilled, even when nothing is
        // missing — the person confirms or corrects, then advances.
        // Re-attestation is part of what the new signature means; no skip.
        else setStep('details');
      })
      .catch((err) => active && setLoadError(toErrorMessage(err, 'Could not load your onboarding.')))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [wantsSlots]);

  /* ⚠️ TASK-FIX4 §6 — THE DETAILS STEP SURVIVES A RELOAD AND A BROWSER-BACK.
     Owner: *"i was using the word refresh to indicate a reload, i fail to see the
     distinction between them nor a difference."* He is right, and both destroy
     React state identically — so the answer is one store that outlives the page.

     ⚠️ `ready: !loading` IS LOad-ORDER-CRITICAL. The initial fetch fills `form`
     from the profile; restoring before it lands would put the draft back and then
     have the fetch overwrite it. Held until the load settles, so what the person
     typed wins over what the record held — which is the right way round, because
     what they typed is the newer answer. */
  const draft = useFormDraft(
    'onboarding.details',
    { ...form, firstName, lastName, signingFor, minorFirst, minorLast, minorDob },
    (d) => {
      /* ⚠️ ONLY THE FORM'S OWN KEYS. This was `{ ...f, ...d }`, and `d` is the
         WHOLE draft — which also carries firstName, lastName and the minor
         answer, none of which are profile fields. They landed in `form`, `form`
         is spread into the jsonb this page sends to
         update_my_onboarding_profile, and the RPC was therefore being handed
         `signingFor` / `minorFirst` / `minorLast` / `minorDob` keys it has no
         reading for. Harmless — it reads named keys — but it is junk in a
         payload that goes to the database, and it was invisible until
         probe-sign-minor printed the body. Caught 2026-09-01. */
      setForm((f) => {
        const next = { ...f };
        for (const k of Object.keys(EMPTY_FORM) as (keyof typeof EMPTY_FORM)[]) {
          const v = (d as Record<string, unknown>)[k];
          if (typeof v === 'string') next[k] = v;
        }
        return next;
      });
      if (typeof d.firstName === 'string') setFirstName(d.firstName);
      if (typeof d.lastName === 'string') setLastName(d.lastName);
      if (d.signingFor === 'self' || d.signingFor === 'child') setSigningFor(d.signingFor);
      if (typeof d.minorFirst === 'string') setMinorFirst(d.minorFirst);
      if (typeof d.minorLast === 'string') setMinorLast(d.minorLast);
      if (typeof d.minorDob === 'string') setMinorDob(d.minorDob);
    },
    { ready: !loading },
  );

  function clearDetailsForm() {
    setForm(EMPTY_FORM);
    setFirstName(''); setLastName('');
    setSigningFor(null); setMinorFirst(''); setMinorLast(''); setMinorDob('');
    setSaveError(null);
    draft.clear();
  }

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
    // ONBOARD §5. Owner: "the user is taken to a page where they see their
    // account. they see their dashboard the onboarding modal and they have a
    // notice to complete their profile … then they can go to the community feed."
    // The dashboard is the landing, unconditionally — it is where the profile
    // notice and the checklist live. This used to route a member with zero unread
    // notifications straight past it to the community feed, which is precisely
    // the member who has just finished signing and still owes us their details.
    // The feed is one nav click away from here.
    navigate('/app/dashboard', { replace: true });
  }

  const upd = (key: keyof ProfileFormFields) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();

    /* ⚠️ SIGNDOOR/FIX1 §A — asked FIRST, because it decides what every field
       below MEANS. Until it is answered, "First name" is ambiguous. */
    if (asksMinor && signingFor === null) {
      setSaveError(`Please tell us ${minorCopy.question.replace(/\?$/, '').toLowerCase()}.`);
      return;
    }
    if (isForChild && !minorNamesFilled) {
      setSaveError("Please enter your child's first and last name.");
      return;
    }
    if (isForChild && !minorDob.trim()) {
      setSaveError("Please enter your child's date of birth.");
      return;
    }
    if (isForChild && !isUnder18(minorDob)) {
      /* Not pedantry: an 18-year-old put in the PARTICIPANT slot is an adult
         recorded as a dependent, and nobody would ever ask them to sign for
         themselves. sign_release refuses the same case for the same reason. */
      setSaveError('That date of birth is 18 or older. An adult rider signs up in their own name — choose "Me" above.');
      return;
    }

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
      if (isForChild) {
        payload.has_minor = true;
        payload.minor_first_name = minorFirst;
        payload.minor_last_name = minorLast;
        payload.minor_dob = minorDob;
      } else if (hadMinor) {
        // They answered "Me" after a child had been attached: that is a DETACH,
        // and it is a different act from never having answered.
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
      draft.clear();
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

  /* ⚠️ THE BROWSER GATE IS EXACT — CASE AND ALL. TASK-FIX4 §5 REVERSES WHAT
     TASK-FIX1 §4.4 DID HERE, ON THE OWNER'S RULING (CR-83, 2026-08-31):
     *"Signing must require exact match so they catch any typo or capitalization
     error before signing the documents."*

     FIX1 relaxed this to the server's case-insensitive rule, reasoning that a
     dead disabled button with nothing on screen was worse than a refusal that
     names the string it wanted. ⚠️ That reasoning was about the ERROR STATE, and
     it is answered below by saying what we expect rather than by widening the
     rule — the mismatch hint under the box is what FIX1 was actually missing.

     ⚠️ TWO GATES, TWO JOBS, AND THEY MUST NOT BE MADE THE SAME RULE.
       · **BROWSER (here): EXACT.** It is the last moment a wrong name is visible
         to the person it belongs to. Catching `elisheva fiszer` here is the
         entire point of the gate.
       · **SERVER (`record_signature`): CASE-INSENSITIVE, and it stays that way.**
         It exists to stop a MISMATCHED signature, and it must keep accepting the
         four legitimate executed variants already in production
         (`"Brian olenik"`, three × `"Elisheva fiszer"`).

     ⚠️ AND THE EXACT GATE IS ONLY SAFE WITH THE BACK CONTROL (§7). A normalised
     name the person cannot revise before signing is worse than no normalisation
     at all — which is why CR-83 attached the back button to this rule itself. */
  const collapseSpace = (v: string) => v.trim().replace(/\s+/g, ' ');
  const expectedName = `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim();
  const nameMatches = expectedName !== '' && collapseSpace(typedName) === collapseSpace(expectedName);
  /** Typed something, but not the name on the record — say so, rather than
   *  disabling the button and leaving them to guess (the FIX1 complaint). */
  const nameMismatch = typedName.trim() !== '' && !nameMatches;

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

        /* ⚠️ THE BLOCKER SIGNBOOK WAS SENT TO FIND (owner: *"what is blocking a
           new visitor from signing up"*). A self-serve `/sign/rider` visitor has
           NO purchase, so this fell to the else branch, found no standing slot
           and landed them on "You're all set" — with nothing bought, and the
           shop step reachable only from `?step=shop` or from `enterPayment()`,
           which is never called when there is no purchase. **The offering step
           was unreachable for exactly the person it was built for.**
           CR-98 step 5 is what belongs here: paperwork, then the offering. */
        if (selfServe) {
          setStep('shop');
        } else if (next.purchase && !next.purchase.paid) {
          await enterPayment();
        } else {
          // SLOTREACH §1 — the OTHER paperwork short-circuit. A member whose order
          // was already paid landed on "You're all set" the moment their last
          // signature went down, with their standing weekly time still unchosen and
          // no way back to the step. Re-read first: a slot may have been chosen on
          // another surface since this page loaded.
          const sl = await fetchMyStandingSlots().catch(() => standing);
          setStanding(sl);
          setStep(sl.some((x) => !x.chosen) ? 'slots' : 'done');
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
  // SLOTREACH §1: `standing.length === 0` is the third condition and it is not
  // cosmetic. WALK2's signed weekly member hit this branch and was told "Nothing to
  // do here" while their standing time was unchosen and their calendar was empty.
  // Anyone holding a weekly plan gets the wizard — to choose the time if it is
  // outstanding, and to see what they hold if it is not.
  //
  // ⚠️ P1 ITEM 2 / CR-64 — `contractsWaiting.length === 0` IS THE FOURTH CONDITION,
  // and it is the same defect one more time. This screen asked about documents, a
  // purchase and a standing slot, and never asked whether a CONTRACT was waiting —
  // so a lease counterparty, who by design has none of the other three, was told
  // she had nothing to do while her lease sat unsigned. The effect above routes
  // her to it before this renders; this condition is the guarantee, so no path
  // into this component can produce that sentence for someone with a contract open.
  const contractsWaiting = state?.contracts_waiting ?? [];
  /* ⚠️ SIGNBOOK — THE SECOND BLOCKER, AND THE PROBE IS WHAT FOUND IT.
     This short-circuit asks four questions about ARRIVAL — no documents, no
     order, no standing slot, no contract — and a self-serve visitor answers all
     four that way THE MOMENT THEY SIGN, because their order does not exist yet
     and never will until the shop step. So signing replaced the wizard with
     "Nothing to do here", one render before the offering step could paint. The
     first blocker (§4 of the ledger) sent them to `done`; fixing that alone
     would have landed them here instead, which is worse — it says the flow is
     over while they are standing in the middle of it.
     ⚠️ `done` is deliberately NOT in this list: a member who arrives with
     nothing outstanding is routed to `done` at mount, and for THEM this
     sentence is the right one. `requestSent` distinguishes the two. */
  const midFlow = step === 'shop' || step === 'time' || step === 'submit' || requestSent;
  if (state && !state.needed && !state.purchase && standing.length === 0
      && contractsWaiting.length === 0 && !midFlow) {
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

  // A contract is waiting and the wizard still has something of its own to do
  // (unsigned paperwork, an unpaid order, an unchosen slot) — so we did NOT
  // redirect. Say the contract is there rather than hiding it behind the wizard.
  const contractBanner = contractsWaiting.length > 0 ? (
    <section className="bg-gold-50 border border-gold-500/40 rounded-xl p-5 mb-6">
      <h2 className="font-serif text-green-900 mb-1">
        {contractsWaiting.length === 1
          ? `${contractsWaiting[0].title?.trim() || 'A contract'} is waiting for you.`
          : `${contractsWaiting.length} contracts are waiting for you.`}
      </h2>
      <p className="text-[13px] text-green-900/75 mb-3">
        You can read and sign it now, or finish what's below first — it will still be there.
      </p>
      <div className="flex flex-wrap gap-2">
        {contractsWaiting.map((c) => (
          <Link key={c.document_id} to={`/app/contracts/${c.document_id}/start`}
            className="btn-outline-gold text-xs">
            Open {c.title?.trim() || 'the contract'} <ArrowRight size={14} />
          </Link>
        ))}
      </div>
    </section>
  ) : null;

  /* ⚠️ TASK-FIX4 §7 — A BACK CONTROL ON EVERY STEP OF THIS FLOW, CR-53's
     top-left. Owner (CR-83): *"we need to allow them to go back … so they can
     revise our normalization prior to signing."*

     MEASURED BEFORE THIS TASK: eight steps, TWO `Back` controls — one on the
     *done* screen pointing at the dashboard, one inside the horse sub-flow — and
     ⚠️ **from `sign` there was NO route back to the field holding the name.**
     That is what made §4's normalisation unsafe and §5's exact gate a dead end.

     The order is the SAME list `Steps` renders, so a step that is skipped for
     this person is skipped going backwards too — a rider with no horse never
     lands on the horse step by pressing Back. */
  const showHorseStep = step === 'horse' || (state?.horse_needed ?? false);
  /* ⚠️ A STEP LIST THAT GROWS AS YOU WALK IT IS NOT A STEP LIST. These used to be
     derived from whether the catalog had loaded and whether an order existed yet,
     so the self-serve header opened saying "details · sign · done" and quietly
     grew two more steps later — which is both a worse thing to read and a false
     statement of what is ahead of them. On the self-serve door every one of
     CR-98's steps is certain from the first render, so it is stated from the
     first render. */
  const showShopStep = selfServe || step === 'shop';
  const showSlotsStep = step === 'slots' || standing.length > 0;
  const showTimeStep = selfServe;
  // ⚠️ ONE list, shared with the header (see `wizardSteps`). A step this person
  // never sees going forward is never landed on going backwards either.
  const visibleSteps: Step[] = wizardSteps({
    showHorse: showHorseStep,
    showOrder: Boolean(state?.purchase?.purchase_id) && !selfServe,
    showSlots: showSlotsStep,
    showShop: showShopStep,
    showTime: showTimeStep,
    selfServe,
  }).map((x) => x.id);
  const backTarget = (() => {
    // ⚠️ THE REQUEST IS SENT. Going back would offer to send a second one, and
    // `submit_my_booking_request` refuses that — a Back button onto a refusal.
    if (step === 'done' && requestSent) return null;
    const i = visibleSteps.indexOf(step);
    return i > 0 ? visibleSteps[i - 1] : null;
  })();

  return (
    <div className="max-w-3xl">
      {/* ⚠️ TOP-LEFT, above everything, on every step. On the first step it leaves
          the flow rather than disappearing — a control that is sometimes absent
          is a control people stop looking for. Nothing is lost either way: the
          details form is persisted (§6). */}
      <div className="mb-3">
        {backTarget
          ? <BackControl label="Back" onClick={() => setStep(backTarget)} />
          : <BackControl to="/app/dashboard" label="Back to your dashboard" />}
      </div>
      <p className="eyebrow mb-2">Welcome aboard</p>
      <h1 className="heading-section text-green-800 mb-6">Let's get you set up.</h1>
      {contractBanner}
      <Steps
        current={step}
        showHorse={showHorseStep}
        showOrder={Boolean(state?.purchase?.purchase_id) && !selfServe}
        showSlots={showSlotsStep}
        showShop={showShopStep}
        showTime={showTimeStep}
        selfServe={selfServe}
      />

      {/* ── §C9: Your order ─────────────────────────────────────────────── */}
      {step === 'order' && state?.purchase?.purchase_id && (
        <ActivationOrderPanel
          purchaseId={state.purchase.purchase_id}
          onContinue={() => setStep('details')}
        />
      )}

      {/* ── Step 1: Your details ─────────────────────────────────────────── */}
      {step === 'details' && (
        <form onSubmit={saveDetails} className="bg-white border border-green-800/10 p-8">
          <div className="flex items-start justify-between gap-3 mb-1">
            <h2 className="font-serif text-lg text-green-900">Your details</h2>
            {/* ⚠️ TASK-FIX4 §3 — *"we need to show auto-save so the user knows the
                inputs are saved."* Nothing here is submitted until Continue; this
                says the typing is SAFE, which is a different promise. */}
            <AutoSaveIndicator status={draft.status} savedLabel="Saved on this device" />
          </div>
          <p className="text-sm text-muted mb-6">
            These fill in your lesson paperwork — you'll review and sign it next.
            {draft.restored && ' We put back what you had already typed.'}
          </p>

          {/* ── SIGNDOOR / FIX1 §A — THE QUESTION, ABOVE THE NAME FIELDS ─────
              It sits first because it decides what every field below means. Two
              radios, NO DEFAULT: an unanswered question is refused rather than
              assumed, because assuming "me" is the defect. `horse` and `deal`
              never render it — the owner ruled a horse owner must be 18+. */}
          {asksMinor && (
            <fieldset className="mb-6 border border-green-800/10 p-4">
              <legend className="form-label px-2">{minorCopy.question} *</legend>
              <div className="flex flex-col gap-2">
                {([['self', minorCopy.self], ['child', minorCopy.child]] as const).map(([value, label]) => (
                  <label key={value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="ob-signing-for"
                      className="mt-1"
                      value={value}
                      checked={signingFor === value}
                      onChange={() => setSigningFor(value)}
                    />
                    <span className="body-text text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {/* The heading appears ONLY once "my child" is chosen. Without it the
              two name blocks are indistinguishable, which is the whole problem
              this fix exists to solve. */}
          {isForChild && (
            <>
              <h3 className="form-label mb-1">Your details</h3>
              <p className="text-sm text-muted mb-4">
                You are the account holder — the person we email, invoice and hold
                to the agreement. You will sign the paperwork.
              </p>
            </>
          )}

          {needsName && (
            <>
              <h3 className="form-label mb-3">Your name</h3>
              <p className="text-sm text-muted mb-3">This is the name that appears on your documents.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="form-label" htmlFor="ob-first">
                    {isForChild ? 'Your first name' : 'First name'}
                  </label>
                  {/* ⚠️ TASK-FIX4 §4 — normalised ON BLUR, in front of them, and
                      revisable: this is the name the signature will attest to. */}
                  <input id="ob-first" required className="form-input" value={firstName}
                    autoComplete="given-name" onChange={(e) => setFirstName(e.target.value)}
                    onBlur={normalize('ob-first', 'name', firstName, setFirstName)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ob-last">
                    {isForChild ? 'Your last name' : 'Last name'}
                  </label>
                  <input id="ob-last" required className="form-input" value={lastName}
                    autoComplete="family-name" onChange={(e) => setLastName(e.target.value)}
                    onBlur={normalize('ob-last', 'name', lastName, setLastName)} />
                </div>
              </div>
            </>
          )}

          {/* ── FIX1 §A — THE RIDER'S DETAILS ───────────────────────────────
              A separate, LABELLED block, so there is no longer one name box doing
              two jobs. The child is the non-signing PARTICIPANT; the person above
              signs. Date of birth is required here because it is the fact that
              makes them a minor — and because generate_my_onboarding_documents
              merges it into the release. */}
          {isForChild && (
            <fieldset className="mb-6 border border-green-800/10 p-4">
              <legend className="form-label px-2">The rider&apos;s details</legend>
              <p className="body-text text-sm text-muted mb-4">
                Your child rides; they do not sign. Their name goes on the paperwork
                as the participant, and yours goes on it as the person agreeing to it.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="form-label" htmlFor="ob-minor-first">Child&apos;s first name</label>
                  <input id="ob-minor-first" required className="form-input" value={minorFirst}
                    onChange={(e) => setMinorFirst(e.target.value)} autoComplete="off"
                    onBlur={normalize('ob-minor-first', 'name', minorFirst, setMinorFirst)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ob-minor-last">Child&apos;s last name</label>
                  <input id="ob-minor-last" required className="form-input" value={minorLast}
                    onChange={(e) => setMinorLast(e.target.value)} autoComplete="off"
                    onBlur={normalize('ob-minor-last', 'name', minorLast, setMinorLast)} />
                </div>
                <div>
                  <label className="form-label" htmlFor="ob-minor-dob">Child&apos;s date of birth</label>
                  <input id="ob-minor-dob" type="date" required className="form-input" value={minorDob}
                    onChange={(e) => setMinorDob(e.target.value)} />
                  {/* Live, at the field, and only once a full date is present. */}
                  {minorDob.trim() !== '' && !isUnder18(minorDob) && (
                    <p role="alert" className="form-error mt-1 text-sm">
                      That date of birth is 18 or older. An adult rider signs up in
                      their own name — choose &ldquo;Me&rdquo; above.
                    </p>
                  )}
                </div>
              </div>
            </fieldset>
          )}

          <h3 className="form-label mb-3">Contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <div className="mb-4">
              {/* ⚠️ "Phone" WAS THE MOBILE NUMBER ALL ALONG. Owner, 2026-08-24:
                  "we should be collecting the mobile number on intake not a
                  'contact number for phone calls', there is no difference with
                  mobile." Same column, honest label. */}
              <label className="form-label" htmlFor="ob-phone">Mobile number</label>
              <input id="ob-phone" type="tel" inputMode="tel" required className="form-input"
                value={form.phone} onChange={upd('phone')}
                onBlur={normalize('ob-phone', 'phone', form.phone, (v) => setForm((f) => ({ ...f, phone: v })))}
                placeholder={form.phone ? undefined : '(555) 555-5555'} />
              {!form.phone && (
                <p className="text-xs text-muted mt-1">
                  We don&apos;t have a number for you yet — this is the one we&apos;ll call and text.
                </p>
              )}
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="ob-dob">Date of birth</label>
              <input id="ob-dob" type="date" required className="form-input" value={form.date_of_birth} onChange={upd('date_of_birth')} />
            </div>
          </div>
          {/* The alternate, and how they'd rather be reached. Both optional —
              "the only difference is if they want to add an alternate number for
              texts only" (owner), so this asks rather than assumes. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-2">
            <div className="mb-4">
              <label className="form-label" htmlFor="ob-text-phone">
                Texts-only number <span className="text-muted font-normal">(optional)</span>
              </label>
              <input id="ob-text-phone" type="tel" inputMode="tel" className="form-input"
                value={form.text_only_phone} onChange={upd('text_only_phone')}
                placeholder="A different number for texts" />
            </div>
            <div className="mb-4">
              <label className="form-label" htmlFor="ob-preferred">
                How should we reach you? <span className="text-muted font-normal">(optional)</span>
              </label>
              <select id="ob-preferred" className="form-input"
                value={form.preferred_contact} onChange={upd('preferred_contact')}>
                <option value="">No preference</option>
                <option value="TEXT">Text</option>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
              </select>
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
          <div className="flex flex-wrap items-center gap-4">
            {/* ⚠️ CONTINUE IS THE AFFIRMATIVE ACTION — the only thing here that
                commits. Clear form discards the draft deliberately; the two are
                not the same act and are deliberately not the same control. */}
            {/* ⚠️ A button that invites a click it will refuse is its own defect
                (owner, 2026-08-24). The minor conditions join the name one for the
                same reason FIX1 added them to the door's button. */}
            <button type="submit"
              disabled={saving
                || (needsName && (!firstName.trim() || !lastName.trim()))
                || (asksMinor && signingFor === null)
                || (isForChild && (!minorNamesFilled || !minorDobValid))}
              className="btn-primary">
              {saving ? 'Saving…' : 'Save & continue to documents'}
              {!saving && <ArrowRight size={16} />}
            </button>
            <button type="button" onClick={clearDetailsForm}
              className="text-[12.5px] text-green-800/70 hover:text-green-900 underline underline-offset-2 focus-ring rounded">
              Clear form
            </button>
          </div>
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
              {/* §C10b — ask before prefilling, and only from `client_horse`. */}
              {horsePrefill === null ? (
                <SameHorseAsk onAnswered={setHorsePrefill} />
              ) : (
                <HorseIntakeForm submitLabel="Save &amp; continue" prefill={horsePrefill}
                  onDone={(id) => void horseCompleted(id)} />
              )}
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
              {/* ⚠️ TASK-FIX4 §5 — EXACT, CASE AND ALL, and it is a feature: this is
                  the last moment a wrong name is visible to the person it belongs
                  to. The typed box is deliberately NOT normalised on blur — we do
                  not get to help them past their own signature. */}
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
                    aria-describedby={nameMismatch ? 'ob-typed-name-hint' : undefined}
                    onChange={(e) => setTypedName(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn-sign" disabled={!nameMatches || !esignConsent || signing}>
                  {signing ? 'Signing…' : 'Sign'}
                </button>
              </form>
              {/* ⚠️ WHAT FIX1 WAS ACTUALLY MISSING. Its complaint was a disabled
                  button with nothing on screen to say why — answered by SAYING it,
                  not by widening the rule. And the way out is named: the name is
                  editable one step back. */}
              {nameMismatch && (
                <p id="ob-typed-name-hint" className="text-xs text-gold-900 mt-2">
                  That doesn’t match <span className="font-medium">{expectedName}</span> exactly —
                  capitals count. If the printed name is wrong,{' '}
                  <button type="button" className="underline underline-offset-2 focus-ring rounded"
                    onClick={() => setStep('details')}>go back and correct it</button>{' '}
                  before you sign.
                </p>
              )}
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

      {/* ── The shop — the evaluation lesson first ───────────────────────────
          Owner, 2026-08-24: the evaluation lesson "should be highlighted with a
          gold outline so they know that is the first thing to look at and it
          clearly states that its the first thing they do... we can gate it so the
          others are not selectable and slightly grayed out but still very
          readable, the evaluation lesson is the first purchase and when they
          select it the other options become selectable so it indicates they can
          still add more things."

          GREYED, NOT HIDDEN, and readable — the point of showing the rest is that
          they can see what they are unlocking. `opacity-60` keeps body text above
          contrast on cream; the cheaper trick (opacity-40) does not. */}
      {step === 'shop' && (() => {
        const evaluation = shopOfferings.find(isEvaluationOffering);
        const evaluationPicked = !!evaluation && shopPicked.includes(evaluation.id);
        // Nothing is locked when the catalog has no evaluation lesson to require.
        const locked = !!evaluation && !evaluationPicked;
        const toggle = (id: string) => setShopPicked((prev) =>
          prev.includes(id)
            // Dropping the evaluation drops everything: it is the prerequisite,
            // so leaving the extras selected would sell a set we just said is
            // not orderable.
            ? (evaluation && id === evaluation.id ? [] : prev.filter((x) => x !== id))
            : [...prev, id]);
        const money = (n: number | null) => n == null ? ''
          : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2 })}`;

        return (
          <section aria-labelledby="ob-shop-heading">
            <h2 id="ob-shop-heading" className="font-serif text-lg text-green-900 mb-1">
              Your first lesson
            </h2>
            {/* ⚠️ TWO PROMISES, AND ONLY ONE IS TRUE PER DOOR. The old sentence —
                "we'll be in touch to schedule your first lesson" — was written when
                this step led to payment and staff booked the first pass for them
                (owner, 2026-08-24). On the self-serve door they choose their own
                time on the very next screen, so saying we will do it for them is
                now false, and the kind of false that produces two lessons. */}
            <p className="text-sm text-muted mb-5">
              {selfServe ? (
                <>
                  Your paperwork is signed. Choose what you&apos;d like, and you&apos;ll
                  pick a day and time on the next screen.
                </>
              ) : (
                <>
                  Your paperwork is signed. Choose what you&apos;d like to book — we&apos;ll be
                  in touch to schedule your first lesson, and after that you can pick your own
                  times on the Calendar.
                </>
              )}
            </p>
            {shopError && <p role="alert" className="form-error mb-4">{shopError}</p>}

            <div className="flex flex-col gap-3 mb-6">
              {[...shopOfferings]
                .sort((a, b) => (isEvaluationOffering(b) ? 1 : 0) - (isEvaluationOffering(a) ? 1 : 0)
                  || (a.price_amount ?? 0) - (b.price_amount ?? 0))
                .map((o) => {
                  const isEval = isEvaluationOffering(o);
                  const picked = shopPicked.includes(o.id);
                  const disabled = locked && !isEval;
                  return (
                    <button key={o.id} type="button" disabled={disabled}
                      onClick={() => toggle(o.id)}
                      aria-pressed={picked}
                      className={`text-left rounded-lg border p-4 transition-all focus-ring ${
                        picked ? 'border-green-700 bg-green-50'
                        : isEval ? 'border-2 border-gold-600 bg-gold-50/40 hover:bg-gold-50'
                        : disabled ? 'border-green-800/15 bg-white opacity-60 cursor-not-allowed'
                        : 'border-green-800/15 bg-white hover:border-green-800/40'}`}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-[15px] text-green-900 font-medium">
                            {o.name}
                            {isEval && (
                              <span className="ml-2 align-middle text-[10px] uppercase tracking-wide
                                               text-gold-900 bg-gold-200 rounded-full px-2 py-0.5">
                                Start here
                              </span>
                            )}
                          </span>
                          {isEval ? (
                            <span className="block text-[12.5px] text-gold-900 mt-1">
                              Everyone&apos;s first lesson is an evaluation — it&apos;s how we get
                              to know your riding. Book this first; everything else opens up once
                              you do. Allow an extra 30 minutes: arrive 15 minutes early, and the
                              lesson runs 15 minutes longer than usual.
                            </span>
                          ) : (
                            <span className="block text-[12.5px] text-muted mt-1">
                              {o.tagline || (disabled ? 'Available once your evaluation lesson is added' : '')}
                            </span>
                          )}
                        </span>
                        <span className="text-green-900 whitespace-nowrap">{money(o.price_amount)}</span>
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary text-sm"
                disabled={shopPicked.length === 0 || shopBusy} onClick={() => void buyPicked()}>
                {shopBusy ? 'Setting up…' : selfServe ? 'Continue' : 'Continue to payment'}
              </button>
              {/* "they can also just exit the shopping and we can provision for
                  them" — leaving is a real answer, not an escape hatch. */}
              <button type="button" className="text-sm text-muted underline underline-offset-2"
                onClick={() => setStep('done')}>
                Skip for now — we&apos;ll set it up with you
              </button>
            </div>
          </section>
        );
      })()}

      {/* ── Step 3: Payment (sign-before-pay; Zelle at launch) ───────────── */}
      {step === 'payment' && (
        <section aria-labelledby="ob-pay-heading">
          <h2 id="ob-pay-heading" className="font-serif text-lg text-green-900 mb-3">Payment</h2>
          {/* PAYLOCK: this used to read "Complete payment to confirm your
              booking" — a gate the system does not have. Nothing that writes a
              booking reads payment state, and this very step ships an "I'll pay
              later — finish" bypass, so the old sentence contradicted both the
              database and the button beneath it. */}
          {/* ⚠️ TWO DIFFERENT PROMISES, AND ONLY ONE OF THEM IS TRUE PER PATH.
              Owner, 2026-08-24: on the self-onboarding pass "we skip booking, we
              handle the booking step for them on this first pass, from then on
              they can use the calendar." Sending someone to the Calendar for a
              lesson we have already undertaken to schedule is how they end up
              with two. */}
          <p className="text-sm text-muted mb-6">
            {weBookThisOne ? (
              <>
                Your documents are signed and your lesson is reserved — the last step is
                payment. Send it below, or finish now and pay later; either way{' '}
                <strong className="text-green-900">we&apos;ll be in touch to schedule this
                first lesson with you</strong>. After that you can pick your own times on
                the <Link to="/app/calendar" className="text-green-800 underline">Calendar</Link>.
              </>
            ) : (
              <>
                Your documents are signed — the last step is payment. Send it below, or
                finish now and pay later; either way you can book your sessions on the{' '}
                <Link to="/app/calendar" className="text-green-800 underline">Calendar</Link>.
              </>
            )}
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
            onClick={finishPayment}
          >
            I'll pay later — finish
          </button>
        </section>
      )}

      {/* ── CR-98 step 6: pick a day and a time ──────────────────────────
          Owner: *"then pick a day and time from the calendar."* ⚠️ D25 — the
          word "booking" never appears; a rider is told about their Riding
          Lesson. The full month grid is `CalendarPage`'s job and stays there;
          what this step owes is the two answers that make a request. */}
      {step === 'time' && (
        <section aria-labelledby="ob-time-heading">
          <h2 id="ob-time-heading" className="font-serif text-lg text-green-900 mb-1">
            When would you like to come?
          </h2>
          <p className="text-sm text-muted mb-5">
            Pick the day and time that suit you. We&apos;ll confirm it with you — if it
            doesn&apos;t work we&apos;ll suggest another, and you can always change it later
            from your <Link to="/app/calendar" className="text-green-800 underline">Calendar</Link>.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 mb-5">
            <label className="block">
              <span className="form-label">Day</span>
              <input type="date" className="form-input" value={timeDate}
                min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}
                onChange={(e) => setTimeDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="form-label">Time</span>
              <input type="time" className="form-input" step={900} value={timeClock}
                onChange={(e) => setTimeClock(e.target.value)} />
            </label>
          </div>

          <label className="block mb-5">
            <span className="form-label">How long</span>
            <select className="form-input" value={timeMinutes}
              onChange={(e) => setTimeMinutes(e.target.value)}>
              <option value="60">1 hour</option>
              <option value="90">1 hour 30 minutes</option>
              <option value="120">2 hours</option>
            </select>
          </label>

          <label className="block mb-6">
            <span className="form-label">Anything we should know? (optional)</span>
            <textarea className="form-input" rows={3} value={timeNote}
              onChange={(e) => setTimeNote(e.target.value)}
              placeholder="Other times that work for you, questions, anything at all." />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary text-sm"
              disabled={!requestedStart}
              onClick={() => setStep('submit')}>
              Continue <ArrowRight size={16} />
            </button>
            {/* Never a trap (the same rule the slot step follows): staff will
                reach out and set the time with them. */}
            <button type="button" className="text-sm text-muted underline underline-offset-2"
              onClick={() => setStep('done')}>
              I&apos;d rather you picked — get in touch with me
            </button>
          </div>
        </section>
      )}

      {/* ── CR-98 step 7: send the request ───────────────────────────────
          ⚠️ D19 — it STATES ITSELF BEFORE IT ACTS. Everything the request will
          contain is on screen, and the last line says plainly that no money
          moves, because the whole point of this flow is that payment comes
          after we say yes. D34: this button is the only thing that sends it. */}
      {step === 'submit' && (
        <section aria-labelledby="ob-submit-heading">
          <h2 id="ob-submit-heading" className="font-serif text-lg text-green-900 mb-1">
            Ready to send?
          </h2>
          <p className="text-sm text-muted mb-5">
            Here is what we&apos;ll receive. Nothing is booked and nothing is charged until
            we come back to you.
          </p>
          {submitError && <p role="alert" className="form-error mb-4">{submitError}</p>}

          <div className="bg-white border border-green-800/10 p-6 mb-6">
            <h3 className="text-[13px] uppercase tracking-wide text-muted mb-2">What you chose</h3>
            <ul className="mb-5">
              {(order?.items ?? []).map((it) => (
                <li key={it.id} className="flex justify-between gap-4 text-[15px] text-green-900 py-1">
                  {/* The shop step buys one of each, and `OrderItem` (the app's
                      own read shape) carries no quantity — so there is none to
                      render, and inventing one here would be a second answer to
                      a question `purchase_items` already owns. */}
                  <span>{it.label}</span>
                  <span className="whitespace-nowrap">
                    {it.price_amount == null ? '' : `$${Number(it.price_amount).toLocaleString('en-US')}`}
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="text-[13px] uppercase tracking-wide text-muted mb-2">When you asked for</h3>
            <p className="text-[15px] text-green-900">
              {requestedLabel || 'No time chosen'}
              {requestedStart && <> · {timeMinutes} minutes</>}
            </p>
            {timeNote.trim() && (
              <p className="text-[13px] text-green-900/75 mt-3 whitespace-pre-line">{timeNote.trim()}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary"
              disabled={submitting || !requestedStart || !order}
              onClick={() => void sendBookingRequest()}>
              {submitting ? 'Sending…' : 'Send my request'} <ArrowRight size={16} />
            </button>
            <button type="button" className="text-sm text-muted underline underline-offset-2"
              onClick={() => setStep('time')}>
              Change the time
            </button>
          </div>
        </section>
      )}

      {step === 'slots' && (
        <StandingSlotStep
          slots={standing}
          onReload={() => void reloadStanding()}
          onFinished={() => {
            // the summary card on the last step names the slot they just chose
            void reloadStanding().finally(() => setStep('done'));
          }}
        />
      )}

      {/* ── Step 4: You're all set ───────────────────────────────────────── */}
      {step === 'done' && (
        <section aria-labelledby="ob-done-heading">
          <div className="bg-green-50 border border-green-200 p-6 mb-6">
            {/* ⚠️ CR-98 §THE TELL — the last screen says the request was SENT.
                It must not say anything is paid or booked, because neither is
                true and both are what the person will remember. */}
            <h2 id="ob-done-heading" className="font-serif text-xl text-green-800 mb-1 inline-flex items-center gap-2">
              <Check size={20} aria-hidden="true" />
              {requestSent ? 'Your request is with us.' : "You're all set."}
            </h2>
            {requestSent && (
              <p className="body-text text-sm mb-2">
                We have {requestedLabel ? <strong>{requestedLabel}</strong> : 'your request'} and
                what you&apos;d like to book. <strong>Nothing is confirmed and nothing is
                charged yet</strong> — we&apos;ll come back to you to agree the time, and payment
                comes after that. Changed your mind? Tell us and we&apos;ll drop it.
              </p>
            )}
            {/* Only claim delivery when it actually succeeded. In every case the
                signed documents are recorded and available — that part is true
                unconditionally, so the fallback copy stays reassuring. */}
            <p className="body-text text-sm">
              {emailed === true ? (
                <>
                  {requestSent
                    ? <>We&apos;ve emailed you one message with copies of everything you signed,
                        your order and this request. They&apos;re always available on your
                        Documents page too.</>
                    : <>Copies of everything you signed have been emailed to you, and they&apos;re
                        always available on your Documents page.</>}
                </>
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
              standing={standing}
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
