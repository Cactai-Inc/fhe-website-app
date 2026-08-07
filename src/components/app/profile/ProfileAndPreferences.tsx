import { ProfileCard } from './ProfileCard';
import { PreferencesCard } from './PreferencesCard';
import { AccountInfoCard } from './AccountInfoCard';
import { LoginSecurityCard } from './LoginSecurityCard';

/**
 * PROFILE & PREFERENCES — originally one consolidated surface (owner spec
 * 2026-08-05, TASK-PROFILE-account-restructure.md), now three Account-page
 * sections per TASK-ACCOUNTSURFACE §4 (owner spec 2026-08-07): My Profile,
 * My Preferences, My Login. The four cards this built are unchanged — only
 * their grouping into rows changed, from one to three. No inner pages
 * anywhere in this tree.
 */

/** MY PROFILE — splits internally into Community profile (ProfileCard, visible
 *  to other members) and Account profile (AccountInfoCard, staff-only). */
export function MyProfileContent() {
  return (
    <div className="mt-2.5 mb-1">
      <ProfileCard />
      <AccountInfoCard />
    </div>
  );
}

export function MyPreferencesContent() {
  return (
    <div className="mt-2.5 mb-1">
      <PreferencesCard />
    </div>
  );
}

export function MyLoginContent() {
  return (
    <div className="mt-2.5 mb-1">
      <LoginSecurityCard />
    </div>
  );
}
