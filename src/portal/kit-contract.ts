/**
 * KIT-PORTAL — the portal-local KIT contract (barrel).
 *
 * Thin portal + public slices import their primitives and entitlement hooks from
 * this ONE place instead of reaching into `src/components/ops/kit/*`,
 * `src/lib/ops/*`, and `src/contexts/AuthContext` individually. That keeps every
 * portal/public screen thin and gives them a single, stable import + fixture seam
 * (see `./__fixtures__/portalFixtures`) so they never re-declare KIT types.
 *
 * STRICTLY a re-export surface: this file performs no data call and declares no
 * new component. Every primitive re-exported here is one the KIT actually
 * provides (audited by `kit-contract.test.tsx`), and every hook is the real
 * entitlement hook from INT-AUTH.
 *
 *   import {
 *     FormField, DataTable, Modal, Money, StatusBadge, ModuleGate,
 *     useModules, useEntitlements,
 *   } from '../portal/kit-contract';
 */

// ─── KIT primitives (re-exported verbatim from the ops KIT) ──────────────────
export { FormField } from '../components/ops/kit/FormField';
export type { FormFieldProps } from '../components/ops/kit/FormField';

export { DataTable } from '../components/ops/kit/DataTable';
export type { DataTableProps, Column, RowAction } from '../components/ops/kit/DataTable';

export { Modal } from '../components/ops/kit/Modal';
export type { ModalProps } from '../components/ops/kit/Modal';

export { Money, formatMoney } from '../components/ops/kit/Money';
export type { MoneyProps } from '../components/ops/kit/Money';

export { StatusBadge, toneForStatus } from '../components/ops/kit/StatusBadge';
export type { StatusBadgeProps, BadgeTone } from '../components/ops/kit/StatusBadge';

export { ModuleGate } from '../components/ops/kit/ModuleGate';
export type { ModuleGateProps, ModuleMap } from '../components/ops/kit/ModuleGate';

export { EmptyState } from '../components/ops/kit/EmptyState';
export type { EmptyStateProps } from '../components/ops/kit/EmptyState';

export { AsyncButton } from '../components/ops/kit/AsyncButton';
export type { AsyncButtonProps } from '../components/ops/kit/AsyncButton';

// ─── Interaction state machines (re-exported from src/lib/ops) ───────────────
export { useAsync } from '../lib/ops/useAsync';
export type { UseAsyncResult, AsyncState, AsyncStatus } from '../lib/ops/useAsync';

export { useToast } from '../lib/ops/useToast';
export type { UseToastResult, Toast, ToastTone } from '../lib/ops/useToast';

// ─── Entitlement hooks (INT-AUTH — read the AuthContext module set) ──────────
export { useModules, useEntitlements, MODULE_CATALOG } from '../lib/ops/useModules';
export type { Entitlements } from '../lib/ops/useModules';

// ─── Portal fixtures (typed, mirror real column shapes) ──────────────────────
export * from './__fixtures__/portalFixtures';
