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

import { parseCodebase } from "../scanner/parser.ts";
import { computeMetrics } from "../scanner/metrics.ts";
import { writeReports } from "../scanner/reporter.ts";
import assert from "assert";
import fs from "fs";
import path from "path";

console.log("[TEST] Beginning SMRITI Development Intelligence Center (SDIC) unit tests...");

try {
  // Test 1: Parser Execution
  console.log("[TEST] Executing codebase parser...");
  const parsed = parseCodebase();
  assert.ok(parsed.filesList.length > 10, "Workspace must contain files to scan");
  assert.ok(parsed.fileContentsMap.has("server.ts"), "Parser must capture server.ts");
  assert.ok(parsed.fileContentsMap.has("package.json"), "Parser must capture package.json");
  console.log(`[TEST] Parser checks passed. Scanned ${parsed.filesList.length} files.`);

  // Test 2: Metrics Calculation
  console.log("[TEST] Calculating development health metrics...");
  const results = computeMetrics(parsed);
  assert.ok(results.timestamp, "Scan results must contain a timestamp");
  assert.ok(results.releaseScores, "Scan results must contain release scores");
  assert.ok(results.releaseScores.dhi >= 0 && results.releaseScores.dhi <= 100, "DHI must be a percentage value");
  assert.ok(results.modules.length > 5, "Scan must discover registered modules");
  console.log(`[TEST] Metrics DHI calculated: ${results.releaseScores.dhi}% (Grade ${results.releaseScores.grade}).`);

  // Test 3: Report Generation and File Writes
  console.log("[TEST] Executing reports generation and filesystem writing...");
  writeReports(results);
  
  const dateStr = new Date().toISOString().split("T")[0];
  const reportsDir = path.resolve("docs/reports", dateStr);
  
  // Verify master DEVELOPMENT_STATUS.md in workspace root
  assert.ok(fs.existsSync(path.resolve("DEVELOPMENT_STATUS.md")), "Master DEVELOPMENT_STATUS.md must be written to workspace root");
  
  // Verify all 15 reports exist in docs/reports/YYYY-MM-DD/
  const expectedReports = [
    "DEVELOPMENT_STATUS.md",
    "EXECUTIVE_SUMMARY.md",
    "MODULE_PROGRESS.md",
    "FEATURE_MATRIX.md",
    "UI_STATUS.md",
    "BACKEND_STATUS.md",
    "DATABASE_STATUS.md",
    "API_STATUS.md",
    "TEST_STATUS.md",
    "DOCUMENTATION_STATUS.md",
    "SECURITY_STATUS.md",
    "TECHNICAL_DEBT.md",
    "BUG_TRACKER.md",
    "RELEASE_READINESS.md",
    "CHANGE_HISTORY.md"
  ];
  
  for (const report of expectedReports) {
    const reportPath = path.join(reportsDir, report);
    assert.ok(fs.existsSync(reportPath), `Report file '${report}' must be written to docs/reports/${dateStr}/`);
  }
  
  // Verify history.json is written
  assert.ok(fs.existsSync(path.resolve("docs/reports/history.json")), "history.json file must be written to docs/reports/");

  console.log("[TEST RESULT] All SDIC metrics and reporting unit assertions PASSED successfully.");
  process.exit(0);
} catch (error: any) {
  console.error("[TEST FAILED] SDIC unit assertion error:", error.message);
  process.exit(1);
}
