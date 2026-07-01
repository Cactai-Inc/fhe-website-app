import type { ReactNode } from 'react';

/**
 * Layer C entitlement gate (PLATFORM_ARCHITECTURE.md §4.3). Renders `children`
 * only when the tenant's module map has `moduleKey` enabled; otherwise renders
 * a locked fallback (default) or nothing when `hideWhenLocked`.
 *
 * The `modules` map is INJECTED (prop) so the gate is pure and testable with no
 * data dependency. INT-AUTH supplies the real default via `useModules()`; until
 * then callers pass the map explicitly. If no map is provided the gate is
 * fail-closed (locked).
 */
export type ModuleMap = Record<string, boolean>;

export interface ModuleGateProps {
  moduleKey: string;
  /** Injected tenant module map. Fail-closed (locked) when omitted. */
  modules?: ModuleMap;
  children: ReactNode;
  /** Custom locked UI. Ignored when `hideWhenLocked`. */
  fallback?: ReactNode;
  /** Render nothing (instead of a fallback) when the module is off. */
  hideWhenLocked?: boolean;
}

export function ModuleGate({
  moduleKey,
  modules,
  children,
  fallback,
  hideWhenLocked,
}: ModuleGateProps) {
  const enabled = modules?.[moduleKey] === true;

  if (enabled) {
    return <>{children}</>;
  }

  if (hideWhenLocked) {
    return null;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return (
    <div
      className="flex flex-col items-center justify-center text-center py-10 px-6 border border-green-800/15 bg-green-800/5 rounded"
      data-testid="module-locked"
      role="note"
    >
      <p className="font-serif text-base text-green-900">Module not enabled</p>
      <p className="mt-1 text-sm text-green-800/70">
        The <span className="font-medium">{moduleKey}</span> module is not active for this
        organization.
      </p>
    </div>
  );
}
