import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import esbuild from 'esbuild';

const root = process.cwd();
const outdir = path.join(root, '.scanner_build');
const tmpOutPath = fs.mkdtempSync(path.join(os.tmpdir(), 'scanner-ci-'));

function run(cmd) {
  console.log('[ci-validate] RUNNING:', cmd);
  return execSync(cmd, { stdio: 'inherit' });
}

(async function main(){
  if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

  // 1. Run the canonical scanner (bundled via scripts/run_scanner.mjs)
  console.log('[ci-validate] Running canonical scanner in compute-only mode (no repo writes)');
  try{
    const minimalEntry = path.join(outdir, 'compute_only.entry.mjs');
    const rawScanPath = path.join(tmpOutPath, 'latest_raw_scan.json');
    const minimalSrc = `import { parseCodebase } from '${path.join(root,'src','modules','dev_tracker','scanner','parser.ts').replace(/\\/g,'/')}';\nimport { computeMetrics } from '${path.join(root,'src','modules','dev_tracker','scanner','metrics.ts').replace(/\\/g,'/')}';\nconst parsed = parseCodebase();\nconst results = computeMetrics(parsed);\nimport fs from 'fs';\nfs.writeFileSync('${rawScanPath.replace(/\\/g,'\\\\')}', JSON.stringify(results, null, 2), 'utf8');\nconsole.log('[minimal-scanner] Wrote latest_raw_scan.json');\n`;
    fs.writeFileSync(minimalEntry, minimalSrc, 'utf8');
    await esbuild.build({
      entryPoints: [minimalEntry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: ['node22'],
      outfile: path.join(outdir, 'compute_only.bundle.cjs')
    });
    run('node ' + path.join(outdir, 'compute_only.bundle.cjs'));
  }catch(e){
    console.error('[ci-validate] Failed to run canonical scanner', e);
    process.exit(10);
  }

  const rawPath = path.join(tmpOutPath, 'latest_raw_scan.json');
  if (!fs.existsSync(rawPath)) {
    console.error('[ci-validate] Raw scan JSON not found at', rawPath);
    process.exit(2);
  }
  const raw = JSON.parse(fs.readFileSync(rawPath,'utf8'));

  const mandatory = ['architectureCoverage','fingerprint','scannerHealth'];
  for(const m of mandatory){
    if(!raw[m]){
      console.error('[ci-validate] Missing mandatory field in raw scan:', m);
      process.exit(3);
    }
  }

  const reporterEntry = path.join(root, 'src', 'modules', 'dev_tracker', 'scanner', 'reporter.ts');
  const reporterBundle = path.join(outdir, 'reporter.bundle.cjs');
  console.log('[ci-validate] Bundling TypeScript reporter...');
  try{
    await esbuild.build({
      entryPoints: [reporterEntry],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: ['node22'],
      outfile: reporterBundle,
      sourcemap: false
    });
  }catch(e){
    console.error('[ci-validate] esbuild failed for reporter:', e);
    process.exit(11);
  }

  try{
    const reporterModule = await import('file://' + reporterBundle);
    if (typeof reporterModule.writeReports !== 'function') {
      console.error('[ci-validate] writeReports() not exported by bundled reporter');
      process.exit(12);
    }
    const originalCwd = process.cwd();
    process.chdir(tmpOutPath);
    try{
      reporterModule.writeReports(raw);
    }finally{
      process.chdir(originalCwd);
    }
  }catch(e){
    console.error('[ci-validate] Reporter failed to generate canonical report:', e);
    fs.rmSync(tmpOutPath, { recursive: true, force: true });
    process.exit(5);
  }

  const committedPath = path.join(root,'DEVELOPMENT_STATUS.md');
  if(!fs.existsSync(committedPath)){
    console.error('[ci-validate] Committed DEVELOPMENT_STATUS.md not found at', committedPath);
    process.exit(7);
  }
  const committed = fs.readFileSync(committedPath,'utf8');
  const generated = fs.readFileSync(path.join(tmpOutPath,'DEVELOPMENT_STATUS.md'),'utf8');

  const norm = s => s.replace(/Generated:.*\n/, '').replace(/Timestamp:.*\n/,'').replace(/\*Scanned .* in \d+ ms\..*\n/,'').replace(/\r\n/g,'\n').trim();
  const nc = norm(committed);
  const ng = norm(generated);

  if(nc !== ng){
    console.error('[ci-validate] COMMITTED DEVELOPMENT_STATUS.md does not match canonical generated report');
    const checks = ['dhi','grade','fingerprint','scannerHealth','architectureCoverage'];
    for(const c of checks){
      const inCommitted = committed.includes(c);
      const inGenerated = generated.includes(c);
      if(inCommitted && !inGenerated){
        console.error('[ci-validate] MISMATCH: committed contains', c, 'but generated does not');
      }else if(!inCommitted && inGenerated){
        console.error('[ci-validate] generated contains', c, 'but committed does not');
      }
    }
    fs.rmSync(tmpOutPath, { recursive: true, force: true });
    process.exit(6);
  }

  console.log('[ci-validate] SUCCESS: committed report matches canonical generated report');
  fs.rmSync(tmpOutPath, { recursive: true, force: true });
  process.exit(0);
})();
