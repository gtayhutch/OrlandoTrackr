import type { Config } from '@react-router/dev/config';

/** Enables server rendering for the public park dashboard. */
export default {
  ssr: true,
  buildDirectory:
    process.env.ORLANDOTRACKR_PREVIEW_BUILD === 'true' ? 'build/preview' : 'build',
} satisfies Config;
