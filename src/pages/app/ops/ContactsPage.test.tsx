// @vitest-environment jsdom
/**
 * OPS-CONTACTS UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL ContactsPage over a mocked api layer and proves the wiring:
 *   - listContacts() drives the table rows (real fetch → real render),
 *   - 'New contact' opens the real Modal ContactForm,
 *   - typing name+email + submitting calls createContact WITH EXACT ARGS
 *     ({ first_name, last_name, email, phone }) — no no-op form, no wrong-shape
 *     payload,
 *   - the success branch refreshes (the new row appears) + shows a toast,
 *   - the error branch (createContact rejects) renders the message AND keeps
 *     the modal open (error not swallowed).
 *
 * Static dead-end audit is discharged by these assertions: the submit handler
 * really calls the real data fn, the response is really used, and the reject
 * path really renders — none are console.log-only or dead.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';
import { ContactsPage } from './ContactsPage';
import type { Contact } from '../../../lib/ops/types';

const listContacts = vi.hoisted(() => vi.fn());
const createContact = vi.hoisted(() => vi.fn());
const updateContact = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api', () => ({ listContacts, createContact, updateContact }));

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c-1',
    display_code: 'CON-0001',
    first_name: 'Ada',
    last_name: 'Rider',
    email: 'ada@barn.test',
    phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    address_composed: null,
    date_of_birth: null,
    tags: [],
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPS-CONTACTS — ContactsPage', () => {
  it('renders the contacts returned by listContacts()', async () => {
    listContacts.mockResolvedValue([
      contact({ id: 'c-1', first_name: 'Ada', last_name: 'Rider', email: 'ada@barn.test' }),
      contact({ id: 'c-2', first_name: 'Ben', last_name: 'Trainer', email: 'ben@barn.test' }),
    ]);

    renderWithRouter(<ContactsPage />);

    expect(await screen.findByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText('Ben Trainer')).toBeInTheDocument();
    expect(listContacts).toHaveBeenCalledTimes(1);
  });

  it('opens the form, types name+email, submits → createContact called with EXACT args + success toast + refresh', async () => {
    const user = userEvent.setup();
    // First load empty; after create, the refresh returns the new row.
    listContacts
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        contact({ id: 'c-9', first_name: 'Cara', last_name: 'Groom', email: 'cara@barn.test' }),
      ]);
    createContact.mockResolvedValue(contact({ id: 'c-9', first_name: 'Cara', last_name: 'Groom' }));

    renderWithRouter(<ContactsPage />);

    // Wait for the initial (empty) load to settle.
    expect(await screen.findByText('No contacts yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New contact' }));

    // The real modal + form mounted.
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/First name/), 'Cara');
    await user.type(screen.getByLabelText(/Last name/), 'Groom');
    await user.type(screen.getByLabelText('Email'), 'cara@barn.test');

    await user.click(screen.getByRole('button', { name: 'Create contact' }));

    // EXACT payload shape lands at the real data fn.
    expect(createContact).toHaveBeenCalledTimes(1);
    expect(createContact).toHaveBeenCalledWith({
      first_name: 'Cara',
      last_name: 'Groom',
      email: 'cara@barn.test',
      phone: null,
    });

    // Success: refresh happened (second listContacts) → row appears, toast shows,
    // modal closes.
    expect(await screen.findByText('Cara Groom')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Contact created.');
    expect(listContacts).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders the error branch and KEEPS the modal open when createContact rejects', async () => {
    const user = userEvent.setup();
    listContacts.mockResolvedValue([]);
    createContact.mockRejectedValue(new Error('duplicate contact'));

    renderWithRouter(<ContactsPage />);
    await screen.findByText('No contacts yet');

    await user.click(screen.getByRole('button', { name: 'New contact' }));
    await user.type(screen.getByLabelText(/First name/), 'Cara');
    await user.click(screen.getByRole('button', { name: 'Create contact' }));

    // Error surfaced (not swallowed) AND the modal is still open.
    expect(await screen.findByRole('alert')).toHaveTextContent('duplicate contact');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createContact).toHaveBeenCalledTimes(1);
  });

  it('renders the Owner badge next to a contact tagged owner (and not otherwise)', async () => {
    listContacts.mockResolvedValue([
      contact({ id: 'c-1', first_name: 'Ada', last_name: 'Rider', tags: ['owner'] }),
      contact({ id: 'c-2', first_name: 'Ben', last_name: 'Trainer', email: 'ben@barn.test', tags: [] }),
    ]);

    renderWithRouter(<ContactsPage />);

    expect(await screen.findByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText('Ben Trainer')).toBeInTheDocument();
    // Exactly one Owner badge — on the owner-tagged row only.
    expect(screen.getAllByText('Owner')).toHaveLength(1);
  });
});
