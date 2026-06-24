import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

/* The front door. Deliberately bare: a landing video, a hero statement, the
 * "come ride with us" invitation (an opening of the door, not a CTA), and two
 * quiet alternate-service entries. Contact lives top-right in the header.
 *
 * Video: drop a real clip at /public/hero.mp4 (+ /hero.webm) and a poster at
 * /public/hero-poster.jpg. Until then the poster image carries the hero.
 */
const HERO_POSTER = '/reference-images/hero.png';
const HERO_MP4 = '/hero.mp4';
const HERO_WEBM = '/hero.webm';

export default function Landing() {
  const seo = seoForPath('/')!;
  const reducedMotion = usePrefersReducedMotion();

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/" />

      <section className="relative h-screen min-h-[600px] overflow-hidden flex flex-col">
        {/* Landing video (poster shown until/instead of video; no autoplay under reduced-motion) */}
        {reducedMotion ? (
          <div
            className="absolute inset-0"
            style={{ backgroundImage: `url('${HERO_POSTER}')`, backgroundSize: 'cover', backgroundPosition: 'center 35%' }}
          />
        ) : (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={HERO_POSTER}
          >
            <source src={HERO_WEBM} type="video/webm" />
            <source src={HERO_MP4} type="video/mp4" />
          </video>
        )}

        {/* Overlay: stronger from the left/bottom where the words sit, so the
            statement and the invitation stay legible over bright footage. */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-950/85 via-green-950/45 to-green-900/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/80 via-transparent to-green-950/30" />

        {/* Hero statement + the door */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="container-site w-full">
            <div className="max-w-2xl">
              <p className="eyebrow-on-dark mb-6 animate-fade-up [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">Carmel Creek Ranch · Coastal San Diego</p>
              <h1 className="heading-display text-white mb-10 animate-fade-up delay-100 text-[clamp(2.75rem,7vw,5.25rem)] [text-shadow:0_2px_20px_rgba(0,0,0,0.45)]">
                Join Our Riding Community
                <br />
                <em className="text-gold-300 not-italic">California Days Are Made For This</em>
              </h1>

              {/* The invitation — an opening of the door, not a button */}
              <Link
                to="/ride"
                className="group inline-flex items-center gap-3 animate-fade-up delay-200 focus-ring-dark"
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

        {/* Two quiet alternate-service entries, low in the frame */}
        <div className="relative z-10 pb-10">
          <div className="container-site flex flex-col sm:flex-row gap-x-8 gap-y-3 animate-fade-in delay-500">
            <Link
              to="/horse"
              className="inline-flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
            >
              Care for your horse
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
            <Link
              to="/acquisition"
              className="inline-flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-white/[0.7] hover:text-white transition-colors focus-ring-dark"
            >
              Find a horse of your own
              <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
