/* Generates dist/sitemap.xml and dist/robots.txt from the public route list.
 * Runs after the build + prerender.
 *
 * The route list is src/lib/seo.ts ROUTE_SEO, filtered on `indexable` — the same
 * list prerender.mjs renders — so every sitemap <loc> is a prerendered file and a
 * redirect (/ride, /shop, /membership) is never advertised (TASK-SITESEO §3, §4c).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { loadSeo, indexableRoutes } from './seo-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');

const { SITE_URL, ROUTE_SEO } = await loadSeo();
const routes = indexableRoutes(ROUTE_SEO);

const today = new Date().toISOString().slice(0, 10);

const urls = routes
  .map((r) => {
    const loc = `${SITE_URL}${r.path === '/' ? '' : r.path}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${r.priority.toFixed(2).replace(/0$/, '')}</priority>\n  </url>`;
  })
  .join('\n');

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
writeFileSync(resolve(distDir, 'sitemap.xml'), sitemap);

const robots = `User-agent: *
Allow: /
Disallow: /app
Disallow: /admin
Disallow: /checkout
Disallow: /confirmation
Disallow: /login
Disallow: /register
Disallow: /account
Disallow: /order

Sitemap: ${SITE_URL}/sitemap.xml
`;
writeFileSync(resolve(distDir, 'robots.txt'), robots);

console.log('wrote dist/sitemap.xml and dist/robots.txt');
