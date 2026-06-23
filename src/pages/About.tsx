import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const FACILITY_IMG = 'https://images.pexels.com/photos/1996337/pexels-photo-1996337.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';
const TRAILS_IMG   = 'https://images.pexels.com/photos/1559388/pexels-photo-1559388.jpeg?auto=compress&cs=tinysrgb&w=900&q=80';
const HORSE_IMG    = 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=900&q=80';

const PRINCIPLES = [
  {
    number: '01',
    title: 'Classical Foundation',
    body: 'Every lesson, every training session is rooted in classical horsemanship — the patient, systematic development of horse and rider that has endured for centuries. We do not teach shortcuts.',
  },
  {
    number: '02',
    title: 'The Horse Comes First',
    body: "The horse's wellbeing, comfort, and understanding are never compromised. We work at the pace the horse dictates, not the pace that is convenient for anyone else.",
  },
  {
    number: '03',
    title: 'Precision Over Speed',
    body: 'A single perfectly-executed transition is worth more than one hundred rushed repetitions. We believe in quality of work over quantity of work, every time.',
  },
  {
    number: '04',
    title: 'Partnership, Not Dominance',
    body: 'The relationship between horse and human must be one of genuine mutual understanding. We teach our students to listen as much as they ask, and to earn trust rather than demand it.',
  },
  {
    number: '05',
    title: 'A Place to Breathe',
    body: 'We understand that our clients come here to exhale. The outside world, its pressures, its noise — none of it belongs on this property. Here, there is only the horse and the moment.',
  },
  {
    number: '06',
    title: 'Honesty in Service',
    body: 'Whether advising on a purchase, recommending a training approach, or assessing a rider\'s progress — we will always tell you what you need to hear, with care and without agenda.',
  },
];

export default function About() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative h-[70vh] min-h-[480px] overflow-hidden flex items-end">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url('${FACILITY_IMG}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center 40%',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/90 via-green-900/40 to-transparent" />

        <div className="relative z-10 container-site pb-16">
          <p className="eyebrow text-gold-400 mb-4">Our Story</p>
          <h1
            className="font-display font-light text-white leading-tight"
            style={{
              fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif',
              fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            }}
          >
            Born in Europe.<br />
            <em className="text-gold-300 not-italic">Rooted in San Diego.</em>
          </h1>
        </div>
      </section>

      {/* ── Our Story ──────────────────────────────────────────────── */}
      <section className="py-24 bg-cream">
        <div className="container-site grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <p className="eyebrow mb-5">About French Heritage</p>
            <h2 className="heading-section text-green-800 mb-8">
              A Lifetime in the Saddle
            </h2>
            <div className="space-y-5 body-text">
              <p>
                French Heritage Equestrian is a family-owned and operated business whose roots trace back to riding and competing at an early age in Europe. What began as a childhood passion became a lifelong pursuit — growing into professional training and competition on an international stage, at some of the most demanding and prestigious events the equestrian world has to offer.
              </p>
              <p>
                That global perspective — the discipline learned in European arenas, the adaptability forged through competition on three continents — is what we bring home to Carmel Creek Ranch. Every student who walks through our gates benefits from that accumulated knowledge, regardless of whether they are sitting in a saddle for the first time or preparing to enter the show ring.
              </p>
              <p>
                We chose San Diego not in spite of its beauty, but because of it. This is a place where the land itself is generous — where ocean air drifts over riding arenas, where trails open onto breathtaking coastal landscapes, and where horses and their people can find genuine peace. That environment shapes everything we do.
              </p>
            </div>
          </div>

          <div className="relative">
            <img
              src={TRAILS_IMG}
              alt="Rider on horseback at Carmel Creek Ranch"
              className="w-full aspect-[4/5] object-cover"
            />
            <div
              className="absolute -bottom-6 -left-6 hidden lg:flex flex-col gap-1 bg-green-800 text-white p-7"
            >
              <p
                className="font-display font-light text-4xl text-gold-400"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                20+
              </p>
              <p className="text-xs font-sans tracking-wide uppercase text-white/70">
                Years of professional experience
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Facility ──────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="container-site">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

            <div className="order-2 lg:order-1">
              <img
                src={HORSE_IMG}
                alt="Horses at Carmel Creek Ranch"
                className="w-full aspect-[5/4] object-cover"
              />
            </div>

            <div className="order-1 lg:order-2">
              <p className="eyebrow mb-5">The Facility</p>
              <h2 className="heading-section text-green-800 mb-8">
                Carmel Creek Ranch,<br />San Diego
              </h2>
              <div className="space-y-5 body-text">
                <p>
                  We operate at Carmel Creek Ranch — a beautifully maintained equestrian property tucked into the coastal hills of San Diego. The facility offers full boarding and training amenities in a setting that is as serene as it is spectacular.
                </p>
                <p>
                  Situated just 2.5 miles from Torrey Pines Beach, the property enjoys a gentle ocean breeze year-round. Our stables are positioned along well-groomed walking trails and provide direct access to the trailheads of some of San Diego's most celebrated hiking routes.
                </p>
                <p>
                  The facility is fully licensed, insured, and equipped to support riders from first lesson through competition preparation. You will find well-maintained arenas, thoughtfully appointed stabling, and an atmosphere of quiet professionalism that reflects our commitment to every horse and human in our care.
                </p>
              </div>

              {/* Highlights */}
              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  'Maintained riding arenas',
                  'Ocean breeze year-round',
                  'Trail access from stables',
                  '2.5 miles — Torrey Pines Beach',
                  'Fully licensed & insured',
                  'Family-owned & operated',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-1 h-1 bg-gold-600 rounded-full flex-shrink-0" />
                    <span className="text-xs font-sans text-green-800/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Philosophy ─────────────────────────────────────────────── */}
      <section className="py-24 bg-green-800">
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="eyebrow text-gold-400 mb-4">Our Philosophy</p>
            <h2
              className="font-display font-light text-white"
              style={{
                fontFamily: '"Big Caslon", "Cormorant Garamond", Georgia, serif',
                fontSize: 'clamp(2rem, 4vw, 3rem)',
              }}
            >
              Why We Do This —<br />
              <em className="text-gold-300 not-italic">And How</em>
            </h2>
            <p className="mt-6 text-white/70 font-sans text-base max-w-2xl mx-auto leading-relaxed">
              Equestrian sport is often misunderstood as a pursuit of dominance over an animal. We believe the opposite. Horsemanship, at its highest form, is a conversation — one that demands patience, humility, and a willingness to constantly learn. That philosophy shapes everything at French Heritage.
            </p>
          </div>

          {/* Principles grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {PRINCIPLES.map((p) => (
              <div key={p.number} className="border border-white/10 p-8 hover:border-gold-600/40 transition-colors duration-300">
                <p
                  className="font-display font-light text-5xl text-gold-600/30 mb-4 leading-none"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  {p.number}
                </p>
                <h3 className="font-serif font-medium text-white text-lg mb-3">
                  {p.title}
                </h3>
                <p className="text-sm font-sans text-white/60 leading-relaxed">
                  {p.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What motivates us ──────────────────────────────────────── */}
      <section className="py-24 bg-cream">
        <div className="container-site max-w-3xl mx-auto text-center">
          <p className="eyebrow mb-5">Our Motivation</p>
          <h2 className="heading-section text-green-800 mb-8">
            This Industry, This Location,<br />This Moment
          </h2>
          <div className="space-y-5 body-text text-center">
            <p>
              The equestrian industry in Southern California is at an inflection point. As land becomes scarcer and quality instruction more difficult to find, the people who love horses most — the dedicated amateurs, the lifelong enthusiasts, the professionals in other fields who find renewal here — deserve a facility and a team that takes their passion as seriously as they do.
            </p>
            <p>
              San Diego offers something rare: a climate that allows year-round riding, a coastline that soothes, and a community of horse people who are deeply committed. We are here because this community deserves the standard of care, instruction, and horsemanship that we have spent a lifetime developing elsewhere — brought home, and offered with everything we have.
            </p>
          </div>
          <div className="mt-12 pt-12 border-t border-green-800/10">
            <blockquote
              className="font-serif font-light italic text-green-800/80 text-2xl leading-relaxed"
              style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
            >
              &ldquo;The horse does not care how much you know, until he knows how much you care.&rdquo;
            </blockquote>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-green-800/10">
        <div className="container-site flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="heading-card text-green-800">Ready to ride with us?</h2>
            <p className="body-text text-sm mt-1">Choose a service path and let us take it from there.</p>
          </div>
          <Link to="/services" className="btn-primary flex-shrink-0">
            View Services
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
