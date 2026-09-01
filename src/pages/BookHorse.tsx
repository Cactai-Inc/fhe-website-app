import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, Gift } from 'lucide-react';
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
import { BackControl } from '../components/app/BackControl';

/**
 * THE HORSE-CARE FUNNEL — CAREPATH §C1/§C1b/§C2.
 *
 * ⚠️ THE STEP COUNT IS DERIVED, NEVER HARDCODED. Until 2026-08-17 this page
 * declared three steps, printed "Step 3 of 3" on the review screen, and then
 * navigated to `/checkout` — a FOURTH screen the tracker never admitted to, and
 * one that asked a horse owner how many years they had been riding.
 *
 * There are now three pages, and the third IS the submission:
 *   1. Select Services
 *   2. Tell Us More      — the questions, and ONLY when the cart asks something
 *   3. Your Details      — selections + Continue Shopping + the shared form
 *
 * Step 2 exists when something in the CART carries a question set (ASKRIGHT
 * §A0), so a cart holding only lesson items shows TWO steps and the tracker
 * counts two. The eyebrow, the circles and the labels all read the same derived
 * list, so they cannot disagree with each other.
 */
const SELECT_STEP = { id: 'select', label: 'Select Services' } as const;
const QUESTIONS_STEP = { id: 'questions', label: 'Tell Us More' } as const;
const DETAILS_STEP = { id: 'details', label: 'Your Details' } as const;

const SEO = seoForPath('/horse')!;

export default function BookHorse() {
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
    setFunnel('horse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);
  useEffect(() => {
    fetchPublicCatalog('horse')
      .then((g) => { setGroups(g); setCatalogState('ready'); })
      .catch(() => { setGroups([]); setCatalogState('error'); });
  }, []);

  // ASKRIGHT — step 2 exists when something in the CART asks something, never
  // because of which page this is. A cart holding only lesson items (picked on
  // /lessons, then wandered here) has nothing to ask, so the step is not just
  // skipped — it is not counted.
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
   *  of its render conditions: this page only mounts it in the 'select' stage,
   *  and the bar itself returns null while nothing is selected. */
  const barHasIt = stage === 'select' && itemCount > 0;

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
      <Seo title={SEO.title} description={SEO.description} path="/horse" service={SEO.service} />
    {/* pb-36: room for the floating SelectionBar so it can never cover the
        last card (the bar is ~80px incl. safe-area). */}
    <div className="min-h-screen bg-cream pt-24 pb-36">
      {/* Owner, 2026-08-16: this page read as "designed for a skinny screen".
          Cause: `container-site` is already max-w-7xl (1280px), and this
          max-w-3xl override cut it to 768px — narrower than a tablet in
          landscape. max-w-5xl (1024px) gives the cards room to sit side by side
          without the copy running to uncomfortable line lengths. */}
      <div className="container-site max-w-5xl">

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
            <h1 className="heading-section text-green-800 mb-3">Horse Care Services</h1>
            <p className="body-text mb-10">
              Select the services you need for your horse. Each option can be combined — we will tailor further recommendations once we understand your situation.
            </p>
            <div className="flex flex-col gap-8">
              {catalogState !== 'ready' || groups.length === 0 ? (
                <ServiceListState
                  state={catalogState === 'ready' ? 'empty' : catalogState}
                  emptyLead="Our horse care services are arranged personally rather than booked online. Tell us about your horse and we will take it from there."
                />
              ) : (
                groups.map((g) => (
                  <ServiceSelector key={g.code} group={g} category="Horse Care Services" />
                ))
              )}
            </div>
          </div>
        )}

        {/* Step 2: the questions the CART implies.
            Until 2026-08-17 this step was two hardcoded blocks asking every
            horse-care buyer what was "bringing them to our horse care services"
            and for how many months — so someone booking a single clip was asked
            whether they were travelling or recovering from an injury. Those two
            blocks now live in the HORSE_EXERCISE set, weekly SKUs only, which is
            the only place they were ever true. */}
        {stage === 'questions' && (
          <div>
            <p className="eyebrow mb-3">Step 2 of {total}</p>
            <h1 className="heading-section text-green-800 mb-3">Tell Us More</h1>
            <p className="body-text mb-10">
              A bit of context helps us ensure your horse is in the best possible hands.
            </p>

            <QuestionSections />
          </div>
        )}

        {/* Step 3 (or 2): YOUR DETAILS — the submission page.
            §C2's order is fixed: the selection summary, Continue Shopping, the
            shared form, then the inquiryLabel() submit. The old Review screen is
            gone; its summary is the block below.

            ⚠️ The "That's everything we need for now. We'll be in touch…" line
            that used to close this screen is DELETED. It was false the moment
            the next screen asked for a name, an email and a phone number — and
            there is no longer a next screen for it to be false about. */}
        {stage === 'details' && (
          <div>
            <p className="eyebrow mb-3">Step {total} of {total}</p>
            <h1 className="heading-section text-green-800 mb-3">Your Details</h1>
            <p className="body-text mb-8">
              Tell us who you are and we will call to talk through your horse's needs
              and confirm scheduling.
            </p>

            {/* 1 — the selection summary (the old Review screen's markup) */}
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
                  those. The cart survives the jump (§C3). */}
              <div className="mt-6 pt-6 border-t border-green-800/[0.08]">
                <button
                  type="button"
                  className="btn-outline-gold text-sm"
                  onClick={() => setShopOpen(true)}
                >
                  Continue Shopping
                </button>
                <p className="text-xs font-sans text-muted mt-2">
                  Add lessons or acquisition services — your selections stay in your inquiry.
                </p>
              </div>
            </div>

            {/* 3 + 4 — the ONE shared form, and its inquiryLabel() submit. */}
            <InquiryForm onSubmitted={() => navigate('/confirmation')} />
          </div>
        )}

        {/* Navigation. §C1b: the back control reads "Back" on every step past
            the first — "Previous" appears nowhere in this funnel. The forward
            button lives here only while there IS a next page; on the submission
            page the form's own submit is the single way forward, so no
            competing primary is rendered. */}
        <div className={`flex items-center justify-between mt-12 pt-8 border-t border-green-800/10 ${
          stage === 'details' ? 'justify-start' : ''
        }`}>
          {/* ⚠️ TASK-MODAL2 D5 — the shared back control. Owner: *"the back control
              should apply to saving state on all things any user inputs, not just
              the onboarding flow steps."* `handleBack` only moves the step; the
              selection lives in the funnel's context, so going back revises rather
              than discards. */}
          <BackControl onClick={handleBack} label={current === 0 ? 'Back to Services' : 'Back'} />

          {stage !== 'details' && (
            <div className="flex items-center gap-6">
              {/* TASK-GIFTPATH — reachable from horse care, not just lessons.
                  Owner's wording, verbatim. */}
              {stage === 'select' && (
                <Link to="/gift?item=horse" className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring">
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
                  // Nothing on the questions step is required (§A5): these shape the
                  // conversation, they do not qualify anyone, and a required answer
                  // blocks a sale.
                  disabled={current === 0 ? !canProceedStep0 : false}
                  className="btn-primary"
                >
                  {/* §C2/§A6: the questions page's forward button names the page it
                      actually leads to. */}
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
        so there is one path forward, not two. §C2 requires it NOT to present a
        competing path on the submission page, and it does not render there. */}
    {stage === 'select' && <SelectionBar onContinue={handleNext} disabled={!canProceedStep0} />}

    <ContinueShoppingModal open={shopOpen} onClose={() => setShopOpen(false)} />
    </>
  );
}
