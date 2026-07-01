/* Single source of truth for brand contact details and identity.
 * Settled in build-runbook.md: Hello@FHEquestrian.com / 858-439-3614 / frenchheritageequestrian.com
 */

export const BRAND = {
  name: 'French Heritage Equestrian',
  shortName: 'FHE',
  tagline: 'A family-run hunter/jumper barn and community, rooted in classical European horsemanship.',
  email: 'Hello@FHEquestrian.com',
  emailHref: 'mailto:Hello@FHEquestrian.com',
  phoneDisplay: '858-439-3614',
  phoneHref: 'tel:+18584393614',
  url: 'www.frenchheritageequestrian.com',
  location: 'Carmel Creek Ranch · Coastal San Diego',
  locationShort: 'Carmel Creek Ranch · San Diego, CA',
} as const;
