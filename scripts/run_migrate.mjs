/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.16
 * Created      : 2026-10-23
 * Modified     : 2026-10-23
 * Copyright    : (c) SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Cross-Platform Migration Runner (Host / Docker Auto-Discovery)
 */

import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

const extraArgs = process.argv.slice(2);

function isPythonAvailable() {
  try {
    const res = spawnSync('python', ['--version'], { encoding: 'utf-8' });
    if (res.status === 0 && res.stdout && res.stdout.includes('Python 3')) {
      return true;
    }
  } catch (err) {
    // not available
  }
  return false;
}

function isSmritiApiContainerRunning() {
  try {
    const res = spawnSync('docker', ['ps', '--filter', 'name=smriti-api', '--filter', 'status=running', '--format', '{{.Names}}'], { encoding: 'utf-8' });
    if (res.status === 0 && res.stdout && res.stdout.includes('smriti-api')) {
      return true;
    }
  } catch (err) {
    // docker not available or not running
  }
  return false;
}

if (isPythonAvailable()) {
  const autoMigratePy = path.join(workspaceRoot, 'scripts', 'auto_migrate.py');
  const child = spawn('python', [autoMigratePy, ...extraArgs], {
    stdio: 'inherit',
    cwd: workspaceRoot,
  });
  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
} else if (isSmritiApiContainerRunning()) {
  console.log('Notice: Host Python not detected. Running automated migration inside Docker container smriti-api...');
  const child = spawn('docker', ['exec', '-it', 'smriti-api', 'python', '/workspace/scripts/auto_migrate.py', ...extraArgs], {
    stdio: 'inherit',
    cwd: workspaceRoot,
  });
  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
} else {
  console.error('\n[SMRITI Migration Error]');
  console.error('Python was not found on your Windows host OS, and the Docker container "smriti-api" is not currently running.');
  console.error('\nOptions:');
  console.error('1. If running with Docker, ensure containers are active:');
  console.error('   docker compose up -d');
  console.error('2. Direct Docker execution:');
  console.error('   docker exec -it smriti-api alembic upgrade head');
  console.error('3. Install Python 3.11+ on your host and add to PATH.\n');
  process.exit(1);
}
