/** Park information attached to the synthetic public snapshot. */
export interface Park {
  id: string;
  name: string;
  locality: string;
}

/** An attraction and its sample wait in minutes, or null when unavailable. */
export interface Ride {
  id: string;
  parkId: string;
  name: string;
  kind: 'Thrill' | 'Family' | 'Show';
  minutes: number | null;
}

/** The public snapshot returned by the Axum endpoint. */
export interface WaitSnapshot {
  parks: Park[];
  rides: Ride[];
}

/** Controls the public ride list and its sort order. */
export interface WaitFilters {
  park: string;
  sort: 'shortest' | 'longest' | 'name';
  availability: 'all' | 'open';
}

/** Parses the allowed wait board controls, or returns null for invalid input. */
export function parseFilters(
  query: URLSearchParams,
  parks: readonly Park[],
): WaitFilters | null {
  const keys = [...query.keys()];
  if (
    new Set(keys).size !== keys.length ||
    keys.some((key) => !['park', 'sort', 'availability'].includes(key))
  )
    return null;

  const park = query.get('park') ?? 'all';
  const sort = query.get('sort') ?? 'shortest';
  const availability = query.get('availability') ?? 'all';
  if (
    (park !== 'all' && !parks.some((candidate) => candidate.id === park)) ||
    (sort !== 'shortest' && sort !== 'longest' && sort !== 'name') ||
    (availability !== 'all' && availability !== 'open')
  )
    return null;
  return { park, sort, availability };
}

/** Selects and sorts rides without mutating the input snapshot. */
export function filterRides(rides: readonly Ride[], filters: WaitFilters): Ride[] {
  return rides
    .filter(
      (ride) =>
        (filters.park === 'all' || ride.parkId === filters.park) &&
        (filters.availability === 'all' || ride.minutes !== null),
    )
    .sort((left, right) => {
      const byName = left.name.localeCompare(right.name, 'en-US');
      if (filters.sort === 'name') return byName;
      if (left.minutes === null) return right.minutes === null ? byName : 1;
      if (right.minutes === null) return -1;
      const difference = left.minutes - right.minutes;
      return (filters.sort === 'shortest' ? difference : -difference) || byName;
    });
}

/** Calculates the average open wait in minutes, or null when all are unavailable. */
export function averageWait(rides: readonly Ride[]): number | null {
  const waits = rides.flatMap((ride) => (ride.minutes === null ? [] : [ride.minutes]));
  return waits.length === 0
    ? null
    : Math.round(waits.reduce((sum, minutes) => sum + minutes, 0) / waits.length);
}
