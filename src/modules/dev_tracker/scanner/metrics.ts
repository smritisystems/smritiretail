/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-11
 * Modified     : 2026-07-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { ParsedCodebase } from "./parser.ts";
import { ModuleStatus, CodeHealth, GitInfo, RiskAnalysis, ReleaseScores, ScanResult, ScanHistoryEntry } from "../models/interfaces.ts";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// Discovers registered modules dynamically by parsing layout_store.tsx
export function discoverModules(parsed: ParsedCodebase): { id: string; label: string; category: string }[] {
  const defaultModules = [
    { id: "dashboard", label: "Executive Hub", category: "Operations" },
    { id: "item-master", label: "Item Master", category: "Inventory & Sourcing" },
    { id: "purchase", label: "Purchase Studio", category: "Inventory & Sourcing" },
    { id: "sales", label: "Sales Studio", category: "Sales & POS" },
    { id: "pos", label: "Billing Desk", category: "Sales & POS" },
    { id: "crm", label: "CRM & Loyalty", category: "Sales & POS" },
    { id: "about-smriti", label: "About SMRITI", category: "System" }
  ];

  const layoutStoreContent = parsed.fileContentsMap.get("src/layout_engine/layout_store.tsx");
  if (!layoutStoreContent) return defaultModules;

  const modules: { id: string; label: string; category: string }[] = [];
  const workspaceBlockRegex = /\{[\s\S]*?id:\s*["'](.*?)["'][\s\S]*?label:\s*["'](.*?)["'][\s\S]*?icon:\s*["'](.*?)["'][\s\S]*?category:\s*["'](.*?)["'][\s\S]*?\}/g;
  
  let match;
  while ((match = workspaceBlockRegex.exec(layoutStoreContent)) !== null) {
    if (!modules.some(m => m.id === match![1])) {
      modules.push({
        id: match[1],
        label: match[2],
        category: match[4]
      });
    }
  }

  return modules.length > 0 ? modules : defaultModules;
}

// Maps modules to specific files, routes, tables, tests, and docs
export function getModuleResourcesMapping(moduleId: string) {
  const defaultMap = {
    frontendKeyword: moduleId,
    routeKeywords: [moduleId],
    tableKeywords: [moduleId.replace("-", "_")],
    testKeywords: [moduleId],
    docKeywords: [moduleId]
  };

  const specificMappings: Record<string, typeof defaultMap> = {
    "dashboard": {
      frontendKeyword: "DashboardTab.tsx",
      routeKeywords: ["/api/dashboard", "/api/metadata"],
      tableKeywords: [],
      testKeywords: ["dashboard"],
      docKeywords: ["dashboard"]
    },
    "item-master": {
      frontendKeyword: "ItemMasterTab.tsx",
      routeKeywords: ["/api/items", "/api/attributes", "/api/variants"],
      tableKeywords: ["items", "attributes", "variants"],
      testKeywords: ["item", "barcode"],
      docKeywords: ["item", "procurement"]
    },
    "purchase": {
      frontendKeyword: "PurchaseStudioTab.tsx",
      routeKeywords: ["/api/purchases", "/api/po", "/api/grn"],
      tableKeywords: ["purchase_orders", "goods_receipt_notes"],
      testKeywords: ["purchase"],
      docKeywords: ["purchase", "procurement"]
    },
    "sales": {
      frontendKeyword: "SalesStudioTab.tsx",
      routeKeywords: ["/api/sales", "/api/invoices"],
      tableKeywords: ["sales_invoices", "sales_orders"],
      testKeywords: ["sales"],
      docKeywords: ["sales"]
    },
    "pos": {
      frontendKeyword: "PosTerminalTab.tsx",
      routeKeywords: ["/api/pos", "/api/billing"],
      tableKeywords: ["pos_transactions", "pos_payments"],
      testKeywords: ["pos", "billing"],
      docKeywords: ["pos", "billing"]
    },
    "crm": {
      frontendKeyword: "CrmStudioTab.tsx",
      routeKeywords: ["/api/crm", "/api/campaigns"],
      tableKeywords: ["crm_leads", "crm_opportunities", "crm_campaigns"],
      testKeywords: ["crm"],
      docKeywords: ["crm"]
    },
    "customer-master": {
      frontendKeyword: "CustomerMasterTab.tsx",
      routeKeywords: ["/api/customers", "/api/customers/groups", "/api/customers/validate-add"],
      tableKeywords: ["customers", "customer_groups"],
      testKeywords: ["customer"],
      docKeywords: ["customer"]
    },
    "loyalty": {
      frontendKeyword: "LoyaltyStudioTab.tsx",
      routeKeywords: ["/api/loyalty", "/api/wallets"],
      tableKeywords: ["loyalty_wallets", "loyalty_tiers"],
      testKeywords: ["loyalty"],
      docKeywords: ["loyalty"]
    },
    "about-smriti": {
      frontendKeyword: "AboutSmritiTab.tsx",
      routeKeywords: ["/api/metadata", "/api/changelog"],
      tableKeywords: [],
      testKeywords: ["about"],
      docKeywords: ["about"]
    }
  };

  return specificMappings[moduleId] || defaultMap;
}

// Compute metrics, code health, and DHI
export function computeMetrics(parsed: ParsedCodebase): ScanResult {
  const discovered = discoverModules(parsed);
  const modules: ModuleStatus[] = [];

  let totalCritical = 0;
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;

  let totalFrontendScore = 0;
  let totalBackendScore = 0;
  let totalDBScore = 0;
  let totalAPIScore = 0;
  let totalTestsScore = 0;
  let totalDocsScore = 0;
  let totalSecurityScore = 0;

  for (const m of discovered) {
    const map = getModuleResourcesMapping(m.id);
    
    // Heuristic Scan
    // 1. Frontend
    const frontendFile = parsed.filesList.find(f => f.includes(map.frontendKeyword));
    const uiDesigned = !!frontendFile;
    const frontendStarted = uiDesigned;
    let frontendComplete = false;
    let accessibilityComplete = false;
    let localizationComplete = false;
    let mobileComplete = false;

    if (frontendFile) {
      const content = parsed.fileContentsMap.get(frontendFile) || "";
      frontendComplete = !content.includes("Coming Soon") && !content.includes("TODO stub") && content.length > 500;
      accessibilityComplete = content.includes("aria-") || content.includes("role=") || content.includes("title=");
      localizationComplete = content.includes("en-") || content.includes("en-IN") || content.includes("locale") || content.includes("Currency");
      mobileComplete = content.includes("sm:") || content.includes("md:") || content.includes("hidden lg:flex");
    }

    // 2. Backend
    const serverContent = parsed.fileContentsMap.get("server.ts") || "";
    const backendStarted = map.routeKeywords.some(rt => serverContent.includes(rt));
    let backendComplete = false;
    let apiComplete = false;
    let businessLogicComplete = false;
    let validationComplete = false;
    let securityComplete = false;
    let authenticationComplete = false;
    let authorizationComplete = false;

    // Check if routes are registered in server.ts
    const registeredRoutes = map.routeKeywords.filter(rt => parsed.routesInServer.some(srvRt => srvRt.includes(rt) || rt.includes(srvRt)));
    apiComplete = registeredRoutes.length > 0;
    
    if (apiComplete) {
      backendComplete = true; // basic server route implementation exists
      businessLogicComplete = serverContent.includes("saveDb") || serverContent.includes("Pool") || serverContent.includes("query");
      validationComplete = serverContent.includes("validate-add") || serverContent.includes("errors.push") || serverContent.includes("required");
      securityComplete = serverContent.includes("role") || serverContent.includes("token") || serverContent.includes("hash");
      authenticationComplete = serverContent.includes("auth/me") || serverContent.includes("currentUser");
      authorizationComplete = serverContent.includes("role") || serverContent.includes("admin") || serverContent.includes("permissions");
    }

    // 3. Database
    const databaseComplete = map.tableKeywords.length === 0 || map.tableKeywords.some(tbl => parsed.tablesInDb.includes(tbl));

    // 4. Reports & Printing
    const reportsComplete = frontendFile ? (parsed.fileContentsMap.get(frontendFile) || "").includes("QuickReports") || (parsed.fileContentsMap.get(frontendFile) || "").includes("ReportDesigner") : false;
    const printingComplete = frontendFile ? (parsed.fileContentsMap.get(frontendFile) || "").includes("print") || (parsed.fileContentsMap.get(frontendFile) || "").includes("PrintStudio") : false;
    const barcodeComplete = frontendFile ? (parsed.fileContentsMap.get(frontendFile) || "").includes("barcode") || (parsed.fileContentsMap.get(frontendFile) || "").includes("Barcode") : false;
    const aiComplete = frontendFile ? (parsed.fileContentsMap.get(frontendFile) || "").includes("ai") || (parsed.fileContentsMap.get(frontendFile) || "").includes("GenAI") || (parsed.fileContentsMap.get(frontendFile) || "").includes("Gemini") : false;

    // 5. Tests
    const testFile = parsed.testFiles.find(t => map.testKeywords.some(k => t.toLowerCase().includes(k.toLowerCase())));
    const unitTestsComplete = !!testFile;
    const integrationTestsComplete = unitTestsComplete && (parsed.fileContentsMap.get(testFile!) || "").includes("assert");

    // 6. Docs
    const docFile = parsed.docFiles.find(d => map.docKeywords.some(k => d.toLowerCase().includes(k.toLowerCase())));
    const documentationComplete = !!docFile;

    // Quality metrics & QA Complete
    const qaComplete = unitTestsComplete && !serverContent.includes("TODO");
    const performanceComplete = frontendFile ? (parsed.fileContentsMap.get(frontendFile) || "").includes("debounce") || (parsed.fileContentsMap.get(frontendFile) || "").includes("useMemo") : false;
    const productionReady = frontendComplete && backendComplete && databaseComplete && unitTestsComplete && documentationComplete;

    // Missing Dependencies Tracking
    const missingDependencies: string[] = [];
    if (!frontendComplete) missingDependencies.push("Frontend UI incomplete");
    if (!backendComplete) missingDependencies.push("Backend routes missing");
    if (map.tableKeywords.length > 0 && !databaseComplete) missingDependencies.push("Database tables missing");
    if (!unitTestsComplete) missingDependencies.push("Unit tests missing");
    if (!documentationComplete) missingDependencies.push("Reference documentation missing");
    if (!reportsComplete) missingDependencies.push("Quick reports integration missing");
    if (!printingComplete) missingDependencies.push("Print layout missing");

    // Recommendations Engine
    const recommendations: string[] = [];
    if (!frontendComplete) recommendations.push("Complete UI components styling using vanilla CSS.");
    if (!unitTestsComplete) recommendations.push("Write automated regression test suites under src/tests/.");
    if (!documentationComplete) recommendations.push("Create a walkthrough document under docs/walkthrough/.");
    if (!printingComplete) recommendations.push("Configure print stylesheets mapping standard invoice bounds.");

    // Risks calculator
    let riskRating: "Critical" | "High" | "Medium" | "Low" = "Low";
    if (!frontendStarted && !backendStarted) {
      riskRating = "Critical";
      totalCritical++;
    } else if (!frontendComplete || !backendComplete) {
      riskRating = "High";
      totalHigh++;
    } else if (!unitTestsComplete || !documentationComplete) {
      riskRating = "Medium";
      totalMedium++;
    } else {
      totalLow++;
    }

    // Overall Completion Score
    const scores = [
      uiDesigned ? 100 : 0,
      frontendStarted ? 100 : 0,
      frontendComplete ? 100 : 0,
      backendStarted ? 100 : 0,
      backendComplete ? 100 : 0,
      databaseComplete ? 100 : 0,
      apiComplete ? 100 : 0,
      businessLogicComplete ? 100 : 0,
      validationComplete ? 100 : 0,
      securityComplete ? 100 : 0,
      authenticationComplete ? 100 : 0,
      authorizationComplete ? 100 : 0,
      reportsComplete ? 100 : 0,
      printingComplete ? 100 : 0,
      barcodeComplete ? 100 : 0,
      aiComplete ? 100 : 0,
      unitTestsComplete ? 100 : 10,
      integrationTestsComplete ? 100 : 0,
      accessibilityComplete ? 100 : 0,
      performanceComplete ? 100 : 0,
      localizationComplete ? 100 : 0,
      mobileComplete ? 100 : 0,
      documentationComplete ? 100 : 0,
      qaComplete ? 100 : 0,
      productionReady ? 100 : 0
    ];
    const overallPercentage = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    modules.push({
      id: m.id,
      name: m.label,
      category: m.category,
      uiDesigned,
      frontendStarted,
      frontendComplete,
      backendStarted,
      backendComplete,
      databaseComplete,
      apiComplete,
      businessLogicComplete,
      validationComplete,
      securityComplete,
      authenticationComplete,
      authorizationComplete,
      reportsComplete,
      printingComplete,
      barcodeComplete,
      aiComplete,
      unitTestsComplete,
      integrationTestsComplete,
      accessibilityComplete,
      performanceComplete,
      localizationComplete,
      mobileComplete,
      documentationComplete,
      qaComplete,
      productionReady,
      missingDependencies,
      recommendations,
      riskRating,
      overallPercentage
    });

    totalFrontendScore += frontendComplete ? 100 : (frontendStarted ? 50 : 0);
    totalBackendScore += backendComplete ? 100 : (backendStarted ? 50 : 0);
    totalDBScore += databaseComplete ? 100 : 0;
    totalAPIScore += apiComplete ? 100 : 0;
    totalTestsScore += unitTestsComplete ? 100 : 0;
    totalDocsScore += documentationComplete ? 100 : 0;
    totalSecurityScore += securityComplete ? 100 : 0;
  }

  const moduleCount = discovered.length || 1;
  const avgFrontend = Math.round(totalFrontendScore / moduleCount);
  const avgBackend = Math.round(totalBackendScore / moduleCount);
  const avgDB = Math.round(totalDBScore / moduleCount);
  const avgAPI = Math.round(totalAPIScore / moduleCount);
  const avgTests = Math.round(totalTestsScore / moduleCount);
  const avgDocs = Math.round(totalDocsScore / moduleCount);
  const avgSecurity = Math.round(totalSecurityScore / moduleCount);

  // Health Index calculation (weighted averages)
  const dhi = Math.round(
    (avgFrontend * 0.15) +
    (avgBackend * 0.15) +
    (avgDB * 0.10) +
    (avgAPI * 0.10) +
    (avgTests * 0.15) +
    (avgDocs * 0.10) +
    (avgSecurity * 0.10) +
    (90 * 0.05) + // performance score dummy
    (95 * 0.05) + // technical debt score dummy
    (88 * 0.05)   // release score dummy
  );

  const developmentScore = Math.round((avgFrontend + avgBackend + avgDB + avgAPI) / 4);
  const qualityScore = Math.max(0, 100 - (parsed.todosCount / 10) - (parsed.largeComponents.length * 2));
  const testCoverage = avgTests;
  const documentation = avgDocs;
  const securityScore = avgSecurity;
  const releaseScore = Math.round((dhi + qualityScore + testCoverage) / 3);

  let grade = "D";
  if (dhi >= 90) grade = "A";
  else if (dhi >= 80) grade = "B";
  else if (dhi >= 70) grade = "C";

  const releaseScores: ReleaseScores = {
    dhi,
    developmentScore,
    qualityScore,
    releaseScore,
    securityScore,
    testCoverage,
    documentation,
    grade
  };

  const riskAnalysis: RiskAnalysis = {
    critical: totalCritical,
    high: totalHigh,
    medium: totalMedium,
    low: totalLow
  };

  // Compile Git Metadata
  let gitInfo: GitInfo = {
    branch: "main",
    lastCommitHash: "e4c2149",
    lastCommitMessage: "style: Phase 3C - rollout standardized project headers",
    lastCommitAuthor: "Jawahar Ramkripal Mallah",
    lastCommitDate: "2026-07-11",
    pendingChangesCount: 0,
    commitCount: 144,
    releaseVersion: "3.4.0",
    pendingFiles: []
  };

  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8" }).trim();
    const lastCommitHash = execSync("git log -n 1 --format=%h", { encoding: "utf8" }).trim();
    const lastCommitMessage = execSync("git log -n 1 --format=%s", { encoding: "utf8" }).trim();
    const lastCommitAuthor = execSync("git log -n 1 --format=%an", { encoding: "utf8" }).trim();
    const lastCommitDate = execSync("git log -n 1 --format=%ad --date=short", { encoding: "utf8" }).trim();
    const commitCount = parseInt(execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim(), 10);
    const statusOut = execSync("git status --porcelain", { encoding: "utf8" }).trim();
    const pendingFiles = statusOut ? statusOut.split("\n").map(line => line.substring(3).trim()) : [];
    const pendingChangesCount = pendingFiles.length;

    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

    gitInfo = {
      branch,
      lastCommitHash,
      lastCommitMessage,
      lastCommitAuthor,
      lastCommitDate,
      pendingChangesCount,
      commitCount,
      releaseVersion: pkg.version || "3.4.0",
      pendingFiles
    };
  } catch (e) {
    console.warn("[SDIC Scanner] Git integration failed: not inside a git repository or git missing.");
  }

  // Code Health details
  const codeHealth: CodeHealth = {
    todoCount: parsed.todosCount,
    fixmeCount: parsed.fixmesCount,
    hackCount: parsed.hacksCount,
    largeComponents: parsed.largeComponents,
    unusedComponents: [], // can be populated dynamically if needed
    unusedApis: parsed.routesInServer.filter(rt => !parsed.fetchedRoutesInFrontend.includes(rt)),
    deadFiles: [],
    duplicateComponents: [],
    duplicateCssCount: 0,
    circularDependencies: []
  };

  // Load history from JSON file if exists
  let history: ScanHistoryEntry[] = [];
  const historyPath = path.resolve("docs/reports/history.json");
  try {
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    }
  } catch (e) {
    console.error("[SDIC Scanner] Failed to load history.json:", e);
  }

  return {
    timestamp: new Date().toISOString(),
    gitInfo,
    releaseScores,
    riskAnalysis,
    codeHealth,
    modules,
    history
  };
}
