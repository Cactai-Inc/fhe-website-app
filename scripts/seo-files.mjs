/* Generates dist/sitemap.xml and dist/robots.txt from the public route list.
 * Runs after the build + prerender.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');

// Mirrors the indexable routes in src/lib/seo.ts (ROUTE_SEO).
const SITE_URL = 'https://www.frenchheritageequestrian.com';
const routes = [
  { path: '/', priority: 1.0 },
  { path: '/services', priority: 0.9 },
  { path: '/book/rider', priority: 0.8 },
  { path: '/book/horse', priority: 0.8 },
  { path: '/book/support', priority: 0.8 },
  { path: '/about', priority: 0.7 },
];

const today = new Date().toISOString().slice(0, 10);

const urls = routes
  .map((r) => {
    const loc = `${SITE_URL}${r.path === '/' ? '' : r.path}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${r.priority.toFixed(1)}</priority>\n  </url>`;
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
