// @vitest-environment jsdom
/**
 * TASK ADDITEM — the Add New Item editor's mechanics.
 *
 * The owner's report was, in order: "input text box is only activated when you
 * click all the way to the left of it", "it only accepts 1 character input at a
 * time after which you need to click inside the box right next to the previous
 * character", "the insertable elements have no config surface", "clicking out of
 * the modal closes it and it wipes the inputs".
 *
 * The cause of the one-character symptom was structural, and it is the reason
 * this file exists: LineEditor, ChipView and ChipPopover were declared INSIDE
 * AddElementModal's render body. A component declared in another component's
 * body is a NEW FUNCTION IDENTITY on every render, so React sees a different
 * element TYPE, unmounts the whole subtree and mounts a fresh one — the <input>
 * the author was typing into is destroyed and replaced after every keystroke.
 *
 * So the assertion that actually pins the fix is NODE IDENTITY: the same DOM
 * <input> object must still be in the document, and still be the active
 * element, after a whole sentence has been typed into it. A class name or a
 * value assertion would pass on the broken version too — the replacement input
 * carries the same classes and (for the first character) the same value.
 *
 * These run in jsdom, which has no layout engine. Anything that depends on
 * measured geometry is asserted on the STYLE CONTRACT instead, and said so.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddElementButton } from '../../src/components/app/AddElementModal';
import type { ContractField, SectionDef, TemplateStructure } from '../../src/lib/contracts';
import structureJson from './fixtures/lease-structure.json';

// The client is never reached in these tests — the modal is exercised, not the
// RPC — but importing it must not require a populated .env.
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: vi.fn() } }));

const structure: TemplateStructure = {
  template_key: 'HORSE_LEASE_V2',
  sections: (structureJson as { sections: SectionDef[] }).sections,
};

function open(fields: ContractField[] = []) {
  const onAdded = vi.fn();
  const view = render(
    <AddElementButton structure={structure} fields={fields} documentId="doc-1"
      canAddStructure canAddClause={false} onAdded={onAdded} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /add item/i }));
  return { ...view, onAdded };
}

const lineInput = () => screen.getAllByLabelText('Line text')[0] as HTMLInputElement;
// The header ✕ and the footer button share the accessible name "Close"; the
// footer one is the last in document order.
const closeBtn = () => screen.getAllByRole('button', { name: /^close$/i }).at(-1)!;

// `globals` is off in this project's vitest config, so RTL's automatic cleanup
// never registers — without this the portalled modal from the previous test is
// still in document.body and every query finds two of everything.
beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { cleanup(); });

describe('S2 — the line input survives typing', () => {
  it('keeps the SAME <input> node, focused, for a whole sentence', async () => {
    const user = userEvent.setup();
    open();
    const node = lineInput();
    node.focus();
    expect(document.activeElement).toBe(node);

    await user.keyboard('The Lessee shall provide 48 hours notice.');

    // Identity, not just content: on the broken version this node had been
    // detached after the first character and everything after it went nowhere.
    expect(screen.getAllByLabelText('Line text')[0]).toBe(node);
    expect(document.activeElement).toBe(node);
    expect(node.value).toBe('The Lessee shall provide 48 hours notice.');
  });

  it('a re-render caused by unrelated state does not replace the input', async () => {
    const user = userEvent.setup();
    open();
    const node = lineInput();
    node.focus();
    await user.keyboard('abc');
    // "Add a line" mutates the stack — the whole modal re-renders.
    await user.click(screen.getByRole('button', { name: /add a line/i }));
    expect(screen.getAllByLabelText('Line text')[0]).toBe(node);
    expect(node.value).toBe('abc');
  });
});

describe('S1 — the click target', () => {
  it('the trailing text segment grows into the rest of the row', () => {
    open();
    // jsdom does no layout, so this asserts the style CONTRACT that produces
    // the behaviour: the trailing segment is a growing flex item, which is what
    // makes the whole box hit the input rather than dead container.
    expect(lineInput().style.flex).toBe('1 1 auto');
  });

  it('a click on the container itself puts the caret in the text', () => {
    open();
    const node = lineInput();
    node.value = 'some words';
    fireEvent.change(node, { target: { value: 'some words' } });
    const box = node.parentElement as HTMLDivElement;
    fireEvent.mouseDown(box, { target: box });
    expect(document.activeElement).toBe(node);
    expect(node.selectionStart).toBe('some words'.length);
  });

  it('only the LAST text segment grows — an interior one stays content-sized', async () => {
    const user = userEvent.setup();
    open();
    const node = lineInput();
    node.focus();
    await user.keyboard('before');
    await user.click(screen.getByRole('button', { name: /text field/i }));
    const inputs = screen.getAllByLabelText('Line text') as HTMLInputElement[];
    expect(inputs.length).toBe(2);           // the segment was split by the chip
    expect(inputs[0].style.flex).toBe('');   // interior: content width
    expect(inputs[1].style.flex).toBe('1 1 auto');
  });
});

describe('S3 — the chip config surface', () => {
  it('opens, accepts a whole name, and stays open while it is edited', async () => {
    const user = userEvent.setup();
    open();
    lineInput().focus();
    await user.click(screen.getByRole('button', { name: /dropdown/i }));

    // The popover opens on insert. Its Name field is the config surface the
    // owner reported missing.
    const name = screen.getByPlaceholderText('What this asks for') as HTMLInputElement;
    await user.clear(name);          // it opens pre-filled with the default label
    await user.keyboard('Notice period');
    expect(name.value).toBe('Notice period');
    expect(document.activeElement).toBe(name);
    // Still open — the modal body no longer closes it out from under the author.
    expect(screen.getByPlaceholderText('What this asks for')).toBeTruthy();
  });

  it('working INSIDE the popover does not close it', async () => {
    const user = userEvent.setup();
    open();
    lineInput().focus();
    await user.click(screen.getByRole('button', { name: /dropdown/i }));
    // Add two menu items and rename one — several clicks and a lot of typing,
    // all inside the popover. Under the old modal-body catch-all every one of
    // these was also a "close the popover" event.
    await user.click(screen.getByRole('button', { name: /\+ menu item/i }));
    await user.click(screen.getByRole('button', { name: /\+ menu item/i }));
    const items = screen.getAllByDisplayValue(/^Option \d$/) as HTMLInputElement[];
    expect(items.length).toBe(3);
    await user.clear(items[1]);
    await user.keyboard('Weekends only');
    expect(screen.getByPlaceholderText('What this asks for')).toBeTruthy();
    expect((screen.getAllByDisplayValue('Weekends only')[0] as HTMLInputElement).value)
      .toBe('Weekends only');
  });

  it('a mousedown outside the popover does close it', async () => {
    const user = userEvent.setup();
    open();
    lineInput().focus();
    await user.click(screen.getByRole('button', { name: /buttons/i }));
    expect(screen.queryByPlaceholderText('What this asks for')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByPlaceholderText('What this asks for')).toBeNull();
  });
});

describe('S6 — closing cannot destroy authored work', () => {
  const backdrop = () => document.querySelector('.fixed.inset-0') as HTMLDivElement;

  it('a drag that STARTS inside the modal and ends on the backdrop does not close it', async () => {
    const user = userEvent.setup();
    open();
    const node = lineInput();
    node.focus();
    await user.keyboard('authored words');
    fireEvent.mouseDown(node);                                   // gesture starts inside
    fireEvent.click(backdrop(), { target: backdrop() });         // released outside
    expect(screen.queryByText('Add to this contract')).toBeTruthy();
  });

  /* ⚠️ REWRITTEN BY TASK-FIX4, AND THE INVERSION IS THE POINT. S6's rule was
     "a click that starts AND ends on the backdrop closes it" — correct under the
     rule S6 was written against, and superseded by CR-84 §5: *"any modal that
     opens doesnt close from clicking out once an input is entered into it."*
     This dialog holds a textarea, so the backdrop no longer closes it at all.
     S6's own protection (the gesture must start on the backdrop) survives in
     `ops/kit/Modal` for the dialogs that DO close on click-out. */
  it('⚠️ a click that starts AND ends on the backdrop no longer closes it — it holds a field', () => {
    open();
    const b = backdrop();
    fireEvent.mouseDown(b, { target: b });
    fireEvent.click(b, { target: b });
    expect(screen.queryByText('Add to this contract')).toBeTruthy();
  });

  it('the Close control still closes it — closing is the deliberate act now', async () => {
    const user = userEvent.setup();
    open();
    await user.click(closeBtn());
    expect(screen.queryByText('Add to this contract')).toBeNull();
  });
});

describe('S7 — the draft outlives the modal', () => {
  it('closing and reopening restores what was written', async () => {
    const user = userEvent.setup();
    open();
    const node = lineInput();
    node.focus();
    await user.keyboard('Trailering is arranged by the Lessee');
    await user.click(closeBtn());
    expect(screen.queryByText('Add to this contract')).toBeNull();

    await user.click(screen.getByRole('button', { name: /add item/i }));
    expect(lineInput().value).toBe('Trailering is arranged by the Lessee');
    expect(screen.getByText(/Picked up where you left off/)).toBeTruthy();
  });

  it('discarding the draft empties the editor and the store', async () => {
    const user = userEvent.setup();
    open();
    lineInput().focus();
    await user.keyboard('scratch');
    await user.click(closeBtn());
    await user.click(screen.getByRole('button', { name: /add item/i }));
    await user.click(screen.getByRole('button', { name: /discard draft/i }));
    expect(lineInput().value).toBe('');
    expect(window.localStorage.getItem('fhe.additem.draft.doc-1')).toBeNull();
  });

  it('an untouched editor leaves no draft behind', async () => {
    const user = userEvent.setup();
    open();
    await user.click(closeBtn());
    expect(window.localStorage.getItem('fhe.additem.draft.doc-1')).toBeNull();
  });
});

describe('S8 — items already added can be removed', () => {
  /** One authored header with one line under it, shaped exactly as
   *  add_contract_composition writes them into contract_fields. */
  const authored: ContractField[] = [
    {
      field_key: 'CUSTOM.TRAILERING_1', label: 'Trailering', section: 'SCHEDULE',
      clause_key: null, owner_role: 'DEAL', value: null, value_type: 'text',
      required: false, sort_order: 9500, can_edit: true, custom_kind: 'header',
    } as ContractField,
    {
      field_key: 'CUSTOM.LINE_2', label: null, section: 'SCHEDULE',
      clause_key: 'CUSTOM.TRAILERING_1', owner_role: 'DEAL', value: null, value_type: 'text',
      required: false, sort_order: 10, can_edit: true, custom_kind: 'line',
      body: 'Off-site transport needs {{CUSTOM.NOTICE_3}} of notice',
    } as ContractField,
  ];

  it('lists what is on the document and asks before removing it', async () => {
    const user = userEvent.setup();
    open(authored);
    expect(screen.getByText('Items you have added to this contract')).toBeTruthy();
    expect(screen.getByText('Trailering')).toBeTruthy();
    expect(screen.getByText('Off-site transport needs … of notice')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Remove Trailering/i }));
    // Nothing is removed on the first press — the confirm appears instead.
    expect(screen.getByText('Removes this item, its lines and its questions.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^keep$/i }));
    expect(screen.queryByText('Removes this item, its lines and its questions.')).toBeNull();
  });

  it('offers position-within-the-item once the chosen item has lines', () => {
    // The chosen header defaults to the first in the section; point Row 2 at the
    // authored one so its existing line is the thing to sit among.
    open(authored);
    const sectionSelect = screen.getByLabelText?.('Section') as HTMLSelectElement | undefined;
    // Row 1 is a <select> inside a <label>; drive it by display value instead.
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const sec = sectionSelect ?? selects[0];
    act(() => { fireEvent.change(sec, { target: { value: 'SCHEDULE' } }); });
    const headerSelect = (screen.getAllByRole('combobox') as HTMLSelectElement[])[1];
    act(() => { fireEvent.change(headerSelect, { target: { value: 'CUSTOM.TRAILERING_1' } }); });
    expect(screen.getByText('Where in that item')).toBeTruthy();
    expect(screen.getByText(/Before “Off-site transport needs … of notice”/)).toBeTruthy();
  });
});

describe('the button reports an unavailable surface instead of failing on save', () => {
  it('is disabled with a reason', () => {
    render(
      <AddElementButton structure={structure} fields={[]} documentId="doc-2"
        disabled disabledReason="This document is in review."
        canAddStructure canAddClause={false} onAdded={() => {}} />,
    );
    const b = screen.getByRole('button', { name: /add item/i });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(b.getAttribute('title')).toBe('This document is in review.');
  });
});
