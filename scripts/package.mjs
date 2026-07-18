import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = join(root, '.artifacts');
const staging = join(artifacts, 'scraping-lambda');
const archive = join(artifacts, 'scraping-lambda.zip');

rmSync(staging, { recursive: true, force: true });
rmSync(archive, { force: true });
mkdirSync(staging, { recursive: true });

const sourcePackage = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8'),
);
writeFileSync(
  join(staging, 'package.json'),
  JSON.stringify(
    {
      private: true,
      type: 'module',
      dependencies: sourcePackage.dependencies,
    },
    null,
    2,
  ),
);
cpSync(join(root, 'package-lock.json'), join(staging, 'package-lock.json'));

execFileSync(
  'npm',
  ['install', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'],
  { cwd: staging, stdio: 'inherit' },
);
execFileSync(
  join(root, 'node_modules', '.bin', 'esbuild'),
  [
    join(root, 'src', 'handler.ts'),
    '--bundle',
    '--platform=node',
    '--target=node24',
    '--format=esm',
    '--packages=external',
    '--sourcemap',
    `--outfile=${join(staging, 'index.js')}`,
  ],
  { cwd: root, stdio: 'inherit' },
);

// Import the exact staged entrypoint before zipping it. This catches module
// boundary failures (for example requiring an ESM-only Chromium package from a
// CommonJS bundle) that TypeScript and mocked handler tests cannot observe.
execFileSync(
  process.execPath,
  [
    '--input-type=module',
    '--eval',
    "const module = await import('./index.js'); if (typeof module.handler !== 'function') throw new Error('Lambda handler export is missing');",
  ],
  { cwd: staging, stdio: 'inherit' },
);

rmSync(join(staging, 'package-lock.json'), { force: true });
execFileSync('zip', ['-q', '-r', archive, '.'], {
  cwd: staging,
  stdio: 'inherit',
});

const compressedMegabytes = statSync(archive).size / (1024 * 1024);
if (compressedMegabytes > 250) {
  throw new Error(
    `deployment archive is unexpectedly large: ${compressedMegabytes.toFixed(1)} MiB`,
  );
}
console.log(
  `Created ${archive} (${compressedMegabytes.toFixed(1)} MiB)`,
);
