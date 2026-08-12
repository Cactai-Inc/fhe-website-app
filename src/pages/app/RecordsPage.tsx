import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDocumentTitle } from '../../lib/hooks';
import { ContactDossierModal } from '../../components/app/ContactDossierModal';
import {
  AllRecordsPage, LeadsPage, PartnersPage, VendorsPage,
} from './ops/ContactsPage';
import Admin from './Admin';
import HorseRecordsPage from './ops/HorseRecordsPage';

/**
 * RECORDS (/app/records) — TASK-RECORDS, owner ruling 2026-08-12: "directories
 * are collections of contacts … vendors, partners, clients/customers and
 * leads are specific types of designations applied to contacts" and "the
 * horses in the system are shown as a category alongside the clients."
 *
 * Supersedes the three separate People pages (`/app/admin`, `/app/ops/leads`,
 * `/app/ops/directory`) AND folds in Horses as a fifth, peer tab. This file is
 * a TAB STRIP OVER INDEPENDENT RENDERERS — it does not know how any tab's
 * content is fetched, filtered or laid out. Four of the five happen to share a
 * row shape (they are all `ContactDirectory({ mode })` or the Clients roster);
 * Horses does not, and is not made to pretend it does.
 *
 * Team is not here — "that is a business configuration activity" (owner) — it
 * lives in Settings.
 */

type RecordsTab = 'all' | 'leads' | 'clients' | 'partners' | 'vendors' | 'horses';

const TABS: { id: RecordsTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'leads', label: 'Leads' },
  { id: 'clients', label: 'Clients' },
  { id: 'partners', label: 'Partners' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'horses', label: 'Horses' },
];
const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

/** The tab strip. Visually distinct from Admin.tsx's own nine account-scoped
 *  tabs (Overview/Bookings/…), which only appear one level deeper, after a
 *  Clients row is isolated — larger, solid pills here vs small pills there,
 *  so the two layers never read as one control. */
function RecordsTabStrip({ active }: { active: RecordsTab }) {
  const navigate = useNavigate();
  return (
    <div className="border-b border-green-800/10 bg-cream-100/50">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap gap-1.5 py-3" aria-label="Records">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => navigate(`/app/records/${t.id}`)}
            aria-current={active === t.id ? 'page' : undefined}
            className={`px-4 py-2 rounded-full text-sm font-sans font-medium focus-ring transition-colors ${
              active === t.id
                ? 'bg-green-800 text-white'
                : 'text-green-800 hover:bg-green-800/10'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function RecordsPage() {
  useDocumentTitle('Records');
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const tab: RecordsTab = (tabParam && TAB_IDS.has(tabParam) ? tabParam : 'all') as RecordsTab;

  /** A horse's owner/lessee opens their full record in place — "a horse links
   *  to its people … without leaving the page." Lives here, one level above
   *  every tab, because the contact opened this way is not necessarily filed
   *  on whichever tab is active. The reverse direction (a person's horses) is
   *  already live and unchanged: ContactDossierModal's own Horse records
   *  section (ClientHorseRecordsCard), reused as-is on every people tab. */
  const [crossContact, setCrossContact] = useState<string | null>(null);

  return (
    <div>
      <RecordsTabStrip active={tab} />

      {tab === 'all' && <AllRecordsPage />}
      {tab === 'leads' && <LeadsPage />}
      {tab === 'clients' && <Admin />}
      {tab === 'partners' && <PartnersPage />}
      {tab === 'vendors' && <VendorsPage />}
      {tab === 'horses' && <HorseRecordsPage onOpenContact={setCrossContact} />}

      {crossContact && (
        <ContactDossierModal contactId={crossContact} onClose={() => setCrossContact(null)} />
      )}
    </div>
  );
}
