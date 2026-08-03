#!/usr/bin/env node
/**
 * SEEF-TRP2: Undefined CSS Variable Scanner
 * ==========================================
 * Scans .tsx/.ts/.css files in src/ for var(--c-*) / var(--sds-*) / var(--sxp-*)
 * references and checks them against declared token namespaces.
 *
 * Usage:  node scripts/scan_undefined_vars.js
 * Gate:   Exit code 1 if any undefined variables found (CI use).
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, extname, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC  = join(ROOT, "src");

// 1. Collect declared CSS custom properties from token files
const TOKEN_FILES = [
  "src/styles/smriti-tokens.css",
  "src/styles/smriti-theme-dark.css",
  "src/styles/smriti-theme-light.css",
  "src/styles/smriti-theme-fiori-lite.css",
  "src/styles/sxp-tokens.css",
  "src/styles/motion-tokens.css",
  "src/index.css",
];

const declared = new Set();
for (const rel of TOKEN_FILES) {
  try {
    const src = readFileSync(join(ROOT, rel), "utf8");
    for (const m of src.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
      declared.add(`--${m[1]}`);
    }
  } catch { console.warn(`  warn: Could not read ${rel}`); }
}

console.log(`\nSEEF-TRP2 Undefined CSS Variable Scanner`);
console.log(`Token namespace size: ${declared.size} declared vars\n`);

// 2. Walk src and collect usages
const usages = new Map();
function walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    const st  = statSync(abs);
    if (st.isDirectory()) {
      if (!["node_modules","dist",".git","__pycache__"].includes(entry)) walkDir(abs);
      continue;
    }
    if (![".tsx",".ts",".css",".js"].includes(extname(entry))) continue;
    const lines = readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, i) => {
      const re = /var\((--(?:c|sxp|sds)-[a-zA-Z0-9_-]+)(?:[,)])/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        const v = m[1];
        if (!usages.has(v)) usages.set(v, []);
        usages.get(v).push(`${abs.replace(ROOT,"").replace(/\\/g,"/")}:${i+1}`);
      }
    });
  }
}
walkDir(SRC);

// 3. Known runtime aliases (Tailwind @theme bridge / inline style tokens)
const KNOWN = new Set([
  // SEEF v2 Tailwind @theme bridge / inline style tokens
  "--c-theme-surface-1","--c-theme-surface-2","--c-theme-surface-3",
  "--c-theme-body","--c-theme-primary","--c-theme-muted",
  "--c-theme-heading","--c-theme-divider",
  "--c-seef-brand","--c-seef-accent","--c-seef-info",
  "--c-seef-success","--c-seef-warning","--c-seef-danger",
  "--c-seef-accent-rgb",
]);

// 4. Find undefined
let bad = 0;
const report = [];
for (const [v, locs] of [...usages.entries()].sort()) {
  if (declared.has(v) || KNOWN.has(v)) continue;
  bad++;
  report.push({ v, locs });
}

if (bad === 0) {
  console.log("GATE PASSED: 0 undefined CSS variables\n");
  process.exit(0);
} else {
  console.error(`GATE FAILED: ${bad} undefined CSS variable(s):\n`);
  for (const { v, locs } of report) {
    console.error(`  ${v}`);
    for (const l of locs.slice(0, 3)) console.error(`    -> ${l}`);
    if (locs.length > 3) console.error(`    ... and ${locs.length - 3} more`);
  }
  console.error(`\nFix: declare in smriti-tokens.css or add to KNOWN set above.\n`);
  process.exit(1);
}

