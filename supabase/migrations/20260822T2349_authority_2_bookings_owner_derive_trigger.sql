-- TASK-AUTHORITY §4.2 — no new booking may land with NULL account_contact_id
-- while carrying a client_id, and no booking may carry both if they disagree.
-- MUST be BEFORE: an AFTER trigger's NEW assignment is discarded (TASK-AUTHORITY §6 trap).

CREATE OR REPLACE FUNCTION public.bookings_derive_account_contact_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT contact_id INTO v_contact FROM clients WHERE id = NEW.client_id;

  IF NEW.account_contact_id IS NULL THEN
    NEW.account_contact_id := v_contact;
  ELSIF NEW.account_contact_id IS DISTINCT FROM v_contact THEN
    RAISE EXCEPTION 'bookings: account_contact_id (%) disagrees with client_id''s contact (%)',
      NEW.account_contact_id, v_contact;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bookings_derive_account_contact_id ON bookings;
CREATE TRIGGER bookings_derive_account_contact_id
  BEFORE INSERT OR UPDATE OF client_id, account_contact_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION bookings_derive_account_contact_id();

-- THE TEST §8.3 (insert-a-test-booking-inside-BEGIN/ROLLBACK) is run separately,
-- ad hoc, against prod — not embedded here. A mutating INSERT left in a committed
-- migration would fire bookings_assign_code / booking_form_lifecycle /
-- bookings_unit_link / status_bookings side effects that a same-file DELETE
-- cannot safely unwind.
