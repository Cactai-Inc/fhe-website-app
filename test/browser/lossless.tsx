/* HARNESS ENTRY for TASK-FIX4 §6 — "a reload mid-form restores what was typed",
 * and "browser-back likewise".
 *
 * ⚠️ THE TASK SAYS TO PROVE IT IN CHROMIUM, NOT BY READING CODE, and it is right
 * to: a reload and a browser-back are the two things jsdom cannot do. jsdom has no
 * page lifecycle, so `pagehide` never fires and the debounce flush that makes the
 * last keystrokes survive is exactly the part a jsdom test would miss.
 *
 * ⚠️ HashRouter, DELIBERATELY. The other harnesses use MemoryRouter, which has no
 * browser history at all — `goBack()` would leave the page instead of moving
 * within the app, and criterion 6 would prove nothing. Hash routes are real
 * history entries that `page.goBack()` traverses and that survive a reload,
 * and they need no server rewrite rules.
 */
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { BrandProvider } from '../../src/contexts/BrandProvider';
import SignStart from '../../src/pages/SignStart';

/** Somewhere to navigate TO, so browser-back has something to come back from.
 *  Exported only so this harness file keeps the lint baseline at 46 —
 *  `react-refresh` warns on a component in a file with no exports. */
export function Elsewhere() {
  return (
    <div style={{ padding: 40 }}>
      <h1 data-testid="elsewhere">Elsewhere</h1>
      <Link to="/sign/rider">back to the form</Link>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <HashRouter>
      <AuthProvider><BrandProvider>
        <Routes>
          <Route path="/sign/:path" element={<SignStart />} />
          <Route path="/elsewhere" element={<Elsewhere />} />
          <Route path="*" element={<Elsewhere />} />
        </Routes>
      </BrandProvider></AuthProvider>
    </HashRouter>
  </HelmetProvider>,
);
