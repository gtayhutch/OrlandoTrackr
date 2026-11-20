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
    (value.kind === 'Thrill' || value.kind === 'Family' || value.kind === 'Show') &&
    (value.minutes === null ||
      (typeof value.minutes === 'number' &&
        Number.isInteger(value.minutes) &&
        value.minutes >= 0 &&
        value.minutes <= 300))
  );
}

/** Validates the public server response before it reaches a route loader. */
export function parseWaitSnapshot(value: unknown): WaitSnapshot {
  if (
    !isRecord(value) ||
    !isRecord(value.data) ||
    Object.keys(value.data).length !== 2 ||
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
  return { parks, rides };
}
