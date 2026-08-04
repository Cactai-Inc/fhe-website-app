-- TASK C — /sign self-onboarding rate limiting.
-- sign_start_attempts throttles the public POST /api/sign-start endpoint by
-- requester (sha256(ip + user agent) — NEVER by email, so a submitter can't
-- be locked out by someone else spamming their address). Window is anchored
-- per-hash: the first request in an hour opens a window row; subsequent
-- requests from the same hash within that hour increment it in place; a
-- request more than an hour after the window opened starts a fresh window.
-- 10 requests/window are allowed to actually provision; the 11th+ get the
-- same neutral { ok: true } response but do nothing beyond incrementing.
-- notify_staff fires once per window, at the moment the count reaches 10.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sign_start_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_hash  text NOT NULL,
  window_start    timestamptz NOT NULL DEFAULT now(),
  count           int NOT NULL DEFAULT 1,
  notified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sign_start_attempts_hash_window_idx
  ON public.sign_start_attempts (requester_hash, window_start DESC);

ALTER TABLE public.sign_start_attempts ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role caller (api/sign-start.ts) touches this
-- table; service_role bypasses RLS, everyone else is denied by default.

CREATE OR REPLACE FUNCTION public.sign_start_register_attempt(p_hash text, p_org uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.sign_start_attempts%ROWTYPE;
  v_should_notify boolean := false;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_hash IS NULL OR btrim(p_hash) = '' THEN
    RAISE EXCEPTION 'requester hash is required';
  END IF;

  SELECT * INTO v_row FROM public.sign_start_attempts
   WHERE requester_hash = p_hash AND window_start > now() - interval '1 hour'
   ORDER BY window_start DESC LIMIT 1
   FOR UPDATE;

  IF v_row.id IS NULL THEN
    INSERT INTO public.sign_start_attempts (requester_hash, window_start, count)
    VALUES (p_hash, now(), 1)
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.sign_start_attempts SET count = count + 1
     WHERE id = v_row.id
     RETURNING * INTO v_row;
  END IF;

  IF v_row.count = 10 AND v_row.notified_at IS NULL THEN
    v_should_notify := true;
    UPDATE public.sign_start_attempts SET notified_at = now() WHERE id = v_row.id;
  END IF;

  IF v_should_notify AND p_org IS NOT NULL THEN
    PERFORM notify_staff(p_org, 'sign_start_lockout',
      'The /sign self-onboarding form hit its rate limit (10 submissions/hour) for one visitor',
      '/app/ops/intake');
  END IF;

  RETURN jsonb_build_object('allowed', v_row.count <= 10, 'count', v_row.count);
END;
$function$;

REVOKE ALL ON FUNCTION public.sign_start_register_attempt(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_start_register_attempt(text, uuid) TO service_role;

COMMIT;
