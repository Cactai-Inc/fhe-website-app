import { useEffect, useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  fetchBusinessHours,
  setBusinessHours,
  closeDay,
  fetchRescheduleFee,
  setCalendarSettings,
  fetchChangeFeeSchedule,
  setChangeFeeSchedule,
  type BusinessHour,
} from '../../lib/ops/api-calendar';

/*
 * Staff calendar settings (Phase 6 gap-fix): edit the business-hours frame
 * (per-weekday open/close/closed), close a whole day, and set the reschedule
 * fee. Opened from the gear on the calendar toolbar; staff only.
 *
 * ONBOARD §7 adds the TIERED CHANGE-FEE SCHEDULE. The owner is supplying the
 * numbers, and D13 is explicit that a configuration feature is not done if
 * changing it needs a developer, a migration, or SQL — so the schedule is
 * entered here. With no rows, the single "reschedule fee" above still applies
 * inside 48 hours, exactly as before, which is why adding the first tier is a
 * change of behaviour the owner makes deliberately rather than one that arrives
 * with a deploy.
 */
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface FeeTierDraft { hours_before: string; fee_amount: string; label: string }

export function CalendarSettingsPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [fee, setFee] = useState('0');
  const [closureDate, setClosureDate] = useState('');
  const [tiers, setTiers] = useState<FeeTierDraft[]>([]);
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
    fetchChangeFeeSchedule()
      .then((rows) => setTiers(rows.map((r) => ({
        hours_before: String(r.hours_before),
        fee_amount: String(r.fee_amount),
        label: r.label ?? '',
      }))))
      .catch(() => {});
  }, []);

  function patchTier(i: number, field: keyof FeeTierDraft, value: string) {
    setTiers((prev) => prev.map((t, n) => (n === i ? { ...t, [field]: value } : t)));
  }

  async function saveTiers() {
    setBusy(true); setError(null); setMsg(null);
    try {
      const rows = tiers
        .filter((t) => t.hours_before.trim() !== '' && t.fee_amount.trim() !== '')
        .map((t) => ({
          hours_before: Number(t.hours_before),
          fee_amount: Number(t.fee_amount),
          label: t.label.trim() || null,
        }));
      if (rows.some((r) => !Number.isFinite(r.hours_before) || r.hours_before <= 0
                        || !Number.isFinite(r.fee_amount) || r.fee_amount < 0)) {
        setError('Each tier needs a positive number of hours and a fee of zero or more.');
        return;
      }
      const n = await setChangeFeeSchedule(rows);
      setMsg(n === 0
        ? 'Schedule cleared — the single reschedule fee above applies inside 48 hours.'
        : `Saved ${n} fee tier${n === 1 ? '' : 's'}.`);
      onSaved();
    } catch (e) { setError(toErrorMessage(e, 'Could not save the fee schedule.')); } finally { setBusy(false); }
  }

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
      <div className="bg-cream w-full sm:max-w-md h-full overflow-y-auto overscroll-contain shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
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

        {/* ONBOARD §7 — the tiered change-fee schedule. Empty by default, so the
            single fee above keeps applying inside 48 hours until the first tier
            is entered here. */}
        <p className="form-label mb-1">Change fee schedule</p>
        <p className="text-xs text-muted mb-2 leading-relaxed">
          One row per band. A change made with fewer than that many hours left costs that
          fee; when bands overlap the tightest one wins, so “48h → $25, 24h → $50” charges
          $50 at twenty hours out. Leave this empty to keep using the single fee above.
        </p>
        <div className="flex flex-col gap-1.5 mb-2">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <input type="number" min="1" className="form-input py-1 w-20" placeholder="hrs"
                aria-label="Hours before the booking"
                value={t.hours_before} onChange={(e) => patchTier(i, 'hours_before', e.target.value)} />
              <span className="text-muted text-xs">hrs →</span>
              <input type="number" step="0.01" min="0" className="form-input py-1 w-24" placeholder="fee"
                aria-label="Fee amount"
                value={t.fee_amount} onChange={(e) => patchTier(i, 'fee_amount', e.target.value)} />
              <input className="form-input py-1 flex-1" placeholder="Label (optional)"
                aria-label="Label shown to the client"
                value={t.label} onChange={(e) => patchTier(i, 'label', e.target.value)} />
              <button type="button" aria-label="Remove this tier" className="p-1 text-muted hover:text-red-700 focus-ring rounded"
                onClick={() => setTiers((prev) => prev.filter((_, n) => n !== i))}>
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {tiers.length === 0 && (
            <p className="text-xs text-muted italic">No tiers — the single fee above applies inside 48 hours.</p>
          )}
        </div>
        <div className="flex gap-2 mb-6">
          <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5"
            onClick={() => setTiers((prev) => [...prev, { hours_before: '', fee_amount: '', label: '' }])}>
            <Plus size={14} /> Add a tier
          </button>
          <button type="button" className="btn-primary flex-1 justify-center" disabled={busy}
            onClick={() => void saveTiers()}>
            {busy ? 'Saving…' : 'Save fee schedule'}
          </button>
        </div>

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
