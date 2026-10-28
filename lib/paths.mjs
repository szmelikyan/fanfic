import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// FANFIC_DATA points the scripts at another data folder (tests use a temporary one).
export const DATA = process.env.FANFIC_DATA ? path.resolve(process.env.FANFIC_DATA) : path.join(ROOT, 'data');

/** config/config.json is optional; config/config.example.json documents the fields. */
export async function loadConfig() {
  try {
    return JSON.parse(await readFile(path.join(ROOT, 'config', 'config.json'), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * The reader whose data a command uses: `--reader <name>` (removed from args),
 * else FANFIC_READER, else "default". The default reader keeps the original folder
 * data/reader/; every other reader has data/readers/<name>/.
 */
export function takeReader(args) {
  const at = args.indexOf('--reader');
  const name = (at >= 0 ? args.splice(at, 2)[1] : process.env.FANFIC_READER) || 'default';
  const id = name.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
  if (!id) fail(`bad reader name "${name}"`);
  return { name: id, dir: id === 'default' ? path.join(DATA, 'reader') : path.join(DATA, 'readers', id) };
}

/** Print a value as JSON for the agent and exit cleanly. */
export function out(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
}

export function fail(message) {
  process.stderr.write(message + '\n');
  process.exit(1);
}
