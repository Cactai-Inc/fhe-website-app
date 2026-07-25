-- Offering-attachment spine — retire the legacy single-offering provisioning RPC.
--
-- provision_lesson_invitation is fully superseded by the canonical spine
-- provision_client_invitation (multi-offering, standing categories, docs). Every
-- code caller was migrated first (api/admin-send-invitation.ts and the IntakePage
-- conversion now call provision_client_invitation; grep of src/ + api/ shows zero
-- remaining references). No DB function depends on it (the only match is a comment
-- in notify_user). Dropping it removes the last redundant provisioning path.

DROP FUNCTION IF EXISTS public.provision_lesson_invitation(
  text, text, text, uuid, boolean, text, text, uuid);
