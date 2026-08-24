-- TASK-PAMELA §A — an account can be REAL before anybody is emailed.
--
-- Owner, 2026-08-23: *"i can create the account but my changes dont get saved
-- until i send her the invite… i want to wait until the contract is created,
-- then i will send her the activation email."* And the framing behind it:
-- *"every account hinges on activation and it shouldnt."*
--
-- ⚠️ THE TWO EVENTS, AND WHAT THE SCHEMA ACTUALLY CALLED THEM.
-- Audited before changing anything: there is NO `activated_at` column, no
-- `activate*` function and no invitation-domain `activ*` column anywhere in this
-- database. The word "activation" lives only in UI copy and the /activate route,
-- and everywhere it appears it means the CLIENT's own first-time claim — which is
-- correct and is renamed nowhere here. What was missing was a name for the OTHER
-- event, the one the owner calls the true activation: staff creating the account.
-- It had no name because it had no separate existence.
--
-- So this adds the state, not a rename: `invitations.status = 'draft'` is an
-- account that has been provisioned and whose claim link has never been
-- delivered. The invitation row is already where the staff decision lives
-- (categories, offering_ids, template_keys are its own columns, and
-- derive_affiliations reads them), so holding it as a draft needs no second
-- store — it stops the row from being minted-and-emailed in one breath.
BEGIN;

ALTER TABLE invitations DROP CONSTRAINT invitations_status_check;
ALTER TABLE invitations ADD CONSTRAINT invitations_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'redeemed'::text,
                             'redeemed_unsuccessful'::text, 'expired'::text, 'revoked'::text,
                             'superseded'::text]));

-- The status timeline needs a word for it, or the BEFORE trigger's
-- status_events insert fails its (entity_type, status) foreign key.
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('account', 'provisioned', 'Account created', true, false, 5)
ON CONFLICT (entity_type, code) DO NOTHING;

-- `account_status_code` fell through to 'invited' for anything unrecognised,
-- which would have told the owner an email had gone out when none had.
CREATE OR REPLACE FUNCTION public.account_status_code(p_status text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN p_status = 'draft' THEN 'provisioned'
    WHEN p_status IN ('redeemed','accepted') THEN 'redeemed'
    WHEN p_status = 'redeemed_unsuccessful' THEN 'redeemed_unsuccessful'
    WHEN p_status = 'revoked' THEN 'revoked'
    WHEN p_status = 'superseded' THEN 'superseded'
    WHEN p_status = 'expired' THEN 'expired'
    ELSE 'invited' END;
$function$;

COMMIT;
