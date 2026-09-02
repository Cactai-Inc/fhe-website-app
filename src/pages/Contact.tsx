import { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { PublicIntakeForm } from '../components/PublicIntakeForm';
import type { RequestCategory } from '../lib/types';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

export default function Contact({
  defaultCategory = 'general',
  entryLocation = 'contact_page',
}: {
  defaultCategory?: RequestCategory;
  entryLocation?: string;
}) {
  const seo = seoForPath('/contact');
  const [sent, setSent] = useState(false);

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
                <PublicIntakeForm
                  channel="contact"
                  defaultCategory={defaultCategory}
                  entryLocation={entryLocation}
                  onSubmitted={() => setSent(true)}
                />
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
