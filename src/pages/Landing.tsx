import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

/* ─── Imagery ────────────────────────────────────────────────────────────────
 * Hero + community use the on-brand reference shots: adult women riding together
 * in coastal light, English tack. Off-ramp + setting imagery stays calm/grounded.
 */
const HERO_IMG = '/reference-images/Gemini_Generated_Image_f3u06df3u06df3u0.png';
const COMMUNITY_IMG = '/reference-images/Gemini_Generated_Image_n7l8hpn7l8hpn7l8.png';
const SETTING_IMG = 'https://images.pexels.com/photos/1996337/pexels-photo-1996337.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';
const CARE_IMG = 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=900&q=80';

export default function Landing() {
  const seo = seoForPath('/')!;
  const heroRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  // Subtle hero parallax — disabled entirely under reduced-motion.
  useEffect(() => {
    if (reducedMotion) return;
    const onScroll = () => {
      if (heroRef.current) {
        // Compose the base zoom (scale) with the translate so the 110% zoom
        // isn't dropped once scrolling begins (fixes the edge-reveal bug).
        heroRef.current.style.transform = `scale(1.1) translateY(${window.scrollY * 0.15}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/" />
      {/* ── Hero: the rider community, and nothing else ──────────────── */}
      <section className="relative h-screen min-h-[600px] overflow-hidden flex items-end sm:items-center">
        <div
          ref={heroRef}
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url('${HERO_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
          }}
        />
        {/* Soft, warm overlay — lighter than before so the light leads */}
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/75 via-green-900/25 to-green-900/10" />

        <div className="relative z-10 container-site w-full pb-16 sm:pb-0">
          <div className="max-w-2xl">
            <p className="eyebrow-on-dark mb-6 animate-fade-up">Carmel Creek Ranch · Coastal San Diego</p>
            <h1 className="heading-display text-white mb-6 animate-fade-up delay-100 text-[clamp(2.75rem,7vw,5rem)]">
              Some mornings
              <br />
              <em className="text-gold-300 not-italic">belong to you.</em>
            </h1>
            <p className="font-sans text-white/[0.85] text-lg max-w-lg mb-10 animate-fade-up delay-200 leading-relaxed">
              Out here the ocean air comes up over the arena and the rest of the week waits at the
              gate. We are a community of women who ride for the love of it — for the quiet, the
              company, and the feeling of being good at something entirely your own. However long it
              has been, there is a place for you here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up delay-300">
              <Link to="/services" className="btn-ghost-white">
                Come Ride With Us
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 right-8 hidden lg:flex items-center gap-2 text-white/[0.7] text-xs font-sans tracking-wide">
          <MapPin size={12} className="text-gold-400" aria-hidden="true" />
          <span>2.5 miles from Torrey Pines Beach</span>
        </div>
      </section>

      {/* ── Welcome (warm, just below the hero) ──────────────────────── */}
      <section className="bg-cream py-20 sm:py-24">
        <div className="container-site max-w-2xl text-center">
          <p className="body-text text-lg leading-relaxed text-secondary">
            You do not have to have ridden in years. You do not have to have ridden at all. What you
            need is a couple of mornings a week that are yours, a horse that is glad to see you, and
            a few women who will save you a spot at the rail. The riding comes, patiently and
            properly, the way it should. The belonging comes faster than you would think.
          </p>
        </div>
      </section>

      {/* ── The community ────────────────────────────────────────────── */}
      <section className="bg-cream-50 py-20 sm:py-28">
        <div className="container-site grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative overflow-hidden aspect-[4/3] order-2 lg:order-1">
            <img
              src={COMMUNITY_IMG}
              alt="Women riding together at Carmel Creek Ranch in warm coastal light"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow mb-4">The community</p>
            <h2 className="heading-section text-green-800 mb-6">Rarely alone in the arena.</h2>
            <p className="body-text mb-5">
              Most of our riding happens together. Group rides in the morning light, where you are
              learning beside women who started right where you are. Afterward there is coffee, and
              conversation, and the kind of friendships that turn a hobby into the best part of your
              week.
            </p>
            <p className="body-text">
              Some of us came for the horses and stayed for each other. Some came for the company and
              fell for the horses. Either way, you end up with both.
            </p>
          </div>
        </div>
      </section>

      {/* ── The setting ──────────────────────────────────────────────── */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url('${SETTING_IMG}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="absolute inset-0 bg-green-950/65" />
        <div className="relative z-10 container-site text-center max-w-2xl mx-auto">
          <p className="eyebrow-on-dark mb-6">The setting</p>
          <h2 className="heading-section text-white mb-8">Coastal air, and trails without end.</h2>
          <p className="text-on-dark-soft font-sans text-base leading-relaxed mb-2 max-w-lg mx-auto">
            We ride at Carmel Creek Ranch, tucked into the coastal hills a couple of miles from
            Torrey Pines. The ocean breeze finds the arena most days, and the trails open straight
            onto some of the prettiest country in San Diego. It is the kind of place that makes you
            breathe slower the moment you pull in.
          </p>
        </div>
      </section>

      {/* ── In good hands (the quiet foundation) ─────────────────────── */}
      <section className="bg-cream py-20 sm:py-24">
        <div className="container-site max-w-3xl text-center">
          <p className="eyebrow mb-4">In good hands</p>
          <h2 className="heading-section text-green-800 mb-6">The standard you never have to think about.</h2>
          <p className="body-text mb-6">
            Behind the easy mornings is a lifetime of horsemanship — riding and competing in Europe
            from a young age, and decades spent learning the classical hunter/jumper craft properly.
            That is why the horses here are calm and well schooled, why the teaching is patient, and
            why you can trust the people on the ground beside you.
          </p>
          <p className="font-serif italic text-xl text-gold-ink">
            The horse does not care how much you know, until he knows how much you care.
          </p>
        </div>
      </section>

      {/* ── Off-ramp: horse care (grounded register, lower on the page) ── */}
      <section className="bg-green-900 py-20">
        <div className="container-site grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="eyebrow-on-dark mb-4">For horse owners</p>
            <h2 className="heading-section text-white mb-5">Care for your horse, on your terms.</h2>
            <p className="text-on-dark-soft font-sans leading-relaxed mb-8 max-w-md">
              Already have a horse of your own? We bring the same classical training and hands-on
              care to you, wherever your horse lives — training, riding, turnout, and clipping, done
              with patience and a real feel for the animal, never force.
            </p>
            <Link to="/book/horse" className="btn-ghost-white">
              Training & Care That Comes to You
              <ArrowRight size={16} />
            </Link>
          </div>
          <div className="relative overflow-hidden aspect-[4/3] hidden lg:block">
            <img src={CARE_IMG} alt="Calm, skilled handling of a horse" className="w-full h-full object-cover" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ── Off-ramp: acquisition (quietest, lowest) ─────────────────── */}
      <section className="bg-green-950 py-16">
        <div className="container-site max-w-3xl text-center">
          <p className="eyebrow-on-dark mb-4">When the time comes</p>
          <h2 className="heading-card text-white mb-4">Ready for a horse of your own?</h2>
          <p className="text-on-dark-soft font-sans leading-relaxed mb-8 max-w-lg mx-auto">
            When the time comes to lease or buy, we help you do it well — drawing on years in the
            hunter/jumper world to find the right horse and handle the details, so the whole thing
            feels less like a leap and more like the next easy step.
          </p>
          <Link to="/book/support" className="link-underline text-gold-accent border-gold-400/40 hover:border-gold-400">
            <span className="text-gold-accent">We will handle it</span>
            <ArrowRight size={12} />
          </Link>
        </div>
      </section>
    </>
  );
}
