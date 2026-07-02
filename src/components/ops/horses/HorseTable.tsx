import { DataTable } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { Horse, LookupCode, Contact } from '../../../lib/ops/types';

/**
 * Roster table for horses: name (barn / registered), breed, color, primary
 * owner. Breed/color codes are resolved to display names via the injected
 * lookups; the owner id resolves against the contacts list. Clicking a row
 * invokes `onRowClick(horse)` (the edit path).
 */
export interface HorseTableProps {
  horses: Horse[];
  breeds: LookupCode[];
  colors: LookupCode[];
  owners: Contact[];
  loading?: boolean;
  onRowClick: (horse: Horse) => void;
}

function lookupName(list: LookupCode[], code: string | null): string {
  if (!code) return '—';
  return list.find((l) => l.code === code)?.display_name ?? code;
}

export function HorseTable({ horses, breeds, colors, owners, loading, onRowClick }: HorseTableProps) {
  const columns: Column<Horse>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (h) => (
        <span className="font-medium">
          {h.barn_name ?? h.registered_name ?? '—'}
        </span>
      ),
    },
    { key: 'breed', header: 'Breed', render: (h) => lookupName(breeds, h.breed) },
    { key: 'color', header: 'Color', render: (h) => lookupName(colors, h.color) },
    {
      key: 'owner',
      header: 'Primary owner',
      render: (h) => {
        if (!h.current_owner_contact_id) return '—';
        return owners.find((o) => o.id === h.current_owner_contact_id)?.full_name ?? '—';
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={horses}
      rowKey={(h) => h.id}
      loading={loading}
      onRowClick={onRowClick}
      emptyTitle="No horses yet"
      emptyMessage="Add your first horse to build the roster."
    />
  );
}
