/* POST /api/request-activation — a website order submission gets the SAME
 * activation email the /sign/* doors send.
 *
 * OWNER, 2026-09-01: *"a valid form submission creates a lead with an order, when
 * the user does this they should be sent an email with the link to activate their
 * account and that is the exact same flow as this one, same link destination,
 * everything."*
 *
 * ⚠️ THIS CONNECTION HAS NEVER EXISTED. Measured before building it:
 * `submit_public_request` carries zero references to invitations or provisioning,
 * and both live order-bearing leads had NO INVITATION EVER SENT. The lead and the
 * order were created and then nothing reached the person — which is also why
 * CR-98 A1 says *"Im not sure where things stand today … but that is the goal."*
 *
 * Anonymous endpoint (the intake form has no auth), and it trusts the caller for
 * NOTHING: the body carries a requestId, used only to look the row up. The email
 * address, the org and the offerings all come from the `requests` row itself —
 * the same discipline `/api/request-received` follows for the same reason.
 *
 * ⚠️ AND IT HONOURS THE THREE STATES (`_lib/accountDoor.ts`). Somebody who
 * already has a working sign-in gets "click here to sign in", not an activation
 * link for an account they finished setting up.
 *
 * ⚠️ NO ORDER, NO EMAIL. The ruling is about a submission that *creates a lead
 * with an order*. A bare enquiry is a conversation, not an account waiting to be
 * claimed, and `/api/inquiry-confirmation` already answers it.
 *
 * -> 200 { ok, emailed, state } always — a mail path must never cost a lead.
 * -> 400 on a missing requestId.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getSupabaseAdmin } from './_lib/supabaseAdmin.js';
import { sendInvitationEmail } from './_lib/invitationEmail.js';
import { accountStateForEmail, sendSignInEmail, greetingNameForContact } from './_lib/accountDoor.js';

interface RequestRow {
  id: string;
  org_id: string;
  contact_email: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_phone: string | null;
  entry_location: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  let body: { requestId?: string };
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {};
  } catch {
    return res.status(400).json({ error: 'invalid JSON body' });
  }
  if (!body.requestId) return res.status(400).json({ error: 'requestId required' });
  const requestId = body.requestId;

  try {
    const db = getSupabaseAdmin();
    const origin = req.headers.origin || `https://${req.headers.host}`;

    const { data } = await db
      .from('requests')
      .select('id, org_id, contact_email, contact_first_name, contact_last_name, contact_phone, entry_location')
      .eq('id', requestId)
      .maybeSingle();
    const r = data as RequestRow | null;
    if (!r?.contact_email) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'request not found' });
    }

    /* TWO TRIGGERS, AND THE SECOND ONE IS THE GUEST VISIT.
       · an ORDER was created for this submission — `submit_public_request` writes
         it as draft/unpaid with buyer_user_id NULL, "which is precisely what
         'lead' means", and links it by request_id;
       · or it is a VISIT REQUEST (`/visit`, `entry_location = 'guest_visit'`).
         Owner, 2026-09-01: *"After submitting the guest visit request form they
         get the email showing what they submitted and telling them we will be in
         touch to discuss scheduling a visit and provide the account activation
         link."* A visit carries no order and still earns the link, because a
         visitor signs a release before they set foot on the property.
       ⚠️ A BARE ENQUIRY STILL GETS NOTHING. It is a conversation, not an account
       waiting to be claimed, and `/api/inquiry-confirmation` already answers it. */
    const isVisit = r.entry_location === 'guest_visit';
    const { data: order } = await db
      .from('purchases').select('id').eq('request_id', r.id).is('deleted_at', null).limit(1).maybeSingle();
    if (!order?.id && !isVisit) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'no order and not a visit request' });
    }

    const facts = await accountStateForEmail(db, r.contact_email);

    if (facts.state === 'active') {
      const sent = await sendSignInEmail(db, {
        orgId: r.org_id,
        to: r.contact_email,
        origin,
        greetingName: r.contact_first_name?.trim()
          || await greetingNameForContact(db, facts.contactId),
      });
      return res.status(200).json({ ok: true, emailed: sent.ok, state: 'active', reason: sent.error });
    }

    /* ⚠️ THE SAME SPINE THE DOOR USES, WITH THE ONE ARGUMENT THE DOOR CANNOT
       SUPPLY: `p_request_id`. Given it, `provision_client_invitation` reads the
       org off the lead and derives the onboarding categories from the order's own
       offerings (`request_onboarding_categories`) — which is CR-98 A1's ruling
       exactly: *"If the person submitted an order from the website catalog the
       documents are assigned based on the selected offerings."*
       A repeat submission is the resume path: same contact, fresh token. */
    const { data: prov, error: provErr } = await db.rpc('provision_client_invitation', {
      p_email: r.contact_email,
      p_first_name: r.contact_first_name,
      p_last_name: r.contact_last_name,
      p_phone: r.contact_phone,
      p_categories: [],
      p_offering_ids: [],
      p_template_keys: null,
      p_mark_paid: false,
      p_payment_method: null,
      p_notes: null,
      p_request_id: r.id,
      p_org_id: r.org_id,
      p_partial_amount: 0,
      /* ⚠️ `p_send` IS DELIBERATELY NOT PASSED. It looks like "don't send the
         email, I'll send it myself" and it is not: it sets the invitation's
         STATUS — `CASE WHEN p_send THEN 'sent' ELSE 'draft' END` — and
         `api/register-invited.ts` refuses any invitation whose status is not
         'sent' with a 404. Passing false here would have minted a link that
         404s on arrival. `api/sign-start.ts` leaves it defaulted for the same
         reason; this is the same spine, called the same way. */
    });
    if (provErr) throw provErr;
    const out = (Array.isArray(prov) ? prov[0] : prov) as
      { invitation_id?: string; token?: string } | null;
    if (!out?.token) {
      return res.status(200).json({ ok: true, emailed: false, reason: 'no invitation token' });
    }

    // ⚠️ THE SAME LINK DESTINATION, verbatim from his ruling. This is the URL
    // shape `api/sign-start.ts` builds for the funnel doors — one activation
    // screen, reached the same way from both entries.
    const sent = await sendInvitationEmail(db, {
      orgId: r.org_id,
      to: r.contact_email,
      registerUrl: `${origin}/activate?token=${out.token}`,
      kind: 'first',
    });
    return res.status(200).json({
      ok: true, emailed: sent.ok, state: facts.state,
      ...(sent.ok ? {} : { reason: sent.error }),
    });
  } catch (err) {
    console.error('request-activation error', err);
    // best-effort: never fail the visitor's submission over a mail error
    return res.status(200).json({ ok: true, emailed: false, reason: 'internal error' });
  }
}
