import { parkPath, publicOrigin } from '~/public_urls';
import { destinations } from './theme_parks';

const paths = new Set(['/', ...destinations.map(({ id }) => parkPath(id))]);

/** Allows only production's canonical pages to be indexed. */
export function isIndexablePage(url: URL, enabled?: string): boolean {
  return isPublicOrigin(url, enabled) && !url.search && paths.has(url.pathname);
}

function isPublicOrigin(url: URL, enabled?: string): boolean {
  return enabled === 'true' && url.origin === publicOrigin;
}

/** Serves the crawler policy and sitemap for the incoming origin. */
export function crawlerResponse(url: URL, enabled?: string): Response | null {
  if (url.pathname === '/robots.txt') {
    const rules = isPublicOrigin(url, enabled)
      ? `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${publicOrigin}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n';
    return new Response(rules, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
  if (url.pathname !== '/sitemap.xml' || !isPublicOrigin(url, enabled)) return null;
  const links = [...paths].map(
    (path) => `<url><loc>${publicOrigin}${path}</loc></url>`,
  );
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?>' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      links.join('') +
      '</urlset>',
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
}
