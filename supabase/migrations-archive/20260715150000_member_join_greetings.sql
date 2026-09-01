-- New-member welcome flow.
--
-- When a member joins (membership becomes active for the first time), a
-- 'member_joined' post appears in the community feed — the feed is permanent, so
-- this is how everyone sees who's new. On that card, any existing member may click
-- "Say hi" ONCE; the newcomer receives a note-style dashboard notification, with
-- a "Say hi back" button that sends a thank-you note back — also one click.
--
-- Both messages read like personal notes, not system alerts:
--   hi:      "Hi <new>, welcome to the community! – <greeter>"
--   hi_back: "Hi <greeter>, thanks for welcoming me to the community. – <new>"

-- 1) feed post type for a member joining
ALTER TYPE feed_post_type ADD VALUE IF NOT EXISTS 'member_joined';

-- 2) one row per directed greeting; unique so each button is one-time
CREATE TABLE IF NOT EXISTS member_greetings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id) ON DELETE CASCADE,
  from_user   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('hi','hi_back')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_user, to_user, kind)
);

ALTER TABLE member_greetings ENABLE ROW LEVEL SECURITY;

-- A member sees greetings they sent or received, within their org.
DROP POLICY IF EXISTS member_greetings_own ON member_greetings;
CREATE POLICY member_greetings_own ON member_greetings
  FOR SELECT USING (org_id = current_org() AND (from_user = auth.uid() OR to_user = auth.uid()));
-- Writes go only through the SECURITY DEFINER RPCs below.
DROP POLICY IF EXISTS member_greetings_org ON member_greetings;
CREATE POLICY member_greetings_org ON member_greetings
  FOR ALL USING (org_id = current_org() AND is_admin());
