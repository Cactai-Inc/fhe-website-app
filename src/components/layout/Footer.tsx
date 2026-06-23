import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-green-900 text-white">

      {/* Main footer */}
      <div className="container-site py-16 grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16">

        {/* Brand column */}
        <div>
          <div className="mb-6">
            <p
              className="font-display text-white text-xl tracking-wide uppercase"
              style={{ fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif' }}
            >
              French Heritage
            </p>
            <p className="text-gold-400 text-[10px] tracking-widest uppercase font-sans font-light">
              Equestrian
            </p>
          </div>
          <p className="text-sm font-sans text-white/60 leading-relaxed max-w-xs">
            A family-owned equestrian business rooted in European tradition, offering world-class riding instruction, horse care, and acquisition services in the heart of San Diego.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <p className="eyebrow text-gold-400 mb-5">Navigation</p>
          <nav className="flex flex-col gap-3">
            {[
              { label: 'Home', href: '/' },
              { label: 'Our Story', href: '/about' },
              { label: 'Services', href: '/services' },
              { label: 'Rider Services', href: '/book/rider' },
              { label: 'Horse Services', href: '/book/horse' },
              { label: 'Rider Support', href: '/book/support' },
            ].map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-sans text-white/60 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Contact */}
        <div>
          <p className="eyebrow text-gold-400 mb-5">Find Us</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-gold-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-sans text-white/80">Carmel Creek Ranch</p>
                <p className="text-sm font-sans text-white/60">San Diego, CA</p>
                <p className="text-xs font-sans text-white/40 mt-0.5">2.5 miles from Torrey Pines Beach</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone size={16} className="text-gold-600 flex-shrink-0" />
              <a
                href="tel:+16195550000"
                className="text-sm font-sans text-white/60 hover:text-white transition-colors"
              >
                (619) 555-0000
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-gold-600 flex-shrink-0" />
              <a
                href="mailto:hello@frenchheritagequestrian.com"
                className="text-sm font-sans text-white/60 hover:text-white transition-colors break-all"
              >
                hello@frenchheritage.com
              </a>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-xs font-sans text-white/40 leading-relaxed">
              Fully licensed &amp; insured equestrian business.
              <br />Operating at Carmel Creek Ranch, San Diego, CA.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="container-site py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs font-sans text-white/40">
            &copy; {new Date().getFullYear()} French Heritage Equestrian. All rights reserved.
          </p>
          <p className="text-xs font-sans text-white/30">
            San Diego, California
          </p>
        </div>
      </div>

    </footer>
  );
}
