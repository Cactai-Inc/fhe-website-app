/*
  # Slice 3 — Feed system schema (the app Home)

  The feed post object (spec Part 5): single image OR video (enforced single-media),
  a description body hidden until tapped, an optional plain link, a type that drives
  the service button, an author, visibility, moderation state, and a scheduled
  publish time (staged/time-delayed posting so a content backlog doesn't deluge users).

  Plus: per-user seen marker (seen-position scroll), per-user view-shape preference
  (blended / grouped-pockets / separate), and shares (item lands atop a recipient's feed).

  Moderation at launch (owner B3): report-and-review. scan_state defaults 'clean'
  (the scan is a clean seam that returns clean; NudeNet/vision drops in later).
  Two admin lists = queries over flagged/disputed. Admin can pull_down anything.
*/

DO $$ BEGIN
  CREATE TYPE feed_post_type   AS ENUM ('horse','gear','rider_post','event','article','marketing');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE feed_media_kind  AS ENUM ('image','video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE feed_visibility  AS ENUM ('public','members','both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  -- scan verdict: clean (live), blocked (unacceptable), disputed (user reported the block)
  CREATE TYPE feed_scan_state  AS ENUM ('clean','blocked','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE feed_view_shape  AS ENUM ('blended','pockets','separate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── the post object ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL,
  author_id       uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  -- byline: post as self (author_id) or as the company (operators only)
  as_company      boolean NOT NULL DEFAULT false,
  post_type       feed_post_type NOT NULL,
  -- ENFORCED single media: exactly one url + kind (never a gallery)
  media_url       text NOT NULL,
  media_kind      feed_media_kind NOT NULL,
  -- description body, hidden until tapped
  body            text,
  -- optional plain link element (a link is just a link; NOT link-to-generate)
  source_link     text,
  -- the item this post is "about" (a horse/gear item) for the engage-service gesture
  subject_horse_id uuid REFERENCES horses(id) ON DELETE SET NULL,
  visibility      feed_visibility NOT NULL DEFAULT 'members',
  -- moderation
  scan_state      feed_scan_state NOT NULL DEFAULT 'clean',
  pulled_down     boolean NOT NULL DEFAULT false,      -- admin pull-down of a live post
  reported_reason text,                                 -- set when the user disputes a block
  -- staged / time-delayed publishing: live only when published AND publish_at <= now()
  published       boolean NOT NULL DEFAULT false,
  publish_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_posts_live_idx ON feed_posts (org_id, publish_at DESC)
  WHERE published AND NOT pulled_down AND scan_state = 'clean';
CREATE INDEX IF NOT EXISTS feed_posts_mod_idx  ON feed_posts (org_id, scan_state)
  WHERE scan_state <> 'clean';

-- ── per-user seen marker (seen-position scroll) ───────────────────────────
CREATE TABLE IF NOT EXISTS feed_seen (
  user_id    uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  post_id    uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  seen_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ── per-user view-shape preference (their first act in the welcome feed) ──
CREATE TABLE IF NOT EXISTS feed_view_pref (
  user_id     uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  shape       feed_view_shape NOT NULL DEFAULT 'blended',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── shares (item lands atop a recipient's feed, "shared by [name]") ───────
CREATE TABLE IF NOT EXISTS feed_shares (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL,
  post_id      uuid NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  to_user_id   uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_shares_to_idx ON feed_shares (to_user_id, created_at DESC);

-- ── account-injected feed items (bookings/reminders/milestones as feed cards) ──
-- Distinct from content posts: system cards rendered from the user's own state.
CREATE TABLE IF NOT EXISTS feed_account_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL,
  user_id     uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  kind        text NOT NULL,   -- 'welcome' | 'view_chooser' | 'orientation' | 'purchase_card' | 'reminder' | 'rebook' | 'booking' | 'milestone'
  title       text,
  body        text,
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,  -- e.g. { engagement_id, order_id, date, calendar_url }
  resolved    boolean NOT NULL DEFAULT false,       -- dismissible/action-complete
  created_at  timestamptz NOT NULL DEFAULT now(),
  publish_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS feed_account_items_user_idx ON feed_account_items (user_id, publish_at DESC);
