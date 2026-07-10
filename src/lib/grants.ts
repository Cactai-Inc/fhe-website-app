/* Instructor view grants (role architecture). The instructor baseline is the
 * servicing set; an admin can add any management surface to instructors' view —
 * org-wide (user_id null) or for one instructor. The rail and the route guard
 * both consult these. Sensitive backend writes stay admin-gated server-side;
 * a grant opens the SURFACE (visibility + whatever that page's RPCs allow staff). */
import { supabase } from './supabase';

export interface SurfaceGrant {
  id: string;
  user_id: string | null;   // null = every instructor in the org
  nav_key: string;          // the route path, e.g. '/app/ops/billing'
}

/** The admin-only surfaces an admin may grant to instructors. */
export const GRANTABLE_SURFACES: { key: string; label: string }[] = [
  { key: '/app/admin', label: 'Clients (accounts & invites)' },
  { key: '/app/ops/support', label: 'Support inbox' },
  { key: '/app/ops/moderation', label: 'Moderation' },
  { key: '/app/ops/transactions', label: 'Transactions' },
  { key: '/app/ops/payments/review', label: 'Payment review' },
  { key: '/app/ops/billing', label: 'Billing' },
  { key: '/app/ops/content', label: 'Content store' },
  { key: '/app/ops/oversight', label: 'Oversight' },
];

/** The nav keys that apply to the SIGNED-IN user (global + personal). */
export async function fetchMyGrantKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('instructor_surface_grants')
    .select('nav_key, user_id');
  if (error) return [];
  const { data: auth } = await supabase.auth.getUser();
  const me = auth?.user?.id;
  return [...new Set(
    (data ?? [])
      .filter((g) => g.user_id === null || g.user_id === me)
      .map((g) => g.nav_key as string),
  )];
}

/** Admin: every grant in the org (for the management panel). */
export async function listAllGrants(): Promise<SurfaceGrant[]> {
  const { data, error } = await supabase
    .from('instructor_surface_grants')
    .select('id, user_id, nav_key');
  if (error) throw error;
  return (data ?? []) as SurfaceGrant[];
}

export async function addGrant(navKey: string, userId: string | null): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const { data: org } = await supabase.rpc('current_org');
  const { error } = await supabase.from('instructor_surface_grants').insert({
    org_id: org, user_id: userId, nav_key: navKey, created_by: auth?.user?.id ?? null,
  });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function removeGrant(id: string): Promise<void> {
  const { error } = await supabase.from('instructor_surface_grants').delete().eq('id', id);
  if (error) throw error;
}
