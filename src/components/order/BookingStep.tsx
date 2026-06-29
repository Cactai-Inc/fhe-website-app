import { useEffect, useState } from 'react';
import { CalendarDays, Check } from 'lucide-react';
import { fetchOpenSlots, holdSlot, getOrderBooking } from '../../lib/api';
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

/** Lets a member pick a slot for their order. Holds the slot atomically server-side. */
export default function BookingStep({ orderId, onHeld }: { orderId: string; onHeld?: () => void }) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [heldSlotId, setHeldSlotId] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOpenSlots(), getOrderBooking(orderId)])
      .then(([open, booking]) => {
        if (!active) return;
        setSlots(open);
        if (booking?.slot_id) setHeldSlotId(booking.slot_id);
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
      // Refresh open slots (the held one drops out of the open list)
      setSlots(await fetchOpenSlots());
      onHeld?.();
    } catch {
      setError('That time was just taken. Please choose another.');
      setSlots(await fetchOpenSlots());
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
            Pick what works for you. We'll hold it while you finish — it isn't final until your
            payment is confirmed.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="body-text text-muted text-sm">Loading availability…</p>
      ) : slots.length === 0 && !heldSlotId ? (
        <p className="body-text text-sm text-muted">
          No open times are listed right now. We'll reach out to schedule with you directly.
        </p>
      ) : (
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

      {error && <p className="form-error mt-3" role="alert">{error}</p>}
    </div>
  );
}
