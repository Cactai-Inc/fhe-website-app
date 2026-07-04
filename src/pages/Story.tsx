import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

/* The brand-story page — "come learn about us". Uses the normal Layout (header
 * + footer) and scrolls. Four sections carrying a deliberate cinematic arc
 * through ONE place, in order:
 *   1 · The place            — coastal setting establishing shot (the world she belongs to)
 *   2 · The stables          — people + horses, golden hour (her own horse, well-kept)
 *   3 · The arena / community — women riding together (the people she belongs with)
 *   4 · Closing CTA band      — the same place looking toward the hills
 *
 * IMAGE ARC (bookended by ONE continuous location):
 *   Landing = Hero A  →  S1 = new-place placeholder  →  S2 = stables placeholder
 *   →  S3 = Hero A world revisited (the arena)  →  S4 = Hero B (toward the hills).
 * Hero A and Hero B are two angles of the same place; they open and close the
 * journey. Sections 1 and 2 are deep-green textural placeholders until the owner
 * provides the real establishing + stables media (marked with SWAP comments).
 *
 * Gentle fade-up on scroll via IntersectionObserver; reduced-motion users get
 * everything static and present (CSS .qs-reveal guard).
 */
const HERO_A = '/reference-images/Hero_A.png';  // the arena — landing hero's world (S3)
const HERO_B = '/reference-images/Hero_B.png';  // the place, toward the hills (S4 bookend)

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

/* The refined preview of the ways in — informational-with-a-path, not a catalog. */
const WAYS_IN = [
  {
    name: 'Riding Lessons',
    line: 'Come as you are — steady, patient teaching at the pace the horse sets.',
    href: '/shop',
  },
  {
    name: 'Membership',
    line: 'A standing place in the community, and a regular rhythm to your week.',
    href: '/shop',
  },
  {
    name: 'Horse Care',
    line: 'Training, exercise, and clipping when a horse of your own arrives.',
    href: '/shop',
  },
  {
    name: 'Finding a Horse',
    line: 'When you are ready for one to call yours, we search, evaluate, and advise.',
    href: '/acquisition',
  },
];

/* A deep-green textural placeholder band — stands in for real media at a swap
 * slot until the owner provides it. NOT stock, NOT Hero A/B. */
function GreenPlaceholder({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        className="absolute inset-0 bg-gradient-to-br from-green-800 via-green-900 to-green-950"
        aria-hidden="true"
      />
      <div className="qs-grain absolute inset-0 opacity-[0.06]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 border border-gold-600/25" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
        <p className="text-on-dark-soft text-[11px] font-sans tracking-widest uppercase max-w-xs leading-relaxed">
          {label}
        </p>
      </div>
    </div>
  );
}

export default function Story() {
  const seo = seoForPath('/story')!;

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/story" />

      {/* ══ SECTION 1 · The place — "Coastal air, and trails without end." ══
          Establish the coastal world she belongs to. IMAGE: new establishing
          shot (placeholder green band for now). */}
      <section className="bg-cream">
        <div className="container-site pt-32 pb-16 sm:pt-40 sm:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            <Reveal className="lg:col-span-6">
              <p className="eyebrow mb-6">Our Story</p>
              <h1 className="heading-display text-green-900 text-[clamp(2.5rem,6.5vw,4.75rem)]">
                Coastal air,
                <br />
                and trails without end.
              </h1>
              <div className="mt-8 space-y-6 max-w-xl">
                <p className="body-text text-lg">
                  Carmel Creek Ranch is tucked into the coastal hills near Torrey
                  Pines, close enough that the ocean breeze finds the arena by
                  mid-morning. The world here is open: room to breathe, and light
                  that softens everything it touches.
                </p>
                <p className="body-text text-lg">
                  The arena opens straight onto the trails. Ride out and they
                  wind toward the water, past fields that roll gold as the day
                  begins to cool. It is the kind of place that asks you to slow
                  down the moment you turn in the gate.
                </p>
                <p className="body-text text-lg">
                  We are a community of women who ride here for the plain love of
                  it — and this is the place we keep coming back to.
                </p>
              </div>
            </Reveal>

            {/* SWAP: Section 1 hero — the place, coastal setting establishing shot
                (new image/video, owner to provide). Green textural band for now. */}
            <Reveal className="lg:col-span-6" delay={120}>
              <GreenPlaceholder
                label="Section 1 — the place: coastal establishing shot (image / video coming)"
                className="aspect-[4/5] sm:aspect-[3/2] lg:aspect-[4/5]"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ SECTION 2 · Transformation — "New friends. New adventures. A new you." ══
          What she GAINS: friendships, the adventure of it, who she becomes.
          Deep-green full-bleed band — ALL text on-dark (light on green).
          IMAGE: horse in the stable at golden hour / sunset. */}
      <section className="relative bg-green-900 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* SWAP: Section 2 — horse in the stable at golden hour / sunset
              (owner to provide). Green textural placeholder for now. */}
          <div className="order-1 lg:order-none">
            <GreenPlaceholder
              label="Section 2 — horse in the stable at golden hour / sunset (image coming)"
              className="min-h-[340px] lg:min-h-[620px] h-full"
            />
          </div>

          {/* Copy — light on green (on-dark tokens throughout). */}
          <div className="flex items-center">
            <div className="px-6 sm:px-10 lg:pl-16 lg:pr-20 py-16 sm:py-20 lg:py-28 max-w-xl">
              <Reveal>
                <p className="eyebrow-on-dark mb-6">What You&rsquo;ll Find</p>
                <h2 className="font-display font-medium text-white text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1]">
                  New friends.
                  <br />
                  New adventures.
                  <br />
                  <span className="text-gold-300">A new you.</span>
                </h2>
                <div className="mt-8 space-y-5">
                  <p className="text-on-dark-soft body-text text-lg">
                    You come for the riding. What you keep is everything around it
                    — the women who become your people, the standing plans, the
                    text thread that carries on long after you have untacked.
                  </p>
                  <p className="text-on-dark-soft body-text text-lg">
                    And it is an adventure. Trails you had never taken, a canter
                    that finally clicks, a horse who learns your voice. Small brave
                    things, one after another, until they add up to something that
                    feels a lot like courage.
                  </p>
                  <p className="text-on-dark-soft body-text text-lg">
                    Somewhere in the middle of all of it, you notice you have
                    changed. Steadier. Lighter. More yourself than you have been in
                    a long while. That is the part no one warns you about — and the
                    part you will be most grateful for.
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 3 · Belonging — the emotional climax ══════════════════
          The community, rebuilt: women riding together, the friendships, the
          belonging as the emotional payoff. Editorial craft — big heritage
          headline, a pulled quote, then a warm image. On cream (light ground),
          so all text is dark-on-light (correct). Followed by the Ways In. */}
      <section className="bg-cream">
        <div className="container-site pt-20 pb-16 sm:pt-28 sm:pb-24">
          <Reveal className="max-w-3xl">
            <p className="eyebrow mb-6">The Community</p>
            <h2 className="heading-display text-green-900 text-[clamp(2.35rem,5.8vw,4.25rem)]">
              You will not
              <br />
              ride alone.
            </h2>
          </Reveal>

          <div className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Image treatment — women riding together (Hero A world revisited),
                framed with a gold hairline and a soft edge-scrim. */}
            <Reveal className="lg:col-span-7 order-2 lg:order-none" delay={100}>
              <figure className="relative aspect-[4/5] sm:aspect-[16/10] overflow-hidden">
                {/* SWAP: Section 3 — women riding together, laughing, English
                    attire, real joy (reuses the Hero A arena world for now). */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url('${HERO_A}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%',
                  }}
                  role="img"
                  aria-label="Women riding together at Carmel Creek Ranch, coastal San Diego — friends in the arena."
                />
                <div className="absolute inset-0 bg-gradient-to-t from-green-950/35 via-transparent to-transparent" aria-hidden="true" />
                <div className="pointer-events-none absolute inset-0 border border-gold-600/30" aria-hidden="true" />
              </figure>
            </Reveal>

            <Reveal className="lg:col-span-5">
              <div className="space-y-6 max-w-xl">
                <p className="body-text text-lg">
                  Almost everything here happens together. You will learn the
                  names before you learn the diagonals — the woman who holds your
                  horse while you find your stirrup, the one who talks you through
                  your first canter, the whole rail that cheers when it finally
                  clicks.
                </p>
                <p className="body-text text-lg">
                  Afterward there is coffee, and the kind of easy talk that turns
                  strangers into the people you plan your week around. Plenty of us
                  arrived for the horses and stayed, quietly and completely, for
                  each other.
                </p>
              </div>

              {/* Pulled quote — the belonging payoff, with a gold rule. */}
              <figure className="mt-9 border-l-2 border-gold-600 pl-6 sm:pl-8">
                <blockquote className="font-serif italic font-medium text-2xl sm:text-3xl leading-snug text-green-800">
                  &ldquo;I came to learn to ride. I stayed because, for the first
                  time in years, I belonged somewhere.&rdquo;
                </blockquote>
              </figure>
            </Reveal>
          </div>

          {/* The ways in — refined preview, informational with a path (carries
              the onward link to /shop now that S4 is image-only). */}
          <div className="mt-20 sm:mt-28">
            <div className="rule-gold" />
            <Reveal className="max-w-2xl mt-12 sm:mt-16 mb-10 sm:mb-14">
              <p className="eyebrow mb-5">The Ways In</p>
              <h3 className="heading-section text-green-900">
                Find the way that fits you.
              </h3>
              <p className="body-text mt-6 text-lg">
                However you begin — a first lesson, a standing place in the
                community, care for a horse of your own — there is a clear path
                in, arranged personally. Explore what feels right, and we will
                meet you there.
              </p>
            </Reveal>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {WAYS_IN.map((w, i) => (
                <Reveal as="div" key={w.name} delay={i * 70}>
                  <Link
                    to={w.href}
                    className="group block h-full bg-white border border-green-800/10 p-7 transition-all duration-300 hover:shadow-xl hover:shadow-green-900/10 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-800 focus-visible:ring-offset-2"
                  >
                    <h4 className="heading-card text-green-900">{w.name}</h4>
                    <p className="body-text mt-2 text-sm">{w.line}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-xs font-sans tracking-widest uppercase text-gold-800 border-b border-gold-600/40 pb-0.5 transition-colors group-hover:border-gold-600">
                      Explore
                      <ArrowRight
                        size={13}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ SECTION 4 · Visual closer — image only (owner spec) ═══════════
          The image does all the work: no headline, no copy, no CTA. Hero B is
          the bookend — the place looking toward the hills, above the footer.
          (The onward path to /shop lives in Section 3's Ways In preview.) */}
      <section
        className="relative bg-green-900 overflow-hidden h-[52vh] sm:h-[62vh] lg:h-[70vh]"
        aria-hidden="true"
      >
        {/* Hero B — the bookend: the place, toward the hills. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${HERO_B}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
          role="img"
          aria-label="The coastal hills beyond Carmel Creek Ranch at golden hour — the place looking toward the hills."
        />
        {/* Gentle edge scrims only — top for any header-over-image legibility,
            bottom to settle into the footer. No text sits here. */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-green-950/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-green-950/55 to-transparent" />
      </section>
    </>
  );
}
