import assert from 'node:assert/strict';
import { setTimeout } from 'node:timers/promises';

const [target, revision, mode] = process.argv.slice(2);
assert(['staging', 'production'].includes(target));
assert.match(revision ?? '', /^[0-9a-f]{40}$/);
assert([undefined, 'access-only'].includes(mode));
const staging = target === 'staging';
const origin = staging
  ? 'https://staging.orlandotrackr.com'
  : 'https://orlandotrackr.com';

function request(path, headers, base = origin) {
  return fetch(new URL(path, base), {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
}

if (staging) {
  const originWorker = 'https://orlandotrackr-staging.orlandotrackr.workers.dev';
  for (const base of [origin, originWorker]) {
    for (const path of ['/', '/health/live', '/images/coaster-at-dusk.webp']) {
      const response = await request(path, undefined, base);
      const redirect = response.headers.get('location');
      assert(
        response.status === 401 ||
          response.status === 403 ||
          (response.status === 302 &&
            redirect &&
            new URL(redirect, base).pathname.startsWith('/cdn-cgi/access/')),
        `Staging Access must deny an anonymous request to ${base}${path}.`,
      );
      await response.body?.cancel();
    }
  }
}

if (mode !== 'access-only') {
  const headers = {};
  if (staging) {
    const { ACCESS_CLIENT_ID, ACCESS_CLIENT_SECRET } = process.env;
    assert(
      ACCESS_CLIENT_ID && ACCESS_CLIENT_SECRET,
      'Staging Access credentials are missing.',
    );
    headers['CF-Access-Client-Id'] = ACCESS_CLIENT_ID;
    headers['CF-Access-Client-Secret'] = ACCESS_CLIENT_SECRET;
  }

  const deadline = Date.now() + 5 * 60_000;
  let ready = false;
  do {
    const response = await request('/health', headers);
    const actualRevision = response.headers.get('x-release-revision');
    await response.text();
    assert(
      ![302, 401, 403].includes(response.status),
      'Access denied the release smoke check.',
    );
    ready = response.ok && actualRevision === revision;
    if (!ready) await setTimeout(5_000);
  } while (!ready && Date.now() < deadline);
  assert(
    ready,
    'Axum did not serve the requested release revision before the deadline.',
  );

  const liveness = await request('/health/live', headers);
  assert.equal(liveness.status, 200);
  assert.equal(liveness.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await liveness.json(), { status: 'ok' });

  const dashboard = await request('/', headers);
  assert.equal(dashboard.status, 200);
  assert.match(dashboard.headers.get('content-security-policy') ?? '', /nonce-/);
  assert.equal(dashboard.headers.get('x-content-type-options'), 'nosniff');
  if (staging) assert.match(dashboard.headers.get('x-robots-tag') ?? '', /noindex/);
  const document = await dashboard.text();
  assert.match(document, /Parks at a glance/);
  if (staging) {
    assert.match(document, /Staging · /);
    const fixtureDeadline = Date.now() + 11 * 60_000;
    let fixtureReady = false;
    do {
      const waits = await request('/api/v1/park-waits', headers);
      assert.equal(waits.status, 200);
      const { data } = await waits.json();
      assert.equal(data.source, 'staging-fixture');
      assert.equal(data.parks.length, 4);
      fixtureReady = data.rides.length === 16;
      if (!fixtureReady) await setTimeout(30_000);
    } while (!fixtureReady && Date.now() < fixtureDeadline);
    assert(fixtureReady, 'The scheduled staging feed did not load its 16 fixtures.');
  }
}
