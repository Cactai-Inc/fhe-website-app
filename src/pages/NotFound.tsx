import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useDocumentTitle } from '../lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page Not Found');
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center pt-24 pb-20">
      <div className="container-site max-w-lg text-center">
        <p className="eyebrow mb-4">Lost the trail</p>
        <h1 className="heading-display text-green-800 mb-5">This page wandered off.</h1>
        <p className="body-text mb-10">
          The page you were looking for isn't here. Let's get you back to the barn — the gate is
          always open.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/" className="btn-primary">
            Return Home
            <ArrowRight size={16} />
          </Link>
          <Link to="/services" className="btn-outline-gold">
            Ways to Ride
          </Link>
        </div>
      </div>
    </div>
  );
}
