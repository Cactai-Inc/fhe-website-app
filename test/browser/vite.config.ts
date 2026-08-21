import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/* Harness-only config: identical to vite.config.ts except that EVERY import of
   src/lib/supabase.ts — by any relative spelling — is redirected to a shim that
   serves RPC payloads captured from a real Postgres (PGlite running the repo's
   own schema). That lets the REAL ContractPage be rendered in a REAL browser
   with no production backend, because reach is proven by rendering, never by
   reading source (D17 / WALK3 F-2). */
const REAL = path.resolve(__dirname, '../../src/lib/supabase.ts');
const SHIM = path.resolve(__dirname, 'supabase-shim.ts');

export default defineConfig({
  root: path.resolve(__dirname, '../..'),
  plugins: [
    {
      name: 'harness-supabase-shim',
      enforce: 'pre',
      async resolveId(source, importer, options) {
        if (source.includes('supabase-shim')) return null;
        const r = await this.resolve(source, importer, { ...options, skipSelf: true });
        if (r && path.resolve(r.id.split('?')[0]) === REAL) return SHIM;
        return null;
      },
    },
    react(),
  ],
  optimizeDeps: { exclude: ['lucide-react'] },
});
