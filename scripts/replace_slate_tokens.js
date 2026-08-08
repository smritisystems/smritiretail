/*
Author & Creator:
Jawahar Ramkripal Mallah

Founder:
SmritiSys
AITDL Networks

Role:
Chief Systems Architect

Web:
smritisys.com | smritibooks.com | aitdl.com

Email:
jawahar.mallah@gmail.com

Copyright © 2026 SmritiSys.
All Rights Reserved.
*/

/**
 * Project      : SMRITI Business OS
 * Product      : SMRITI Enterprise Design System (SEDS)
 * Script       : Automated Slate Token Replacer
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TARGET_DIR = path.join(__dirname, '..', 'src', 'components');

const REPLACEMENTS = [
  // Backgrounds with opacity
  [/\bbg-slate-950\/[0-9]+\b/g, 'bg-theme-surface-3'],
  [/\bbg-slate-900\/[0-9]+\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-800\/[0-9]+\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-700\/[0-9]+\b/g, 'bg-theme-surface-2'],
  [/\bhover:bg-slate-800\/[0-9]+\b/g, 'hover:bg-theme-surface-hover'],
  [/\bhover:bg-slate-800\b/g, 'hover:bg-theme-surface-hover'],
  [/\bhover:bg-slate-700\b/g, 'hover:bg-theme-surface-hover'],

  // Solid Backgrounds
  [/\bbg-slate-950\b/g, 'bg-theme-surface-3'],
  [/\bbg-slate-900\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-850\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-800\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-700\b/g, 'bg-theme-surface-3'],
  [/\bbg-slate-600\b/g, 'bg-theme-surface-3'],
  [/\bbg-slate-500\b/g, 'bg-theme-surface-3'],
  [/\bbg-slate-200\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-100\b/g, 'bg-theme-surface-2'],
  [/\bbg-slate-50\b/g, 'bg-theme-surface-2'],

  // Text Colors
  [/\btext-slate-950\b/g, 'text-theme-heading'],
  [/\btext-slate-900\b/g, 'text-theme-heading'],
  [/\btext-slate-800\b/g, 'text-theme-heading'],
  [/\btext-slate-700\b/g, 'text-theme-body'],
  [/\btext-slate-600\b/g, 'text-theme-muted'],
  [/\btext-slate-500\b/g, 'text-theme-muted'],
  [/\btext-slate-400\b/g, 'text-theme-muted'],
  [/\btext-slate-300\b/g, 'text-theme-body'],
  [/\btext-slate-200\b/g, 'text-theme-heading'],
  [/\btext-slate-100\b/g, 'text-theme-heading'],

  // Hover Text
  [/\bhover:text-slate-100\b/g, 'hover:text-theme-heading'],
  [/\bhover:text-slate-200\b/g, 'hover:text-theme-heading'],
  [/\bhover:text-slate-300\b/g, 'hover:text-theme-heading'],
  [/\bhover:text-slate-400\b/g, 'hover:text-theme-heading'],

  // Borders with opacity
  [/\bborder-slate-800\/[0-9]+\b/g, 'border-theme-divider'],
  [/\bborder-slate-700\/[0-9]+\b/g, 'border-theme-divider'],
  [/\bborder-slate-600\/[0-9]+\b/g, 'border-theme-divider'],
  [/\bborder-slate-[0-9]+\b/g, 'border-theme-divider'],

  // Solid Borders
  [/\bborder-slate-950\b/g, 'border-theme-divider'],
  [/\bborder-slate-900\b/g, 'border-theme-divider'],
  [/\bborder-slate-800\b/g, 'border-theme-divider'],
  [/\bborder-slate-700\b/g, 'border-theme-divider'],
  [/\bborder-slate-600\b/g, 'border-theme-divider'],
  [/\bborder-slate-500\b/g, 'border-theme-divider'],
  [/\bborder-slate-400\b/g, 'border-theme-divider'],
  [/\bborder-slate-300\b/g, 'border-theme-divider'],
  [/\bborder-slate-200\b/g, 'border-theme-divider'],
  [/\bborder-slate-100\b/g, 'border-theme-divider'],

  // Gradients & Hovers
  [/\bfrom-slate-[0-9]+\b/g, 'from-theme-surface-2'],
  [/\bto-slate-[0-9]+\b/g, 'to-theme-surface-2'],
  [/\bhover:bg-slate-[0-9]+\b/g, 'hover:bg-theme-surface-hover'],

  // Divides & Rings
  [/\bdivide-slate-[0-9]+(\/[0-9]+)?\b/g, 'divide-theme-divider'],
  [/\bring-slate-[0-9]+(\/[0-9]+)?\b/g, 'ring-theme-divider'],
];

function scanAndReplace(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'website') {
        scanAndReplace(filePath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf-8');
      let modified = false;

      for (const [regex, replacement] of REPLACEMENTS) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated SEDS tokens in: ${path.relative(TARGET_DIR, filePath)}`);
      }
    }
  }
}

scanAndReplace(TARGET_DIR);
console.log('Automated SEDS token replacement finished!');
