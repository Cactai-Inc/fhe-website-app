/**
 * Provider-aware render for UI wiring tests. Wraps the unit in the same
 * HelmetProvider + Router context the real app uses, so components that call
 * useNavigate / <Link> / useParams render exactly as they do in production.
 *
 * Auth: AuthContext is not exported, so tests that need a logged-in user mock
 * `useAuth` (vi.mock('../contexts/AuthContext', …)) or mock the supabase client.
 *
 * Usage (component test file must start with `// @vitest-environment jsdom`):
 *   import { renderWithRouter, screen, userEvent } from '../test/render';
 */
import './ui-setup';
import type { ReactElement, ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render } from '@testing-library/react';
import userEventImport from '@testing-library/user-event';

// Interop-safe: some bundler/module resolutions surface the default under `.default`.
const userEvent = ((userEventImport as unknown as { default?: typeof userEventImport })
  .default ?? userEventImport);

export * from '@testing-library/react';
export { userEvent };

type Options = {
  /** Initial URL, e.g. '/app/documents/123'. Default '/'. */
  route?: string;
  /** Route path pattern if the component reads params, e.g. '/app/documents/:id'. */
  path?: string;
};

export function renderWithRouter(ui: ReactElement, { route = '/', path }: Options = {}) {
  const wrapper = (children: ReactNode) => (
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        {path ? (
          <Routes>
            <Route path={path} element={children} />
          </Routes>
        ) : (
          children
        )}
      </MemoryRouter>
    </HelmetProvider>
  );
  return render(wrapper(ui));
}
