import { useEffect, useState } from 'react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listBillingSchedules, createBillingSchedule, setBillingReminders, nextDue,
  type BillingSchedule, type BillingMode, type BillingCadence,
} from '../../../lib/billing';
import { listLessonClients, type LessonClientOption } from '../../../lib/ops/api-lessons';

/**
 * OPS BILLING (Slice 5, /app/ops/billing) — admin manages Zelle billing schedules.
 * Two modes (mutually exclusive per schedule): request (we send a payment request
 * each period) vs self_recurring (member pays on their own cadence). Anchored to a
 * start date; monthly/weekly; optional two-months-upfront; per-schedule reminder
 * toggle. Reminders (3-days/day-before/day-after) fire from the payment-watch cron.
 * Admin-only.
 */
export default function BillingPage() {
  useDocumentTitle('Billing');
  const [rows, setRows] = useState<BillingSchedule[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // form
  const [clientId, setClientId] = useState('');
  const [mode, setMode] = useState<BillingMode>('request');
  const [cadence, setCadence] = useState<BillingCadence>('monthly');
  const [amount, setAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [twoUp, setTwoUp] = useState(false);
  const [remindersOn, setRemindersOn] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([listBillingSchedules(), listLessonClients()]);
      setRows(s); setClients(c); setError(null);
    } catch {
      setError('Could not load billing schedules.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? id.slice(0, 8);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !amount || !startDate) { setError('Client, amount and start date are required.'); return; }
    setCreating(true); setError(null);
    try {
      await createBillingSchedule({
        client_id: clientId, mode, cadence, amount: Number(amount),
        start_date: startDate, two_months_upfront: twoUp, reminders_on: remindersOn,
      });
      setClientId(''); setAmount(''); setStartDate(''); setTwoUp(false); setRemindersOn(true);
      await load();
    } catch {
      setError('Could not create the schedule.');
    } finally {
      setCreating(false);
    }
  }

  async function toggle(r: BillingSchedule) {
    try {
      await setBillingReminders(r.id, !r.reminders_on);
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, reminders_on: !x.reminders_on } : x)));
    } catch {
      setError('Could not update reminders.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Billing</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Zelle billing schedules — we remind, the member pays. Two modes: we request each period, or they pay on a recurring cadence.
      </p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}

      {/* create */}
      <form onSubmit={create} className="bg-white border border-green-800/10 rounded-lg p-5 mb-8 grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-sans text-secondary">Client</span>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="form-input mt-1" required>
            <option value="">Select…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as BillingMode)} className="form-input mt-1">
            <option value="request">We request each period</option>
            <option value="self_recurring">They pay recurring</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Amount ($)</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="form-input mt-1" required />
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Cadence</span>
          <select value={cadence} onChange={(e) => setCadence(e.target.value as BillingCadence)} className="form-input mt-1">
            <option value="monthly">Monthly</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-sans text-secondary">Start date (anchor)</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input mt-1" required />
        </label>
        <div className="flex flex-col justify-end gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={twoUp} onChange={(e) => setTwoUp(e.target.checked)} /> Two months upfront
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-secondary">
            <input type="checkbox" checked={remindersOn} onChange={(e) => setRemindersOn(e.target.checked)} /> Reminders on
          </label>
        </div>
        <div className="sm:col-span-2">
          <button type="submit" disabled={creating} className="btn-primary">
            {creating ? 'Creating…' : 'Create schedule'}
          </button>
        </div>
      </form>

      {loading && <p className="text-sm text-green-800/70">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-green-800/70">No billing schedules yet.</p>}

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-white border border-green-800/10 rounded-lg p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-sans font-medium text-green-900">
                {clientName(r.client_id)} · ${Number(r.amount).toFixed(2)} {r.cadence}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {r.mode === 'request' ? 'We request each period' : 'They pay recurring'}
                {r.two_months_upfront ? ' · 2 months upfront' : ''}
                {' · next '}{nextDue(r.start_date, r.cadence).toLocaleDateString()}
                {!r.active ? ' · inactive' : ''}
              </p>
            </div>
            <button type="button" onClick={() => toggle(r)}
              className={`text-xs font-sans px-3 py-1.5 rounded-full whitespace-nowrap ${
                r.reminders_on ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800'
              }`}>
              {r.reminders_on ? 'Reminders on' : 'Reminders off'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
