/* POST /api/stripe-webhook
 * Stripe sends events here. We verify the signature and, on a completed checkout,
 * mark the order paid+confirmed and confirm the booking. Fully automated — no
 * email ingestion on this path.
 *
 * NOTE: raw body is required for signature verification, so bodyParser is disabled.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

export const config = { api: { bodyParser: false } };

async function readRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeKey || !webhookSecret) return res.status(500).json({ error: 'stripe not configured' });

  const stripe = new Stripe(stripeKey);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    const raw = await readRawBody(req);
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    console.error('stripe signature verification failed', err);
    return res.status(400).json({ error: 'invalid signature' });
  }

  try {
    const db = getSupabaseAdmin();

    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const obj = event.data.object as Stripe.Checkout.Session | Stripe.PaymentIntent;
      const orderId = (obj.metadata?.order_id as string) || undefined;
      if (orderId) {
        const nowIso = new Date().toISOString();
        await db.from('orders')
          .update({ status: 'confirmed', paid_at: nowIso, confirmed_at: nowIso })
          .eq('id', orderId);
        await db.from('payments')
          .update({ status: 'confirmed', matched_at: nowIso, match_confidence: 'stripe' })
          .eq('order_id', orderId)
          .eq('method', 'stripe');
        await db.rpc('confirm_booking_for_order', { p_order_id: orderId });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe webhook handler error', err);
    return res.status(500).json({ error: 'handler failed' });
  }
}
