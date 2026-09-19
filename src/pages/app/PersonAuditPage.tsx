import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDocumentTitle } from '../../lib/hooks';
import { contactAuditTrail, type ContactAuditEntry } from '../../lib/api';
import { toErrorMessage } from '../../lib/ops/errors';

/**
 * PERSON AUDIT PAGE (/app/records/person/:contactId/audit) — the client record's
 * full audit trail on its own page (owner, Item 6), reached from a link on the
 * record rather than sitting inline on the Activity tab. Every action the person
 * took and every change recorded against them, newest first, with the value diff.
 */
export default function PersonAuditPage() {
  useDocumentTitle('Audit trail');
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ContactAuditEntry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) return;
    let active = true;
    contactAuditTrail(contactId)
      .then((r) => { if (active) setRows(r); })
      .catch((e) => { if (active) setErr(toErrorMessage(e, 'Could not load the audit trail.')); });
    return () => { active = false; };
  }, [contactId]);

  if (!contactId) {
    return <p className="max-w-4xl mx-auto p-6 text-sm text-muted">No record selected.</p>;
  }

  return (
    <div className="pb-10 max-w-4xl mx-auto px-4 sm:px-0">
      <div className="mb-3 mt-2">
        <button type="button" onClick={() => navigate(`/app/records/person/${contactId}`)}
          className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:text-green-900 focus-ring rounded">
          <ArrowLeft size={16} /> Back to the record
        </button>
      </div>
      <h1 className="font-serif text-2xl text-green-900 mb-1">Audit trail</h1>
      <p className="text-sm text-muted mb-4">
        Everything recorded for this account, newest first. Nothing here can be edited
        or removed — it is the record of what happened.
      </p>
      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      {!rows ? <p className="text-sm text-muted">Loading…</p>
        : rows.length === 0 ? <p className="text-sm text-muted">No recorded activity.</p>
        : (
          <ol className="flex flex-col gap-1.5">
            {rows.map((a) => (
              <li key={a.id} className="rounded-lg border border-green-800/10 bg-white px-3.5 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-green-900">{a.action}</span>
                  <span className="text-[11px] text-muted shrink-0">
                    {new Date(a.occurred_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[12px] text-muted mt-0.5">
                  {a.table_name ?? 'system'}
                  {a.by_them ? ' · by them' : ' · about them'}
                </p>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}
