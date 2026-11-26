#!/usr/bin/env node
// Renders betterbugs.rb for one published version.
//   node render-formula.mjs <version> <out-file>
// Downloads the npm tarball for <version> (the exact bytes Homebrew will
// fetch), hashes it and fills the template next to this script.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const [version, out] = process.argv.slice(2);
if (!version || !out || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: render-formula.mjs <semver> <out-file>');
  process.exit(2);
}

const url = `https://registry.npmjs.org/@betterbugs/cli/-/cli-${version}.tgz`;
let res;
// The registry can take a moment to serve a just-published tarball.
for (let attempt = 1; attempt <= 10; attempt++) {
  res = await fetch(url);
  if (res.ok) break;
  console.error(`GET ${url} -> ${res.status} (attempt ${attempt}/10)`);
  await new Promise((r) => setTimeout(r, 15_000));
}
if (!res?.ok) {
  console.error(`Could not download ${url}`);
  process.exit(1);
}
const sha256 = createHash('sha256')
  .update(Buffer.from(await res.arrayBuffer()))
  .digest('hex');

const template = readFileSync(new URL('./betterbugs.rb', import.meta.url), 'utf8');
const formula = template.replaceAll('__VERSION__', version).replaceAll('__SHA256__', sha256);
if (/__(VERSION|SHA256)__/.test(formula)) {
  console.error('Template placeholders were left unfilled.');
  process.exit(1);
}
writeFileSync(out, formula);
console.log(`Wrote ${out} for @betterbugs/cli ${version} (sha256 ${sha256}).`);
