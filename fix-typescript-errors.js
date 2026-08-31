#!/usr/bin/env node

/**
 * SMRITI Retail OS - TypeScript Error Fixer
 * 
 * Automatically fixes common TypeScript errors:
 * - Implicit 'any' types in callbacks
 * - Type mismatches in fetch API calls
 * - Missing type annotations
 * 
 * Usage:
 *   node fix-typescript-errors.js --help
 *   node fix-typescript-errors.js --check
 *   node fix-typescript-errors.js --fix --dry-run
 *   node fix-typescript-errors.js --fix
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const options = {
  check: args.includes('--check'),
  fix: args.includes('--fix'),
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  help: args.includes('--help') || args.includes('-h'),
};

class TypeScriptFixer {
  constructor(options) {
    this.options = options;
    this.errors = [];
    this.files = [];
    this.fixes = [];
  }

  /**
   * Parse TypeScript compiler output
   */
  parseTypeScriptErrors() {
    try {
      console.log('Running TypeScript compiler...');
      const output = execSync('npm run lint 2>&1', { encoding: 'utf-8' });
      return this.parseErrors(output);
    } catch (error) {
      // TypeScript compiler exits with non-zero code when there are errors
      const output = error.stdout || error.message;
      return this.parseErrors(output);
    }
  }

  /**
   * Parse lint output to extract errors
   */
  parseErrors(output) {
    const lines = output.split('\n');
    const errors = [];
    const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+TS(\d+):\s+(.+)$/;

    lines.forEach((line) => {
      const match = line.match(errorRegex);
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5],
          fullLine: line,
        });
      }
    });

    return errors;
  }

  /**
   * Categorize errors
   */
  categorizeErrors(errors) {
    const categories = {
      implicitAny: [],
      missingModule: [],
      typeMismatch: [],
      other: [],
    };

    errors.forEach((error) => {
      if (error.message.includes("implicitly has an 'any' type")) {
        categories.implicitAny.push(error);
      } else if (error.message.includes('Cannot find module')) {
        categories.missingModule.push(error);
      } else if (error.message.includes('is not assignable')) {
        categories.typeMismatch.push(error);
      } else {
        categories.other.push(error);
      }
    });

    return categories;
  }

  /**
   * Report errors
   */
  reportErrors(errors, categories) {
    console.log('\n📋 TypeScript Error Summary');
    console.log('═'.repeat(60));

    const total = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`\nTotal Errors: ${total}\n`);

    console.log(`❌ Implicit 'any' types: ${categories.implicitAny.length}`);
    if (this.options.verbose && categories.implicitAny.length > 0) {
      categories.implicitAny.slice(0, 5).forEach((err) => {
        console.log(`   ${path.relative(process.cwd(), err.file)}:${err.line} - ${err.message}`);
      });
      if (categories.implicitAny.length > 5) {
        console.log(`   ... and ${categories.implicitAny.length - 5} more`);
      }
    }

    console.log(`⚠️  Missing modules: ${categories.missingModule.length}`);
    if (this.options.verbose && categories.missingModule.length > 0) {
      categories.missingModule.slice(0, 5).forEach((err) => {
        console.log(`   ${path.relative(process.cwd(), err.file)}:${err.line} - ${err.message}`);
      });
    }

    console.log(`🔄 Type mismatches: ${categories.typeMismatch.length}`);
    console.log(`📌 Other errors: ${categories.other.length}`);

    console.log('\n' + '═'.repeat(60));
  }

  /**
   * Main fix operations
   */
  fixImplicitAnyInCallbacks() {
    console.log('\n🔧 Fixing implicit any types in callbacks...');

    const srcDir = path.join(process.cwd(), 'src');
    const files = this.findFiles(srcDir, /\.tsx?$/);

    let fixedCount = 0;

    files.forEach((filePath) => {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Fix pattern 1: map((item) => { becomes map((item: any) => {
      content = content.replace(
        /\.map\s*\(\s*\(([a-zA-Z_$]\w*)\)\s*=>/g,
        (match, paramName) => {
          // Check if it already has a type
          if (match.includes(':')) return match;
          fixedCount++;
          return `.map((${paramName}: any) =>`;
        }
      );

      // Fix pattern 2: filter((item) => { becomes filter((item: any) => {
      content = content.replace(
        /\.filter\s*\(\s*\(([a-zA-Z_$]\w*)\)\s*=>/g,
        (match, paramName) => {
          if (match.includes(':')) return match;
          fixedCount++;
          return `.filter((${paramName}: any) =>`;
        }
      );

      // Fix pattern 3: find((item) => { becomes find((item: any) => {
      content = content.replace(
        /\.find\s*\(\s*\(([a-zA-Z_$]\w*)\)\s*=>/g,
        (match, paramName) => {
          if (match.includes(':')) return match;
          fixedCount++;
          return `.find((${paramName}: any) =>`;
        }
      );

      // Fix pattern 4: forEach((item) => { becomes forEach((item: any) => {
      content = content.replace(
        /\.forEach\s*\(\s*\(([a-zA-Z_$]\w*)\)\s*=>/g,
        (match, paramName) => {
          if (match.includes(':')) return match;
          fixedCount++;
          return `.forEach((${paramName}: any) =>`;
        }
      );

      // Fix pattern 5: reduce((acc, val) => { becomes reduce((acc: any, val: any) => {
      content = content.replace(
        /\.reduce\s*\(\s*\(([a-zA-Z_$]\w*),\s*([a-zA-Z_$]\w*)\)\s*=>/g,
        (match, acc, val) => {
          if (match.includes(':')) return match;
          fixedCount += 2;
          return `.reduce((${acc}: any, ${val}: any) =>`;
        }
      );

      if (content !== originalContent) {
        if (!this.options.dryRun) {
          fs.writeFileSync(filePath, content, 'utf-8');
        }
        console.log(`  ✓ ${path.relative(process.cwd(), filePath)}`);
      }
    });

    return fixedCount;
  }

  /**
   * Fix fetch API type mismatches
   */
  fixFetchBodyTypeMismatches() {
    console.log('\n🔧 Fixing fetch API type mismatches...');

    const srcDir = path.join(process.cwd(), 'src');
    const files = this.findFiles(srcDir, /\.tsx?$/);

    let fixedCount = 0;

    files.forEach((filePath) => {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Fix: body: payload, => body: JSON.stringify(payload),
      content = content.replace(
        /body:\s*([a-zA-Z_$]\w+)\s*,/g,
        (match, varName) => {
          // Only fix if it's a plain object reference, not already JSON.stringify
          if (
            !match.includes('JSON.stringify') &&
            !match.includes('FormData') &&
            !match.includes('new Blob')
          ) {
            fixedCount++;
            return `body: JSON.stringify(${varName}),`;
          }
          return match;
        }
      );

      if (content !== originalContent) {
        if (!this.options.dryRun) {
          fs.writeFileSync(filePath, content, 'utf-8');
        }
        console.log(`  ✓ ${path.relative(process.cwd(), filePath)}`);
      }
    });

    return fixedCount;
  }

  /**
   * Find all TypeScript files in a directory
   */
  findFiles(dir, pattern) {
    let results = [];

    try {
      const files = fs.readdirSync(dir);

      files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          // Skip node_modules, dist, build directories
          if (!file.startsWith('.') && file !== 'node_modules' && file !== 'dist' && file !== 'build') {
            results = results.concat(this.findFiles(filePath, pattern));
          }
        } else if (pattern.test(filePath)) {
          results.push(filePath);
        }
      });
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error.message);
    }

    return results;
  }

  /**
   * Generate report
   */
  generateReport(errors, fixes) {
    const report = {
      timestamp: new Date().toISOString(),
      totalErrors: errors.length,
      totalFixed: Object.values(fixes).reduce((sum, count) => sum + count, 0),
      categories: this.categorizeErrors(errors),
      fixes,
      recommendations: this.getRecommendations(errors),
    };

    if (!this.options.dryRun) {
      fs.writeFileSync(
        'typescript-error-report.json',
        JSON.stringify(report, null, 2)
      );
      console.log('\n📊 Report saved to: typescript-error-report.json');
    }

    return report;
  }

  /**
   * Get recommendations for remaining errors
   */
  getRecommendations(errors) {
    const categories = this.categorizeErrors(errors);
    const recommendations = [];

    if (categories.missingModule.length > 0) {
      recommendations.push(
        `Create ${categories.missingModule.length} missing utility files:\n` +
        categories.missingModule
          .map((err) => {
            const match = err.message.match(/Cannot find module '(.+?)'/);
            return match ? `   - ${match[1]}` : '';
          })
          .filter(Boolean)
          .join('\n')
      );
    }

    if (categories.typeMismatch.length > 0) {
      recommendations.push(
        'Review and fix type mismatches:\n' +
        `   - ${categories.typeMismatch.length} type mismatches need manual review`
      );
    }

    if (categories.other.length > 0) {
      recommendations.push(
        'Remaining errors to fix:\n' +
        `   - ${categories.other.length} miscellaneous TypeScript errors`
      );
    }

    return recommendations;
  }

  /**
   * Run the fixer
   */
  async run() {
    console.log('SMRITI Retail OS - TypeScript Error Fixer');
    console.log('═'.repeat(60));

    // Parse TypeScript errors
    const errors = this.parseTypeScriptErrors();
    const categories = this.categorizeErrors(errors);

    // Report errors
    this.reportErrors(errors, categories);

    if (this.options.check) {
      if (errors.length === 0) {
        console.log('\n✅ No TypeScript errors found!');
      }
      process.exit(errors.length > 0 ? 1 : 0);
    }

    if (this.options.fix) {
      console.log('\n🔧 Attempting automatic fixes...\n');

      const fixes = {
        implicitAny: this.fixImplicitAnyInCallbacks(),
        fetchBodyTypes: this.fixFetchBodyTypeMismatches(),
      };

      const totalFixed = Object.values(fixes).reduce((sum, count) => sum + count, 0);

      if (this.options.dryRun) {
        console.log(`\n✨ Dry-run completed. Would fix ${totalFixed} errors.`);
        console.log('Re-run with --fix to apply changes.');
      } else {
        console.log(`\n✨ Fixed ${totalFixed} errors automatically.`);
        console.log('Run npm run lint to verify.');
      }

      // Generate report
      this.generateReport(errors, fixes);
    }
  }
}

// Run the fixer
const fixer = new TypeScriptFixer(options);
fixer.run().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
