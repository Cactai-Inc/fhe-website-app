import { useDocumentTitle } from '../../lib/hooks';
import { StableSection } from '../../components/app/StableSection';

/**
 * MY STABLE (/app/stable) — TASK-ACCOUNTSURFACE §2. The real route My Stable
 * never had; it used to only exist as an Account-page section reached via
 * /app/account?section=stable. The content itself (horses, gear, supplies)
 * is StableSection, shared unchanged with the Account page's inline panel.
 */
export default function Stable() {
  useDocumentTitle('My Stable');
  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My Stable</p>
      <h1 className="heading-section text-green-800 mb-2">Your horses, gear, and supplies.</h1>
      <p className="body-text text-sm text-muted mb-8">Everything you keep here — manage your horses, gear, and supplies, and add new ones any time.</p>
      <StableSection />
    </div>
  );
}
