// @vitest-environment jsdom
/**
 * OWNERSHIP AFFORDANCE — the defect this pins (owner report 2026-08-06):
 * on a lease where the viewer is the LESSEE, the LESSOR-owned insurance
 * "not required" checkboxes rendered live and pointer-cursored, so they read as
 * clickable; the server then correctly refused the write, with nothing on screen
 * explaining why. Those three checkboxes are ORPHAN fields (their clause bodies
 * carry no {{token}}), and the orphan render path passed `editable={cb.editable}`
 * with no ownership guard — as did the authored custom-row path. Only the inline
 * {{token}} path applied the treatment.
 *
 * Fixtures are the LIVE data, dumped from prod: the real HORSE_LEASE_V2 template
 * structure and all 125 contract_fields rows of the AVERIFY2 test document
 * 9a56b738-36f7-4a55-a813-cdd17fe4d753 — so this exercises the actual document,
 * not a hand-made shape that might not match it.
 *
 * The cursor assertions load the app's REAL built stylesheet and read computed
 * style, because the thing under test is a cascade outcome: a `certify` checkbox
 * renders its own <label className="cursor-pointer">, which beats an inherited
 * cursor. Asserting on class names alone would pass while the UI still showed a
 * pointer. `npm run build:client` must have run; the test says so if it hasn't.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { ClauseDocument } from '../../src/components/app/ClauseDocument';
import type { ContractField, SectionDef } from '../../src/lib/contracts';
import structure from './fixtures/lease-structure.json';
import fieldRows from './fixtures/averify2-fields.json';

const sections = (structure as { sections: SectionDef[] }).sections;
const fields = fieldRows as unknown as ContractField[];

beforeAll(() => {
  const dir = path.resolve(__dirname, '../../dist/assets');
  const file = fs.existsSync(dir) ? fs.readdirSync(dir).find((f) => f.endsWith('.css')) : undefined;
  if (!file) throw new Error('no built CSS in dist/assets — run `npm run build:client` first');
  const style = document.createElement('style');
  style.textContent = fs.readFileSync(path.join(dir, file), 'utf8');
  document.head.appendChild(style);
});

const noop = () => {};
function renderAs(myRoles: string[]) {
  const { container } = render(
    <ClauseDocument
      sections={sections}
      fields={fields}
      cb={{
        editable: true,
        authorView: myRoles.length === 0,
        myRoles,
        onSave: noop, onSaveStructured: noop, onSaveResponsibility: noop,
        onInclude: noop, onNa: noop, onControl: noop, canSetControl: false,
      }}
    />,
  );
  document.body.appendChild(container);   // computed style needs to be in the document
  return container;
}

/** The rendered field whose visible text contains `text`, as its control plus
 *  the ownership wrapper (if any) around it. */
function fieldAt(container: HTMLElement, text: string) {
  const hit = [...container.querySelectorAll<HTMLElement>('label, span.inline-flex')]
    .find((el) => (el.textContent ?? '').includes(text));
  expect(hit, `nothing rendered containing: ${text}`).toBeTruthy();
  const control = hit!.querySelector<HTMLInputElement>('input, select, button');
  expect(control, `no control near: ${text}`).toBeTruthy();
  return { el: hit!, control: control!, zone: hit!.closest<HTMLElement>('[title]') };
}

const GL_LESSOR = 'General liability insurance is not required for or by either party';
const MED_LESSOR = 'Medical insurance is not required for or by either party';
const MORT_LESSOR = 'Mortality insurance is not required for or by either party';
const LESSEE_OWNED = 'Lessee is an';     // LESSEE.PARTY_TYPE — also an orphan field

describe('ownership affordance on fields the viewer cannot edit', () => {
  it('LESSEE viewing the LESSOR insurance checkboxes: inert, explained, cursor-help', () => {
    const container = renderAs(['LESSEE']);
    for (const statement of [GL_LESSOR, MED_LESSOR, MORT_LESSOR]) {
      const { el, control, zone } = fieldAt(container, statement);

      // 1. genuinely inert — no click for the server to refuse
      expect(control.disabled, `${statement} — should be disabled`).toBe(true);

      // 2. it says whose it is, in the owner's wording
      expect(zone, `${statement} — no tooltip zone`).toBeTruthy();
      expect(zone!.getAttribute('title')).toBe('This item is set by the Lessor.');

      // 3. the statement text sits inside the SAME zone as the checkbox
      expect(zone!.textContent).toContain(statement);

      // 4. never a pointer — on the box or on the label it belongs to
      expect(getComputedStyle(control).cursor).toBe('help');
      expect(getComputedStyle(el).cursor).toBe('help');
    }
  });

  it('no element anywhere inside a not-mine zone computes a pointer cursor', () => {
    const container = renderAs(['LESSEE']);
    const offenders = [...container.querySelectorAll<HTMLElement>(
      '[title^="This item is set by"] *')]
      .filter((el) => getComputedStyle(el).cursor === 'pointer')
      .map((el) => `${el.tagName}.${el.className}`);
    expect(offenders).toEqual([]);
  });

  it('mirrors for the counterparty: LESSOR sees a LESSEE-owned field as the Lessee’s', () => {
    const container = renderAs(['LESSOR']);
    const { control, zone } = fieldAt(container, LESSEE_OWNED);
    expect(control.disabled).toBe(true);
    expect(zone!.getAttribute('title')).toBe('This item is set by the Lessee.');
    expect(zone!.textContent).toContain(LESSEE_OWNED);
  });

  it('a party’s OWN field stays live and untooltipped', () => {
    const container = renderAs(['LESSOR']);
    const { control, zone } = fieldAt(container, GL_LESSOR);
    expect(control.disabled).toBe(false);
    expect(zone?.getAttribute('title') ?? '').not.toContain('This item is set by');
  });

  it('staff authoring (no myRoles) get no ownership treatment at all', () => {
    const container = renderAs([]);
    for (const statement of [GL_LESSOR, LESSEE_OWNED]) {
      const { control, zone } = fieldAt(container, statement);
      expect(control.disabled, `${statement} — author must keep editing`).toBe(false);
      expect(zone?.getAttribute('title') ?? '').not.toContain('This item is set by');
    }
  });
});
