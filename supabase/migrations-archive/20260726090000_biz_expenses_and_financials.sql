-- Admin business suite — expense model + financial rollup RPCs.
--
-- Everything reads LIVE data: sales/P&L aggregate the real purchases +
-- board_charges; growth reads real contacts/clients/memberships; the KPI tiles
-- pull the same. Expenses are the one greenfield piece (new tables). All rollups
-- are org-scoped + staff-gated and degrade to zeroes on an empty period (the
-- data is sparse today; these must populate correctly as real rows land).

BEGIN;

-- ── Expense categories (standard business/tax buckets, org-scoped, seedable) ──
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT current_org(),
  code        text NOT NULL,
  name        text NOT NULL,
  tax_bucket  text,                 -- e.g. Schedule C line grouping
  sort_order  integer NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, code)
);

-- ── Expenses (the greenfield ledger) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL DEFAULT current_org(),
  category_id   uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  incurred_on   date NOT NULL DEFAULT current_date,
  amount        numeric(12,2) NOT NULL CHECK (amount >= 0),
  vendor        text,
  description   text,
  payment_method text,
  reference     text,               -- receipt/invoice #
  is_tax_deductible boolean NOT NULL DEFAULT true,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS expenses_org_date_idx ON public.expenses (org_id, incurred_on);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses (category_id);

DROP TRIGGER IF EXISTS expenses_set_updated ON public.expenses;
CREATE TRIGGER expenses_set_updated BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS: staff-only, org-scoped (business financials) ──
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS expense_categories_staff ON public.expense_categories;
CREATE POLICY expense_categories_staff ON public.expense_categories FOR ALL TO authenticated
  USING (has_staff_access() AND org_id = current_org())
  WITH CHECK (has_staff_access() AND org_id = current_org());
DROP POLICY IF EXISTS expenses_staff ON public.expenses;
CREATE POLICY expenses_staff ON public.expenses FOR ALL TO authenticated
  USING (has_staff_access() AND org_id = current_org())
  WITH CHECK (has_staff_access() AND org_id = current_org());

-- ── Seed the standard categories for every org (idempotent) ──
INSERT INTO public.expense_categories (org_id, code, name, tax_bucket, sort_order)
SELECT o.id, c.code, c.name, c.tax_bucket, c.sort_order
  FROM public.organizations o
  CROSS JOIN (VALUES
    ('FEED',        'Feed & Hay',              'Supplies',            10),
    ('VET',         'Veterinary & Medical',    'Contract labor',      20),
    ('FARRIER',     'Farrier',                 'Contract labor',      30),
    ('SUPPLIES',    'Barn Supplies & Equipment','Supplies',           40),
    ('FACILITY',    'Facility & Rent',         'Rent/lease',          50),
    ('UTILITIES',   'Utilities',               'Utilities',           60),
    ('INSURANCE',   'Insurance',               'Insurance',           70),
    ('PAYROLL',     'Labor & Contractors',     'Wages',               80),
    ('MARKETING',   'Marketing & Advertising', 'Advertising',         90),
    ('TRANSPORT',   'Transport & Fuel',        'Car & truck',        100),
    ('SOFTWARE',    'Software & Subscriptions','Other',              110),
    ('FEES',        'Bank & Processing Fees',  'Other',              120),
    ('OTHER',       'Other',                   'Other',              130)
  ) AS c(code, name, tax_bucket, sort_order)
ON CONFLICT (org_id, code) DO NOTHING;

-- ── Expense entry helpers (SECURITY DEFINER so create/update/delete are one call) ──
CREATE OR REPLACE FUNCTION public.upsert_expense(p jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_id  uuid := nullif(p->>'id','')::uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_id IS NULL THEN
    INSERT INTO expenses (org_id, category_id, incurred_on, amount, vendor, description,
                          payment_method, reference, is_tax_deductible, created_by)
    VALUES (v_org, nullif(p->>'category_id','')::uuid,
            coalesce((p->>'incurred_on')::date, current_date),
            (p->>'amount')::numeric, nullif(p->>'vendor',''), nullif(p->>'description',''),
            nullif(p->>'payment_method',''), nullif(p->>'reference',''),
            coalesce((p->>'is_tax_deductible')::boolean, true), auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE expenses SET
      category_id = nullif(p->>'category_id','')::uuid,
      incurred_on = coalesce((p->>'incurred_on')::date, incurred_on),
      amount = coalesce((p->>'amount')::numeric, amount),
      vendor = nullif(p->>'vendor',''), description = nullif(p->>'description',''),
      payment_method = nullif(p->>'payment_method',''), reference = nullif(p->>'reference',''),
      is_tax_deductible = coalesce((p->>'is_tax_deductible')::boolean, is_tax_deductible)
    WHERE id = v_id AND org_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'expense not found'; END IF;
  END IF;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_expense(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  UPDATE expenses SET deleted_at = now() WHERE id = p_id AND org_id = current_org();
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_expenses(p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS TABLE(id uuid, incurred_on date, amount numeric, vendor text, description text,
              payment_method text, reference text, is_tax_deductible boolean,
              category_code text, category_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT e.id, e.incurred_on, e.amount, e.vendor, e.description, e.payment_method,
         e.reference, e.is_tax_deductible, c.code, c.name
    FROM expenses e LEFT JOIN expense_categories c ON c.id = e.category_id
   WHERE e.deleted_at IS NULL AND e.org_id = current_org() AND has_staff_access()
     AND (p_from IS NULL OR e.incurred_on >= p_from)
     AND (p_to IS NULL OR e.incurred_on <= p_to)
   ORDER BY e.incurred_on DESC, e.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.expense_categories_list()
RETURNS TABLE(id uuid, code text, name text, tax_bucket text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT id, code, name, tax_bucket FROM expense_categories
   WHERE org_id = current_org() AND active AND has_staff_access() ORDER BY sort_order, name;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- FINANCIAL ROLLUPS (all read LIVE purchases + board_charges + expenses)
-- ─────────────────────────────────────────────────────────────────────────────

-- Sales: gross booked, collected, outstanding + a per-period series, over a range.
-- grain = 'day' | 'week' | 'month'. Revenue = collected (amount_paid); booked =
-- amount. Reads the live purchases ledger only (non-void).
CREATE OR REPLACE FUNCTION public.sales_summary(
  p_from date DEFAULT (current_date - 30), p_to date DEFAULT current_date, p_grain text DEFAULT 'day')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_totals jsonb;
  v_series jsonb;
  v_by_method jsonb;
  v_trunc text := CASE lower(p_grain) WHEN 'month' THEN 'month' WHEN 'week' THEN 'week' ELSE 'day' END;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  SELECT jsonb_build_object(
    'orders', count(*),
    'gross_booked', coalesce(sum(amount),0),
    'collected', coalesce(sum(amount_paid),0),
    'outstanding', coalesce(sum(greatest(amount - coalesce(amount_paid,0),0)),0),
    'paid_orders', count(*) FILTER (WHERE payment_status = 'paid'))
  INTO v_totals
  FROM purchases
  WHERE org_id = v_org AND deleted_at IS NULL AND coalesce(status,'') <> 'void'
    AND created_at::date BETWEEN p_from AND p_to;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.bucket), '[]'::jsonb) INTO v_series FROM (
    SELECT date_trunc(v_trunc, created_at)::date AS bucket,
           count(*) AS orders,
           sum(amount) AS booked,
           sum(amount_paid) AS collected
    FROM purchases
    WHERE org_id = v_org AND deleted_at IS NULL AND coalesce(status,'') <> 'void'
      AND created_at::date BETWEEN p_from AND p_to
    GROUP BY 1) t;

  SELECT coalesce(jsonb_agg(row_to_json(m) ORDER BY m.collected DESC), '[]'::jsonb) INTO v_by_method FROM (
    SELECT coalesce(payment_method,'—') AS method, count(*) AS orders, sum(amount_paid) AS collected
    FROM purchases
    WHERE org_id = v_org AND deleted_at IS NULL AND coalesce(status,'') <> 'void'
      AND created_at::date BETWEEN p_from AND p_to
    GROUP BY 1) m;

  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'grain', v_trunc,
    'totals', v_totals, 'series', v_series, 'by_method', v_by_method);
END;
$function$;

-- P&L: revenue (collected purchases + board_charges) vs expenses over a range,
-- with expense breakdown by category. Net = revenue - expenses.
CREATE OR REPLACE FUNCTION public.profit_and_loss(
  p_from date DEFAULT (date_trunc('month', current_date)::date), p_to date DEFAULT current_date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_purch numeric; v_board numeric; v_exp numeric; v_by_cat jsonb;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  SELECT coalesce(sum(amount_paid),0) INTO v_purch FROM purchases
   WHERE org_id=v_org AND deleted_at IS NULL AND coalesce(status,'')<>'void'
     AND coalesce(paid_at, created_at)::date BETWEEN p_from AND p_to;
  SELECT coalesce(sum(amount),0) INTO v_board FROM board_charges
   WHERE org_id=v_org AND deleted_at IS NULL AND created_at::date BETWEEN p_from AND p_to;
  SELECT coalesce(sum(amount),0) INTO v_exp FROM expenses
   WHERE org_id=v_org AND deleted_at IS NULL AND incurred_on BETWEEN p_from AND p_to;

  SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c.total DESC), '[]'::jsonb) INTO v_by_cat FROM (
    SELECT coalesce(ec.name,'Uncategorized') AS category, coalesce(ec.tax_bucket,'Other') AS tax_bucket,
           sum(e.amount) AS total
    FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE e.org_id=v_org AND e.deleted_at IS NULL AND e.incurred_on BETWEEN p_from AND p_to
    GROUP BY 1,2) c;

  RETURN jsonb_build_object('from', p_from, 'to', p_to,
    'revenue', jsonb_build_object('purchases', v_purch, 'boarding', v_board, 'total', v_purch + v_board),
    'expenses', jsonb_build_object('total', v_exp, 'by_category', v_by_cat),
    'net', (v_purch + v_board) - v_exp);
END;
$function$;

-- Growth: new clients per period, active clients, active recurring (MRR proxy),
-- membership counts — all from live contacts/clients/memberships/purchases.
CREATE OR REPLACE FUNCTION public.growth_summary(
  p_from date DEFAULT (current_date - 180), p_to date DEFAULT current_date, p_grain text DEFAULT 'month')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_trunc text := CASE lower(p_grain) WHEN 'week' THEN 'week' WHEN 'day' THEN 'day' ELSE 'month' END;
  v_new_series jsonb; v_totals jsonb; v_mrr numeric;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.bucket), '[]'::jsonb) INTO v_new_series FROM (
    SELECT date_trunc(v_trunc, created_at)::date AS bucket, count(*) AS new_contacts
    FROM contacts WHERE org_id=v_org AND deleted_at IS NULL
      AND created_at::date BETWEEN p_from AND p_to
    GROUP BY 1) t;

  -- MRR: the MONTHLY value of currently-active recurring subscriptions —
  -- per-item monthly price (recurring items are priced price_unit='month')
  -- times quantity, over PAID recurring purchases whose last payment is
  -- recent enough to still be live (35-day window covers a monthly cadence
  -- with grace). The prior version summed purchases.amount over ALL
  -- recurring purchases ever, unwindowed and unnormalised — a lifetime
  -- total mislabelled "monthly".
  SELECT coalesce(sum(pi.price_amount * coalesce(pi.quantity,1)),0) INTO v_mrr
    FROM purchases p JOIN purchase_items pi ON pi.purchase_id=p.id JOIN offerings o ON o.id=pi.offering_id
   WHERE p.org_id=v_org AND p.deleted_at IS NULL AND p.status='paid'
     AND o.config_kind='recurring'
     AND coalesce(p.paid_at, p.created_at) >= current_date - 35;

  SELECT jsonb_build_object(
    'contacts_total', (SELECT count(*) FROM contacts WHERE org_id=v_org AND deleted_at IS NULL),
    'clients_total', (SELECT count(*) FROM clients WHERE org_id=v_org AND deleted_at IS NULL),
    'new_in_range', (SELECT count(*) FROM contacts WHERE org_id=v_org AND deleted_at IS NULL AND created_at::date BETWEEN p_from AND p_to),
    'active_memberships', (
      -- paying-member proxy, NOT activated accounts: non-staff members only.
      -- The prior count included staff profiles (every activated account).
      SELECT count(*) FROM memberships m JOIN profiles pr ON pr.user_id=m.user_id
       WHERE m.status='active' AND coalesce(pr.role,'USER')='USER'
         AND NOT coalesce(pr.is_admin,false)),
    'active_recurring_orders', (SELECT count(DISTINCT p.id) FROM purchases p JOIN purchase_items pi ON pi.purchase_id=p.id JOIN offerings o ON o.id=pi.offering_id WHERE p.org_id=v_org AND p.deleted_at IS NULL AND coalesce(p.status,'')<>'void' AND o.config_kind='recurring'),
    'mrr', v_mrr)
  INTO v_totals;

  RETURN jsonb_build_object('from', p_from, 'to', p_to, 'grain', v_trunc,
    'totals', v_totals, 'new_series', v_new_series);
END;
$function$;

-- KPI snapshot: the headline financial tiles for the dashboard (MTD + all-time),
-- all live.
CREATE OR REPLACE FUNCTION public.business_kpis()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_mstart date := date_trunc('month', current_date)::date;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
  RETURN jsonb_build_object(
    'mtd_revenue', (SELECT coalesce(sum(amount_paid),0) FROM purchases WHERE org_id=v_org AND deleted_at IS NULL AND coalesce(status,'')<>'void' AND coalesce(paid_at,created_at)::date >= v_mstart),
    'mtd_expenses', (SELECT coalesce(sum(amount),0) FROM expenses WHERE org_id=v_org AND deleted_at IS NULL AND incurred_on >= v_mstart),
    'outstanding', (SELECT coalesce(sum(greatest(amount-coalesce(amount_paid,0),0)),0) FROM purchases WHERE org_id=v_org AND deleted_at IS NULL AND coalesce(status,'')<>'void'),
    'mtd_new_clients', (SELECT count(*) FROM contacts WHERE org_id=v_org AND deleted_at IS NULL AND created_at::date >= v_mstart),
    'active_memberships', (
      -- paying-member proxy, NOT activated accounts: non-staff members only.
      -- The prior count included staff profiles (every activated account).
      SELECT count(*) FROM memberships m JOIN profiles pr ON pr.user_id=m.user_id
       WHERE m.status='active' AND coalesce(pr.role,'USER')='USER'
         AND NOT coalesce(pr.is_admin,false)),
    'open_orders', (SELECT count(*) FROM purchases WHERE org_id=v_org AND deleted_at IS NULL AND status IN ('draft','awaiting_payment'))
  );
END;
$function$;

COMMIT;
