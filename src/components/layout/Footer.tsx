import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import { BRAND } from '../../lib/brand';

export default function Footer() {
  return (
    <footer className="bg-green-900 text-white">

      {/* Main footer */}
      <div className="container-site py-16 grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">

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
            A family-run hunter/jumper barn and community, rooted in classical European
            horsemanship, offering lessons, horse care, and acquisition support in coastal San Diego.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="eyebrow-on-dark mb-5">Navigation</p>
          <nav className="flex flex-col gap-3" aria-label="Footer">
            {[
              { label: 'Home', href: '/' },
              { label: 'Our Story', href: '/about' },
              { label: 'Ways to Ride', href: '/services' },
              { label: 'Rider Services', href: '/book/rider' },
              { label: 'Horse Services', href: '/book/horse' },
              { label: 'Rider Support', href: '/book/support' },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-sans text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
              >
                {link.label}
              </Link>
            ))}
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
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-site py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-sans text-white/[0.6]">
            &copy; {new Date().getFullYear()} French Heritage Equestrian. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <p className="text-xs font-sans text-white/[0.6]">San Diego, California</p>
            {/* Discreet member entrance — invite-only, intentionally low-key. */}
            <Link
              to="/login"
              className="text-xs font-sans text-white/[0.45] hover:text-white/80 transition-colors focus-ring-dark"
            >
              Member sign-in
            </Link>
          </div>
        </div>
      </div>

    </footer>
  );
}
