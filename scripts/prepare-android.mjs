import { copyFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'www');
const webFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'icon.svg',
  'manifest.webmanifest',
  'sw.js',
  'supabase-config.js'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });
for (const file of webFiles) {
  await copyFile(path.join(root, file), path.join(webDir, file));
}
