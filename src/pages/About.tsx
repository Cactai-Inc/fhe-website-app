import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const FACILITY_IMG = 'https://images.pexels.com/photos/1996337/pexels-photo-1996337.jpeg?auto=compress&cs=tinysrgb&w=1920&q=80';
const PORTRAIT_IMG = '/reference-images/Hero_B.png';
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
    body: 'We understand that our riders come here to exhale. The outside world, its pressures, its noise — none of it belongs on this property. Here, there is only the horse and the moment.',
  },
  {
    number: '06',
    title: 'Honesty in Service',
    body: "Whether advising on a purchase, recommending a training approach, or assessing a rider's progress — we will always tell you what you need to hear, with care and without agenda.",
  },
];

export default function About() {
  const seo = seoForPath('/about')!;
  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/about" />
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative h-[70vh] min-h-[480px] overflow-hidden flex items-end">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url('${FACILITY_IMG}')`, backgroundSize: 'cover', backgroundPosition: 'center 40%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/90 via-green-900/40 to-transparent" />

        <div className="relative z-10 container-site pb-16">
          <p className="eyebrow-on-dark mb-4">Our Story</p>
          <h1 className="heading-display text-white text-[clamp(2.5rem,6vw,4.5rem)]">
            A lifetime
            <br />
            <em className="text-gold-300 not-italic">in the saddle.</em>
          </h1>
        </div>
      </section>

      {/* ── Our Story ──────────────────────────────────────────────── */}
      <section className="py-24 bg-cream">
        <div className="container-site grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div>
            <p className="eyebrow mb-5">About French Heritage</p>
            <h2 className="heading-section text-green-800 mb-8">A family story, first of all.</h2>
            <div className="space-y-5 body-text">
              <p>
                French Heritage Equestrian is a family story before it is anything else. It began in
                Europe, with a child who loved horses and never stopped — riding, competing, and
                learning the classical hunter/jumper tradition from the people who do it best. That
                foundation came with us across an ocean and a few decades, and it is what we bring
                home to Carmel Creek Ranch every day.
              </p>
              <p>
                We came to San Diego for the same reasons you might love it. The coast. The light.
                The feeling that there is room to breathe here. It is a good place to keep horses,
                and a better place to build something around them — a community of riders who take
                the craft seriously without taking themselves too seriously.
              </p>
              <p>
                What we believe is simple. The horse comes first, always. Good riding is patient
                riding. And the best barns are not really about the riding at all. They are about
                the people who keep showing up, and the part of themselves they find when they do.
              </p>
            </div>
          </div>

          <div className="relative">
            <img
              src={PORTRAIT_IMG}
              alt="Riders together at Carmel Creek Ranch"
              className="w-full aspect-[4/5] object-cover"
            />
            <div className="absolute -bottom-6 -left-6 hidden lg:flex flex-col gap-1 bg-green-800 text-white p-7">
              <p className="font-display font-light text-4xl text-gold-400">20+</p>
              <p className="text-xs font-sans tracking-wide uppercase text-white/[0.78]">
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
              <img src={HORSE_IMG} alt="Horses at Carmel Creek Ranch" className="w-full aspect-[5/4] object-cover" />
            </div>

            <div className="order-1 lg:order-2">
              <p className="eyebrow mb-5">The Facility</p>
              <h2 className="heading-section text-green-800 mb-8">Carmel Creek Ranch, San Diego</h2>
              <div className="space-y-5 body-text">
                <p>
                  We ride at Carmel Creek Ranch — a beautifully kept equestrian property tucked into
                  the coastal hills of San Diego, as serene as it is spectacular.
                </p>
                <p>
                  Just 2.5 miles from Torrey Pines Beach, the property enjoys a gentle ocean breeze
                  year-round. The trails open straight onto some of San Diego's most celebrated
                  walking routes, right from the gate.
                </p>
                <p>
                  Fully licensed and insured, with well-kept arenas and an atmosphere of quiet care
                  that reflects how we treat every horse and every rider here.
                </p>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-4">
                {[
                  'Well-kept riding arenas',
                  'Ocean breeze year-round',
                  'Trail access from the barn',
                  '2.5 miles — Torrey Pines Beach',
                  'Fully licensed & insured',
                  'Family-owned & operated',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-1 h-1 bg-gold-600 rounded-full flex-shrink-0" />
                    <span className="text-xs font-sans text-secondary">{item}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Philosophy (the quiet foundation, kept) ──────────────────── */}
      <section className="py-24 bg-green-800">
        <div className="container-site">
          <div className="text-center mb-16">
            <p className="eyebrow-on-dark mb-4">What we believe</p>
            <h2 className="heading-section text-white">Why we do this — and how.</h2>
            <p className="mt-6 text-on-dark-soft font-sans text-base max-w-2xl mx-auto leading-relaxed">
              Horsemanship, at its best, is a conversation — one that asks for patience, humility,
              and a willingness to keep learning. The seriousness lives with us, the people on the
              ground, so the riding itself stays easy for you.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {PRINCIPLES.map((p) => (
              <div key={p.number} className="border border-white/10 p-8 hover:border-gold-600/40 transition-colors duration-300">
                <p className="font-display font-light text-5xl text-gold-400/40 mb-4 leading-none">{p.number}</p>
                <h3 className="font-serif font-medium text-white text-lg mb-3">{p.title}</h3>
                <p className="text-sm font-sans text-white/[0.7] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Signature line ───────────────────────────────────────────── */}
      <section className="py-24 bg-cream">
        <div className="container-site max-w-3xl mx-auto text-center">
          <p className="eyebrow mb-5">Our one belief</p>
          <blockquote className="font-serif font-light italic text-green-800/[0.85] text-2xl sm:text-3xl leading-relaxed">
            &ldquo;The horse does not care how much you know, until he knows how much you care.&rdquo;
          </blockquote>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="py-20 bg-white border-t border-green-800/10">
        <div className="container-site flex flex-col sm:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="heading-card text-green-800">Ready to ride with us?</h2>
            <p className="body-text text-sm mt-1">Book a lesson and we'll take it from there.</p>
          </div>
          <div className="flex flex-col items-center sm:items-end gap-4 flex-shrink-0">
            <Link to="/lessons" className="btn-primary">
              Book a Lesson
              <ArrowRight size={16} />
            </Link>
            <Link to="/services" className="link-underline">
              See every way to ride
              <ArrowRight size={12} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
