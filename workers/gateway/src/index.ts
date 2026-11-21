import { getContainer } from '@cloudflare/containers';
import { createRequestHandler, RouterContextProvider } from 'react-router';
import { waitRequestContext } from '~/request_context';
import type { ParkApi } from './park_api';
import { ingestWaits } from './ingest_waits';
import { liveSource } from './live_wait_data';
import { applySecurityHeaders } from './security_headers';
import { readPublicParkWaits } from './park_data';
import { stagingFeed, stagingSource } from './staging_feed';

export { ContainerProxy } from '@cloudflare/containers';
export { ParkApi } from './park_api';

interface Env {
  PARK_API?: DurableObjectNamespace<ParkApi>;
  PARK_DATA: D1Database;
  LOCAL_SAMPLE_PREVIEW?: string;
  WAIT_DATA_SOURCE?: string;
  SHOW_STAGING_LABEL?: string;
}

async function fetchWaits(request: Request, env: Env): Promise<Response> {
  if (env.PARK_API) {
    const headers = { 'X-Request-Id': crypto.randomUUID() };
    return getContainer(env.PARK_API, 'public-waits').fetch(
      new Request(request.url, { method: request.method, headers }),
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
    const sampleApi =
      url.pathname === '/api/v1/park-waits' && env.WAIT_DATA_SOURCE !== liveSource;
    if (url.pathname === '/health/live') {
      const headers = { 'Cache-Control': 'no-store', Allow: 'GET, HEAD' };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response = new Response(null, { status: 405, headers });
      } else if (url.search) {
        response = new Response(null, { status: 400, headers });
      } else if (request.method === 'HEAD') {
        response = new Response(null, { headers });
      } else {
        response = Response.json({ status: 'ok' }, { headers });
      }
    } else if (sampleApi || url.pathname === '/health') {
      response = await fetchWaits(request, env);
    } else if (url.pathname === '/') {
      const context = new RouterContextProvider();
      context.set(waitRequestContext, {
        nonce,
        staging: env.SHOW_STAGING_LABEL === 'true',
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
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const now = controller.scheduledTime;
    if (env.WAIT_DATA_SOURCE === liveSource) await ingestWaits(env.PARK_DATA, now);
    if (env.WAIT_DATA_SOURCE === stagingSource && env.SHOW_STAGING_LABEL === 'true') {
      await ingestWaits(env.PARK_DATA, now, stagingFeed(now));
    }
  },
} satisfies ExportedHandler<Env>;
