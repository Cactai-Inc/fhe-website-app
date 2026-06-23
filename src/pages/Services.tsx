import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import type { FunnelType } from '../lib/supabase';

const RIDER_IMG   = 'https://images.pexels.com/photos/1996337/pexels-photo-1996337.jpeg?auto=compress&cs=tinysrgb&w=900&q=80';
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
    eyebrow: 'For the Rider',
    heading: 'Rider Services',
    subheading: 'Instruction, Training & Horsemanship',
    description:
      'Whether you are picking up the reins for the first time or refining your technique for the show ring, our rider programs meet you exactly where you are.',
    services: [
      'Private Horseback Riding Lessons',
      'Hunter Jumper Training Programs',
      'Horsemanship Classes',
    ],
    cta: 'Select Rider Services',
    href: '/book/rider',
    img: RIDER_IMG,
  },
  {
    funnel: 'horse',
    eyebrow: 'For the Horse',
    heading: 'Horse Services',
    subheading: 'Training, Turnout & Care',
    description:
      'Your horse deserves the same level of care and attention when you cannot be there. We offer professional training, riding and turnout, and expert clipping services.',
    services: [
      'Hands-On Horse Training',
      'Riding & Turnout Service',
      'Hair Clipping',
    ],
    cta: 'Select Horse Services',
    href: '/book/horse',
    img: HORSE_IMG,
  },
  {
    funnel: 'support',
    eyebrow: 'For the Journey',
    heading: 'Rider Support',
    subheading: 'Find, Evaluate & Acquire',
    description:
      'Searching for the right horse is one of the most consequential decisions an equestrian makes. We provide expert guidance, thorough evaluations, and professional brokering from first look to final signature.',
    services: [
      'Horse Locator Service',
      'Pre-Purchase & Lease Evaluations',
      'Purchase & Lease Brokering',
    ],
    cta: 'Select Support Services',
    href: '/book/support',
    img: SUPPORT_IMG,
  },
];

export default function Services() {
  const { setFunnel } = useCart();

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 bg-cream">
        <div className="container-site text-center">
          <p className="eyebrow mb-4">Services</p>
          <h1 className="heading-section text-green-800 max-w-xl mx-auto mb-6">
            Where Would You Like to Begin?
          </h1>
          <p className="body-text max-w-2xl mx-auto">
            French Heritage Equestrian offers three distinct lines of service — each designed to stand on its own, and each able to complement the others. Choose the path that speaks to you most. We will introduce what else might serve you naturally along the way.
          </p>
        </div>
      </section>

      {/* ── Path cards ──────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="container-site flex flex-col gap-10">
          {PATHS.map((path, i) => (
            <article
              key={path.funnel}
              className="group grid grid-cols-1 lg:grid-cols-2 border border-green-800/10 overflow-hidden hover:shadow-xl hover:shadow-green-900/8 transition-all duration-300"
            >
              {/* Photo — alternates side */}
              <div
                className={`relative overflow-hidden aspect-[4/3] lg:aspect-auto ${
                  i % 2 === 1 ? 'lg:order-2' : ''
                }`}
              >
                <img
                  src={path.img}
                  alt={path.heading}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-green-900/15 group-hover:bg-green-900/5 transition-colors duration-300" />
              </div>

              {/* Content */}
              <div
                className={`flex flex-col justify-center p-10 lg:p-14 bg-white ${
                  i % 2 === 1 ? 'lg:order-1' : ''
                }`}
              >
                <p className="eyebrow mb-4">{path.eyebrow}</p>
                <h2 className="heading-card text-green-800 text-2xl sm:text-3xl mb-2">
                  {path.heading}
                </h2>
                <p className="text-sm font-sans text-gold-700 font-medium mb-5 italic"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', fontSize: '1rem' }}>
                  {path.subheading}
                </p>
                <p className="body-text text-sm mb-6">{path.description}</p>

                {/* Services list */}
                <ul className="flex flex-col gap-2.5 mb-8">
                  {path.services.map((service) => (
                    <li key={service} className="flex items-center gap-3 text-sm font-sans text-green-800/70">
                      <div className="w-1 h-1 bg-gold-600 rounded-full flex-shrink-0" />
                      {service}
                    </li>
                  ))}
                </ul>

                <Link
                  to={path.href}
                  onClick={() => setFunnel(path.funnel)}
                  className="btn-primary self-start"
                >
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
                <span className="text-xs font-sans text-green-800/60 tracking-wide">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
