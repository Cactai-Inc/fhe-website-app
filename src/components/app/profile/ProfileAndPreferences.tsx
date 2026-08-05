import { ProfileCard } from './ProfileCard';
import { PreferencesCard } from './PreferencesCard';
import { AccountInfoCard } from './AccountInfoCard';
import { LoginSecurityCard } from './LoginSecurityCard';

/**
 * PROFILE & PREFERENCES — the consolidated surface (owner spec 2026-08-05,
 * TASK-PROFILE-account-restructure.md). Replaces the old inline ProfileSection
 * (which blended straight into the community contact fields with no section
 * boundary) and the separate /app/profile "Name, photo & bio" page (which
 * duplicated both the profile-edit fields AND a second sign-in-methods card).
 *
 * One flat stack of four unmistakably-bounded sections, each its own
 * SectionCard: Profile (community-visible) → Preferences → Account information
 * (staff-only) → Login & security. No inner pages anywhere in this tree.
 */
export function ProfileAndPreferences() {
  return (
    <div className="mt-2.5 mb-1">
      <ProfileCard />
      <PreferencesCard />
      <AccountInfoCard />
      <LoginSecurityCard />
    </div>
  );
}
