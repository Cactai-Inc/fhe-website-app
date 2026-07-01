/* Client-side payment helpers. The actual charge + reconciliation happen
 * server-side (Vercel functions in /api). This only kicks off the Stripe
 * Checkout redirect and surfaces errors.
 */

import { supabase } from './supabase';

/**
 * Asks the serverless function to create a Stripe Checkout Session for an order,
 * then redirects the browser to it. The function verifies the caller owns the
 * order (via the forwarded access token) before creating the session.
 */
export async function startStripeCheckout(orderId: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const res = await fetch('/api/stripe-create-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ orderId }),
  });

  if (!res.ok) {
    throw new Error('Could not start card checkout. Please try Zelle or contact us.');
  }
  const { url } = (await res.json()) as { url: string };
  if (!url) throw new Error('No checkout URL returned.');
  window.location.href = url;
}
