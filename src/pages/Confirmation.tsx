import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import { BRAND } from '../lib/brand';
import { useDocumentTitle } from '../lib/hooks';

const METHOD_PHRASE: Record<string, string> = {
  text: 'by text',
  call: 'with a call',
  email: 'by email',
};

function readContactMethod(): string {
  try {
    return window.sessionStorage.getItem('fhe-contact-method') || '';
  } catch {
    return '';
  }
}

export default function Confirmation() {
  useDocumentTitle('We Are So Glad You Reached Out');
  const method = readContactMethod();
  const methodPhrase = METHOD_PHRASE[method] || 'however you asked us to reach you';

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
      <div className="max-w-xl w-full text-center">

        {/* Check icon */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-green-800 flex items-center justify-center">
            <Check size={28} className="text-gold-400" aria-hidden="true" />
          </div>
        </div>

        <p className="eyebrow mb-4">Your note just landed</p>
        <h1 className="heading-display text-green-800 mb-6 text-[clamp(2rem,5vw,3rem)]">
          We Are So Glad<br />
          <em className="text-gold-ink not-italic">You Reached Out</em>
        </h1>

        <p className="body-text mb-4">
          Your note just landed with us, and one of us will be in touch today, usually within the
          hour, {methodPhrase}. In the meantime, consider this a standing invitation.
        </p>
        <p className="body-text text-sm text-muted mb-12">
          The gate is open, and there is a spot at the rail with your name on it. If anything comes
          up before we reach you, you can always call us at{' '}
          <a href={BRAND.phoneHref} className="text-green-800 underline underline-offset-2 focus-ring">
            {BRAND.phoneDisplay}
          </a>
          . Talk soon.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/" className="btn-primary">
            Return Home
            <ArrowRight size={16} />
          </Link>
          <Link to="/about" className="btn-outline-gold">
            Our Story
          </Link>
        </div>

        {/* Location note */}
        <div className="mt-14 pt-10 border-t border-green-800/10">
          <p className="text-xs font-sans text-muted leading-relaxed">
            French Heritage Equestrian · Carmel Creek Ranch · San Diego, CA<br />
            Fully licensed &amp; insured equestrian business
          </p>
        </div>

      </div>
    </div>
  );
}
