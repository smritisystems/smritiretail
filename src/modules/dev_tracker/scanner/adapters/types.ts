/**
 * Project      : SMRITI Retail OS
 * Architecture : Scanner Development Standard (SDS v2.3 / SADS v1.0)
 * Description  : Core Types for Pluggable Scanner Adapters & Evidence Graph
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

import { EvidenceItem } from "../../models/interfaces.ts";

export type AdapterCategory = 
  | "frontend" 
  | "backend" 
  | "api"
  | "database" 
  | "testing" 
  | "documentation" 
  | "configuration" 
  | "security";

export interface AdapterStatistics {
  adapterId: string;
  adapterName: string;
  category: AdapterCategory;
  durationMs: number;
  filesProcessed: number;
  evidenceProduced: number;
  warnings: number;
  errors: number;
  throughputFilesPerSec: number;
}

export interface PipelineTimings {
  discoveryMs: number;
  adapterExecutionMs: number;
  metricsComputationMs: number;
  markdownGenerationMs: number;
  totalMs: number;
}

export interface WorkerThreadStats {
  workerId: number;
  cpuCore: number;
  filesProcessed: number;
  durationMs: number;
  status: "ACTIVE" | "IDLE" | "COMPLETED";
}

export interface ASTAnalysisResult {
  executionMode: "MULTI_CORE_WORKER_THREADS" | "SINGLE_THREAD_SCHEDULER";
  activeWorkerCount: number;
  astNodesParsed: number;
  symbolReferencesResolved: number;
  workerStats: WorkerThreadStats[];
}

export interface FitnessRuleResult {
  ruleId: string;
  ruleName: string;
  category: "COUPLING" | "LAYERING" | "CYCLIC" | "GOVERNANCE";
  status: "PASS" | "FAIL" | "WARN";
  detail: string;
}

export interface ArchitectureFitnessData {
  fanIn: number;
  fanOut: number;
  instabilityScore: number;
  passedRulesCount: number;
  failedRulesCount: number;
  rules: FitnessRuleResult[];
}

export interface ModuleDependency {
  sourceModule: string;
  targetModule: string;
  dependencyType: "API_FETCH" | "IMPORT_REFERENCE" | "SCHEMA_RELATION";
  couplingStrength: "HIGH" | "MEDIUM" | "LOW";
}

export interface DependencyGraphResult {
  totalCouplings: number;
  dependencies: ModuleDependency[];
  mermaidGraph: string;
}

export interface ModuleImpact {
  moduleId: string;
  moduleName: string;
  impactLevel: "HIGH" | "MEDIUM" | "LOW";
  affectedFiles: string[];
  riskFactor: string;
}

export interface ImpactAnalysisResult {
  overallRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "CLEAN";
  affectedModuleCount: number;
  changedFileCount: number;
  impactedModules: ModuleImpact[];
  regressionWarnings: string[];
}

export interface ScanDiff {
  previousTimestamp?: string;
  dhiDelta: number;
  routesDelta: number;
  modelsDelta: number;
  testsDelta: number;
  qualityDelta: number;
  addedRoutes: string[];
  removedRoutes: string[];
  addedModels: string[];
  removedModels: string[];
}

export interface AdapterStatus {
  name: string;
  status: "active" | "disabled" | "failed";
}

export interface ScannerFingerprint {
  version: string;
  build: string;
  gitCommit: string;
  rulesHash: string;
  adapters: AdapterStatus[];
}

export interface ScannerHealth {
  filesScanned: number;
  filesSkipped: number;
  pythonFiles: number;
  tsFiles: number;
  routesDiscovered: number;
  modelsDiscovered: number;
  testsDiscovered: number;
  durationMs: number;
  adapterStats: AdapterStatistics[];
  pipelineTimings: PipelineTimings;
}

export interface AdapterHealth {
  adapterId?: string;
  version?: string;
  status?: "healthy" | "degraded" | "failing";
  lastCheck?: string;
  errorCount?: number;
  filesProcessed?: number;
  evidenceExtracted?: number;
  warnings?: number;
  errors?: number;
  durationMs?: number;
  message?: string;
}

export interface ArchitectureCoverage {
  frontendCoverage: number;
  backendCoverage: number;
  databaseCoverage: number;
  apiCoverage: number;
  testsCoverage: number;
  documentationCoverage: number;
}

export interface IAdapter {
  id: string;
  name: string;
  version: string;
  category: AdapterCategory;
  priority: number;
  supportedExtensions: string[];
  enabled: boolean;
  
  canHandle(filePath: string): boolean;
  extract(filePath: string, content: string): EvidenceItem[];
  healthCheck(): AdapterHealth;
}

export interface DiscoveredEvidenceGraph {
  moduleEvidenceMap: Map<string, EvidenceItem[]>;
  allEvidence: EvidenceItem[];
  routesDiscovered: string[];
  modelsDiscovered: string[];
  testsDiscovered: string[];
}
