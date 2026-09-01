/*
  # Slice 3 — seeded welcome feed items (first-run)

  feed_seed_welcome(): idempotently creates the three welcome cards for the caller
  the first time they land on Home (spec Part 5):
    1. welcome + view-preference chooser (their first act; writes the view setting)
    2. orientation card (what's in the app, where)
    3. tailored purchase/booking card (what they bought, dates, per-offering resources)
  Rendered from the user's own state; safe to call on every Home load (guarded by
  a 'welcome' item already existing for the user).
*/

CREATE OR REPLACE FUNCTION feed_seed_welcome()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_org uuid := current_org();
  v_cp  client_purchases%ROWTYPE;
  v_has boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  SELECT EXISTS (SELECT 1 FROM feed_account_items WHERE user_id = v_uid AND kind = 'welcome') INTO v_has;
  IF v_has THEN RETURN; END IF;  -- already seeded

  -- 1. welcome + view chooser
  INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)
    VALUES (v_org, v_uid, 'welcome', 'Welcome to your feed',
      'This is your home — new horses, gear, and moments from the barn land here. Choose how you''d like to see it; you can change it anytime.',
      jsonb_build_object('chooser', true));

  -- 2. orientation
  INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)
    VALUES (v_org, v_uid, 'orientation', 'Getting around',
      'Tap the horse to Ask about it, Share a post with another rider, or start a service. Your library, schedule, and account live in the menu under your avatar.',
      '{}'::jsonb);

  -- 3. tailored purchase card (from the caller's latest client_purchases via their contact)
  SELECT cp.* INTO v_cp
    FROM client_purchases cp
    JOIN engagements e ON e.id = cp.engagement_id
    JOIN clients cl ON cl.id = e.client_id
    JOIN profiles p ON p.contact_id = cl.contact_id
   WHERE p.user_id = v_uid
   ORDER BY cp.created_at DESC LIMIT 1;
  IF FOUND THEN
    INSERT INTO feed_account_items (org_id, user_id, kind, title, body, payload)
      VALUES (v_org, v_uid, 'purchase_card',
        coalesce(v_cp.tier_label, 'Your booking'),
        CASE WHEN v_cp.paid THEN 'You''re all set. Here''s what to know before your first session.'
             ELSE 'Almost there — complete payment to confirm. Here''s what to know before your first session.' END,
        jsonb_build_object('engagement_id', v_cp.engagement_id, 'paid', v_cp.paid,
                           'lessons_included', v_cp.lessons_included));
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION feed_seed_welcome() TO authenticated, service_role;
