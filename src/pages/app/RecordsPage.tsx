import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '../../lib/hooks';
import { ContactDossierModal } from '../../components/app/ContactDossierModal';
import {
  AllRecordsPage, LeadsPage, PartnersPage, VendorsPage,
} from './ops/ContactsPage';
import Admin from './Admin';
import HorseRecordsPage from './ops/HorseRecordsPage';
import LessonsHubPage from './ops/hubs/LessonsHubPage';
import DocumentsQueuePage from './ops/DocumentsQueuePage';
import FilesRecordsPage from './ops/FilesRecordsPage';
import DealsPage from './ops/DealsPage';
import ArchivedAccountsPage from './ops/ArchivedAccountsPage';

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

type RecordsTab =
  | 'all' | 'leads' | 'clients' | 'partners' | 'vendors' | 'horses'
  | 'lessons' | 'documents' | 'files' | 'deals' | 'archived';

const TABS: { id: RecordsTab; label: string; adminOnly?: boolean }[] = [
  { id: 'all', label: 'All' },
  { id: 'leads', label: 'Leads' },
  { id: 'clients', label: 'Clients' },
  { id: 'partners', label: 'Partners' },
  { id: 'vendors', label: 'Vendors' },
  { id: 'horses', label: 'Horses' },
  // Owner, 2026-08-15: "lessons... is really a records ledger so it should be
  // added to the records page along with documents, files, and deals" — each
  // is its own ledger of records, not a work queue, so Management (day-to-day
  // queues) is the wrong home. Same components, same data, new tab strip —
  // no second implementation of any of the four.
  { id: 'lessons', label: 'Lessons' },
  { id: 'documents', label: 'Documents' },
  { id: 'files', label: 'Files' },
  { id: 'deals', label: 'Deals' },
  // TASK-ARCHIVE (2026-08-22): the deleted-accounts view is a Records tab and
  // not its own nav row or ops route, because Records IS the people page and
  // archiving happens from a Records row — the way out and the way back are one
  // click apart. Last in the strip, and admin-only: it is the ONE place
  // archived contacts surface (D11/D32).
  { id: 'archived', label: 'Archived', adminOnly: true },
];
const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

/** The tab strip. Visually distinct from Admin.tsx's own nine account-scoped
 *  tabs (Overview/Bookings/…), which only appear one level deeper, after a
 *  Clients row is isolated — larger, solid pills here vs small pills there,
 *  so the two layers never read as one control. */
function RecordsTabStrip({ active }: { active: RecordsTab }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  return (
    <div className="border-b border-green-800/10 bg-cream-100/50">
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap gap-1.5 py-3" aria-label="Records">
        {TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
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
      {tab === 'lessons' && <LessonsHubPage />}
      {tab === 'documents' && <DocumentsQueuePage />}
      {tab === 'files' && <FilesRecordsPage />}
      {tab === 'deals' && <DealsPage />}
      {tab === 'archived' && <ArchivedAccountsPage />}

      {crossContact && (
        <ContactDossierModal contactId={crossContact} onClose={() => setCrossContact(null)} />
      )}
    </div>
  );
}
