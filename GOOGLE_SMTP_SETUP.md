# Google Workspace Email Setup (launch transport)

Owner decision 2026-07-01: transactional email sends via **Google Workspace SMTP**
(the domain's SPF/DKIM already live on Google) — no Resend at launch. The Resend
code path stays dormant; revisit only when multi-tenant email (other barns' own
from-domains) arrives.

## 1. Create the app password (one-time, ~3 minutes)

1. Sign in to the **hello@FHEquestrian.com** Google account.
2. Enable **2-Step Verification** (myaccount.google.com → Security) if not already on.
3. Security → **App passwords** → create one named `fhe-website-app`.
4. Copy the 16-character password — that is `GMAIL_SMTP_PASS`.

> Sending limits: ~2,000 messages/day per Workspace user — far above launch volume.
> Gmail rewrites the From header to the authenticated account unless the from
> address is that account or one of its configured aliases; since we authenticate
> as hello@ and send as hello@, no alias setup is needed.

## 2. Vercel environment variables

| Variable | Value |
|---|---|
| `GMAIL_SMTP_USER` | `hello@FHEquestrian.com` |
| `GMAIL_SMTP_PASS` | the app password from step 1 |
| `TRANSACTIONAL_FROM_EMAIL` | `hello@FHEquestrian.com` |
| `GMAIL_SMTP_HOST` / `GMAIL_SMTP_PORT` | optional; default `smtp.gmail.com` / `465` |

Remove/skip `RESEND_API_KEY` — with the GMAIL vars set, SMTP wins anyway.

## 3. Supabase Auth SMTP (auth emails: resets, confirmations)

Supabase's built-in mailer is rate-limited to a handful of emails per hour and is
not production-viable. Point it at the same account:

Supabase Dashboard → Project Settings → **Auth** → SMTP Settings → Enable custom SMTP:
- Host `smtp.gmail.com`, Port `465`
- Username `hello@FHEquestrian.com`, Password = the same app password
- Sender email `hello@FHEquestrian.com`, Sender name `French Heritage Equestrian`

## 4. Zelle webhook inbox (Apps Script poller)

The Zelle flow needs a dedicated inbox (or label on hello@) that receives the
bank's Zelle notification emails. The Apps Script poller reads it and POSTs to
`/api/zelle-reconcile` with header `x-fhe-secret: $ZELLE_INGEST_SECRET`. Set
`ZELLE_INGEST_SECRET` in Vercel and in the Apps Script properties. The live $1
end-to-end test happens after this is wired.

## What sends what (all tenant-branded from the registry)

- `deliver-document` — executed-contract copies to each party
- `send-transactional-email` — signup / receipt / dunning / custom
- `admin-send-invitation` — member invitations
- receipt after payment confirmation (Stripe webhook + Zelle reconcile paths)
