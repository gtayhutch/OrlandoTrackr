/** The canonical origin for production park pages. */
export const publicOrigin = 'https://orlandotrackr.com';

/** Returns the canonical path for a validated park ID. */
export function parkPath(parkId: string): string {
  return '/parks/' + encodeURIComponent(parkId);
}
