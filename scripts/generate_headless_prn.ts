/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.70.52
 * Created      : 2026-10-10
 * Modified     : 2026-10-10
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Headless Frontend PRN Generator CLI
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compilePrnString,
  generateFootwearVariantMatrix,
} from '../src/components/barcode/PrintLabelsStudio.tsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT_DIR = path.join(REPO_ROOT, 'assets', 'BarcodePRN');

interface CliArgs {
  style?: string;
  color?: string;
  size?: string;
  barcode?: string;
  mrp?: number;
  brand?: string;
  qty?: number;
  sku?: string;
  templateId?: string;
  output?: string;
  matrix?: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--style' || arg === '-s') {
      result.style = args[++i];
    } else if (arg === '--color' || arg === '-c') {
      result.color = args[++i];
    } else if (arg === '--size' || arg === '-z') {
      result.size = args[++i];
    } else if (arg === '--barcode' || arg === '-b') {
      result.barcode = args[++i];
    } else if (arg === '--mrp' || arg === '-m') {
      result.mrp = Number(args[++i]);
    } else if (arg === '--brand') {
      result.brand = args[++i];
    } else if (arg === '--qty' || arg === '-q') {
      result.qty = Number(args[++i]);
    } else if (arg === '--sku') {
      result.sku = args[++i];
    } else if (arg === '--template' || arg === '-t') {
      result.templateId = args[++i];
    } else if (arg === '--output' || arg === '-o') {
      result.output = args[++i];
    } else if (arg === '--matrix') {
      result.matrix = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  return result;
}

function printUsage() {
  console.log(`
SMRITI Headless Frontend PRN Generator
Usage:
  npx tsx scripts/generate_headless_prn.ts [options]

Options:
  --style, -s <style>      Article / Style Code (default: "CH-30-K")
  --color, -c <color>      Color / Shade (default: "BLACK")
  --size, -z <size>        Size (default: "37")
  --barcode, -b <barcode>  Numeric Barcode / EAN-13 (default: "8904551005335")
  --mrp, -m <mrp>          MRP value (default: 1200)
  --brand <brand>          Brand Name (default: "TATTLY THREADS")
  --qty, -q <qty>          Print Quantity (default: 1)
  --sku <sku>              Item Code / SKU (default: derived from style-color-size)
  --template, -t <id>      Layout Template ID (default: "lay-footwear-100x50-3stub")
  --matrix                 Generate full footwear size curve (37-42)
  --output, -o <file>      Output file path (default: assets/BarcodePRN/TATTLY_BLACK_37_CORRECTED.prn)
  --help, -h               Show this help message
`);
}

function run() {
  const cli = parseArgs();

  const template = {
    id: cli.templateId || 'lay-footwear-100x50-3stub',
    name: 'Tattly Threads Footwear — 100x50.7mm',
    widthMm: 100,
    heightMm: 50.7,
  };

  let items: any[] = [];

  if (cli.matrix) {
    const baseStyle = cli.style || 'CH-30-K';
    const color = (cli.color || 'BLACK').toUpperCase();
    const mrp = cli.mrp || 1200;
    console.log(`[MATRIX] Generating full footwear size curve for Style: ${baseStyle}, Color: ${color}, MRP: ${mrp}...`);
    items = generateFootwearVariantMatrix(baseStyle, color, mrp);
  } else {
    const style = (cli.style || 'CH-30-K').trim();
    const color = (cli.color || 'BLACK').trim().toUpperCase();
    const size = (cli.size || '37').trim();
    const mrp = cli.mrp || 1200;
    const barcode = (cli.barcode || '8904551005335').trim();
    const brand = (cli.brand || 'TATTLY THREADS').trim().toUpperCase();
    const qty = cli.qty || 1;
    const itemCode = cli.sku || `${style}-${color.slice(0, 3)}-${size}`;

    items = [
      {
        id: `item-${Date.now()}`,
        itemCode,
        product: `${style} Footwear (${color} ${size})`,
        brand,
        style,
        shade: color,
        size,
        barcode,
        stock: 24,
        printQty: qty,
        mrp,
        selected: true,
      },
    ];
  }

  console.log(`[FRONTEND] Compiling PRN using compilePrnString() from PrintLabelsStudio.tsx...`);
  const prn = compilePrnString(items, template);

  if (!prn) {
    console.error(`[ERROR] compilePrnString() returned empty string.`);
    process.exit(1);
  }

  // Determine output path
  let outPath: string;
  if (cli.output) {
    outPath = path.isAbsolute(cli.output) ? cli.output : path.resolve(process.cwd(), cli.output);
  } else {
    fs.mkdirSync(DEFAULT_OUT_DIR, { recursive: true });
    const first = items[0];
    const safeStyle = (first.style || 'STYLE').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeColor = (first.shade || 'COLOR').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeSize = (first.size || '37').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = cli.matrix
      ? `TATTLY_${safeStyle}_${safeColor}_MATRIX.prn`
      : `TATTLY_${safeStyle}_${safeColor}_${safeSize}_CORRECTED.prn`;
    outPath = path.join(DEFAULT_OUT_DIR, filename);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, prn, 'utf-8');

  console.log(`\n============================================================`);
  console.log(`[SUCCESS] Headless PRN Generated Without Browser`);
  console.log(`============================================================`);
  console.log(`Output File : ${outPath}`);
  console.log(`File Size   : ${fs.statSync(outPath).size} bytes`);
  console.log(`Lines Count : ${prn.split('\n').length}`);
  console.log(`Items Count : ${items.length}`);
  console.log(`Template    : ${template.name} (${template.widthMm}mm x ${template.heightMm}mm)`);
  console.log(`------------------------------------------------------------`);
  console.log(`First 15 Lines of Generated PRN:`);
  console.log(`------------------------------------------------------------`);
  console.log(prn.split('\n').slice(0, 15).join('\n'));
  console.log(`------------------------------------------------------------\n`);
}

run();
