import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileSignature } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { HorseIntakeForm } from '../../components/app/HorseIntakeForm';
import { attachBookingHorse } from '../../lib/ops/api-calendar';
import { attachHorseToDocument } from '../../lib/contracts';
import { ensureHorseDocuments, type GeneratedHorseDoc } from '../../lib/horses';
import { toErrorMessage } from '../../lib/ops/errors';

/*
 * Horse intake — add a horse and, in the same motion, generate the horse
 * documents it requires (Vet Authorization always; the Horse-Care Release when
 * asked for) for the owner to review + sign. Opened from:
 *   - a staff horse-intake request tied to a booking (?booking=<id> → also
 *     attaches the horse to that booking), or
 *   - the dashboard "complete your horse documents" card, or
 *   - a horse-care purchase that needs a horse (?care=1 → include the care release).
 * The two horse docs are a SEPARATE set from the client-only onboarding paperwork.
 */
export default function HorseIntakePage() {
  useDocumentTitle('Your horse');
  const [params] = useSearchParams();
  const bookingId = params.get('booking');
  const contractId = params.get('contract');
  const wantCare = params.get('care') === '1';
  const [done, setDone] = useState(false);
  const [docs, setDocs] = useState<GeneratedHorseDoc[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function handleDone(horseId: string) {
    setNote(null);
    // attach to the booking, if this came from a staff booking request
    if (bookingId) {
      try { await attachBookingHorse(bookingId, horseId); }
      catch (e) { setNote(toErrorMessage(e, 'Your horse was saved; staff can link it to your session.')); }
    }
    // came from the contract horse-gate → attach the new horse to that contract
    if (contractId) {
      try { await attachHorseToDocument(contractId, horseId); }
      catch (e) { setNote(toErrorMessage(e, 'Your horse was saved; open the contract to attach it.')); }
    }
    // generate the horse's documents for the owner to sign
    try {
      const res = await ensureHorseDocuments(horseId, { includeCare: wantCare ? true : null });
      setDocs(res.generated ?? []);
    } catch (e) {
      setNote(toErrorMessage(e, 'Your horse was saved, but we could not prepare its documents. Staff can generate them.'));
    }
    setDone(true);
  }

  const docLabel = (k: string) =>
    k === 'HORSE_EMERGENCY_VET' ? 'Emergency Vet Authorization'
      : k === 'RELEASE_HORSE_CARE' ? 'Horse-Care Liability Release'
        : 'Horse document';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Tell us about your horse</h1>
      <p className="text-sm text-muted mb-6">
        Add your horse’s details. We’ll prepare the documents it needs for you to review and sign.
      </p>

      {done ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-sm text-green-900 flex flex-col gap-3">
          <p className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 size={18} aria-hidden="true" /> Your horse has been added.
          </p>
          {note && <p className="text-orange-800">{note}</p>}
          {contractId && (
            <Link to={`/app/contracts/${contractId}`} className="btn-primary text-sm justify-center inline-flex">
              <FileSignature size={15} /> Back to your contract
            </Link>
          )}
          {docs.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-green-900/80">These documents are ready for you to review and sign:</p>
              <ul className="flex flex-col gap-2">
                {docs.map((d) => (
                  <li key={d.document_id}>
                    <Link to={`/app/contracts/${d.document_id}`}
                      className="flex items-center justify-between gap-3 bg-white border border-green-800/10 rounded-lg px-4 py-2.5 hover:border-green-800/30 focus-ring">
                      <span className="inline-flex items-center gap-2 text-green-900">
                        <FileSignature size={16} className="text-green-700" /> {docLabel(d.template_key)}
                      </span>
                      <span className="text-xs text-gold-800 font-medium">Review &amp; sign →</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-green-900/80">No new documents were needed.</p>
          )}
          <div className="flex gap-3 pt-1">
            <Link to="/app" className="btn-secondary text-sm justify-center">Back to dashboard</Link>
            <Link to="/app/account" className="btn-secondary text-sm justify-center">My stable</Link>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-green-800/10 rounded-lg p-5">
          <HorseIntakeForm onDone={handleDone} submitLabel="Save my horse" />
        </div>
      )}
    </div>
  );
}
