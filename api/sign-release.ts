/* POST /api/sign-release
 * Server-side wrapper for the public release kiosk (H2 hardening, 2026-08-02).
 *
 * The kiosk (/release, Release.tsx) is intentionally sessionless — a walk-in
 * visitor with no account signs a facility release. H1 traced that the
 * kiosk's delivery email was firing as an UNAUTHENTICATED HTTP POST to
 * /api/deliver-document, which now requires staff and would reject it. There
 * is no way to attach a session to a kiosk request (there isn't one), so the
 * spec's fallback applies: the send moves server-side. This endpoint is that
 * server-side hook — it calls the exact same sign_release RPC the browser
 * called directly before (same anon-key semantics, same validation, nothing
 * about signing itself changes), then invokes deliverExecutedDocument()
 * in-process (a function call, not a second HTTP request) before responding.
 *
 * Body: same shape as the sign_release RPC params (see src/lib/ops/api-public.ts
 * SignReleaseInput) with documentId omitted (the RPC creates it).
 * -> 200 SignReleaseResult (unchanged from calling the RPC directly)
 * -> 400 on a missing template_key or a validation error from the RPC
 * -> 5xx on an unexpected failure
 *
 * Delivery is best-effort exactly as it was before: a delivery failure is
 * logged but never fails the response — the signer's executed document is
 * already recorded regardless of whether the email send succeeds.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { deliverExecutedDocument, DeliveryError } from './_lib/delivery.js';

function anonClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

interface SignReleaseResult {
  document_id: string;
  document_code: string;
  contact_id: string;
  status: string;
  merged_body: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: Record<string, unknown>;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  const templateKey = typeof body.template_key === 'string' ? body.template_key : '';
  if (!templateKey) return res.status(400).json({ error: 'template_key required' });

  try {
    const rpcParams: Record<string, unknown> = {
      p_template_key: templateKey,
      p_first_name: body.first_name ?? '',
      p_last_name: body.last_name ?? '',
      p_email: body.email ?? '',
      p_phone: body.phone ?? null,
      p_typed_name: body.typed_name ?? '',
      p_is_minor: body.is_minor ?? false,
      p_minor_first_name: body.minor_first_name ?? null,
      p_minor_last_name: body.minor_last_name ?? null,
      p_minor_dob: body.minor_dob ?? null,
      p_guardian_relationship: body.guardian_relationship ?? null,
      p_rules_acknowledged: body.rules_acknowledged ?? false,
      p_esign_consent: body.esign_consent ?? false,
      p_dob: body.dob ?? null,
      p_address_line1: body.address_line1 ?? null,
      p_address_line2: body.address_line2 ?? null,
      p_city: body.city ?? null,
      p_state: body.state ?? null,
      p_postal_code: body.postal_code ?? null,
      p_ec1_name: body.emergency_contact_1_name ?? null,
      p_ec1_relationship: body.emergency_contact_1_relationship ?? null,
      p_ec1_phone: body.emergency_contact_1_phone ?? null,
      p_ec2_name: body.emergency_contact_2_name ?? null,
      p_ec2_relationship: body.emergency_contact_2_relationship ?? null,
      p_ec2_phone: body.emergency_contact_2_phone ?? null,
    };
    if (typeof body.org_id === 'string' && body.org_id) rpcParams.p_org = body.org_id;

    const anon = anonClient();
    const { data, error } = await anon.rpc('sign_release', rpcParams);
    if (error) return res.status(400).json({ error: error.message });
    const result = data as SignReleaseResult;

    // Server-side delivery, in-process (no HTTP hop, no unauthenticated call
    // to /api/deliver-document). Best-effort: never fails the signed result.
    try {
      const db = getSupabaseAdmin();
      await deliverExecutedDocument(db, result.document_id);
    } catch (deliveryErr) {
      if (!(deliveryErr instanceof DeliveryError)) {
        console.error('sign-release: delivery failed', deliveryErr);
      }
      // DeliveryError (e.g. race on status) is also swallowed here — the
      // signed document is already safely recorded either way, matching the
      // pre-hardening .catch(() => {}) best-effort semantics.
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('sign-release error', err);
    return res.status(500).json({ error: 'could not record your signature' });
  }
}
