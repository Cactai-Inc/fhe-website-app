import { useCallback, useEffect, useState } from 'react';
import { Send, Save, Plus } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { StatusBadge } from '../../../lib/ops';
import { toErrorMessage } from '../../../lib/ops/errors';
import { staffContactDirectory, type DirectoryContact } from '../../../lib/api';
import {
  fetchStaffEvaluationReports, createEvaluationReport, saveEvaluationReport,
  deliverEvaluationReport, type StaffEvaluationReport,
} from '../../../lib/acquisition';

/*
 * EVALUATION REPORTS (staff) — author, save, and deliver horse-evaluation
 * reports. Create a report against a client, write the body, save the draft, and
 * deliver it: delivery stamps the retention window (90 days, or indefinite for a
 * rider/horse-owner client), alerts the client, and emails them a PDF copy.
 */
export default function EvaluationReportsPage() {
  useDocumentTitle('Evaluation reports');
  const [rows, setRows] = useState<StaffEvaluationReport[]>([]);
  const [contacts, setContacts] = useState<DirectoryContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // editor state
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState('Horse Evaluation Report');
  const [horseLabel, setHorseLabel] = useState('');
  const [reportBody, setReportBody] = useState('');
  const [newContactId, setNewContactId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await fetchStaffEvaluationReports()); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { staffContactDirectory().then(setContacts).catch(() => setContacts([])); }, []);

  function startNew() {
    setEditId(null); setTitle('Horse Evaluation Report'); setHorseLabel(''); setReportBody(''); setNewContactId('');
  }

  async function createDraft() {
    if (!newContactId) { setNote('Choose a client first.'); return; }
    setBusy(true); setNote(null);
    try {
      const { id } = await createEvaluationReport({ contactId: newContactId, title });
      await saveEvaluationReport(id, reportBody, title, horseLabel || undefined);
      setEditId(id);
      setNote('Draft created & saved.');
      await load();
    } catch (e) { setNote(toErrorMessage(e, 'Could not create the draft.')); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!editId) return;
    setBusy(true); setNote(null);
    try { await saveEvaluationReport(editId, reportBody, title, horseLabel || undefined); setNote('Saved.'); await load(); }
    catch (e) { setNote(toErrorMessage(e, 'Could not save.')); }
    finally { setBusy(false); }
  }

  async function deliver() {
    if (!editId) return;
    setBusy(true); setNote(null);
    try {
      const r = await deliverEvaluationReport(editId);
      setNote(r.consistent_client
        ? 'Delivered — kept indefinitely (rider/horse-owner client). The client was alerted + emailed.'
        : 'Delivered — available 90 days. The client was alerted + emailed.');
      startNew();
      await load();
    } catch (e) { setNote(toErrorMessage(e, 'Could not deliver.')); }
    finally { setBusy(false); }
  }

  function editExisting(r: StaffEvaluationReport) {
    setEditId(r.id); setTitle(r.title); setHorseLabel(r.horse_label ?? ''); setReportBody('');
    setNote(r.status === 'delivered' ? 'This report is delivered (read-only draft body not re-loaded here).' : 'Editing draft — write the body below.');
  }

  return (
    <PageLayout
      name="Evaluation reports"
      description="Author and deliver horse-evaluation reports. Delivery alerts the client, emails a PDF, and starts the retention window."
    >
      {note && <p className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded mb-4">{note}</p>}

      {/* Editor */}
      <div className="bg-white border border-green-800/10 rounded-lg p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-green-900">{editId ? 'Edit report' : 'New report'}</h2>
          <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5" onClick={startNew}>
            <Plus size={13} /> New
          </button>
        </div>
        {!editId && (
          <label className="block text-sm mb-3">
            <span className="form-label">Client</span>
            <select className="form-input" value={newContactId} onChange={(e) => setNewContactId(e.target.value)}>
              <option value="">Select a client…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <label className="block text-sm">
            <span className="form-label">Title</span>
            <input type="text" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="form-label">Horse</span>
            <input type="text" className="form-input" placeholder="e.g. Bella" value={horseLabel} onChange={(e) => setHorseLabel(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm mb-3">
          <span className="form-label">Report</span>
          <textarea rows={12} className="form-input resize-y font-mono text-[13px]"
            placeholder="Write the evaluation findings: overall condition, temperament, soundness, responsiveness, maturity, training, safety, and your recommendation."
            value={reportBody} onChange={(e) => setReportBody(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {!editId ? (
            <button type="button" className="btn-primary text-sm inline-flex items-center gap-1.5" disabled={busy} onClick={() => void createDraft()}>
              <Save size={14} /> Create draft
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary text-sm inline-flex items-center gap-1.5" disabled={busy} onClick={() => void save()}>
                <Save size={14} /> Save draft
              </button>
              <button type="button" className="btn-primary text-sm inline-flex items-center gap-1.5" disabled={busy} onClick={() => void deliver()}>
                <Send size={14} /> Deliver to client
              </button>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <h2 className="text-[11px] uppercase tracking-widest text-muted font-semibold mb-2">All reports</h2>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No reports yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-green-800/8 border border-green-800/10 rounded-lg overflow-hidden">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 bg-white">
              <div className="min-w-0">
                <p className="text-sm text-green-900">{r.horse_label ? `${r.title} — ${r.horse_label}` : r.title}</p>
                <p className="text-xs text-muted">
                  {r.delivered_at ? `Delivered ${new Date(r.delivered_at).toLocaleDateString()}` : 'Draft'}
                  {r.available_until ? ` · until ${new Date(r.available_until).toLocaleDateString()}` : r.delivered_at ? ' · indefinite' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.status === 'draft' && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => editExisting(r)}>Edit</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
