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

/** The shape every consumer renders against — identical to the hardcoded FHE
 *  constant so the two paths are interchangeable and prerender stays green. */
export type Brand = {
  name: string;
  shortName: string;
  tagline: string;
  email: string;
  emailHref: string;
  phoneDisplay: string;
  phoneHref: string;
  url: string;
  location: string;
  locationShort: string;
};

/** Normalize a bare phone string into a tel: href (digits only, US default). */
function telHref(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return '';
  return digits.length === 10 ? `tel:+1${digits}` : `tel:+${digits}`;
}

/**
 * Merge a per-tenant `org_public_config().brand` map (config_values ns BRAND +
 * CONTACT_*) onto the FHE constant. Every field falls back to BRAND, so an
 * unfinished tenant — or the prerender path, which passes no config — always
 * renders a complete, valid brand. This is the runtime per-tenant fetch path the
 * BrandProvider feeds; the constant remains the FHE fallback (PLATFORM_ARCHITECTURE
 * §6: keep the constant so prerender stays green).
 */
export function resolveBrand(cfg?: Record<string, string> | null): Brand {
  const b = cfg ?? {};
  const email = b.CONTACT_EMAIL || BRAND.email;
  const phone = b.CONTACT_PHONE || BRAND.phoneDisplay;
  return {
    name: b.NAME || BRAND.name,
    shortName: b.SHORT_NAME || BRAND.shortName,
    tagline: b.TAGLINE || BRAND.tagline,
    email,
    emailHref: email ? `mailto:${email}` : BRAND.emailHref,
    phoneDisplay: phone,
    phoneHref: phone === BRAND.phoneDisplay ? BRAND.phoneHref : telHref(phone),
    url: b.CONTACT_URL || BRAND.url,
    location: b.LOCATION || BRAND.location,
    locationShort: b.LOCATION || BRAND.locationShort,
  };
}
