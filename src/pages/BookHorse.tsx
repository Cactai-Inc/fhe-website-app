import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { HORSE_SERVICES, formatPrice } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import ServiceSelector from '../components/ServiceSelector';
import QualifierGroup from '../components/QualifierGroup';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const STEPS = [
  { label: 'Select Services' },
  { label: 'Tell Us More' },
  { label: 'Review & Continue' },
];

const SEO = seoForPath('/horse')!;

export default function BookHorse() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, itemCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    setFunnel('horse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);

  const reason = state.qualifierAnswers['horse_reason'];

  const canProceedStep0 = itemCount > 0;
  const canProceedStep1 = !!reason;

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
      <Seo title={SEO.title} description={SEO.description} path="/horse" service={SEO.service} />
    <div className="min-h-screen bg-cream pt-24 pb-20">
      <div className="container-site max-w-3xl">

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
            <h1 className="heading-section text-green-800 mb-3">Horse Services</h1>
            <p className="body-text mb-10">
              Select the services you need for your horse. Each option can be combined — we will tailor further recommendations once we understand your situation.
            </p>
            <div className="flex flex-col gap-8">
              {HORSE_SERVICES.map((svc) => (
                <ServiceSelector key={svc.id} service={svc} category="Horse Services" />
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Qualifier */}
        {step === 1 && (
          <div>
            <p className="eyebrow mb-3">Step 2 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">Tell Us More</h1>
            <p className="body-text mb-10">
              A bit of context helps us ensure your horse is in the best possible hands.
            </p>

            <QualifierGroup
              qualifierKey="horse_reason"
              question="What is bringing you to our horse services?"
              help="Choose the option that best describes your situation."
              options={[
                { value: 'traveling', label: 'I will be travelling and need my horse looked after' },
                { value: 'injured', label: 'I am recovering from an injury' },
                { value: 'training', label: 'I want professional training for my horse' },
                { value: 'regular-care', label: 'I need ongoing care and turnout support' },
                { value: 'temporary', label: 'Temporary situation — I need short-term coverage' },
                { value: 'other', label: 'Something else' },
              ]}
            />

            {reason && (
              <QualifierGroup
                qualifierKey="horse_duration"
                question="Approximately how long will you need these services?"
                help="This helps us recommend the right plan."
                layout="compact"
                options={[
                  { value: '1-2-weeks', label: '1–2 weeks' },
                  { value: '1-month', label: '1 month' },
                  { value: '2-3-months', label: '2–3 months' },
                  { value: 'ongoing', label: 'Ongoing' },
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
              Here is what you have selected. When we speak, we will confirm scheduling and discuss anything else your horse may need.
            </p>

            {/* Selected summary */}
            <div className="bg-white border border-green-800/10 p-8 mb-8">
              <p className="eyebrow mb-5">Your Selection</p>
              {state.items.length === 0 ? (
                <p className="text-sm font-sans text-muted italic">No services selected yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-green-800/[0.08]">
                  {state.items.map((item) => (
                    <div key={`${item.serviceId}-${item.tierId}`} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-sans font-medium text-green-900">{item.tierLabel}</p>
                        <p className="text-xs font-sans text-muted">{item.serviceName}</p>
                      </div>
                      <p className="text-sm font-serif font-medium text-green-800">
                        {formatPrice(item.price, item.unit)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/*
              Per ux-synthesis gating: the horse-care funnel carries NO cross-sells.
              An owner who needs care already knows what she wants; surfacing lessons or
              support here is premature and clutters the review. Anything else relevant
              is raised on the call.
            */}
            <p className="text-sm font-sans text-muted italic">
              That's everything we need for now. We'll be in touch to confirm scheduling and
              discuss how your horse is doing.
            </p>
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
