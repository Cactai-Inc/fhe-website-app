// @vitest-environment jsdom
/**
 * Display-time signature styling (OPS-DOC-VIEW). The stored merged_body is
 * plain text; MergedBodyView must wrap ONLY the value after a
 * "Signature:" / "By (signature):" label in a .signature-script span, leaving
 * every other line as untouched pre-wrap text.
 */
import { describe, it, expect } from 'vitest';
// test/render pulls in ui-setup (jest-dom matchers + RTL cleanup between tests).
import { render, screen } from '../../../test/render';
import { MergedBodyView } from './MergedBodyView';

const BODY =
  'RELEASE OF LIABILITY\n\nI agree to the terms.\n\n'
  + 'Signature: Jane Doe\nDate: 2026-07-02\nBy (signature): John Roe\n\n'
  + 'Signature note: not a signature line value style test\n';

describe('MergedBodyView signature script', () => {
  it('wraps both signature label values in .signature-script spans', () => {
    render(<MergedBodyView body={BODY} />);
    const pre = screen.getByTestId('merged-body').querySelector('pre')!;
    const spans = Array.from(pre.querySelectorAll('.signature-script'));
    expect(spans.map((s) => s.textContent)).toEqual(['Jane Doe', 'John Roe']);
    // The full text (labels included) is still present and unaltered.
    expect(pre.textContent).toContain('Signature: Jane Doe');
    expect(pre.textContent).toContain('By (signature): John Roe');
    expect(pre.textContent).toContain('Date: 2026-07-02');
  });

  it('does not style non-matching lines (labels must match exactly at line start)', () => {
    render(<MergedBodyView body={BODY} />);
    const pre = screen.getByTestId('merged-body').querySelector('pre')!;
    // "Signature note:" is not the "Signature:" label — no span around it.
    const spans = Array.from(pre.querySelectorAll('.signature-script'));
    expect(spans.some((s) => s.textContent?.includes('not a signature'))).toBe(false);
  });

  it('keeps the empty-state branch', () => {
    render(<MergedBodyView body={null} />);
    expect(screen.getByTestId('merged-body-empty')).toBeInTheDocument();
  });
});
