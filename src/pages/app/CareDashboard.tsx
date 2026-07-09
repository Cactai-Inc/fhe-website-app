import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, FileText, MessageCircle, CalendarDays } from 'lucide-react';
import { myEngagementsBySegment, type MemberEngagement } from '../../lib/ops/api-member';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * CARE DASHBOARD (Slice 4, /app/care) — the purpose-built view for a horse-CARE
 * client (training / exercise / turnout / clipping of THEIR horse — the 'horse'
 * segment). NO feed, NO community: a care client tracks service on their animal.
 * Read-only status of each care engagement + schedule + documents + message us.
 * Surface-gated to 'care_dashboard'.
 */

export default function CareDashboard() {
  useDocumentTitle('Horse Care');
  const [engagements, setEngagements] = useState<MemberEngagement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    myEngagementsBySegment('horse')
      .then((o) => setEngagements(o.engagements))
      .catch(() => setError('Could not load your horse care.'));
  }, []);

  const open = engagements?.filter((e) => e.status_row?.is_terminal !== true) ?? [];

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Your horse's care</p>
      <h1 className="heading-section text-green-800 mb-2">Care for your horse.</h1>
      <p className="body-text text-sm text-muted mb-8">
        Training, exercise, turnout, and clipping we're providing — with the schedule and
        your paperwork in one place.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {engagements === null && !error && <p className="body-text text-muted text-sm">Loading…</p>}

      {engagements && engagements.length === 0 && (
        <div className="bg-white border border-green-800/10 p-8 text-center rounded-lg">
          <p className="body-text text-sm mb-6">No care service in progress yet.</p>
          <Link to="/horse" className="btn-outline-gold">
            Book horse care <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {engagements && engagements.length > 0 && (
        <>
          <div className="bg-white border border-green-800/10 rounded-lg p-5 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={20} className="text-gold-ink" />
              <p className="text-sm font-sans font-medium text-green-900">Active care</p>
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
                <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
                  e.status_row?.is_terminal ? 'bg-green-800/10 text-green-800' : 'bg-gold-50 text-gold-ink'
                }`}>
                  {e.status_row?.display_name ?? e.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <Link to="/app/schedule" className="bg-white border border-green-800/10 rounded-lg p-5 flex items-center gap-3 hover:border-green-800/30">
          <CalendarDays size={18} className="text-green-800" />
          <span className="text-sm font-sans font-medium text-green-900">Schedule</span>
        </Link>
        <Link to="/app/documents" className="bg-white border border-green-800/10 rounded-lg p-5 flex items-center gap-3 hover:border-green-800/30">
          <FileText size={18} className="text-green-800" />
          <span className="text-sm font-sans font-medium text-green-900">Documents</span>
        </Link>
        <Link to="/app/messages" className="bg-white border border-green-800/10 rounded-lg p-5 flex items-center gap-3 hover:border-green-800/30">
          <MessageCircle size={18} className="text-green-800" />
          <span className="text-sm font-sans font-medium text-green-900">Message us</span>
        </Link>
      </div>
    </div>
  );
}
