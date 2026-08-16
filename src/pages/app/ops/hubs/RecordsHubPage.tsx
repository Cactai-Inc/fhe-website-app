import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { DataTable, ModuleGate, useAsync, type Column } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { listRecordHorses, type HorseRecord } from '../../../../lib/ops/api-records';

/**
 * OPS-REC-HUB — Horse Records hub (module mod.horserecords).
 *
 * The module's landing screen at /app/ops/records, fully wrapped in
 * ModuleGate('mod.horserecords'). Lists the tenant's horses (listRecordHorses
 * — includes the vet/farrier columns) with, per row, real links into the two
 * record surfaces:
 *   Ownership → /app/ops/records/horses/:id/parties  (horse_relationships ledger)
 *   Health    → /app/ops/records/horses/:id/health   (health log + care team)
 * A load failure renders an inline error branch; no horses renders the empty
 * state. No dead links: both targets are lane routes registered with the hub.
 */
export function RecordsHubPage() {
  const modules = useModules();
  const load = useAsync(listRecordHorses);
  const recordsOn = modules['mod.horserecords'] === true;

  useEffect(() => {
    if (!recordsOn) return;
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsOn]);

  const horses = load.data ?? [];

  const columns: Column<HorseRecord>[] = [
    {
      key: 'horse',
      header: 'Horse',
      render: (h) => h.nickname ?? h.registered_name ?? h.display_code ?? h.id.slice(0, 8),
    },
    { key: 'breed', header: 'Breed', render: (h) => h.breed ?? '—' },
    { key: 'vet', header: 'Vet', render: (h) => h.vet_name ?? '—' },
    { key: 'farrier', header: 'Farrier', render: (h) => h.farrier_name ?? '—' },
    {
      key: 'records',
      header: <span className="sr-only">Records</span>,
      className: 'text-right whitespace-nowrap',
      render: (h) => (
        <>
          <Link
            to={`/app/ops/records/horses/${h.id}/parties`}
            className="link-underline"
            onClick={(e) => e.stopPropagation()}
          >
            Ownership
          </Link>
          <Link
            to={`/app/ops/records/horses/${h.id}/health`}
            className="link-underline ml-4"
            onClick={(e) => e.stopPropagation()}
          >
            Health
          </Link>
        </>
      ),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Helmet>
        <title>Horse Records · Ops</title>
      </Helmet>

      <header className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Horse Records</h1>
        <p className="mt-1 text-sm text-green-800/70">
          Ownership ledger, care team and health log per horse.
        </p>
      </header>

      <ModuleGate moduleKey="mod.horserecords" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load horses.'}
          </p>
        )}

        <DataTable
          columns={columns}
          rows={horses}
          rowKey={(h) => h.id}
          loading={load.isPending && horses.length === 0}
          emptyTitle="No horses yet"
          emptyMessage="Add horses on the Horses screen; their records appear here."
        />
      </ModuleGate>
    </div>
  );
}

export default RecordsHubPage;

/** RETIRED behind a boolean, never deleted (standing rule from 86a2c33).
 *  TASK-PAGEMERGE (DUPECENSUS 2.1, "Horse roster — THREE implementations"):
 *  this roster was a third listing of the same 4 horses HorseRecordsPage
 *  (the Records "Horses" tab) and HorsesPage already showed, reachable from
 *  a SECOND "Records" nav row (Modules → Records) sitting next to the real
 *  one (Management → Records) — the exact "two rows, one concept" defect
 *  CLAUDE.md names as this project's recurring failure. Its two unique
 *  capabilities — the Ownership and Health lane links — are carried across
 *  into HorseRecordsPage's per-horse "Records" row; the lane ROUTES
 *  themselves (`/app/ops/records/horses/:id/parties`, `/health`) are
 *  untouched and keep resolving regardless of this flag. Owner instruction
 *  covering this: "put back all the pages in the nav where they belong now
 *  WITH THIS MERGE" (2026-08-15) — the nav row for this page is removed as
 *  part of the merge, not moved without instruction. */
export const RECORDS_HUB_RETIRED = true;
