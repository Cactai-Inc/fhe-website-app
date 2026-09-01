/*
  # Exact payment amounts + invitation expire/delete

  1. Owner: "prices have random extra amounts added" — the Zelle reconciler
     stamped a unique 1–99¢ offset onto each order as its matching key.
     Removed: finalize_order_payment v2 sets unique_amount = the exact total.
     Reconciliation now leans on the memo reference (its existing fallback);
     same-total collisions go to the review queue instead of auto-matching.
  2. Invitations: admins can EXPIRE an invite (link dies now) or DELETE it
     (link dies + soft-deleted). A deleted invitation always PRESENTS as
     expired — deletion is never surfaced to anyone.
*/

-- ── 1. exact amounts ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finalize_order_payment(p_order_id uuid, p_method text)
RETURNS TABLE (unique_amount numeric, payment_reference text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_order  orders%ROWTYPE;
  v_total  numeric;
  v_ref    text;
  v_prefix text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  UPDATE order_items oi
     SET price_amount = ot.price_amount
    FROM offering_tiers ot
   WHERE oi.order_id = p_order_id
     AND oi.tier_id = ot.id
     AND oi.price_amount IS DISTINCT FROM ot.price_amount;

  SELECT COALESCE(SUM(oi.price_amount), 0) INTO v_total
    FROM order_items oi WHERE oi.order_id = p_order_id;
  IF v_total = 0 THEN v_total := COALESCE(v_order.total, 0); END IF;

  IF v_order.payment_reference IS NULL THEN
    SELECT cv.value_text INTO v_prefix
      FROM config_values cv
     WHERE cv.org_id = v_order.org_id AND cv.namespace = 'BRAND' AND cv.key = 'SHORT_NAME';
    v_prefix := COALESCE(NULLIF(regexp_replace(upper(v_prefix), '[^A-Z0-9]', '', 'g'), ''), 'ORD');
    v_ref := v_prefix || '-' || upper(substr(md5(p_order_id::text || v_prefix), 1, 6));
  ELSE
    v_ref := v_order.payment_reference;
  END IF;

  UPDATE orders o
     SET subtotal = v_total,
         total = v_total,
         unique_amount = v_total,   -- EXACT total; the memo reference is the match key
         payment_reference = v_ref,
         payment_method = p_method,
         status = 'awaiting_payment'
   WHERE o.id = p_order_id;

  RETURN QUERY SELECT v_total, v_ref;
END;
$fn$;

-- ── 2. invitation expire / delete ────────────────────────────────────────────
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION admin_expire_invitation(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT (has_staff_access() AND is_admin()) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  UPDATE invitations SET expires_at = now()
   WHERE id = p_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION admin_delete_invitation(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT (has_staff_access() AND is_admin()) THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  -- soft delete + kill the link; a deleted invite always PRESENTS as expired
  UPDATE invitations SET deleted_at = now(), expires_at = least(expires_at, now())
   WHERE id = p_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found'; END IF;
END;
$fn$;

-- ── 3. admin_client_accounts v2 — expose the latest invite's id so the panel
--      can expire/delete it (return-type change → drop first)
DROP FUNCTION IF EXISTS admin_client_accounts();
CREATE FUNCTION admin_client_accounts()
RETURNS TABLE (
  kind text,
  user_id uuid, contact_id uuid, client_id uuid,
  first_name text, last_name text, display_name text, email text,
  is_suspended boolean, membership_status text, created_at timestamptz,
  tags text[],
  invite_id uuid, invite_status text, invite_expires_at timestamptz, invite_scheduled_for date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 'account', p.user_id, p.contact_id, cl.id,
         p.first_name, p.last_name, p.display_name, p.email,
         p.is_suspended, m.status, p.created_at,
         c.tags, NULL::uuid, NULL::text, NULL::timestamptz, NULL::date
  FROM profiles p
  LEFT JOIN contacts c ON c.id = p.contact_id
  LEFT JOIN clients cl ON cl.contact_id = p.contact_id AND cl.deleted_at IS NULL
  LEFT JOIN memberships m ON m.user_id = p.user_id
  WHERE p.org_id = current_org() AND p.role = 'USER' AND is_admin()
  UNION ALL
  SELECT 'pending', NULL, c.id, cl.id,
         c.first_name, c.last_name, NULL, c.email,
         false, NULL, cl.created_at,
         c.tags, inv.id, inv.status, inv.expires_at, inv.scheduled_for
  FROM clients cl
  JOIN contacts c ON c.id = cl.contact_id AND c.deleted_at IS NULL
  LEFT JOIN LATERAL (
    -- deleted invites stay visible here; their past expires_at reads "expired"
    SELECT i.id, i.status, i.expires_at, i.scheduled_for
    FROM invitations i
    WHERE lower(i.email) = lower(c.email)
    ORDER BY i.created_at DESC LIMIT 1
  ) inv ON true
  WHERE cl.org_id = current_org() AND cl.deleted_at IS NULL AND is_admin()
    AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id)
$$;

GRANT EXECUTE ON FUNCTION admin_expire_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_client_accounts() TO authenticated;
