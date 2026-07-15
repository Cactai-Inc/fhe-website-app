/*
  # Onboarding UI state on profiles

  - first_dashboard_at: stamped the first time the member opens their dashboard,
    so we show the first-visit placeholder + open the profile modal only once.
  - welcome_removed_at: set when the member REMOVES the welcome card; the header
    then shows an ⓘ that reopens the same guidance in a modal.
  Both are self-writable via the existing profiles_update_own (user_id = auth.uid()).
*/
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_dashboard_at  timestamptz,
  ADD COLUMN IF NOT EXISTS welcome_removed_at  timestamptz;
