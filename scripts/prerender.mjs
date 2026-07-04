/* Post-build prerender of the public marketing routes.
 *
 * 1. Vite has already built the client bundle into dist/ (with index.html).
 * 2. We build a server bundle of src/entry-server.tsx with Vite's SSR mode.
 * 3. For each public route, render to HTML + head, inject into the dist template,
 *    and write dist/<route>/index.html so crawlers get real content + meta.
 *
 * The /app members area and transactional routes are NOT prerendered (they're
 * auth-gated SPA and intentionally noindex).
 */
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');

// Routes to prerender — must match the indexable paths in src/lib/seo.ts.
const ROUTES = ['/', '/about', '/story', '/faq', '/ride', '/membership', '/lessons', '/horse', '/acquisition'];

async function main() {
  // Build the SSR entry to a temporary out dir. Bundle react-helmet-async (CJS)
  // into the output so Node's ESM loader doesn't trip on its named exports.
  await build({
    root,
    logLevel: 'warn',
    ssr: { noExternal: ['react-helmet-async'] },
    build: {
      ssr: resolve(root, 'src/entry-server.tsx'),
      outDir: resolve(root, 'dist-ssr'),
      rollupOptions: { output: { entryFileNames: 'entry-server.js' } },
    },
  });

  const { render } = await import(resolve(root, 'dist-ssr/entry-server.js'));
  const template = readFileSync(resolve(distDir, 'index.html'), 'utf-8');

  for (const url of ROUTES) {
    const { html, head } = render(url);

    let out = template;
    // Inject app HTML into the root div.
    out = out.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
    // Remove the static fallback <title> + <meta description> so Helmet's per-page
    // versions are the only ones present (no duplicates for crawlers).
    out = out.replace(/<title>[\s\S]*?<\/title>/, '');
    out = out.replace(/<meta name="description"[^>]*>/, '');
    // Inject the per-page head tags before </head>.
    out = out.replace('</head>', `${head}\n</head>`);

    const outPath = url === '/'
      ? resolve(distDir, 'index.html')
      : resolve(distDir, url.replace(/^\//, ''), 'index.html');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, out);
    console.log(`prerendered ${url} -> ${outPath.replace(distDir, 'dist')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
