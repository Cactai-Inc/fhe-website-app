import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  fetchBusinessHours,
  setBusinessHours,
  closeDay,
  fetchRescheduleFee,
  setCalendarSettings,
  type BusinessHour,
} from '../../lib/ops/api-calendar';

/*
 * Staff calendar settings (Phase 6 gap-fix): edit the business-hours frame
 * (per-weekday open/close/closed), close a whole day, and set the reschedule
 * fee. Opened from the gear on the calendar toolbar; staff only.
 */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarSettingsPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [fee, setFee] = useState('0');
  const [closureDate, setClosureDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBusinessHours().then((h) => {
      // ensure all 7 weekdays present
      const byDay = new Map(h.map((r) => [r.weekday, r]));
      setHours(Array.from({ length: 7 }, (_, w) => byDay.get(w) ?? { weekday: w, open: '10:00', close: '18:00', closed: false }));
    }).catch(() => {});
    fetchRescheduleFee().then((f) => setFee(String(f))).catch(() => {});
  }, []);

  function patch(weekday: number, field: keyof BusinessHour, value: string | boolean) {
    setHours((prev) => prev.map((r) => (r.weekday === weekday ? { ...r, [field]: value } : r)));
  }

  async function saveHours() {
    setBusy(true); setError(null); setMsg(null);
    try {
      await setBusinessHours(hours.map((h) => ({ ...h, open: h.open.slice(0, 5), close: h.close.slice(0, 5) })));
      await setCalendarSettings(Number(fee) || 0);
      setMsg('Saved.');
      onSaved();
    } catch (e) { setError(toErrorMessage(e, 'Could not save.')); } finally { setBusy(false); }
  }

  async function doClose() {
    if (!closureDate) return;
    setBusy(true); setError(null); setMsg(null);
    try {
      await closeDay(closureDate);
      setMsg(`Closed ${closureDate}.`);
      setClosureDate('');
      onSaved();
    } catch (e) { setError(toErrorMessage(e, 'Could not close the day.')); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 flex justify-end" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md h-full overflow-y-auto shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-green-900">Calendar settings</h2>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        <p className="form-label mb-2">Business hours</p>
        <div className="flex flex-col gap-1.5 mb-5">
          {hours.map((h) => (
            <div key={h.weekday} className="flex items-center gap-2 text-sm">
              <span className="w-9 text-green-900">{DAYS[h.weekday]}</span>
              <input type="time" className="form-input py-1 flex-1" value={h.open.slice(0, 5)} disabled={h.closed} onChange={(e) => patch(h.weekday, 'open', e.target.value)} />
              <span className="text-muted">–</span>
              <input type="time" className="form-input py-1 flex-1" value={h.close.slice(0, 5)} disabled={h.closed} onChange={(e) => patch(h.weekday, 'close', e.target.value)} />
              <label className="inline-flex items-center gap-1 text-xs text-muted">
                <input type="checkbox" checked={h.closed} onChange={(e) => patch(h.weekday, 'closed', e.target.checked)} /> closed
              </label>
            </div>
          ))}
        </div>

        <label className="text-sm block mb-5">
          <span className="form-label">Reschedule fee (inside 48h)</span>
          <input type="number" step="0.01" className="form-input" value={fee} onChange={(e) => setFee(e.target.value)} />
        </label>

        <button type="button" className="btn-primary w-full justify-center mb-6" disabled={busy} onClick={() => void saveHours()}>
          {busy ? 'Saving…' : 'Save hours & fee'}
        </button>

        <p className="form-label mb-2">Close a whole day</p>
        <div className="flex gap-2 mb-3">
          <input type="date" className="form-input flex-1" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
          <button type="button" className="btn-secondary" disabled={busy || !closureDate} onClick={() => void doClose()}>Close day</button>
        </div>

        {msg && <p className="text-green-800 text-sm">{msg}</p>}
        {error && <p role="alert" className="form-error">{error}</p>}
      </div>
    </div>
  );
}

export default CalendarSettingsPanel;
