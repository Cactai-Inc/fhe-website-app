// @vitest-environment jsdom
/**
 * CONTRACTSEND §1 — A DATE FIELD COMMITS THE MOMENT IT HAS A VALUE.
 *
 * The defect this pins (WALK3 F-1, reproduced in Chromium before the fix): a
 * date was the only control on the contract that could never be saved. It
 * committed on BLUR alone, and the Enter-to-commit shortcut every other input
 * honoured explicitly skipped it — `if (e.key === 'Enter' && type !== 'date')`.
 * Chrome's date field keeps focus through the whole picker interaction, so the
 * value appeared in the document and no `set_contract_field` was ever fired.
 * WALK3 proved it four ways and had to write TXN.LEASE_START straight into the
 * database to finish a lease at all.
 *
 * Committing on change is safe for a date and not for free text: a date input's
 * value is atomic (the browser reports '' until every segment is valid, then a
 * complete ISO date), so there is no half-typed state to protect — which is the
 * only reason the text path waits for blur. Both halves are asserted here, so
 * "fix the date" cannot quietly become "commit every keystroke".
 *
 * Fixtures are LIVE data: the real HORSE_LEASE_V2 structure and the 125
 * contract_fields rows of a real document, so this exercises the actual lease.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ClauseDocument } from '../../src/components/app/ClauseDocument';
import type { ContractField, SectionDef } from '../../src/lib/contracts';
import structure from './fixtures/lease-structure.json';
import fieldRows from './fixtures/averify2-fields.json';

const sections = (structure as { sections: SectionDef[] }).sections;
const fields = fieldRows as unknown as ContractField[];

function renderDoc() {
  const saves: { key: string; value: string }[] = [];
  const noop = () => {};
  const { container } = render(
    <ClauseDocument
      sections={sections}
      fields={fields}
      cb={{
        editable: true, authorView: true, myRoles: [],
        onSave: (key: string, value: string) => { saves.push({ key, value }); },
        onSaveStructured: noop, onSaveResponsibility: noop,
        onInclude: noop, onNa: noop, onControl: noop, canSetControl: false,
      } as never}
    />,
  );
  return { container, saves };
}

describe('CONTRACTSEND §1 — field commit behaviour', () => {
  it('a date fires its save on CHANGE, with no blur (WALK3 F-1)', () => {
    const { container, saves } = renderDoc();
    const date = container.querySelector<HTMLInputElement>('input[type="date"]');
    expect(date, 'the lease renders no date input at all').toBeTruthy();

    fireEvent.focus(date!);
    fireEvent.change(date!, { target: { value: '2027-03-04' } });
    // deliberately NO blur — this is exactly what WALK3 did, and what the old
    // blur-only commit turned into silence.
    expect(saves).toEqual([{ key: 'TXN.LEASE_START', value: '2027-03-04' }]);
  });

  it('the same date does not save twice when focus later leaves', () => {
    const { container, saves } = renderDoc();
    const date = container.querySelector<HTMLInputElement>('input[type="date"]')!;
    fireEvent.focus(date);
    fireEvent.change(date, { target: { value: '2027-03-04' } });
    fireEvent.blur(date);
    expect(saves).toHaveLength(1);
  });

  it('free text still waits for blur — a keystroke is not a save', () => {
    const { container, saves } = renderDoc();
    const text = [...container.querySelectorAll<HTMLInputElement>('input[type="text"]')]
      .find((i) => !i.disabled);
    expect(text, 'no enabled text input rendered').toBeTruthy();

    fireEvent.focus(text!);
    fireEvent.change(text!, { target: { value: 'half a sentence' } });
    expect(saves, 'a text field must not save mid-word').toHaveLength(0);

    fireEvent.blur(text!);
    expect(saves).toHaveLength(1);
    expect(saves[0].value).toBe('half a sentence');
  });
});
