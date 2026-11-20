import { getContainer } from '@cloudflare/containers';
import { createRequestHandler, RouterContextProvider } from 'react-router';
import { waitRequestContext } from '~/request_context';
import type { ParkApi } from './park_api';
import { applySecurityHeaders } from './security_headers';
import { readPublicParkWaits } from './park_data';

export { ContainerProxy } from '@cloudflare/containers';
export { ParkApi } from './park_api';

interface Env {
  PARK_API?: DurableObjectNamespace<ParkApi>;
  PARK_DATA: D1Database;
  LOCAL_SAMPLE_PREVIEW?: string;
}

async function fetchWaits(request: Request, env: Env): Promise<Response> {
  if (env.PARK_API) {
    const headers = new Headers(request.headers);
    headers.set('X-Request-Id', crypto.randomUUID());
    return getContainer(env.PARK_API, 'public-waits').fetch(
      new Request(request, { headers }),
    );
  }
  const url = new URL(request.url);
  if (
    env.LOCAL_SAMPLE_PREVIEW !== 'true' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname)
  ) {
    return new Response('Wait service unavailable', { status: 503 });
  }
  if (request.method !== 'GET') return new Response(null, { status: 405 });
  if (url.pathname === '/health') return Response.json({ status: 'ok' });
  if (url.search) {
    return Response.json(
      {
        error: {
          code: 'INVALID_INPUT',
          message: 'Unexpected query parameters.',
          requestId: crypto.randomUUID(),
        },
      },
      { status: 400 },
    );
  }
  const snapshot = await readPublicParkWaits(
    new Request('http://park-data.internal/park-waits'),
    env.PARK_DATA,
  );
  const data: unknown = await snapshot.json();
  return Response.json({ data });
}

const handleDocument = createRequestHandler(
  () => import('virtual:react-router/server-build'),
  import.meta.env.MODE,
);

/** Routes public wait requests to Axum and renders the web dashboard. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const nonce = crypto.randomUUID().replaceAll('-', '');
    let response: Response;
    if (url.pathname === '/api/v1/park-waits' || url.pathname === '/health') {
      response = await fetchWaits(request, env);
    } else if (url.pathname === '/') {
      const context = new RouterContextProvider();
      context.set(waitRequestContext, {
        nonce,
        loadWaits: () =>
          fetchWaits(new Request(new URL('/api/v1/park-waits', url)), env),
      });
      response = await handleDocument(request, context);
    } else {
      response = new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const headers = new Headers(response.headers);
    applySecurityHeaders(headers, nonce);
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<Env>;
