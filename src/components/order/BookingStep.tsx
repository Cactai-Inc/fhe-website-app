import { useEffect, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { fetchOpenSlots, holdSlot, requestBookingTime, getOrderBooking } from '../../lib/api';
import type { AvailabilitySlot } from '../../lib/types';

const SLOT_TYPE_LABEL: Record<string, string> = {
  consultation: 'Consultation',
  onsite_visit: 'On-site visit',
  lesson: 'Lesson',
  training: 'Training',
  other: 'Session',
};

function formatSlot(s: AvailabilitySlot): string {
  const start = new Date(s.start_at);
  return start.toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

/** Lets a member pick a suggested slot OR request any custom time for their order.
 *  Suggested slots are held atomically; a custom time is recorded for staff to
 *  confirm. There is never a dead-end — a time can always be requested. */
export default function BookingStep({ orderId, onHeld }: { orderId: string; onHeld?: () => void }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [heldSlotId, setHeldSlotId] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customTime, setCustomTime] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([fetchOpenSlots(), getOrderBooking(orderId)])
      .then(([open, booking]) => {
        if (!active) return;
        setSlots(open);
        if (booking?.slot_id) setHeldSlotId(booking.slot_id);
        else if (booking) setRequested(true);
      })
      .catch(() => active && setError('Could not load availability.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [orderId]);

  async function pick(slotId: string) {
    setWorking(slotId);
    setError(null);
    try {
      await holdSlot(orderId, slotId);
      setHeldSlotId(slotId);
      setRequested(false);
      setSlots(await fetchOpenSlots());
      onHeld?.();
    } catch {
      setError('That time was just taken. Please choose another.');
      setSlots(await fetchOpenSlots());
    } finally {
      setWorking(null);
    }
  }

  async function requestCustom() {
    if (!customTime) return;
    setWorking('custom');
    setError(null);
    try {
      await requestBookingTime(orderId, new Date(customTime).toISOString());
      setRequested(true);
      setHeldSlotId(null);
      onHeld?.();
    } catch {
      setError('Could not submit that request. Please try again.');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="bg-white border border-green-800/10 p-8 mb-8">
      <div className="flex items-start gap-3 mb-5">
        <CalendarDays size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h2 className="font-serif font-medium text-green-800 text-xl">Choose a time</h2>
          <p className="text-xs font-sans text-muted mt-1">
            Pick a suggested time or request your own. We'll hold it while you finish — nothing is
            final until your payment is confirmed.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="body-text text-muted text-sm">Loading availability…</p>
      ) : (
        <>
          {(heldSlotId || slots.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {heldSlotId && !slots.some((s) => s.id === heldSlotId) && (
                <div className="selectable-card selectable-card-selected">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-sans font-medium text-green-900">Your held time</span>
                    <Check size={15} className="text-green-800" aria-hidden="true" />
                  </div>
                  <p className="text-xs text-muted mt-1">Held for this order</p>
                </div>
              )}
              {slots.map((s) => {
                const selected = heldSlotId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s.id)}
                    disabled={working === s.id}
                    aria-pressed={selected}
                    className={`selectable-card ${selected ? 'selectable-card-selected' : 'selectable-card-unselected'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-sans font-medium text-green-900">{formatSlot(s)}</span>
                      {selected && <Check size={15} className="text-green-800" aria-hidden="true" />}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      {SLOT_TYPE_LABEL[s.slot_type] ?? 'Session'}
                      {s.location_mode === 'mobile' ? ' · we come to you' : ' · at the ranch'}
                      {working === s.id ? ' · holding…' : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* The always-available custom request — no dead-end when nothing is listed */}
          <div className={slots.length > 0 || heldSlotId ? 'mt-6 pt-6 border-t border-green-800/10' : ''}>
            {requested ? (
              <div className="flex items-center gap-2 text-sm text-green-900">
                <Check size={15} className="text-green-800" aria-hidden="true" />
                <span>Time requested — we'll confirm it with you shortly.</span>
              </div>
            ) : (
              <>
                <p className="text-sm font-sans font-medium text-green-900 mb-1">
                  {slots.length > 0 ? 'Or request a different time' : 'Request a time that works for you'}
                </p>
                <p className="text-xs text-muted mb-3">
                  {slots.length > 0
                    ? "Prefer another time? Tell us and we'll confirm it."
                    : "No preset times are listed — pick any time that works and we'll confirm it with you."}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="datetime-local"
                    value={customTime}
                    onChange={(e) => setCustomTime(e.target.value)}
                    className="form-input text-sm"
                    aria-label="Requested date and time"
                  />
                  <button
                    type="button"
                    onClick={requestCustom}
                    disabled={!customTime || working === 'custom'}
                    className="btn-primary text-sm"
                  >
                    {working === 'custom' ? 'Requesting…' : 'Request this time'}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {error && <p className="form-error mt-3" role="alert">{error}</p>}
    </div>
  );
}
