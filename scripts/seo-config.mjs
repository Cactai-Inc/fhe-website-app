/* Loads src/lib/seo.ts for the build scripts.
 *
 * The scripts are plain Node ESM and cannot import a .ts module directly, so the
 * config is bundled once with Vite's SSR mode (the same mechanism prerender.mjs
 * already uses for entry-server.tsx) and then imported. This is the ONE place the
 * route list enters the build pipeline: prerender.mjs and seo-files.mjs both call
 * loadSeo() and derive their lists from ROUTE_SEO[].indexable. There is no second
 * hardcoded route array anywhere (TASK-SITESEO §3).
 */
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

/** @returns {Promise<{ SITE_URL: string, ROUTE_SEO: Array<{ path: string, indexable: boolean, priority: number }> }>} */
export async function loadSeo() {
  await build({
    root,
    logLevel: 'warn',
    build: {
      ssr: resolve(root, 'src/lib/seo.ts'),
      outDir: resolve(root, 'dist-ssr'),
      // prerender.mjs also builds into dist-ssr; never wipe its entry-server.js.
      emptyOutDir: false,
      rollupOptions: { output: { entryFileNames: 'seo.js' } },
    },
  });
  const { SITE_URL, ROUTE_SEO } = await import(resolve(root, 'dist-ssr/seo.js'));
  return { SITE_URL, ROUTE_SEO };
}

/** The public routes a crawler may index: prerendered AND listed in sitemap.xml. */
export function indexableRoutes(ROUTE_SEO) {
  return ROUTE_SEO.filter((r) => r.indexable);
}
