import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

/* The brand-story page — "come learn about us". Uses the normal Layout (header
 * + footer) and scrolls. Mostly cream, with two deep-green full-bleed panels
 * for rhythm (opening image band + closing CTA). Gentle fade-up on scroll via
 * IntersectionObserver; reduced-motion users get everything static and present
 * (handled in the .qs-reveal CSS guard).
 *
 * Images: the hero is reused where no dedicated photo exists yet, and the
 * "place" slot is a styled green panel — each is a single-src swap when a real
 * photograph arrives.
 */
const HERO_IMG = '/reference-images/Hero_A.png';
const PLACE_IMG = '/reference-images/Hero_B.png';

/* Lightweight scroll-reveal wrapper. Adds `qs-in` when the element first
 * enters the viewport. SSR-safe: if IntersectionObserver is unavailable (or
 * during prerender) the element is revealed immediately so content never hides.
 */
function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as never}
      className={`qs-reveal ${shown ? 'qs-in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}

const OFFERINGS = [
  {
    name: 'Riding Lessons',
    line: 'Private, classical instruction — steady progress at the pace the horse sets.',
    href: '/lessons',
    img: HERO_IMG,
  },
  {
    name: 'Horsemanship',
    line: 'Beyond the saddle: groundwork, patience, and the language of the horse.',
    href: '/lessons',
    img: PLACE_IMG,
  },
  {
    name: 'Finding a Horse',
    line: 'When you are ready for one of your own, we search, evaluate, and advise.',
    href: '/acquisition',
    img: HERO_IMG,
  },
  {
    name: 'Horse Care',
    line: 'Training, turnout, and care brought to where your horse already lives.',
    href: '/horse',
    img: PLACE_IMG,
  },
];

export default function Story() {
  const seo = seoForPath('/story')!;

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/story" />

      {/* ── 1 · Hero band (scrolls; not full-viewport) ─────────────────── */}
      <section className="bg-cream">
        <div className="container-site pt-32 pb-20 sm:pt-40 sm:pb-24 max-w-4xl">
          <Reveal>
            <p className="eyebrow mb-6">Our Story</p>
            <h1 className="heading-display text-green-900 max-w-3xl text-[clamp(2.75rem,7vw,5rem)]">
              A place to ride,
              <br />
              and a place to belong.
            </h1>
            <p className="body-text mt-8 max-w-xl text-lg">
              We are a riding community on the coast of San Diego — built around
              good horses, honest teaching, and the quiet reward of doing one
              thing well. Come see how it feels to make horsemanship part of
              your life.
            </p>
            <div className="mt-10">
              <Link to="/lessons" className="btn-primary">
                See lessons &amp; pricing
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 2 · The Approach ───────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-site py-20 sm:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <Reveal className="lg:col-span-5">
              <p className="eyebrow mb-5">The Approach</p>
              <h2 className="heading-section text-green-900">
                We ride the way the horse learns best — slowly, and with care.
              </h2>
            </Reveal>

            <div className="lg:col-span-7 space-y-6">
              <Reveal delay={80}>
                <p className="body-text text-lg">
                  Nothing here is rushed. Progress comes from patience: a clean
                  transition, a soft halt, a horse that meets you halfway because
                  you earned it. We teach the fundamentals until they become
                  second nature, and we let each rider grow at their own honest
                  pace.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <p className="body-text text-lg">
                  Partnership is the whole point. You learn to listen as much as
                  you ask — to read the horse, to settle your own hands and
                  breath, to trade force for feel. It is work, and it is
                  deeply worth it. What you build in the arena tends to follow
                  you out of it.
                </p>
              </Reveal>

              {/* Pull-quote with a gold rule */}
              <Reveal delay={200}>
                <figure className="mt-10 border-l-2 border-gold-600 pl-6 sm:pl-8">
                  <blockquote className="font-serif italic font-light text-2xl sm:text-3xl leading-snug text-green-800">
                    “The horse gives you back exactly what you bring. That is the
                    whole lesson, and it takes a lifetime.”
                  </blockquote>
                </figure>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 · The Place (deep-green full-bleed image band) ───────────── */}
      <section className="relative bg-green-900">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Image slot — single-src swap when a real photograph arrives. */}
          <div className="relative min-h-[320px] lg:min-h-[560px] overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${PLACE_IMG}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center 40%',
              }}
              role="img"
              aria-label="Riders and horses at Carmel Creek Ranch, coastal hills at sunset."
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-green-900/50 lg:to-green-900" />
          </div>

          {/* Copy */}
          <div className="flex items-center">
            <div className="px-6 sm:px-10 lg:pl-16 lg:pr-20 py-16 sm:py-20 lg:py-28 max-w-xl">
              <Reveal>
                <p className="eyebrow-on-dark mb-5">The Place</p>
                <h2 className="heading-section text-white">
                  Carmel Creek Ranch, San Diego.
                </h2>
                <p className="text-on-dark-soft body-text mt-7 text-lg">
                  Open arenas, coastal light, and the smell of the ocean two
                  miles west. The hills roll gold in the evening and the horses
                  settle as the day cools. It is the kind of place that asks you
                  to slow down the moment you turn in the gate.
                </p>
                <p className="text-on-dark-soft body-text mt-5 text-lg">
                  This is where the work happens — and where a Tuesday lesson
                  quietly becomes the best hour of your week.
                </p>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4 · The Offerings ──────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-site py-20 sm:py-28">
          <Reveal className="max-w-2xl mb-12 sm:mb-16">
            <p className="eyebrow mb-5">The Offerings</p>
            <h2 className="heading-section text-green-900">
              Every way into the barn.
            </h2>
            <p className="body-text mt-6 text-lg">
              Whether you are stepping back into the saddle or looking for a
              horse of your own, there is a clear path in. Explore what fits, and
              we will meet you there.
            </p>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {OFFERINGS.map((o, i) => (
              <Reveal as="div" key={o.name} delay={i * 70}>
                <Link
                  to={o.href}
                  className="group block h-full bg-white border border-green-800/10 transition-all duration-300 hover:shadow-xl hover:shadow-green-900/10 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-800 focus-visible:ring-offset-2"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <div
                      className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.04]"
                      style={{
                        backgroundImage: `url('${o.img}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center 35%',
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-green-950/40 to-transparent" />
                  </div>
                  <div className="p-6">
                    <h3 className="heading-card text-green-900">{o.name}</h3>
                    <p className="body-text mt-2 text-sm">{o.line}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-gold-800 border-b border-gold-600/40 pb-0.5 transition-colors group-hover:border-gold-600">
                      Explore
                      <ArrowRight
                        size={13}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5 · The Community ──────────────────────────────────────────── */}
      <section className="bg-cream">
        <div className="container-site pb-20 sm:pb-28">
          <div className="rule-gold pt-16 sm:pt-20" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <Reveal className="lg:col-span-6">
              <p className="eyebrow mb-5">The Community</p>
              <h2 className="heading-section text-green-900">
                You are not just booking a lesson. You are joining a barn.
              </h2>
            </Reveal>
            <Reveal className="lg:col-span-6" delay={100}>
              <p className="body-text text-lg">
                The riders here become the people you look forward to seeing —
                the friend who holds your horse, the ones who cheer the small
                wins, the group that lingers by the rail long after the last
                ride. It is a warm, welcoming circle of women who show up for
                the love of it.
              </p>
              <p className="body-text mt-5 text-lg">
                You will leave a little taller, a little calmer, and part of
                something that keeps drawing you back. That belonging is the real
                reason people stay for years.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── 6 · Closing CTA (deep-green full-bleed) ────────────────────── */}
      <section className="relative bg-green-900 overflow-hidden">
        {/* Subtle image wash behind the green for depth — single-src swap. */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `url('${HERO_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-green-900/85 via-green-900/80 to-green-950/90" />

        <div className="relative container-site py-24 sm:py-32 text-center">
          <Reveal className="mx-auto max-w-3xl">
            <p className="eyebrow-on-dark mb-6">Come Ride With Us</p>
            <h2 className="font-display font-semibold text-white text-[clamp(2.25rem,6vw,4rem)] leading-[1.05]">
              Your best hour of the week
              <br className="hidden sm:block" /> is waiting at the barn.
            </h2>
            <p className="text-on-dark-soft body-text mt-7 text-lg max-w-xl mx-auto">
              Start with a single lesson. See how the horse, the place, and the
              people fit — and let the rest unfold from there.
            </p>
            <div className="mt-10">
              <Link
                to="/lessons"
                className="group inline-flex items-center gap-3 px-9 py-4 bg-white text-green-900 font-sans text-sm font-medium tracking-widest uppercase transition-all duration-300 hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-green-900"
              >
                Come ride with us
                <ArrowRight
                  size={18}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
