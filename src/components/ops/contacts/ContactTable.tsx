import { DataTable } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { Contact } from '../../../lib/ops/types';

/**
 * Presentational contacts table. Wraps the kit DataTable with the contact
 * columns; a row click opens edit mode (handler owned by ContactsPage). No data
 * call here — the page fetches and passes `rows`.
 */
export interface ContactTableProps {
  rows: Contact[];
  loading?: boolean;
  /** Open the edit drawer for the clicked contact. */
  onRowClick: (contact: Contact) => void;
}

const columns: Column<Contact>[] = [
  { key: 'full_name', header: 'Name', render: (c) => c.full_name },
  { key: 'email', header: 'Email', render: (c) => c.email ?? '—' },
  { key: 'phone', header: 'Phone', render: (c) => c.phone ?? '—' },
];

export function ContactTable({ rows, loading, onRowClick }: ContactTableProps) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      rowKey={(c) => c.id}
      onRowClick={onRowClick}
      emptyTitle="No contacts yet"
      emptyMessage="Create your first contact to get started."
    />
  );
}
