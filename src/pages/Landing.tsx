import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

/* The front door — a single-viewport, no-scroll, no-footer cinematic hero.
 *
 * Treatment (owner-directed): a STILL, full-bleed, high-impact image — crisp
 * and confident, no Ken Burns / no looping background motion. A rich green
 * scrim drives figure-ground contrast so a big Cormorant headline lands hard.
 * The only motion is a single gentle rise-on-load entrance, reduced-motion
 * guarded. Built swap-ready: drop a real clip in later behind the same scrim
 * without unwinding a motion crutch.
 *
 * Scroll-lock is scoped to THIS route: on mount we add `qs-no-scroll` to
 * <html>; on unmount we remove it. The rest of the site scrolls normally.
 * SSR/prerender-safe — the effect only touches document in the browser.
 */
const HERO_IMG = '/reference-images/Hero_A.png';

// Naked top nav (transparent over the hero). Ride With Us and Our Story both
// point at /story this pass — intentional.
const NAV_LINKS = [
  { label: 'Ride With Us', href: '/story' },
  { label: 'Find a Horse', href: '/acquisition' },
  { label: 'Our Story', href: '/story' },
  { label: 'Say Hello', href: '/contact' },
];

export default function Landing() {
  const seo = seoForPath('/')!;

  // Scope the scroll-lock to the landing route only. Guarded for SSR: the
  // effect never runs during prerender, so no global scroll break ships.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('qs-no-scroll');
    return () => root.classList.remove('qs-no-scroll');
  }, []);

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/" />

      {/* Full-bleed hero filling exactly one viewport. 100dvh accounts for
          mobile browser chrome; the fixed inset means the page itself never
          scrolls even before the html-level lock applies. */}
      <div className="fixed inset-0 h-[100dvh] w-full overflow-x-hidden overflow-y-hidden bg-green-950">

        {/* Still background image — no animation. Positioned to hold the riders
            and the coastline in frame across aspect ratios. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${HERO_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 32%',
          }}
          role="img"
          aria-label="Three riders on horseback at a coastal San Diego ranch, at sunset."
        />

        {/* Rich green scrim — a bold, layered gradient that darkens the frame
            toward the center-bottom where the type sits, so the headline holds
            well past 4.5:1 without flattening the image. Two passes: a vertical
            deep-to-light and a centered radial vignette. */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-950/80 via-green-950/45 to-green-950/85" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 50% 42%, rgba(10,26,15,0) 0%, rgba(10,26,15,0.35) 62%, rgba(10,26,15,0.72) 100%)',
          }}
        />

        {/* Filmic grain — tasteful, static, very light. */}
        <div className="qs-grain absolute inset-0 pointer-events-none" aria-hidden="true" />

        {/* ── Naked nav ─────────────────────────────────────────────────── */}
        <header className="absolute top-0 left-0 right-0 z-20">
          <div className="container-site flex items-center justify-between py-5 sm:py-7">

            {/* Wordmark */}
            <Link
              to="/"
              className="flex flex-col items-start leading-none group focus-ring-dark min-h-[44px] justify-center"
              aria-label="French Heritage Equestrian — Home"
            >
              <span className="font-display text-on-dark text-base sm:text-lg tracking-wide uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
                French Heritage
              </span>
              <span className="text-gold-400 text-[10px] tracking-widest uppercase font-sans font-light">
                Equestrian
              </span>
            </Link>

            {/* Right cluster: four links + understated Sign In */}
            <div className="flex items-center gap-6 lg:gap-9">
              <nav className="hidden md:flex items-center gap-8 lg:gap-10" aria-label="Primary">
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="group relative inline-flex items-center min-h-[44px] text-xs font-sans tracking-widest uppercase text-on-dark-soft hover:text-white transition-colors duration-200 focus-ring-dark"
                  >
                    {link.label}
                    {/* Gold hairline underline on hover — the only glint here. */}
                    <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-gold-400 transition-all duration-300 group-hover:w-full" aria-hidden="true" />
                  </Link>
                ))}
              </nav>

              <Link
                to="/login"
                className="inline-flex items-center min-h-[44px] text-[11px] font-sans tracking-widest uppercase text-white/55 hover:text-white/90 transition-colors duration-200 focus-ring-dark"
              >
                Sign In
              </Link>
            </div>
          </div>
        </header>

        {/* ── Centered hero content ─────────────────────────────────────── */}
        <div className="relative z-10 h-full w-full flex items-center justify-center px-5 sm:px-8">
          <div className="w-full max-w-4xl text-center mx-auto">

            <p className="eyebrow-on-dark qs-rise qs-delay-1 mb-5 sm:mb-8 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
              San Diego · Carmel Valley
            </p>

            <h1 className="qs-rise qs-delay-2 font-display font-semibold text-white leading-[1.05] sm:leading-[1.02] tracking-[-0.01em] [text-wrap:balance] [overflow-wrap:break-word] text-[clamp(2.05rem,7.4vw,7rem)] [text-shadow:0_2px_28px_rgba(0,0,0,0.55)]">
              Where horsemanship
              <br className="hidden sm:block" />{' '}
              becomes a way of life.
            </h1>

            <p className="qs-rise qs-delay-3 mx-auto mt-6 sm:mt-9 max-w-md sm:max-w-xl text-sm sm:text-lg font-sans font-light text-on-dark-soft leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
              A serious riding community on the coast — the horse, the work, and
              the people who make a ranch feel like home.
            </p>

            <div className="qs-rise qs-delay-4 mt-10 sm:mt-12 flex justify-center">
              <Link
                to="/story"
                className="group inline-flex items-center gap-3 px-9 py-4 bg-white text-green-900 font-sans text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-950"
              >
                Come ride with us
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile nav shortcut — a single quiet row so the four destinations
            aren't stranded on phones without adding a full menu drawer. Sits
            low in the frame, well inside 100dvh. */}
        <nav
          className="md:hidden absolute bottom-6 left-0 right-0 z-20"
          aria-label="Primary (mobile)"
        >
          <div className="container-site flex items-center justify-center gap-x-5 gap-y-2 flex-wrap">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className="inline-flex items-center min-h-[44px] text-[10px] font-sans tracking-widest uppercase text-white/60 hover:text-white transition-colors focus-ring-dark"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </>
  );
}
