import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Mail, Share2, FileText } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  fetchMyEvaluationReports, downloadEvaluationReport, emailMyEvaluationReport,
  shareEvaluationReport, logReportViewed, type MyEvaluationReport,
} from '../../lib/acquisition';

/*
 * MY EVALUATIONS — the client's delivered horse-evaluation reports. Read in-app,
 * download a PDF, email yourself a copy, or share with someone by email. Reports
 * are retained 90 days from delivery unless you're a current rider / horse-owner
 * client, in which case they stay available indefinitely (enforced server-side).
 */
export default function EvaluationsPage() {
  useDocumentTitle('Your evaluations');
  const [reports, setReports] = useState<MyEvaluationReport[]>([]);
  const [open, setOpen] = useState<MyEvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [shareFor, setShareFor] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchMyEvaluationReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, []);

  function view(r: MyEvaluationReport) {
    setOpen(r);
    logReportViewed(r.id);
  }

  async function act(fn: () => Promise<void>, ok: string) {
    setBusy(true); setNote(null);
    try { await fn(); setNote(ok); }
    catch (e) { setNote(toErrorMessage(e, 'Something went wrong.')); }
    finally { setBusy(false); }
  }

  const retentionCopy = (r: MyEvaluationReport) =>
    r.available_until
      ? `Available through ${new Date(r.available_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : 'Available to you indefinitely';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/app" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Dashboard
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">Your evaluations</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Your horse evaluation reports — read here, download a copy, or share them.
      </p>

      {note && <p className="bg-green-50 border border-green-200 text-green-800 text-sm p-3 rounded mb-4">{note}</p>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted">You don’t have any evaluation reports yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li key={r.id} className="bg-white border border-green-800/10 rounded-lg p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-green-900 inline-flex items-center gap-2">
                    <FileText size={16} className="text-green-700" />
                    {r.horse_label ? `${r.title} — ${r.horse_label}` : r.title}
                    {r.is_shared && <span className="text-[10px] uppercase tracking-wide bg-green-800/10 text-green-800 px-1.5 py-0.5 rounded">Shared with you</span>}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{retentionCopy(r)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button type="button" className="btn-secondary text-xs" onClick={() => view(r)}>Read</button>
                <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  disabled={busy} onClick={() => void act(() => downloadEvaluationReport(r), 'Downloaded.')}>
                  <Download size={13} /> Download PDF
                </button>
                <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5"
                  disabled={busy} onClick={() => void act(() => emailMyEvaluationReport(r.id), 'Emailed to you.')}>
                  <Mail size={13} /> Email me a copy
                </button>
                {!r.is_shared && (
                  <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5"
                    onClick={() => { setShareFor(shareFor === r.id ? null : r.id); setShareEmail(''); }}>
                    <Share2 size={13} /> Share
                  </button>
                )}
              </div>
              {shareFor === r.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-sm">
                    <span className="form-label">Share with (email)</span>
                    <input type="email" className="form-input w-64" placeholder="their@email.com"
                      value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
                  </label>
                  <button type="button" className="btn-primary text-xs" disabled={busy || !shareEmail.trim()}
                    onClick={() => void act(async () => { await shareEvaluationReport(r.id, shareEmail.trim()); setShareFor(null); }, 'Shared.')}>
                    Send
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-green-950/50 p-0 sm:p-4" onClick={() => setOpen(null)}>
          <div className="bg-cream w-full sm:max-w-2xl sm:rounded-2xl flex flex-col max-h-[100dvh] sm:max-h-[92dvh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-green-800/10">
              <h2 className="font-serif text-green-900">{open.horse_label ? `${open.title} — ${open.horse_label}` : open.title}</h2>
              <button type="button" onClick={() => setOpen(null)} className="text-green-800/50 hover:text-green-800 text-sm">Close</button>
            </div>
            <div className="overflow-y-auto overscroll-contain p-5 whitespace-pre-wrap text-sm text-green-900 leading-relaxed">
              {open.body || 'No content.'}
            </div>
            <div className="flex gap-2 px-5 py-3 border-t border-green-800/10">
              <button type="button" className="btn-secondary text-xs inline-flex items-center gap-1.5"
                disabled={busy} onClick={() => void act(() => downloadEvaluationReport(open), 'Downloaded.')}>
                <Download size={13} /> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
