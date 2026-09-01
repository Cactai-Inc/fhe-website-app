// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../src/components/ops/kit/Modal';

/**
 * TASK-FIX4 §10, criteria 1–4 at the component level.
 * ⚠️ REWRITTEN BY TASK-MODAL2 (CR-93) — THE RULE CHANGED, NOT THE TEST'S AIM.
 *
 * ⚠️ **WHAT THIS FILE ASSERTED YESTERDAY, AND NO LONGER DOES.** TASK-FIX4 pinned
 * a THREE-WAY rule: backdrop close decided from the LIVE DOM, so a dialog holding
 * a field stayed open and an information or empty one closed, with
 * `allowBackdropClose` / `disableBackdropClose` as the two escape hatches. Four
 * assertions below said a field-less dialog CLOSES on the backdrop. **They are
 * now inverted, deliberately, and the two hatch tests are deleted rather than
 * inverted because the props they exercised no longer exist.**
 *
 * ⚠️ **THE RULE THAT REPLACED IT (TASK-MODAL2 D1).** Owner, 2026-08-31:
 * *"just make all modals only close on click of button or link, dont let them
 * close on click-out since you cant determine which ones the user can reopen and
 * which ones they cant."* **A control is the only exit — no backdrop, no Escape,
 * field or no field.** The judgement FIX4 asked the DOM to make turned out not to
 * be a DOM question at all: whether a dismissal is recoverable is knowledge the
 * component does not have. So there is nothing left to decide, and the tests that
 * pinned the decision are gone with it.
 *
 * ⚠️ This is the same move FIX4 itself made when it superseded an older
 * assertion: the file says which rule replaced which, so the next reader can tell
 * a deliberate inversion from a regression.
 *
 * ⚠️ AND `onClose` MEANS CLOSE. If a future change makes any of these fire a
 * write, that is the `ContactDossierModal` defect coming back — see the header of
 * that file for the four behaviours and why this is the fourth.
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

describe('⚠️ D1 — NOTHING BUT A CONTROL CLOSES A MODAL', () => {
  /* ⚠️ INVERTED FROM TASK-FIX4, WHICH ASSERTED `toHaveBeenCalledTimes(1)` HERE.
     *"an information modal or empty one can close on click out"* was FIX4's
     other half of the rule and the owner withdrew it: a system-triggered notice
     is the case with the WORST accidental-dismissal cost, because there may be
     no way back to it. */
  it('⚠️ an INFORMATION modal no longer closes on a backdrop click', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Gift"><p>Nothing to type here.</p></Modal>);
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();
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

  /* ⚠️ INVERTED. FIX4 asserted that step 1 closed and step 2 did not, to prove
     the decision was made at click time. There is no decision now, so what this
     pins is that neither step closes — the same test shape, the opposite claim. */
  it('⚠️ neither the empty step nor the one holding a field closes', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal open onClose={onClose} title="Post"><p>Pick a kind</p></Modal>);
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();

    rerender(<Modal open onClose={onClose} title="Post"><textarea aria-label="Body" /></Modal>);
    clickBackdrop();
    expect(onClose).not.toHaveBeenCalled();
  });

  /* FIX4's drag guard: a text selection started inside and released on the
     backdrop. It cannot close now for a stronger reason than the guard — there
     is no backdrop handler at all — but the gesture is still worth pinning. */
  it('a drag that STARTS inside the panel and ends on the backdrop does not close', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Gift"><p>Selectable text.</p></Modal>);
    fireEvent.mouseDown(screen.getByText('Selectable text.'));
    fireEvent.click(backdrop());
    expect(onClose).not.toHaveBeenCalled();
  });

  /* ⚠️ NEW IN TASK-MODAL2. FIX4 kept Escape DELIBERATELY — *"a keystroke nobody
     presses by accident"* — and flagged the choice rather than deciding it
     silently. The owner then removed the whole category. Asserted on a dialog
     WITH a field and one WITHOUT, because the old rule distinguished them and
     the new one does not. */
  it('⚠️ Escape does not close a dialog holding a field', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Add a horse">
        <input aria-label="Name" defaultValue="Beau" />
      </Modal>,
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('⚠️ Escape does not close a dialog with NO field either', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Gift"><p>Nothing to type here.</p></Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  /* ⚠️ AND THE OTHER HALF, WHICH MATTERS MORE NOW THAN IT DID: with click-out
     and Escape both gone, a dialog whose control did not render would be a trap
     with no exit. */
  it('⚠️ the Close control still works — the only way out must actually work', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose}><input aria-label="Name" /></Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

/* ⚠️ D2 — `variant` IS GONE. It had three values and 12 call sites on the two
   being removed. Owner: *"the side drawer i specd as eliminated. center modal is
   the only version to use."* The prop is not deprecated, it is absent, so this
   asserts the SHAPE rather than the prop: one overlay, centred, and a panel that
   is a rounded box at every size. */
describe('⚠️ D2 — one shape', () => {
  it('every size renders the centred box, never a sheet or a drawer', () => {
    for (const size of ['sm', 'md', 'lg', 'xl', 'full'] as const) {
      const { unmount } = render(<Modal open onClose={() => {}} size={size} title="X"><p>b</p></Modal>);
      const overlay = backdrop();
      expect(overlay.className).toContain('items-center');
      expect(overlay.className).toContain('justify-center');
      // the drawer's `justify-end` and the sheet's `items-end` are the two
      // shapes that must not come back.
      expect(overlay.className).not.toContain('justify-end');
      expect(overlay.className).not.toContain('items-end');
      const panel = screen.getByRole('dialog');
      expect(panel.className).toContain('rounded-xl');
      expect(panel.className).toContain('max-h-[90dvh]');
      expect(panel.className).not.toContain('h-full');
      unmount();
    }
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

  /* ⚠️ D3 — WHERE IT SITS IS THE ASSERTION, not just that it renders. Owner:
     *"save state is always shown up next to the close button/icon."* It used to
     be in the footer bar, which on a long dialog is off-screen at the moment a
     person wants the reassurance. */
  it('⚠️ D3 — `Saved` renders in the HEADER, beside Close, in light green', () => {
    render(
      <Modal open onClose={() => {}} title="Record" saveStatus="saved" onClear={() => {}}>
        <input aria-label="Name" />
      </Modal>,
    );
    const saved = screen.getByText('Saved');
    const close = screen.getByRole('button', { name: 'Close' });

    // beside Close: the same cluster, not merely the same document.
    expect(saved.parentElement).toBe(close.parentElement);
    // and the header, not the footer — the footer bar is where `Clear form` is.
    const clear = screen.getByRole('button', { name: 'Clear form' });
    expect(clear.parentElement!.contains(saved)).toBe(false);
    expect(saved.className).toContain('text-green-500');
  });

  it('⚠️ D3 — it clears the moment unsaved input is entered', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="Record" saveStatus="saved"><input aria-label="N" /></Modal>,
    );
    expect(screen.getByText('Saved')).toBeTruthy();
    // `saving` is what the storing hooks set on the first changed keystroke.
    rerender(<Modal open onClose={() => {}} title="Record" saveStatus="saving"><input aria-label="N" /></Modal>);
    expect(screen.queryByText('Saved')).toBeNull();
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
