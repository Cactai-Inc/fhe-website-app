import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { CalendarPlus, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useViewSurfaces } from '../../lib/surfaces';
import { proposeEvent } from '../../lib/community';

/**
 * HOST AN EVENT (Slice 4, /app/community/host) — a rider proposes a community
 * event. Members can't publish directly (events INSERT is admin-only), so this
 * submits an UNPUBLISHED proposal that staff review and publish. Riding-gated.
 */
export default function HostEvent() {
  useDocumentTitle('Host an event');
  const { surfaces, loading } = useViewSurfaces();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!loading && !surfaces.has_community) return <Navigate to="/app" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !starts) { setError('A title and start time are required.'); return; }
    setBusy(true); setError(null);
    try {
      await proposeEvent({
        title: title.trim(),
        starts_at: new Date(starts).toISOString(),
        ends_at: ends ? new Date(ends).toISOString() : null,
        location: location.trim() || null,
        description: description.trim() || null,
      });
      setDone(true);
    } catch {
      setError('We could not submit your event. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-lg">
        <div className="bg-white border border-green-800/10 rounded-lg p-8 text-center">
          <CheckCircle2 size={40} className="text-green-800 mx-auto mb-3" />
          <h1 className="font-serif text-xl text-green-800 mb-2">Sent for review.</h1>
          <p className="body-text text-sm text-muted mb-6">
            Thanks for organizing. We'll review your event and publish it to the community.
          </p>
          <button type="button" onClick={() => navigate('/app/community')} className="btn-primary">
            Back to community
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <button type="button" onClick={() => navigate('/app/community')} className="inline-flex items-center gap-1 text-sm text-muted mb-4">
        <ArrowLeft size={14} /> Community
      </button>
      <p className="eyebrow mb-2">Host an event</p>
      <h1 className="heading-section text-green-800 mb-6 flex items-center gap-2">
        <CalendarPlus size={22} /> Propose a get-together.
      </h1>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="block">
          <span className="text-sm font-sans text-secondary">Event title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="form-input mt-1" required />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-sans text-secondary">Starts *</span>
            <input type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} className="form-input mt-1" required />
          </label>
          <label className="block">
            <span className="text-sm font-sans text-secondary">Ends</span>
            <input type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} className="form-input mt-1" />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Location</span>
          <input value={location} onChange={(e) => setLocation(e.target.value)} className="form-input mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Details</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="form-input mt-1" />
        </label>
        <button type="submit" disabled={busy} className="btn-primary self-start">
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
    </div>
  );
}
