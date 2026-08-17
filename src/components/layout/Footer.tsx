import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Phone, Mail, ExternalLink } from 'lucide-react';
import { BRAND } from '../../lib/brand';

// Live `locations` row for Carmel Creek Ranch (id 2d771cea-…, verified
// against prod, 2026-08-17): address_line1 "11600 Clews Ranch Road", San
// Diego, CA 92130 — differs from an older migration comment that said
// "11500", so this is taken from the DB, not that file. "Ste A" per the
// owner (2026-08-17): the Google listing carries a suite letter CCR's own
// address doesn't.
const MAP_QUERY = 'French Heritage Equestrian, 11600 Clews Ranch Road, Ste A, San Diego, CA 92130';
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`;
// Universal Maps URL (google.com/maps/search) — on a phone with the Google
// Maps app installed this opens the app itself (iOS treats it as a
// universal link); otherwise it opens Google Maps in the browser. Either
// way the visitor lands on the business listing with Google's own
// Directions button, not a page we built. If the owner has the Business
// Profile's own share link (a maps.app.goo.gl/… or a `cid=` URL), swapping
// it in here is a one-line change — that would point more precisely at the
// verified listing than a name+address search does.
const MAPS_LISTING_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`;

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
          </div>

          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-xs font-sans text-white/[0.6] leading-relaxed">
              Fully licensed &amp; insured equestrian business.
              <br />Operating at Carmel Creek Ranch, San Diego, CA.
            </p>
          </div>
        </div>

        {/* Map — tap opens the listing in Google/Apple Maps for directions;
            the iframe underneath is a non-interactive visual preview. */}
        <div className="relative rounded-lg overflow-hidden border border-white/10 aspect-[4/3] md:aspect-auto md:h-full min-h-[220px]">
          <iframe
            src={MAP_EMBED_SRC}
            title="Map showing French Heritage Equestrian at Carmel Creek Ranch, San Diego, CA"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            tabIndex={-1}
            aria-hidden="true"
            className="w-full h-full border-0 pointer-events-none"
          />
          <a
            href={MAPS_LISTING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute inset-0 focus-ring-dark"
            aria-label="Open French Heritage Equestrian in Maps for directions"
          >
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-green-950/90 text-gold-300 text-[11px] font-sans tracking-wide px-2.5 py-1.5 rounded">
              <ExternalLink size={12} aria-hidden="true" />
              Get Directions
            </span>
          </a>
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
