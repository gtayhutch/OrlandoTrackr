import type { ReactNode } from 'react';
import { Links, Meta, Outlet, Scripts, useRouteLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { waitRequestContext } from './request_context';
import './theme.css';

/** Provides the document's CSP nonce to Vite during development. */
export function loader({ context }: LoaderFunctionArgs): { cspNonce?: string } {
  return import.meta.env.DEV ? { cspNonce: context.get(waitRequestContext).nonce } : {};
}

/** Renders the document shell and loads the route assets. */
export function Layout({ children }: { children: ReactNode }): ReactNode {
  const nonce = useRouteLoaderData<typeof loader>('root')?.cspNonce;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0b131d" />
        {nonce && <meta property="csp-nonce" nonce={nonce} />}
        <Meta />
        <Links nonce={nonce} />
      </head>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

/** Renders the selected application route. */
export default function App(): ReactNode {
  return <Outlet />;
}

/** Presents a recoverable surface when a route fails. */
export function ErrorBoundary(): ReactNode {
  return (
    <main id="content" className="route-error" tabIndex={-1}>
      <h1>Wait times are unavailable</h1>
      <p>We couldn’t load the wait board. Try again to return to the park snapshot.</p>
      <a href="/">Back to the wait board</a>
    </main>
  );
}
