import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';

/* ─── Photo constants ───────────────────────────────────────────────────── */
const HERO_IMG = 'https://images.pexels.com/photos/1559388/pexels-photo-1559388.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';
const RIDER_IMG = 'https://images.pexels.com/photos/1571939/pexels-photo-1571939.jpeg?auto=compress&cs=tinysrgb&w=800&q=80';
const HORSE_IMG = 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=800&q=80';
const SUPPORT_IMG = 'https://images.pexels.com/photos/2123375/pexels-photo-2123375.jpeg?auto=compress&cs=tinysrgb&w=800&q=80';
const ATMOSPHERE_IMG = 'https://images.pexels.com/photos/52500/horse-herd-fog-nature-52500.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';

/* ─── Service pillars ───────────────────────────────────────────────────── */
const PILLARS = [
  {
    eyebrow: 'For the Rider',
    heading: 'Riding Lessons\n& Training',
    body: 'Private instruction, hunter jumper programs, and horsemanship classes tailored to where you are and where you want to go.',
    cta: 'Explore Rider Services',
    href: '/book/rider',
    img: RIDER_IMG,
  },
  {
    eyebrow: 'For the Horse',
    heading: 'Training, Care\n& Turnout',
    body: 'Professional training, daily riding and turnout, and expert clipping — everything your horse needs to thrive while you are away or alongside you.',
    cta: 'Explore Horse Services',
    href: '/book/horse',
    img: HORSE_IMG,
  },
  {
    eyebrow: 'For the Journey',
    heading: 'Finding &\nAcquiring Your Horse',
    body: 'From curated search to contract — we locate, evaluate, and broker the ideal purchase or lease so every decision is made with expertise beside you.',
    cta: 'Explore Rider Support',
    href: '/book/support',
    img: SUPPORT_IMG,
  },
];

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function Landing() {
  const heroRef = useRef<HTMLDivElement>(null);

  // Subtle parallax on hero
  useEffect(() => {
    const onScroll = () => {
      if (heroRef.current) {
        heroRef.current.style.transform = `translateY(${window.scrollY * 0.3}px)`;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative h-screen min-h-[600px] overflow-hidden flex items-center">
        <div
          ref={heroRef}
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url('${HERO_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 30%',
          }}
        />
        {/* Layered overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-950/80 via-green-900/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/60 via-transparent to-green-900/20" />

        <div className="relative z-10 container-site w-full">
          <div className="max-w-2xl">
            <p className="eyebrow text-gold-400 mb-6 animate-fade-up">
              Carmel Creek Ranch · San Diego, CA
            </p>
            <h1
              className="font-display font-light text-white leading-tight mb-6 animate-fade-up delay-100"
              style={{
                fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif',
                fontSize: 'clamp(3rem, 7vw, 5.5rem)',
              }}
            >
              Where Passion
              <br />
              <em className="text-gold-300 not-italic">Finds Its Home</em>
            </h1>
            <p className="body-text text-white/75 text-lg max-w-lg mb-10 animate-fade-up delay-200">
              A family-owned equestrian studio offering world-class riding instruction, attentive horse care, and expert acquisition services — set along the ocean-kissed trails of coastal San Diego.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-up delay-300">
              <Link to="/services" className="btn-primary">
                Begin Your Journey
                <ArrowRight size={16} />
              </Link>
              <Link to="/about" className="btn-ghost-white">
                Our Story
              </Link>
            </div>
          </div>
        </div>

        {/* Location badge */}
        <div className="absolute bottom-8 right-8 hidden lg:flex items-center gap-2 text-white/60 text-xs font-sans tracking-wide">
          <MapPin size={12} className="text-gold-400" />
          <span>2.5 miles from Torrey Pines Beach</span>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in delay-500">
          <div className="w-px h-10 bg-gradient-to-b from-transparent to-white/40" />
        </div>
      </section>

      {/* ── Intro band ──────────────────────────────────────────────── */}
      <section className="bg-green-800 py-10 px-6">
        <div className="container-site flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
          <p
            className="font-serif font-light text-white/90 text-xl sm:text-2xl italic max-w-2xl"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            &ldquo;The horse is a mirror to your soul &mdash; and sometimes you may not like what you see in the mirror.&rdquo;
          </p>
          <p className="text-gold-400 text-xs font-sans tracking-widest uppercase whitespace-nowrap">
            Buck Brannaman
          </p>
        </div>
      </section>

      {/* ── Three pillars ───────────────────────────────────────────── */}
      <section className="py-24 bg-cream">
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="eyebrow mb-4">What We Offer</p>
            <h2 className="heading-section text-green-800 max-w-xl mx-auto">
              Three Lines of Service,<br />One Shared Standard
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
            {PILLARS.map((pillar, i) => (
              <article
                key={i}
                className="group service-card flex flex-col"
              >
                {/* Photo */}
                <div className="relative overflow-hidden aspect-[4/3]">
                  <img
                    src={pillar.img}
                    alt={pillar.heading.replace('\n', ' ')}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-green-900/20 group-hover:bg-green-900/10 transition-colors duration-300" />
                </div>

                {/* Content */}
                <div className="p-7 flex flex-col flex-1">
                  <p className="eyebrow mb-3">{pillar.eyebrow}</p>
                  <h3 className="heading-card text-green-800 mb-4 whitespace-pre-line">
                    {pillar.heading}
                  </h3>
                  <p className="body-text text-sm mb-6 flex-1">{pillar.body}</p>
                  <Link
                    to={pillar.href}
                    className="group/link inline-flex items-center gap-2 text-xs font-sans tracking-wide uppercase text-green-800 border-b border-green-800/20 pb-0.5 hover:border-green-800 transition-all duration-200 self-start"
                  >
                    {pillar.cta}
                    <ArrowRight size={13} className="transition-transform duration-200 group-hover/link:translate-x-1" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Location / atmosphere ───────────────────────────────────── */}
      <section className="relative py-32 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${ATMOSPHERE_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <div className="absolute inset-0 bg-green-950/70" />

        <div className="relative z-10 container-site text-center max-w-3xl mx-auto">
          <p className="eyebrow text-gold-400 mb-6">Our Setting</p>
          <h2
            className="font-display font-light text-white mb-8"
            style={{
              fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            Soothing Ocean Air.<br />
            <em className="text-gold-300 not-italic">Trails Without End.</em>
          </h2>
          <p className="text-white/70 font-sans text-base leading-relaxed mb-10 max-w-lg mx-auto">
            Our stables at Carmel Creek Ranch sit along beautiful walking trails and the trailheads of some of San Diego's finest hiking locations — just 2.5 miles from the shore of Torrey Pines Beach. A gentle ocean breeze graces the property year-round.
          </p>
          <Link to="/about" className="btn-ghost-white">
            Discover Our Facility
          </Link>
        </div>
      </section>

      {/* ── Why French Heritage ──────────────────────────────────────── */}
      <section className="py-24 bg-cream-50">
        <div className="container-site grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <p className="eyebrow mb-5">Why Choose Us</p>
            <h2 className="heading-section text-green-800 mb-6">
              A Family Business Built on<br />
              <em style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }} className="not-italic text-gold-700">
                Decades of Dedication
              </em>
            </h2>
            <p className="body-text mb-5">
              French Heritage Equestrian was born from a lifetime with horses — beginning with riding and competing at an early age in Europe and expanding into training and competing at some of the most prestigious events around the world.
            </p>
            <p className="body-text mb-8">
              That global perspective now serves every student and every horse in our care. When you ride with us, you benefit from a lineage of knowledge that spans disciplines, cultures, and decades.
            </p>
            <Link to="/about" className="btn-primary">
              Meet the Team
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {[
              { value: '20+', label: 'Years of Professional Experience' },
              { value: 'World', label: 'Competition Experience across Three Continents' },
              { value: '100%', label: 'Licensed & Insured Facility' },
              { value: 'San Diego', label: "One of Southern California's Premier Locations" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white border border-green-800/10 p-6 flex flex-col gap-2"
              >
                <p
                  className="font-display font-light text-3xl text-green-800"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  {stat.value}
                </p>
                <p className="text-xs font-sans text-green-800/60 leading-snug">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="bg-green-800 py-20">
        <div className="container-site text-center">
          <p className="eyebrow text-gold-400 mb-4">Ready to Begin?</p>
          <h2
            className="font-display font-light text-white mb-6"
            style={{
              fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
            }}
          >
            Choose Your Path
          </h2>
          <p className="text-white/70 font-sans text-base max-w-md mx-auto mb-10">
            Every journey begins with a single step. Tell us what you are looking for and we will take care of the rest.
          </p>
          <Link to="/services" className="btn-outline-gold">
            View All Services
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
