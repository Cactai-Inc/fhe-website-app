/**
 * OPS-ENG-LIST — Engagements list page (surface `ops`, module `core`).
 *
 * Staff opens /app/ops/engagements → a filterable table of engagements. A row
 * click navigates to /app/ops/engagements/:id (the detail page). Real data path:
 * `listEngagements()` (INT-API-CORE → supabase.from('engagements'), RLS
 * org-scoped). Loading, empty, error and success branches all render.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listEngagements } from '../../../lib/api';
import { useDocumentTitle } from '../../../lib/hooks';
import { EngagementTable } from '../../../components/ops/engagements/EngagementTable';
import type { EngagementRow } from '../../../components/ops/engagements/EngagementTable';

export default function EngagementsPage() {
  useDocumentTitle('Engagements');
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    listEngagements()
      .then((rows) => {
        if (active) setEngagements(rows as EngagementRow[]);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load engagements.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="max-w-5xl">
      <p className="eyebrow mb-2">Ops</p>
      <h1 className="heading-section text-green-800 mb-8">Engagements</h1>

      {error ? (
        <p role="alert" className="form-error text-sm">
          {error}
        </p>
      ) : (
        <EngagementTable
          engagements={engagements}
          loading={loading}
          onOpen={(row) => navigate(`/app/ops/engagements/${row.id}`)}
        />
      )}
    </div>
  );
}
