const PROVIDER_ORIGIN = 'https://api.themeparks.wiki';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const POLL_INTERVAL_MS = 5 * 60_000;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const PROVIDER_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/** Defines the provider entity and display metadata for a supported resort group. */
export interface Destination {
  id: string;
  name: string;
  locality: string;
  entityId: string;
}

/** Maps the supported groups to the provider's resort or park identifiers. */
export const destinations: readonly Destination[] = [
  {
    id: 'disney',
    name: 'Walt Disney World',
    locality: 'Lake Buena Vista',
    entityId: 'e957da41-3552-4cf6-b636-5babc5cbc4e5',
  },
  {
    id: 'universal',
    name: 'Universal Orlando',
    locality: 'Orlando',
    entityId: '89db5d43-c434-4097-b71f-f6869f495a22',
  },
  {
    id: 'seaworld',
    name: 'SeaWorld Orlando',
    locality: 'Orlando',
    entityId: '27d64dee-d85e-48dc-ad6d-8077445cd946',
  },
  {
    id: 'legoland',
    name: 'LEGOLAND Florida',
    locality: 'Winter Haven',
    entityId: 'bb285952-7e52-4a07-a312-d0a1ed91a9ac',
  },
];

/** A validated observation. Null minutes indicate an unavailable standby wait. */
export interface LiveRide {
  id: string;
  name: string;
  kind: 'Ride' | 'Show';
  minutes: number | null;
  observedAt: number;
}

/** The maximum number of live rows accepted per resort group. */
export const maxRidesPerDestination = 250;

/** Returns a bounded set of rides, or throws on an invalid provider response. */
export function parseLiveRides(
  payload: unknown,
  entityId: string,
  now: number,
): LiveRide[] {
  if (
    !isRecord(payload) ||
    payload.id !== entityId ||
    !Array.isArray(payload.liveData)
  ) {
    throw new Error('Invalid live wait payload');
  }
  const items: unknown[] = payload.liveData;
  const rides = new Map<string, LiveRide>();
  for (const item of items) {
    if (!isRecord(item) || typeof item.entityType !== 'string') {
      throw new Error('Invalid live wait item');
    }
    if (item.entityType !== 'ATTRACTION' && item.entityType !== 'SHOW') continue;
    const ride = parseRide(item, now);
    const previous = rides.get(ride.id);
    if (!previous || ride.observedAt >= previous.observedAt) rides.set(ride.id, ride);
  }
  if (rides.size === 0 || rides.size > maxRidesPerDestination) {
    throw new Error('Unexpected live attraction count');
  }
  return [...rides.values()];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRide(item: Record<string, unknown>, now: number): LiveRide {
  const { id, name, status, lastUpdated, entityType, queue } = item;
  if (
    typeof id !== 'string' ||
    !UUID.test(id) ||
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 200 ||
    typeof status !== 'string' ||
    typeof lastUpdated !== 'string' ||
    !PROVIDER_TIMESTAMP.test(lastUpdated)
  ) {
    throw new Error('Invalid live attraction');
  }
  const observedAt = Date.parse(lastUpdated);
  if (
    !Number.isFinite(observedAt) ||
    observedAt < 0 ||
    observedAt > now + POLL_INTERVAL_MS
  ) {
    throw new Error('Invalid live observation time');
  }
  const standby =
    isRecord(queue) && isRecord(queue.STANDBY) ? queue.STANDBY.waitTime : null;
  const minutes =
    status === 'OPERATING' &&
    typeof standby === 'number' &&
    Number.isInteger(standby) &&
    standby >= 0 &&
    standby <= 300
      ? standby
      : null;
  return {
    id,
    name: name.trim(),
    kind: entityType === 'SHOW' ? 'Show' : 'Ride',
    minutes,
    observedAt,
  };
}

/** Fetches the provider once and returns either validated waits or a retry time. */
export async function fetchLiveRides(
  destination: Destination,
  now: number,
  fetcher: typeof fetch,
): Promise<{ rides: LiveRide[] } | { retryAt: number }> {
  const url = new URL('/v1/entity/' + destination.entityId + '/live', PROVIDER_ORIGIN);
  const response = await fetcher(url, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    return { retryAt: retryTime(response.headers.get('retry-after'), now) };
  }
  const payload = await readJson(response);
  return { rides: parseLiveRides(payload, destination.entityId, now) };
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Missing live wait response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Live wait response too large');
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

function retryTime(retryAfter: string | null, now: number): number {
  const delay =
    retryAfter && /^\d{1,9}$/.test(retryAfter)
      ? now + Number(retryAfter) * 1_000
      : Date.parse(retryAfter ?? '');
  return Math.max(now + POLL_INTERVAL_MS, Number.isFinite(delay) ? delay : 0);
}
