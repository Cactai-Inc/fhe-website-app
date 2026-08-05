/*
  C10 — minor downstream rules: no outreach to minors, guardian-addressed delivery.

  Orchestrator discovery (2026-08-04): no is_minor flag exists anywhere; the
  only under-18 computation was an input validator inside sign_release (a form
  DOB, not a contact row). Zero email senders checked minority. Three contacts
  have a DOB implying under 18: one real minor (Gabriella Olenik, no email,
  guardian Brian Olenik linked with email) and two adults whose date_of_birth
  was corrupted to equal their 2026 signup date (Raymond Thicklin, Brian
  Olenik himself — Gabriella's own guardian). A naive DOB rule would have
  misclassified both. Re-verified live against production immediately before
  writing this migration; ids below are current as of that query.

  1. is_minor_contact(uuid): the canonical predicate, callable everywhere.
  2. Data fix: NULL out the two corrupt signup-date DOBs (data corruption, not
     information) — guarded so the migration aborts if it doesn't affect
     exactly the two rows discovered.
  3. Invariant check: after the fix, zero contacts may be both a minor and
     carry a direct email.
  4. Guard trigger: going forward, a minor contact may never carry a direct
     email — converts today's safe-by-accident null email into an invariant.
  5. notify_minor_delivery_skipped(): thin wrapper so the API layer (service
     role) can raise a staff alert when a minor recipient is skipped for lack
     of a guardian email — notify_staff() itself stays internal-only (called
     via PERFORM from other definer functions elsewhere in this codebase;
     never granted to service_role directly).
*/

-- ── 1. Canonical predicate ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_minor_contact(p_contact_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT coalesce(
    (SELECT date_of_birth IS NOT NULL AND date_of_birth + interval '18 years' > current_date
     FROM contacts WHERE id = p_contact_id),
    false
  );
$fn$;

-- This project's default privileges auto-grant EXECUTE on new public-schema
-- functions to anon AND authenticated (confirmed via pg_default_acl — the
-- same exposure already exists on log_mirror_delivery/notify_staff, a
-- pre-existing codebase-wide pattern, not introduced here). is_minor_contact
-- is service-role-only by design (called through the admin client), so
-- authenticated is revoked too, not just anon.
REVOKE ALL ON FUNCTION public.is_minor_contact(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_minor_contact(uuid) TO service_role;

-- ── 2. Data fix: NULL the two corrupt signup-date DOBs ──────────────────────
DO $fix$
DECLARE v_n int;
BEGIN
  UPDATE contacts SET date_of_birth = NULL
  WHERE id IN ('23dc8f83-a46e-4937-b7c5-78acc052e41b', '41c5dae9-fc73-4766-9173-6c27347c722c') -- Raymond Thicklin, Brian Olenik
    AND date_of_birth IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'expected to fix exactly 2 corrupt-DOB rows, fixed % — aborting', v_n;
  END IF;
END $fix$;

-- ── 3. Invariant check before the trigger goes live ─────────────────────────
DO $check$
DECLARE v_bad int;
BEGIN
  SELECT count(*) INTO v_bad FROM contacts
  WHERE date_of_birth IS NOT NULL AND date_of_birth + interval '18 years' > current_date
    AND email IS NOT NULL;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'minor-email invariant violated by % existing row(s) after the data fix', v_bad;
  END IF;
END $check$;

-- ── 4. Guard trigger ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contacts_minor_no_email_guard()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.date_of_birth IS NOT NULL
     AND NEW.date_of_birth + interval '18 years' > current_date
     AND NEW.email IS NOT NULL
  THEN
    RAISE EXCEPTION 'a minor contact carries no direct email; put the address on the guardian record';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS contacts_minor_no_email_guard_trg ON contacts;
CREATE TRIGGER contacts_minor_no_email_guard_trg
BEFORE INSERT OR UPDATE ON contacts
FOR EACH ROW EXECUTE FUNCTION public.contacts_minor_no_email_guard();

-- ── 5. Staff alert wrapper for the send boundary ────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_minor_delivery_skipped(p_org uuid, p_link text, p_names text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF p_names IS NULL OR array_length(p_names, 1) IS NULL THEN RETURN; END IF;
  PERFORM notify_staff(
    p_org, 'minor_no_guardian',
    'Not sent — no guardian email on file: ' || array_to_string(p_names, ', '),
    p_link);
END;
$fn$;

REVOKE ALL ON FUNCTION public.notify_minor_delivery_skipped(uuid, text, text[]) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_minor_delivery_skipped(uuid, text, text[]) TO service_role;
