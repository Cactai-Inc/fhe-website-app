-- Join-event trigger + say-hi / say-hi-back RPCs (companion to the table migration).

-- feed_posts assumed every post has media (media_url + media_kind NOT NULL). A
-- member_joined post is text-only, as are future plain rider posts. Relax both so
-- text-only posts are valid. (Relaxing NOT NULL never invalidates existing rows.)
ALTER TABLE feed_posts ALTER COLUMN media_url DROP NOT NULL;
ALTER TABLE feed_posts ALTER COLUMN media_kind DROP NOT NULL;

-- Best-effort display name for a member (first name, else display_name, else 'A member').
CREATE OR REPLACE FUNCTION public.member_display_name(p_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    nullif(btrim(coalesce(first_name,'')), ''),
    nullif(btrim(coalesce(display_name,'')), ''),
    'A member'
  ) FROM profiles WHERE user_id = p_user_id;
$function$;

-- When a membership first becomes active, drop a permanent 'member_joined' post
-- into the feed, authored by the new member. Idempotent: one join post per member.
CREATE OR REPLACE FUNCTION public.memberships_post_join_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
BEGIN
  IF NEW.status <> 'active' THEN RETURN NEW; END IF;
  -- only on the transition into active (insert-active, or update to active)
  IF TG_OP = 'UPDATE' AND OLD.status = 'active' THEN RETURN NEW; END IF;

  v_org := coalesce(NEW.org_id, (SELECT org_id FROM profiles WHERE user_id = NEW.user_id));
  IF v_org IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM feed_posts
    WHERE author_id = NEW.user_id AND post_type = 'member_joined'
  ) THEN
    INSERT INTO feed_posts (org_id, author_id, post_type, body, visibility, published)
    VALUES (v_org, NEW.user_id, 'member_joined',
            member_display_name(NEW.user_id) || ' just joined the community.',
            'members', true);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_memberships_post_join_event ON memberships;
CREATE TRIGGER trg_memberships_post_join_event
  AFTER INSERT OR UPDATE OF status ON memberships
  FOR EACH ROW EXECUTE FUNCTION memberships_post_join_event();

-- Say hi to a new member. One-time (unique constraint). Sends a note-style
-- notification. Returns true if this call recorded the greeting (false if the
-- caller already said hi).
CREATE OR REPLACE FUNCTION public.say_hi(p_to_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_from uuid := auth.uid();
BEGIN
  IF v_from IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF v_from = p_to_user THEN RETURN false; END IF;

  v_org := (SELECT org_id FROM profiles WHERE user_id = v_from);
  IF v_org IS NULL OR v_org IS DISTINCT FROM (SELECT org_id FROM profiles WHERE user_id = p_to_user) THEN
    RAISE EXCEPTION 'members must be in the same community';
  END IF;

  INSERT INTO member_greetings (org_id, from_user, to_user, kind)
  VALUES (v_org, v_from, p_to_user, 'hi')
  ON CONFLICT (from_user, to_user, kind) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  -- note to the new member; link back to the greeter's profile so they can reply
  -- link carries the greeter's id so the recipient's notification can offer a
  -- one-click "Say hi back".
  INSERT INTO notifications (org_id, user_id, kind, title, body, link)
  VALUES (v_org, p_to_user, 'member_hi',
          'A welcome from ' || member_display_name(v_from),
          'Hi ' || member_display_name(p_to_user) || ', welcome to the community! – ' || member_display_name(v_from),
          '/app?filter=members&hi_back=' || v_from::text);
  RETURN true;
END;
$function$;

-- Say hi back (the new member thanking a greeter). Only allowed if that greeter
-- actually said hi first. One-time. Sends the thank-you note.
CREATE OR REPLACE FUNCTION public.say_hi_back(p_to_user uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org  uuid;
  v_from uuid := auth.uid();
BEGIN
  IF v_from IS NULL THEN RAISE EXCEPTION 'sign in first'; END IF;
  IF v_from = p_to_user THEN RETURN false; END IF;

  -- must be replying to a real 'hi' from that member
  IF NOT EXISTS (
    SELECT 1 FROM member_greetings
    WHERE from_user = p_to_user AND to_user = v_from AND kind = 'hi'
  ) THEN
    RAISE EXCEPTION 'no welcome to reply to';
  END IF;

  v_org := (SELECT org_id FROM profiles WHERE user_id = v_from);

  INSERT INTO member_greetings (org_id, from_user, to_user, kind)
  VALUES (v_org, v_from, p_to_user, 'hi_back')
  ON CONFLICT (from_user, to_user, kind) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  INSERT INTO notifications (org_id, user_id, kind, title, body, link)
  VALUES (v_org, p_to_user, 'member_hi_back',
          'A note from ' || member_display_name(v_from),
          'Hi ' || member_display_name(p_to_user) || ', thanks for welcoming me to the community. – ' || member_display_name(v_from),
          '/app?filter=members');
  RETURN true;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.say_hi(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.say_hi_back(uuid) TO authenticated;
