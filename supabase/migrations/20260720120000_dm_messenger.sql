-- Modern direct-messaging: message edit/delete (with timestamps), read receipts,
-- per-user conversation hide/delete, and a rich conversation-list RPC.
--
-- direct_messages already has: id, sender_id, recipient_id, body, read_at,
-- created_at, org_id. We add editing/soft-delete columns and the plumbing around
-- them. Presence/typing is ephemeral (Realtime channels) and needs no schema.

-- ── message-level edit + soft delete ────────────────────────────────────────
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS edited_at  timestamptz;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The sender may now UPDATE their own message (edit / soft-delete); the recipient
-- keeps their existing update path for read receipts. Replace the old policy with
-- one covering both parties, each constrained to what they may touch.
DROP POLICY IF EXISTS dm_update ON direct_messages;
CREATE POLICY dm_update ON direct_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR recipient_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() OR recipient_id = auth.uid());

-- ── per-user conversation hide (thread "delete" for me, not the other party) ──
CREATE TABLE IF NOT EXISTS dm_hidden_conversations (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  other_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- messages at/before this instant are hidden from user_id's list/thread; a newer
  -- message from the other party un-hides the conversation naturally (it's > cutoff).
  hidden_before timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, other_id)
);
ALTER TABLE dm_hidden_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dm_hidden_self ON dm_hidden_conversations;
CREATE POLICY dm_hidden_self ON dm_hidden_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── RPC: edit a message (sender only, not deleted) ──────────────────────────
CREATE OR REPLACE FUNCTION dm_edit_message(p_message_id uuid, p_body text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF btrim(coalesce(p_body,'')) = '' THEN RAISE EXCEPTION 'empty message'; END IF;
  UPDATE direct_messages
     SET body = p_body, edited_at = now()
   WHERE id = p_message_id AND sender_id = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not your message'; END IF;
END;
$$;

-- ── RPC: delete a message (sender only) — soft delete, body cleared ──────────
CREATE OR REPLACE FUNCTION dm_delete_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE direct_messages
     SET deleted_at = now(), body = ''
   WHERE id = p_message_id AND sender_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'not your message'; END IF;
END;
$$;

-- ── RPC: mark a whole conversation read (recipient side) ─────────────────────
CREATE OR REPLACE FUNCTION dm_mark_conversation_read(p_other_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE direct_messages
     SET read_at = now()
   WHERE recipient_id = auth.uid() AND sender_id = p_other_id AND read_at IS NULL;
END;
$$;

-- ── RPC: hide (delete-for-me) a conversation ────────────────────────────────
CREATE OR REPLACE FUNCTION dm_hide_conversation(p_other_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO dm_hidden_conversations (user_id, other_id, hidden_before)
  VALUES (auth.uid(), p_other_id, now())
  ON CONFLICT (user_id, other_id) DO UPDATE SET hidden_before = now();
END;
$$;

-- ── RPC: my conversations, one row per partner, newest-first, with the last
--        (non-deleted) message, unread count, and the partner's identity. Respects
--        per-user hide cutoffs. ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION dm_list_conversations()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  WITH pairs AS (
    SELECT dm.*,
           CASE WHEN dm.sender_id = v_uid THEN dm.recipient_id ELSE dm.sender_id END AS other_id
      FROM direct_messages dm
     WHERE (dm.sender_id = v_uid OR dm.recipient_id = v_uid)
  ),
  visible AS (
    SELECT p.*
      FROM pairs p
      LEFT JOIN dm_hidden_conversations h
        ON h.user_id = v_uid AND h.other_id = p.other_id
     WHERE h.hidden_before IS NULL OR p.created_at > h.hidden_before
  ),
  latest AS (
    SELECT DISTINCT ON (other_id) other_id, id, body, deleted_at, created_at, sender_id
      FROM visible
     ORDER BY other_id, created_at DESC
  ),
  unread AS (
    SELECT other_id, count(*) AS n
      FROM visible
     WHERE recipient_id = v_uid AND read_at IS NULL AND deleted_at IS NULL
     GROUP BY other_id
  )
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.last_at DESC), '[]'::jsonb) INTO v_out
    FROM (
      SELECT l.other_id                                   AS user_id,
             pr.display_name, pr.first_name, pr.avatar_url,
             CASE WHEN l.deleted_at IS NOT NULL THEN NULL ELSE l.body END AS last_body,
             (l.sender_id = v_uid)                        AS last_mine,
             l.created_at                                 AS last_at,
             coalesce(u.n, 0)                             AS unread
        FROM latest l
        LEFT JOIN profiles pr ON pr.user_id = l.other_id
        LEFT JOIN unread u ON u.other_id = l.other_id
    ) t;

  RETURN v_out;
END;
$$;

-- ── RPC: total unread DMs (for the Messages nav badge) ──────────────────────
CREATE OR REPLACE FUNCTION dm_unread_total()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT coalesce(count(*), 0)::int
    FROM direct_messages dm
    LEFT JOIN dm_hidden_conversations h
      ON h.user_id = auth.uid() AND h.other_id = dm.sender_id
   WHERE dm.recipient_id = auth.uid()
     AND dm.read_at IS NULL
     AND dm.deleted_at IS NULL
     AND (h.hidden_before IS NULL OR dm.created_at > h.hidden_before);
$$;

GRANT EXECUTE ON FUNCTION
  dm_edit_message(uuid, text), dm_delete_message(uuid),
  dm_mark_conversation_read(uuid), dm_hide_conversation(uuid),
  dm_list_conversations(), dm_unread_total()
  TO authenticated;
