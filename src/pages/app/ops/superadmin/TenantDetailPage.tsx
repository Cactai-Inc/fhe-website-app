import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Puzzle, Users } from 'lucide-react';
import { useDocumentTitle } from '../../../../lib/hooks';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';

/**
 * TENANT MANAGEMENT (platform, /app/ops/superadmin/organizations/:id) — the one
 * surface a super admin manages a tenant from, reached by clicking the tenant in
 * the Organizations list. Grouped and explained:
 *   Identity & status — who they are; suspend/reactivate the whole tenant.
 *   Plan & modules — every registry module with its description; toggling here
 *     changes what the tenant's admin and members can see/use.
 *   Staff accounts — the tenant's admins and instructors.
 *   Usage — a live snapshot of the tenant's footprint.
 */

interface TenantDetail {
  org: { id: string; name: string; slug: string; status: string; display_code: string | null; created_at: string } | null;
  modules: { module_key: string; name: string; description: string | null; is_core: boolean; enabled: boolean; source: string | null }[];
  admins: { user_id: string; email: string; name: string; role: string }[];
  usage: { members: number; contacts: number; engagements: number; horses: number; documents: number };
}

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Instructor', EMPLOYEE: 'Staff',
};

function Card({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5 mb-4">
      <h2 className="font-serif text-green-800 text-lg">{title}</h2>
      <p className="text-[12px] text-muted mb-4">{hint}</p>
      {children}
    </section>
  );
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  useDocumentTitle('Tenant management');
  const { isSuperAdmin } = useAuth();
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const { data, error: err } = await supabase.rpc('platform_tenant_detail', { p_org_id: id });
    if (err) { setError(err.message); return; }
    setDetail(data as TenantDetail);
    setError(null);
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (!isSuperAdmin) {
    return <p role="alert" className="form-error">Super admin only. This page is restricted to the platform operator.</p>;
  }

  async function toggleModule(key: string, enabled: boolean) {
    setBusyKey(key);
    try {
      const { error: err } = await supabase.rpc('platform_set_tenant_module', {
        p_org_id: id, p_module_key: key, p_enabled: enabled,
      });
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the module.');
    } finally {
      setBusyKey(null);
    }
  }

  async function setStatus(status: string) {
    setBusyKey('status');
    try {
      const { error: err } = await supabase.rpc('platform_set_tenant_status', {
        p_org_id: id, p_status: status,
      });
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not change the status.');
    } finally {
      setBusyKey(null);
    }
  }

  const org = detail?.org;
  const featureModules = (detail?.modules ?? []).filter((m) => !m.is_core);
  const coreModules = (detail?.modules ?? []).filter((m) => m.is_core);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to="/app/ops/superadmin/organizations"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Organizations
      </Link>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {!detail && !error && <p className="text-sm text-green-800/70">Loading tenant…</p>}

      {org && (
        <>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="font-serif text-2xl text-green-900 flex items-center gap-2">
                <Building2 size={22} className="text-gold-800" /> {org.name}
              </h1>
              <p className="text-[12.5px] text-muted mt-0.5">
                <code>{org.slug}</code>{org.display_code ? ` · ${org.display_code}` : ''} · created {new Date(org.created_at).toLocaleDateString()}
              </p>
            </div>
            <span className={`text-xs font-sans px-2.5 py-1 rounded-full whitespace-nowrap ${
              org.status === 'ACTIVE' ? 'bg-green-50 text-green-700'
              : org.status === 'SUSPENDED' ? 'bg-red-50 text-red-700' : 'bg-cream-100 text-muted'
            }`}>
              {org.status}
            </span>
          </div>

          <Card title="Identity & status"
            hint="Suspending blocks the whole tenant (their staff and members) from the app without deleting anything; reactivate any time.">
            <div className="flex gap-2">
              {org.status !== 'ACTIVE' && (
                <button type="button" disabled={busyKey === 'status'} onClick={() => void setStatus('ACTIVE')}
                  className="px-4 py-2 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring disabled:opacity-60">
                  Reactivate tenant
                </button>
              )}
              {org.status === 'ACTIVE' && (
                <button type="button" disabled={busyKey === 'status'} onClick={() => void setStatus('SUSPENDED')}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50 focus-ring disabled:opacity-60">
                  Suspend tenant
                </button>
              )}
            </div>
          </Card>

          <Card title="Plan & modules"
            hint="What this tenant's product includes. Toggling a module changes what their admin and members can see and use — effective immediately. Core modules are always on.">
            <div className="flex flex-col gap-2">
              {featureModules.map((m) => (
                <label key={m.module_key}
                  className="flex items-start justify-between gap-4 border border-green-800/10 rounded-lg px-4 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-green-900 inline-flex items-center gap-2">
                      <Puzzle size={14} className="text-gold-800" /> {m.name}
                      {m.source && <span className="text-[10px] text-muted uppercase">{m.source}</span>}
                    </span>
                    {m.description && <span className="block text-[12px] text-muted mt-0.5">{m.description}</span>}
                  </span>
                  <input type="checkbox" className="accent-green-700 w-4 h-4 mt-1 shrink-0"
                    checked={m.enabled} disabled={busyKey === m.module_key}
                    onChange={(e) => void toggleModule(m.module_key, e.target.checked)} />
                </label>
              ))}
              {coreModules.length > 0 && (
                <p className="text-[11.5px] text-muted mt-1">
                  Always included: {coreModules.map((m) => m.name).join(' · ')}
                </p>
              )}
            </div>
          </Card>

          <Card title="Staff accounts"
            hint="The tenant's admins and instructors. Their admin manages members and instructor access from inside their own app.">
            {detail!.admins.length === 0 ? (
              <p className="text-sm text-muted">No staff accounts yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detail!.admins.map((a) => (
                  <div key={a.user_id} className="flex items-center justify-between text-sm border-b border-green-800/[0.06] pb-1.5 last:border-0">
                    <span className="text-green-900 inline-flex items-center gap-2">
                      <Users size={13} className="text-green-700" /> {a.name || a.email}
                    </span>
                    <span className="text-xs text-muted">{a.email} · {ROLE_LABEL[a.role] ?? a.role}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Usage" hint="A live snapshot of this tenant's footprint on the platform.">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Object.entries(detail!.usage).map(([k, v]) => (
                <div key={k} className="text-center border border-green-800/10 rounded-lg py-3">
                  <p className="font-serif text-2xl text-green-800">{v as number}</p>
                  <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold">{k}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
