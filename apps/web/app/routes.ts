import { index, route } from '@react-router/dev/routes';

/** Defines the public overview and park wait pages. */
export default [
  index('routes/dashboard.tsx'),
  route('parks/:parkId', 'routes/dashboard.tsx', { id: 'park-dashboard' }),
];
