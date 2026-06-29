import { useState } from 'react';
import { Mail, Phone, MapPin, ArrowRight } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { submitRequest } from '../lib/api';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

export default function Contact() {
  const seo = seoForPath('/contact');
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upd(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) return;
    setSending(true);
    setError(null);
    try {
      await submitRequest(
        {
          contact_name: form.name.trim(),
          contact_email: form.email.trim(),
          contact_phone: form.phone.trim() || undefined,
          notes: form.message.trim() || undefined,
        },
        [],
      );
      setSent(true);
    } catch {
      setError('Something went wrong. Please email or call us directly.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      {seo && <Seo title={seo.title} description={seo.description} path="/contact" noindex />}
      <section className="min-h-screen bg-cream pt-32 pb-20">
        <div className="container-site max-w-4xl">
          <p className="eyebrow mb-2">Say hello</p>
          <h1 className="heading-section text-green-800 mb-10">We'd love to hear from you.</h1>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
            {/* Details */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <a href={BRAND.phoneHref} className="flex items-center gap-3 text-secondary hover:text-green-800 transition-colors focus-ring">
                <Phone size={18} className="text-gold-ink flex-shrink-0" aria-hidden="true" />
                {BRAND.phoneDisplay}
              </a>
              <a href={BRAND.emailHref} className="flex items-center gap-3 text-secondary hover:text-green-800 transition-colors break-all focus-ring">
                <Mail size={18} className="text-gold-ink flex-shrink-0" aria-hidden="true" />
                {BRAND.email}
              </a>
              <div className="flex items-start gap-3 text-secondary">
                <MapPin size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>Carmel Creek Ranch<br />San Diego, CA</span>
              </div>
              <p className="form-hint mt-2 leading-relaxed">
                We read every note ourselves and get back the same day, usually within the hour.
              </p>
            </div>

            {/* Form */}
            <div className="lg:col-span-3">
              {sent ? (
                <div className="bg-green-50 border border-green-200 p-8">
                  <h2 className="font-serif font-medium text-green-800 text-xl mb-2">Your note just landed.</h2>
                  <p className="body-text text-sm">One of us will be in touch today. Talk soon.</p>
                </div>
              ) : (
                <form onSubmit={submit} className="bg-white border border-green-800/10 p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="form-label" htmlFor="c-name">Name *</label>
                      <input id="c-name" className="form-input" required value={form.name} onChange={(e) => upd('name', e.target.value)} autoComplete="name" />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="c-phone">Phone</label>
                      <input id="c-phone" type="tel" className="form-input" value={form.phone} onChange={(e) => upd('phone', e.target.value)} autoComplete="tel" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label" htmlFor="c-email">Email *</label>
                      <input id="c-email" type="email" className="form-input" required value={form.email} onChange={(e) => upd('email', e.target.value)} autoComplete="email" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="form-label" htmlFor="c-msg">Anything you'd like us to know?</label>
                      <textarea id="c-msg" rows={4} className="form-input resize-none" value={form.message} onChange={(e) => upd('message', e.target.value)} />
                    </div>
                  </div>
                  {error && <p className="form-error mt-4" role="alert">{error}</p>}
                  <button type="submit" disabled={sending || !form.name.trim() || !form.email.trim()} className="btn-primary mt-6 w-full justify-center">
                    {sending ? 'Sending…' : 'Send it our way'}
                    {!sending && <ArrowRight size={16} />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
