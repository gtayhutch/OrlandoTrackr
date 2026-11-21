/**
 * @fileoverview Proxies the read-only staging pilot from MAIN to its Access-protected origin.
 */

interface Env {
  ORLANDOTRACKR_ORIGIN_HOST: string;
  ORLANDOTRACKR_ACCESS_CLIENT_ID: string;
  ORLANDOTRACKR_ACCESS_CLIENT_SECRET: string;
}

const allowedHosts = new Set([
  'staging.orlandotrackr.com',
  'staging-rehearsal.orlandotrackr.com',
]);
const forwardedHeaders = [
  'accept',
  'accept-language',
  'if-modified-since',
  'if-none-match',
  'if-range',
  'range',
];

function errorResponse(
  status: number,
  message: string,
  headers = new Headers(),
): Response {
  headers.set('Cache-Control', 'no-store');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return new Response(message, { status, headers });
}

/** Proxies read-only staging traffic behind the MAIN hostname's Access policy. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const publicUrl = new URL(request.url);
    if (publicUrl.protocol !== 'https:' || !allowedHosts.has(publicUrl.host)) {
      return errorResponse(404, 'Not found');
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return errorResponse(
        405,
        'Method not allowed',
        new Headers({ Allow: 'GET, HEAD' }),
      );
    }
    if (
      !/^orlandotrackr-staging\.[a-z0-9-]+\.workers\.dev$/.test(
        env.ORLANDOTRACKR_ORIGIN_HOST,
      ) ||
      !env.ORLANDOTRACKR_ACCESS_CLIENT_ID ||
      !env.ORLANDOTRACKR_ACCESS_CLIENT_SECRET
    ) {
      return errorResponse(503, 'Staging unavailable');
    }

    const originUrl = new URL('https://' + env.ORLANDOTRACKR_ORIGIN_HOST);
    originUrl.pathname = publicUrl.pathname;
    originUrl.search = publicUrl.search;
    const headers = new Headers({
      'CF-Access-Client-Id': env.ORLANDOTRACKR_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': env.ORLANDOTRACKR_ACCESS_CLIENT_SECRET,
    });
    for (const name of forwardedHeaders) {
      const value = request.headers.get(name);
      if (value !== null) headers.set(name, value);
    }

    try {
      const upstream = await fetch(originUrl, {
        method: request.method,
        headers,
        redirect: 'manual',
      });
      const responseHeaders = new Headers(upstream.headers);
      const location = responseHeaders.get('Location');
      if (location !== null) {
        const redirect = new URL(location, originUrl);
        if (redirect.origin !== originUrl.origin) {
          return errorResponse(502, 'Staging unavailable');
        }
        redirect.host = publicUrl.host;
        responseHeaders.set('Location', redirect.toString());
      }
      responseHeaders.delete('Set-Cookie');
      responseHeaders.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders,
      });
    } catch {
      return errorResponse(502, 'Staging unavailable');
    }
  },
};
