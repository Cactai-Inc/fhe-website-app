/* POST /api/admin-provision-tenant
 * SUPER_ADMIN-only. The single blessed provisioning entry point behind the
 * SUPERADMIN-PROVISION wizard (assisted-onboarding now, self-serve later reuse
 * the same RPC — §9).
 *
 * Body: { name, slug, tierKey, adminEmail, brand?, legal?, rates?, modules? }
 * Header: Authorization: Bearer <supabase access token of a SUPER_ADMIN>
 *
 * Flow: authorize the caller as SUPER_ADMIN, find-or-create the ADMIN auth user
 * by email via the Supabase Auth admin API (idempotent), then call
 * rpc('provision_tenant', …) which runs atomically and rolls back on any
 * failure. Orphan-safe: the find-or-create is idempotent and the RPC is
 * re-runnable, so a retry never double-creates a user or leaves a partial org
 * (§9). Returns { org_id }.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

/** Idempotently resolve the ADMIN auth user id for an email. Attempts to create
 *  the user first; if they already exist, looks them up instead. Never creates a
 *  second user for the same email (§9). */
async function findOrCreateAdminUser(
  db: ReturnType<typeof getSupabaseAdmin>,
  email: string,
): Promise<string> {
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (!createErr && created?.user) return created.user.id;

  // Already registered (or a benign create race) — find the existing user.
  const existing = await findUserByEmail(db, email);
  if (existing) return existing;

  // A real create failure that is not an "already exists" — surface it.
  throw createErr ?? new Error('could not resolve admin user');
}

/** Page through the auth users and match by (case-insensitive) email. */
async function findUserByEmail(
  db: ReturnType<typeof getSupabaseAdmin>,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? '').toLowerCase() === target);
    if (match) return match.id;
    if (users.length < 200) break; // last page
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const name = (body.name as string || '').trim();
  const slug = (body.slug as string || '').trim();
  const tierKey = (body.tierKey as string || '').trim();
  const adminEmail = (body.adminEmail as string || '').trim();
  if (!name || !slug || !tierKey || !adminEmail) {
    return res.status(400).json({ error: 'name, slug, tierKey and adminEmail are required' });
  }

  try {
    const db = getSupabaseAdmin();

    // Authorize the caller as SUPER_ADMIN (platform operator — §4.2).
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: profile } = await db
      .from('profiles').select('role').eq('user_id', userData.user.id).maybeSingle();
    if (profile?.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'forbidden' });

    // Find-or-create the ADMIN auth user (idempotent) …
    const adminUserId = await findOrCreateAdminUser(db, adminEmail);

    // … then provision the tenant in one atomic RPC (rolls back on any failure).
    const { data: orgId, error: rpcErr } = await db.rpc('provision_tenant', {
      p_name: name,
      p_slug: slug,
      p_tier_key: tierKey,
      p_admin_email: adminEmail,
      p_admin_user_id: adminUserId,
      p_brand: (body.brand as Record<string, unknown>) ?? {},
      p_legal: (body.legal as Record<string, unknown>) ?? {},
      p_rates: (body.rates as Record<string, unknown>) ?? {},
      p_modules: (body.modules as string[]) ?? null,
    });
    if (rpcErr) throw rpcErr;

    return res.status(200).json({ org_id: orgId as string });
  } catch (err) {
    console.error('provision error', err);
    return res.status(500).json({ error: 'could not provision tenant' });
  }
}
