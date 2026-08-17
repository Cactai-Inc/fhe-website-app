import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { BRAND } from '../../lib/brand';

// Address per Google's OWN verified listing card (confirmed by rendering
// the embed standalone and reading its info popup, 2026-08-17): "11500
// Clews Ranch Rd Ste A, San Diego, CA 92130". This does NOT match the
// `locations` table's `address_line1` ("11600 Clews Ranch Road", row
// 2d771cea-…) — a real discrepancy between the DB and the Google Business
// Profile, flagged for the owner rather than silently written to the DB
// (out of scope for a presentation-only task). Using Google's own number
// here since it's what Google needs to keep matching its own listing.
// Owner, 2026-08-17: this is still the mailing/geocoded address, which
// Google pins at the building — NOT where visitors are actually routed
// (the property's real entrance is off the CA-56 Carmel Creek Rd exit, an
// immediate right turn at the FHE/CCR sign). Awaiting exact coordinates for
// that arrival point; using the verified business address+name until then,
// which at least resolves to the real listing rather than a bare geocode.
const MAP_QUERY = 'French Heritage Equestrian, 11500 Clews Ranch Rd Ste A, San Diego, CA 92130';
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`;

export default function Footer() {
  const { user } = useAuth();
  return (
    <footer id="site-footer" className="bg-green-900 text-white">

      {/* Main footer */}
      <div className="container-site py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-10">

        {/* Brand column */}
        <div>
          <div className="mb-6">
            <p className="font-display text-white text-xl tracking-wide uppercase">
              French Heritage
            </p>
            <p className="text-gold-400 text-[10px] tracking-widest uppercase font-sans font-light">
              Equestrian
            </p>
          </div>
          <p className="text-sm font-sans text-white/[0.7] leading-relaxed max-w-xs">
            A family-run hunter/jumper ranch and community, rooted in classical European
            horsemanship, offering lessons, horse care, and acquisition support in coastal San Diego.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="eyebrow-on-dark mb-5">Navigation</p>
          <nav className="flex flex-col gap-3" aria-label="Footer">
            {[
              { label: 'Home', href: '/' },
              { label: 'Our Community', href: '/story' },
              // Owner, 2026-08-16: the public catalog (/shop) is hidden — a web
              // visitor is funnelled straight to the thing they came for, not
              // shown a browsable list that invites comparison. 'Ways to Ride'
              // pointed there and is gone; the three funnels below ARE the ways.
              { label: 'Book a Lesson', href: '/lessons' },
              { label: 'Horse Care', href: '/horse' },
              { label: 'Acquisition Support', href: '/acquisition' },
              { label: 'Gift a Service', href: '/gift' },
              { label: 'FAQ', href: '/faq' },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
              >
                {link.label}
              </Link>
            ))}
            {/* Was a discreet bottom-bar link (F2); now an ordinary nav item. */}
            <Link
              to={user ? '/app' : '/login'}
              className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
            >
              {user ? 'Member area' : 'Member sign-in'}
            </Link>
          </nav>
        </div>

        {/* Contact */}
        <div>
          <p className="eyebrow-on-dark mb-5">Find Us</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-gold-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-sans text-white/85">Carmel Creek Ranch</p>
                <p className="text-sm font-sans text-white/[0.7]">San Diego, CA</p>
                <p className="text-xs font-sans text-white/[0.6] mt-0.5">2.5 miles from Torrey Pines Beach</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-gold-400 flex-shrink-0" aria-hidden="true" />
              <a
                href={BRAND.phoneHref}
                className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
              >
                {BRAND.phoneDisplay}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-gold-400 flex-shrink-0" aria-hidden="true" />
              <a
                href={BRAND.emailHref}
                className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors break-all focus-ring-dark"
              >
                {BRAND.email}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-gold-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm font-sans text-white/[0.7]">8:00 AM – 7:00 PM, 7 days a week</p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-xs font-sans text-white/[0.6] leading-relaxed">
              Fully licensed &amp; insured equestrian business.
              <br />Operating at Carmel Creek Ranch, San Diego, CA.
            </p>
          </div>
        </div>

        {/* Map — Google's own embed: zoomable/pannable, and its built-in
            "Open in Maps" control is the offer-to-open-Maps affordance. */}
        <div className="border border-white/10 aspect-[4/3] md:aspect-auto md:h-full min-h-[220px]">
          <iframe
            src={MAP_EMBED_SRC}
            title="Map showing French Heritage Equestrian at Carmel Creek Ranch, San Diego, CA"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full border-0"
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-site py-5 grid grid-cols-1 sm:grid-cols-3 items-center gap-2 text-center sm:text-left">
          <p className="text-xs font-sans text-white/[0.6] sm:justify-self-start">
            {/* Cactai URL not yet supplied (F4) — wrap in <a href={CACTAI_URL}
                target="_blank" rel="noopener noreferrer"> once the owner provides it. */}
            Designed, Built &amp; Maintained by Cactai Inc.
          </p>
          <p className="text-xs font-sans text-white/[0.6] sm:justify-self-center">
            &copy; {new Date().getFullYear()} French Heritage Equestrian. All rights reserved.
          </p>
          <p className="text-xs font-sans text-white/[0.6] sm:justify-self-end">
            San Diego, California
          </p>
        </div>
      </div>

    </footer>
  );
}
