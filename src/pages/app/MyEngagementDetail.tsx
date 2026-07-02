import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Circle, FileText } from 'lucide-react';
import {
  getMyEngagement,
  templateKeysById,
  type MyEngagementDetail as EngagementDetail,
} from '../../lib/ops/api-client';
import { listRequiredDocuments } from '../../lib/ops/api-releases';
import { useDocumentTitle } from '../../lib/hooks';
import { labelFor } from './MyEngagements';

/**
 * MEMBER-ENG-DETAIL — one of the member's engagements: its stages, its
 * documents with status, and the required signing set for its service type
 * (contract_requirements matrix via listRequiredDocuments) checked against the
 * documents that actually exist. All reads are client-scoped by RLS.
 */
export default function MyEngagementDetail() {
  const { id } = useParams<{ id: string }>();
  useDocumentTitle('Engagement');
  const [detail, setDetail] = useState<EngagementDetail | null>(null);
  const [required, setRequired] = useState<string[]>([]);
  const [keysById, setKeysById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);
    (async () => {
      const eng = await getMyEngagement(id);
      if (!active) return;
      setDetail(eng);
      if (eng) {
        const [req, keys] = await Promise.all([
          // non-service engagements (service_type NULL, e.g. a kiosk release)
          // have no required-signing matrix rows
          eng.service_type ? listRequiredDocuments(eng.service_type) : Promise.resolve([]),
          templateKeysById(),
        ]);
        if (!active) return;
        setRequired(req);
        setKeysById(keys);
      }
    })()
      .catch((err) => active && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id]);

  if (loading) return <p className="body-text text-muted">Loading…</p>;
  if (error) {
    return (
      <p className="body-text text-sm text-red-700" role="alert">
        Could not load this engagement: {error}
      </p>
    );
  }
  if (!detail) {
    return (
      <div className="max-w-3xl">
        <p className="body-text text-sm">This engagement doesn't exist or isn't yours.</p>
        <Link to="/app/engagements" className="link-underline mt-4 inline-block">Back to your engagements</Link>
      </div>
    );
  }

  // template_keys already generated for this engagement (any status but VOID)
  const presentKeys = new Map(
    detail.documents
      .filter((d) => d.status !== 'VOID' && d.template_id && keysById[d.template_id])
      .map((d) => [keysById[d.template_id as string], d.status]),
  );

  return (
    <div className="max-w-3xl">
      <Link to="/app/engagements" className="link-underline inline-flex items-center gap-1 text-sm mb-4">
        <ArrowLeft size={14} aria-hidden="true" /> Your engagements
      </Link>
      <p className="eyebrow mb-2">{detail.display_code ?? 'Engagement'}</p>
      <h1 className="heading-section text-green-800 mb-2">{labelFor(detail.service_type)}</h1>
      <p className="text-sm text-muted mb-8">
        {labelFor(detail.status)}
        {detail.start_date ? ` · started ${new Date(detail.start_date).toLocaleDateString()}` : ''}
      </p>

      {/* Stages */}
      <section aria-labelledby="stages-heading" className="mb-10">
        <h2 id="stages-heading" className="font-serif text-lg text-green-900 mb-3">Stages</h2>
        {detail.stages.length === 0 ? (
          <p className="body-text text-muted text-sm">No separate stages on this engagement.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.stages.map((s) => (
              <div key={s.id} className="bg-white border border-green-800/10 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">{labelFor(s.stage)}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {labelFor(s.status)}
                    {s.deal_side ? ` · ${labelFor(s.deal_side)}` : ''}
                  </p>
                </div>
                <p className="text-xs text-muted">{new Date(s.effective_from).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Documents */}
      <section aria-labelledby="documents-heading" className="mb-10">
        <h2 id="documents-heading" className="font-serif text-lg text-green-900 mb-3">Documents</h2>
        {detail.documents.length === 0 ? (
          <p className="body-text text-muted text-sm">No documents generated yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {detail.documents.map((d) => (
              <div key={d.id} className="bg-white border border-green-800/10 p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileText size={16} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-sans font-medium text-green-900">{d.title ?? d.display_code ?? 'Document'}</p>
                    <p className="text-xs text-muted mt-0.5">{labelFor(d.status)}</p>
                  </div>
                </div>
                {d.status !== 'EXECUTED' && d.status !== 'VOID' && (
                  <Link to="/app/documents" className="link-underline whitespace-nowrap text-sm">Sign</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Required signing set */}
      <section aria-labelledby="required-heading">
        <h2 id="required-heading" className="font-serif text-lg text-green-900 mb-3">Required signing set</h2>
        {required.length === 0 ? (
          <p className="body-text text-muted text-sm">This service requires no additional signed documents.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {required.map((key) => {
              const status = presentKeys.get(key);
              const done = status === 'EXECUTED';
              return (
                <li key={key} className="bg-white border border-green-800/10 p-4 flex items-center gap-3">
                  {done ? (
                    <Check size={16} className="text-green-700 flex-shrink-0" aria-hidden="true" />
                  ) : (
                    <Circle size={16} className="text-green-800/30 flex-shrink-0" aria-hidden="true" />
                  )}
                  <div>
                    <p className="text-sm font-sans font-medium text-green-900">{labelFor(key)}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {done ? 'Signed' : status ? labelFor(status) : 'Not started'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
