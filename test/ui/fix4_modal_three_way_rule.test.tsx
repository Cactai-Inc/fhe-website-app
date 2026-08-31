// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../src/components/ops/kit/Modal';

/**
 * TASK-FIX4 §10, criteria 1–4 at the component level.
 *
 * ⚠️ THE RULE THIS PINS, and it is the whole point of converging 17 dialogs on one
 * component: **backdrop close is decided from the LIVE DOM, not from a prop.** A
 * dialog holding a field does not close on a backdrop click; an information or
 * empty one does. No call site can get it wrong by forgetting a flag, and a
 * dialog whose fields appear on step 2 is protected on step 2.
 *
 * ⚠️ AND `onClose` MEANS CLOSE. If a future change makes any of these fire a
 * write, that is the `ContactDossierModal` defect coming back — see the header of
 * that file for the three behaviours and why this is the third.
 */

// No global setup file in this repo, so each suite unmounts its own trees. Without
// it a leaked overlay is what `document.querySelector` finds, and every assertion
// after the first is about the wrong dialog.
afterEach(cleanup);

/** The backdrop is the overlay element; clicking the panel must never close. */
function backdrop(): HTMLElement {
  const el = document.querySelector('.fixed.inset-0');
  if (!el) throw new Error('no overlay rendered');
  return el as HTMLElement;
}

/** A real backdrop gesture: mousedown AND click, both on the overlay itself. */
function clickBackdrop() {
  const el = backdrop();
  fireEvent.mouseDown(el);
  fireEvent.click(el);
}

describe('criterion 3 — the backdrop rule, decided from the live DOM', () => {
  it('an INFORMATION modal closes on a backdrop click', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Gift"><p>Nothing to type here.</p></Modal>);
    clickBackdrop();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('⚠️ a modal holding an INPUT does not close on a backdrop click', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add a horse">
        <input aria-label="Name" defaultValue="Beau" />
      </Modal>,
    );
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('⚠️ the same is true of a textarea and of a select', () => {
    const onCloseA = vi.fn();
    const { unmount } = render(
      <Modal open onClose={onCloseA} title="Void"><textarea aria-label="Note" /></Modal>,
    );
    clickBackdrop();
    expect(onCloseA).not.toHaveBeenCalled();
    unmount();

    const onCloseB = vi.fn();
    render(
      <Modal open onClose={onCloseB} title="Assign">
        <select aria-label="Person"><option>Someone</option></select>
      </Modal>,
    );
    clickBackdrop();
    expect(onCloseB).not.toHaveBeenCalled();
  });

  it('⚠️ a field that only appears on step 2 protects step 2 without a flag', () => {
    const onClose = vi.fn();
    // Rendered directly rather than through a wrapper: the point is that the
    // decision is made at click time against whatever is on screen THEN.
    const { rerender } = render(<Modal open onClose={onClose} title="Post"><p>Pick a kind</p></Modal>);
    clickBackdrop();
    expect(onClose).toHaveBeenCalledTimes(1); // step 1 — nothing to lose

    rerender(<Modal open onClose={onClose} title="Post"><textarea aria-label="Body" /></Modal>);
    clickBackdrop();
    expect(onClose).toHaveBeenCalledTimes(1); // step 2 — still 1, the click was ignored
  });

  it('a drag that STARTS inside the panel and ends on the backdrop does not close', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Gift"><p>Selectable text.</p></Modal>);
    fireEvent.mouseDown(screen.getByText('Selectable text.'));
    fireEvent.click(backdrop());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allowBackdropClose is the deliberate escape hatch (Messages’ member picker)', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="New message" allowBackdropClose>
        <input aria-label="Search members" />
      </Modal>,
    );
    clickBackdrop();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disableBackdropClose holds a field-less dialog open', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Confirm" disableBackdropClose><p>Are you sure?</p></Modal>);
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('criteria 1, 2 and 4 — the controls every dialog carries', () => {
  it('⚠️ every modal has a Close button, with or without a title', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Modal open onClose={onClose}><p>No title at all.</p></Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    render(<Modal open onClose={onClose} title="Titled"><p>Body</p></Modal>);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('⚠️ there is NO Save button — the component offers no way to render one', () => {
    render(
      <Modal open onClose={() => {}} title="Record" onClear={() => {}} saveStatus="saved">
        <input aria-label="Name" />
      </Modal>,
    );
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
  });

  it('Clear form is rendered from onClear and fires it', () => {
    const onClear = vi.fn();
    render(
      <Modal open onClose={() => {}} title="Record" onClear={onClear}>
        <input aria-label="Name" />
      </Modal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Clear form' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('⚠️ the auto-save indicator says what actually happened', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Record" saveStatus="saving"><input aria-label="N" /></Modal>,
    );
    expect(screen.getByText('Saving…')).toBeTruthy();

    rerender(<Modal open onClose={() => {}} title="Record" saveStatus="saved"><input aria-label="N" /></Modal>);
    expect(screen.getByText('Saved')).toBeTruthy();

    // An indicator that says "Saved" when nothing was saved is worse than none.
    rerender(<Modal open onClose={() => {}} title="Record" saveStatus="error"><input aria-label="N" /></Modal>);
    expect(screen.getByText('Not saved — your input is still here')).toBeTruthy();
  });

  it('⚠️ a failed save keeps the dialog open with the reason on screen', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Record" error="Could not save — your changes are still here.">
        <input aria-label="Name" defaultValue="typed" />
      </Modal>,
    );
    expect(screen.getByRole('alert').textContent).toContain('your changes are still here');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('typed');
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();
  });
});
