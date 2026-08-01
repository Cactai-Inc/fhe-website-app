-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICATION — COMMUNITY CHANNELS STAGE A
-- Run BEFORE and AFTER 20260801010000_community_channels_stage_a.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Columns exist. BEFORE: 0 rows. AFTER: 10 rows.
select column_name from information_schema.columns
 where table_name = 'contacts'
   and column_name in ('mobile_call','mobile_text','whatsapp_call','whatsapp_text',
                       'community_email','hide_mobile_call','hide_mobile_text',
                       'hide_whatsapp_call','hide_whatsapp_text','hide_community_email')
 order by column_name;

-- 2. Mapping preserved everyone's old choices. AFTER: zero rows = no contact
--    whose old model said "reachable" ended up hidden, and none whose old
--    model said "hidden" ended up visible.
select id, email from contacts
 where deleted_at is null and (
       (hide_mobile_call     <> (hide_mobile   or not coalesce(allow_call, true)))
    or (hide_mobile_text     <> (hide_mobile   or not coalesce(allow_sms, true)))
    or (hide_whatsapp_call   <> (hide_whatsapp or not coalesce(allow_whatsapp_call, true)))
    or (hide_whatsapp_text   <> (hide_whatsapp or not coalesce(allow_whatsapp, true)))
    or (hide_community_email <> (hide_email)));

-- 3. Seeding worked: nobody with a company-on-file phone has an empty channel
--    field. AFTER: zero rows.
select id, email, phone, mobile_call, mobile_text, whatsapp_call, whatsapp_text
  from contacts
 where deleted_at is null and phone is not null
   and (mobile_call is null or mobile_text is null
     or whatsapp_call is null or whatsapp_text is null);

-- 4. Everything phone-shaped is normalized. AFTER: zero rows.
select id, mobile_call from contacts
 where deleted_at is null
   and ((mobile_call   is not null and mobile_call   <> format_phone(mobile_call))
     or (mobile_text   is not null and mobile_text   <> format_phone(mobile_text))
     or (whatsapp_call is not null and whatsapp_call <> format_phone(whatsapp_call))
     or (whatsapp_text is not null and whatsapp_text <> format_phone(whatsapp_text)));

-- 5. Trigger order: seed fires before normalise. AFTER: two rows, seed first.
select tgname from pg_trigger
 where tgrelid = 'contacts'::regclass and not tgisinternal
   and tgname in ('contacts_a_seed_community_channels_trg','contacts_normalise_phone_trg')
 order by tgname;

-- 6. Live seeding works end to end: insert a throwaway contact with only a
--    phone, confirm all four channel fields arrive filled AND formatted, then
--    roll back. AFTER: the select shows the same formatted number five ways.
begin;
insert into contacts (org_id, first_name, email, phone)
values ((select org_id from contacts where org_id is not null limit 1),
        'Channel Probe', 'channel-probe@example.invalid', '6195550142');
select phone, mobile_call, mobile_text, whatsapp_call, whatsapp_text, community_email
  from contacts where email = 'channel-probe@example.invalid';
rollback;
-- Expected: phone and all four channel fields read (619) 555-0142, and
-- community_email reads channel-probe@example.invalid.

-- 7. The view exposes the five channels and enforces the five flags.
--    AFTER: columns present…
select column_name from information_schema.columns
 where table_name = 'member_directory'
   and column_name in ('community_email','mobile_call','mobile_text','whatsapp_call','whatsapp_text')
 order by column_name;
--    …and hiding works: pick any real member contact, set one flag, read the
--    view, unset it. (Substitute a contact id; skip on an empty DB.)
-- update contacts set hide_mobile_call = true  where id = '<contact-id>';
-- select mobile_call, mobile_text from member_directory where user_id = '<their-user-id>';
--   Expected: mobile_call null, mobile_text still populated.
-- update contacts set hide_mobile_call = false where id = '<contact-id>';

-- 8. Old-model columns still live and untouched (Stage A guarantees). AFTER:
--    same counts as BEFORE for these columns.
select count(*) filter (where mobile   is not null) as mobile_vals,
       count(*) filter (where whatsapp is not null) as whatsapp_vals,
       count(*) filter (where hide_mobile)   as hidden_mobiles,
       count(*) filter (where hide_whatsapp) as hidden_whatsapps
  from contacts where deleted_at is null;
-- ─────────────────────────────────────────────────────────────────────────────
