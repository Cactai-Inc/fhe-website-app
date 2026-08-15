import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchMyGrantKeys } from '../../../lib/grants';
import { manageNavGroups } from '../../../components/app/AppLayout';

/**
 * A dedicated landing page for one nav group (Settings, Modules), rendered as
 * a card per page instead of a sidebar list. Owner, 2026-08-15: "modules and
 * settings... should be their own pages as they already are, just show them
 * as cards that open the page when clicked, and then the contents of those
 * pages should be the cards that represent the pages... shown for settings
 * and modules sections right now."
 *
 * Reuses manageNavGroups() — the exact function AppLayout's own sidebar
 * calls — rather than a second hand-written list of pages, so this can never
 * drift from what the sidebar shows (module gates, adminOnly, instructor
 * grants, all identical).
 */
export function NavGroupCardsPage({
  groupKey, heading, description,
}: { groupKey: 'settings' | 'modules'; heading: string; description?: string }) {
  useDocumentTitle(heading);
  const { isAdmin, isStaff, isSuperAdmin, hasModule } = useAuth();
  const isTrainer = isStaff && !isAdmin;
  const [grantKeys, setGrantKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!isTrainer) return;
    fetchMyGrantKeys().then(setGrantKeys).catch(() => {});
  }, [isTrainer]);

  const group = manageNavGroups(hasModule, isAdmin, isSuperAdmin, grantKeys)
    .find((g) => g.key === groupKey);
  const items = group?.items ?? [];

  return (
    <PageLayout name={heading} description={description}>
      {items.length === 0 ? (
        <p className="body-text text-sm text-muted">Nothing here yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3.5 px-4 py-3.5 bg-white border border-green-800/10 rounded-xl hover:border-green-800/25 focus-ring transition-colors"
            >
              <span className="w-10 h-10 rounded-lg bg-cream-100 grid place-items-center text-green-700 shrink-0">
                <item.icon size={19} />
              </span>
              <span className="text-sm font-medium text-green-900">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default NavGroupCardsPage;
