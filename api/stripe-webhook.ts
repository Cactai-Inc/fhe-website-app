/* POST /api/stripe-webhook
 * Stripe sends events here. We verify the signature and, on a completed checkout,
 * mark the order paid+confirmed and confirm the booking. Fully automated — no
 * email ingestion on this path.
 *
 * NOTE: raw body is required for signature verification, so bodyParser is disabled.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendOrderReceipt } from './_lib/receipt.js';

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
        // Idempotency guard: Stripe retries events (and both event types can fire
        // for one checkout) — an already-confirmed purchase must not be
        // re-confirmed, and confirm_booking_for_purchase must not run twice.
        const { data: order } = await db.from('purchases').select('id, status, amount').eq('id', orderId).single();
        if (!order) return res.status(200).json({ received: true, unknownOrder: true });
        if (order.status === 'confirmed') {
          return res.status(200).json({ received: true, duplicate: true });
        }

        // Payment is inline on the purchase row now (the `payments` table is
        // retired): mark it paid via RPC, flip the purchase to confirmed, then
        // confirm the held booking.
        const nowIso = new Date().toISOString();
        await db.rpc('mark_purchase_paid', {
          p_purchase_id: orderId,
          p_amount: Number(order.amount),
          p_reference: null,
        });
        await db.from('purchases')
          .update({ status: 'confirmed', paid_at: nowIso })
          .eq('id', orderId);
        await db.rpc('confirm_booking_for_purchase', { p_purchase_id: orderId });
        await sendOrderReceipt(db, orderId); // best-effort; never fails the webhook
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('stripe webhook handler error', err);
    return res.status(500).json({ error: 'handler failed' });
  }
}
