import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const targets = {
  staging: {
    database: '2e51b4d6-1854-416b-ba70-7c7754be50e8',
    workersDev: true,
    vars: { WAIT_DATA_SOURCE: 'staging-fixture', SHOW_STAGING_LABEL: 'true' },
  },
  production: {
    database: '3c3ecb9d-424c-43fc-97b9-1cc43a27635a',
    workersDev: false,
    vars: { WAIT_DATA_SOURCE: 'themeparks-wiki', PUBLIC_INDEXING: 'true' },
  },
};
const [target, revision] = process.argv.slice(2);
assert(Object.hasOwn(targets, target), 'A named hosted target is required.');
assert.match(revision ?? '', /^[0-9a-f]{40}$/, 'A full release commit is required.');

const configDir = 'apps/web/build/server';
const config = JSON.parse(await readFile(`${configDir}/wrangler.json`, 'utf8'));
const name = `orlandotrackr-${target}`;
const { database, vars, workersDev } = targets[target];
assert.equal(config.name, name, 'Worker target does not match.');
assert.equal(config.account_id, '007bc456dd6bf3d99bfa76f04a3eb165');
assert.equal(config.workers_dev, workersDev);
assert.equal(config.preview_urls, false);
assert.equal(config.route, undefined, 'Manage hostnames outside the release workflow.');
assert.equal(config.routes?.length ?? 0, 0);
assert.equal(
  resolve(configDir, config.assets.directory),
  resolve('apps/web/build/client'),
);
assert.deepEqual(config.vars, vars);
assert.deepEqual(
  config.d1_databases.map(({ binding, database_name, database_id }) => ({
    binding,
    database_name,
    database_id,
  })),
  [{ binding: 'PARK_DATA', database_name: name, database_id: database }],
);
assert.equal(
  resolve(configDir, config.d1_databases[0].migrations_dir),
  resolve('workers/gateway/migrations'),
);
assert.equal(config.d1_databases[0].remote, false);
assert.equal(config.containers.length, 1);
const [container] = config.containers;
assert.equal(container.name, `${name}-parkapi`);
assert.equal(container.class_name, 'ParkApi');
assert.equal(container.max_instances, 1);
assert.equal(resolve(configDir, container.image), resolve('Dockerfile'));

await writeFile('services/api/release-revision.txt', `${revision}\n`);
