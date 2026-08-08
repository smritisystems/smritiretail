/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Platform Manifest & Control Plane Standard (SPCC Standard v1.0)
 * Standard     : ADR-022, SPCC-GOV-001 through SPCC-GOV-011, PBC-001, KND-001, NRA-001
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export type SPCCRoleMode = "Observer" | "Auditor" | "Administrator" | "PlatformArchitect";

export type ManifestStage = "DRAFT" | "VALIDATED" | "IMPACT_CHECKED" | "APPROVED" | "PUBLISHED" | "ACTIVATED";

export type SnapshotType = "Draft" | "Published" | "Production" | "EmergencyRollback";

export interface FeatureDefinition {
  id: string;
  name: string;
  description?: string;
  moduleId: string;
  enabled: boolean;
  permission?: string;
  menuId?: string;
  route?: string;
  tags?: string[];
}

export interface RouteMapping {
  route: string;
  workspaceId: string;
  componentName: string;
  permission?: string;
  active: boolean;
  isOrphan?: boolean;
}

export interface SearchAliasRegistration {
  moduleId: string;
  featureId?: string;
  label: string;
  aliases: string[];
  keywords: string[];
  gtinCodes?: string[];
  category?: string;
}

export interface AIIntentRegistration {
  moduleId: string;
  intent: string;
  aliases: string[];
  actions: string[];
  objects: string[];
  samplePrompts: string[];
}

export interface PlatformManifest {
  manifestVersion: string;
  schemaVersion: string;
  stage: ManifestStage;
  createdAt: number;
  updatedAt: number;
  publishedBy?: string;
  domains: any[];
  modules: any[];
  features: FeatureDefinition[];
  routes: RouteMapping[];
  searchIndex: SearchAliasRegistration[];
  aiIntents: AIIntentRegistration[];
  configurations: Record<string, any>;
  snapshotId: string;
}

export interface PlatformSnapshot {
  id: string;
  timestamp: number;
  type: SnapshotType;
  version: string;
  author: string;
  description: string;
  manifest: PlatformManifest;
}

export type ProductionReadinessLevel = "CERTIFIED" | "RELEASE_CANDIDATE" | "DEV_COMPLETE" | "WORK_IN_PROGRESS";

export type ReadinessRiskCategory = "LOW" | "MEDIUM" | "HIGH";

export interface ModuleCompletenessReport {
  moduleId: string;
  moduleName: string;
  score: number; // 0 to 100%
  readyForProduction: boolean; // True only if score >= 95% and all 11 checks pass (SPCC-GOV-012)
  readinessLevel: ProductionReadinessLevel;
  riskCategory: ReadinessRiskCategory;
  checks: {
    moduleRegistered: boolean;
    featuresRegistered: boolean;
    menuRegistered: boolean;
    routeRegistered: boolean;
    permissionMapped: boolean;
    searchIndexed: boolean;
    workspaceAssigned: boolean;
    licenseMapped: boolean;
    telemetryEnabled: boolean;
    capabilityMapped: boolean;
    processMapped: boolean;
  };
}

export interface ReleaseReadinessReport {
  ready: boolean;
  overallScore: number;
  blockersCount: number;
  checklist: {
    routesOk: boolean;
    permissionsOk: boolean;
    licensingOk: boolean;
    telemetryOk: boolean;
    testsOk: boolean;
    performanceOk: boolean;
    securityOk: boolean;
  };
}

export interface PlatformDoctorResult {
  timestamp: number;
  repairedRoutes: number;
  repairedMenus: number;
  syncedPermissions: number;
  generatedSearchAliases: number;
  fixedOrphans: number;
  totalRepaired: number;
  summary: string;
}

export interface DriftDetectionReport {
  hasDrift: boolean;
  driftCount: number;
  timestamp: number;
  mismatches: {
    category: "NAVIGATION" | "WORKSPACE" | "PERMISSION" | "SEARCH" | "VERSION";
    description: string;
    targetId: string;
  }[];
}

export interface PlatformCertificationReport {
  certified: boolean;
  score: number;
  timestamp: number;
  version: string;
  details: string[];
}

export interface PlatformCoverageReport {
  timestamp: number;
  totalModulesCount: number;
  registeredCount: number;
  menusCount: number;
  routesCount: number;
  permissionsCount: number;
  workspacesCount: number;
  searchIndexedCount: number;
  aiRegisteredCount: number;
  coveragePercentage: number;
  certifiedModulesCount: number;
  domainBreakdown: {
    domainId: string;
    domainLabel: string;
    modulesCount: number;
    coverageScore: number;
  }[];
}

export type CapabilityStatus = "NOT_PRESENT" | "PLANNED" | "PARTIAL" | "COMPLETE" | "CERTIFIED";

export interface CapabilityTraceability {
  backend: boolean;
  api: boolean;
  ui: boolean;
  menu: boolean;
  workflow: boolean;
  tests: boolean;
}

export interface BusinessCapabilityDefinition {
  id: string;
  name: string;
  category: "Enterprise Structure" | "Sales & POS" | "Inventory & Sourcing" | "Accounting & Tax" | "CRM & Loyalty" | "Analytics & BI" | "Platform & Security";
  industryPack?: "Retail" | "Wholesale" | "Restaurant" | "Jewellery" | "Medical" | "Electronics" | "Apparel" | "Universal";
  description: string;
  targetModuleId: string;
  traceability?: Partial<CapabilityTraceability>;
}

export interface CapabilityGapReport {
  timestamp: number;
  totalCapabilitiesCount: number;
  certifiedCount: number;
  completeCount: number;
  partialCount: number;
  plannedCount: number;
  notPresentCount: number;
  capabilityCoveragePercentage: number;
  capabilities: {
    id: string;
    name: string;
    category: string;
    industryPack: string;
    status: CapabilityStatus;
    score: number;
    traceability: CapabilityTraceability;
    missingElements: string[];
  }[];
}

export type ProcessCertificationStatus = "NOT_STARTED" | "IN_PROGRESS" | "CERTIFIED";

export interface BusinessProcessStep {
  stepIndex: number;
  name: string;
  targetModuleId: string;
  passed: boolean;
}

export interface BusinessProcessDefinition {
  id: string;
  name: string;
  code: string;
  category: "Procurement" | "Sales & Checkout" | "Inventory Logistics" | "Financial Operations";
  description: string;
  steps: { stepIndex: number; name: string; targetModuleId: string }[];
}

export interface BusinessProcessCertificationReport {
  timestamp: number;
  totalProcessesCount: number;
  certifiedProcessesCount: number;
  inProgressProcessesCount: number;
  notStartedProcessesCount: number;
  processCoveragePercentage: number;
  processes: {
    id: string;
    name: string;
    code: string;
    category: string;
    status: ProcessCertificationStatus;
    score: number;
    stepsCount: number;
    passedStepsCount: number;
    steps: BusinessProcessStep[];
  }[];
}

export interface ImpactAnalysisReport {
  action: "HIDE_MODULE" | "DISABLE_FEATURE" | "DELETE_ROUTE" | "MODIFY_PERMISSION" | "UNINSTALL_MODULE";
  targetId: string;
  targetName: string;
  affectedRolesCount: number;
  affectedDashboardsCount: number;
  affectedSearchAliasesCount: number;
  affectedWorkspacesCount: number;
  dependentModules: string[];
  warnings: string[];
  blocking: boolean;
}

export interface PrePublishValidationIssue {
  severity: "ERROR" | "WARNING";
  category: "DUPLICATE_ROUTE" | "DUPLICATE_MENU" | "CIRCULAR_DEPENDENCY" | "MISSING_PERMISSION" | "HIDDEN_PARENT" | "ORPHAN_FEATURE" | "BROKEN_ALIAS";
  message: string;
  targetId?: string;
}

export interface PrePublishValidationReport {
  valid: boolean;
  totalErrors: number;
  totalWarnings: number;
  issues: PrePublishValidationIssue[];
  timestamp: number;
}

export interface CategoryHealthScore {
  category: "Kernel" | "Navigation" | "Modules" | "Routes" | "Permissions" | "Search" | "Workspace" | "Licensing" | "Telemetry" | "Performance" | "UX" | "Accessibility" | "Security";
  score: number; // 0 to 100
  status: "OPTIMAL" | "HEALTHY" | "WARNING" | "CRITICAL";
  details: string;
}

export interface CompositePlatformHealth {
  governanceScore: number;  // 0-100% (Registry, Menus, Routes, Permissions)
  engineeringScore: number; // 0-100% (Build, Lint, Unit Tests, Type Safety)
  operationalScore: number;  // 0-100% (Telemetry, Uptime, Memory, Zero-Drift)
  businessScore: number;     // 0-100% (BCR Capability & BPR Process Certification)
  compositeScore: number;    // Weighted Composite Platform Health (0-100%)
}

export interface PlatformIntegrityScorecard {
  timestamp: number;
  overallScore: number; // Weighted composite 0-100%
  status: "EXCELLENT" | "HEALTHY" | "DEGRADED" | "CRITICAL";
  compositeHealth: CompositePlatformHealth;
  totalModules: number;
  accessibleModules: number;
  hiddenModules: number;
  brokenRoutes: number;
  missingMenus: number;
  duplicateMenus: number;
  permissionIssues: number;
  searchIndexedRatio: string;
  workspaceAssignedRatio: string;
  categories: CategoryHealthScore[];
}

/**
 * Creates an empty initial Platform Manifest baseline
 */
export function createDefaultPlatformManifest(): PlatformManifest {
  return {
    manifestVersion: "1.0.0",
    schemaVersion: "2026-08-06",
    stage: "ACTIVATED",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    publishedBy: "System Architect",
    domains: [],
    modules: [],
    features: [],
    routes: [],
    searchIndex: [],
    aiIntents: [],
    configurations: {
      pos: { offlineMode: true, receiptThermal: true },
      inventory: { autoBarcodeGen: true, lowStockAlerts: true },
      crm: { loyaltyMultiplier: 1.5 },
      ai: { copilotEnabled: true, advisoryOnly: true },
      healthWeights: { governance: 0.25, engineering: 0.25, operational: 0.25, business: 0.25 },
      certificationThresholds: { governance: 95, engineering: 95, operational: 95, business: 80 }
    },
    snapshotId: `snap_init_${Date.now()}`
  };
}
