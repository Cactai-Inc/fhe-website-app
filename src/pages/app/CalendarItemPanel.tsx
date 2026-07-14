import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import { fetchOfferings } from '../../lib/api';
import type { Offering } from '../../lib/types';
import { listLessonClients, listScheduleHorses } from '../../lib/ops/api-lessons';
import type { LessonClientOption, ScheduleHorseOption } from '../../lib/ops/api-lessons';
import {
  fetchLocations,
  fetchClientPurchases,
  saveCalendarItem,
  deleteCalendarItem,
  type CalendarItem,
  type CalendarLocation,
  type ClientPurchaseOption,
} from '../../lib/ops/api-calendar';

/*
 * The staff/admin calendar config panel (Phase 6, Slice 3). Right-side on
 * desktop, full-screen on mobile. Create or edit a calendar item: an
 * unavailable block, a flexible-open block, or a real offering booking assigned
 * to a client/horse/purchase — single or recurring. Submit commits; "Save draft"
 * keeps it as a draft on the calendar; Delete removes it (series-scoped).
 */

type ItemType = 'unavailable' | 'offering';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

export function CalendarItemPanel({
  item,
  defaultStart,
  onClose,
  onSaved,
}: {
  item: CalendarItem | null;
  defaultStart?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!item?.id;
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [horses, setHorses] = useState<ScheduleHorseOption[]>([]);
  const [locations, setLocations] = useState<CalendarLocation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialStart = item?.starts_at ?? defaultStart?.toISOString() ?? new Date().toISOString();
  const initialEnd =
    item?.ends_at ?? new Date(new Date(initialStart).getTime() + 3_600_000).toISOString();

  const [type, setType] = useState<ItemType>(
    item && item.status === 'unavailable' ? 'unavailable' : item ? 'offering' : 'unavailable',
  );
  const [start, setStart] = useState(toLocalInput(initialStart));
  const [end, setEnd] = useState(toLocalInput(initialEnd));
  const [offeringId, setOfferingId] = useState(item?.offering_id ?? '');
  const [clientId, setClientId] = useState(item?.client_id ?? '');
  const [purchaseId, setPurchaseId] = useState(item?.purchase_id ?? '');
  const [purchases, setPurchases] = useState<ClientPurchaseOption[]>([]);
  const [horseId, setHorseId] = useState(item?.horse_id ?? '');
  const [isFlexible, setIsFlexible] = useState(item?.is_flexible ?? false);
  const [locationId, setLocationId] = useState(item?.location_id ?? '');
  const [address, setAddress] = useState(item?.address ?? '');
  const [travelBefore, setTravelBefore] = useState(String(item?.travel_before_minutes ?? 0));
  const [travelAfter, setTravelAfter] = useState(String(item?.travel_after_minutes ?? 0));
  const [price, setPrice] = useState(item?.price_amount != null ? String(item.price_amount) : '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [weeks, setWeeks] = useState('1');
  const [scope, setScope] = useState<'one' | 'future' | 'all'>('one');

  useEffect(() => {
    fetchOfferings()
      .then((all) => setOfferings(all.filter((o) => o.segment === 'rider' || o.segment === 'horse')))
      .catch(() => setOfferings([]));
    listLessonClients().then(setClients).catch(() => setClients([]));
    listScheduleHorses().then(setHorses).catch(() => setHorses([]));
    fetchLocations().then(setLocations).catch(() => setLocations([]));
  }, []);

  // purchases for the chosen client (assign-purchase picker)
  useEffect(() => {
    if (!clientId) { setPurchases([]); return; }
    fetchClientPurchases(clientId).then(setPurchases).catch(() => setPurchases([]));
  }, [clientId]);

  const selectedOffering = offerings.find((o) => o.id === offeringId);
  const selectedLocation = locations.find((l) => l.id === locationId);
  const offsite = selectedLocation?.is_offsite ?? false;

  // price auto-fills from the offering when empty
  useEffect(() => {
    if (type === 'offering' && selectedOffering && price === '') {
      if (selectedOffering.price_amount != null) setPrice(String(selectedOffering.price_amount));
    }
  }, [offeringId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSeries = !!item?.series_id;

  function buildPayload(asDraft: boolean) {
    const kind =
      type === 'unavailable'
        ? 'block'
        : isFlexible
          ? 'block'
          : selectedOffering?.segment === 'horse'
            ? 'care'
            : 'lesson';
    const status = asDraft
      ? 'draft'
      : type === 'unavailable'
        ? 'unavailable'
        : isFlexible
          ? 'available'
          : 'scheduled';
    return {
      id: item?.id ?? null,
      kind: kind as 'block' | 'lesson' | 'care',
      status,
      starts_at: fromLocalInput(start),
      ends_at: fromLocalInput(end),
      is_flexible: type === 'offering' ? isFlexible : false,
      client_id: type === 'offering' ? clientId || null : null,
      purchase_id: type === 'offering' ? purchaseId || null : null,
      horse_id: type === 'offering' ? horseId || null : null,
      offering_id: type === 'offering' ? offeringId || null : null,
      location_id: locationId || null,
      address: offsite ? address || selectedLocation?.address || null : null,
      travel_before_minutes: offsite ? Number(travelBefore) || 0 : 0,
      travel_after_minutes: offsite ? Number(travelAfter) || 0 : 0,
      price_amount: type === 'offering' && price !== '' ? Number(price) : null,
      notes: notes.trim() || null,
      recurrence_weeks: !editing ? Number(weeks) || 1 : 1,
      scope: editing && isSeries ? scope : 'one',
    };
  }

  async function submit(asDraft: boolean) {
    setBusy(true);
    setError(null);
    try {
      await saveCalendarItem(buildPayload(asDraft));
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item?.id) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCalendarItem(item.id, isSeries ? scope : 'one');
      onSaved();
    } catch (e) {
      setError(toErrorMessage(e, 'Could not delete.'));
    } finally {
      setBusy(false);
    }
  }

  const mapsHref = useMemo(
    () =>
      address.trim()
        ? `https://maps.apple.com/?daddr=${encodeURIComponent(address.trim())}`
        : null,
    [address],
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div
        className="bg-cream w-full sm:max-w-md h-full overflow-y-auto shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream z-10">
          <h2 className="font-serif text-lg text-green-900">{editing ? 'Edit' : 'New'} calendar item</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <div className="p-4 flex flex-col gap-4 flex-1">
          {/* type */}
          <div className="inline-flex rounded-full bg-green-800/10 p-0.5 self-start">
            {(['unavailable', 'offering'] as ItemType[]).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={`px-3 py-1 rounded-full text-sm capitalize ${type === t ? 'bg-green-800 text-white' : 'text-green-800'}`}
              >
                {t === 'offering' ? 'Booking' : 'Unavailable'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="form-label">Start</span>
              <input type="datetime-local" className="form-input" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="form-label">End</span>
              <input type="datetime-local" className="form-input" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
          </div>

          {type === 'offering' && (
            <>
              <label className="text-sm">
                <span className="form-label">Offering</span>
                <select className="form-input" value={offeringId} onChange={(e) => setOfferingId(e.target.value)}>
                  <option value="">Select…</option>
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-green-900">
                <input type="checkbox" checked={isFlexible} onChange={(e) => setIsFlexible(e.target.checked)} />
                Flexible — open for clients to book
              </label>
              {!isFlexible && (
                <label className="text-sm">
                  <span className="form-label">Client</span>
                  <select className="form-input" value={clientId} onChange={(e) => { setClientId(e.target.value); setPurchaseId(''); }}>
                    <option value="">Unassigned</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              )}
              {!isFlexible && clientId && purchases.length > 0 && (
                <label className="text-sm">
                  <span className="form-label">Assign to purchase</span>
                  <select className="form-input" value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)}>
                    <option value="">None</option>
                    {purchases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}{p.amount != null ? ` — $${p.amount}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-sm">
                <span className="form-label">Horse</span>
                <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)}>
                  <option value="">No horse</option>
                  {horses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </label>
              <label className="text-sm">
                <span className="form-label">Price</span>
                <input type="number" step="0.01" className="form-input" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Inherited from offering" />
              </label>
            </>
          )}

          <label className="text-sm">
            <span className="form-label">Location</span>
            <select className="form-input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Home property (default)</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}{l.is_offsite ? ' (offsite)' : ''}</option>)}
            </select>
          </label>

          {offsite && (
            <>
              <label className="text-sm">
                <span className="form-label">Address</span>
                <input className="form-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={selectedLocation?.address ?? ''} />
                {mapsHref && (
                  <a href={mapsHref} target="_blank" rel="noreferrer" className="text-xs text-green-800 underline mt-1 inline-block">
                    Open in Apple Maps
                  </a>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm">
                  <span className="form-label">Travel before (min)</span>
                  <input type="number" className="form-input" value={travelBefore} onChange={(e) => setTravelBefore(e.target.value)} />
                </label>
                <label className="text-sm">
                  <span className="form-label">Travel after (min)</span>
                  <input type="number" className="form-input" value={travelAfter} onChange={(e) => setTravelAfter(e.target.value)} />
                </label>
              </div>
            </>
          )}

          {!editing && (
            <label className="text-sm">
              <span className="form-label">Repeat weekly for</span>
              <select className="form-input" value={weeks} onChange={(e) => setWeeks(e.target.value)}>
                {['1', '2', '3', '4', '6', '8', '12'].map((w) => (
                  <option key={w} value={w}>{w === '1' ? 'Just once' : `${w} weeks`}</option>
                ))}
              </select>
            </label>
          )}
          {editing && isSeries && (
            <label className="text-sm">
              <span className="form-label">Apply to</span>
              <select className="form-input" value={scope} onChange={(e) => setScope(e.target.value as 'one' | 'future' | 'all')}>
                <option value="one">This one</option>
                <option value="future">This &amp; future</option>
                <option value="all">All in series</option>
              </select>
            </label>
          )}

          <label className="text-sm">
            <span className="form-label">Notes</span>
            <textarea rows={2} className="form-input resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {error && <p role="alert" className="form-error">{error}</p>}
        </div>

        {/* actions */}
        <div className="p-4 border-t border-green-800/10 flex items-center gap-2 sticky bottom-0 bg-cream">
          <button type="button" className="btn-primary flex-1 justify-center" disabled={busy} onClick={() => void submit(false)}>
            {busy ? 'Saving…' : 'Submit'}
          </button>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void submit(true)}>
            Save draft
          </button>
          {editing && (
            <button type="button" className="text-sm text-red-700 px-3 py-2 hover:bg-red-50 rounded-md" disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CalendarItemPanel;
