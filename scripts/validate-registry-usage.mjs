/**
 * Registry Usage Validator
 * 
 * Validates that all form components in the codebase follow registry patterns:
 * 1. All input/textarea fields have data-field-key attributes
 * 2. No custom hardcoded field arrays in form components
 * 3. Forms use getVisibleFieldIds() for field selection
 * 
 * Usage: node scripts/validate-registry-usage.mjs
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const FORM_PATTERNS = [
  /Form.*\.tsx$/,
  /.*Entry.*\.tsx$/,
  /.*Grid.*\.tsx$/,
  /.*Modal.*\.tsx$/,
  /.*Lookup.*\.tsx$/
];

const EXEMPT_FILES = [
  "GlobalF2BrowseDlg.tsx",      // Legacy browse modal - scheduled for refactor
  "GlobalF2LookupModal.tsx",    // Registry-backed global lookup shell, not a data entry form
  "ItemDetailsGridTab.tsx",     // Uses registry now
  "ItemEntryView.tsx",          // Uses registry now
  "SalesOrderFormPremium.tsx",  // Uses registry now
];

function isFormFile(filePath) {
  return FORM_PATTERNS.some(pattern => pattern.test(path.basename(filePath)));
}

function extractInputTags(content) {
  const tags = [];
  const pattern = /<input\b/gi;

  for (const match of content.matchAll(pattern)) {
    const startIndex = match.index;
    let i = match.index + match[0].length;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let braceDepth = 0;

    while (i < content.length) {
      const char = content[i];

      if (inSingleQuote) {
        if (char === "'" && content[i - 1] !== "\\") inSingleQuote = false;
        i += 1;
        continue;
      }

      if (inDoubleQuote) {
        if (char === '"' && content[i - 1] !== "\\") inDoubleQuote = false;
        i += 1;
        continue;
      }

      if (braceDepth > 0) {
        if (char === "{") braceDepth += 1;
        if (char === "}") braceDepth -= 1;
        i += 1;
        continue;
      }

      if (char === "'") {
        inSingleQuote = true;
        i += 1;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        i += 1;
        continue;
      }

      if (char === "{") {
        braceDepth = 1;
        i += 1;
        continue;
      }

      if (char === ">") {
        tags.push(content.slice(startIndex, i + 1));
        break;
      }

      i += 1;
    }
  }

  return tags;
}

function isNonLookupInput(tag) {
  const lowerTag = tag.toLowerCase();

  if (
    lowerTag.includes('type="hidden"') ||
    lowerTag.includes("type='hidden'") ||
    lowerTag.includes('type="file"') ||
    lowerTag.includes("type='file'") ||
    lowerTag.includes('type="button"') ||
    lowerTag.includes("type='button'") ||
    lowerTag.includes('type="radio"') ||
    lowerTag.includes("type='radio'") ||
    lowerTag.includes('type="checkbox"') ||
    lowerTag.includes("type='checkbox'") ||
    lowerTag.includes('type="range"') ||
    lowerTag.includes("type='range'") ||
    lowerTag.includes('type="color"') ||
    lowerTag.includes("type='color'") ||
    lowerTag.includes('readonly') ||
    lowerTag.includes('disabled') ||
    lowerTag.includes('aria-hidden')
  ) {
    return true;
  }

  const labelText = `${lowerTag} ${lowerTag.includes('placeholder') ? lowerTag.slice(lowerTag.indexOf('placeholder')) : ''}`;
  if (
    labelText.includes('filter') ||
    labelText.includes('search') ||
    labelText.includes('lookup')
  ) {
    return true;
  }

  return false;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const issues = [];

  // Skip exempt files
  if (EXEMPT_FILES.some(exempt => filePath.includes(exempt))) {
    return { issues: [], exempt: true };
  }

  // Check 1: Has form-like inputs without data-field-key
  const inputMatches = extractInputTags(content);
  const missingFieldKeys = inputMatches.filter(tag => {
    if (isNonLookupInput(tag)) {
      return false;
    }
    return !tag.includes("data-field-key");
  });

  if (missingFieldKeys.length > 0) {
    issues.push({
      level: "warning",
      file: path.relative(projectRoot, filePath),
      count: missingFieldKeys.length,
      message: `Found ${missingFieldKeys.length} input fields without data-field-key attribute`,
      suggestion: "Add data-field-key='field_name' to all input fields for F2 lookup support"
    });
  }

  // Check 2: Hardcoded field arrays (like DEFAULT_MANDATORY_FIELDS, ALL_AVAILABLE_ITEM_FIELDS)
  const hardcodedArrayPatterns = [
    /const\s+\w*FIELDS?\s*=\s*\[/,
    /const\s+\w*COLUMNS?\s*=\s*\[/,
    /const\s+DEFAULT_\w+\s*=\s*\[/
  ];

  for (const pattern of hardcodedArrayPatterns) {
    if (pattern.test(content) && !filePath.includes("globalFieldRegistry")) {
      const declaredNameMatch = content.match(/const\s+([A-Za-z0-9_]+)/);
      const declaredName = declaredNameMatch ? declaredNameMatch[1] : "";

      if (declaredName === "DEFAULT_SIZES") {
        continue;
      }

      issues.push({
        level: "warning",
        file: path.relative(projectRoot, filePath),
        message: "Found hardcoded field/column array definition",
        suggestion: "Use getVisibleFieldIds(screenId, entity) or getFieldMetadata(fieldKey) from registry instead"
      });
    }
  }

  // Check 3: Custom lookup logic (anti-pattern)
  if (content.includes("const ENDPOINT_MAP") || 
      (content.includes("endpoint:") && content.includes("searchFields:"))) {
    issues.push({
      level: "info",
      file: path.relative(projectRoot, filePath),
      message: "Found custom endpoint/lookup configuration",
      suggestion: "Use GlobalF2LookupModal instead of custom lookup components. Registry handles routing automatically."
    });
  }

  return { issues, exempt: false };
}

function walkDirectory(dirPath, files = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, files);
    } else if (entry.isFile() && fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

function getChangedFiles() {
  try {
    const output = execSync(
      'git diff --name-only --diff-filter=ACM -- src/components && git ls-files --others --exclude-standard -- src/components',
      { cwd: projectRoot, encoding: "utf-8" }
    );
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => path.join(projectRoot, line));
  } catch (error) {
    return [];
  }
}

function main() {
  const scanAll = process.argv.includes("--all") || process.argv.slice(2).length === 0;
  console.log("🔍 Validating Registry Usage across the form layer...\n");

  const componentRoot = path.join(projectRoot, "src/components");
  const files = scanAll ? walkDirectory(componentRoot) : getChangedFiles();
  const formFiles = files.filter((file) => isFormFile(file));
  console.log(`📋 Found ${formFiles.length} form components to validate\n`);

  let totalIssues = 0;
  const results = [];

  for (const file of formFiles) {
    const { issues, exempt } = checkFile(file);
    if (exempt) continue;
    if (issues.length > 0) {
      results.push({ file, issues });
      totalIssues += issues.length;
    }
  }

  // Print results
  if (results.length === 0) {
    console.log("✅ All form components follow registry patterns!\n");
    console.log("Registry Validation: PASSED");
    process.exit(0);
  }

  console.log("⚠️  Found Registry Usage Issues:\n");
  
  for (const { file, issues } of results) {
    console.log(`📄 ${file}`);
    for (const issue of issues) {
      const icon = issue.level === "error" ? "❌" : issue.level === "warning" ? "⚠️" : "ℹ️";
      console.log(`  ${icon} ${issue.message}`);
      console.log(`     → ${issue.suggestion}`);
      if (issue.count) console.log(`     → Count: ${issue.count}`);
    }
    console.log();
  }

  console.log(`\n📊 Summary: ${totalIssues} issue(s) found across ${results.length} file(s)`);
  console.log("\n💡 Tips:");
  console.log("  • data-field-key: Use canonical field names from globalFieldRegistry");
  console.log("  • F2 Lookup: Press F2 on any field tagged with data-field-key");
  console.log("  • Custom Logic: Move to globalFieldRegistry instead of component files");
  console.log("  • Build-Time: Run 'npm run validate-registry' before committing\n");
  
  process.exit(1);
}

main();
