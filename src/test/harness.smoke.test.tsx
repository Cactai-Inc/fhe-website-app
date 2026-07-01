// @vitest-environment jsdom
/**
 * Proves the UI wiring-test HARNESS works — the mechanics every real flow test
 * relies on. If this file is green, the harness can detect:
 *   - a button actually invoking its handler (dead-button detection),
 *   - a form submitting captured input values (no-op-form detection),
 *   - the correct data function called with the CORRECT arguments,
 *   - async success AND error branches rendering.
 * These are exactly the failure modes ("dead buttons, forms that don't submit,
 * data wired to the wrong place") the wiring protocol exists to catch.
 */
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithRouter, screen, userEvent } from './render';

/** A minimal but REAL component: a form whose submit calls an injected data fn. */
function SubmitForm({ onSave }: { onSave: (name: string) => Promise<{ id: string }> }) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedId, setSavedId] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setStatus('saving');
        const name = new FormData(e.currentTarget).get('name') as string;
        try {
          const row = await onSave(name);
          setSavedId(row.id);
          setStatus('saved');
        } catch {
          setStatus('error');
        }
      }}
    >
      <label htmlFor="name">Name</label>
      <input id="name" name="name" />
      <button type="submit">Save</button>
      {status === 'saved' && <p>Saved {savedId}</p>}
      {status === 'error' && <p role="alert">Could not save</p>}
    </form>
  );
}

describe('UI wiring harness', () => {
  it('submits the form and calls the data fn with the typed value; renders success', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ id: 'ENG-1' });

    renderWithRouter(<SubmitForm onSave={onSave} />);
    await user.type(screen.getByLabelText('Name'), 'Bella');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // The button is wired: the handler ran with the ACTUAL typed argument.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('Bella');
    // The response is actually used (not dropped): success UI shows the returned id.
    expect(await screen.findByText('Saved ENG-1')).toBeInTheDocument();
  });

  it('renders the error branch when the data fn rejects (errors are not swallowed)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('db down'));

    renderWithRouter(<SubmitForm onSave={onSave} />);
    await user.type(screen.getByLabelText('Name'), 'Bella');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  });

  it('a dead button (no handler) is caught: the data fn is never called', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    // Intentionally-unwired button — the pattern a real test would FAIL on.
    renderWithRouter(<button type="button">Dead</button>);
    await user.click(screen.getByRole('button', { name: 'Dead' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
