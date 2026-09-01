-- EMAIL-CHANGE flow storage (Update B backend, HANDOFF-email-change.md).
-- A pending change lives on the member's profile until completed or replaced —
-- no expiry. The CURRENT email keeps working throughout. On completion the
-- promotion is new→current first, then current→old (never login-less).
-- The raw token never touches the DB — only its sha256 hex.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pending_email            text,
  ADD COLUMN IF NOT EXISTS pending_email_mode       text
    CHECK (pending_email_mode IN ('password', 'google')),
  ADD COLUMN IF NOT EXISTS pending_email_token_hash text,
  ADD COLUMN IF NOT EXISTS pending_email_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS old_email                text;
