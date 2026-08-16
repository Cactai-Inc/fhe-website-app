import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { formatPrice } from '../lib/pricing';
import { fetchPublicCatalog, type ServiceGroup } from '../lib/publicCatalog';
import { useCart } from '../contexts/CartContext';
import ServiceSelector from '../components/ServiceSelector';
import ServiceListState from '../components/ServiceListState';

// Horse-care service_type codes used to gate the horse-care cross-sell note.
const HORSE_CARE_CODES = ['HORSE_TRAINING', 'HORSE_EXERCISE', 'HORSE_CLIPPING'];
import QualifierGroup from '../components/QualifierGroup';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const STEPS = [
  { label: 'Select Services' },
  { label: 'Your Situation' },
  { label: 'Review & Continue' },
];

const SEO = seoForPath('/acquisition')!;

export default function BookSupport() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, itemCount } = useCart();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
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

  const experience   = state.qualifierAnswers['experience'];
  const wantsLessons = state.qualifierAnswers['wants_lessons'];

  const anyHorseCareSelected = state.items.some(
    (i) => i.serviceType && HORSE_CARE_CODES.includes(i.serviceType));

  const canProceedStep0 = itemCount > 0;
  const canProceedStep1 = !!experience;

  function handleNext() {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/checkout');
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep((s) => s - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  }

  return (
    <>
      <Seo title={SEO.title} description={SEO.description} path="/acquisition" service={SEO.service} />
    <div className="min-h-screen bg-cream pt-24 pb-20">
      {/* Owner, 2026-08-16: this page read as "designed for a skinny screen".
          Cause: `container-site` is already max-w-7xl (1280px), and this
          max-w-3xl override cut it to 768px — narrower than a tablet in
          landscape. max-w-5xl (1024px) gives the cards room to sit side by side
          without the copy running to uncomfortable line lengths. */}
      <div className="container-site max-w-5xl">

        {/* Step indicator */}
        <div className="mb-12">
          <ol className="flex items-center gap-3 mb-6">
            {STEPS.map((s, i) => (
              <li key={i} className="flex items-center gap-3">
                <div
                  aria-current={i === step ? 'step' : undefined}
                  className={i < step ? 'step-complete' : i === step ? 'step-active' : 'step-inactive'}
                >
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs font-sans tracking-wide hidden sm:block ${
                  i === step ? 'text-green-800 font-medium' : 'text-muted'
                }`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-green-800/15 hidden sm:block" />
                )}
              </li>
            ))}
          </ol>
          <div className="rule-gold" />
        </div>

        {/* Step 0: Select Services */}
        {step === 0 && (
          <div>
            <p className="eyebrow mb-3">Step 1 of 3</p>
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

        {/* Step 1: Qualifier */}
        {step === 1 && (
          <div>
            <p className="eyebrow mb-3">Step 2 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">Your Situation</h1>
            <p className="body-text mb-10">
              A few questions help us shape the right experience for you — and ensure we recommend only what is genuinely relevant.
            </p>

            <QualifierGroup
              qualifierKey="experience"
              question="How would you describe your equestrian experience?"
              help="We want to match our guidance to your actual background."
              options={[
                { value: 'first-horse', label: 'This will be my first horse' },
                { value: 'returning', label: 'I owned a horse in the past' },
                { value: 'experienced', label: 'I am an experienced horse owner' },
                { value: 'professional', label: 'I ride professionally or competitively' },
              ]}
            />

            {experience && (
              <QualifierGroup
                qualifierKey="how_many_horses"
                question="How many horses are you considering?"
                layout="compact"
                options={[
                  { value: 'one', label: 'One' },
                  { value: 'two', label: 'Two' },
                  { value: 'three-plus', label: 'Three or more' },
                  { value: 'not-sure', label: 'Not sure yet' },
                ]}
              />
            )}

            {experience && (
              <QualifierGroup
                qualifierKey="wants_lessons"
                question="Are you interested in riding lessons or training once your horse is here?"
                help="Many of our clients combine acquisition support with an ongoing lessons program."
                layout="wide"
                options={[
                  { value: 'yes', label: 'Yes, definitely' },
                  { value: 'maybe', label: 'Possibly, interested to learn more' },
                  { value: 'no', label: 'Not at this stage' },
                ]}
              />
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div>
            <p className="eyebrow mb-3">Step 3 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">Review Your Selection</h1>
            <p className="body-text mb-8">
              Below is what you have selected, along with services that naturally complement your horse acquisition journey.
            </p>

            {/* Summary */}
            <div className="bg-white border border-green-800/10 p-8 mb-8">
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
                        {item.priceOnEnquiry ? 'Price on enquiry' : formatPrice(item.price, item.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/*
              Cross-sell gating (per ux-synthesis): within the support funnel, only
              evaluation follows search and only brokering follows evaluation. Horse
              CARE cross-sells (training, turnout, clipping) and rider lessons are NOT
              shown here — they belong post-acquisition, not in this booking flow.
              The only in-funnel guidance is the natural search→evaluation→brokering path.
            */}
            {!anyHorseCareSelected && experience && (
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

            {/* Lessons interest is captured for the conversation, surfaced as a note (not a pricing card). */}
            {(wantsLessons === 'yes' || wantsLessons === 'maybe') && (
              <div className="mb-6 bg-gold-50 border border-gold-200 p-5">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-1">
                  Noted for our conversation
                </p>
                <p className="text-sm font-sans text-secondary">
                  {wantsLessons === 'yes'
                    ? "You mentioned you're interested in lessons — wonderful. We'll tell you all about our riding programs when we speak."
                    : "You expressed possible interest in lessons. We'd be glad to tell you more when we talk — no commitment needed."}
                </p>
                <Link to="/services" className="link-underline mt-4">
                  Explore the ways to ride with us
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-green-800/10">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring"
          >
            <ArrowLeft size={16} />
            {step === 0 ? 'Back to Services' : 'Previous'}
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={step === 0 ? !canProceedStep0 : step === 1 ? !canProceedStep1 : false}
            className="btn-primary"
          >
            {step === STEPS.length - 1 ? 'Continue to Booking Request' : 'Continue'}
            <ArrowRight size={16} />
          </button>
        </div>

        {step === 0 && !canProceedStep0 && (
          <p className="text-xs font-sans text-center text-muted mt-3">
            Select at least one service to continue.
          </p>
        )}
      </div>
    </div>
    </>
  );
}
