import { useEffect } from 'react';
import { DataTable, useAsync, type Column, type RowAction } from '../../../lib/ops';
import { listOrgFiles, fileDownloadUrl, type OrgFileRow } from '../../../lib/files';

/**
 * RECORDS · FILES tab — every file in the tenant (owner, 2026-08-15: Lessons/
 * Documents/Files/Deals "should be added to the records page"). `listOrgFiles`
 * relies on the `files_staff_rw` RLS policy, which already admits any staff
 * member to every file in their org — no new RPC needed, this is a straight
 * read. A file here is the TASK-UPLOADS spine (`files`/`file_links`) —
 * uploaded attachments, distinct from `documents` (FHE's own generated,
 * signable records), which is its own Records tab.
 */
function fmtBytes(n: number | null): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function FilesRecordsPage() {
  const load = useAsync(listOrgFiles);

  useEffect(() => {
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const files = load.data ?? [];

  const columns: Column<OrgFileRow>[] = [
    { key: 'filename', header: 'File', render: (f) => f.title || f.filename },
    { key: 'owner', header: 'Owner', render: (f) => f.owner_name ?? '—' },
    { key: 'size', header: 'Size', render: (f) => fmtBytes(f.byte_size) },
    { key: 'uploaded', header: 'Uploaded', render: (f) => new Date(f.created_at).toLocaleDateString() },
  ];

  const rowActions: RowAction<OrgFileRow>[] = [
    {
      label: 'Download',
      onClick: (f) => {
        void fileDownloadUrl(f).then((url) => {
          if (url) window.open(url, '_blank', 'noopener');
        });
      },
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {load.isError && (
        <p role="alert" className="form-error mb-4">
          {load.error?.message ?? 'Could not load files.'}
        </p>
      )}
      <DataTable
        columns={columns}
        rows={files}
        rowKey={(f) => f.id}
        loading={load.isPending && files.length === 0}
        rowActions={rowActions}
        emptyTitle="No files yet"
        emptyMessage="Files uploaded anywhere in the app — by staff or members — appear here."
      />
    </div>
  );
}

export default FilesRecordsPage;
