/* Purchase-driven view model (Slice 4). The app's surfaces are DERIVED from what
 * the member bought — not a static role. Riders get the feed + community + library;
 * deal/care clients get purpose-built dashboards with NO feed/community; operators
 * get the company views + feed. This wraps my_view_surfaces() and exposes a hook the
 * shell + pages gate on. Recomputed on load, so a new purchase changes the app. */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from '../contexts/AuthContext';

export type PurchaseCategory = 'riding' | 'deal' | 'care' | 'operator';
export type Surface =
  | 'feed' | 'community' | 'library' | 'dashboard'
  | 'deal_dashboard' | 'care_dashboard'
  | 'company' | 'account' | 'documents' | 'orders';

export interface ViewSurfaces {
  categories: PurchaseCategory[];
  surfaces: Surface[];
  has_feed: boolean;
  has_community: boolean;
  is_operator: boolean;
}

/** Empty-but-valid surface set for a brand-new signer (record surfaces only). */
export const EMPTY_SURFACES: ViewSurfaces = {
  categories: [],
  surfaces: ['account', 'documents', 'orders'],
  has_feed: false,
  has_community: false,
  is_operator: false,
};

export async function fetchViewSurfaces(): Promise<ViewSurfaces> {
  const { data, error } = await supabase.rpc('my_view_surfaces');
  if (error) throw error;
  return (data ?? EMPTY_SURFACES) as ViewSurfaces;
}

export function has(surfaces: ViewSurfaces | null, s: Surface): boolean {
  return !!surfaces?.surfaces.includes(s);
}

/** Load the signed-in member's surface set. Re-fetches when the user changes.
 *  Returns EMPTY_SURFACES until resolved so callers never null-check the shape. */
export function useViewSurfaces(): { surfaces: ViewSurfaces; loading: boolean; refresh: () => void } {
  const { user } = useAuth();
  const [surfaces, setSurfaces] = useState<ViewSurfaces>(EMPTY_SURFACES);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!user) { setSurfaces(EMPTY_SURFACES); setLoading(false); return; }
    setLoading(true);
    fetchViewSurfaces()
      .then((s) => setSurfaces(s))
      .catch(() => setSurfaces(EMPTY_SURFACES))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  return { surfaces, loading, refresh };
}
