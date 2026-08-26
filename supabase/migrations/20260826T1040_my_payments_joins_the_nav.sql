-- MY PAYMENTS JOINS THE PRESENCE-GATED NAV.
-- The link appears once the person has a payment entry to read; an order with no
-- method chosen is AWAITING PAYMENT, which is the absence of an entry, so someone
-- who has never engaged the payment screen gets no row.
BEGIN;
CREATE OR REPLACE FUNCTION public.my_nav_presence()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_payments boolean;
  v_orders boolean;
  v_documents boolean;
  v_stable boolean;
  v_posts boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object(
      'orders', false, 'documents', false, 'stable', false, 'payments', false,
      'posts', false, 'saved', false);
  END IF;

  v_orders := EXISTS (
    SELECT 1 FROM purchases p
    WHERE (p.buyer_user_id = auth.uid() OR p.buyer_contact_id = current_contact_id())
      AND p.org_id = current_org()
  );

  v_documents := EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1);

  v_stable := EXISTS (SELECT 1 FROM public.my_stable_horses() LIMIT 1);

  v_posts := EXISTS (
    SELECT 1 FROM feed_posts fp WHERE fp.author_id = auth.uid()
  );

  -- CR-76b: My Payments appears once there is a payment entry to read. An order
  -- with no method chosen is AWAITING PAYMENT — the absence of an entry — so a
  -- client who has never engaged the payment screen gets no row, which is the
  -- same presence rule every other link here uses.
  v_payments := EXISTS (
    SELECT 1 FROM payments pay
     WHERE pay.deleted_at IS NULL
       AND pay.payer_contact_id = current_contact_id()
  );

  RETURN jsonb_build_object(
    'orders', v_orders,
    'documents', v_documents,
    'stable', v_stable,
    'posts', v_posts,
    'saved', false,
    'payments', v_payments
  );
END;
$function$;
COMMIT;
