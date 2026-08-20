import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft, Gift } from 'lucide-react';
import { formatPrice } from '../lib/pricing';
import { fetchPublicCatalog, type ServiceGroup } from '../lib/publicCatalog';
import { useCart } from '../contexts/CartContext';
import ServiceSelector from '../components/ServiceSelector';
import ServiceListState from '../components/ServiceListState';
import QuestionSections from '../components/QuestionSections';
import InquiryForm from '../components/InquiryForm';
import ContinueShoppingModal from '../components/ContinueShoppingModal';
import { cartHasQuestions } from '../lib/questionSets';
import Seo from '../components/Seo';
import SelectionBar from '../components/SelectionBar';
import { seoForPath } from '../lib/seo';

// Horse-care service_type codes used to gate the horse-care cross-sell note.
const HORSE_CARE_CODES = ['HORSE_TRAINING', 'HORSE_EXERCISE', 'HORSE_CLIPPING'];

/**
 * THE ACQUISITION FUNNEL — CLOSEOUT §3.1 (CAREPATH G4): the same fix CAREPATH
 * applied to BookHorse, in this lane.
 *
 * ⚠️ THE STEP COUNT IS DERIVED, NEVER HARDCODED. Until 2026-08-19 this page
 * declared three steps, printed "Step 3 of 3" on the review screen, and then
 * navigated to `/checkout` — a FOURTH screen the tracker never admitted to.
 * The back control also read "Previous", which appears nowhere else.
 *
 * There are now three pages, and the third IS the submission:
 *   1. Select Services
 *   2. Your Situation    — the questions, and ONLY when the cart asks something
 *   3. Your Details      — selections + Continue Shopping + the shared form
 */
const SELECT_STEP = { id: 'select', label: 'Select Services' } as const;
const QUESTIONS_STEP = { id: 'questions', label: 'Your Situation' } as const;
const DETAILS_STEP = { id: 'details', label: 'Your Details' } as const;

const SEO = seoForPath('/acquisition')!;

export default function BookSupport() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, itemCount } = useCart();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  // COUNTFIX 1.5: a failed fetch and an empty catalog looked identical — both
  // rendered a blank selection area with no explanation and a dead "Continue".
  // Distinguish the three states (the pattern Lessons.tsx already uses).
  const [catalogState, setCatalogState] = useState<'loading' | 'error' | 'ready'>('loading');

  useEffect(() => {
    setFunnel('support');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);
  useEffect(() => {
    fetchPublicCatalog('acquisition')
      .then((g) => { setGroups(g); setCatalogState('ready'); })
      .catch(() => { setGroups([]); setCatalogState('error'); });
  }, []);

  const anyHorseCareSelected = state.items.some(
    (i) => i.serviceType && HORSE_CARE_CODES.includes(i.serviceType));

  // ASKRIGHT — the questions step exists when something in the CART asks
  // something, never because of which page this is.
  const hasQuestions = cartHasQuestions(state.items);
  const STEPS = hasQuestions
    ? [SELECT_STEP, QUESTIONS_STEP, DETAILS_STEP]
    : [SELECT_STEP, DETAILS_STEP];
  const total = STEPS.length;
  // Clamp: emptying the cart on the last page can shorten the list underneath us.
  const current = Math.min(step, total - 1);
  const stage = STEPS[current].id;

  const canProceedStep0 = itemCount > 0;
  /** Is the floating SelectionBar carrying the Continue right now? Mirrors both
   *  of its render conditions: this page only mounts it on step 0, and the bar
   *  itself returns null while nothing is selected. */
  const barHasIt = step === 0 && itemCount > 0;

  function handleNext() {
    if (current < total - 1) {
      setStep(current + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleBack() {
    if (current > 0) {
      setStep(current - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  }

  return (
    <>
      <Seo title={SEO.title} description={SEO.description} path="/acquisition" service={SEO.service} />
    {/* pb-36: room for the floating SelectionBar so it can never cover the
        last card (the bar is ~80px incl. safe-area). */}
    <div className="min-h-screen bg-cream pt-24 pb-36">
      {/* Owner, 2026-08-16: was max-w-3xl (768px) — a "skinny screen" width, and
          with three columns it left only ~250px of text per card, which is what
          broke the italic taglines into one word per line. This page carries the
          widest content on the site (three vertical cards side by side), so it
          takes container-site's own max-w-7xl: ~325px of text per column. */}
      <div className="container-site">

        {/* Step indicator — reads the DERIVED list, so it can never claim a
            page that will not be shown. */}
        <div className="mb-12">
          <ol className="flex items-center gap-3 mb-6">
            {STEPS.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3">
                <div
                  aria-current={i === current ? 'step' : undefined}
                  className={i < current ? 'step-complete' : i === current ? 'step-active' : 'step-inactive'}
                >
                  {i < current ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs font-sans tracking-wide hidden sm:block ${
                  i === current ? 'text-green-800 font-medium' : 'text-muted'
                }`}>
                  {s.label}
                </span>
                {i < total - 1 && (
                  <div className="w-8 h-px bg-green-800/15 hidden sm:block" />
                )}
              </li>
            ))}
          </ol>
          <div className="rule-gold" />
        </div>

        {/* Step 1: Select Services */}
        {stage === 'select' && (
          <div>
            <p className="eyebrow mb-3">Step 1 of {total}</p>
            <h1 className="heading-section text-green-800 mb-3">Acquisition Support Services</h1>
            <p className="body-text mb-10">
              Finding the right horse is one of the most significant decisions in an equestrian's life. Our support services provide expert guidance at each stage — from the first search to the final handshake.
            </p>
            {/* Owner, 2026-08-16: "a progressive approach from left to right, not
                from top to bottom which signals escalation and impossible to see
                all at one time." Each acquisition service is its own group with a
                single offering, so stacking them read as tiers. Three columns on
                desktop puts them side by side as parallel choices, all visible at
                once; they stack on phones, where there is no other option. */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">
              {catalogState !== 'ready' || groups.length === 0 ? (
                <ServiceListState
                  state={catalogState === 'ready' ? 'empty' : catalogState}
                  emptyLead="Our acquisition services are arranged personally rather than booked online. Tell us what you are looking for and we will guide the search from there."
                />
              ) : (
                groups.map((g) => (
                  <ServiceSelector key={g.code} group={g} category="Acquisition Support" />
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: the questions the CART implies. */}
        {stage === 'questions' && (
          <div>
            <p className="eyebrow mb-3">Step 2 of {total}</p>
            <h1 className="heading-section text-green-800 mb-3">Your Situation</h1>
            <p className="body-text mb-10">
              A few questions help us shape the right experience for you — and ensure we recommend only what is genuinely relevant.
            </p>

            {/* Until 2026-08-17 this step asked every acquisition buyer how many
                horses they were considering buying — including someone booking
                an evaluation on a horse they already own. `how_many_horses` and
                `wants_lessons` are DELETED (owner-confirmed): the first is
                rarely actionable, and the second is replaced by Continue
                Shopping, which turns the same intent into a real cart line
                rather than a recorded intention. */}
            <QuestionSections />
          </div>
        )}

        {/* Step 3 (or 2): YOUR DETAILS — the submission page. The old Review
            screen's summary and cross-sell note live here, followed by the ONE
            shared form; there is no /checkout hand-off any more. */}
        {stage === 'details' && (
          <div>
            <p className="eyebrow mb-3">Step {total} of {total}</p>
            <h1 className="heading-section text-green-800 mb-3">Your Details</h1>
            <p className="body-text mb-8">
              Tell us who you are and we will call to talk through your search and
              how we can support it.
            </p>

            {/* 1 — the selection summary */}
            <div className="bg-white border border-green-800/10 p-8 mb-6">
              <p className="eyebrow mb-5">Your Selection</p>
              {state.items.length === 0 ? (
                <p className="text-sm font-sans text-muted italic">No services selected yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-green-800/[0.08]">
                  {state.items.map((item) => (
                    <div key={item.offeringId} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-sans font-medium text-green-900">{item.offeringName}</p>
                      </div>
                      <p className={`text-sm font-serif font-medium text-green-800${item.priceOnEnquiry ? ' italic' : ''}`}>
                        {item.priceOnEnquiry ? 'Price on inquiry' : formatPrice(item.price, item.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 2 — Continue Shopping. Secondary styling: the primary path on
                  this page is the submit, and there must be exactly one of
                  those. The cart survives the jump. */}
              <div className="mt-6 pt-6 border-t border-green-800/[0.08]">
                <button
                  type="button"
                  className="btn-outline-gold text-sm"
                  onClick={() => setShopOpen(true)}
                >
                  Continue Shopping
                </button>
                <p className="text-xs font-sans text-muted mt-2">
                  Add lessons or horse care — your selections stay in your inquiry.
                </p>
              </div>
            </div>

            {/*
              Cross-sell gating (per ux-synthesis): within the support funnel, only
              evaluation follows search and only brokering follows evaluation. Horse
              CARE cross-sells (training, turnout, clipping) and rider lessons are NOT
              shown here — they belong post-acquisition, not in this booking flow.
              The only in-funnel guidance is the natural search→evaluation→brokering path.
            */}
            {!anyHorseCareSelected && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-3">
                  What happens after you reach out
                </p>
                <p className="text-sm font-sans text-secondary">
                  Once we have spoken and understood what you are looking for, we guide the
                  search, the evaluation, and the brokering as one continuous process. If
                  lessons, training, or care become relevant after your horse is home, we will
                  raise them then — there is no need to decide any of that now.
                </p>
              </div>
            )}

            {/* 3 + 4 — the ONE shared form, and its inquiryLabel() submit. */}
            <InquiryForm onSubmitted={() => navigate('/confirmation')} />
          </div>
        )}

        {/* Navigation. The back control reads "Back" on every step past the
            first — "Previous" appears nowhere in this funnel. On the submission
            page the form's own submit is the single way forward, so no
            competing primary is rendered. */}
        <div className={`flex items-center justify-between mt-12 pt-8 border-t border-green-800/10 ${
          stage === 'details' ? 'justify-start' : ''
        }`}>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring"
          >
            <ArrowLeft size={16} />
            {current === 0 ? 'Back to Services' : 'Back'}
          </button>

          {/* Merge resolution 2026-08-20: main had refactored `step` into the
              derived `stage`, while task/partyrole added the SelectionBar
              stand-down on the older `step` model. Both intents kept — main's
              stage-based conditions, partyrole's `!barHasIt` guard. */}
          {stage !== 'details' && (
            <div className="flex items-center gap-6">
              {/* TASK-GIFTPATH — reachable from acquisition, not just lessons. */}
              {stage === 'select' && (
                <Link to="/gift?item=acquisition" className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring">
                  <Gift size={15} aria-hidden="true" />
                  Gift our services to the horse lover in your life
                </Link>
              )}
              {/* Stands down while the floating SelectionBar is carrying the
                  Continue (owner, 2026-08-17) — see BookRider for the full note.
                  With nothing selected the bar is null, so this stays as the
                  disabled affordance that says a next step exists. */}
              {!barHasIt && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={current === 0 ? !canProceedStep0 : false}
                  className="btn-primary"
                >
                  {stage === 'questions' ? 'Continue to Submit Inquiry' : 'Continue'}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          )}
        </div>

        {stage === 'select' && !canProceedStep0 && (
          <p className="text-xs font-sans text-center text-muted mt-3">
            Select at least one service to continue.
          </p>
        )}
      </div>
    </div>

    {/* Floating selection bar — step 1 only, where the choosing happens. It
        calls handleNext, the SAME handler the page's own Continue button uses,
        so there is one path forward, not two, and it does not render on the
        submission page. */}
    {stage === 'select' && <SelectionBar onContinue={handleNext} disabled={!canProceedStep0} />}

    <ContinueShoppingModal open={shopOpen} onClose={() => setShopOpen(false)} />
    </>
  );
}
