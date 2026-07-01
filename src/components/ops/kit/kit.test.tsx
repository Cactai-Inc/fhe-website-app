// @vitest-environment jsdom
/**
 * KIT executable proof (PLATFORM_ARCHITECTURE.md §15). Renders the REAL kit
 * primitives, fires REAL clicks/submits, and asserts:
 *   (a) DataTable renders rows, invokes a row-action onClick WITH THE ROW,
 *       shows the empty state when rows=[], and the loading state.
 *   (b) ModuleGate renders children when the injected map has the key true,
 *       renders the locked fallback (NOT children) when false/absent.
 *   (c) AsyncButton/useAsync: a rejecting fn flips to error, a resolving fn to
 *       success — errors are surfaced, not swallowed.
 *   (d) Money formats 15000 -> "$15,000.00".
 *   (e) FormField shows required marker + error text.
 * Static audit: every interactive prop (row action onClick, AsyncButton
 * onClick, useAsync.run) is invoked in a test — no dead handlers.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, act, waitFor } from '../../../test/render';
import { DataTable } from './DataTable';
import { ModuleGate } from './ModuleGate';
import { AsyncButton } from './AsyncButton';
import { Money } from './Money';
import { FormField } from './FormField';
import { StatusBadge } from './StatusBadge';
import { EmptyState } from './EmptyState';
import { Modal } from './Modal';
import { renderHook } from '@testing-library/react';
import { useAsync } from '../../../lib/ops/useAsync';

type Contact = { id: string; name: string; balance: number };
const ROWS: Contact[] = [
  { id: 'C-1', name: 'Bella Ranch', balance: 15000 },
  { id: 'C-2', name: 'Cedar Farm', balance: 0 },
];

describe('DataTable', () => {
  const columns = [
    { key: 'name', header: 'Name', render: (r: Contact) => r.name },
    { key: 'bal', header: 'Balance', render: (r: Contact) => <Money amount={r.balance} /> },
  ];

  it('renders rows and invokes a row-action onClick with the FULL row object', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithRouter(
      <DataTable
        columns={columns}
        rows={ROWS}
        rowKey={(r) => r.id}
        rowActions={[{ label: 'Edit', onClick: onEdit }]}
      />,
    );

    expect(screen.getByText('Bella Ranch')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await user.click(editButtons[0]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
  });

  it('shows the empty state when rows=[]', () => {
    renderWithRouter(
      <DataTable columns={columns} rows={[]} emptyTitle="No contacts" />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No contacts')).toBeInTheDocument();
    expect(screen.queryByText('Bella Ranch')).not.toBeInTheDocument();
  });

  it('shows the loading state', () => {
    renderWithRouter(<DataTable columns={columns} rows={ROWS} loading />);
    expect(screen.getByTestId('table-loading')).toBeInTheDocument();
    // Loading takes precedence over rows.
    expect(screen.queryByText('Bella Ranch')).not.toBeInTheDocument();
  });
});

describe('ModuleGate', () => {
  it('renders children when the injected map has the key true', () => {
    renderWithRouter(
      <ModuleGate moduleKey="mod.lessons" modules={{ 'mod.lessons': true }}>
        <p>Lessons UI</p>
      </ModuleGate>,
    );
    expect(screen.getByText('Lessons UI')).toBeInTheDocument();
    expect(screen.queryByTestId('module-locked')).not.toBeInTheDocument();
  });

  it('renders the locked fallback (NOT children) when the key is false', () => {
    renderWithRouter(
      <ModuleGate moduleKey="mod.lessons" modules={{ 'mod.lessons': false }}>
        <p>Lessons UI</p>
      </ModuleGate>,
    );
    expect(screen.queryByText('Lessons UI')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
  });

  it('is fail-closed (locked) when no map is provided', () => {
    renderWithRouter(
      <ModuleGate moduleKey="mod.boarding">
        <p>Boarding UI</p>
      </ModuleGate>,
    );
    expect(screen.queryByText('Boarding UI')).not.toBeInTheDocument();
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
  });

  it('renders nothing when hideWhenLocked and the module is off', () => {
    const { container } = renderWithRouter(
      <ModuleGate moduleKey="mod.boarding" modules={{ 'mod.boarding': false }} hideWhenLocked>
        <p>Boarding UI</p>
      </ModuleGate>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('AsyncButton + useAsync', () => {
  it('flips to the success branch when the fn resolves', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn().mockResolvedValue({ id: 'X' });

    function Harness() {
      const [done, setDone] = useState(false);
      return (
        <>
          <AsyncButton
            onClick={async () => {
              await onClick();
              setDone(true);
            }}
          >
            Save
          </AsyncButton>
          {done && <p>Saved!</p>}
        </>
      );
    }

    renderWithRouter(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });

  it('flips to the error branch (surfaced, not swallowed) when the fn rejects', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn().mockRejectedValue(new Error('db down'));

    renderWithRouter(<AsyncButton onClick={onClick}>Save</AsyncButton>);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('alert')).toHaveTextContent('db down');
  });

  it('useAsync run() resolves to success and rejects to error', async () => {
    const resolving = renderHook(() => useAsync(async (n: number) => n * 2));
    let value: number | undefined;
    await act(async () => {
      value = await resolving.result.current.run(21);
    });
    expect(value).toBe(42);
    expect(resolving.result.current.isSuccess).toBe(true);
    expect(resolving.result.current.data).toBe(42);

    const rejecting = renderHook(() =>
      useAsync(async () => {
        throw new Error('boom');
      }),
    );
    await act(async () => {
      await expect(rejecting.result.current.run()).rejects.toThrow('boom');
    });
    await waitFor(() => expect(rejecting.result.current.isError).toBe(true));
    expect(rejecting.result.current.error?.message).toBe('boom');
  });
});

describe('Money', () => {
  it('formats 15000 -> "$15,000.00"', () => {
    renderWithRouter(<Money amount={15000} />);
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
  });

  it('renders the fallback for null', () => {
    renderWithRouter(<Money amount={null} fallback="n/a" />);
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });
});

describe('FormField', () => {
  it('shows the required marker and error text linked to the control', () => {
    renderWithRouter(
      <FormField label="Amount" required error="Amount is required">
        {({ id, describedBy, errorClass }) => (
          <input id={id} aria-describedby={describedBy} className={`form-input ${errorClass}`} />
        )}
      </FormField>,
    );
    // error branch renders
    expect(screen.getByRole('alert')).toHaveTextContent('Amount is required');
    // control is linked to the error via aria-describedby
    const input = screen.getByLabelText(/Amount/);
    expect(input.getAttribute('aria-describedby')).toBe(
      screen.getByRole('alert').getAttribute('id'),
    );
    expect(input.className).toContain('form-input-error');
  });
});

describe('StatusBadge / EmptyState / Modal smoke', () => {
  it('StatusBadge renders the status text', () => {
    renderWithRouter(<StatusBadge status="EXECUTED" />);
    expect(screen.getByText('EXECUTED')).toBeInTheDocument();
  });

  it('EmptyState renders title + action', () => {
    renderWithRouter(<EmptyState title="Nothing" action={<button>Add</button>} />);
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('Modal renders when open and fires onClose from the close button', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithRouter(
      <Modal open title="Confirm" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Modal renders nothing when closed', () => {
    renderWithRouter(
      <Modal open={false} onClose={() => {}}>
        <p>Hidden</p>
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
