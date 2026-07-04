import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';
import Header from '../components/layout/Header';

/* The front door — a single-viewport, no-scroll, no-footer cinematic hero.
 *
 * Treatment (owner-directed): a STILL, full-bleed, high-impact image — crisp
 * and confident, no Ken Burns / no looping background motion. A rich green
 * scrim drives figure-ground contrast so a big Cormorant headline lands hard.
 * The only motion is a single gentle rise-on-load entrance, reduced-motion
 * guarded.
 *
 * Header: the landing uses the SAME shared <Header> as every inner page (one
 * header everywhere). It stays naked here (the landing never scrolls, so the
 * minify+frost never triggers). The page renders bare (no Layout footer chrome).
 *
 * Scroll-lock is scoped to THIS route: on mount we add `qs-no-scroll` to
 * <html>; on unmount we remove it. The rest of the site scrolls normally.
 * SSR/prerender-safe — the effect only touches document in the browser.
 */
const HERO_IMG = '/reference-images/Hero_A.png';

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

      {/* The one shared header — naked over the hero. */}
      <Header />

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

        {/* ── Centered hero content ─────────────────────────────────────── */}
        <div className="relative z-10 h-full w-full flex items-center justify-center px-5 sm:px-8">
          <div className="w-full max-w-4xl text-center mx-auto">

            <p className="eyebrow-on-dark qs-rise qs-delay-1 mb-5 sm:mb-8 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
              Carmel Creek Ranch · Coastal San Diego
            </p>

            <h1 className="qs-rise qs-delay-2 heading-display text-white leading-[1.05] sm:leading-[1.02] tracking-[-0.01em] [text-wrap:balance] [overflow-wrap:break-word] text-[clamp(2.05rem,7.4vw,6.5rem)] [text-shadow:0_2px_28px_rgba(0,0,0,0.55)]">
              Join Our Riding Community
              <br />
              <em className="text-gold-300 not-italic">California Days Are Made For This</em>
            </h1>

            <div className="qs-rise qs-delay-4 mt-10 sm:mt-12 flex justify-center">
              <Link
                to="/story"
                className="group inline-flex items-center gap-3 focus-ring-dark"
              >
                <span className="font-serif italic text-2xl sm:text-3xl text-white border-b border-gold-300/60 pb-1 group-hover:border-gold-300 transition-colors [text-shadow:0_2px_16px_rgba(0,0,0,0.5)]">
                  Come ride with us
                </span>
                <ArrowRight
                  size={22}
                  className="text-gold-300 transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
