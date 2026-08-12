/* Public catalog — the DB-driven replacement for the hardcoded services.ts /
 * catalog.ts shadow catalogs (Phase 4). The public booking funnels group the
 * live `offerings` (via public_offerings) by service_type and render each SKU as
 * a card. No tiers — every offering IS the purchasable item. */
import { supabase } from './supabase';
import type { Offering, Segment } from './types';

/** A service_type group: the heading (from service_types) + its flat SKUs. */
export interface ServiceGroup {
  code: string;                 // service_type code, e.g. 'RIDING_LESSON'
  name: string;                 // display_name
  tagline: string | null;       // description
  requiresHorse: boolean;
  offerings: Offering[];        // the flat SKUs in this group, sort_order
}

/** Fetch the public catalog for a funnel segment, grouped by service_type in the
 *  order service_types defines.
 *
 *  THE DEFINITION (COUNTFIX 1.5): a public catalog item is an ACTIVE offering in
 *  this segment — the same population `/shop` shows, restricted to one segment.
 *  Nothing is dropped for being unpriced. This used to filter
 *  `config_kind !== 'inquire' && price_amount != null`, which silently removed
 *  every quote-priced SKU; FHE's three acquisition services are all unpriced, so
 *  `/acquisition` — an entry in the marketing site's primary nav — rendered an
 *  empty selection area and a disabled "Continue". Price is a PRESENTATION
 *  matter: an unpriced SKU reads "Inquire for pricing" (ServiceSelector), exactly
 *  as it already does in OfferingCatalog. The public funnels end in a booking
 *  REQUEST, not a payment, so an enquiry-priced service is a legitimate selection. */
export async function fetchPublicCatalog(segment: Segment): Promise<ServiceGroup[]> {
  const [{ data: offRows, error: offErr }, { data: typeRows, error: typeErr }] = await Promise.all([
    supabase.rpc('public_offerings'),
    supabase.from('service_types')
      .select('code, display_name, description, segment, requires_horse, sort_order')
      .eq('active', true).eq('segment', segment)
      .order('sort_order'),
  ]);
  if (offErr) throw offErr;
  if (typeErr) throw typeErr;

  const offerings = ((offRows ?? []) as Offering[]).filter((o) => o.segment === segment);

  const byType = new Map<string, Offering[]>();
  for (const o of offerings) {
    const k = o.service_type ?? 'OTHER';
    (byType.get(k) ?? byType.set(k, []).get(k)!).push(o);
  }

  return ((typeRows ?? []) as Array<{
    code: string; display_name: string; description: string | null; requires_horse: boolean;
  }>)
    .filter((t) => byType.has(t.code))
    .map((t) => ({
      code: t.code, name: t.display_name, tagline: t.description,
      requiresHorse: t.requires_horse,
      offerings: (byType.get(t.code) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }));
}
