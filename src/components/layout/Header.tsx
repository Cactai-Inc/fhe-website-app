import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ShoppingBag } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

const NAV_LINKS = [
  { label: 'Our Story', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Book', href: '/services' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { itemCount } = useCart();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => setOpen(false), [location]);

  // On home, header is transparent until scrolled; on other pages always solid
  const solid = !isHome || scrolled;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        solid ? 'bg-green-800 shadow-lg shadow-green-900/20' : 'bg-transparent'
      }`}
    >
      <div className="container-site flex items-center justify-between h-16 sm:h-20">

        {/* Logo */}
        <Link
          to="/"
          className="flex flex-col items-start leading-none group"
          aria-label="French Heritage Equestrian — Home"
        >
          <span
            className="font-display text-white text-base sm:text-lg tracking-wide uppercase"
            style={{ fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif' }}
          >
            French Heritage
          </span>
          <span className="text-gold-400 text-[10px] tracking-widest uppercase font-sans font-light">
            Equestrian
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className={`text-xs font-sans tracking-widest uppercase transition-colors duration-200 ${
                location.pathname === link.href
                  ? 'text-gold-400'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {itemCount > 0 && (
            <Link
              to="/checkout"
              className="hidden sm:flex items-center gap-2 text-xs font-sans tracking-wide text-white/80 hover:text-white transition-colors"
              aria-label={`${itemCount} items in cart`}
            >
              <span className="relative">
                <ShoppingBag size={18} />
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gold-600 text-white text-[9px] flex items-center justify-center rounded-full font-medium">
                  {itemCount}
                </span>
              </span>
            </Link>
          )}

          <Link
            to="/services"
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2 border border-gold-600/60 text-white text-xs font-sans tracking-widest uppercase transition-all duration-200 hover:bg-gold-600 hover:border-gold-600"
          >
            Book Now
          </Link>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-white p-1"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-green-900 border-t border-white/10">
          <nav className="container-site py-6 flex flex-col gap-5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="text-sm font-sans tracking-widest uppercase text-white/80 hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/services"
              className="mt-2 btn-ghost-white text-center justify-center"
            >
              Book Now
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
