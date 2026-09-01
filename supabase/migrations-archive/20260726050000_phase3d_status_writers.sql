-- Phase 3d — status writers as TRIGGERS.
--
-- Rather than thread log_status_event() through every mutating RPC (record_
-- signature, sign_release, finalize_payment, book_open_slot, redeem_invitation,
-- deliver-documents, …), a status-sync trigger on each entity table captures
-- EVERY transition regardless of which path caused it — no writer can forget to
-- log. Each trigger maps the entity's native columns to a vocab code via the
-- Phase-3c mappers and appends a true-status event only when the mapped code
-- actually changes (idempotent; no duplicate rows on unrelated UPDATEs).
--
-- The trigger updates current_status directly (not via log_status_event) to
-- avoid recursion, then inserts the event row itself.

BEGIN;

-- documents: status/workflow_state → doc_status_code
CREATE OR REPLACE FUNCTION public.trg_status_documents()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text; v_old text;
BEGIN
  v_code := doc_status_code(NEW.status, NEW.workflow_state);
  v_old  := CASE WHEN TG_OP = 'UPDATE' THEN doc_status_code(OLD.status, OLD.workflow_state) END;
  IF TG_OP = 'INSERT' OR v_code IS DISTINCT FROM v_old THEN
    NEW.current_status := v_code;
    INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id)
      VALUES (NEW.org_id, 'document', NEW.id, v_code, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS status_documents ON public.documents;
CREATE TRIGGER status_documents BEFORE INSERT OR UPDATE OF status, workflow_state
  ON public.documents FOR EACH ROW EXECUTE FUNCTION public.trg_status_documents();

-- purchases: status/payment_status → order_status_code
CREATE OR REPLACE FUNCTION public.trg_status_purchases()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text; v_old text;
BEGIN
  v_code := order_status_code(NEW.status, NEW.payment_status);
  v_old  := CASE WHEN TG_OP = 'UPDATE' THEN order_status_code(OLD.status, OLD.payment_status) END;
  IF TG_OP = 'INSERT' OR v_code IS DISTINCT FROM v_old THEN
    NEW.current_status := v_code;
    INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id)
      VALUES (NEW.org_id, 'order', NEW.id, v_code, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS status_purchases ON public.purchases;
CREATE TRIGGER status_purchases BEFORE INSERT OR UPDATE OF status, payment_status
  ON public.purchases FOR EACH ROW EXECUTE FUNCTION public.trg_status_purchases();

-- bookings: status → booking_status_code. Also logs the 'rescheduled' sub-status
-- when a scheduled booking's time moves.
CREATE OR REPLACE FUNCTION public.trg_status_bookings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text; v_old text;
BEGIN
  v_code := booking_status_code(NEW.status);
  v_old  := CASE WHEN TG_OP = 'UPDATE' THEN booking_status_code(OLD.status) END;
  IF TG_OP = 'INSERT' OR v_code IS DISTINCT FROM v_old THEN
    NEW.current_status := v_code;
    INSERT INTO status_events (org_id, entity_type, entity_id, status, actor_user_id)
      VALUES (NEW.org_id, 'offering', NEW.id, v_code, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS status_bookings ON public.bookings;
CREATE TRIGGER status_bookings BEFORE INSERT OR UPDATE OF status
  ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.trg_status_bookings();

-- invitations: status → account_status_code; carries the failure reason as detail.
CREATE OR REPLACE FUNCTION public.trg_status_invitations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_code text; v_old text;
BEGIN
  v_code := account_status_code(NEW.status);
  v_old  := CASE WHEN TG_OP = 'UPDATE' THEN account_status_code(OLD.status) END;
  IF TG_OP = 'INSERT' OR v_code IS DISTINCT FROM v_old THEN
    NEW.current_status := v_code;
    INSERT INTO status_events (org_id, entity_type, entity_id, status, detail, actor_user_id)
      VALUES (NEW.org_id, 'account', NEW.id, v_code, NEW.failure_reason, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS status_invitations ON public.invitations;
CREATE TRIGGER status_invitations BEFORE INSERT OR UPDATE OF status
  ON public.invitations FOR EACH ROW EXECUTE FUNCTION public.trg_status_invitations();

COMMIT;
