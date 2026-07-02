/* POST /api/stripe-create-session
 * Creates a Stripe Checkout Session for an order the authenticated caller owns.
 * Body: { orderId }
 * Header: Authorization: Bearer <supabase access token>
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { getSupabaseAdmin } from './_lib/supabaseAdmin';

const STRIPE_FEE_RATE = 0.03; // disclosed card convenience fee; confirm CA compliance (SETUP.md)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'stripe not configured' });
  const stripe = new Stripe(stripeKey);

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  const orderId = body.orderId as string;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  try {
    const db = getSupabaseAdmin();

    // Verify the token maps to a user, and that user owns the order.
    const { data: userData, error: userErr } = await db.auth.getUser(token);
    if (userErr || !userData.user) return res.status(401).json({ error: 'unauthorized' });

    const { data: order } = await db
      .from('orders')
      .select('id, user_id, total, status, org_id')
      .eq('id', orderId)
      .single();
    if (!order || order.user_id !== userData.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (order.status === 'confirmed') {
      return res.status(409).json({ error: 'order already paid' });
    }

    // Tenant brand from the registry — the line item must carry the ORDER's
    // org's name, never a hardcoded one (global-value rule).
    const { data: brand } = await db
      .from('config_values')
      .select('value_text')
      .eq('org_id', order.org_id)
      .eq('namespace', 'BRAND')
      .eq('key', 'NAME')
      .maybeSingle();
    let brandName = brand?.value_text as string | undefined;
    if (!brandName) {
      const { data: cfg } = await db
        .from('business_config')
        .select('legal_entity_name')
        .eq('org_id', order.org_id)
        .maybeSingle();
      brandName = (cfg?.legal_entity_name as string | undefined) || 'Order';
    }

    const cardTotalCents = Math.round(Number(order.total) * (1 + STRIPE_FEE_RATE) * 100);
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${brandName} — Order` },
            unit_amount: cardTotalCents,
          },
          quantity: 1,
        },
      ],
      metadata: { order_id: order.id },
      success_url: `${origin}/order/${order.id}?paid=1`,
      cancel_url: `${origin}/order/${order.id}`,
    });

    // Move order to awaiting_payment via Stripe; create-or-refresh the single
    // pending payment row (a retry must not stack duplicate pending rows).
    await db.from('orders').update({ status: 'awaiting_payment', payment_method: 'stripe' }).eq('id', order.id);
    const { data: pending } = await db
      .from('payments')
      .select('id')
      .eq('order_id', order.id)
      .eq('method', 'stripe')
      .eq('status', 'pending')
      .maybeSingle();
    if (pending) {
      await db.from('payments').update({ amount: cardTotalCents / 100 }).eq('id', pending.id);
    } else {
      await db.from('payments').insert({
        order_id: order.id, method: 'stripe', amount: cardTotalCents / 100, status: 'pending',
      });
    }

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('stripe session error', err);
    return res.status(500).json({ error: 'could not create session' });
  }
}
