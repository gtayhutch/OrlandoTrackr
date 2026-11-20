import { describe, expect, it } from 'vitest';
import { averageWait, filterRides, parseFilters } from './waits';
import type { Park, Ride } from './waits';
import { parseWaitSnapshot } from './wait_api.server';

const PARKS: Park[] = [{ id: 'demo', name: 'Demo', locality: 'Orlando' }];
const RIDES: Ride[] = [
  { id: 'alpha', parkId: 'demo', name: 'Alpha', kind: 'Thrill', minutes: 20 },
  { id: 'beta', parkId: 'demo', name: 'Beta', kind: 'Family', minutes: 0 },
  { id: 'gamma', parkId: 'demo', name: 'Gamma', kind: 'Show', minutes: null },
  { id: 'delta', parkId: 'demo', name: 'Delta', kind: 'Show', minutes: null },
];

function validFilters(query = '') {
  const filters = parseFilters(new URLSearchParams(query), PARKS);
  if (!filters) throw new Error('Expected valid filters');
  return filters;
}

describe('wait filters', () => {
  it('defaults to the shortest waits across parks', () => {
    const filters = validFilters();
    expect(filterRides(RIDES, filters).map((ride) => ride.id)).toEqual([
      'beta',
      'alpha',
      'delta',
      'gamma',
    ]);
  });

  it('sorts longest waits first and hides unavailable rides on request', () => {
    const filters = validFilters('sort=longest&park=demo&availability=open');
    expect(filterRides(RIDES, filters).map((ride) => ride.id)).toEqual([
      'alpha',
      'beta',
    ]);
  });

  it('sorts by name and filters to the selected park', () => {
    const parks = [...PARKS, { id: 'other', name: 'Other', locality: 'Orlando' }];
    const filters = parseFilters(new URLSearchParams('sort=name&park=other'), parks);
    if (!filters) throw new Error('Expected valid park filters');
    const rides = [
      ...RIDES,
      {
        id: 'extra',
        parkId: 'other',
        name: 'Zebra',
        kind: 'Family',
        minutes: 1,
      } satisfies Ride,
    ];
    expect(filterRides(rides, filters).map((ride) => ride.id)).toEqual(['extra']);
  });

  it.each([
    'park=unknown',
    'sort=fast',
    'availability=closed',
    'park=all&park=demo',
    'debug=1',
  ])('rejects invalid filter %s', (query) => {
    expect(parseFilters(new URLSearchParams(query), PARKS)).toBeNull();
  });

  it('averages all open waits and uses null when every ride is unavailable', () => {
    expect(averageWait(RIDES)).toBe(10);
    expect(averageWait(RIDES.filter((ride) => ride.minutes === null))).toBeNull();
  });

  it('uses the ride name to break a wait tie', () => {
    const duplicateWaits = RIDES.map((ride) => ({ ...ride, minutes: 10 }));
    expect(filterRides(duplicateWaits, validFilters())[0]?.id).toBe('alpha');
  });
});

describe('wait response schema', () => {
  it('accepts the expected snapshot', () => {
    expect(parseWaitSnapshot({ data: { parks: PARKS, rides: RIDES } })).toEqual({
      parks: PARKS,
      rides: RIDES,
    });
  });

  it.each([
    [null],
    [[]],
    [{ data: [] }],
    [{ data: { parks: [], rides: [], surplus: true } }],
    [{ data: { parks: {}, rides: [] } }],
    [{ data: { parks: [], rides: null } }],
    [{ data: { parks: [{ id: 'p', name: null, locality: 'x' }], rides: [] } }],
    [{ data: { parks: [{ id: 'p', name: 'x', locality: 5 }], rides: [] } }],
    [
      {
        data: {
          parks: [{ id: 'p', extra: true, name: 'x', locality: 'x' }],
          rides: [],
        },
      },
    ],
    [{ data: { parks: PARKS, rides: [{ ...RIDES[0], minutes: -1 }] } }],
    [{ data: { parks: PARKS, rides: [{ ...RIDES[0], minutes: 400 }] } }],
    [{ data: { parks: PARKS, rides: [{ ...RIDES[0], minutes: 0.5 }] } }],
    [{ data: { parks: PARKS, rides: [{ ...RIDES[0], kind: 'Other' }] } }],
    [{ data: { parks: PARKS, rides: [{ ...RIDES[0], minutes: '12' }] } }],
    [{ data: { parks: PARKS, rides: [{ ...RIDES[0], parkId: 'missing' }] } }],
    [{ data: { parks: [...PARKS, ...PARKS], rides: [] } }],
    [{ data: { parks: PARKS, rides: [...RIDES, ...RIDES] } }],
  ])('rejects malformed snapshot %#', (value) => {
    expect(() => parseWaitSnapshot(value)).toThrow();
  });
});
