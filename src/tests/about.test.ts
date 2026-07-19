/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 1.0.0
 * * Created    : 2026-07-11
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import fs from "fs";
import path from "path";
import assert from "assert";

console.log("[TEST] Beginning About Module source file validations...");

try {
  // Test 1: Validate package.json existence & parsing
  const pkgPath = path.resolve("package.json");
  console.log(`[TEST] Checking package.json at: ${pkgPath}`);
  assert.ok(fs.existsSync(pkgPath), "package.json file must exist");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  assert.ok(pkg.version, "package.json must contain a version field");
  console.log(`[TEST] package.json version verified: ${pkg.version}`);

  // Test 2: Validate smriti-config.json existence & parsing
  const configPath = path.resolve("smriti-config.json");
  console.log(`[TEST] Checking smriti-config.json at: ${configPath}`);
  assert.ok(fs.existsSync(configPath), "smriti-config.json file must exist");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  
  // Verify metadata properties match schema used by /api/metadata
  assert.ok(config.app, "smriti-config.json must contain an 'app' configuration object");
  assert.ok(config.app.productName, "smriti-config.json must contain app.productName");
  assert.ok(config.app.edition, "smriti-config.json must contain app.edition");
  assert.ok(config.author, "smriti-config.json must contain an 'author' detail object");
  assert.equal(config.author.organization, "AITDL NETWORKS", "Author organization must be AITDL NETWORKS");
  console.log("[TEST] smriti-config.json schema layout verified successfully.");

  // Test 3: Validate CHANGELOG.md existence & text matching
  const changelogPath = path.resolve("CHANGELOG.md");
  console.log(`[TEST] Checking CHANGELOG.md at: ${changelogPath}`);
  assert.ok(fs.existsSync(changelogPath), "CHANGELOG.md file must exist");
  const changelogContent = fs.readFileSync(changelogPath, "utf8");
  assert.ok(changelogContent.length > 100, "CHANGELOG.md content must be non-empty and descriptive");
  assert.ok(changelogContent.includes("Changelog"), "CHANGELOG.md must contain the word 'Changelog'");
  console.log("[TEST] CHANGELOG.md verified successfully.");

  console.log("\n[TEST RESULT] All About Module assertions PASSED successfully.");
  process.exit(0);
} catch (error: any) {
  console.error("\n[TEST FAILED] An assertion failure occurred during tests:", error.message);
  process.exit(1);
}
