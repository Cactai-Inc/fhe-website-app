-- pending_fee_candidates: p.mobile -> c.mobile (profiles has no mobile column;
-- the function errored on every call in production). Full body carried
-- forward from live otherwise unchanged. 2026-08-02 closure.
CREATE OR REPLACE FUNCTION public.pending_fee_candidates()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (coalesce(auth.role(),'') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', cr.id,
        'fee_amount', cr.fee_amount,
        'name', nullif(trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
        'email', coalesce(c.email, p.email),
        'phone', coalesce(c.phone, p.phone, c.mobile))), '[]'::jsonb)
    FROM booking_change_requests cr
    JOIN bookings b ON b.id = cr.booking_id
    LEFT JOIN clients cl ON cl.id = b.client_id
    LEFT JOIN contacts c ON c.id = cl.contact_id
    LEFT JOIN profiles p ON p.user_id = b.account_user_id
    WHERE cr.status = 'pending' AND cr.fee_paid = false AND cr.fee_amount IS NOT NULL);
END;
$function$

;
