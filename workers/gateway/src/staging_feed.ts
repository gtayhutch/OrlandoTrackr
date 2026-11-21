import { destinations } from './theme_parks';

/** Enables the synthetic provider in restricted staging. */
export const stagingSource = 'staging-fixture';

const POLL_INTERVAL_MS = 5 * 60_000;

/** Returns a fixture provider with two healthy polls followed by one outage. */
export function stagingFeed(scheduledTime: number): typeof fetch {
  const slot = Math.floor(scheduledTime / POLL_INTERVAL_MS);
  return (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const destination = destinations.find(
      ({ entityId }) => url.pathname === `/v1/entity/${entityId}/live`,
    );
    if (url.origin !== 'https://api.themeparks.wiki' || !destination) {
      throw new Error('Unexpected staging provider request');
    }
    if (slot % 3 === 2) return Promise.resolve(new Response(null, { status: 503 }));
    return Promise.resolve(
      Response.json({
        id: destination.entityId,
        liveData: Array.from({ length: 4 }, (_, index) => ({
          id: destination.entityId.slice(0, -1) + index,
          name: `Sample attraction ${index + 1}`,
          entityType: 'ATTRACTION',
          status: 'OPERATING',
          lastUpdated: new Date(scheduledTime).toISOString(),
          queue: { STANDBY: { waitTime: 10 + index * 5 + (slot % 3) } },
        })),
      }),
    );
  };
}
