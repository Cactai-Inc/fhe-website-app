import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft } from 'lucide-react';
import {
  RIDER_SERVICES,
  RIDING_LESSON,
  HUNTER_JUMPER,
  HORSEMANSHIP,
  formatPrice,
} from '../lib/services';
import type { Service, ServiceTier } from '../lib/services';
import { useCart } from '../contexts/CartContext';
import type { CartItem } from '../contexts/CartContext';

/* ─── Step definitions ──────────────────────────────────────────────────── */
const STEPS = [
  { label: 'Select Services' },
  { label: 'A Few Questions' },
  { label: 'Review & Continue' },
];

/* ─── Sub-component: service + tier selector ───────────────────────────── */
function ServiceSelector({ service, compact = false }: { service: Service; compact?: boolean }) {
  const { toggleItem, isSelected } = useCart();

  return (
    <div className={compact ? '' : 'border border-green-800/10 bg-white p-6 sm:p-8'}>
      {!compact && (
        <>
          <p className="eyebrow mb-2">{service.category === 'rider' ? 'Rider Service' : 'Add-On'}</p>
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

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function BookRider() {
  const [step, setStep] = useState(0);
  const { state, setFunnel, setQualifier, itemCount } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    setFunnel('rider');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [setFunnel]);

  const ownsHorse = state.qualifierAnswers['owns_horse'];
  const lessonSelected = state.items.some((i) => i.serviceId === RIDING_LESSON.id);
  const hjSelected = state.items.some((i) => i.serviceId === HUNTER_JUMPER.id);
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
      navigate('/services');
    }
  }

  return (
    <div className="min-h-screen bg-cream pt-24 pb-20">
      <div className="container-site max-w-3xl">

        {/* ── Step indicator ── */}
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
                <ServiceSelector key={svc.id} service={svc} />
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

            {/* Q1: Own a horse? */}
            <div className="bg-white border border-green-800/10 p-8 mb-6">
              <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                Do you currently own or lease a horse?
              </h3>
              <p className="text-sm font-sans text-green-800/60 mb-5">
                This helps us understand where you are in your equestrian journey.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: 'yes', label: 'Yes, I have a horse' },
                  { value: 'no', label: 'Not yet' },
                  { value: 'school', label: 'I ride school horses' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setQualifier('owns_horse', opt.value)}
                    className={`py-4 px-5 border text-sm font-sans text-left transition-all duration-200 ${
                      ownsHorse === opt.value
                        ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                        : 'border-green-800/15 bg-white text-green-800/70 hover:border-green-800/40'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Q2: Where boarded? (only if they own) */}
            {ownsHorse === 'yes' && (
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                  Where is your horse currently boarded?
                </h3>
                <p className="text-sm font-sans text-green-800/60 mb-5">
                  Knowing this helps us understand what you may already have in place.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { value: 'carmel-creek', label: 'Carmel Creek Ranch (here)' },
                    { value: 'other-sd', label: 'Another facility in San Diego' },
                    { value: 'outside-sd', label: 'Outside San Diego' },
                    { value: 'home', label: 'At my own property' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQualifier('boarding', opt.value)}
                      className={`py-4 px-5 border text-sm font-sans text-left transition-all duration-200 ${
                        state.qualifierAnswers['boarding'] === opt.value
                          ? 'border-green-800 bg-green-800/5 text-green-900 font-medium'
                          : 'border-green-800/15 bg-white text-green-800/70 hover:border-green-800/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {state.qualifierAnswers['boarding'] && state.qualifierAnswers['boarding'] !== 'carmel-creek' && (
                  <p className="mt-4 text-xs font-sans text-green-800/50 italic">
                    Note: Our rider services are conducted at Carmel Creek Ranch. We can discuss transport logistics when we speak.
                  </p>
                )}
              </div>
            )}

            {/* Q3: Interest in horse search (only if they don't own) */}
            {(ownsHorse === 'no' || ownsHorse === 'school') && (
              <div className="bg-white border border-green-800/10 p-8 mb-6">
                <h3 className="font-serif font-medium text-green-800 text-lg mb-2">
                  Are you considering owning or leasing a horse?
                </h3>
                <p className="text-sm font-sans text-green-800/60 mb-5">
                  If so, our Rider Support services may be a natural next step for you.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { value: 'yes-soon', label: 'Yes, actively looking' },
                    { value: 'maybe', label: 'Possibly in the future' },
                    { value: 'no-for-now', label: 'Not at the moment' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setQualifier('wants_horse', opt.value)}
                      className={`py-4 px-5 border text-sm font-sans text-left transition-all duration-200 ${
                        state.qualifierAnswers['wants_horse'] === opt.value
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

            {/* Smart add-ons */}
            {/* Add-on: Horsemanship (if not already selected) */}
            {!state.items.some((i) => i.serviceId === HORSEMANSHIP.id) && hasAnyRider && (
              <div className="mb-6">
                <div className="bg-gold-50 border border-gold-200 p-5 mb-4">
                  <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-1">Suggested Add-On</p>
                  <p className="text-sm font-sans text-green-800/70">
                    Riders who combine lessons with horsemanship classes consistently develop faster and build a more intuitive connection with their horse.
                  </p>
                </div>
                <ServiceSelector service={HORSEMANSHIP} compact />
              </div>
            )}

            {/* Add-on: Horse Locator (if no horse and interested) */}
            {ownsHorse !== 'yes' && (state.qualifierAnswers['wants_horse'] === 'yes-soon' || state.qualifierAnswers['wants_horse'] === 'maybe') && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-3">Rider Support Available</p>
                <p className="text-sm font-sans text-green-800/70 mb-4">
                  Since you are considering owning or leasing a horse, our Rider Support services are designed to make that journey smooth, safe, and inspired. You can add these today or explore them separately.
                </p>
                <a href="/book/support" className="inline-flex items-center gap-2 text-xs font-sans tracking-wide uppercase text-green-800 border-b border-green-800/20 pb-0.5 hover:border-green-800 transition-all duration-200">
                  Explore Rider Support
                  <ArrowRight size={12} />
                </a>
              </div>
            )}

            {/* Add-on: Horse Training (if they own and not at Carmel Creek) */}
            {ownsHorse === 'yes' && state.qualifierAnswers['boarding'] !== 'carmel-creek' && (
              <div className="mb-6 bg-white border border-green-800/10 p-6">
                <p className="text-xs font-sans font-medium tracking-wide uppercase text-gold-700 mb-3">Bring Your Horse to Carmel Creek</p>
                <p className="text-sm font-sans text-green-800/70 mb-4">
                  Our professional training services are available to horses stabled with us at Carmel Creek Ranch. If you are considering a move or adding supplementary training, we would love to discuss your horse's program.
                </p>
                <a href="/book/horse" className="inline-flex items-center gap-2 text-xs font-sans tracking-wide uppercase text-green-800 border-b border-green-800/20 pb-0.5 hover:border-green-800 transition-all duration-200">
                  View Horse Services
                  <ArrowRight size={12} />
                </a>
              </div>
            )}

          </div>
        )}

        {/* ── Navigation ── */}
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
