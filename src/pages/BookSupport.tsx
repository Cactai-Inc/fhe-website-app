import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  SUPPORT_SERVICES,
  HORSE_LOCATOR,
  EVALUATION,
  BROKERING,
  RIDING_LESSON,
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
  { label: 'Your Situation' },
  { label: 'Review & Continue' },
];

function ServiceSelector({ service, compact = false, label = '' }: { service: Service; compact?: boolean; label?: string }) {
  const { toggleItem, isSelected } = useCart();

  return (
    <div className={compact ? '' : 'border border-green-800/10 bg-white p-6 sm:p-8'}>
      {!compact && (
        <>
          <p className="eyebrow mb-2">Rider Support</p>
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
      {label && (
        <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-3">{label}</p>
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

export default function BookSupport() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, setQualifier, itemCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    setFunnel('support');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);

  const experience   = state.qualifierAnswers['experience'];
  const wantsLessons = state.qualifierAnswers['wants_lessons'];
  const horseCount   = state.qualifierAnswers['how_many_horses'];

  const trainingSelected = state.items.some((i) => i.serviceId === HORSE_TRAINING.id);
  const turnoutSelected  = state.items.some((i) => i.serviceId === RIDING_TURNOUT.id);
  const clippingSelected = state.items.some((i) => i.serviceId === HAIR_CLIPPING.id);

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
            <h1 className="heading-section text-green-800 mb-3">Rider Support Services</h1>
            <p className="body-text mb-10">
              Finding the right horse is one of the most significant decisions in an equestrian's life. Our support services provide expert guidance at each stage — from the first search to the final handshake.
            </p>
            <div className="flex flex-col gap-8">
              {SUPPORT_SERVICES.map((svc) => (
                <ServiceSelector key={svc.id} service={svc} />
              ))}
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

            {/* Q: Experience */}
            <div className="bg-white border border-green-800/10 p-8 mb-6">
              <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                How would you describe your equestrian experience?
              </h3>
              <p className="text-sm font-sans text-green-800/60 mb-5">
                We want to match our guidance to your actual background.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { value: 'first-horse', label: 'This will be my first horse' },
                  { value: 'returning', label: 'I owned a horse in the past' },
                  { value: 'experienced', label: 'I am an experienced horse owner' },
                  { value: 'professional', label: 'I ride professionally or competitively' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setQualifier('experience', opt.value)}
                    className={`py-4 px-5 border text-sm font-sans text-left transition-all duration-200 ${
                      experience === opt.value
                        ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                        : 'border-green-800/15 bg-white text-green-800/70 hover:border-green-800/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q: How many horses? */}
            {experience && (
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                  How many horses are you considering?
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {[
                    { value: 'one', label: 'One' },
                    { value: 'two', label: 'Two' },
                    { value: 'three-plus', label: 'Three or more' },
                    { value: 'not-sure', label: 'Not sure yet' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQualifier('how_many_horses', opt.value)}
                      className={`py-3 px-4 border text-sm font-sans text-center transition-all duration-200 ${
                        horseCount === opt.value
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

            {/* Q: Interest in lessons */}
            {experience && (
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                  Are you interested in riding lessons or training once your horse is here?
                </h3>
                <p className="text-sm font-sans text-green-800/60 mb-5">
                  Many of our clients combine acquisition support with an ongoing lessons program.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'yes', label: 'Yes, definitely' },
                    { value: 'maybe', label: 'Possibly, interested to learn more' },
                    { value: 'no', label: 'Not at this stage' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQualifier('wants_lessons', opt.value)}
                      className={`py-4 px-5 border text-sm font-sans text-left transition-all duration-200 ${
                        wantsLessons === opt.value
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
              Below is what you have selected, along with services that naturally complement your horse acquisition journey.
            </p>

            {/* Summary */}
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

            {/* Add-on: Horse Training (always relevant for new horse owners) */}
            {!trainingSelected && experience !== 'professional' && (
              <div className="mb-6">
                <div className="bg-gold-50 border border-gold-200 p-5 mb-4">
                  <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-1">Suggested Add-On</p>
                  <p className="text-sm font-sans text-green-800/70">
                    {experience === 'first-horse'
                      ? 'A professional training program for your new horse ensures a smooth, safe start to your partnership. We work with your horse so you can focus on bonding.'
                      : 'Professional training keeps your horse developing and responsive — particularly valuable in the first months at a new facility.'}
                  </p>
                </div>
                <ServiceSelector service={HORSE_TRAINING} compact />
              </div>
            )}

            {/* Add-on: Riding & Turnout */}
            {!turnoutSelected && (
              <div className="mb-6">
                <div className="bg-gold-50 border border-gold-200 p-5 mb-4">
                  <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-1">Keep Your Horse Active</p>
                  <p className="text-sm font-sans text-green-800/70">
                    Our riding and turnout service ensures your horse stays fit, stimulated, and content — especially helpful during the transition period after acquisition.
                  </p>
                </div>
                <ServiceSelector service={RIDING_TURNOUT} compact />
              </div>
            )}

            {/* Add-on: Hair Clipping (for new horse owners) */}
            {!clippingSelected && (experience === 'first-horse' || experience === 'returning') && (
              <div className="mb-6">
                <div className="bg-gold-50 border border-gold-200 p-5 mb-4">
                  <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-1">Presentation & Comfort</p>
                  <p className="text-sm font-sans text-green-800/70">
                    New horses often arrive needing a clip. Our professional clipping service is a simple way to start your horse's time with us on the right note.
                  </p>
                </div>
                <ServiceSelector service={HAIR_CLIPPING} compact />
              </div>
            )}

            {/* Add-on: Riding Lessons (if interested) */}
            {(wantsLessons === 'yes' || wantsLessons === 'maybe') && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-3">
                  Riding Lessons — A Natural Next Step
                </p>
                <p className="text-sm font-sans text-green-800/70 mb-4">
                  {wantsLessons === 'yes'
                    ? "You mentioned you're interested in lessons — wonderful. Our private riding lesson programs are designed to grow with you and your new horse."
                    : "You expressed possible interest in lessons. We would love to tell you more about our programs when we speak — no commitment needed at this stage."}
                </p>
                <a href="/book/rider" className="inline-flex items-center gap-2 text-xs font-sans tracking-wide uppercase text-green-800 border-b border-green-800/20 pb-0.5 hover:border-green-800 transition-all duration-200">
                  View Rider Services
                  <ArrowRight size={12} />
                </a>
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
