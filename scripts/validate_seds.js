/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Script       : SEDS CI/CD Legacy UI Enforcement Linter (Node.js)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 * Classification: Internal CI/CD Governance Linter
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, '..', 'src', 'components');

const PROHIBITED_PATTERNS = [
  /bg-slate-[0-9]+(\/[0-9]+)?/g,
  /text-slate-[0-9]+(\/[0-9]+)?/g,
  /border-slate-[0-9]+(\/[0-9]+)?/g,
  /ring-slate-[0-9]+(\/[0-9]+)?/g,
  /divide-slate-[0-9]+(\/[0-9]+)?/g,
  /from-slate-[0-9]+(\/[0-9]+)?/g,
  /to-slate-[0-9]+(\/[0-9]+)?/g,
  /via-slate-[0-9]+(\/[0-9]+)?/g,
];

const EXCLUDED_SUBPATHS = [
  'website', // Public marketing website product is an independent product tier per AOP-002
];

function scanDirectory(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDirectory(filePath, fileList);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function main() {
  console.log('======================================================================');
  console.log(' SMRITI Enterprise Design System (SEDS) CI/CD Governance Linter');
  console.log('======================================================================');

  const files = scanDirectory(TARGET_DIR);
  let totalViolations = 0;
  const violatingFiles = new Set();

  for (const filePath of files) {
    const relPath = path.relative(TARGET_DIR, filePath);
    if (EXCLUDED_SUBPATHS.some((exc) => relPath.startsWith(exc))) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      PROHIBITED_PATTERNS.forEach((pattern) => {
        pattern.lastIndex = 0;
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            totalViolations++;
            violatingFiles.add(relPath);
            console.log(`❌ [SEDS-VIOLATION] ${relPath}:${index + 1} -> Found '${match}'`);
            console.log(`   Snippet: ${line.trim().substring(0, 100)}`);
          });
        }
      });
    });
  }

  console.log('\n----------------------------------------------------------------------');
  console.log(`Total Prohibited Legacy Slate Violations: ${totalViolations}`);
  console.log(`Total Violating Files: ${violatingFiles.size}`);
  console.log('----------------------------------------------------------------------');

  if (totalViolations > 0) {
    console.log('\n❌ CI/CD RELEASE GATE FAILED: SEDS legacy token violations detected!');
    process.exit(1);
  } else {
    console.log('\n✅ CI/CD RELEASE GATE PASSED: Zero legacy UI slate violations found!');
    process.exit(0);
  }
}

main();
