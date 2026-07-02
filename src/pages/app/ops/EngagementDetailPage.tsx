/**
 * OPS-ENG-LIST — Engagement detail page (surface `ops`, module `core`).
 *
 * Reads /app/ops/engagements/:id → `getEngagement(id)` (INT-API-CORE rollup:
 * engagement + stages + documents + transactions, RLS org-scoped). Renders the
 * parties/horse/transaction/stages summary, the OPS-ENG-STAGES panel, and a
 * Documents section:
 *   - the StagesPanel (brokerage-gated via ModuleGate) lists the engagement's
 *     stages from listEngagementStages and adds one via createEngagementStage,
 *   - "Generate document" opens the OPS-DOC-GEN modal inline; on success we
 *     navigate to the new document's viewer (OPS-DOC-VIEW),
 *   - each document row → OPS-DOC-VIEW (/app/ops/documents/:docId)
 * Loading, not-found, error and success branches all render.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getEngagement } from '../../../lib/api';
import { useDocumentTitle } from '../../../lib/hooks';
import { StatusBadge, EmptyState } from '../../../lib/ops';
import { EngagementSummary } from '../../../components/ops/engagements/EngagementSummary';
import { StagesPanel } from '../../../components/ops/engagements/StagesPanel';
import { GenerateDocumentModal } from '../../../components/ops/documents/GenerateDocumentModal';
import type { EngagementDetail } from '../../../lib/ops/types';

export default function EngagementDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  useDocumentTitle('Engagement');
  const navigate = useNavigate();
  const [engagement, setEngagement] = useState<EngagementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getEngagement(id)
      .then((row) => {
        if (active) setEngagement(row);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load engagement.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="max-w-4xl">
      <Link to="/app/ops/engagements" className="link-underline text-sm">
        ← All engagements
      </Link>

      <div className="mt-6">
        {loading ? (
          <p className="body-text text-muted" data-testid="detail-loading">
            Loading…
          </p>
        ) : error ? (
          <p role="alert" className="form-error text-sm">
            {error}
          </p>
        ) : !engagement ? (
          <EmptyState
            title="Engagement not found"
            message="This engagement may have been removed or is outside your organization."
          />
        ) : (
          <>
            <EngagementSummary engagement={engagement} />

            {/* OPS-ENG-STAGES — stage management (list + add), brokerage-gated
                inside the panel via ModuleGate('mod.brokerage'). */}
            <div className="mt-8">
              <StagesPanel engagementId={engagement.id} />
            </div>

            {/* Documents section */}
            <section aria-labelledby="documents-heading" className="mt-8">
              <div className="flex items-center justify-between gap-4 mb-3">
                <h2 id="documents-heading" className="font-serif text-lg text-green-900">
                  Documents
                </h2>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => setGenerateOpen(true)}
                >
                  Generate document
                </button>
              </div>

              {engagement.documents.length === 0 ? (
                <p className="text-sm text-green-800/70">
                  No documents yet. Generate one to get started.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {engagement.documents.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        to={`/app/ops/documents/${doc.id}`}
                        className="flex items-center justify-between gap-4 border border-green-800/10 bg-white px-4 py-3 hover:bg-green-800/5"
                      >
                        <span className="text-sm font-sans font-medium text-green-900">
                          {doc.title ?? doc.display_code ?? doc.id.slice(0, 8)}
                        </span>
                        <StatusBadge status={doc.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* OPS-DOC-GEN inline: on success, hand off to the viewer. */}
            <GenerateDocumentModal
              open={generateOpen}
              onClose={() => setGenerateOpen(false)}
              engagementId={engagement.id}
              serviceType={engagement.service_type ?? undefined}
              existingTemplateIds={engagement.documents
                .map((d) => d.template_id)
                .filter((t): t is string => t !== null)}
              onGenerated={(documentId) => {
                setGenerateOpen(false);
                navigate(`/app/ops/documents/${documentId}`);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
