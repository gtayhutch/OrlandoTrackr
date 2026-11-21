import { afterEach, describe, expect, it, vi } from 'vitest';
import router from './index';

const env = {
  ORLANDOTRACKR_ORIGIN_HOST: 'orlandotrackr-staging.pilot-example.workers.dev',
  ORLANDOTRACKR_ACCESS_CLIENT_ID: 'test-id',
  ORLANDOTRACKR_ACCESS_CLIENT_SECRET: 'test-secret',
};

afterEach(() => vi.unstubAllGlobals());

describe('OrlandoTrackr staging router', () => {
  it('forwards the path and validators using only the server-side Access credentials', async () => {
    const upstream = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('staging', {
        headers: { 'Content-Security-Policy': "default-src 'self'" },
      }),
    );
    vi.stubGlobal('fetch', upstream);
    const response = await router.fetch(
      new Request('https://staging.orlandotrackr.com/?park=all', {
        headers: {
          'If-None-Match': '"known-etag"',
          'CF-Access-Client-Secret': 'client-input',
          'CF-Access-Jwt-Assertion': 'client-input',
          'X-Forwarded-Host': 'untrusted.example',
          Cookie: 'CF_Authorization=client-input',
        },
      }),
      env,
    );
    const [url, options] = upstream.mock.calls[0] ?? [];
    expect(url).toEqual(
      new URL('https://' + env.ORLANDOTRACKR_ORIGIN_HOST + '/?park=all'),
    );
    expect(options?.redirect).toBe('manual');
    expect(Object.fromEntries(new Headers(options?.headers))).toEqual({
      'cf-access-client-id': 'test-id',
      'cf-access-client-secret': 'test-secret',
      'if-none-match': '"known-etag"',
    });
    expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'");
    expect(await response.text()).toBe('staging');
  });

  it('rejects other hostnames, writes, and invalid origin configuration before fetching', async () => {
    const upstream = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', upstream);
    expect((await router.fetch(new Request('https://example.com'), env)).status).toBe(
      404,
    );
    expect(
      (
        await router.fetch(
          new Request('https://staging.orlandotrackr.com/health', { method: 'POST' }),
          env,
        )
      ).status,
    ).toBe(405);
    expect(
      (
        await router.fetch(new Request('https://staging.orlandotrackr.com/'), {
          ...env,
          ORLANDOTRACKR_ORIGIN_HOST: 'untrusted.example',
        })
      ).status,
    ).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('rewrites same-origin redirects and keeps origin cookies and off-site redirects private', async () => {
    const upstream = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: {
            Location: '/ride-board',
            'Set-Cookie': 'CF_Authorization=origin-only',
          },
        }),
      )
      .mockResolvedValueOnce(Response.redirect('https://untrusted.example'));
    vi.stubGlobal('fetch', upstream);
    const request = new Request('https://staging-rehearsal.orlandotrackr.com/');
    const redirect = await router.fetch(request, env);
    expect(redirect.headers.get('Location')).toBe(
      'https://staging-rehearsal.orlandotrackr.com/ride-board',
    );
    expect(redirect.headers.has('Set-Cookie')).toBe(false);
    const blocked = await router.fetch(request, env);
    expect(blocked.status).toBe(502);
    expect(blocked.headers.has('Location')).toBe(false);
  });
});
