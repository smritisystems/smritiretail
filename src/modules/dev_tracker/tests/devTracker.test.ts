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
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
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

  // Test 2: Metrics Calculation & Architecture Remediation Verification
  console.log("[TEST] Calculating development health metrics & validating architecture discovery...");
  const results = computeMetrics(parsed);
  assert.ok(results.timestamp, "Scan results must contain a timestamp");
  assert.ok(results.releaseScores, "Scan results must contain release scores");
  assert.ok(results.releaseScores.dhi >= 0 && results.releaseScores.dhi <= 100, "DHI must be a percentage value");
  assert.ok(results.modules.length > 5, "Scan must discover registered modules");

  // Remediation Verification Assertion 1: Excluded generated/archive folders
  const hasExcludedFolder = parsed.filesList.some(f =>
    f.startsWith("backups/") || f.startsWith("coverage/") || f.startsWith("exports/") || f.startsWith("scratch/") || f.startsWith(".venv/")
  );
  assert.strictEqual(hasExcludedFolder, false, "Excluded directories (backups, coverage, .venv, etc.) must NOT be scanned");

  // Remediation Verification Assertion 2: FastAPI Route Detection
  const hasFastAPIRoutes = parsed.routesInServer.some(r => r.includes("/api/v1/"));
  assert.ok(hasFastAPIRoutes, "Parser must detect FastAPI routes (/api/v1/...) in backend/app/api/");

  // Remediation Verification Assertion 3: PAL apiFetchV1 Detection
  const hasApiFetchV1Calls = parsed.fetchedRoutesInFrontend.length > 0;
  assert.ok(hasApiFetchV1Calls, "Parser must detect frontend API calls (apiFetchV1, apiFetch)");

  // Remediation Verification Assertion 4: SQLAlchemy Model Schema Detection
  const hasSQLAlchemyTables = parsed.tablesInDb.includes("companies") || parsed.tablesInDb.includes("users") || parsed.tablesInDb.includes("sales_invoices");
  assert.ok(hasSQLAlchemyTables, "Parser must detect SQLAlchemy ORM models from backend/app/models/");

  // Remediation Verification Assertion 5: Pytest & Vitest Test File Discovery
  const hasPytestFiles = parsed.testFiles.some(t => t.startsWith("backend/tests/"));
  assert.ok(hasPytestFiles, "Parser must discover backend Pytest files in backend/tests/");

  // Remediation Verification Assertion 6: Module Mapping Accuracy (CrmStudioTab & StockLedgerTab)
  const crmModule = results.modules.find(m => m.id === "crm");
  assert.ok(crmModule, "CRM module must be discovered");
  assert.strictEqual(crmModule?.uiDesigned, true, "CRM module UI must be recognized as designed (CrmStudioTab.tsx)");

  const stockModule = results.modules.find(m => m.id === "stock-ledger");
  assert.ok(stockModule, "Stock Ledger module must be discovered");
  assert.strictEqual(stockModule?.uiDesigned, true, "Stock Ledger UI must be recognized as designed (StockLedgerTab.tsx)");

  console.log(`[TEST] Metrics DHI calculated: ${results.releaseScores.dhi}% (Grade ${results.releaseScores.grade}). All architecture discovery assertions passed!`);

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
