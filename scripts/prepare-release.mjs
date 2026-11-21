import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const targets = {
  staging: {
    database: '504f9cf8-a147-48d4-bcaf-d6c7c4923970',
    vars: { WAIT_DATA_SOURCE: 'staging-fixture', SHOW_STAGING_LABEL: 'true' },
  },
  production: {
    database: '5cdbcff8-0fb6-49ed-aa9c-d723414348f8',
    vars: { WAIT_DATA_SOURCE: 'themeparks-wiki' },
  },
};
const [target, revision] = process.argv.slice(2);
assert(Object.hasOwn(targets, target), 'A named hosted target is required.');
assert.match(revision ?? '', /^[0-9a-f]{40}$/, 'A full release commit is required.');

const configDir = 'apps/web/build/server';
const config = JSON.parse(await readFile(`${configDir}/wrangler.json`, 'utf8'));
const name = `orlandotrackr-${target}`;
const { database, vars } = targets[target];
assert.equal(config.name, name, 'Worker target does not match.');
assert.equal(config.account_id, '9fe808d792b2aa8f095351f40b89c3eb');
assert.equal(config.workers_dev, false);
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
