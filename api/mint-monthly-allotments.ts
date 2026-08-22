/* GET/POST /api/mint-monthly-allotments — CREDITALIGN: the month roll.
 *
 * A weekly/monthly plan entitles its client to N sessions IN THE MONTH IT COVERS, and
 * the owner's rule is that a month does not carry over. The first month's allotment is
 * minted at purchase (`_mint_credits_for_purchase_item`, fired by the purchase_items
 * trigger). Every month after that is minted here.
 *
 * WHY A CRON AND NOT A LAZY READ: the entitlement is a real, spendable row — a member's
 * "what can I book?" is a SELECT, and a SELECT cannot mint. Something has to run.
 *
 * SAFE TO RUN EVERY DAY, AND THAT IS THE POINT. `mint_recurring_allotments()` is
 * idempotent — the unique index on (purchase_item_id, period_start) is the real guard,
 * not this endpoint's care — so a missed run self-heals on the next one instead of
 * costing a client their month. It mints only for plans whose order is PAID (D9's
 * prepaid gate) and whose `plan_ends_on` has not passed.
 *
 * Auth: Vercel cron (x-vercel-cron header) or Bearer CRON_SECRET for a manual run.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { authorizeCronRequest } from './_lib/cronAuth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // One shared rule for all five scheduled endpoints — see api/_lib/cronAuth.ts.
  const auth = authorizeCronRequest(req);
  const isVercelCron = auth.isVercelCron;
  if (req.method !== 'POST' && !(req.method === 'GET' && isVercelCron)) {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!auth.ok) return res.status(401).json({ error: auth.reason ?? 'unauthorized' });

  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc('mint_recurring_allotments');
    if (error) throw error;
    return res.status(200).json({ ok: true, ...(data as Record<string, unknown>) });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: message });
  }
}
