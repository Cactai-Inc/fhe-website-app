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
      id: 'evaluation',
      label: 'Evaluation Lesson',
      description: 'Required before the first lesson for every new client',
      price: 150,
      unit: 'session',
    },
    {
      id: 'single',
      label: 'Single Lesson',
      description: '60-minute private lesson on our horses',
      price: 150,
      unit: 'session',
    },
    {
      id: 'punch4',
      label: '4-Lesson Punch Card',
      description: 'Four private lessons — good for 90 days',
      price: 500,
      unit: 'flat',
      popular: true,
      note: 'Save $100',
    },
    {
      id: 'punch8',
      label: '8-Lesson Punch Card',
      description: 'Eight private lessons — good for 90 days',
      price: 950,
      unit: 'flat',
      note: 'Save $150',
    },
    {
      id: 'weekly1',
      label: '1x Weekly',
      description: 'One lesson per week — billed the 1st of each month; 30 days notice to cancel',
      price: 460,
      unit: 'month',
    },
    {
      id: 'weekly2',
      label: '2x Weekly',
      description: 'Two lessons per week — billed the 1st of each month; 30 days notice to cancel',
      price: 880,
      unit: 'month',
      popular: true,
      note: 'Most chosen',
    },
    {
      id: 'weekly3',
      label: '3x Weekly',
      description: 'Three lessons per week — billed the 1st of each month; 30 days notice to cancel',
      price: 1260,
      unit: 'month',
    },
    {
      id: 'own-single',
      label: 'Own Horse — Single Lesson',
      description: 'For horse owners and lessees: a lesson on your own horse',
      price: 120,
      unit: 'session',
    },
    {
      id: 'own-weekly1',
      label: 'Own Horse — 1x Weekly',
      description: 'One lesson a week on your own or leased horse — billed monthly',
      price: 420,
      unit: 'month',
    },
    {
      id: 'own-weekly2',
      label: 'Own Horse — 2x Weekly',
      description: 'Two lessons a week on your own or leased horse — billed monthly',
      price: 780,
      unit: 'month',
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
      label: 'Training Session',
      description: 'Single training ride by the trainer',
      price: 95,
      unit: 'session',
    },
    {
      id: 'weekly1',
      label: 'Training 1x Weekly',
      description: 'One training session a week — billed monthly',
      price: 360,
      unit: 'month',
      popular: true,
    },
    {
      id: 'weekly2',
      label: 'Training 2x Weekly',
      description: 'Two training sessions a week — billed monthly',
      price: 680,
      unit: 'month',
    },
  ],
};

export const HORSE_EXERCISE: Service = {
  id: 'horse-exercise',
  name: 'Horse Exercise',
  category: 'horse',
  tagline: 'Lunging sessions between your rides',
  description:
    'We keep your horse fit and supple with lunging sessions — ideal when you are travelling, recovering, or need extra support. Turnout, the lighter exercise option, is priced separately below.',
  tiers: [
    {
      id: 'single',
      label: 'Exercise Session',
      description: 'Single lunging session',
      price: 55,
      unit: 'session',
    },
    {
      id: 'weekly1',
      label: 'Exercise 1x Weekly',
      description: 'One exercise session a week — billed monthly',
      price: 200,
      unit: 'month',
    },
    {
      id: 'weekly2',
      label: 'Exercise 2x Weekly',
      description: 'Two exercise sessions a week — billed monthly',
      price: 390,
      unit: 'month',
      popular: true,
    },
  ],
};

export const RIDING_TURNOUT: Service = {
  id: 'riding-turnout',
  name: 'Turnout Service',
  category: 'horse',
  tagline: 'The lighter exercise option',
  description:
    'We turn out your horse on your behalf so they stay moving and content — the lighter-touch form of exercise, priced for what it takes.',
  tiers: [
    {
      id: 'single',
      label: 'Turnout Session',
      description: 'Single turnout session',
      price: 25,
      unit: 'session',
    },
    {
      id: 'weekly1',
      label: 'Turnout 1x Weekly',
      description: 'One turnout a week — billed monthly',
      price: 100,
      unit: 'month',
    },
    {
      id: 'weekly2',
      label: 'Turnout 2x Weekly',
      description: 'Two turnouts a week — billed monthly',
      price: 200,
      unit: 'month',
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
      price: 200,
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
export const HORSE_SERVICES: Service[] = [HORSE_TRAINING, HORSE_EXERCISE, RIDING_TURNOUT, HAIR_CLIPPING];
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
