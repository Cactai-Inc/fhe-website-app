/*
  # FHE CRM — Transactions + surface TXN inputs in generated contracts (migration 22)

  The source contracts were drafted for paper (manual-fill blank lines). The
  platform collects these inputs through the online purchase/reservation flow, so
  the contracts must SURFACE THE ACTUAL ENGAGEMENT INPUTS. transactions is the
  data home for the money/term inputs behind every {{TXN.*}} token.

  This migration:
    - creates the transactions table (one financial record per engagement),
    - adds the {{TXN.LEASE_FEE}} dictionary token (config defaults the amount;
      the transaction records the actual fee for the deal),
    - replaces generate_document so {{TXN.*}} resolve from the engagement's
      transaction row (commission rate/min still config-sourced; balance computed).
*/

-- ============================================================
-- transactions — purchase / sale / lease financial record
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code      text UNIQUE,
  engagement_id     uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  txn_type          text NOT NULL CHECK (txn_type IN ('PURCHASE','SALE','LEASE')),
  amount            numeric(12,2),            -- {{TXN.PURCHASE_PRICE}}
  deposit_amount    numeric(12,2),            -- {{TXN.DEPOSIT_AMOUNT}}
  deposit_terms     text,                     -- {{TXN.DEPOSIT_TERMS}}
  payment_terms     text,                     -- {{TXN.PAYMENT_TERMS}}
  payment_schedule  text,                     -- {{TXN.PAYMENT_SCHEDULE}}
  lease_term        text,                     -- {{TXN.LEASE_TERM}}
  lease_type        text CHECK (lease_type IS NULL OR lease_type IN ('FULL','HALF')),
  lease_fee         numeric(12,2),            -- {{TXN.LEASE_FEE}}
  trial_period      text,                     -- {{TXN.TRIAL_PERIOD}}
  delivery_date     date,                     -- {{TXN.DELIVERY_DATE}}
  delivery_location text,                     -- {{TXN.DELIVERY_LOCATION}}
  retainer_fee      numeric(12,2),            -- {{TXN.RETAINER_FEE}}
  service_fee       numeric(12,2),            -- {{TXN.SERVICE_FEE}}
  status            text NOT NULL DEFAULT 'DRAFT',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE SEQUENCE IF NOT EXISTS transaction_code_seq;
DROP TRIGGER IF EXISTS transactions_set_code ON transactions;
CREATE TRIGGER transactions_set_code BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('TXN-', 'transaction_code_seq');

DROP TRIGGER IF EXISTS transactions_set_updated_at ON transactions;
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS transactions_engagement_idx ON transactions (engagement_id);

-- Audit (reuse migration-13 trigger) — money terms change what contracts say.
DROP TRIGGER IF EXISTS audit_transactions ON transactions;
CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- RLS: admin, or the staff/owner of the engagement (reuse caller_owns_engagement).
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS transactions_read ON transactions;
CREATE POLICY transactions_read ON transactions
  FOR SELECT TO authenticated
  USING (is_admin() OR caller_owns_engagement(engagement_id));

DROP POLICY IF EXISTS transactions_write ON transactions;
CREATE POLICY transactions_write ON transactions
  FOR ALL TO authenticated
  USING (is_admin() OR caller_owns_engagement(engagement_id))
  WITH CHECK (is_admin() OR caller_owns_engagement(engagement_id));

-- transactions are never hard-deleted (soft-delete only), like documents/horses.
REVOKE DELETE ON transactions FROM anon, authenticated;

-- ============================================================
-- {{TXN.LEASE_FEE}} dictionary token (config defaults the rate)
-- ============================================================
INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes) VALUES
  ('TXN','LEASE_FEE','{{TXN.LEASE_FEE}}','field','transactions','lease_fee', false, false, false, 'actual lease fee (defaulted from business_config full/half rate)')
ON CONFLICT DO NOTHING;

-- ============================================================
-- money formatter — "$1,250.00" / '' for NULL
-- ============================================================
CREATE OR REPLACE FUNCTION fmt_money(v numeric)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN v IS NULL THEN '' ELSE '$' || to_char(v, 'FM999,999,990.00') END
$$;

-- ============================================================
-- generate_document — now surfaces transaction inputs
-- ============================================================
CREATE OR REPLACE FUNCTION generate_document(
  p_engagement_id uuid,
  p_template_key  text
)
RETURNS TABLE (document_id uuid, merged_body text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_eng     engagements%ROWTYPE;
  v_horse   horses%ROWTYPE;
  v_cfg     business_config%ROWTYPE;
  v_txn     transactions%ROWTYPE;
  v_has_txn boolean := false;
  v_breed   text := '';
  v_color   text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_rate    numeric;
  r         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  SELECT * INTO v_eng FROM engagements WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown engagement: %', p_engagement_id;
  END IF;

  IF v_eng.primary_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_eng.primary_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  END IF;

  SELECT * INTO v_cfg FROM business_config LIMIT 1;

  -- the engagement's financial record (latest), if any
  SELECT * INTO v_txn FROM transactions
    WHERE engagement_id = p_engagement_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  v_has_txn := FOUND;

  INSERT INTO documents (engagement_id, template_id, title, status)
    VALUES (p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  v_body := v_tmpl.body;
  FOR r IN
    SELECT namespace, field, token FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
    v_val := '';

    IF r.namespace = 'HORSE' THEN
      v_val := CASE r.field
        WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
        WHEN 'BARN_NAME'           THEN v_horse.barn_name
        WHEN 'BREED'               THEN v_breed
        WHEN 'COLOR'               THEN v_color
        WHEN 'SEX'                 THEN v_horse.sex
        WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
        WHEN 'HEIGHT'              THEN v_horse.height
        WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
        WHEN 'MICROCHIP'           THEN v_horse.microchip_id
        WHEN 'CURRENT_LOCATION'    THEN v_horse.current_location
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      v_val := CASE r.field
        WHEN 'ID'           THEN v_eng.display_code
        WHEN 'SERVICE_TYPE' THEN v_eng.service_type
        WHEN 'START_DATE'   THEN to_char(v_eng.start_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'FHE' THEN
      v_val := CASE r.field
        WHEN 'LEGAL_NAME'      THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'  THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE' THEN v_cfg.signatory_title
        WHEN 'ADDRESS'         THEN v_cfg.business_address
        ELSE '' END;

    ELSIF r.namespace = 'TXN' THEN
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_eng.service_type ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_eng.service_type ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSIF v_has_txn THEN
        v_val := CASE r.field
          WHEN 'PURCHASE_PRICE'    THEN fmt_money(v_txn.amount)
          WHEN 'DEPOSIT_AMOUNT'    THEN fmt_money(v_txn.deposit_amount)
          WHEN 'DEPOSIT_TERMS'     THEN v_txn.deposit_terms
          WHEN 'BALANCE_DUE'       THEN CASE WHEN v_txn.amount IS NULL THEN ''
                                        ELSE fmt_money(v_txn.amount - COALESCE(v_txn.deposit_amount, 0)) END
          WHEN 'PAYMENT_TERMS'     THEN v_txn.payment_terms
          WHEN 'PAYMENT_SCHEDULE'  THEN v_txn.payment_schedule
          WHEN 'LEASE_TERM'        THEN v_txn.lease_term
          WHEN 'LEASE_FEE'         THEN fmt_money(v_txn.lease_fee)
          WHEN 'TRIAL_PERIOD'      THEN v_txn.trial_period
          WHEN 'DELIVERY_DATE'     THEN to_char(v_txn.delivery_date, 'FMMonth FMDD, YYYY')
          WHEN 'DELIVERY_LOCATION' THEN v_txn.delivery_location
          WHEN 'RETAINER_FEE'      THEN fmt_money(v_txn.retainer_fee)
          WHEN 'SERVICE_FEE'       THEN fmt_money(v_txn.service_fee)
          ELSE '' END;
      ELSE
        v_val := '';  -- no transaction yet → blank
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL;
      SELECT c.full_name, c.phone, c.email, c.address_composed, ep.title, ep.relationship
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re
        FROM engagement_parties ep
        JOIN contacts c ON c.id = ep.contact_id
        WHERE ep.engagement_id = p_engagement_id AND ep.party_role = r.namespace
        ORDER BY ep.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;
