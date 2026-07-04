/*
  # FHE CRM — Notification email nudge (BOOKING_FLOWS_PLAN §1 Messaging decision:
  notifications spine + email nudge)

  ADDITIVE ONLY — live production data. Members with unread in-app notifications
  get one branded digest email (api/notifications-nudge.ts, daily Vercel cron)
  so nothing is missed off-app.

  1. notifications.emailed_at — stamped by the nudge AFTER a successful send;
     NULL means "not yet emailed". A row is nudged at most once: the cron only
     ever selects read_at IS NULL AND emailed_at IS NULL.
  2. Partial index for the cron's pending scan (user_id grouping over the
     unread-and-unemailed slice only — stays tiny as rows get read/emailed).
*/

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at timestamptz;

COMMENT ON COLUMN notifications.emailed_at IS
  'When the email nudge digested this notification (api/notifications-nudge). NULL = not yet emailed; stamped only after a successful send.';

CREATE INDEX IF NOT EXISTS notifications_nudge_pending_idx
  ON notifications (user_id)
  WHERE read_at IS NULL AND emailed_at IS NULL;
