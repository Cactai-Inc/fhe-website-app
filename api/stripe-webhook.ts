/* /api/stripe-webhook — RETIRED 2026-08-26.
 *
 * Owner: "make sure stripe or credit card is not a payment option on any surface
 * or mentioned on any histry surface."
 *
 * Stripe was never configured on this tenant — no production order has ever held
 * a 'stripe' method, and the client-side redirect that called this endpoint has
 * been deleted along with the card option on the payment screen. The FILE stays
 * (D32: nothing is removed) so the route is not silently reclaimed by something
 * else and so the history of what it did is readable; the HANDLER refuses, so a
 * bookmark or a probe cannot start a card checkout that nothing can complete.
 *
 * Bringing card payments back is a product decision, not a redeploy: it needs the
 * fee disclosure, the two methods in CR-76 widened to three, and the payment
 * ledger's method CHECK extended. Restore this from git history at that point.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({ error: 'card payments are not offered' });
}
