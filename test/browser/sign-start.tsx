/* HARNESS ENTRY for /sign/:path — TASK-FIX1 §A.
 *
 * The REAL SignStart, in a real Chromium, so the claim "guest, rider and
 * rider+horse ask the minor question and horse and deal do not" is proven by
 * rendering it, never by reading the constant off the source (D17 / WALK3 F-2).
 *
 * The path comes from ?path= so one served bundle covers all five. The catalog
 * fetch runs against the shim and returns nothing useful, which is fine and is
 * itself faithful: the page's own catalogState==='error' branch renders "Give us
 * a call" and the FORM — the thing under test — renders regardless.
 */
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { BrandProvider } from '../../src/contexts/BrandProvider';
import SignStart from '../../src/pages/SignStart';

const path = new URLSearchParams(location.search).get('path') ?? 'rider';

createRoot(document.getElementById('root')!).render(
  <HelmetProvider>
    <MemoryRouter initialEntries={[`/sign/${path}`]}>
      <AuthProvider><BrandProvider>
        <Routes><Route path="/sign/:path" element={<SignStart />} /></Routes>
      </BrandProvider></AuthProvider>
    </MemoryRouter>
  </HelmetProvider>,
);
