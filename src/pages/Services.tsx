import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import type { FunnelType } from '../lib/supabase';
import Seo from '../components/Seo';
import { seoForPath } from '../lib/seo';

const RIDER_IMG   = '/reference-images/Hero_A.png';
const HORSE_IMG   = 'https://images.pexels.com/photos/635499/pexels-photo-635499.jpeg?auto=compress&cs=tinysrgb&w=900&q=80';
const SUPPORT_IMG = 'https://images.pexels.com/photos/2123375/pexels-photo-2123375.jpeg?auto=compress&cs=tinysrgb&w=900&q=80';

interface PathCard {
  funnel: FunnelType;
  eyebrow: string;
  heading: string;
  subheading: string;
  description: string;
  services: string[];
  cta: string;
  href: string;
  img: string;
}

const PATHS: PathCard[] = [
  {
    funnel: 'rider',
    eyebrow: 'For you',
    heading: 'Ride with us',
    subheading: 'Lessons, training & horsemanship',
    description:
      "However you like to spend your mornings, there is a place for it here — lessons to find your seat again, a regular weekly ride, or time in the arena with the group. No wrong way in, and no need to know exactly what you want yet.",
    services: [
      'Private riding lessons',
      'Hunter/jumper training',
      'Horsemanship classes',
    ],
    cta: 'See the ways to ride',
    href: '/book/rider',
    img: RIDER_IMG,
  },
  {
    funnel: 'horse',
    eyebrow: 'For horse owners',
    heading: 'Care that comes to you',
    subheading: 'Training, turnout & clipping',
    description:
      'Already have a horse of your own? We bring classical training and hands-on care to where your horse lives — training, riding, turnout, and a clean functional clip, done with patience and a real feel for the animal, never force.',
    services: [
      'Hands-on horse training',
      'Riding & turnout service',
      'Functional clipping',
    ],
    cta: 'Care for your horse',
    href: '/book/horse',
    img: HORSE_IMG,
  },
  {
    funnel: 'support',
    eyebrow: 'When the time comes',
    heading: 'Find your horse',
    subheading: 'Search, evaluate & broker',
    description:
      "When you're ready to lease or buy, we help you do it well — drawing on years in the hunter/jumper world to find the right horse, evaluate it honestly, and handle the details from first look to final handshake.",
    services: [
      'Horse locator service',
      'Pre-purchase & lease evaluation',
      'Purchase & lease brokering',
    ],
    cta: 'We will handle it',
    href: '/book/support',
    img: SUPPORT_IMG,
  },
];

export default function Services() {
  const seo = seoForPath('/services')!;
  const { setFunnel } = useCart();

  return (
    <>
      <Seo title={seo.title} description={seo.description} path="/services" />
      {/* ── Page header ─────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 bg-cream">
        <div className="container-site text-center">
          <p className="eyebrow mb-4">Ways to ride with us</p>
          <h1 className="heading-section text-green-800 max-w-xl mx-auto mb-6">
            What are you drawn to?
          </h1>
          <p className="body-text max-w-2xl mx-auto">
            Tell us what caught your eye and a little about you. There is no commitment here — just
            the start of a conversation. We read every note ourselves, and we will get back to you
            the same day, usually within the hour.
          </p>
        </div>
      </section>

      {/* ── Path cards ──────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container-site flex flex-col gap-10">
          {PATHS.map((path, i) => (
            <article
              key={path.funnel}
              className="group grid grid-cols-1 lg:grid-cols-2 border border-green-800/10 overflow-hidden hover:shadow-xl hover:shadow-green-900/[0.08] transition-all duration-300"
            >
              <div className={`relative overflow-hidden aspect-[4/3] lg:aspect-auto ${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                <img
                  src={path.img}
                  alt={path.heading}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-green-900/15 group-hover:bg-green-900/5 transition-colors duration-300" />
              </div>

              <div className={`flex flex-col justify-center p-10 lg:p-14 bg-white ${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                <p className="eyebrow mb-4">{path.eyebrow}</p>
                <h2 className="heading-card text-green-800 text-2xl sm:text-3xl mb-2">{path.heading}</h2>
                <p className="font-serif text-gold-ink italic mb-5 text-[1rem]">{path.subheading}</p>
                <p className="body-text text-sm mb-6">{path.description}</p>

                <ul className="flex flex-col gap-2.5 mb-8">
                  {path.services.map((service) => (
                    <li key={service} className="flex items-center gap-3 text-sm font-sans text-secondary">
                      <div className="w-1 h-1 bg-gold-600 rounded-full flex-shrink-0" />
                      {service}
                    </li>
                  ))}
                </ul>

                <Link to={path.href} onClick={() => setFunnel(path.funnel)} className="btn-primary self-start">
                  {path.cta}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Trust bar ───────────────────────────────────────────────── */}
      <section className="py-12 bg-cream border-t border-green-800/10">
        <div className="container-site">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-center">
            {[
              'Fully Licensed & Insured',
              'Family-Owned & Operated',
              'Carmel Creek Ranch · San Diego, CA',
              '2.5 Miles from Torrey Pines Beach',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <div className="w-1 h-1 bg-gold-600 rounded-full" />
                <span className="text-xs font-sans text-muted tracking-wide">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
