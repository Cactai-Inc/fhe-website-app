/* Central SEO config: site identity, business NAP for structured data, and
 * per-route metadata. Used by the <Seo> component and the prerender script.
 *
 * NOTE: replace the placeholder street address + postal code below with the real
 * values before launch (see SETUP.md "Local SEO").
 */

export const SITE_URL = 'https://www.frenchheritageequestrian.com';

export const BUSINESS = {
  name: 'French Heritage Equestrian',
  legalName: 'French Heritage Equestrian',
  description:
    'A family-run hunter/jumper barn and community rooted in classical European horsemanship, offering riding lessons, horse training and care, and acquisition support in coastal San Diego.',
  email: 'Hello@FHEquestrian.com',
  phone: '+1-858-439-3614',
  phoneDisplay: '858-439-3614',
  // TODO: replace with the real street address + ZIP before launch.
  streetAddress: 'Carmel Creek Ranch',
  addressLocality: 'San Diego',
  addressRegion: 'CA',
  postalCode: '92130',
  addressCountry: 'US',
  // Approximate — refine to the exact ranch coordinates.
  latitude: 32.95,
  longitude: -117.23,
  areaServed: [
    'San Diego', 'Carmel Valley', 'Del Mar', 'Solana Beach', 'Encinitas',
    'Rancho Santa Fe', 'La Jolla', 'Torrey Pines',
  ],
  sameAs: [] as string[], // add social profile URLs when available
  priceRange: '$$$',
  image: `${SITE_URL}/reference-images/Hero_A.png`,
  logo: `${SITE_URL}/favicon.svg`,
} as const;

export interface RouteSeo {
  path: string;
  title: string;       // full <title>
  description: string;
  /** Optional Service schema name for service pages. */
  service?: string;
  /** Include in sitemap.xml. */
  indexable: boolean;
  priority: number;    // sitemap priority 0..1
}

export const ROUTE_SEO: RouteSeo[] = [
  {
    path: '/',
    title: 'French Heritage Equestrian — Hunter/Jumper Lessons & Training | Coastal San Diego',
    description:
      'A community of women who ride for the love of it. Classical European hunter/jumper riding lessons, horse care, and acquisition support at Carmel Creek Ranch in coastal San Diego.',
    indexable: true,
    priority: 1.0,
  },
  {
    path: '/about',
    title: 'Our Story — A Lifetime of Classical Horsemanship | French Heritage Equestrian',
    description:
      'A family story that began in Europe and came home to coastal San Diego. Classical hunter/jumper horsemanship, patient teaching, and the horse first — always.',
    indexable: true,
    priority: 0.7,
  },
  {
    path: '/story',
    title: 'Come Ride With Us — A Riding Community in Coastal San Diego | French Heritage Equestrian',
    description:
      'A place to ride and a place to belong. The approach, the ranch, the ways to ride, and the community behind French Heritage Equestrian at Carmel Creek Ranch, San Diego.',
    indexable: true,
    priority: 0.9,
  },
  {
    path: '/ride',
    title: 'Come Ride With Us — Lessons & Rider Community | French Heritage Equestrian',
    description:
      'A community of women who ride for the love of it, in coastal San Diego. Classical hunter/jumper riding — join the rider community or book individual lessons.',
    indexable: true,
    priority: 0.9,
  },
  {
    path: '/services',
    title: 'Ways to Ride — Lessons, Horse Care & Acquisition | French Heritage Equestrian',
    description:
      'Every way into French Heritage Equestrian: riding lessons and training for you, care and training for your horse, and expert acquisition support when you are ready for a horse of your own.',
    indexable: true,
    priority: 0.7,
  },
  {
    path: '/contact',
    title: 'Contact — French Heritage Equestrian | Coastal San Diego',
    description:
      'Reach French Heritage Equestrian at Carmel Creek Ranch, San Diego. Call, email, or send a note — we respond the same day.',
    indexable: false,
    priority: 0.3,
  },
  {
    path: '/membership',
    title: 'Rider Community Membership | French Heritage Equestrian, San Diego',
    description:
      'Join the French Heritage Equestrian rider community — group rides, the people, and a regular riding rhythm. Membership is by invitation; reach out to learn how it works.',
    service: 'Rider Community Membership',
    indexable: true,
    priority: 0.8,
  },
  {
    path: '/lessons',
    title: 'Riding Lessons — Single & Multi-Pack | French Heritage Equestrian, San Diego',
    description:
      'Private hunter/jumper riding lessons in coastal San Diego — book a single lesson or a multi-pack. Classical instruction for returning and adult-amateur riders.',
    service: 'Private Riding Lessons',
    indexable: true,
    priority: 0.8,
  },
  {
    path: '/horse',
    title: 'Mobile Horse Training, Turnout & Care | French Heritage Equestrian, San Diego',
    description:
      'Classical, trust-based horse training, riding, turnout, and functional clipping — brought to where your horse lives across San Diego North County.',
    service: 'Horse Training & Care',
    indexable: true,
    priority: 0.8,
  },
  {
    path: '/acquisition',
    title: 'Horse Search, Evaluation & Brokering | French Heritage Equestrian, San Diego',
    description:
      'Expert hunter/jumper horse acquisition: search, pre-purchase and lease evaluation, and full brokering, drawn from years in the discipline. Serving San Diego.',
    service: 'Horse Acquisition & Brokering',
    indexable: true,
    priority: 0.8,
  },
];

/** Routes that must never be indexed (auth/transactional/member app). */
export const NOINDEX_PREFIXES = ['/checkout', '/confirmation', '/login', '/register', '/account', '/order', '/app'];

export function seoForPath(path: string): RouteSeo | undefined {
  return ROUTE_SEO.find((r) => r.path === path);
}

export function isNoindex(path: string): boolean {
  return NOINDEX_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p));
}
