// scripts/cleanup-tmp.mjs
import { stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import glob from 'glob';

// ---- CONFIG ----
const TMP_GLOB = 'tmp_*/*';           // matches all files under any tmp_* folder
const DRY_RUN = false;               // set true for a read‑only preview
const LOG_PREFIX = '[tmp‑cleanup]';

// ---- MAIN ----
async function deleteMatched() {
  const pattern = TMP_GLOB;
  const matches = await glob(pattern, { nodir: false });
  const deleted = [];

  for (const match of matches) {
    const fullPath = join(process.cwd(), match);
    try {
      const stats = await stat(fullPath);
      if (DRY_RUN) {
        console.log(`${LOG_PREFIX} (dry‑run) would delete: ${match}`);
        continue;
      }
      await unlink(fullPath);
      deleted.push(match);
    } catch (e) {
      console.warn(`${LOG_PREFIX}  ⚠️  could not delete ${match}: ${e.message}`);
    }
  }

  if (deleted.length) {
    console.log(`${LOG_PREFIX} Deleted ${deleted.length} temporary file(s):`);
    console.log(deleted.map(m => `  ${m}`).join('\n'));
  } else {
    console.log(`${LOG_PREFIX} No temporary files matched "${pattern}"`);
  }
}

deleteMatched().catch(err => {
  console.error(`${LOG_PREFIX}  ❌  Unexpected error`, err);
  process.exit(1);
});
