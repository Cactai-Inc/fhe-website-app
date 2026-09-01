-- SLICE 5 — support intake. A member submits a support request from their Account;
-- admins triage it from /app/ops/support. Org-scoped; the member reads their own,
-- operators (admins) read/resolve all in-org.
CREATE TABLE IF NOT EXISTS public.support_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  user_id      uuid NOT NULL REFERENCES profiles(user_id),
  subject      text NOT NULL,
  body         text NOT NULL,
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'in_progress', 'resolved')),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES profiles(user_id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_requests_org_status_idx
  ON public.support_requests (org_id, status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- member sees + creates their own; admins see + manage all in-org
DROP POLICY IF EXISTS support_own_read ON public.support_requests;
CREATE POLICY support_own_read ON public.support_requests
  FOR SELECT USING (user_id = auth.uid() OR (org_id = current_org() AND is_admin()));

DROP POLICY IF EXISTS support_own_insert ON public.support_requests;
CREATE POLICY support_own_insert ON public.support_requests
  FOR INSERT WITH CHECK (user_id = auth.uid() AND org_id = current_org());

DROP POLICY IF EXISTS support_admin_update ON public.support_requests;
CREATE POLICY support_admin_update ON public.support_requests
  FOR UPDATE USING (org_id = current_org() AND is_admin())
  WITH CHECK (org_id = current_org() AND is_admin());

-- ── member submits a support request ──
CREATE OR REPLACE FUNCTION public.submit_support_request(
  p_subject text,
  p_body    text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_org uuid := current_org();
  v_id  uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no org context';
  END IF;
  IF p_subject IS NULL OR btrim(p_subject) = '' OR p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'subject and message are required';
  END IF;

  INSERT INTO support_requests (org_id, user_id, subject, body)
  VALUES (v_org, auth.uid(), btrim(p_subject), btrim(p_body))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── admin resolves / progresses a request ──
CREATE OR REPLACE FUNCTION public.set_support_status(
  p_id     uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF p_status NOT IN ('open', 'in_progress', 'resolved') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  UPDATE support_requests
     SET status = p_status,
         resolved_at = CASE WHEN p_status = 'resolved' THEN now() ELSE NULL END,
         resolved_by = CASE WHEN p_status = 'resolved' THEN auth.uid() ELSE NULL END
   WHERE id = p_id
     AND org_id = current_org();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found in this org';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_support_request(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_support_status(uuid, text) TO authenticated;
