import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { HorseIntakeForm } from '../../components/app/HorseIntakeForm';
import { attachBookingHorse } from '../../lib/ops/api-calendar';
import { toErrorMessage } from '../../lib/ops/errors';

/*
 * A4 — the client's horse-intake, opened from a staff request. Staff send a
 * "Tell us about your horse" notification whose link carries the booking id;
 * this page renders the standard HorseIntakeForm and, once the horse is created,
 * attaches it to that booking (attach_booking_horse, client-authorized). Without
 * a booking id it's just the add-a-horse form (the horse still lands in the
 * client's stable).
 */
export default function HorseIntakePage() {
  useDocumentTitle('Your horse');
  const [params] = useSearchParams();
  const bookingId = params.get('booking');
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleDone(horseId: string) {
    setErr(null);
    if (bookingId) {
      try {
        await attachBookingHorse(bookingId, horseId);
      } catch (e) {
        // the horse was still saved to their stable — surface, don't lose it
        setErr(toErrorMessage(e, 'Your horse was saved, but we could not attach it to the session. Staff can link it.'));
      }
    }
    setDone(true);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Tell us about your horse</h1>
      <p className="text-sm text-muted mb-6">
        {bookingId
          ? 'Add your horse’s details so we’re ready for your session. It only takes a minute.'
          : 'Add a horse to your stable.'}
      </p>

      {done ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-sm text-green-900 flex flex-col gap-3">
          <p className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 size={18} aria-hidden="true" />
            {bookingId ? 'Thank you — your horse is set for your session.' : 'Your horse has been added.'}
          </p>
          {err && <p className="text-orange-800">{err}</p>}
          <div className="flex gap-3">
            <Link to="/app/calendar" className="btn-primary text-sm justify-center">Back to the calendar</Link>
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
