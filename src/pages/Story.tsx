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
/* Owner, 2026-08-16 — the narrative order down this page:
 *   S1 the arena (the same shot the landing hero uses) → S2 the stables →
 *   S3 the trail, which completes the story. Hero B remains the closing bookend
 *   beneath the final line. */
const HERO_A  = '/images/Hero_A.png';  // S1 — the arena, the landing hero's world
const STABLES = '/images/Stables.png'; // S2 — the stable at golden hour
const TRAIL   = '/images/Trail.png';   // S3 — the trail; the story's completion
const HERO_B  = '/images/Hero_B.png';  // S4 — the bookend, toward the hills

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
/* Owner, 2026-08-16: Membership is dropped — there is no membership product
 * (D4 defers it) — and each card points at its own category page rather than
 * the generic /shop.
 *   Riding Lessons   → /lessons     (Book a Lesson — the rider funnel)
 *   Horse Leasing    → /acquisition (Find a Horse)
 *   Horse Purchasing → /acquisition (Find a Horse)
 *   Horse Care       → /horse       (Horse Care Services)
 * Owner ruling 2026-08-16: leasing and purchasing BOTH go to Find a Horse. They
 * share a destination deliberately — every lease/purchase/sale/finder service
 * lives in the `acquisition` segment and that page shows them together. */
const WAYS_IN = [
  {
    name: 'Riding Lessons',
    line: 'Come as you are — steady, patient teaching at the pace the horse sets.',
    href: '/lessons',
  },
  {
    name: 'Horse Leasing',
    line: 'Ride the same horse every week, without owning one yet. We arrange the lease.',
    href: '/acquisition',
  },
  {
    name: 'Horse Purchasing',
    line: 'When you are ready for one to call yours, we search, evaluate, and advise.',
    href: '/acquisition',
  },
  {
    name: 'Horse Care',
    line: 'Training, exercise, and clipping when a horse of your own arrives.',
    href: '/horse',
  },
];


export default function Story() {
  const seo = seoForPath('/story')!;

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/story" />

      {/* ══ SECTION 1 · The place — "Coastal Air & Endless Trails" ══
          Establish the coastal world she belongs to. IMAGE: new establishing
          shot (placeholder green band for now). */}
      <section id="the-place" className="bg-cream scroll-mt-24">
        {/* pt-10 → pt-32 (owner, 2026-08-16): the jump nav used to sit above this
            section and carried the clearance under the fixed header; removing it
            left the eyebrow rendering behind the nav bar. */}
        <div className="container-site pt-32 pb-16 sm:pt-40 sm:pb-24">
          {/* items-start (was items-center): the owner wants the image aligned
              with the TOP of the first paragraph, not floated to the middle. */}
          {/* Owner, 2026-08-16: the title kept colliding with the image. Cause:
              `whitespace-nowrap` on a heading inside a 5-of-12 column — it cannot
              wrap, so it simply overflowed under the photograph. The heading now
              sits ABOVE the grid at full width, where one line always fits, and
              the columns below carry only the copy and the image. */}
          <Reveal className="mb-10 sm:mb-12">
            <p className="eyebrow mb-6">Our Community</p>
            <h1 className="heading-display text-green-900 text-[clamp(2.1rem,5vw,3.75rem)]">
              Coastal Air &amp; Endless Trails
            </h1>
          </Reveal>

          {/* NEWSPAPER WRAP (owner, 2026-08-16: "the text in the last paragraph
              still doesnt flow under the image"). A grid CANNOT do this — its
              columns are separate boxes, so text can never cross beneath a
              sibling. Only a FLOAT lets the copy run past the bottom of the
              image and fill the full width, which is exactly the effect asked
              for. Float applies at lg+ only; below that the image sits above the
              text as a normal block. */}
          <Reveal>
            <div
              className="lg:float-right lg:w-[52%] lg:ml-12 mb-8 lg:mb-6 aspect-[3/2] overflow-hidden bg-green-900"
              style={{
                backgroundImage: `url('${HERO_A}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              role="img"
              aria-label="Riders in the arena at Carmel Creek Ranch, coastal San Diego."
            />
            <p className="body-text text-lg mb-6">
                  We are a community of riders who love all things equestrian
                  &mdash; and this is the place we&rsquo;re grateful to call home for us
                  and our horses.
            </p>
            <p className="body-text text-lg mb-6">
                  French Heritage Equestrian resides at Carmel Creek Ranch, a
                  beautiful equestrian facility tucked into the majestic foothills
                  of coastal San Diego overlooking Torrey Pines beach &mdash; where
                  you can enjoy the ocean breeze and vivid sunset skies.
            </p>
            <p className="body-text text-lg mb-6">
                  Our location features two arenas: a standard size riding arena
                  perched on a bluff overlooking the Pacific, and a Grand Prix size
                  arena with plenty of fences and a competition grade watering
                  system. Both arenas are carefully maintained, including daily
                  grooming to ensure optimal riding conditions year round.
            </p>
            <p className="body-text text-lg mb-6">
                  As if that&rsquo;s not reason enough to fall in love with the grounds
                  at CCR, it&rsquo;s one of the only locations in coastal San Diego with
                  trailhead access right from the stable doors. Enjoy miles of
                  interconnected trails winding through the Pe&ntilde;asquitos preserve,
                  from the 5 all the way to the 15, with a wide variety of terrain
                  and sights to see along the way.
            </p>
            {/* Clears the float so the section's own bottom edge sits below the
                image even when the copy is shorter than it. */}
            <div className="clear-both" />

            {/* Owner, 2026-08-16: a continue link at the END of each section,
                not a nav row at the top. Plain anchors — smooth scrolling is
                global and every target carries scroll-mt-24. */}
            <p className="mt-10">
              <a href="#what-youll-find" className="link-underline">
                What you&rsquo;ll find here <ArrowRight size={13} aria-hidden="true" />
              </a>
            </p>
          </Reveal>
        </div>
      </section>

      <section id="what-youll-find" data-header-tone="dark" className="relative bg-green-900 overflow-hidden scroll-mt-24">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* SWAP: Section 2 — horse in the stable at golden hour / sunset
              (owner to provide). Green textural placeholder for now. */}
          <div className="order-1 lg:order-none">
            {/* Stables — exactly what this slot was reserved for. Full-bleed
                inside the dark band, same min-heights the placeholder set. */}
            <div
              className="min-h-[340px] lg:min-h-[620px] h-full bg-green-900"
              style={{
                backgroundImage: `url('${STABLES}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
              role="img"
              aria-label="The stables at Carmel Creek Ranch at golden hour."
            />
          </div>

          {/* Copy — light on green (on-dark tokens throughout). */}
          <div className="flex items-center">
            <div className="px-6 sm:px-10 lg:pl-16 lg:pr-20 py-16 sm:py-20 lg:py-28 max-w-xl">
              <Reveal>
                <p className="eyebrow-on-dark mb-6">What You&rsquo;ll Find</p>
                <h2 className="font-display font-medium text-white text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.1]">
                  New Friends
                  <br />
                  New Adventures
                  <br />
                  {/* Same gold as every other accent on the page (gold-300). */}
                  <span className="text-gold-300">A New You</span>
                </h2>
                <div className="mt-8 space-y-5">
                  <p className="text-white body-text text-lg">
                    You come for the riding. What you keep is everything around it
                    — the women who become your people, the standing plans, the
                    text thread that carries on long after you have untacked.
                  </p>
                  <p className="text-white body-text text-lg">
                    And it is an adventure. Trails you had never taken, a canter
                    that finally clicks, a horse who learns your voice. Small brave
                    things, one after another, until they add up to something that
                    feels a lot like courage.
                  </p>
                  <p className="text-white body-text text-lg">
                    Somewhere in the middle of all of it, you notice you have
                    changed. Steadier. Lighter. More yourself than you have been in
                    a long while. That is the part no one warns you about — and the
                    part you will be most grateful for.
                  </p>
                </div>

                {/* Continue — on-dark styling, this section is the green band. */}
                <p className="mt-9">
                  <a href="#the-community" className="inline-flex items-center gap-2 text-sm font-sans tracking-widest uppercase text-gold-300 hover:text-gold-200 border-b border-gold-600/40 hover:border-gold-300 pb-0.5 transition-colors focus-ring-dark">
                    Meet the community <ArrowRight size={13} aria-hidden="true" />
                  </a>
                </p>
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
      {/* pt-20/28 → pt-32/40 (owner, 2026-08-16: "needs space above the section
          name, its too close to the other section") — this follows the
          full-bleed green band, which has no bottom padding of its own, so the
          eyebrow was sitting almost on the seam. */}
      <section id="the-community" className="bg-cream scroll-mt-24">
        <div className="container-site pt-32 pb-16 sm:pt-40 sm:pb-24">
          <Reveal className="max-w-3xl">
            <p className="eyebrow mb-6">The Community</p>
            {/* One line, title case, no period (owner). The clamp comes down
                because the line is now ~24 chars instead of two short ones. */}
            <h2 className="heading-display text-green-900 text-[clamp(1.9rem,4.2vw,3.2rem)] [text-wrap:balance]">
              You Will Not Ride Alone
            </h2>
          </Reveal>

          {/* mt-12/16 → mt-6/8 (owner, 2026-08-16: "the gap between the text and
              the image below it is too large"). The headline and the image are
              one beat, not two sections. */}
          <div className="mt-6 sm:mt-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Image treatment — women riding together (Hero A world revisited),
                framed with a gold hairline and a soft edge-scrim. */}
            {/* order-1 on mobile: image above the text, matching sections 1 and 2. */}
            <Reveal className="lg:col-span-7 order-1 lg:order-none" delay={100}>
              <figure className="relative aspect-[4/5] sm:aspect-[16/10] overflow-hidden">
                {/* Section 3 — the trail. Owner: this is what "completes the
                    story" — the arena and the stables lead here, to riding out. */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url('${TRAIL}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 30%',
                  }}
                  role="img"
                  aria-label="Riding the trail beyond Carmel Creek Ranch, coastal San Diego."
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
          {/* Continue out of The Community and into The Ways In. */}
          <p className="mt-10">
            <a href="#the-ways-in" className="link-underline">
              See the ways in <ArrowRight size={13} aria-hidden="true" />
            </a>
          </p>

          <div id="the-ways-in" className="mt-20 sm:mt-28 scroll-mt-24">
            <div className="rule-gold" />
            {/* Owner, 2026-08-16 (flipped): the mosaic "steals the show", so the
                CARDS now take the prominent right column where the photos were,
                and the photographs drop to a quiet strip below — present, tying
                the section together, but no longer the loudest thing here. */}
            <div className="mt-12 sm:mt-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
              <Reveal className="lg:col-span-5">
                <p className="eyebrow mb-5">The Ways In</p>
                <h3 className="heading-section text-green-900">
                  Find the way that fits you.
                </h3>
                <p className="body-text mt-6 text-lg">
                  However you begin — a first lesson, a horse to ride each week,
                  one of your own to care for — there is a clear path in, arranged
                  personally. Explore what feels right, and we will meet you there.
                </p>
              </Reveal>

              <Reveal className="lg:col-span-7" delay={120}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 lg:gap-6">
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
              </Reveal>
            </div>

            {/* The four photographs, as a quiet strip beneath the cards.
                Decorative — each is described in context earlier on the page. */}
            <div className="mt-12 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-hidden="true">
              {/* Trail last (owner, 2026-08-16) — it is the image that completes the
                  story, so it closes the strip. */}
              {[HERO_A, STABLES, HERO_B, TRAIL].map((src, i) => (
                <div
                  key={i}
                  className="aspect-[4/3] overflow-hidden bg-green-900"
                  style={{
                    backgroundImage: `url('${src}')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ══ SECTION 4 · The closing beat ═══════════════════════════════════
          Owner, 2026-08-16: the line is centered ABOVE the image with room to
          breathe, "so it looks like the final section in the narrative being
          told on this page" — not a caption laid over a photograph. So the
          section is now two parts: a cream band carrying the line at the same
          generous rhythm the sections above use, then Hero B beneath it as the
          visual bookend, the place looking toward the hills.
          The image band keeps `aria-hidden` (it is decorative again, and its own
          aria-label describes it); the sentence lives in real text above. */}
      {/* Owner, 2026-08-16: the padding here was symmetric (py-20/28/32), so the
          space BELOW the line matched the space above it and pushed the image
          away. The top keeps its breathing room; the bottom is cut to a third,
          so the photograph sits close under the words.
          `leading-tight` (not the display default) opens the two stacked lines a
          little without letting them drift apart. */}
      <section className="bg-cream">
        <div className="container-site pt-20 pb-8 sm:pt-28 sm:pb-10 lg:pt-32 lg:pb-12">
          <p className="heading-display leading-[1.2] text-green-900 text-center mx-auto max-w-4xl [text-wrap:balance] text-[clamp(1.9rem,4.4vw,3.2rem)]">
            Friendship &amp; Adventure at French Heritage Equestrian
          </p>
        </div>
      </section>

      {/* Height trimmed (70vh → 58vh on desktop) so this whole closing beat —
          the line plus the image — lands inside one viewport, with the image's
          bottom edge meeting the footer at the fold, per the owner's reference
          screenshot. */}
      <section
        data-header-tone="dark"
        className="relative bg-green-900 overflow-hidden h-[58vh] sm:h-[64vh] lg:h-[70vh]"
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
