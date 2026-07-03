/**
 * Ops KIT barrel — the single import surface every UI slice uses. Re-exports
 * the presentational components (src/components/ops/kit/*) and the interaction
 * state machines (useAsync/useToast) so a slice does:
 *   import { FormField, DataTable, Modal, Money, StatusBadge, ModuleGate,
 *            EmptyState, AsyncButton, useAsync, useToast } from '@/lib/ops';
 */
export { FormField } from '../../components/ops/kit/FormField';
export type { FormFieldProps } from '../../components/ops/kit/FormField';

export { DataTable } from '../../components/ops/kit/DataTable';
export type { DataTableProps, Column, RowAction } from '../../components/ops/kit/DataTable';

export { Modal } from '../../components/ops/kit/Modal';
export type { ModalProps } from '../../components/ops/kit/Modal';

export { Money, formatMoney } from '../../components/ops/kit/Money';
export type { MoneyProps } from '../../components/ops/kit/Money';

export { StatusBadge, toneForStatus } from '../../components/ops/kit/StatusBadge';
export type { StatusBadgeProps, BadgeTone } from '../../components/ops/kit/StatusBadge';

export { ModuleGate } from '../../components/ops/kit/ModuleGate';
export type { ModuleGateProps, ModuleMap } from '../../components/ops/kit/ModuleGate';

export { EmptyState } from '../../components/ops/kit/EmptyState';
export type { EmptyStateProps } from '../../components/ops/kit/EmptyState';

export { AsyncButton } from '../../components/ops/kit/AsyncButton';
export type { AsyncButtonProps } from '../../components/ops/kit/AsyncButton';

export { useAsync } from './useAsync';
export type { UseAsyncResult, AsyncState, AsyncStatus } from './useAsync';

export { useToast } from './useToast';
export type { UseToastResult, Toast, ToastTone } from './useToast';

export { toErrorMessage } from './errors';
