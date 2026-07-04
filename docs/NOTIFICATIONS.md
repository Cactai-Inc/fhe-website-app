# Notifications — email nudge

The in-app notifications spine (migration `20260703090000_notifications.sql`,
BOOKING_FLOWS_PLAN §1 Messaging decision) gets an off-app safety net: members
with **unread** in-app notifications receive one tenant-branded digest email so
nothing is missed when they aren't in the app.

## What the nudge does

`api/notifications-nudge.ts` runs daily (Vercel cron, see below) and:

1. Selects notifications with `read_at IS NULL AND emailed_at IS NULL AND
   created_at < now() - 30 minutes`. The 30-minute grace means someone reading
   in-app right now isn't emailed about what they just saw.
2. Groups per user (max 10 titles per digest, newest first — the rest roll into
   the next run) and sends **one** email per user, branded from the user's org
   via the value registry (`resolveTenantEmailIdentity` — from-name, legal
   footer; never hardcoded).
   - Subject: `You have N updates at {brand}` (`You have 1 update at {brand}`
     when singular).
   - Body: the notification titles as a list + one CTA link to the app root
     (`{origin}/app`).
3. Stamps `emailed_at` on the digested rows **only after a successful send**
   (a failed send retries on the next run; each user is fenced in their own
   try/catch so one failure never blocks the rest).

A notification is nudged **at most once** — `emailed_at` (migration
`20260703130000_notification_nudge.sql`) takes it out of the pending set.

## Schedule

`vercel.json` crons: `0 16 * * *` — daily at 16:00 UTC ≈ 9am Pacific, so the
digest lands at the start of the member's day, and anything produced overnight
has long cleared the 30-minute grace window.

## Auth + environment

- **Vercel cron path**: needs nothing. Vercel stamps the `x-vercel-cron` header
  on its invocations; the endpoint admits requests carrying it.
- **Manual runs**: set `CRON_SECRET` in Vercel (any long random string). The
  endpoint then also accepts `Authorization: Bearer $CRON_SECRET`. Without the
  env var set, the bearer path is disabled entirely.
- Everything else is rejected 401.

## Trigger manually

```sh
curl -X POST https://<your-deployment-host>/api/notifications-nudge \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response: `{ "users_nudged": <n>, "notifications_marked": <n> }`.
