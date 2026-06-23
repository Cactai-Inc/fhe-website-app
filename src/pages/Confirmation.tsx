import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';

export default function Confirmation() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 pt-24 pb-20">
      <div className="max-w-xl w-full text-center">

        {/* Check icon */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-green-800 flex items-center justify-center">
            <Check size={28} className="text-gold-400" />
          </div>
        </div>

        <p className="eyebrow mb-4">Booking Received</p>
        <h1
          className="font-display font-light text-green-800 mb-6"
          style={{
            fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
          }}
        >
          We Look Forward<br />
          <em className="text-gold-700 not-italic">to Meeting You</em>
        </h1>

        <p className="body-text mb-4">
          Your booking request has been received. A member of the French Heritage Equestrian team will be in touch within one business day to confirm your schedule and answer any questions.
        </p>
        <p className="body-text text-sm text-green-800/60 mb-12">
          In the meantime, feel free to explore our facility, our story, or reach us directly at{' '}
          <a href="tel:+16195550000" className="text-green-800 underline underline-offset-2">
            (619) 555-0000
          </a>
          .
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
          <p className="text-xs font-sans text-green-800/40 leading-relaxed">
            French Heritage Equestrian · Carmel Creek Ranch · San Diego, CA<br />
            Fully licensed &amp; insured equestrian business
          </p>
        </div>

      </div>
    </div>
  );
}
