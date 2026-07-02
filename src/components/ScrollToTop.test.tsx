// @vitest-environment jsdom
/**
 * ScrollToTop: every route change scrolls the window to the top; a #hash
 * navigation scrolls the anchor element into view instead.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';

function Page({ name }: { name: string }) {
  return (
    <div>
      <h1>{name}</h1>
      <Link to="/b">go b</Link>
      <Link to="/b#anchor">go b anchor</Link>
      <div id="anchor">anchor target</div>
    </div>
  );
}

function app() {
  return (
    <MemoryRouter initialEntries={['/a']}>
      <ScrollToTop />
      <Routes>
        <Route path="/a" element={<Page name="A" />} />
        <Route path="/b" element={<Page name="B" />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ScrollToTop', () => {
  it('scrolls to the top on every pathname change', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(app());
    scrollTo.mockClear(); // initial mount scroll
    await userEvent.click(screen.getAllByRole('link', { name: 'go b' })[0]);
    expect(await screen.findByRole('heading', { name: 'B' })).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('scrolls the anchor into view on #hash navigation instead of jumping to top', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const intoView = vi.fn();
    Element.prototype.scrollIntoView = intoView;
    render(app());
    scrollTo.mockClear();
    await userEvent.click(screen.getAllByRole('link', { name: 'go b anchor' })[0]);
    expect(await screen.findByRole('heading', { name: 'B' })).toBeTruthy();
    expect(intoView).toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
