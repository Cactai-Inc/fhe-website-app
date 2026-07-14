/*
  # Zelle fee matching — identity candidates

  pending_fee_candidates() returns every open, unpaid reschedule fee together
  with the payer's identity (name / email / phone, from the booking's client
  contact and app profile) so the reconciler can match a Zelle notification by
  memo / sender / email / phone — not amount alone.
*/
CREATE OR REPLACE FUNCTION pending_fee_candidates()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
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
        'phone', coalesce(c.phone, p.phone, p.mobile))), '[]'::jsonb)
    FROM booking_change_requests cr
    JOIN bookings b ON b.id = cr.booking_id
    LEFT JOIN clients cl ON cl.id = b.client_id
    LEFT JOIN contacts c ON c.id = cl.contact_id
    LEFT JOIN profiles p ON p.user_id = b.account_user_id
    WHERE cr.status = 'pending' AND cr.fee_paid = false AND cr.fee_amount IS NOT NULL);
END;
$fn$;
REVOKE ALL ON FUNCTION pending_fee_candidates() FROM public, anon;
GRANT EXECUTE ON FUNCTION pending_fee_candidates() TO service_role, authenticated;
