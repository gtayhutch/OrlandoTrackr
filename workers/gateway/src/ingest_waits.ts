import {
  claimPoll,
  expireWaitHistory,
  recordFailedPoll,
  recordSuccessfulPoll,
} from './live_wait_data';
import { destinations, fetchLiveRides } from './theme_parks';
import type { Destination } from './theme_parks';

/** Updates each group independently, then expires old observations. */
export async function ingestWaits(
  database: D1Database,
  now: number,
  fetcher: typeof fetch = (input, init) => fetch(input, init),
): Promise<void> {
  const results = await Promise.allSettled(
    destinations.map((destination) => poll(destination, database, now, fetcher)),
  );
  await expireWaitHistory(database, now);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('One or more park wait polls failed');
  }
}

async function poll(
  destination: Destination,
  database: D1Database,
  now: number,
  fetcher: typeof fetch,
): Promise<void> {
  if (!(await claimPoll(database, destination.id, now))) return;
  let result;
  try {
    result = await fetchLiveRides(destination, now, fetcher);
  } catch {
    await recordFailedPoll(database, destination.id, now, now);
    throw new Error('Park wait feed could not be read');
  }
  if ('retryAt' in result) {
    await recordFailedPoll(database, destination.id, now, result.retryAt);
    throw new Error('Park wait feed did not succeed');
  }
  await recordSuccessfulPoll(database, destination.id, now, result.rides);
}
