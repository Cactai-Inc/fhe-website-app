/* Stage 5c — the two email triggers that had no caller.
 *
 * DUNNING: fires off the EXISTING 3-day payment-reminder preference
 * (profiles.payment_reminders + the 3-day window in dunning_due()). No cadence
 * is invented here — the RPC owns the rule, this worker just sends what it
 * returns and stamps last_dunning_at so the next window starts.
 *
 * WELCOME: account activation writes a 'welcome' notification (members
 * trigger). This worker emails the unsent ones and marks them read so a
 * second run cannot double-send.
 *
 * Both are best-effort per recipient: one failure never blocks the rest.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { resolveTenantEmailIdentity, renderTemplate, sendViaProvider } from './_lib/email.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  const db = getSupabaseAdmin();
  let dunningSent = 0;
  let welcomeSent = 0;

  try {
    // ── dunning ────────────────────────────────────────────────────────────
    const { data: due } = await db.rpc('dunning_due');
    for (const row of (due ?? []) as Array<Record<string, unknown>>) {
      const email = row.email as string | undefined;
      const orgId = row.org_id as string | undefined;
      const purchaseId = row.purchase_id as string;
      if (!email || !orgId) continue;
      try {
        const identity = await resolveTenantEmailIdentity(db, orgId);
        const amount = Number(row.amount ?? 0);
        const tpl = renderTemplate('dunning', { amount: `$${amount.toFixed(2)}` }, identity.fromName);
        const out = await sendViaProvider({
          to: email,
          fromName: identity.fromName,
          fromEmail: identity.fromEmail,
          subject: tpl.subject,
          html: `${tpl.body}\n<hr/><pre style="font-family:inherit">${identity.footer}</pre>`,
        });
        if (out.ok) {
          await db.rpc('mark_dunning_sent', { p_purchase_id: purchaseId });
          dunningSent += 1;
        }
      } catch { /* one failure never blocks the rest */ }
    }

    // ── welcome ────────────────────────────────────────────────────────────
    const { data: welcomes } = await db
      .from('notifications')
      .select('id, org_id, user_id')
      .eq('kind', 'welcome')
      .is('read_at', null);
    for (const n of (welcomes ?? []) as Array<Record<string, unknown>>) {
      const orgId = n.org_id as string | undefined;
      const userId = n.user_id as string;
      if (!orgId) continue;
      try {
        const { data: prof } = await db
          .from('profiles').select('email').eq('user_id', userId).maybeSingle();
        const to = prof?.email as string | undefined;
        if (!to) continue;
        const identity = await resolveTenantEmailIdentity(db, orgId);
        const tpl = renderTemplate('signup', {}, identity.fromName);
        const out = await sendViaProvider({
          to,
          fromName: identity.fromName,
          fromEmail: identity.fromEmail,
          subject: tpl.subject,
          html: `${tpl.body}\n<hr/><pre style="font-family:inherit">${identity.footer}</pre>`,
        });
        if (out.ok) {
          await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id as string);
          welcomeSent += 1;
        }
      } catch { /* per-recipient best effort */ }
    }

    return res.status(200).json({ dunningSent, welcomeSent });
  } catch (err) {
    console.error('fulfillment-emails error', err);
    return res.status(500).json({ error: 'send sweep failed' });
  }
}
