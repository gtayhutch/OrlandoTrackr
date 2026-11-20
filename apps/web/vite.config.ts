import { cloudflare } from '@cloudflare/vite-plugin';
import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';

/** Boots the same Worker runtime for local development and SSR builds. */
export default defineConfig(({ command, mode }) => ({
  plugins: [
    cloudflare({
      configPath:
        (command === 'serve' || mode === 'local-preview') &&
        process.platform === 'win32'
          ? 'wrangler.preview.jsonc'
          : 'wrangler.jsonc',
      viteEnvironment: { name: 'ssr' },
    }),
    reactRouter(),
  ],
  resolve: { tsconfigPaths: true },
}));
