// @vitest-environment jsdom
/**
 * ADMINSWEEP Phase 2 — proves the InstructorHome preview route actually mounts.
 *
 * The owner asked to SEE `InstructorHome` before ruling on it, and no account
 * exists that renders it (production `profiles.role` has zero MANAGER/EMPLOYEE
 * rows). No staff browser session is available in this environment either, so
 * this test is the substitute for clicking it: it renders the real preview
 * wrapper with the page's three data seams mocked, and asserts both halves are
 * present — the preview banner AND the actual InstructorHome content beneath.
 *
 * It also pins the two properties the preview must never lose:
 *  - it says PREVIEW unmistakably, and
 *  - it warns that the data is the viewer's, not a trainer's.
 * If someone later strips the banner to "clean it up", this fails.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import InstructorHomePreview from '../../src/pages/app/ops/InstructorHomePreview';

// InstructorHome's three real data seams. Mocked, not stubbed out: the point is
// that the page renders its own markup, so only the network is replaced.
vi.mock('../../src/lib/ops/api-lessons', () => ({
  listLessonSessions: () => Promise.resolve([]),
}));
vi.mock('../../src/lib/api', () => ({
  listContacts: () => Promise.resolve([]),
}));
/* TASK-LEADCLEAN changed this hook's return from a bare LeadEntry[] to
 * { open, converted, reload } — the converted side is what the dashboard shows
 * as history. The mock follows the real shape; InstructorHome destructures
 * `.open`, so returning an array here makes it read `.length` of undefined. */
vi.mock('../../src/lib/ops/useOpenLeads', () => ({
  useOpenLeads: () => ({ open: [], converted: [], reload: () => {} }),
}));

// vitest has no `globals: true` here, so testing-library's auto-cleanup never
// engages — the same note the other test/ui files carry.
afterEach(() => cleanup());

function renderPreview() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/app/ops/preview/instructor-home']}>
        <InstructorHomePreview />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('InstructorHome preview route', () => {
  it('mounts the real InstructorHome underneath the preview banner', () => {
    renderPreview();

    // The banner.
    expect(screen.getByTestId('instructor-preview-banner')).toBeInTheDocument();

    // InstructorHome's own content — its heading and its four action tiles.
    // If the wrapper ever stopped mounting the real page, these disappear.
    expect(screen.getByRole('heading', { name: 'Your day' })).toBeInTheDocument();
    expect(screen.getByText('Lessons')).toBeInTheDocument();
    expect(screen.getByText('Availability')).toBeInTheDocument();
    expect(screen.getByText('Requests')).toBeInTheDocument();
  });

  it('is unmistakably marked as a preview, not a live page', () => {
    renderPreview();
    expect(screen.getByText(/Preview — not a live page/i)).toBeInTheDocument();
  });

  it('warns that the data shown is the viewer’s, not a trainer’s', () => {
    renderPreview();
    expect(screen.getByText(/data is yours, not a trainer/i)).toBeInTheDocument();
  });

  it('does not link to itself from the previewed page (not an entry point)', () => {
    const { container } = renderPreview();
    const selfLinks = Array.from(container.querySelectorAll('a[href*="preview"]'));
    expect(selfLinks).toHaveLength(0);
  });
});
