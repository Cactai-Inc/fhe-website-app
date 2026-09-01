import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  fetchAcquisitionIntakeState, submitAcquisitionIntake, fieldsForKind,
  type PendingAcquisitionIntake,
} from '../../lib/acquisition';
import { BackControl } from '../../components/app/BackControl';

/*
 * ACQUISITION INTAKE — the form a Find-a-Horse / Horse-Evaluation purchase
 * unlocks. Buying the service doesn't need any configuration on our end; instead
 * it gives the client this form to provide what WE need to do the job (selection
 * criteria for a finder; owner facts for an evaluation). The submission is stored
 * on the purchased line (purchase_items.config) and clears the dashboard task.
 */
export default function AcquisitionIntakePage() {
  useDocumentTitle('Your intake');
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const preferredItem = params.get('item');
  const [pending, setPending] = useState<PendingAcquisitionIntake[]>([]);
  const [selected, setSelected] = useState<PendingAcquisitionIntake | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetchAcquisitionIntakeState()
      .then((s) => {
        setPending(s.pending);
        setSelected(s.pending.find((p) => p.purchase_item_id === preferredItem) ?? s.pending[0] ?? null);
      })
      .catch(() => setPending([]));
  }, [preferredItem]);

  const fields = useMemo(() => (selected ? fieldsForKind(selected.config_kind) : []), [selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setErr(null);
    try {
      await submitAcquisitionIntake(selected.purchase_item_id, values);
      setDone(true);
    } catch (e2) {
      setErr(toErrorMessage(e2, 'Could not submit your intake.'));
    } finally { setBusy(false); }
  }

  const title = selected?.config_kind === 'intake_finder'
    ? 'Tell us what you’re looking for'
    : 'Tell us about the horse';
  const blurb = selected?.config_kind === 'intake_finder'
    ? 'Share your selection criteria and we’ll take it from here — searching, vetting, and bringing you matches.'
    : 'A few facts about the horse and its owner so we can arrange the in-person assessment.';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* ⚠️ TASK-MODAL2 D5 — an intake form. */}
      <BackControl to="/app" label="Dashboard" className="mb-4" />

      {done ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-sm text-green-900 flex flex-col gap-3">
          <p className="inline-flex items-center gap-2 font-medium">
            <CheckCircle2 size={18} aria-hidden="true" /> Thank you — your intake is in.
          </p>
          <p>We’ll review it and be in touch with next steps.</p>
          <button type="button" className="btn-primary text-sm justify-center w-fit" onClick={() => navigate('/app')}>
            Back to dashboard
          </button>
        </div>
      ) : !selected ? (
        <p className="text-sm text-muted">You have no acquisition intake to complete right now.</p>
      ) : (
        <>
          <h1 className="font-serif text-2xl text-green-900 mb-1">{title}</h1>
          <p className="text-sm text-green-800/70 mb-5">{blurb}</p>

          {pending.length > 1 && (
            <div className="mb-5">
              <span className="form-label">Which purchase is this for?</span>
              <select className="form-input" value={selected.purchase_item_id}
                onChange={(e) => { setSelected(pending.find((p) => p.purchase_item_id === e.target.value) ?? null); setValues({}); }}>
                {pending.map((p) => <option key={p.purchase_item_id} value={p.purchase_item_id}>{p.label}</option>)}
              </select>
            </div>
          )}

          <form onSubmit={submit} className="flex flex-col gap-4">
            {fields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="form-label">{f.label}</span>
                {f.type === 'textarea' ? (
                  <textarea rows={3} className="form-input resize-none" placeholder={f.placeholder}
                    value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                ) : f.type === 'select' ? (
                  <select className="form-input" value={values[f.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type="text" className="form-input" placeholder={f.placeholder}
                    value={values[f.key] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} />
                )}
              </label>
            ))}
            {err && <p role="alert" className="form-error">{err}</p>}
            <button type="submit" className="btn-primary justify-center" disabled={busy}>
              {busy ? 'Submitting…' : 'Submit intake'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
