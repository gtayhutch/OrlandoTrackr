import type { Park, Ride, WaitSnapshot } from './waits';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPark(value: unknown): value is Park {
  return (
    isRecord(value) &&
    Object.keys(value).length === 3 &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.locality === 'string'
  );
}

function isRide(value: unknown): value is Ride {
  return (
    isRecord(value) &&
    Object.keys(value).length === 5 &&
    typeof value.id === 'string' &&
    typeof value.parkId === 'string' &&
    typeof value.name === 'string' &&
    (value.kind === 'Thrill' ||
      value.kind === 'Family' ||
      value.kind === 'Show' ||
      value.kind === 'Ride') &&
    (value.minutes === null ||
      (typeof value.minutes === 'number' &&
        Number.isInteger(value.minutes) &&
        value.minutes >= 0 &&
        value.minutes <= 300))
  );
}

function parseLiveMetadata(value: Record<string, unknown>): WaitSnapshot['live'] {
  if (Object.keys(value).length === 2) return undefined;
  const allowed = ['parks', 'rides', 'source', 'freshness', 'updatedAt'];
  const { source, freshness, updatedAt } = value;
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    source !== 'themeparks-wiki' ||
    (freshness !== 'current' &&
      freshness !== 'cached' &&
      freshness !== 'unavailable') ||
    (updatedAt != null &&
      (typeof updatedAt !== 'number' ||
        !Number.isSafeInteger(updatedAt) ||
        updatedAt < 0 ||
        updatedAt > 8.64e15))
  ) {
    throw new Error('Invalid live wait metadata');
  }
  return { freshness, updatedAt: updatedAt ?? null };
}

/** Validates the public server response before it reaches a route loader. */
export function parseWaitSnapshot(value: unknown): WaitSnapshot {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    !Array.isArray(value.data.parks) ||
    !Array.isArray(value.data.rides)
  ) {
    throw new Error('Unexpected park snapshot');
  }
  const parks: unknown[] = value.data.parks;
  const rides: unknown[] = value.data.rides;
  if (!parks.every(isPark) || !rides.every(isRide))
    throw new Error('Invalid park snapshot');
  const parkIds = new Set(parks.map((park) => park.id));
  const rideIds = new Set(rides.map((ride) => ride.id));
  if (
    parkIds.size !== parks.length ||
    rideIds.size !== rides.length ||
    rides.some((ride) => !parkIds.has(ride.parkId))
  )
    throw new Error('Invalid park references');
  const live = parseLiveMetadata(value.data);
  return live ? { parks, rides, live } : { parks, rides };
}
