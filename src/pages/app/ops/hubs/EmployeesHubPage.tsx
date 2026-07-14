import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ModuleGate, useAsync } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { getEmployeesKpis } from '../../../../lib/ops/api-employees';

/**
 * OPS-EMP-HUB — the Employees module landing page (module mod.employees).
 *
 * Gated by ModuleGate('mod.employees'): an employees-OFF tenant sees the lock
 * and getEmployeesKpis() never fires. Inside the gate: active-staff /
 * shifts-this-week / open-assignments KPIs, each card deep-linking into the
 * staff and schedule pages. A failed load renders the error branch inline.
 */
export function EmployeesHubPage() {
  const modules = useModules();
  const on = modules['mod.employees'] === true;

  const load = useAsync(getEmployeesKpis);

  useEffect(() => {
    if (!on) return;
    load.run().catch(() => { /* surfaced via load.isError */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const kpis = load.data;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Employees</h1>
        <p className="text-sm text-green-800/70">Staff, schedules and service assignments.</p>
      </div>

      <ModuleGate moduleKey="mod.employees" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load the employees summary.'}
          </p>
        )}
        {load.isPending && !kpis && (
          <p className="text-sm text-green-800/70" data-testid="hub-loading">Loading…</p>
        )}

        {kpis && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Link to="/app/ops/employees/staff" className="rounded border border-green-800/15 bg-green-800/5 p-5 focus-ring" data-testid="kpi-active-staff">
              <p className="form-label mb-1">Active staff</p>
              <p className="font-serif text-3xl text-green-900">{kpis.activeStaff}</p>
            </Link>
            <Link to="/app/ops/employees/schedule" className="rounded border border-green-800/15 bg-green-800/5 p-5 focus-ring" data-testid="kpi-shifts-week">
              <p className="form-label mb-1">Shifts this week</p>
              <p className="font-serif text-3xl text-green-900">{kpis.shiftsThisWeek}</p>
            </Link>
          </div>
        )}
      </ModuleGate>
    </div>
  );
}

export default EmployeesHubPage;
