import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const defaultCargo = join(
  homedir(),
  '.cargo',
  'bin',
  process.platform === 'win32' ? 'cargo.exe' : 'cargo',
);
const cargo = existsSync(defaultCargo) ? defaultCargo : 'cargo';
const result = spawnSync(cargo, process.argv.slice(2), { stdio: 'inherit' });
if (result.error) {
  console.error('Cargo could not start:', result.error.message);
}
process.exitCode = result.status ?? 1;
