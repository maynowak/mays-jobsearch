/**
 * Generates public/sitemap.xml with all indexable pages.
 * Includes the landing page and all three public legal pages.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE_URL = 'https://www.mays-job-matcher.app';
const OUTPUT = resolve('public/sitemap.xml');

const pages = [
  { path: '/', priority: 1.0 },
  { path: '/datenschutz', priority: 0.7 },
  { path: '/impressum', priority: 0.6 },
  { path: '/datenschutzprinzipien', priority: 0.5 },
];

const lastmod = new Date().toISOString().split('T')[0];

const escapeXml = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const urlEntries = pages
  .map((page) => {
    return `  <url>
    <loc>${escapeXml(`${SITE_URL}${page.path}`)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

writeFileSync(OUTPUT, xml, 'utf8');
console.log(`Sitemap geschrieben: ${OUTPUT} (${pages.length} URLs)`);
