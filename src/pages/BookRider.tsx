import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  RIDER_SERVICES,
  RIDING_LESSON,
  HUNTER_JUMPER,
  HORSEMANSHIP,
  formatPrice,
} from '../lib/services';
import { useCart } from '../contexts/CartContext';
import ServiceSelector from '../components/ServiceSelector';
import QualifierGroup from '../components/QualifierGroup';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const STEPS = [
  { label: 'Select Services' },
  { label: 'A Few Questions' },
  { label: 'Review & Continue' },
];

const SEO = seoForPath('/lessons')!;

export default function BookRider() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, itemCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    setFunnel('rider');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);

  const ownsHorse = state.qualifierAnswers['owns_horse'];
  const boarding = state.qualifierAnswers['boarding'];
  const wantsHorse = state.qualifierAnswers['wants_horse'];
  const lessonSelected = state.items.some((i) => i.serviceType === RIDING_LESSON.id);
  const hjSelected = state.items.some((i) => i.serviceType === HUNTER_JUMPER.id);
  const hasAnyRider = lessonSelected || hjSelected;

  const canProceedStep0 = itemCount > 0;
  const canProceedStep1 = !!ownsHorse;

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
      navigate('/lessons');
    }
  }

  return (
    <>
      <Seo title={SEO.title} description={SEO.description} path="/lessons" service={SEO.service} />
    <div className="min-h-screen bg-cream pt-24 pb-20">
      <div className="container-site max-w-3xl">

        {/* ── Step indicator ── */}
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

        {/* ── Step 0: Select Services ── */}
        {step === 0 && (
          <div>
            <p className="eyebrow mb-3">Step 1 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">Rider Services</h1>
            <p className="body-text mb-10">
              Select the service(s) and pricing option that best fits your schedule and goals. You may combine multiple services — we will tailor any add-on recommendations to match.
            </p>
            <div className="flex flex-col gap-8">
              {RIDER_SERVICES.map((svc) => (
                <ServiceSelector key={svc.id} service={svc} category="Rider Services" />
              ))}
            </div>
          </div>
        )}

        {/* ── Step 1: Qualifier questions ── */}
        {step === 1 && (
          <div>
            <p className="eyebrow mb-3">Step 2 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">A Few Questions</h1>
            <p className="body-text mb-10">
              Help us understand your situation so we can show you what else might serve you — and nothing that would not.
            </p>

            <QualifierGroup
              qualifierKey="owns_horse"
              question="Do you currently own or lease a horse?"
              help="This helps us understand where you are in your equestrian journey."
              layout="wide"
              options={[
                { value: 'yes', label: 'Yes, I have a horse' },
                { value: 'no', label: 'Not yet' },
                { value: 'school', label: 'I ride school horses' },
              ]}
            />

            {ownsHorse === 'yes' && (
              <>
                <QualifierGroup
                  qualifierKey="boarding"
                  question="Where is your horse currently boarded?"
                  help="Knowing this helps us understand what you may already have in place."
                  options={[
                    { value: 'carmel-creek', label: 'Carmel Creek Ranch (here)' },
                    { value: 'other-sd', label: 'Another facility in San Diego' },
                    { value: 'outside-sd', label: 'Outside San Diego' },
                    { value: 'home', label: 'At my own property' },
                  ]}
                />
                {boarding && boarding !== 'carmel-creek' && (
                  <p className="-mt-3 mb-6 text-xs font-sans text-muted italic">
                    Note: Our rider services are conducted at Carmel Creek Ranch. We can discuss transport logistics when we speak.
                  </p>
                )}
              </>
            )}

            {(ownsHorse === 'no' || ownsHorse === 'school') && (
              <QualifierGroup
                qualifierKey="wants_horse"
                question="Are you considering owning or leasing a horse?"
                help="If so, our Acquisition Support services may be a natural next step for you."
                layout="wide"
                options={[
                  { value: 'yes-soon', label: 'Yes, actively looking' },
                  { value: 'maybe', label: 'Possibly in the future' },
                  { value: 'no-for-now', label: 'Not at the moment' },
                ]}
              />
            )}
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === 2 && (
          <div>
            <p className="eyebrow mb-3">Step 3 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">Review Your Selection</h1>
            <p className="body-text mb-8">
              Here is what you have selected. We have also included a couple of thoughtful additions below — take them or leave them.
            </p>

            {/* Selected items summary */}
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
                      <p className="text-sm font-serif font-medium text-green-800">
                        {formatPrice(item.price, item.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Within-pillar add-on: Horsemanship complements lessons. Always appropriate. */}
            {!state.items.some((i) => i.serviceType === HORSEMANSHIP.id) && hasAnyRider && (
              <div className="mb-6">
                <div className="bg-gold-50 border border-gold-200 p-5 mb-4">
                  <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-1">Suggested Add-On</p>
                  <p className="text-sm font-sans text-secondary">
                    Riders who combine lessons with horsemanship classes consistently develop faster and build a more intuitive connection with their horse.
                  </p>
                </div>
                <ServiceSelector service={HORSEMANSHIP} compact />
              </div>
            )}

            {/*
              Cross-pillar gating (per ux-synthesis):
              - Support cross-sell only when she is considering buying/leasing (not owner).
              - Horse-CARE cross-sell only when horse ownership is confirmed.
              Both are surfaced as a note + Link, never as a pricing card in this funnel.
            */}
            {ownsHorse !== 'yes' && (wantsHorse === 'yes-soon' || wantsHorse === 'maybe') && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-3">Acquisition Support Available</p>
                <p className="text-sm font-sans text-secondary mb-4">
                  Since you are considering owning or leasing a horse, our Acquisition Support services are designed to make that journey smooth, safe, and inspired. We can tell you more when we speak.
                </p>
                <Link to="/book/support" className="link-underline">
                  Explore Acquisition Support
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}

            {ownsHorse === 'yes' && boarding && boarding !== 'carmel-creek' && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-ink mb-3">Care for Your Horse, On Your Terms</p>
                <p className="text-sm font-sans text-secondary mb-4">
                  We also bring training, riding, turnout, and clipping to where your horse lives. If supplementary care would help, we would love to discuss your horse's program.
                </p>
                <Link to="/book/horse" className="link-underline">
                  View Horse Care Services
                  <ArrowRight size={12} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
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
