import { destinations, maxRidesPerDestination } from './theme_parks';
import type { LiveRide } from './theme_parks';

const HOUR_MS = 60 * 60_000;
const FRESHNESS_WINDOW_MS = 15 * 60_000;
const CACHE_WINDOW_MS = 24 * HOUR_MS;
const HISTORY_WINDOW_MS = 30 * CACHE_WINDOW_MS;
const HISTORY_DELETE_LIMIT = 2_000;

/** The configuration value that enables the live snapshot and scheduled polls. */
export const liveSource = 'themeparks-wiki';

interface Poll {
  parkId: string;
  attemptedAt: number;
  succeededAt: number | null;
  observedAt: number | null;
}

interface StoredRide {
  id: string;
  parkId: string;
  name: string;
  kind: string;
  minutes: number | null;
}

/** Claims one attempt per destination and scheduled time outside the retry window. */
export async function claimPoll(
  database: D1Database,
  parkId: string,
  now: number,
): Promise<boolean> {
  const row = await database
    .prepare(
      `INSERT INTO live_park_polls (park_id, attempted_at) VALUES (?1, ?2)
       ON CONFLICT (park_id) DO UPDATE SET attempted_at = ?2, retry_at = NULL
       WHERE live_park_polls.attempted_at < ?2
         AND (live_park_polls.retry_at IS NULL OR live_park_polls.retry_at <= ?2)
       RETURNING park_id`,
    )
    .bind(parkId, now)
    .first();
  return row !== null;
}

/** Records a failed attempt without replacing the last good waits. */
export async function recordFailedPoll(
  database: D1Database,
  parkId: string,
  now: number,
  retryAt: number,
): Promise<void> {
  await database
    .prepare(
      `UPDATE live_park_polls SET retry_at = ?3 WHERE park_id = ?1 AND attempted_at = ?2`,
    )
    .bind(parkId, now, retryAt)
    .run();
}

/** Stores the current rides and new observations in one atomic D1 batch. */
export async function recordSuccessfulPoll(
  database: D1Database,
  parkId: string,
  now: number,
  rides: readonly LiveRide[],
): Promise<void> {
  const observedAt = Math.max(...rides.map((ride) => ride.observedAt));
  const rows = JSON.stringify(rides);
  await database.batch([
    database
      .prepare(
        `UPDATE live_park_polls SET succeeded_at = ?2, observed_at = ?3
       WHERE park_id = ?1 AND attempted_at = ?2`,
      )
      .bind(parkId, now, observedAt),
    database
      .prepare(
        `DELETE FROM live_ride_waits WHERE park_id = ?1
         AND id NOT IN (SELECT value ->> '$.id' FROM json_each(?3))
         AND EXISTS (SELECT 1 FROM live_park_polls
           WHERE park_id = ?1 AND attempted_at = ?2 AND succeeded_at = ?2)`,
      )
      .bind(parkId, now, rows),
    database
      .prepare(
        `INSERT INTO live_ride_waits (park_id, id, name, kind, minutes, observed_at)
       SELECT ?1, value ->> '$.id', value ->> '$.name', value ->> '$.kind',
         value ->> '$.minutes', value ->> '$.observedAt'
       FROM json_each(?3)
       WHERE EXISTS (SELECT 1 FROM live_park_polls
         WHERE park_id = ?1 AND attempted_at = ?2 AND succeeded_at = ?2)
       ON CONFLICT (park_id, id) DO UPDATE SET name = excluded.name, kind = excluded.kind,
         minutes = excluded.minutes, observed_at = excluded.observed_at
       WHERE excluded.observed_at > live_ride_waits.observed_at`,
      )
      .bind(parkId, now, rows),
    database
      .prepare(
        `INSERT INTO live_wait_observations (park_id, ride_id, observed_at, minutes)
       SELECT ?1, value ->> '$.id', value ->> '$.observedAt', value ->> '$.minutes'
       FROM json_each(?2) WHERE (value ->> '$.observedAt') >= ?3
       ON CONFLICT (park_id, ride_id, observed_at) DO NOTHING`,
      )
      .bind(parkId, rows, now - HISTORY_WINDOW_MS),
  ]);
}

/** Discards expired observations in a bounded write each poll. */
export async function expireWaitHistory(
  database: D1Database,
  now: number,
): Promise<void> {
  await database
    .prepare(
      `DELETE FROM live_wait_observations WHERE rowid IN (
       SELECT rowid FROM live_wait_observations WHERE observed_at < ?
       ORDER BY observed_at LIMIT ?
     )`,
    )
    .bind(now - HISTORY_WINDOW_MS, HISTORY_DELETE_LIMIT)
    .run();
}

/** Returns the current product view and freshness, omitting expired cached waits. */
export async function readLiveWaits(
  database: D1Database,
  now: number,
): Promise<Response> {
  const cutoff = now - CACHE_WINDOW_MS;
  const [pollResult, rides] = await database.batch<Poll | StoredRide>([
    database
      .prepare(
        `SELECT park_id AS parkId, attempted_at AS attemptedAt, succeeded_at AS succeededAt,
         observed_at AS observedAt FROM live_park_polls LIMIT ?`,
      )
      .bind(destinations.length),
    database
      .prepare(
        `SELECT waits.park_id || ':' || waits.id AS id, waits.park_id AS parkId,
         waits.name, waits.kind, waits.minutes
       FROM live_ride_waits waits JOIN live_park_polls polls ON polls.park_id = waits.park_id
       WHERE polls.succeeded_at >= ?1 AND waits.observed_at >= ?1
       ORDER BY waits.name, waits.id, waits.park_id LIMIT ?2`,
      )
      .bind(cutoff, maxRidesPerDestination * destinations.length),
  ]);
  if (!pollResult || !rides)
    throw new Error('Live snapshot query did not return both results');
  const visible = pollResult.results
    .filter((row) => 'succeededAt' in row)
    .filter((poll) => poll.succeededAt !== null && poll.succeededAt >= cutoff);
  const fresh =
    visible.length === destinations.length &&
    visible.every(
      (poll) =>
        poll.succeededAt === poll.attemptedAt &&
        (poll.observedAt ?? 0) >= now - FRESHNESS_WINDOW_MS,
    );
  return Response.json({
    parks: destinations.map(({ id, name, locality }) => ({ id, name, locality })),
    rides: rides.results,
    source: liveSource,
    freshness:
      rides.results.length === 0 ? 'unavailable' : fresh ? 'current' : 'cached',
    updatedAt: visible
      .flatMap((poll) => poll.observedAt ?? [])
      .reduce<number | null>(
        (oldest, when) => (oldest === null ? when : Math.min(oldest, when)),
        null,
      ),
  });
}
