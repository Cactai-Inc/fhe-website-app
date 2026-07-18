import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, FileSignature, Plus, CalendarPlus, AlertTriangle } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { useAuth } from '../../contexts/AuthContext';
import { listStableHorses, type StableHorse } from '../../lib/stable';
import { fetchHorseOnboardingState, type HorseOnboardingState } from '../../lib/horses';

/*
 * HORSE-CARE HOME (/app/care) — the home screen for a horse-care-services client.
 * Their horses, the documents their horses need signed (services can't begin
 * until those are), and a way to request a care service. Care is booked from
 * here (not the rigid lesson calendar): a request with the horse(s) and the
 * day/date it's wanted — the time is looser than a lesson.
 */
export default function CareHome() {
  useDocumentTitle('Horse care');
  const { profile } = useAuth();
  const [horses, setHorses] = useState<StableHorse[] | null>(null);
  const [state, setState] = useState<HorseOnboardingState | null>(null);

  useEffect(() => {
    listStableHorses().then(setHorses).catch(() => setHorses([]));
    fetchHorseOnboardingState().then(setState).catch(() => setState(null));
  }, []);

  const first = profile?.first_name || profile?.display_name || null;
  const pendingDocs = state?.pending_horse_docs ?? [];

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <p className="eyebrow">Horse care</p>
        <h1 className="font-serif text-2xl text-green-900 mt-0.5">
          {first ? `Welcome, ${first}` : 'Your horse care'}
        </h1>
      </header>

      {/* documents that gate services */}
      {(pendingDocs.length > 0 || state?.service_blocked) && (
        <section className="bg-gold-50 border border-gold-200 rounded-xl p-5 mb-5">
          <p className="inline-flex items-center gap-2 font-medium text-gold-900 mb-1">
            <AlertTriangle size={17} aria-hidden="true" /> Documents to sign
          </p>
          <p className="text-sm text-gold-900/80 mb-3">
            {state?.service_blocked
              ? 'Your purchased care service can’t begin until these are completed and signed.'
              : 'Please review and sign your horse’s documents.'}
          </p>
          <ul className="flex flex-col gap-2">
            {pendingDocs.map((d) => (
              <li key={d.document_id}>
                <Link to={d.link} className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5 hover:border-green-800/30 focus-ring">
                  <span className="inline-flex items-center gap-2 text-green-900"><FileSignature size={16} className="text-green-700" /> {d.title}</span>
                  <span className="text-xs text-gold-800 font-medium">Review &amp; sign →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* request a care service */}
      <section className="bg-white border border-green-800/10 rounded-xl p-5 mb-5">
        <h2 className="font-serif text-lg text-green-900 mb-1">Request a care service</h2>
        <p className="text-sm text-muted mb-3">
          Tell us what you need and which horse it’s for. Choose the day or date you’d like it done —
          care services aren’t tied to a rigid time the way lessons are.
        </p>
        <Link to="/horse-care" className="btn-primary text-sm justify-center inline-flex">
          <CalendarPlus size={16} /> Request a service
        </Link>
      </section>

      {/* my horses */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-serif text-lg text-green-900">Your horses</h2>
          <Link to="/app/horse-intake" className="text-sm text-green-800 inline-flex items-center gap-1 hover:text-green-700">
            <Plus size={15} /> Add a horse
          </Link>
        </div>
        {horses === null ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : horses.length === 0 ? (
          <div className="bg-white border border-green-800/10 rounded-lg p-5 text-sm text-muted">
            <p className="mb-3">No horses on file yet. Add your horse so we can prepare its documents and care.</p>
            <Link to="/app/horse-intake" className="btn-secondary text-sm justify-center inline-flex"><Plus size={15} /> Add your horse</Link>
          </div>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-2">
            {horses.map((h) => (
              <li key={h.id} className="bg-white border border-green-800/10 rounded-lg px-4 py-3">
                <span className="inline-flex items-center gap-2 text-green-900"><Boxes size={16} className="text-green-700" /> {h.name}</span>
                {h.nickname && h.nickname !== h.name && <span className="block text-xs text-muted mt-0.5">Barn: {h.nickname}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
