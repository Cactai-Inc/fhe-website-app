-- The caller's gifts: ones they RECEIVED (to use) and ones they GAVE. A gift is
-- "received" when redeemed by them or addressed to their account email; "given" when
-- they were the buyer.
CREATE OR REPLACE FUNCTION public.my_gifts()
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  SELECT coalesce(jsonb_agg(g ORDER BY g.created_at DESC), '[]'::jsonb) FROM (
    SELECT jsonb_build_object(
      'id', gf.id, 'code', gf.code, 'item_type', gf.item_type, 'item_label', gf.item_label,
      'amount', gf.amount, 'status', gf.status, 'gift_message', gf.gift_message,
      'buyer_name', gf.buyer_name, 'recipient_name', gf.recipient_name,
      'unlocked', gf.unlocked, 'opened_at', gf.opened_at, 'redeemed_at', gf.redeemed_at,
      'expires_at', gf.expires_at, 'created_at', gf.created_at,
      'direction', CASE WHEN gf.buyer_user_id = auth.uid() THEN 'given' ELSE 'received' END
    ) AS g, gf.created_at
    FROM gifts gf
    WHERE gf.buyer_user_id = auth.uid()
       OR gf.redeemed_user_id = auth.uid()
       OR lower(gf.recipient_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
  ) g;
$function$;
GRANT EXECUTE ON FUNCTION public.my_gifts() TO authenticated;
