import { liveSource, readLiveWaits } from './live_wait_data';

/** Reads the configured D1 view through the private container intercept. */
export async function readPublicParkWaits(
  request: Request,
  database: D1Database,
  source?: string,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname !== '/park-waits' || url.search || request.method !== 'GET') {
    return new Response(null, { status: 404 });
  }
  if (source === liveSource) return readLiveWaits(database, Date.now());
  const [parks, rides] = await Promise.all([
    database
      .prepare(
        'SELECT id, name, locality FROM parks ORDER BY display_order, id LIMIT 50',
      )
      .all(),
    database
      .prepare(
        'SELECT id, park_id AS parkId, name, kind, minutes FROM ride_waits ORDER BY name, id LIMIT 500',
      )
      .all(),
  ]);
  return Response.json({ parks: parks.results, rides: rides.results });
}
