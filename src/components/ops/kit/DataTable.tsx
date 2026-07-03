import type { ReactNode } from 'react';
import { EmptyState } from './EmptyState';

/**
 * Generic table: columns + rows + loading + empty + optional per-row actions.
 * Each column renders a cell from the row; `rowActions` renders trailing
 * action buttons whose handlers receive the FULL row object (proven wired by
 * the kit test firing a row action and asserting the row is passed).
 */
export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer. Receives the row. */
  render: (row: T) => ReactNode;
  className?: string;
}

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  /** Optional variant class for the action button. */
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  /** Stable key extractor. Defaults to array index. */
  rowKey?: (row: T, index: number) => string | number;
  loading?: boolean;
  rowActions?: RowAction<T>[];
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  rowActions,
  emptyTitle = 'Nothing here yet',
  emptyMessage,
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="py-12 text-center text-sm text-green-800/70" data-testid="table-loading">
        Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <table className="w-full text-left text-sm border-collapse">
      <thead>
        <tr className="border-b border-green-800/15">
          {columns.map((col) => (
            <th
              key={col.key}
              className={`py-2.5 px-3 text-xs font-sans font-medium tracking-wide uppercase text-green-800/[0.85] ${col.className ?? ''}`}
              scope="col"
            >
              {col.header}
            </th>
          ))}
          {rowActions && rowActions.length > 0 && (
            <th className="py-2.5 px-3 text-right text-xs font-sans font-medium tracking-wide uppercase text-green-800/[0.85]" scope="col">
              <span className="sr-only">Actions</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={rowKey ? rowKey(row, index) : index}
            className={`border-b border-green-800/10 ${onRowClick ? 'cursor-pointer hover:bg-green-800/5' : ''}`}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
          >
            {columns.map((col) => (
              <td key={col.key} className={`py-3 px-3 text-green-900 ${col.className ?? ''}`}>
                {col.render(row)}
              </td>
            ))}
            {rowActions && rowActions.length > 0 && (
              <td className="py-3 px-3 text-right whitespace-nowrap">
                {rowActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={action.className ?? 'link-underline ml-3'}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick(row);
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
