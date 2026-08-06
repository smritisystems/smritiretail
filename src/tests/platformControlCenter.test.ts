/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : SMRITI Platform Control Center (SPCC) Integration & Governance Unit Tests
 * Standard     : ADR-022, SPCC-GOV-001 through SPCC-GOV-011, Rule 15 (PBC-001), Rule 17 (KND-001), Rule 19 (NRA-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SPK } from "../kernel/SPK.js";
import { NavigationRegistry } from "../kernel/upr/navigation/NavigationRegistry.js";

describe("SMRITI Platform Control Center (SPCC Standard v1.0 / ADR-022)", () => {
  beforeEach(() => {
    NavigationRegistry.clear();
  });

  it("SPCC-001: Should execute 13-category Platform Integrity Audit and generate weighted score", () => {
    const audit = SPK.navigation.auditPlatformIntegrity();

    expect(audit).toBeDefined();
    expect(audit.overallScore).toBeGreaterThanOrEqual(90);
    expect(audit.status).toBe("EXCELLENT");
    expect(audit.categories.length).toBe(13);

    const categoriesList = audit.categories.map((c) => c.category);
    expect(categoriesList).toContain("Kernel");
    expect(categoriesList).toContain("Navigation");
    expect(categoriesList).toContain("Modules");
    expect(categoriesList).toContain("Routes");
    expect(categoriesList).toContain("Permissions");
    expect(categoriesList).toContain("Search");
    expect(categoriesList).toContain("Workspace");
    expect(categoriesList).toContain("Licensing");
    expect(categoriesList).toContain("Telemetry");
    expect(categoriesList).toContain("Performance");
    expect(categoriesList).toContain("UX");
    expect(categoriesList).toContain("Accessibility");
    expect(categoriesList).toContain("Security");
  });

  it("SPCC-002: Should calculate Pre-Save Impact Analysis when modifying a module", () => {
    const impact = SPK.navigation.analyzeImpact("HIDE_MODULE", "item-master");

    expect(impact).toBeDefined();
    expect(impact.targetId).toBe("item-master");
    expect(impact.affectedRolesCount).toBeGreaterThan(0);
    expect(impact.affectedSearchAliasesCount).toBeGreaterThan(0);
    expect(impact.warnings.length).toBeGreaterThan(0);
  });

  it("SPCC-003: Should perform Pre-Publish Validation and pass clean platform configurations", () => {
    const report = SPK.navigation.validatePrePublish();

    expect(report).toBeDefined();
    expect(report.valid).toBe(true);
    expect(report.totalErrors).toBe(0);
  });

  it("SPCC-004: Should export and import canonical PlatformManifest", () => {
    const manifest = SPK.navigation.exportPlatformManifest("Platform Architect");

    expect(manifest).toBeDefined();
    expect(manifest.manifestVersion).toBe("1.0.0");
    expect(manifest.publishedBy).toBe("Platform Architect");
    expect(manifest.domains.length).toBeGreaterThan(0);

    // Ingest manifest back into SPK
    SPK.navigation.importPlatformManifest(manifest);
    const domains = SPK.navigation.getDomains();
    expect(domains.length).toBe(manifest.domains.length);
  });

  it("SPCC-005: Should manage Safe Mode Snapshots and perform 1-click restore", () => {
    const initialDomains = SPK.navigation.getDomains().length;

    // Create snapshot 1
    const snap1 = SPK.navigation.createSnapshot("Platform Architect", "Baseline V1 Snapshot");
    expect(snap1.id).toBeDefined();

    // Register a new test domain
    SPK.navigation.registerDomain({
      id: "custom-test-domain",
      label: "Custom Extension Domain",
      icon: "extension",
      emoji: "🧩",
      order: 99,
      moduleIds: ["custom-mod"]
    });

    expect(SPK.navigation.getDomains().length).toBe(initialDomains + 1);

    // Restore Snapshot 1
    const restored = SPK.navigation.restoreSnapshot(snap1.id);
    expect(restored).toBe(true);
    expect(SPK.navigation.getDomains().length).toBe(initialDomains);
  });

  it("SPCC-006: Should include Platform Administration domain and SPCC in NavigationRegistry defaults", () => {
    const adminDomain = SPK.navigation.getDomain("admin");

    expect(adminDomain).toBeDefined();
    expect(adminDomain?.label).toBe("Platform Administration");
    expect(adminDomain?.modules?.some((m) => m.id === SPK.navigation.NAV_IDS.PLATFORM_CONTROL_CENTER)).toBe(true);
  });

  it("SPCC-007: Should execute Platform Doctor One-Click Auto-Repair Engine (SPCC-GOV-014)", () => {
    const repairResult = SPK.navigation.repairPlatform();

    expect(repairResult).toBeDefined();
    expect(repairResult.totalRepaired).toBeGreaterThanOrEqual(0);
    expect(repairResult.summary).toContain("Platform Doctor Repaired");
  });

  it("SPCC-008: Should enforce Registry Completeness Matrix (SPCC-GOV-012)", () => {
    const completeness = SPK.navigation.checkModuleCompleteness("NAV_ITEM_MASTER");

    expect(completeness).toBeDefined();
    expect(completeness.moduleId).toBe("NAV_ITEM_MASTER");
    expect(completeness.score).toBeGreaterThanOrEqual(90);
    expect(completeness.checks.moduleRegistered).toBe(true);
    expect(completeness.checks.menuRegistered).toBe(true);
  });

  it("SPCC-009: Should evaluate Release Readiness Gate before deployment", () => {
    const readiness = SPK.navigation.checkReleaseReadiness();

    expect(readiness).toBeDefined();
    expect(readiness.ready).toBe(true);
    expect(readiness.overallScore).toBe(100);
    expect(readiness.blockersCount).toBe(0);
  });

  it("SPCC-010: Should perform Platform Drift Detection (SPCC-GOV-015)", () => {
    const driftReport = SPK.navigation.detectPlatformDrift();

    expect(driftReport).toBeDefined();
    expect(driftReport.hasDrift).toBe(false);
    expect(driftReport.driftCount).toBe(0);
  });

  it("SPCC-011: Should execute Platform Certification Gate (SPCC-GOV-017)", () => {
    const certReport = SPK.navigation.certifyPlatform();

    expect(certReport).toBeDefined();
    expect(certReport.certified).toBe(true);
    expect(certReport.score).toBeGreaterThanOrEqual(95);
    expect(certReport.version).toBe("1.0.0-FROZEN");
    expect(certReport.details.length).toBeGreaterThan(0);
  });

  it("SPCC-012: Should generate Platform Coverage Report across all business domains", () => {
    const cov = SPK.navigation.generatePlatformCoverageReport();

    expect(cov).toBeDefined();
    expect(cov.totalModulesCount).toBeGreaterThanOrEqual(50);
    expect(cov.menusCount).toBeGreaterThanOrEqual(50);
    expect(cov.routesCount).toBeGreaterThanOrEqual(50);
    expect(cov.coveragePercentage).toBeGreaterThanOrEqual(90);
    expect(cov.domainBreakdown.length).toBeGreaterThanOrEqual(10);
  });

  it("SPCC-013: Should calculate Navigation Complexity Score for 10 focused domains", () => {
    const salesComplexity = SPK.navigation.calculateNavigationComplexity("sales");
    const platformComplexity = SPK.navigation.calculateNavigationComplexity("platform");

    expect(salesComplexity.menuCount).toBe(7);
    expect(salesComplexity.complexity).toBe("MEDIUM");

    expect(platformComplexity.menuCount).toBe(4);
    expect(platformComplexity.complexity).toBe("LOW");
  });

  it("SPCC-014: Should execute Business Capability Registry (BCR) & Gap Analysis Engine (5-Tier Lifecycle Standard)", () => {
    const bcr = SPK.navigation.auditBusinessCapabilities();

    expect(bcr).toBeDefined();
    expect(bcr.totalCapabilitiesCount).toBe(20);
    expect(bcr.certifiedCount).toBeGreaterThanOrEqual(10);
    expect(bcr.partialCount).toBeGreaterThanOrEqual(1); // CAP_FINANCIAL_YEAR correctly identified as PARTIAL
    expect(bcr.plannedCount).toBeGreaterThanOrEqual(1); // CAP_CURRENCY_EXCHANGE identified as PLANNED
    expect(bcr.notPresentCount).toBeGreaterThanOrEqual(1); // CAP_PROMOTION_ENGINE identified as NOT_PRESENT
    expect(bcr.capabilityCoveragePercentage).toBeGreaterThanOrEqual(75);

    // Verify Financial Year Traceability
    const finYearCap = bcr.capabilities.find((c) => c.id === "CAP_FINANCIAL_YEAR");
    expect(finYearCap).toBeDefined();
    expect(finYearCap?.status).toBe("PARTIAL");
    expect(finYearCap?.traceability.backend).toBe(true);
    expect(finYearCap?.traceability.api).toBe(true);
    expect(finYearCap?.traceability.ui).toBe(false);
  });

  it("SPCC-015: Should execute Business Process Registry (BPR) & Workflow Certification Engine", () => {
    const bpr = SPK.navigation.auditBusinessProcesses();

    expect(bpr).toBeDefined();
    expect(bpr.totalProcessesCount).toBe(7);
    expect(bpr.certifiedProcessesCount).toBe(7);
    expect(bpr.processCoveragePercentage).toBe(100);

    const p2p = bpr.processes.find((p: any) => p.code === "BPR-P2P");
    expect(p2p).toBeDefined();
    expect(p2p?.status).toBe("CERTIFIED");
    expect(p2p?.stepsCount).toBe(4);
    expect(p2p?.passedStepsCount).toBe(4);
  });
});
