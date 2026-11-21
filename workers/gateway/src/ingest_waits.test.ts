import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPlatformProxy } from 'wrangler';
import type { PlatformProxy } from 'wrangler';
import { ingestWaits } from './ingest_waits';
import { stagingFeed, stagingSource } from './staging_feed';
import { liveSource, readLiveWaits } from './live_wait_data';
import { destinations, parseLiveRides } from './theme_parks';

const START = Date.parse('2026-11-20T14:00:00Z');
const FIVE_MINUTES = 300_000;
const DAY = 86_400_000;
const ENTITY = '27d64dee-d85e-48dc-ad6d-8077445cd946';
const RIDE_ID = 'd3d9e69d-71aa-4eb4-91ba-2ceed5b30649';

function ride(date = START, waitTime = 10, status = 'OPERATING') {
  return {
    id: RIDE_ID,
    name: 'Demo ride',
    entityType: 'ATTRACTION',
    status,
    lastUpdated: new Date(date).toISOString(),
    queue: { STANDBY: { waitTime } },
  };
}

function provider(date = START, failSeaWorld = false) {
  return vi.fn<typeof fetch>((url) => {
    const href =
      typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
    const entity = destinations.find(({ entityId }) => href.includes(entityId));
    if (!entity) throw new Error('Unexpected provider URL');
    if (failSeaWorld && entity.id === 'seaworld') {
      return Promise.resolve(
        new Response(null, { status: 429, headers: { 'Retry-After': '600' } }),
      );
    }
    return Promise.resolve(
      Response.json({ id: entity.entityId, liveData: [ride(date)] }),
    );
  });
}

function expectedWaits() {
  return destinations
    .map(({ id }) => ({ parkId: id, minutes: 10 }))
    .sort((left, right) => left.parkId.localeCompare(right.parkId));
}

describe('live wait provider validation', () => {
  it('uses the latest duplicate and blanks waits on closed rides', () => {
    const liveData = [
      ride(START),
      ride(START + 10, 12, 'CLOSED'),
      { entityType: 'RESTAURANT' },
    ];
    expect(parseLiveRides({ id: ENTITY, liveData }, ENTITY, START)).toEqual([
      {
        id: RIDE_ID,
        kind: 'Ride',
        minutes: null,
        name: 'Demo ride',
        observedAt: START + 10,
      },
    ]);
  });

  it('rejects mismatched destinations and invalid or far-future observations', () => {
    const invalid = [
      { id: 'other', liveData: [ride()] },
      { id: ENTITY, liveData: [{ ...ride(), lastUpdated: 'soon' }] },
      { id: ENTITY, liveData: [ride(START + DAY)] },
    ];
    for (const payload of invalid) {
      expect(() => parseLiveRides(payload, ENTITY, START)).toThrow();
    }
  });
});

describe('scheduled ingestion into local D1', () => {
  let proxy: PlatformProxy<{ PARK_DATA: D1Database }>;
  let database: D1Database;

  beforeEach(async () => {
    proxy = await getPlatformProxy({
      configPath: 'apps/web/wrangler.preview.jsonc',
      envFiles: [],
      persist: false,
      remoteBindings: false,
    });
    database = proxy.env.PARK_DATA;
    const migration = await readFile(
      'workers/gateway/migrations/0002_live_waits.sql',
      'utf8',
    );
    await database.batch(
      migration
        .split(';')
        .filter((sql) => sql.trim())
        .map((sql) => database.prepare(sql)),
    );
  });

  afterEach(async () => {
    await proxy?.dispose();
  });

  it('publishes four groups, deduplicates observations, and expires history', async () => {
    expect(await (await readLiveWaits(database, START)).json()).toMatchObject({
      source: liveSource,
      freshness: 'unavailable',
      rides: [],
    });
    const feed = provider();
    await Promise.all([
      ingestWaits(database, START, feed),
      ingestWaits(database, START, feed),
    ]);
    expect(feed).toHaveBeenCalledTimes(4);
    expect(feed.mock.calls.every(([, options]) => options?.redirect === 'manual')).toBe(
      true,
    );
    await ingestWaits(database, START + FIVE_MINUTES, feed);
    const initial = await database
      .prepare('SELECT count(*) AS count FROM live_wait_observations')
      .first('count');
    expect(initial).toBe(4);
    expect(
      await (await readLiveWaits(database, START + FIVE_MINUTES)).json(),
    ).toMatchObject({
      source: liveSource,
      freshness: 'current',
      updatedAt: START,
      rides: expectedWaits(),
    });
    expect(await (await readLiveWaits(database, START + 2 * DAY)).json()).toMatchObject(
      {
        freshness: 'unavailable',
        rides: [],
      },
    );
    await ingestWaits(database, START + 31 * DAY, provider(START + 31 * DAY));
    const expired = await database
      .prepare(
        'SELECT count(*) AS count FROM live_wait_observations WHERE observed_at = ?',
      )
      .bind(START)
      .first('count');
    expect(expired).toBe(0);
  });

  it('keeps the previous wait during an outage and respects Retry-After', async () => {
    await ingestWaits(database, START, provider());
    const failed = provider(START + FIVE_MINUTES, true);
    await expect(ingestWaits(database, START + FIVE_MINUTES, failed)).rejects.toThrow();
    expect(
      await (await readLiveWaits(database, START + FIVE_MINUTES)).json(),
    ).toMatchObject({
      freshness: 'cached',
      rides: expectedWaits(),
    });
    const retry = provider(START + 2 * FIVE_MINUTES);
    await ingestWaits(database, START + 2 * FIVE_MINUTES, retry);
    expect(retry).toHaveBeenCalledTimes(3);
    await ingestWaits(database, START + 3 * FIVE_MINUTES, retry);
    expect(retry).toHaveBeenCalledTimes(7);
  });

  it('cycles the staging provider through a healthy poll, outage, and recovery', async () => {
    const healthy = Math.floor(START / (3 * FIVE_MINUTES)) * 3 * FIVE_MINUTES;
    const outage = healthy + 2 * FIVE_MINUTES;
    const recovery = outage + FIVE_MINUTES;
    await ingestWaits(database, healthy, stagingFeed(healthy));
    const current: { rides: unknown[] } = await (
      await readLiveWaits(database, healthy, stagingSource)
    ).json();
    expect(current).toMatchObject({
      source: stagingSource,
      freshness: 'current',
    });
    expect(current.rides).toHaveLength(16);
    await expect(ingestWaits(database, outage, stagingFeed(outage))).rejects.toThrow();
    expect(await (await readLiveWaits(database, outage, stagingSource)).json()).toEqual(
      {
        ...current,
        freshness: 'cached',
      },
    );
    await ingestWaits(database, recovery, stagingFeed(recovery));
    expect(
      await (await readLiveWaits(database, recovery, stagingSource)).json(),
    ).toMatchObject({
      source: stagingSource,
      freshness: 'current',
      updatedAt: recovery,
    });
  });
});
