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
          scrolls even before the html-level lock applies.
          data-header-tone="dark": the header sits over this dark hero → white nav. */}
      <div
        data-header-tone="dark"
        className="fixed inset-0 h-[100dvh] w-full overflow-x-hidden overflow-y-hidden bg-green-950"
      >

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

        {/* ── Hero content ──────────────────────────────────────────────────
            Phones: bottom-anchored — the CTA sits ~13% up from the bottom edge
            (owner spec 2026-08-14), which drops the whole text block below the
            riders' faces instead of across them (centered content on a tall
            phone viewport landed the eyebrow right on the faces).
            sm+: centered, exactly as before. */}
        <div className="relative z-10 h-full w-full flex items-end pb-[13dvh] sm:items-center sm:pb-0 justify-center px-5 sm:px-8">
          <div className="w-full max-w-4xl text-center mx-auto">

            {/* Eyebrow / location — enlarged and brightened so it is clearly
                readable over the hero (was too faint). */}
            <p className="qs-rise qs-delay-1 mb-6 sm:mb-8 font-sans font-medium tracking-widest uppercase text-gold-300 text-sm sm:text-base [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
              {/* Each phrase is unbreakable: narrow screens wrap at the
                  separator only — never mid-phrase ("San" / "Diego"). */}
              <span className="whitespace-nowrap">Carmel Creek Ranch</span> ·{' '}
              <span className="whitespace-nowrap">Coastal San Diego</span>
            </p>

            {/* Headline — reduced from a screen-dominating clamp so it is
                commanding but balanced, leaving the eyebrow + CTA visible. */}
            {/* Phones: each sentence wraps to two lines (four total), so the
                leading opens to 1.18 and the gold sentence gets its own block
                with breathing room; sm+ keeps the original tight 1.08. */}
            <h1 className="qs-rise qs-delay-2 heading-display text-white leading-[1.18] sm:leading-[1.08] tracking-[-0.01em] [text-wrap:balance] [overflow-wrap:break-word] text-[clamp(1.9rem,5vw,3.75rem)] [text-shadow:0_2px_24px_rgba(0,0,0,0.55)]">
              Join Our Riding Community
              <em className="block mt-2 sm:mt-1 text-gold-300 not-italic">California Days Are Made For This</em>
            </h1>

            {/* CTA — the ONLY action on the landing, so it is enlarged and made
                unmistakable: a larger italic-serif label with a solid gold
                underline and arrow, strong contrast over the hero. */}
            <div className="qs-rise qs-delay-4 mt-10 sm:mt-14 flex justify-center">
              {/* The only CTA on the landing goes to the booking funnel
                  (/lessons, the rider entry), not the Story page — a visitor
                  who clicks "Come ride with us" is asking to ride. */}
              <Link
                to="/lessons"
                className="group inline-flex items-center gap-4 focus-ring-dark"
              >
                <span className="font-serif italic text-3xl sm:text-4xl lg:text-[2.75rem] text-white border-b-2 border-gold-300 pb-1.5 group-hover:border-gold-200 transition-colors [text-shadow:0_2px_18px_rgba(0,0,0,0.6)]">
                  Come ride with us
                </span>
                <ArrowRight
                  className="w-7 h-7 sm:w-8 sm:h-8 text-gold-300 transition-transform duration-300 group-hover:translate-x-1.5 [filter:drop-shadow(0_2px_10px_rgba(0,0,0,0.5))]"
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
