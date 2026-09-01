import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
/* Vercel Web Analytics. ⚠️ The `/next` entry point does NOT apply here — this is
   a Vite + React app, so the framework-agnostic React export is the correct one. */
import { Analytics } from '@vercel/analytics/react';
import App from './App.tsx';
import './index.css';

const root = document.getElementById('root')!;

const tree = (
  <StrictMode>
    <HelmetProvider>
      <App />
      <Analytics />
    </HelmetProvider>
  </StrictMode>
);

// If the route was prerendered to static HTML, hydrate it; otherwise mount fresh.
if (root.hasChildNodes()) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
