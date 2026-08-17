-- TASK-GIFTPATH — the gift enquiry becomes a first-class request category/channel.
--
-- requestGift() (src/lib/gifts.ts) used to insert into `requests` directly,
-- bypassing submit_public_request entirely — so a gift enquiry got NO staff
-- alert (dashboard or email), NO buyer confirmation, and no
-- request_alert_sends row. This is exactly the FIRE-AND-FORGET defect
-- INBOUNDALERT already closed for the other three intake paths
-- (orchestration/lessons/LESSONS.md), just via a fourth, unguarded path.
--
-- The fix (this task) routes gifts through submitRequest(), the one RPC
-- wrapper all other intake paths already share. That RPC only accepts
-- category/channel values the CHECK constraints allow, so both are widened
-- by exactly one value each. No selections are passed for a gift enquiry, so
-- submit_public_request's `v_lines > 0` branch never fires and no draft order
-- is opened — consistent with "do not build a gift checkout."
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_category_check;
ALTER TABLE requests ADD  CONSTRAINT requests_category_check
  CHECK (category IS NULL OR category IN
    ('general','lessons','horse_care','acquisition','media','partnership','gift'));

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_channel_check;
ALTER TABLE requests ADD  CONSTRAINT requests_channel_check
  CHECK (channel IS NULL OR channel IN ('contact','inquiry','booking','kiosk','gift'));
