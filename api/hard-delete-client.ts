/* POST /api/hard-delete-client — NUCLEAR client deletion (owner directive).
 *
 * Removes ALL traces: the auth user (service-role admin.deleteUser), then the
 * clients + contact rows. FK dependents cascade where ON DELETE CASCADE exists;
 * where a constraint would block (e.g. signed documents referencing the contact
 * as a party), the delete fails and the caller is told what held it — a signed
 * agreement is not silently shredded. This is irreversible and admin-gated by a
 * bearer token whose profile must be ADMIN in the contact's org.
 *
 * Body: { contactId }
 * -> 200 { ok, deletedUser, deletedContact }
 * -> 403 caller not an admin
 * -> 409 { error, blockedBy } when a FK constraint refuses (nothing deleted)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  let body: { contactId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const contactId = (body.contactId ?? '').trim();
  if (!contactId) return res.status(400).json({ error: 'contactId required' });

  try {
    const db = getSupabaseAdmin();

    // caller must be an admin
    const { data: userData, error: userErr } = await db.auth.getUser(bearer);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });
    const { data: caller } = await db
      .from('profiles').select('is_admin, role, org_id').eq('user_id', userData.user.id).maybeSingle();
    const isAdmin = caller?.is_admin || ['ADMIN', 'SUPER_ADMIN'].includes(caller?.role ?? '');
    if (!isAdmin) return res.status(403).json({ error: 'admin access required' });

    // the contact must be in the caller's org
    const { data: contact } = await db
      .from('contacts').select('id, org_id').eq('id', contactId).maybeSingle();
    if (!contact || contact.org_id !== caller?.org_id) {
      return res.status(404).json({ error: 'contact not found in your organization' });
    }

    // the linked auth user (if any) goes first
    const { data: profile } = await db
      .from('profiles').select('user_id').eq('contact_id', contactId).maybeSingle();
    let deletedUser = false;
    if (profile?.user_id) {
      const { error: delUserErr } = await db.auth.admin.deleteUser(profile.user_id);
      if (delUserErr) return res.status(500).json({ error: `could not delete the login: ${delUserErr.message}` });
      deletedUser = true;
    }

    // clients rows, then the contact. A blocking FK (signed docs, etc.) aborts.
    await db.from('clients').delete().eq('contact_id', contactId);
    const { error: delContactErr } = await db.from('contacts').delete().eq('id', contactId);
    if (delContactErr) {
      return res.status(409).json({
        error: 'This person is referenced by records that block deletion (likely a signed agreement). '
             + 'Their login was removed; use Soft delete to retire the rest while keeping history.',
        blockedBy: delContactErr.message,
        deletedUser,
      });
    }

    return res.status(200).json({ ok: true, deletedUser, deletedContact: true });
  } catch (err) {
    console.error('hard-delete-client error', err);
    return res.status(500).json({ error: 'could not complete the deletion' });
  }
}
