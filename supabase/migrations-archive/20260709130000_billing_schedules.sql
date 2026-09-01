-- SLICE 5 — Zelle billing + payment-watch. A billing schedule is the recurring
-- charge for a subscription-style engagement (monthly lessons, etc.). Zelle-only at
-- launch (no auto-charge): the schedule tells us WHEN a payment is due so we can
-- remind. Two modes, mutually exclusive:
--   'request'        — we send the member a payment request each period (we drive)
--   'self_recurring' — the member pays on their own recurring cadence (they drive)
-- Anchored to a start_date; cadence weekly/monthly; optional two-months-upfront for
-- the first charge; a reminder toggle per schedule. Reminders fire 3 days before,
-- the day before, and the day after a due date (payment-watch cron).

DO $$ BEGIN
  CREATE TYPE billing_mode AS ENUM ('request', 'self_recurring');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE billing_cadence AS ENUM ('weekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.billing_schedules (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  engagement_id  uuid REFERENCES engagements(id),
  client_id      uuid NOT NULL REFERENCES clients(id),
  mode           billing_mode NOT NULL,
  cadence        billing_cadence NOT NULL DEFAULT 'monthly',
  amount         numeric NOT NULL CHECK (amount >= 0),
  start_date     date NOT NULL,                 -- the anchor; first due date
  two_months_upfront boolean NOT NULL DEFAULT false,
  reminders_on   boolean NOT NULL DEFAULT true, -- the per-schedule reminder toggle
  active         boolean NOT NULL DEFAULT true,
  last_due_date  date,                          -- most recent due date we've advanced past
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_schedules_org_active_idx
  ON public.billing_schedules (org_id, active);

ALTER TABLE public.billing_schedules ENABLE ROW LEVEL SECURITY;

-- member reads their own schedules (to see what's due + toggle reminders);
-- admins manage all in-org. Trainers are NOT billing operators (admin-only).
DROP POLICY IF EXISTS billing_own_read ON public.billing_schedules;
CREATE POLICY billing_own_read ON public.billing_schedules
  FOR SELECT USING (client_id = current_client_id() OR (org_id = current_org() AND is_admin()));

DROP POLICY IF EXISTS billing_admin_all ON public.billing_schedules;
CREATE POLICY billing_admin_all ON public.billing_schedules
  FOR ALL USING (org_id = current_org() AND is_admin())
  WITH CHECK (org_id = current_org() AND is_admin());

-- ── the next due date on/after a reference date, from the anchor + cadence ──
CREATE OR REPLACE FUNCTION public.billing_next_due(
  p_start date,
  p_cadence billing_cadence,
  p_after date
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_due date := p_start;
  v_step interval := CASE p_cadence WHEN 'weekly' THEN interval '7 days' ELSE interval '1 month' END;
  v_guard int := 0;
BEGIN
  WHILE v_due < p_after AND v_guard < 600 LOOP
    v_due := (v_due + v_step)::date;
    v_guard := v_guard + 1;
  END LOOP;
  RETURN v_due;
END;
$$;

-- ── admin creates a billing schedule. Enforces mode exclusivity implicitly (one
--    row = one mode) and the required anchor/amount. ──
CREATE OR REPLACE FUNCTION public.create_billing_schedule(
  p_client_id     uuid,
  p_mode          text,
  p_amount        numeric,
  p_start_date    date,
  p_cadence       text DEFAULT 'monthly',
  p_engagement_id uuid DEFAULT NULL,
  p_two_months_upfront boolean DEFAULT false,
  p_reminders_on  boolean DEFAULT true
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
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'admin access required';
  END IF;
  IF p_mode NOT IN ('request', 'self_recurring') THEN
    RAISE EXCEPTION 'mode must be request or self_recurring';
  END IF;
  IF p_cadence NOT IN ('weekly', 'monthly') THEN
    RAISE EXCEPTION 'cadence must be weekly or monthly';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'amount required';
  END IF;
  IF p_start_date IS NULL THEN
    RAISE EXCEPTION 'start date (anchor) required';
  END IF;

  INSERT INTO billing_schedules (
    org_id, engagement_id, client_id, mode, cadence, amount, start_date,
    two_months_upfront, reminders_on
  ) VALUES (
    v_org, p_engagement_id, p_client_id, p_mode::billing_mode, p_cadence::billing_cadence,
    p_amount, p_start_date, p_two_months_upfront, p_reminders_on
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ── member (or admin) toggles reminders on their own schedule ──
CREATE OR REPLACE FUNCTION public.set_billing_reminders(
  p_id uuid,
  p_on boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE billing_schedules
     SET reminders_on = p_on, updated_at = now()
   WHERE id = p_id
     AND (client_id = current_client_id() OR (org_id = current_org() AND is_admin()));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'schedule not found';
  END IF;
END;
$$;

-- ── payment-watch: schedules with a due date in the reminder window. Real-time by
--    computation; the cron reads this and sends the branded reminder email. Returns
--    each active, reminders-on schedule whose next due date is 3 days out, 1 day out,
--    or 1 day past — with which window it hit. ──
CREATE OR REPLACE FUNCTION public.billing_due_reminders(p_today date)
RETURNS TABLE (
  schedule_id   uuid,
  org_id        uuid,
  client_id     uuid,
  amount        numeric,
  due_date      date,
  window_kind   text,
  mode          billing_mode
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- For each active, reminders-on schedule compute two dates:
  --   upcoming = the next due date on/after today  (for the before-windows)
  --   yesterday_due = a due date that fell exactly one day ago (for day-after)
  WITH due AS (
    SELECT b.id, b.org_id, b.client_id, b.amount, b.mode,
           billing_next_due(b.start_date, b.cadence, p_today)        AS upcoming,
           billing_next_due(b.start_date, b.cadence, (p_today - 1))  AS on_or_after_yesterday
    FROM billing_schedules b
    WHERE b.active AND b.reminders_on
  )
  -- 3 days before
  SELECT d.id, d.org_id, d.client_id, d.amount, d.upcoming AS due_date,
         'three_days_before'::text AS window_kind, d.mode
  FROM due d WHERE (d.upcoming - p_today) = 3
  UNION ALL
  -- 1 day before
  SELECT d.id, d.org_id, d.client_id, d.amount, d.upcoming,
         'day_before'::text, d.mode
  FROM due d WHERE (d.upcoming - p_today) = 1
  UNION ALL
  -- 1 day after: a due date landed on (today - 1)
  SELECT d.id, d.org_id, d.client_id, d.amount, d.on_or_after_yesterday,
         'day_after'::text, d.mode
  FROM due d WHERE d.on_or_after_yesterday = (p_today - 1)
$$;

GRANT EXECUTE ON FUNCTION public.billing_next_due(date, billing_cadence, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_billing_schedule(uuid, text, numeric, date, text, uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_billing_reminders(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_due_reminders(date) TO authenticated;
