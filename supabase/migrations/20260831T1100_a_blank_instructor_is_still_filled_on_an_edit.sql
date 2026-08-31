-- TASK-FIX2 §1, follow-up to 20260831T0900 — CORRECTED BY THE PRODUCTION DATA.
--
-- ⚠️ WHAT THE TWO admin@ ROWS ACTUALLY ARE. The task brief states *"45 of 47
-- stamps are hello@ and 2 are admin@ — the 2 are the damage, and they are the
-- proof."* Measured, they are not proof, and the distinction changes the fix:
--
--     f7881be9…  Audrey Slater, 2026-08-24 14:00, scheduled
--     1807d041…  Kit Garcin,    2026-08-25 14:00, cancelled
--
--   Both were created `2026-08-03 21:52:21.826408-07` — inside the publish cron's
--   batch, as `status='available'`, `client_id` NULL, `instructor_user_id` NULL,
--   `created_by` NULL. Both were UPDATED three weeks later, when staff opened a
--   generated slot and turned it into a real lesson for a named client.
--
--   So `v_instr := auth.uid()` fired on an edit of a row whose stamp was ALREADY
--   NULL. It filled a blank; it did not move Claire's name onto CJ's login. The
--   overwrite mechanism is real and was reproduced against these live bodies
--   (hello@ → admin@ on `82797a1f…`, inside BEGIN/ROLLBACK), but production holds
--   no proven instance of it. AR1 U1 said exactly this and was right to hedge:
--   *"consistent with this path having already fired, though it is not proof."*
--
-- ⚠️ AND THAT MEANS 20260831T0900 WENT ONE STEP TOO FAR. It moved the whole
-- default to CREATE, so an edit never stamps anything. But turning a published
-- open slot into a real lesson IS an edit — it is how 12 of the 45 hello@ rows
-- and both admin@ rows came to exist — and under that migration alone those
-- lessons would now land with NO instructor at all. Fixing a silent overwrite by
-- silently dropping the field is not a fix.
--
-- THE RULE, restated precisely, and it is still the owner's ruling
-- (*"preserve what is stored"* — a stored NULL is not a stored stamp):
--
--     instructor_user_id = coalesce( explicitly named,   -- a future picker wins
--                                    what is stored,     -- NEVER moved. the fix.
--                                    the acting staff member )  -- only if blank,
--                                                               -- and only on a
--                                                               -- client-bound
--                                                               -- lesson/care item
--
-- An existing stamp can no longer be changed by an edit that says nothing, which
-- is the whole defect. A blank one is still filled by the person doing the work,
-- which is the whole point of the field.

CREATE OR REPLACE FUNCTION public.save_calendar_item(p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org     uuid := current_org();
  v_id      uuid := nullif(p->>'id','')::uuid;
  v_kind    text := coalesce(p->>'kind','block');
  v_status  text := coalesce(p->>'status','draft');
  v_start   timestamptz := (p->>'starts_at')::timestamptz;
  v_end     timestamptz := (p->>'ends_at')::timestamptz;
  v_horse   uuid := nullif(p->>'horse_id','')::uuid;
  v_offer   uuid := nullif(p->>'offering_id','')::uuid;
  v_price   numeric := nullif(p->>'price_amount','')::numeric;
  v_weeks   int := coalesce(nullif(p->>'recurrence_weeks','')::int, 1);
  v_scope   text := coalesce(p->>'scope','one');
  v_client  uuid := nullif(p->>'client_id','')::uuid;
  v_pur     uuid := nullif(p->>'purchase_id','')::uuid;
  -- ⚠️ FIX2 §1: the EXPLICITLY NAMED instructor and nothing else.
  v_instr   uuid := nullif(p->>'instructor_user_id','')::uuid;
  -- ⚠️ FIX2 §1: the fallback, applied only where the field is blank.
  v_fallback uuid;
  -- ⚠️ FIX2 §1: NULL means the payload said nothing about all_day, which on an
  -- edit means UNCHANGED. Only CREATE falls back to false.
  v_all_day boolean := (p->>'all_day')::boolean;
  v_flex    boolean := coalesce((p->>'is_flexible')::boolean, false);
  v_pay_method text := nullif(btrim(coalesce(p->>'payment_method','')), '');
  v_mark_paid  boolean := (p->>'payment_state') = 'paid';
  v_credit  uuid;
  v_acct_c  uuid;
  v_acct_u  uuid;
  v_series  uuid;
  v_row     bookings%ROWTYPE;
  v_delta   interval;
  v_dur     interval;
  i         int;
  v_s       timestamptz;
  v_e       timestamptz;
  v_new_id  uuid;
  -- SLOTREACH §5
  v_tell    boolean := false;
  v_label   text;
  v_to      uuid;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_start IS NULL OR v_end IS NULL OR v_end <= v_start THEN
    RAISE EXCEPTION 'a calendar item needs a start and a later end';
  END IF;
  IF v_price IS NULL AND v_offer IS NOT NULL THEN
    SELECT price_amount INTO v_price FROM offerings WHERE id = v_offer;
  END IF;

  -- BOOKWRITE: everything the item already knows, resolved once.
  IF v_client IS NOT NULL THEN
    SELECT cl.contact_id INTO v_acct_c FROM clients cl
     WHERE cl.id = v_client AND cl.deleted_at IS NULL;
    IF v_acct_c IS NOT NULL THEN
      SELECT pr.user_id INTO v_acct_u FROM profiles pr WHERE pr.contact_id = v_acct_c;
    END IF;
    -- BOOKLINK B2: the paying item, only on a real (non-draft) commit where
    -- nothing was already resolved for it.
    IF v_pur IS NULL AND NOT v_flex AND v_kind IN ('lesson','care') AND v_status <> 'draft' THEN
      IF v_offer IS NOT NULL THEN
        SELECT d.purchase_id, d.credit_id INTO v_pur, v_credit
          FROM _debit_or_create_for_booking(v_client, v_offer, NULL, v_pay_method, v_mark_paid) d;
      ELSE
        v_pur := _unambiguous_purchase_for_client(v_client);
      END IF;
    END IF;
    -- ⚠️ FIX2 §1: who delivers it, WHEN NOBODY IS RECORDED YET. Same rule this
    -- function has always had, and the same guard (a client-bound lesson or care
    -- item); what changed is that it can no longer reach a row that already
    -- names someone. See the UPDATE and the INSERT below.
    IF v_kind IN ('lesson','care') THEN
      v_fallback := auth.uid();
    END IF;
  END IF;

  -- SLOTREACH §5 — does a change to this item reach the client at all? Same rule
  -- `booking_notifies_client` has always applied (rider always; horse care only when
  -- it happens somewhere they need to be), evaluated against the item AS SAVED rather
  -- than as it was, because that is what they will find on their calendar.
  v_tell := v_status <> 'draft' AND (
       v_kind = 'lesson'
    OR (v_kind = 'care' AND (
          nullif(btrim(coalesce(p->>'address','')), '') IS NOT NULL
       OR EXISTS (SELECT 1 FROM locations l
                   WHERE l.id = nullif(p->>'location_id','')::uuid AND l.is_offsite))));
  v_label := booking_service_label(v_kind, v_offer);

  -- ── EDIT ──────────────────────────────────────────────────────────────────
  IF v_id IS NOT NULL THEN
    SELECT * INTO v_row FROM bookings WHERE id = v_id AND org_id = v_org;
    IF NOT FOUND THEN RAISE EXCEPTION 'item not found in this org'; END IF;

    v_delta := v_start - v_row.starts_at;
    v_dur   := v_end - v_start;

    -- which rows the edit touches (series scope)
    FOR v_row IN
      SELECT * FROM bookings
      WHERE org_id = v_org
        AND (CASE
          WHEN v_scope = 'one' OR v_row.series_id IS NULL THEN id = v_id
          WHEN v_scope = 'future' THEN series_id = v_row.series_id AND starts_at >= v_row.starts_at
          ELSE series_id = v_row.series_id  -- 'all'
        END)
    LOOP
      v_s := v_row.starts_at + v_delta;
      v_e := v_s + v_dur;
      IF v_horse IS NOT NULL AND horse_time_conflict(v_org, v_horse, v_s, v_e, v_row.id, v_row.series_id) THEN
        RAISE EXCEPTION 'that horse is already booked in an overlapping time';
      END IF;
      UPDATE bookings SET
        kind = v_kind, status = v_status, starts_at = v_s, ends_at = v_e,
        is_flexible = coalesce((p->>'is_flexible')::boolean, is_flexible),
        client_id = v_client,
        account_contact_id = v_acct_c,
        account_user_id = v_acct_u,
        -- ⚠️ FIX2 §1 — THE FIX, IN ONE LINE. `instructor_user_id` sits SECOND:
        -- a stamp that exists is never moved by an edit that does not name a
        -- replacement, which is the defect. A blank one is still filled by the
        -- person doing the work, which is how a published open slot becomes a
        -- real lesson with someone's name on it.
        instructor_user_id = coalesce(v_instr, instructor_user_id, v_fallback),
        horse_id = v_horse,
        purchase_id = v_pur,
        credit_id = coalesce(v_credit, credit_id),
        offering_id = v_offer,
        location_id = nullif(p->>'location_id','')::uuid,
        address = nullif(p->>'address',''),
        travel_before_minutes = coalesce((p->>'travel_before_minutes')::int, 0),
        travel_after_minutes = coalesce((p->>'travel_after_minutes')::int, 0),
        price_amount = v_price,
        -- ⚠️ FIX2 §1: same rule. `close_day` is the only writer of `all_day = true`
        -- and the panel never sends the key; an edit must not silently un-close a day.
        all_day = coalesce(v_all_day, all_day),
        notes = nullif(p->>'notes',''),
        updated_at = now()
      WHERE id = v_row.id;

      -- SLOTREACH §5 — WALK2 G-3. This is the branch that moved a client's lesson
      -- and told nobody. The account the item now belongs to is the one told; a
      -- staff member acting on their own calendar entry is not notified about
      -- themselves.
      v_to := coalesce(v_acct_u, v_row.account_user_id);
      IF v_tell AND v_to IS NOT NULL AND v_to <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) THEN
        IF v_status = 'cancelled' AND v_row.status <> 'cancelled' THEN
          PERFORM _announce_booking_change(v_org, v_to, 'booking_cancelled',
            'Your ' || v_label || ' on '
              || to_char(v_row.starts_at, 'FMDay FMMon FMDD') || ' at '
              || to_char(v_row.starts_at, 'FMHH12:MI AM') || ' is cancelled');
        ELSIF v_s <> v_row.starts_at THEN
          PERFORM _announce_booking_change(v_org, v_to, 'booking_rescheduled',
            'Your ' || v_label || ' has moved to '
              || to_char(v_s, 'FMDay FMMon FMDD') || ' at '
              || to_char(v_s, 'FMHH12:MI AM')
              || ' (was ' || to_char(v_row.starts_at, 'FMMon FMDD') || ')');
        END IF;
      END IF;
    END LOOP;
    RETURN jsonb_build_object('id', v_id, 'series_id', v_row.series_id);
  END IF;

  -- ── CREATE (single or recurring) ────────────────────────────────────────────
  v_dur := v_end - v_start;
  IF v_weeks > 1 THEN v_series := gen_random_uuid(); END IF;

  FOR i IN 0 .. (greatest(v_weeks,1) - 1) LOOP
    v_s := v_start + make_interval(weeks => i);
    v_e := v_s + v_dur;
    IF v_horse IS NOT NULL AND horse_time_conflict(v_org, v_horse, v_s, v_e, NULL, v_series) THEN
      RAISE EXCEPTION 'that horse is already booked in an overlapping time (week %)', i + 1;
    END IF;
    INSERT INTO bookings (
      org_id, kind, status, starts_at, ends_at, all_day, is_flexible,
      client_id, account_contact_id, account_user_id, instructor_user_id,
      horse_id, purchase_id, credit_id, offering_id, location_id, address,
      travel_before_minutes, travel_after_minutes, price_amount, notes,
      series_id, created_by
    ) VALUES (
      v_org, v_kind, v_status, v_s, v_e,
      coalesce(v_all_day, false),
      v_flex,
      v_client, v_acct_c, v_acct_u, coalesce(v_instr, v_fallback),
      v_horse, v_pur, v_credit, v_offer,
      nullif(p->>'location_id','')::uuid, nullif(p->>'address',''),
      coalesce((p->>'travel_before_minutes')::int, 0),
      coalesce((p->>'travel_after_minutes')::int, 0),
      v_price, nullif(p->>'notes',''), v_series, auth.uid()
    ) RETURNING id INTO v_new_id;
  END LOOP;

  RETURN jsonb_build_object('id', v_new_id, 'series_id', v_series);
END;
$function$;
