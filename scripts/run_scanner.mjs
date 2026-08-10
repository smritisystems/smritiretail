import esbuild from 'esbuild';
import path from 'path';
import fs from 'fs';

const root = process.cwd();
const entry = path.join(root, 'src', 'modules', 'dev_tracker', 'scanner', 'scanner.ts');
const outdir = path.join(root, '.scanner_build');
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

console.log('[run_scanner] Bundling scanner with esbuild...');
await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: ['node22'],
  outfile: path.join(outdir, 'scanner.bundle.cjs'),
  sourcemap: false
});

console.log('[run_scanner] Executing bundled scanner...');
const bundledPath = path.join(outdir, 'scanner.bundle.cjs');

// Load and execute the bundled scanner
const scannerModule = await import('file://' + bundledPath);
if (typeof scannerModule.runScanner !== 'function') {
  console.error('[run_scanner] runScanner() not found in bundled module.');
  process.exit(2);
}

try {
  const result = scannerModule.runScanner();
  const outJsonPath = path.join(root, 'docs', 'reports', 'latest_raw_scan.json');
  if (!fs.existsSync(path.dirname(outJsonPath))) fs.mkdirSync(path.dirname(outJsonPath), { recursive: true });
  fs.writeFileSync(outJsonPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('[run_scanner] Raw scan result written to', outJsonPath);
  console.log('[run_scanner] DHI:', result.releaseScores?.dhi, 'Grade', result.releaseScores?.grade);
  process.exit(0);
} catch (e) {
  console.error('[run_scanner] Scanner execution failed:', e);
  process.exit(3);
}
