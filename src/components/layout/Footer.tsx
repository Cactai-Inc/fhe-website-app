import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MapPin, Phone, Mail, Clock } from 'lucide-react';
import { BRAND } from '../../lib/brand';
import { useCart } from '../../contexts/CartContext';

// Owner, 2026-08-17: the geocoded business address (11500 Clews Ranch Rd
// Ste A — Google's own number; the `locations` table's "11600" doesn't
// match the real Business Profile, flagged separately, DB left untouched)
// pins at the building, but that is NOT where visitors should be routed —
// there are two forks in the road and, without the pin at the actual
// turn-in, people get lost. The owner dropped a pin at the real arrival
// point (right off the CA-56 Carmel Creek Rd exit, the immediate right
// turn at the FHE/CCR sign), first as a maps.app.goo.gl link (resolved to
// 32.939204,-117.219696), then confirmed with the Plus Code read straight
// off their own Maps app — "WQQJ+M4 San Diego, California" — which
// resolves to 32.9391875,-117.2196875, a few meters from the first
// reading, same spot. Using the Plus Code itself as the query since it's
// what the owner is actually looking at. A bare-location pin like this has
// no business-name label/info card (unlike the address+name query above
// did), which is the right trade here: accurate turn-by-turn over a pretty
// pin.
const MAP_QUERY = 'WQQJ+M4 San Diego, California';
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&output=embed`;

export default function Footer() {
  const { user } = useAuth();
  // ⚠️ THE SELECTION BAR IS `position: fixed`, SO IT IS OUT OF FLOW AND NOTHING
  // BELOW IT KNOWS IT EXISTS. Owner, 2026-08-17: "the bottom of page continue
  // overlay doesnt tell the page to provide more room at the bottom below the
  // footer, so its overlapping it."
  //
  // The funnel pages each carry `pb-36`, which protects THEIR OWN last card —
  // but the footer is a sibling rendered after them, so that padding does
  // nothing for it and the bar sat on top of the copyright line. The reserve has
  // to live on the last thing in the document, which is this. It is conditional
  // because the bar itself is conditional: no selection, no bar, no dead space.
  const { itemCount } = useCart();
  return (
    <footer
      id="site-footer"
      className={`bg-green-900 text-white ${itemCount > 0 ? 'pb-24' : ''}`}
    >

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
            Family-run full-service equestrian program and rider community featuring riding
            lessons and jumper training in the classical European style, alongside horse care
            services and support for purchasing and leasing, located in beautiful coastal San Diego.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="eyebrow-on-dark mb-5 text-center">Navigation</p>
          <nav className="flex flex-col items-center gap-3 text-center" aria-label="Footer">
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
            {/* ⚠️ THE VISIT REQUEST'S DOOR. Owner, 2026-09-01: *"we didnt add this
                to the website as a request option and we should."* It goes in the
                FOOTER rather than the header deliberately — the header row's fit
                floor is 940px and it already carries four labels; a fifth is the
                measurement that broke it before (TASK-BP410). Where else it should
                appear is the owner's call, not a guess made here. */}
            <Link
              to="/visit"
              className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
            >
              Visit us
            </Link>
            {/* Owner, 2026-08-17: FAQ moved to the last position. */}
            <Link
              to="/faq"
              className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
            >
              FAQ
            </Link>
          </nav>
        </div>

        {/* Contact */}
        <div>
          <p className="eyebrow-on-dark mb-5">Find Us</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-gold-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
              {/* The full postal address, owner 2026-08-17. It is the business
                  address that the file header above already names — Google's own
                  number for the Business Profile, not the `locations` table's
                  "11600", which still disagrees and is still flagged. The MAP pin
                  deliberately does NOT use it: visitors are routed to the turn-in
                  Plus Code instead, for the reason set out in that header. So this
                  block and the map answer two different questions on purpose —
                  "where are you" and "how do I get in". */}
              <address className="not-italic">
                <p className="text-sm font-sans text-white/85">Carmel Creek Ranch</p>
                <p className="text-sm font-sans text-white/[0.7]">11500 Clews Ranch Rd, Ste A</p>
                <p className="text-sm font-sans text-white/[0.7]">San Diego, CA 92130</p>
                <p className="text-xs font-sans text-white/[0.6] mt-0.5">2.5 miles from Torrey Pines Beach</p>
              </address>
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
        {/* Owner, 2026-08-17: copyright LEFT, Cactai mark RIGHT — they swapped
            sides and the copyright came off the centre line. The 3-track grid
            existed only to hold that centre (its third track was a spacer), so
            it goes: with two items pinned to opposite edges, `justify-between`
            says what the layout means and there is no empty track to explain.
            Below `sm` they stack centred, copyright first, as before. */}
        <div className="container-site py-5 flex flex-col sm:flex-row items-center sm:justify-between gap-2 text-center sm:text-left">
          <p className="text-xs font-sans text-white/[0.6]">
            &copy; {new Date().getFullYear()} French Heritage Equestrian. All rights reserved.
          </p>
          <p className="text-xs font-sans text-white/[0.6]">
            {/* Cactai URL not yet supplied (F4) — wrap in <a href={CACTAI_URL}
                target="_blank" rel="noopener noreferrer"> once the owner provides it. */}
            Designed, Built &amp; Maintained by Cactai Inc.
          </p>
        </div>
      </div>

    </footer>
  );
}
