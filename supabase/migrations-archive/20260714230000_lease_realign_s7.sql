/*
  # Lease realign · Slice 7 — one consolidated lease notifier

  The two overlapping lease producers (lease_expiry_nudge 30/7/1 → lessee+owner;
  contract_reminder_sweep's lease branches → admins+lessee) are consolidated into
  ONE producer that notifies EVERY party of the lease + all staff + admin, each
  in-app (dismissable via read; actionable via a link to the lease document).
  Emails go out individually per recipient via the hourly cron (calendar-reminders
  now also carries lease_* kinds).

  A. lease_reminder_sweep() — the single producer (start + expiry, all parties +
     staff/admin, deduped, actionable link to the lease contract).
  B. contract_reminder_sweep() rebuilt WITHOUT its lease branches (keeps the
     locked-but-unsigned nudge).
  C. lease_expiry_nudge() delegates to lease_reminder_sweep (cron unchanged).
*/

-- ── A. the single consolidated lease notifier ────────────────────────────────
CREATE OR REPLACE FUNCTION lease_reminder_sweep()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  d record;
  u uuid;
  v_kind text; v_title text; v_body text; v_link text; v_window interval;
  v_n int := 0;
BEGIN
  -- every executed lease with a start (≤7d) or expiry (≤30d) coming up
  FOR d IN
    SELECT dc.id AS doc_id, dc.org_id,
           coalesce(h.barn_name, h.registered_name, 'the horse') AS hname,
           h.lease_start, h.lease_end
    FROM documents dc
    JOIN contract_templates t ON t.id = dc.template_id
    JOIN horses h ON h.id = dc.horse_id
    WHERE t.template_key = 'HORSE_LEASE' AND dc.status = 'EXECUTED'
      AND dc.deleted_at IS NULL AND h.deleted_at IS NULL
      AND (
        (h.lease_start IS NOT NULL AND h.lease_start BETWEEN current_date AND current_date + 7)
        OR (h.lease_end IS NOT NULL AND h.lease_end BETWEEN current_date AND current_date + 30)
      )
  LOOP
    IF d.lease_start IS NOT NULL AND d.lease_start BETWEEN current_date AND current_date + 7 THEN
      v_kind := 'lease_start'; v_window := interval '3 days';
      v_title := 'Lease start approaching';
      v_body := d.hname || ' — lease starts ' || to_char(d.lease_start, 'FMMonth FMDD') || '.';
    ELSE
      v_kind := 'lease_expiry'; v_window := interval '7 days';
      v_title := 'Lease expiring soon';
      v_body := d.hname || ' — lease ends ' || to_char(d.lease_end, 'FMMonth FMDD, YYYY') || '.';
    END IF;
    v_link := '/app/contracts/' || d.doc_id;

    -- recipients: every party of the lease + all staff/admin in the org
    FOR u IN
      SELECT pr.user_id
        FROM document_parties dp JOIN profiles pr ON pr.contact_id = dp.contact_id
       WHERE dp.document_id = d.doc_id AND pr.user_id IS NOT NULL
      UNION
      SELECT pr2.user_id FROM profiles pr2
       WHERE pr2.org_id = d.org_id
         AND coalesce(pr2.role,'USER') IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')
         AND pr2.user_id IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = u AND n.kind = v_kind AND n.link = v_link
          AND n.created_at > now() - v_window
      ) THEN
        PERFORM notify_user(u, v_kind, v_title, v_body, v_link);
        v_n := v_n + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('notifications_created', v_n);
END;
$fn$;
REVOKE ALL ON FUNCTION lease_reminder_sweep() FROM public, anon;
GRANT EXECUTE ON FUNCTION lease_reminder_sweep() TO service_role, authenticated;

-- ── B. contract_reminder_sweep WITHOUT the lease branches ────────────────────
CREATE OR REPLACE FUNCTION contract_reminder_sweep()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_n integer := 0;
  r record;
  admin_user uuid;
BEGIN
  -- locked but unsigned for 3+ days → nudge org admins to follow up
  FOR r IN
    SELECT d.id, d.org_id, d.title
    FROM documents d
    WHERE d.workflow_state = 'locked' AND d.status <> 'EXECUTED'
      AND d.deleted_at IS NULL
      AND d.updated_at < now() - interval '3 days'
  LOOP
    FOR admin_user IN
      SELECT pr.user_id FROM profiles pr WHERE pr.org_id = r.org_id AND pr.role = 'ADMIN'
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = admin_user AND n.kind = 'contract_followup'
          AND n.link = '/app/contracts/' || r.id
          AND n.created_at > now() - interval '3 days'
      ) THEN
        PERFORM notify_user(admin_user, 'contract_followup',
          'Unsigned contract needs a follow-up',
          coalesce(r.title, 'A contract') || ' has been locked for 3+ days without all signatures.',
          '/app/contracts/' || r.id);
        v_n := v_n + 1;
      END IF;
    END LOOP;
  END LOOP;
  -- lease start/expiry moved to lease_reminder_sweep() (Slice 7).
  RETURN jsonb_build_object('notifications_created', v_n);
END;
$fn$;

-- ── C. lease_expiry_nudge delegates to the consolidated producer ─────────────
DROP FUNCTION IF EXISTS lease_expiry_nudge(integer);
CREATE OR REPLACE FUNCTION lease_expiry_nudge(p_days_ahead integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  RETURN lease_reminder_sweep();
END;
$fn$;
