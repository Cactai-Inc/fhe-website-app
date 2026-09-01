/*
  # French Heritage Equestrian — Community / Members App

  The logged-in members' community: profile extensions, memberships, groups,
  announcements, a real-time chat board (channels), forum threads, direct messages,
  members-only content (articles + resource library), events with RSVPs, and
  moderation. Builds on the platform model (profiles, is_admin()).

  ## Access model
  - is_active_member(): true for admins or anyone with an active membership.
  - Most community reads are gated to active members; writes are author-owned;
    admins can moderate (hide/remove) anything.
  - Realtime is enabled on chat + DM + announcement tables for live updates.
*/

-- ── Profile extensions for the social layer ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url   text,
  ADD COLUMN IF NOT EXISTS bio          text,
  ADD COLUMN IF NOT EXISTS riding_level text,   -- e.g. 'returning', 'committed', 'newcomer'
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;

-- ── Memberships ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier       text NOT NULL DEFAULT 'community' CHECK (tier IN ('community','rider','full')),
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  renews_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Active-member check used across community RLS. SECURITY DEFINER to avoid RLS
-- recursion. Admins always pass; suspended users never pass.
CREATE OR REPLACE FUNCTION is_active_member()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN COALESCE((SELECT p.is_suspended FROM profiles p WHERE p.user_id = auth.uid()), false) THEN false
      WHEN COALESCE((SELECT p.is_admin FROM profiles p WHERE p.user_id = auth.uid()), false) THEN true
      ELSE EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid() AND m.status = 'active'
      )
    END;
$$;

DROP POLICY IF EXISTS memberships_select ON memberships;
CREATE POLICY memberships_select ON memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS memberships_admin_write ON memberships;
CREATE POLICY memberships_admin_write ON memberships
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Member groups ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id  uuid NOT NULL REFERENCES member_groups(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'member' CHECK (role IN ('member','lead')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
ALTER TABLE member_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_groups_read ON member_groups;
CREATE POLICY member_groups_read ON member_groups
  FOR SELECT TO authenticated USING (is_active_member());
DROP POLICY IF EXISTS member_groups_admin ON member_groups;
CREATE POLICY member_groups_admin ON member_groups
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS group_members_read ON group_members;
CREATE POLICY group_members_read ON group_members
  FOR SELECT TO authenticated USING (is_active_member());
DROP POLICY IF EXISTS group_members_self ON group_members;
CREATE POLICY group_members_self ON group_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ── Announcements (from the company account) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  pinned     boolean NOT NULL DEFAULT false,
  published  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS announcements_read ON announcements;
CREATE POLICY announcements_read ON announcements
  FOR SELECT TO authenticated USING (is_active_member() AND (published OR is_admin()));
DROP POLICY IF EXISTS announcements_admin ON announcements;
CREATE POLICY announcements_admin ON announcements
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Chat board: channels + messages (real-time) ──────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS channel_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channels_read ON channels;
CREATE POLICY channels_read ON channels
  FOR SELECT TO authenticated USING (is_active_member());
DROP POLICY IF EXISTS channels_admin ON channels;
CREATE POLICY channels_admin ON channels
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Members read non-hidden messages (or their own, or all if admin); write their own.
DROP POLICY IF EXISTS channel_messages_read ON channel_messages;
CREATE POLICY channel_messages_read ON channel_messages
  FOR SELECT TO authenticated
  USING (is_active_member() AND (NOT hidden OR author_id = auth.uid() OR is_admin()));
DROP POLICY IF EXISTS channel_messages_insert ON channel_messages;
CREATE POLICY channel_messages_insert ON channel_messages
  FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND author_id = auth.uid());
DROP POLICY IF EXISTS channel_messages_update_own ON channel_messages;
CREATE POLICY channel_messages_update_own ON channel_messages
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin())
  WITH CHECK (author_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS channel_messages_delete ON channel_messages;
CREATE POLICY channel_messages_delete ON channel_messages
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin());

-- ── Forum threads + posts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  body        text NOT NULL,
  pinned      boolean NOT NULL DEFAULT false,
  locked      boolean NOT NULL DEFAULT false,
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  last_post_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS thread_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS threads_read ON threads;
CREATE POLICY threads_read ON threads
  FOR SELECT TO authenticated
  USING (is_active_member() AND (NOT hidden OR author_id = auth.uid() OR is_admin()));
DROP POLICY IF EXISTS threads_insert ON threads;
CREATE POLICY threads_insert ON threads
  FOR INSERT TO authenticated WITH CHECK (is_active_member() AND author_id = auth.uid());
DROP POLICY IF EXISTS threads_update ON threads;
CREATE POLICY threads_update ON threads
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin()) WITH CHECK (author_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS threads_delete ON threads;
CREATE POLICY threads_delete ON threads
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS thread_posts_read ON thread_posts;
CREATE POLICY thread_posts_read ON thread_posts
  FOR SELECT TO authenticated
  USING (is_active_member() AND (NOT hidden OR author_id = auth.uid() OR is_admin()));
DROP POLICY IF EXISTS thread_posts_insert ON thread_posts;
CREATE POLICY thread_posts_insert ON thread_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_active_member() AND author_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM threads t WHERE t.id = thread_id AND t.locked)
  );
DROP POLICY IF EXISTS thread_posts_update ON thread_posts;
CREATE POLICY thread_posts_update ON thread_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR is_admin()) WITH CHECK (author_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS thread_posts_delete ON thread_posts;
CREATE POLICY thread_posts_delete ON thread_posts
  FOR DELETE TO authenticated USING (author_id = auth.uid() OR is_admin());

-- ── Direct messages ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS direct_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body        text NOT NULL,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Either party may read; only the sender may insert (as themselves); recipient may
-- mark read (update). Admins can read for moderation.
DROP POLICY IF EXISTS dm_read ON direct_messages;
CREATE POLICY dm_read ON direct_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS dm_insert ON direct_messages;
CREATE POLICY dm_insert ON direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (is_active_member() AND sender_id = auth.uid());
DROP POLICY IF EXISTS dm_update ON direct_messages;
CREATE POLICY dm_update ON direct_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()) WITH CHECK (recipient_id = auth.uid());

-- ── Members-only content: articles + resource library ────────────────────────
CREATE TABLE IF NOT EXISTS content_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title       text NOT NULL,
  slug        text UNIQUE NOT NULL,
  excerpt     text,
  body        text NOT NULL,
  cover_url   text,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS content_resources (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  description  text,
  kind         text NOT NULL DEFAULT 'file' CHECK (kind IN ('file','video','link')),
  url          text,             -- external link or video embed URL
  storage_path text,             -- path within the 'members' Storage bucket
  published    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_resources ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS content_posts_set_updated_at ON content_posts;
CREATE TRIGGER content_posts_set_updated_at BEFORE UPDATE ON content_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP POLICY IF EXISTS content_posts_read ON content_posts;
CREATE POLICY content_posts_read ON content_posts
  FOR SELECT TO authenticated USING (is_active_member() AND (published OR is_admin()));
DROP POLICY IF EXISTS content_posts_admin ON content_posts;
CREATE POLICY content_posts_admin ON content_posts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS content_resources_read ON content_resources;
CREATE POLICY content_resources_read ON content_resources
  FOR SELECT TO authenticated USING (is_active_member() AND (published OR is_admin()));
DROP POLICY IF EXISTS content_resources_admin ON content_resources;
CREATE POLICY content_resources_admin ON content_resources
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Events + RSVPs ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz,
  location    text,
  capacity    integer,
  published   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'going' CHECK (status IN ('going','maybe','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS events_read ON events;
CREATE POLICY events_read ON events
  FOR SELECT TO authenticated USING (is_active_member() AND (published OR is_admin()));
DROP POLICY IF EXISTS events_admin ON events;
CREATE POLICY events_admin ON events
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS event_rsvps_read ON event_rsvps;
CREATE POLICY event_rsvps_read ON event_rsvps
  FOR SELECT TO authenticated USING (is_active_member());
DROP POLICY IF EXISTS event_rsvps_self ON event_rsvps;
CREATE POLICY event_rsvps_self ON event_rsvps
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK ((user_id = auth.uid() AND is_active_member()) OR is_admin());

-- ── Moderation log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS moderation_actions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  moderator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text NOT NULL,   -- 'channel_message' | 'thread' | 'thread_post' | 'user'
  target_id   uuid NOT NULL,
  action      text NOT NULL,   -- 'hide' | 'unhide' | 'remove' | 'suspend' | 'reinstate'
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS moderation_admin ON moderation_actions;
CREATE POLICY moderation_admin ON moderation_actions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── Helpful view: directory of active members (safe public-ish profile fields) ─
CREATE OR REPLACE VIEW member_directory
WITH (security_invoker = true) AS
  SELECT p.user_id, p.display_name, p.first_name, p.avatar_url, p.bio, p.riding_level
  FROM profiles p
  JOIN memberships m ON m.user_id = p.user_id AND m.status = 'active'
  WHERE NOT p.is_suspended;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS channel_messages_channel_idx ON channel_messages (channel_id, created_at);
CREATE INDEX IF NOT EXISTS thread_posts_thread_idx ON thread_posts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS threads_last_post_idx ON threads (last_post_at DESC);
CREATE INDEX IF NOT EXISTS dm_pair_idx ON direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS dm_recipient_idx ON direct_messages (recipient_id, read_at);
CREATE INDEX IF NOT EXISTS announcements_pinned_idx ON announcements (pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS events_starts_idx ON events (starts_at);
CREATE INDEX IF NOT EXISTS content_posts_pub_idx ON content_posts (published, created_at DESC);

-- ── Realtime: publish chat, DMs, threads, announcements for live updates ──────
-- (Supabase's supabase_realtime publication; ALTER is idempotent-safe via DO block.)
DO $$
BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname = 'supabase_realtime';
  IF FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE thread_posts;
    ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- tables already in the publication; ignore
  NULL;
END $$;
