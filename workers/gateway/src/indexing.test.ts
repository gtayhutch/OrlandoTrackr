import { describe, expect, it } from 'vitest';
import { crawlerResponse, isIndexablePage } from './indexing';

describe('public crawler policy', () => {
  it('limits indexing to known canonical pages on enabled production', () => {
    expect(
      isIndexablePage(new URL('https://orlandotrackr.com/parks/disney'), 'true'),
    ).toBe(true);
    for (const url of [
      'https://staging.orlandotrackr.com/parks/disney',
      'https://orlandotrackr.com/parks/unknown',
      'https://orlandotrackr.com/?park=disney',
      'https://orlandotrackr.com/api/v1/park-waits',
    ]) {
      expect(isIndexablePage(new URL(url), 'true')).toBe(false);
    }
    expect(isIndexablePage(new URL('https://orlandotrackr.com/'))).toBe(false);
  });

  it('publishes canonical URLs only on the production sitemap', async () => {
    const sitemap = crawlerResponse(
      new URL('https://orlandotrackr.com/sitemap.xml'),
      'true',
    );
    const xml = await sitemap?.text();
    expect(xml?.match(/<loc>/g)).toHaveLength(5);
    expect(xml).toContain('<loc>https://orlandotrackr.com/parks/seaworld</loc>');
    const staging = new URL('https://staging.orlandotrackr.com/');
    expect(
      await crawlerResponse(new URL('robots.txt', staging), 'true')?.text(),
    ).toContain('Disallow: /');
    expect(crawlerResponse(new URL('sitemap.xml', staging), 'true')).toBeNull();
  });
});
