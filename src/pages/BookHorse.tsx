import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  HORSE_SERVICES,
  HORSE_TRAINING,
  RIDING_TURNOUT,
  HAIR_CLIPPING,
  formatPrice,
} from '../lib/services';
import type { Service, ServiceTier } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import type { CartItem } from '../contexts/CartContext';

const STEPS = [
  { label: 'Select Services' },
  { label: 'Tell Us More' },
  { label: 'Review & Continue' },
];

function ServiceSelector({ service, compact = false }: { service: Service; compact?: boolean }) {
  const { toggleItem, isSelected } = useCart();

  return (
    <div className={compact ? '' : 'border border-green-800/10 bg-white p-6 sm:p-8'}>
      {!compact && (
        <>
          <p className="eyebrow mb-2">Horse Service</p>
          <h3 className="heading-card text-green-800 mb-1">{service.name}</h3>
          <p className="text-xs font-sans italic text-gold-700 mb-3"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '0.95rem' }}>
            {service.tagline}
          </p>
          <p className="body-text text-sm mb-6">{service.description}</p>
        </>
      )}
      {compact && (
        <>
          <h3 className="font-serif font-medium text-green-800 text-lg mb-1">{service.name}</h3>
          <p className="text-sm font-sans text-green-800/60 mb-4">{service.tagline}</p>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {service.tiers.map((tier: ServiceTier) => {
          const selected = isSelected(service.id, tier.id);
          const item: CartItem = {
            serviceId: service.id,
            serviceName: service.name,
            tierId: tier.id,
            tierLabel: tier.label,
            price: tier.price,
            unit: tier.unit,
          };
          return (
            <button
              key={tier.id}
              onClick={() => toggleItem(item)}
              className={`tier-card text-left ${selected ? 'tier-card-selected' : 'tier-card-unselected'}`}
            >
              {tier.popular && (
                <span className="absolute top-3 right-3 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-white px-2 py-0.5">
                  Popular
                </span>
              )}
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className="text-sm font-sans font-medium text-green-900 pr-8">{tier.label}</span>
                <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center mt-0.5 transition-colors ${
                  selected ? 'bg-green-800 border-green-800' : 'border-green-800/30'
                }`}>
                  {selected && <Check size={10} className="text-white" />}
                </div>
              </div>
              <p className="text-xs font-sans text-green-800/60 mb-3 leading-snug">{tier.description}</p>
              <p className="text-base font-serif font-medium text-green-800" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                {formatPrice(tier.price, tier.unit)}
              </p>
              {tier.note && (
                <p className="text-[10px] font-sans text-gold-700 mt-1">{tier.note}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BookHorse() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, setQualifier, itemCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    setFunnel('horse');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);

  const reason = state.qualifierAnswers['horse_reason'];
  const clippingSelected = state.items.some((i) => i.serviceId === HAIR_CLIPPING.id);
  const trainingSelected = state.items.some((i) => i.serviceId === HORSE_TRAINING.id);
  const turnoutSelected  = state.items.some((i) => i.serviceId === RIDING_TURNOUT.id);

  // Whether the reason suggests they'll be away (clipping + brokering are relevant add-ons)
  const isAbsent = reason === 'traveling' || reason === 'injured' || reason === 'temporary';

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
      navigate('/services');
    }
  }

  return (
    <div className="min-h-screen bg-cream pt-24 pb-20">
      <div className="container-site max-w-3xl">

        {/* Step indicator */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={i < step ? 'step-complete' : i === step ? 'step-active' : 'step-inactive'}>
                  {i < step ? <Check size={12} /> : i + 1}
                </div>
                <span className={`text-xs font-sans tracking-wide hidden sm:block ${
                  i === step ? 'text-green-800 font-medium' : 'text-green-800/40'
                }`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="w-8 h-px bg-green-800/15 hidden sm:block" />
                )}
              </div>
            ))}
          </div>
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
                <ServiceSelector key={svc.id} service={svc} />
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

            {/* Q: Why do you need horse services? */}
            <div className="bg-white border border-green-800/10 p-8 mb-6">
              <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                What is bringing you to our horse services?
              </h3>
              <p className="text-sm font-sans text-green-800/60 mb-5">
                Choose the option that best describes your situation.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'traveling', label: 'I will be travelling and need my horse looked after' },
                  { value: 'injured', label: 'I am recovering from an injury' },
                  { value: 'training', label: 'I want professional training for my horse' },
                  { value: 'regular-care', label: 'I need ongoing care and turnout support' },
                  { value: 'temporary', label: 'Temporary situation — I need short-term coverage' },
                  { value: 'other', label: 'Something else' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setQualifier('horse_reason', opt.value)}
                    className={`py-4 px-5 border text-sm font-sans text-left transition-all duration-200 ${
                      reason === opt.value
                        ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                        : 'border-green-800/15 bg-white text-green-800/70 hover:border-green-800/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q: Approximate duration */}
            {reason && (
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                  Approximately how long will you need these services?
                </h3>
                <p className="text-sm font-sans text-green-800/60 mb-5">
                  This helps us recommend the right plan.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { value: '1-2-weeks', label: '1–2 weeks' },
                    { value: '1-month', label: '1 month' },
                    { value: '2-3-months', label: '2–3 months' },
                    { value: 'ongoing', label: 'Ongoing' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQualifier('horse_duration', opt.value)}
                      className={`py-3 px-4 border text-sm font-sans text-center transition-all duration-200 ${
                        state.qualifierAnswers['horse_duration'] === opt.value
                          ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                          : 'border-green-800/15 bg-white text-green-800/70 hover:border-green-800/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review */}
        {step === 2 && (
          <div>
            <p className="eyebrow mb-3">Step 3 of 3</p>
            <h1 className="heading-section text-green-800 mb-3">Review Your Selection</h1>
            <p className="body-text mb-8">
              Here is what you have selected. We have added a couple of aligned additions below that complement your situation.
            </p>

            {/* Selected summary */}
            <div className="bg-white border border-green-800/10 p-8 mb-8">
              <p className="eyebrow mb-5">Your Selection</p>
              {state.items.length === 0 ? (
                <p className="text-sm font-sans text-green-800/50 italic">No services selected yet.</p>
              ) : (
                <div className="flex flex-col divide-y divide-green-800/8">
                  {state.items.map((item) => (
                    <div key={`${item.serviceId}-${item.tierId}`} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-sans font-medium text-green-900">{item.tierLabel}</p>
                        <p className="text-xs font-sans text-green-800/50">{item.serviceName}</p>
                      </div>
                      <p className="text-sm font-serif font-medium text-green-800" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}>
                        {formatPrice(item.price, item.unit as any)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add-on: Hair Clipping (if not selected + absent context) */}
            {!clippingSelected && (
              <div className="mb-6">
                <div className="bg-gold-50 border border-gold-200 p-5 mb-4">
                  <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-1">
                    Suggested Add-On
                  </p>
                  <p className="text-sm font-sans text-green-800/70">
                    {isAbsent
                      ? 'While your horse is in our care, it is a perfect opportunity to have them clipped and looking their best for your return.'
                      : 'Keep your horse comfortable and professionally presented — our clipping service pairs naturally with training and turnout programs.'}
                  </p>
                </div>
                <ServiceSelector service={HAIR_CLIPPING} compact />
              </div>
            )}

            {/* Add-on: Lease brokering (if travelling/injured) */}
            {isAbsent && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-3">
                  One More Thing to Consider
                </p>
                <p className="text-sm font-sans text-green-800/70 mb-4">
                  If the timing of your absence makes you think about a temporary lease arrangement — putting your horse into a part or full lease while you recover or travel — our Rider Support services include professional lease brokering. It can offset costs while ensuring your horse stays active and cared for.
                </p>
                <a href="/book/support" className="inline-flex items-center gap-2 text-xs font-sans tracking-wide uppercase text-green-800 border-b border-green-800/20 pb-0.5 hover:border-green-800 transition-all duration-200">
                  Learn About Lease Brokering
                  <ArrowRight size={12} />
                </a>
              </div>
            )}

            {/* Add-on: Training (if not selected and doing turnout) */}
            {turnoutSelected && !trainingSelected && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-3">
                  Enhance Your Turnout Plan
                </p>
                <p className="text-sm font-sans text-green-800/70 mb-4">
                  Pair your riding and turnout service with professional training sessions. Your horse maintains fitness and continues to develop — not just maintenance, but progress.
                </p>
                <ServiceSelector service={HORSE_TRAINING} compact />
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-green-800/10">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-sans text-green-800/60 hover:text-green-800 transition-colors"
          >
            <ArrowLeft size={16} />
            {step === 0 ? 'Back to Services' : 'Previous'}
          </button>

          <button
            onClick={handleNext}
            disabled={step === 0 ? !canProceedStep0 : step === 1 ? !canProceedStep1 : false}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step === STEPS.length - 1 ? 'Continue to Checkout' : 'Continue'}
            <ArrowRight size={16} />
          </button>
        </div>

        {step === 0 && !canProceedStep0 && (
          <p className="text-xs font-sans text-center text-green-800/40 mt-3">
            Select at least one service to continue.
          </p>
        )}
      </div>
    </div>
  );
}
