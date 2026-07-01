import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

const root = document.getElementById('root')!;

const tree = (
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// If the route was prerendered to static HTML, hydrate it; otherwise mount fresh.
if (root.hasChildNodes()) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
