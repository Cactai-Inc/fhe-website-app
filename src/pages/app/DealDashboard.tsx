import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Handshake, FileText, MessageCircle } from 'lucide-react';
import { myEngagementsBySegment, type MemberEngagement } from '../../lib/ops/api-member';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * DEAL DASHBOARD (Slice 4, /app/deal) — the purpose-built view for a DEAL party
 * (horse finder / evaluation / purchase or lease brokering — the 'support' segment).
 * NO feed, NO community: a deal client is here to track a transaction, not to
 * socialize. Read-only status of each search/purchase engagement + the two things
 * they can do: read their documents and message us. Surface-gated to 'deal_dashboard'.
 */

function StatusPill({ e }: { e: MemberEngagement }) {
  const terminal = e.status_row?.is_terminal === true;
  return (
    <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
      terminal ? 'bg-green-800/10 text-green-800' : 'bg-gold-50 text-gold-ink'
    }`}>
      {e.status_row?.display_name ?? e.status}
    </span>
  );
}

export default function DealDashboard() {
  useDocumentTitle('My Deal');
  const [engagements, setEngagements] = useState<MemberEngagement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myEngagementsBySegment('support')
      .then((o) => setEngagements(o.engagements))
      .catch(() => setError('Could not load your deal.'));
  }, []);

  const open = engagements?.filter((e) => e.status_row?.is_terminal !== true) ?? [];

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Your acquisition</p>
      <h1 className="heading-section text-green-800 mb-2">Your horse search &amp; purchase.</h1>
      <p className="body-text text-sm text-muted mb-8">
        We handle the deal; here is where it stands. Reach us any time — we'll keep this current.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {engagements === null && !error && <p className="body-text text-muted text-sm">Loading…</p>}

      {engagements && engagements.length === 0 && (
        <div className="bg-white border border-green-800/10 p-8 text-center rounded-lg">
          <p className="body-text text-sm mb-6">No search or purchase in progress yet.</p>
          <Link to="/acquisition" className="btn-outline-gold">
            Start Acquisition Support <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {engagements && engagements.length > 0 && (
        <>
          <div className="bg-white border border-green-800/10 rounded-lg p-5 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Handshake size={20} className="text-gold-ink" />
              <p className="text-sm font-sans font-medium text-green-900">Active deals</p>
            </div>
            <p className="font-serif text-3xl text-green-800">{open.length}</p>
          </div>

          <div className="flex flex-col gap-3 mb-8">
            {engagements.map((e) => (
              <div key={e.id} className="bg-white border border-green-800/10 rounded-lg p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-sans font-medium text-green-900 truncate">
                    {e.service?.display_name ?? e.service_type}
                    {e.display_code ? ` · ${e.display_code}` : ''}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Started {new Date(e.start_date ?? e.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill e={e} />
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <Link to="/app/documents" className="bg-white border border-green-800/10 rounded-lg p-5 flex items-center gap-3 hover:border-green-800/30">
          <FileText size={18} className="text-green-800" />
          <span className="text-sm font-sans font-medium text-green-900">Your documents</span>
        </Link>
        <Link to="/app/messages" className="bg-white border border-green-800/10 rounded-lg p-5 flex items-center gap-3 hover:border-green-800/30">
          <MessageCircle size={18} className="text-green-800" />
          <span className="text-sm font-sans font-medium text-green-900">Message us</span>
        </Link>
      </div>
    </div>
  );
}
