import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Gift } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import { submitRequest } from '../lib/api';
import { MEMBERSHIP_PLANS, MEMBERSHIP_INCLUDED } from '../lib/catalog';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const MEMBERSHIP_POSTER = '/reference-images/Gemini_Generated_Image_n7l8hpn7l8hpn7l8.png';
const usd = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

export default function MembershipFunnel() {
  const seo = seoForPath('/membership');
  const reducedMotion = usePrefersReducedMotion();
  const [planId, setPlanId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const plan = MEMBERSHIP_PLANS.find((p) => p.id === planId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSending(true);
    try {
      await submitRequest(
        {
          contact_name: form.name.trim(),
          contact_email: form.email.trim(),
          contact_phone: form.phone.trim() || undefined,
          notes: `Membership interest: ${plan?.name ?? 'unspecified'}. ${form.note.trim()}`.trim(),
        },
        plan ? [{ offering_slug: 'membership', label: `Membership — ${plan.name}` }] : [],
      );
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {seo && <Seo title={seo.title} description={seo.description} path="/membership" service={seo.service} />}

      {/* Lead content */}
      <section className="bg-cream pt-32 pb-12">
        <div className="container-site max-w-3xl text-center">
          <p className="eyebrow mb-4">Rider community membership</p>
          <h1 className="heading-display text-green-800 mb-6 text-[clamp(2.25rem,5vw,3.5rem)]">
            All the way in.
          </h1>
          <p className="body-text text-lg leading-relaxed">
            Membership is a standing place at the rail — a regular riding rhythm, the people, and
            everything that makes the barn part of your week. It's the way in for riders who want
            this to be a real part of their life, not just a lesson here and there.
          </p>
        </div>
      </section>

      {/* Video — a group lesson */}
      <section className="bg-cream pb-16">
        <div className="container-site">
          <div className="relative overflow-hidden aspect-video max-w-4xl mx-auto bg-green-900">
            {reducedMotion ? (
              <img src={MEMBERSHIP_POSTER} alt="A group lesson at Carmel Creek Ranch" className="w-full h-full object-cover" />
            ) : (
              <video className="w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={MEMBERSHIP_POSTER}>
                <source src="/membership.webm" type="video/webm" />
                <source src="/membership.mp4" type="video/mp4" />
              </video>
            )}
          </div>
        </div>
      </section>

      {/* What's included (benefits mindset) */}
      <section className="bg-cream-50 py-16">
        <div className="container-site max-w-3xl">
          <p className="eyebrow mb-5 text-center">Every membership includes</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {MEMBERSHIP_INCLUDED.map((b) => (
              <li key={b} className="flex items-start gap-3 bg-white border border-green-800/10 p-4">
                <Check size={16} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-sm font-sans text-secondary">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Plans */}
      <section className="bg-cream py-20">
        <div className="container-site max-w-5xl">
          <div className="text-center mb-12">
            <p className="eyebrow mb-3">Choose your rhythm</p>
            <h2 className="heading-section text-green-800">Weekly or monthly — whatever fits your life.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14">
            {MEMBERSHIP_PLANS.map((p) => {
              const selected = planId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  aria-pressed={selected}
                  className={`relative text-left p-7 border transition-all duration-200 focus-ring ${
                    selected ? 'border-green-800 ring-1 ring-green-800/20 bg-white' : 'border-green-800/15 bg-white hover:border-green-800/40'
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute top-4 right-4 text-[9px] font-sans font-medium tracking-wider uppercase bg-gold-600 text-green-900 px-2 py-0.5">
                      {p.highlight}
                    </span>
                  )}
                  <p className="eyebrow mb-2">{p.cadenceLabel}</p>
                  <h3 className="heading-card text-green-800 mb-1">{p.name}</h3>
                  <p className="text-xs text-muted mb-5">{p.lessonsLabel}</p>
                  <p className="font-serif text-4xl text-green-800">{usd(p.price)}<span className="text-base text-muted"> / mo</span></p>
                  <span className={`inline-flex items-center gap-1.5 mt-5 text-xs font-sans uppercase tracking-wide ${selected ? 'text-green-800 font-medium' : 'text-muted'}`}>
                    {selected ? <><Check size={13} /> Selected</> : 'Choose'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Request to join (invite-only — inquiry, not instant purchase) */}
          <div className="max-w-xl mx-auto">
            {sent ? (
              <div className="bg-green-50 border border-green-200 p-8 text-center">
                <h3 className="font-serif font-medium text-green-800 text-xl mb-2">Your note just landed.</h3>
                <p className="body-text text-sm">We'll be in touch today to tell you how membership works and find your place at the rail.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="bg-white border border-green-800/10 p-8">
                <p className="eyebrow mb-2">Request to join</p>
                <p className="body-text text-sm mb-6">
                  Membership is by invitation, so it starts with a hello. Tell us a little about you
                  {plan ? <> — you're looking at <span className="font-medium text-green-800">{plan.name}</span></> : null} and we'll
                  take it from there.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="form-label" htmlFor="m-name">Name *</label>
                    <input id="m-name" className="form-input" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoComplete="name" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="m-phone">Phone</label>
                    <input id="m-phone" type="tel" className="form-input" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} autoComplete="tel" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label" htmlFor="m-email">Email *</label>
                    <input id="m-email" type="email" className="form-input" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} autoComplete="email" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label" htmlFor="m-note">Anything you'd like us to know?</label>
                    <textarea id="m-note" rows={3} className="form-input resize-none" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                  </div>
                </div>
                <button type="submit" disabled={sending || !form.name.trim() || !form.email.trim()} className="btn-primary mt-6 w-full justify-center">
                  {sending ? 'Sending…' : 'Request to join'}
                  {!sending && <ArrowRight size={16} />}
                </button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link to="/gift?item=membership" className="inline-flex items-center gap-2 text-sm font-sans text-secondary hover:text-green-800 transition-colors focus-ring">
                <Gift size={15} aria-hidden="true" />
                Gift a membership
              </Link>
            </div>
            <p className="text-center mt-6">
              <Link to="/about" className="link-underline">Read our story <ArrowRight size={12} aria-hidden="true" /></Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
