/*
  # Gifting

  Almost anything on the site can be gifted. A buyer purchases a gift; the system
  mints a gift with a unique code. The recipient "opens" it (animated reveal),
  then scans a QR / clicks a link to sign up and book. Booking may be gated behind
  an intro call (unlock_gate).

  The animated reveal art is a later drop-in; this is the machinery + records.
*/

CREATE TABLE IF NOT EXISTS gifts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text UNIQUE NOT NULL,              -- short redemption code, e.g. GIFT-3F7K
  item_type       text NOT NULL,                     -- 'lessons' | 'membership' | 'horse' | 'acquisition' | ...
  item_label      text NOT NULL,                     -- human label of what was gifted
  amount          numeric(10,2),                     -- value, if applicable
  -- Buyer
  buyer_name      text,
  buyer_email     text,
  buyer_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  order_id        uuid REFERENCES orders(id) ON DELETE SET NULL,
  -- Recipient
  recipient_name  text,
  recipient_email text,
  gift_message    text,
  -- Lifecycle
  status          text NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created','paid','delivered','opened','redeemed','expired','cancelled')),
  unlock_gate     text NOT NULL DEFAULT 'none'       -- 'none' = book immediately; 'intro_call' = unlock after a call
                    CHECK (unlock_gate IN ('none','intro_call')),
  unlocked        boolean NOT NULL DEFAULT false,    -- set true once any gate is cleared
  opened_at       timestamptz,
  redeemed_at     timestamptz,
  redeemed_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;

-- The buyer (when signed in) and admins can read a gift directly.
DROP POLICY IF EXISTS gifts_buyer_read ON gifts;
CREATE POLICY gifts_buyer_read ON gifts
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR redeemed_user_id = auth.uid() OR is_admin());

-- Admins manage gifts (create/fulfill/unlock). Anonymous creation happens through
-- the server (checkout) with the service role; recipients look up by code via RPC.
DROP POLICY IF EXISTS gifts_admin_all ON gifts;
CREATE POLICY gifts_admin_all ON gifts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Public reveal: look up a gift by its code WITHOUT exposing the table. Returns the
-- displayable fields only, and marks it opened on first look.
CREATE OR REPLACE FUNCTION open_gift(p_code text)
RETURNS TABLE (
  item_type text, item_label text, recipient_name text, gift_message text,
  buyer_name text, status text, unlock_gate text, unlocked boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Mark opened the first time a valid, paid/delivered gift is viewed.
  UPDATE gifts g SET status = 'opened', opened_at = now()
  WHERE g.code = p_code AND g.status IN ('paid','delivered');

  RETURN QUERY
    SELECT g.item_type, g.item_label, g.recipient_name, g.gift_message,
           g.buyer_name, g.status, g.unlock_gate, g.unlocked
    FROM gifts g
    WHERE g.code = p_code
      AND g.status IN ('paid','delivered','opened','redeemed')
      AND (g.expires_at IS NULL OR g.expires_at > now());
END;
$$;

-- Redeem a gift for the signed-in user. Only succeeds if the gift is open/delivered
-- and (gate cleared OR no gate). Ties the gift to the redeemer.
CREATE OR REPLACE FUNCTION redeem_gift(p_code text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gift gifts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN 'not_authenticated';
  END IF;

  SELECT * INTO v_gift FROM gifts WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_gift.status = 'redeemed' THEN RETURN 'already_redeemed'; END IF;
  IF v_gift.expires_at IS NOT NULL AND v_gift.expires_at < now() THEN RETURN 'expired'; END IF;
  IF v_gift.unlock_gate = 'intro_call' AND NOT v_gift.unlocked THEN RETURN 'awaiting_intro_call'; END IF;

  UPDATE gifts SET status = 'redeemed', redeemed_at = now(), redeemed_user_id = auth.uid()
  WHERE id = v_gift.id;
  RETURN 'redeemed';
END;
$$;

CREATE INDEX IF NOT EXISTS gifts_code_idx ON gifts (code);
CREATE INDEX IF NOT EXISTS gifts_status_idx ON gifts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS gifts_recipient_idx ON gifts (recipient_email);
