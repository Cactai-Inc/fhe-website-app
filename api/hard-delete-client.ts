/* POST /api/hard-delete-client — NUCLEAR client deletion (owner directive).
 *
 * ⚠️ REWRITTEN 2026-09-12. The previous version did a bare `DELETE FROM contacts`
 * and relied on FK cascade. That is refused by the RESTRICT foreign keys on
 * documents, signatures, purchases, document_parties, contract_parties,
 * document_deliveries, esign_consents, billable_lines, board_agreements and
 * cost_allocation_rules — i.e. any client who ever ordered or signed anything.
 * Worse, it deleted the auth login FIRST and only then hit the wall, leaving a
 * half-torn-down account with no way back. This is the exact "won't hard delete
 * due to signed documents / open orders / scheduled bookings" error.
 *
 * Now it calls `admin_purge_contact(p_contact_id, 'PURGE')` — one atomic function
 * (a single transaction) that tears down children first, anchors last, runs an
 * orphan sweep, and keeps the protected-identity denylist and the company guard.
 * It runs AS THE CALLING ADMIN (their own bearer), so the function's own
 * has_staff_access() + current_org() checks apply. Either the whole account goes
 * or nothing does — no half-deleted state is possible.
 *
 * Body: { contactId } for a person, OR { userId } for a team member (staff
 * accounts have no contact row — that path deletes only the auth user, whose
 * profiles / memberships / grants cascade on user_id).
 * -> 200 { ok, deletedUser, deletedContact }
 * -> 401 no/bad bearer · 403 caller not admin · 404 not in org · 409 refused
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

/** An anon client carrying the caller's JWT, so RPCs run with their auth.uid()
 *  and current_org() — the context admin_purge_contact's own guards require. */
function callerClient(bearer: string) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearer}` } },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { contactId?: string; userId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const contactId = (body.contactId ?? '').trim();
  const userId = (body.userId ?? '').trim();
  if (!contactId && !userId) return res.status(400).json({ error: 'contactId or userId required' });

  try {
    const db = getSupabaseAdmin();

    // caller must be an admin (verified with the service client)
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: caller } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isAdmin = caller?.is_admin || ['ADMIN', 'SUPER_ADMIN'].includes(caller?.role ?? '');
    if (!isAdmin) return res.status(403).json({ error: 'admin access required' });

    // ── CONTACT path: the atomic purge does everything, as the calling admin. ──
    if (contactId) {
      const { data: contact } = await db
        .from('contacts').select('id, org_id').eq('id', contactId).maybeSingle();
      if (!contact || contact.org_id !== caller?.org_id) {
        return res.status(404).json({ error: 'contact not found in your organization' });
      }
      const asAdmin = callerClient(bearer);
      const { data, error } = await asAdmin.rpc('admin_purge_contact', {
        p_contact_id: contactId, p_confirm: 'PURGE',
      });
      if (error) {
        // A refusal (protected identity, company, cross-org) or any teardown
        // problem aborts the WHOLE transaction — nothing was deleted.
        const msg = error.message || 'could not delete the account';
        const refused = /protected|company|not in your organization|staff access/i.test(msg);
        return res.status(refused ? 409 : 500).json({
          error: refused
            ? msg
            : 'Could not complete the deletion. Nothing was removed — the account is intact. '
              + `(${msg})`,
        });
      }
      const out = (data ?? {}) as { had_login?: boolean };
      return res.status(200).json({ ok: true, deletedUser: out.had_login === true, deletedContact: true });
    }

    // ── Team-member (user_id) path: staff accounts have no contact row.
    //    Deleting the auth user cascades profiles / memberships / grants. ──
    if (userId === userData.user.id) {
      return res.status(400).json({ error: 'you cannot delete your own account' });
    }
    const { data: target } = await db
      .from('profiles').select('user_id, org_id, role, contact_id').eq('user_id', userId).maybeSingle();
    if (!target || target.org_id !== caller?.org_id) {
      return res.status(404).json({ error: 'team member not found in your organization' });
    }
    if (target.role === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'a super admin account cannot be deleted here' });
    }
    // If the staff member actually has a contact row, route through the atomic
    // purge so their attribution is cleaned up the same way a client's is.
    if (target.contact_id) {
      const asAdmin = callerClient(bearer);
      const { data, error } = await asAdmin.rpc('admin_purge_contact', {
        p_contact_id: target.contact_id, p_confirm: 'PURGE',
      });
      if (error) {
        const msg = error.message || 'could not delete the account';
        const refused = /protected|company|not in your organization|staff access/i.test(msg);
        return res.status(refused ? 409 : 500).json({
          error: refused ? msg
            : `Could not complete the deletion. Nothing was removed. (${msg})`,
        });
      }
      return res.status(200).json({ ok: true, deletedUser: true, deletedContact: true });
    }
    // No contact — remove the auth user (cascades on user_id) and revoke invites.
    const { data: authUser } = await db.schema('auth').from('users').select('email').eq('id', userId).maybeSingle();
    const { error: delErr } = await db.auth.admin.deleteUser(userId);
    if (delErr) return res.status(500).json({ error: `could not delete the account: ${delErr.message}` });
    if (authUser?.email) {
      await db.from('invitations').update({ status: 'revoked' })
        .eq('org_id', target.org_id).ilike('email', authUser.email).eq('status', 'sent');
    }
    return res.status(200).json({ ok: true, deletedUser: true, deletedContact: false });
  } catch (err) {
    console.error('hard-delete-client error', err);
    return res.status(500).json({ error: 'could not complete the deletion' });
  }
}
