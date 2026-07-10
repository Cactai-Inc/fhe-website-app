import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DataTable, StatusBadge, useAsync } from '../../../../lib/ops';
import { useAuth } from '../../../../contexts/AuthContext';
import { listOrganizations, type OrganizationRow } from '../../../../lib/ops/api-superadmin';

/**
 * OPS-SUPERADMIN-ORGS — the platform-operator organizations list.
 *
 * SUPER_ADMIN only: gated on isSuperAdmin from AuthContext (the route already
 * requires ADMIN; this page is the stricter platform-operator surface). With
 * the gate off nothing fetches. Read-only: name / slug / status / created,
 * straight from the organizations table via listOrganizations().
 */
export function OrganizationsPage() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const orgs = useAsync(listOrganizations);

  useEffect(() => {
    if (!isSuperAdmin) return;
    orgs.run().catch(() => { /* inline error branch */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <p role="alert" className="form-error">Super admin only. This page is restricted to the platform operator.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-green-900">Organizations</h1>
          <p className="text-sm text-green-800/70">Every tenant on the platform — click one to manage it.</p>
        </div>
        <Link to="/app/ops/superadmin/provision" className="btn-primary">Provision tenant</Link>
      </div>

      {orgs.isError && (
        <p role="alert" className="form-error mb-4">{orgs.error?.message ?? 'Could not load organizations.'}</p>
      )}

      <DataTable<OrganizationRow>
        columns={[
          { key: 'name', header: 'Name', render: (r) => r.name },
          { key: 'slug', header: 'Slug', render: (r) => r.slug ?? '—' },
          { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'created', header: 'Created', render: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString() : '—') },
        ]}
        rows={orgs.data ?? []}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/app/ops/superadmin/organizations/${r.id}`)}
        loading={orgs.isPending}
        emptyTitle="No organizations"
        emptyMessage="Provision the first tenant to see it here."
      />
    </div>
  );
}

export default OrganizationsPage;
