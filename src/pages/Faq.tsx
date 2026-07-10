import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { SITE_URL, BUSINESS } from '../lib/seo';

/* Frequently-asked questions — a light stub for launch. Copy is placeholder,
 * styled consistently with the rest of the marketing surface. Swap answers in
 * as the real details firm up. Also emits FAQPage JSON-LD for rich results.
 */
const FAQS = [
  {
    q: 'Do I need my own horse to take lessons?',
    a: 'Not at all. Most riders begin on our school horses — steady, well-schooled partners matched to your level. When you are ready for a horse of your own, we can help you find the right one.',
  },
  {
    q: 'I rode years ago. Is it too late to come back?',
    a: 'It is exactly the right time. Many of our riders are returning after a long pause. We meet you where you are and rebuild from the fundamentals, at a pace that feels good.',
  },
  {
    q: 'What should I wear to my first lesson?',
    a: 'Long pants, a closed-toe shoe with a small heel, and a helmet — we can lend you one to start. Comfort over kit; you do not need to buy anything to begin.',
  },
  {
    q: 'Where are you located?',
    a: 'At Carmel Creek Ranch in coastal San Diego, in the Carmel Valley area — about two and a half miles from Torrey Pines Beach.',
  },
  {
    q: 'How do I book my first lesson?',
    a: 'Start on our lessons page to see options and pricing, or say hello and we will help you find a first time that works.',
  },
];

const FAQ_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_URL}/faq#faq`,
  about: { '@type': 'LocalBusiness', name: BUSINESS.name, '@id': `${SITE_URL}/#business` },
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function Faq() {
  return (
    <>
      <Seo
        title="Frequently Asked Questions | French Heritage Equestrian, San Diego"
        description="Common questions about riding lessons, first visits, and getting started at French Heritage Equestrian — Carmel Creek Ranch, coastal San Diego."
        path="/faq"
        jsonLd={[FAQ_JSONLD]}
      />

      {/* Header band */}
      <section className="bg-cream">
        <div className="container-site pt-32 pb-14 sm:pt-40 sm:pb-16 max-w-3xl">
          <p className="eyebrow mb-5">Questions</p>
          <h1 className="heading-display text-green-900 text-[clamp(2.5rem,6vw,4.25rem)]">
            Good questions,
            <br />
            honest answers.
          </h1>
          <p className="body-text mt-7 text-lg max-w-xl">
            A few of the things new riders ask most. Do not see yours here?{' '}
            <Link
              to="/contact"
              className="text-gold-800 border-b border-gold-600/40 hover:border-gold-600 transition-colors"
            >
              Say hello
            </Link>{' '}
            and we will answer it.
          </p>
        </div>
      </section>

      {/* Q&A list */}
      <section className="bg-cream">
        <div className="container-site pb-24 sm:pb-32 max-w-3xl">
          <dl className="divide-y divide-green-800/10 border-t border-green-800/10">
            {FAQS.map((f) => (
              <div key={f.q} className="py-8 sm:py-10">
                <dt className="heading-card text-green-900">{f.q}</dt>
                <dd className="body-text mt-3 text-lg">{f.a}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-14 pt-10 border-t border-green-800/10">
            <Link to="/lessons" className="btn-primary">
              See lessons &amp; pricing
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
