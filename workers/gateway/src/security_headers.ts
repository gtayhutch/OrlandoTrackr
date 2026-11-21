/** Adds the response header baseline for public browser and API traffic. */
export function applySecurityHeaders(
  headers: Headers,
  nonce: string,
  indexable = false,
): void {
  headers.set(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "script-src 'nonce-" +
      nonce +
      "' 'strict-dynamic'; " +
      "style-src 'self' 'nonce-" +
      nonce +
      "'; " +
      "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  );
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (!indexable) headers.set('X-Robots-Tag', 'noindex, nofollow');
}
