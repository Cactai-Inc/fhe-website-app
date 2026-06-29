/* Service catalog for French Heritage Equestrian */

export type ServiceCategory = 'rider' | 'horse' | 'support';
export type PriceUnit = 'session' | 'month' | 'week' | 'flat' | 'percent';

export interface ServiceTier {
  id: string;
  label: string;
  description: string;
  price: number;
  unit: PriceUnit;
  popular?: boolean;
  note?: string;
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  tagline: string;
  description: string;
  tiers: ServiceTier[];
  addOnTags?: string[];
}

// ─── Rider Services ─────────────────────────────────────────────────────────

export const RIDING_LESSON: Service = {
  id: 'riding-lesson',
  name: 'Horseback Riding Lessons',
  category: 'rider',
  tagline: 'Tailored instruction for every level',
  description:
    'Private and semi-private riding lessons with a focus on developing a correct, balanced seat and a harmonious connection with your horse. Suitable for beginners through advanced amateurs.',
  tiers: [
    {
      id: 'single',
      label: 'Single Lesson',
      description: '60-minute private lesson',
      price: 125,
      unit: 'session',
    },
    {
      id: 'pack5',
      label: '5-Lesson Pack',
      description: 'Five 60-minute private lessons',
      price: 575,
      unit: 'flat',
      popular: true,
      note: '$115 / lesson — save $50',
    },
    {
      id: 'pack10',
      label: '10-Lesson Pack',
      description: 'Ten 60-minute private lessons',
      price: 1100,
      unit: 'flat',
      note: '$110 / lesson — save $150',
    },
    {
      id: 'weekly1',
      label: '1x / Week Monthly',
      description: 'One lesson per week, billed monthly',
      price: 450,
      unit: 'month',
    },
    {
      id: 'weekly2',
      label: '2x / Week Monthly',
      description: 'Two lessons per week, billed monthly',
      price: 875,
      unit: 'month',
      popular: true,
      note: 'Most popular for working professionals',
    },
  ],
};

export const HUNTER_JUMPER: Service = {
  id: 'hunter-jumper',
  name: 'Hunter Jumper Training',
  category: 'rider',
  tagline: 'Develop skill, rhythm, and partnership over fences',
  description:
    'Structured monthly training programs covering course work, gymnastic grids, flat work, and preparation for local schooling shows. Designed for riders who are ready to compete or refine their competitive edge.',
  tiers: [
    {
      id: 'monthly',
      label: 'Monthly Training Program',
      description: 'Weekly training sessions + flat days + show prep',
      price: 395,
      unit: 'month',
      popular: true,
    },
  ],
};

export const HORSEMANSHIP: Service = {
  id: 'horsemanship',
  name: 'Horsemanship Classes',
  category: 'rider',
  tagline: 'The foundation every rider deserves',
  description:
    'Ground-based classes that deepen your understanding of equine behaviour, body language, and partnership. Learn to handle, groom, tack up, and communicate with horses safely and confidently.',
  tiers: [
    {
      id: 'single',
      label: 'Single Class',
      description: '90-minute group horsemanship class',
      price: 90,
      unit: 'session',
    },
    {
      id: 'pack4',
      label: '4-Class Pack',
      description: 'Four 90-minute group classes',
      price: 320,
      unit: 'flat',
      popular: true,
      note: '$80 / class — save $40',
    },
  ],
};

// ─── Horse Services ───────────────────────────────────────────────────────

export const HORSE_TRAINING: Service = {
  id: 'horse-training',
  name: 'Hands-On Horse Training',
  category: 'horse',
  tagline: 'Patient, methodical training rooted in classical principles',
  description:
    'Professional training sessions for horses at any stage — green-breaking, refining, rehabilitation, or competition preparation. Each session is tailored to the individual horse and their current level of development.',
  tiers: [
    {
      id: 'single',
      label: 'Single Session',
      description: '60-minute professional training session',
      price: 150,
      unit: 'session',
    },
    {
      id: 'pack5',
      label: '5-Session Pack',
      description: 'Five 60-minute training sessions',
      price: 700,
      unit: 'flat',
      popular: true,
      note: '$140 / session — save $50',
    },
    {
      id: 'pack10',
      label: '10-Session Pack',
      description: 'Ten 60-minute training sessions',
      price: 1350,
      unit: 'flat',
      note: '$135 / session — save $150',
    },
    {
      id: 'monthly',
      label: 'Monthly Program (3x / Week)',
      description: 'Consistent training 3 days per week',
      price: 1650,
      unit: 'month',
      popular: true,
    },
  ],
};

export const RIDING_TURNOUT: Service = {
  id: 'riding-turnout',
  name: 'Riding & Turnout Service',
  category: 'horse',
  tagline: 'Keep your horse fit, supple, and content',
  description:
    'We ride, exercise, and turn out your horse on your behalf — ideal when you are travelling, recovering, or simply need additional support. Your horse stays in work and spirits stay high.',
  tiers: [
    {
      id: 'weekly',
      label: 'Weekly Service',
      description: '5 days of riding and/or turnout per week',
      price: 295,
      unit: 'week',
    },
    {
      id: 'monthly',
      label: 'Monthly Service',
      description: 'Full month of daily riding and turnout',
      price: 1095,
      unit: 'month',
      popular: true,
      note: 'Best value — includes weekend coverage',
    },
  ],
};

export const HAIR_CLIPPING: Service = {
  id: 'hair-clipping',
  name: 'Hair Clipping',
  category: 'horse',
  tagline: 'Professional presentation, comfort, and care',
  description:
    'Expert clipping services to keep your horse comfortable and looking their best year-round. From bridle path maintenance to full body clips, performed with care and attention to detail.',
  tiers: [
    {
      id: 'bridle',
      label: 'Bridle Path & Ears',
      description: 'Bridle path, ears, muzzle, and face tidying',
      price: 85,
      unit: 'session',
    },
    {
      id: 'legs-face',
      label: 'Legs & Face Clip',
      description: 'Legs, face, and bridle path',
      price: 110,
      unit: 'session',
    },
    {
      id: 'body',
      label: 'Full Body Clip',
      description: 'Complete body clip for working horses',
      price: 225,
      unit: 'session',
      popular: true,
    },
  ],
};

// ─── Rider Support Services ───────────────────────────────────────────────

export const HORSE_LOCATOR: Service = {
  id: 'horse-locator',
  name: 'Horse Locator Service',
  category: 'support',
  tagline: 'We find the right match — you make the decision',
  description:
    'Our team draws on an extensive network of West Coast breeders, trainers, and private sellers to curate a shortlist of horses that align with your goals, budget, and experience level. The retainer is credited toward brokering fees if you proceed to purchase.',
  tiers: [
    {
      id: 'retainer',
      label: 'Search Retainer',
      description: 'Curated shortlist of 3–5 horses matched to your criteria',
      price: 350,
      unit: 'flat',
      popular: true,
      note: 'Credited toward brokering fee at purchase',
    },
  ],
};

export const EVALUATION: Service = {
  id: 'evaluation',
  name: 'Pre-Purchase & Lease Evaluation',
  category: 'support',
  tagline: 'Expert eyes before you commit',
  description:
    'A thorough on-site evaluation of any horse you are considering purchasing or leasing — assessing movement, temperament, training level, and soundness. Includes a written summary and consultation call.',
  tiers: [
    {
      id: 'purchase',
      label: 'Pre-Purchase Evaluation',
      description: 'Full evaluation + written report + consultation',
      price: 275,
      unit: 'session',
      popular: true,
    },
    {
      id: 'lease',
      label: 'Lease Evaluation',
      description: 'Evaluation and lease suitability assessment',
      price: 225,
      unit: 'session',
    },
  ],
};

export const BROKERING: Service = {
  id: 'brokering',
  name: 'Purchase & Lease Brokering',
  category: 'support',
  tagline: 'Professional guidance through every step of the transaction',
  description:
    'We manage the entire purchase or lease process — negotiating on your behalf, coordinating veterinary exams, reviewing contracts, and ensuring a smooth transition for horse and owner alike.',
  tiers: [
    {
      id: 'purchase-broker',
      label: 'Purchase Brokering',
      description: '3% of purchase price (minimum $500) — full service representation',
      price: 500,
      unit: 'flat',
      popular: true,
      note: '3% of purchase price — min $500',
    },
    {
      id: 'lease-broker',
      label: 'Lease Arrangement',
      description: 'Full lease coordination and contract management',
      price: 425,
      unit: 'flat',
    },
  ],
};

// ─── Grouped catalogs ─────────────────────────────────────────────────────

export const RIDER_SERVICES: Service[] = [RIDING_LESSON, HUNTER_JUMPER, HORSEMANSHIP];
export const HORSE_SERVICES: Service[] = [HORSE_TRAINING, RIDING_TURNOUT, HAIR_CLIPPING];
export const SUPPORT_SERVICES: Service[] = [HORSE_LOCATOR, EVALUATION, BROKERING];

export const ALL_SERVICES: Service[] = [...RIDER_SERVICES, ...HORSE_SERVICES, ...SUPPORT_SERVICES];

export function getServiceById(id: string): Service | undefined {
  return ALL_SERVICES.find((s) => s.id === id);
}

export function formatPrice(price: number, unit: PriceUnit): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);

  switch (unit) {
    case 'month':   return `${formatted} / mo`;
    case 'week':    return `${formatted} / wk`;
    case 'session': return `${formatted} / session`;
    case 'percent': return `${price}% of sale price`;
    default:        return formatted;
  }
}
