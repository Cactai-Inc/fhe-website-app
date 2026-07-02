import { useEffect } from 'react';
import { DataTable, AsyncButton, StatusBadge, useAsync, useToast } from '../../../../lib/ops';
import { listModuleCatalog, setOrgModule, type ModuleCatalogRow } from '../../../../lib/api';
import { getMyOrgId, listOrgModules, type OrgModuleRow } from '../../../../lib/ops/api-admin';

/**
 * OPS-ADMIN-MODULES — the tenant entitlement panel (admin route: requireAdmin
 * is on the route; no ModuleGate — this IS the module switchboard).
 *
 * Renders the full platform module catalog (modules table, world-readable)
 * joined against this tenant's org_modules rows: on/off + source (TIER/ADDON/
 * GRANT/SUBSCRIPTION). Toggling calls the SECURITY-DEFINER set_org_module()
 * RPC, which the server restricts to SUPER_ADMIN / the billing service — a
 * plain tenant admin's attempt is rejected server-side and surfaced here as a
 * clear inline notice instead of a raw RPC error.
 */

interface CatalogRow extends ModuleCatalogRow {
  entitlement: OrgModuleRow | null;
}

function isPrivilegeError(err: Error): boolean {
  return /super_admin|restricted|insufficient_privilege|permission denied/i.test(err.message);
}

export function AdminModulesPage() {
  const toast = useToast();
  const catalog = useAsync(listModuleCatalog);
  const entitlements = useAsync(listOrgModules);
  const orgId = useAsync(getMyOrgId);

  useEffect(() => {
    for (const l of [catalog, entitlements, orgId]) {
      l.run().catch(() => { /* inline error branches */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byKey = new Map((entitlements.data ?? []).map((m) => [m.module_key, m]));
  const rows: CatalogRow[] = (catalog.data ?? []).map((m) => ({
    ...m,
    entitlement: byKey.get(m.module_key) ?? null,
  }));

  function isOn(r: CatalogRow): boolean {
    const e = r.entitlement;
    return !!e && e.enabled && (e.expires_at === null || new Date(e.expires_at) > new Date());
  }

  async function toggle(r: CatalogRow) {
    if (!orgId.data) {
      toast.error('Your account has no organization assigned.');
      return;
    }
    const next = !isOn(r);
    // Keep the recorded source on a flip; a first-time enable is an ADDON.
    const source = r.entitlement?.source ?? 'ADDON';
    try {
      await setOrgModule(orgId.data, r.module_key, next, source);
      toast.success(`${r.name} ${next ? 'enabled' : 'disabled'}`);
      await entitlements.run();
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      toast.error(
        isPrivilegeError(e)
          ? 'Module changes are managed by the platform (SUPER_ADMIN / billing). Contact your platform operator to change your plan.'
          : e.message,
      );
    }
  }

  const loadError = catalog.error ?? entitlements.error ?? orgId.error;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Modules</h1>
        <p className="text-sm text-green-800/70">
          Your organization’s platform entitlements — which modules are on, and why.
        </p>
      </div>

      {loadError && (
        <p role="alert" className="form-error mb-4">{loadError.message}</p>
      )}
      {toast.toasts.map((t) => (
        <p key={t.id} role={t.tone === 'error' ? 'alert' : 'status'}
           className={t.tone === 'error' ? 'form-error mb-2' : 'mb-2 text-sm text-green-800'}>
          {t.message}
        </p>
      ))}

      <DataTable<CatalogRow>
        columns={[
          { key: 'name', header: 'Module', render: (r) => (
            <span>
              <span className="font-medium">{r.name}</span>
              <span className="block text-xs text-green-800/60">{r.module_key}</span>
            </span>
          ) },
          { key: 'kind', header: 'Kind', render: (r) => (r.is_core ? 'Core' : 'Add-on module') },
          { key: 'status', header: 'Status', render: (r) =>
            r.is_core
              ? <StatusBadge status="ALWAYS ON" />
              : <StatusBadge status={isOn(r) ? 'ENABLED' : 'DISABLED'} /> },
          { key: 'source', header: 'Source', render: (r) =>
            r.is_core ? '—' : (r.entitlement?.source ?? '—') },
          {
            key: 'toggle',
            header: '',
            render: (r) =>
              r.is_core ? null : (
                <AsyncButton
                  className="btn-outline-gold text-xs"
                  onClick={() => toggle(r)}
                  pendingLabel="…"
                >
                  {isOn(r) ? 'Turn off' : 'Turn on'}
                </AsyncButton>
              ),
          },
        ]}
        rows={rows}
        rowKey={(r) => r.module_key}
        loading={catalog.isPending || entitlements.isPending}
        emptyTitle="No modules in the catalog"
      />
    </div>
  );
}

export default AdminModulesPage;
