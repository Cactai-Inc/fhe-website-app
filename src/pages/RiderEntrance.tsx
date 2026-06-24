import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from 'lucide-react';
import { usePrefersReducedMotion } from '../lib/hooks';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

/* The rider entrance — what "Come ride with us" opens into. This is the
 * seed-planting journey: an emotional welcome into our world, then sections about
 * the riding, the place, the horses, and the community, ending in the split choice
 * (Book a Lesson / Rider Community Membership). Lessons is the low-bar entry and is
 * also the header CTA on this page.
 *
 * Video: drop /public/ride.mp4 (+ /ride.webm) and /public/ride-poster.jpg later.
 */
const RIDE_POSTER = '/reference-images/Gemini_Generated_Image_f3u06df3u06df3u0.png';
const COMMUNITY_IMG = '/reference-images/Gemini_Generated_Image_n7l8hpn7l8hpn7l8.png';
const SETTING_IMG = 'https://images.pexels.com/photos/1996337/pexels-photo-1996337.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';

export default function RiderEntrance() {
  const seo = seoForPath('/ride');
  const reducedMotion = usePrefersReducedMotion();
  const introRef = useRef<HTMLDivElement>(null);

  function scrollToIntro() {
    introRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  return (
    <>
      {seo && <Seo title={seo.title} description={seo.description} path="/ride" />}

      {/* ── Welcome into our world ─────────────────────────────────────── */}
      <section className="relative h-screen min-h-[600px] overflow-hidden flex flex-col">
        {reducedMotion ? (
          <div className="absolute inset-0" style={{ backgroundImage: `url('${RIDE_POSTER}')`, backgroundSize: 'cover', backgroundPosition: 'center 35%' }} />
        ) : (
          <video className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline preload="metadata" poster={RIDE_POSTER}>
            <source src="/ride.webm" type="video/webm" />
            <source src="/ride.mp4" type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-green-950/85 via-green-950/45 to-green-900/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/80 via-transparent to-green-950/30" />

        <div className="relative z-10 flex-1 flex items-center">
          <div className="container-site w-full">
            <div className="max-w-2xl">
              <p className="eyebrow-on-dark mb-6 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">Welcome in</p>
              <h1 className="heading-display text-white mb-6 text-[clamp(2.5rem,6vw,4.5rem)] [text-shadow:0_2px_20px_rgba(0,0,0,0.45)]">
                A few evenings a week
                <br />
                <em className="text-gold-300 not-italic">that are yours.</em>
              </h1>
              <p className="font-sans text-white/[0.9] text-lg max-w-lg mb-10 leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
                Out here the ocean air comes up over the arena and the rest of the day waits at the
                gate. We are a community of women who ride for the love of it — for the quiet, the
                company, and the feeling of being good at something entirely your own.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/lessons" className="btn-ghost-white">
                  Book a Lesson
                  <ArrowRight size={16} />
                </Link>
                <button type="button" onClick={scrollToIntro} className="inline-flex items-center gap-2 text-sm font-sans tracking-widest uppercase text-white/[0.8] hover:text-white transition-colors focus-ring-dark">
                  Learn more
                  <ChevronDown size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Welcome paragraph ──────────────────────────────────────────── */}
      <section ref={introRef} className="bg-cream py-20 sm:py-24 scroll-mt-20">
        <div className="container-site max-w-2xl text-center">
          <p className="eyebrow mb-4">No wrong way in</p>
          <p className="body-text text-lg leading-relaxed text-secondary">
            You do not have to have ridden in years. You do not have to have ridden at all. What you
            need is a couple of evenings a week that are yours, a horse that is glad to see you, and a
            few people who will save you a spot at the rail. The riding comes, patiently and properly,
            the way it should. The belonging comes faster than you would think.
          </p>
        </div>
      </section>

      {/* ── The community ──────────────────────────────────────────────── */}
      <section className="bg-cream-50 py-20 sm:py-28">
        <div className="container-site grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="relative overflow-hidden aspect-[4/3] order-2 lg:order-1">
            <img src={COMMUNITY_IMG} alt="Riders together at Carmel Creek Ranch" className="w-full h-full object-cover" loading="lazy" />
          </div>
          <div className="order-1 lg:order-2">
            <p className="eyebrow mb-4">The community</p>
            <h2 className="heading-section text-green-800 mb-6">Rarely alone in the arena.</h2>
            <p className="body-text mb-5">
              Most of our riding happens together. Group rides in the evening light, where you are
              learning beside people who started right where you are. Afterward there is conversation,
              and the kind of friendships that turn a hobby into the best part of your week.
            </p>
            <p className="body-text">
              Some of us came for the horses and stayed for each other. Some came for the company and
              fell for the horses. Either way, you end up with both.
            </p>
          </div>
        </div>
      </section>

      {/* ── The setting ────────────────────────────────────────────────── */}
      <section className="relative py-28 sm:py-36 overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundImage: `url('${SETTING_IMG}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div className="absolute inset-0 bg-green-950/65" />
        <div className="relative z-10 container-site text-center max-w-2xl mx-auto">
          <p className="eyebrow-on-dark mb-6">The setting</p>
          <h2 className="heading-section text-white mb-8">Coastal air, and trails without end.</h2>
          <p className="text-on-dark-soft font-sans text-base leading-relaxed max-w-lg mx-auto">
            We ride at Carmel Creek Ranch, tucked into the coastal hills a couple of miles from Torrey
            Pines. The ocean breeze finds the arena most days, and the trails open straight onto some
            of the prettiest country in San Diego. It is the kind of place that makes you breathe
            slower the moment you pull in.
          </p>
        </div>
      </section>

      {/* ── The quiet foundation ───────────────────────────────────────── */}
      <section className="bg-cream py-20 sm:py-24">
        <div className="container-site max-w-3xl text-center">
          <p className="eyebrow mb-4">In good hands</p>
          <h2 className="heading-section text-green-800 mb-6">The standard you never have to think about.</h2>
          <p className="body-text mb-6">
            Behind the easy evenings is a lifetime of horsemanship — riding and competing in Europe
            from a young age, and decades spent learning the classical hunter/jumper craft properly.
            That is why the horses here are calm and well schooled, why the teaching is patient, and
            why you can trust the people on the ground beside you.
          </p>
          <Link to="/about" className="link-underline">
            Read our story
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* ── The split choice ───────────────────────────────────────────── */}
      <section className="bg-green-800 py-20 sm:py-24">
        <div className="container-site">
          <div className="text-center mb-12">
            <p className="eyebrow-on-dark mb-3">Ready when you are</p>
            <h2 className="heading-section text-white">Two ways to ride with us.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Lessons — low bar */}
            <article className="bg-white p-8 flex flex-col">
              <p className="eyebrow mb-3">At your own pace</p>
              <h3 className="heading-card text-green-800 mb-3">Book a Lesson</h3>
              <p className="body-text text-sm mb-6 flex-1">
                The easy way in. Private instruction as a single lesson or a multi-pack — find your
                seat again on your own schedule, no commitment beyond the ride.
              </p>
              <Link to="/lessons" className="btn-primary self-start">
                See lesson options
                <ArrowRight size={16} />
              </Link>
            </article>

            {/* Membership */}
            <article className="bg-white p-8 flex flex-col">
              <p className="eyebrow mb-3">All the way in</p>
              <h3 className="heading-card text-green-800 mb-3">Rider Community Membership</h3>
              <p className="body-text text-sm mb-6 flex-1">
                A standing place at the rail — regular riding every week or month, the people, an
                evaluation and lesson plan, horsemanship training, and member rates on everything
                else we offer.
              </p>
              <Link to="/membership" className="btn-outline-gold self-start">
                Explore membership
                <ArrowRight size={16} />
              </Link>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
