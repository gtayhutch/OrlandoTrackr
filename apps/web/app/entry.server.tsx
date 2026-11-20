import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter } from 'react-router';
import type { EntryContext, RouterContextProvider } from 'react-router';
import { waitRequestContext } from './request_context';

/** Streams server-rendered pages with the per-request CSP nonce. */
export default async function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  routerContext: EntryContext,
  context: RouterContextProvider,
): Promise<Response> {
  const { nonce } = context.get(waitRequestContext);
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
    { nonce, signal: request.signal },
  );
  headers.set('Content-Type', 'text/html; charset=utf-8');
  return new Response(body, { status, headers });
}
