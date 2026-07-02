import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, useAsync, useToast } from '../../../lib/ops';
import { listContacts, createContact, updateContact } from '../../../lib/api';
import type { Contact, ContactInput } from '../../../lib/ops/types';
import { ContactTable } from '../../../components/ops/contacts/ContactTable';
import { ContactForm } from '../../../components/ops/contacts/ContactForm';

/**
 * OPS-CONTACTS — CRM contacts directory + create/edit drawer.
 *
 * Staff opens /app/ops/contacts → a searchable contact list (listContacts).
 * 'New contact' opens a Modal ContactForm whose submit calls createContact and
 * the new row appears (list refreshes). A row click opens the same Modal in
 * edit mode → updateContact. Success renders a toast + refresh; a rejected
 * create/update renders the error inline and KEEPS THE MODAL OPEN.
 */
type DrawerState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; contact: Contact };

export function ContactsPage() {
  const [rows, setRows] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState<DrawerState>({ mode: 'closed' });
  const [formError, setFormError] = useState<string | null>(null);

  const load = useAsync(listContacts);
  const toast = useToast();

  const refresh = useCallback(async () => {
    const data = await load.run();
    setRows(data);
  }, [load]);

  useEffect(() => {
    // Initial fetch — errors surface on load.error (rendered below).
    refresh().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useAsync(async (input: ContactInput, editing: Contact | null) => {
    return editing ? updateContact(editing.id, input) : createContact(input);
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const openCreate = () => {
    setFormError(null);
    setDrawer({ mode: 'create' });
  };

  const openEdit = (contact: Contact) => {
    setFormError(null);
    setDrawer({ mode: 'edit', contact });
  };

  const closeDrawer = () => {
    setFormError(null);
    setDrawer({ mode: 'closed' });
  };

  const handleSubmit = async (input: ContactInput) => {
    const editing = drawer.mode === 'edit' ? drawer.contact : null;
    setFormError(null);
    try {
      await save.run(input, editing);
      await refresh();
      toast.success(editing ? 'Contact updated.' : 'Contact created.');
      setDrawer({ mode: 'closed' });
    } catch (err) {
      // Error branch: keep the modal open, surface the message.
      setFormError(err instanceof Error ? err.message : 'Could not save contact.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-green-900">Contacts</h1>
        <button type="button" className="btn-primary" onClick={openCreate}>
          New contact
        </button>
      </div>

      <div className="mb-4">
        <label htmlFor="contact-search" className="sr-only">
          Search contacts
        </label>
        <input
          id="contact-search"
          type="search"
          className="form-input"
          placeholder="Search contacts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {toast.toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`mb-4 rounded px-4 py-2 text-sm ${
            t.tone === 'error'
              ? 'bg-red-50 text-red-800'
              : 'bg-green-50 text-green-900'
          }`}
        >
          {t.message}
        </div>
      ))}

      {load.isError && (
        <p role="alert" className="form-error mb-4">
          {load.error?.message ?? 'Could not load contacts.'}
        </p>
      )}

      <ContactTable rows={filtered} loading={load.isPending && rows.length === 0} onRowClick={openEdit} />

      <Modal
        open={drawer.mode !== 'closed'}
        onClose={closeDrawer}
        title={drawer.mode === 'edit' ? 'Edit contact' : 'New contact'}
        disableBackdropClose={save.isPending}
      >
        {drawer.mode !== 'closed' && (
          <ContactForm
            contact={drawer.mode === 'edit' ? drawer.contact : undefined}
            onSubmit={handleSubmit}
            onCancel={closeDrawer}
            submitting={save.isPending}
            error={formError}
          />
        )}
      </Modal>
    </div>
  );
}

export default ContactsPage;
