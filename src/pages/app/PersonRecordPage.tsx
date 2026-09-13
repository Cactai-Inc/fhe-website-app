import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { PersonRecord } from '../../components/app/ContactDossierModal';

/**
 * PERSON RECORD PAGE (/app/records/person/:contactId) — the one client-record
 * surface, as a routed page (owner ruling 2026-09-12). Reached from the Clients
 * and Leads cards, dashboard deep-links and horse cross-links, all of which now
 * navigate here rather than opening an overlay. Back-buttonable and bookmarkable,
 * which the modal never was.
 */
export default function PersonRecordPage() {
  useDocumentTitle('Record');
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();

  if (!contactId) {
    return <p className="max-w-4xl mx-auto p-6 text-sm text-muted">No record selected.</p>;
  }

  return (
    <div className="pb-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-0 mb-3">
        <button type="button" onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:text-green-900 focus-ring rounded">
          <ArrowLeft size={16} /> Back
        </button>
      </div>
      <PersonRecord
        contactId={contactId}
        onGone={() => navigate('/app/records/clients')}
      />
    </div>
  );
}
