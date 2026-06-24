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
  image: `${SITE_URL}/reference-images/Gemini_Generated_Image_f3u06df3u06df3u0.png`,
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
    path: '/services',
    title: 'Ways to Ride — Lessons, Horse Care & Acquisition | French Heritage Equestrian',
    description:
      'Riding lessons and hunter/jumper training, mobile horse training and care, and expert horse acquisition support in San Diego. Find the way to ride that fits you.',
    indexable: true,
    priority: 0.9,
  },
  {
    path: '/book/rider',
    title: 'Riding Lessons & Hunter/Jumper Training | French Heritage Equestrian, San Diego',
    description:
      'Private riding lessons, hunter/jumper training, and horsemanship classes for adult amateurs and returning riders at Carmel Creek Ranch, coastal San Diego.',
    service: 'Hunter/Jumper Riding Lessons & Training',
    indexable: true,
    priority: 0.8,
  },
  {
    path: '/book/horse',
    title: 'Mobile Horse Training, Turnout & Care | French Heritage Equestrian, San Diego',
    description:
      'Classical, trust-based horse training, riding, turnout, and functional clipping — brought to where your horse lives across San Diego North County.',
    service: 'Horse Training & Care',
    indexable: true,
    priority: 0.8,
  },
  {
    path: '/book/support',
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
