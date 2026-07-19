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

export interface ModuleStatus {
  id: string;
  name: string;
  category: string;
  
  // 18 tracking dimensions (percentages or boolean status)
  uiDesigned: boolean;
  frontendStarted: boolean;
  frontendComplete: boolean;
  backendStarted: boolean;
  backendComplete: boolean;
  databaseComplete: boolean;
  apiComplete: boolean;
  businessLogicComplete: boolean;
  validationComplete: boolean;
  securityComplete: boolean;
  authenticationComplete: boolean;
  authorizationComplete: boolean;
  reportsComplete: boolean;
  printingComplete: boolean;
  barcodeComplete: boolean;
  aiComplete: boolean;
  unitTestsComplete: boolean;
  integrationTestsComplete: boolean;
  accessibilityComplete: boolean;
  performanceComplete: boolean;
  localizationComplete: boolean;
  mobileComplete: boolean;
  documentationComplete: boolean;
  qaComplete: boolean;
  productionReady: boolean;

  // Gaps & Gaps lists
  missingDependencies: string[];
  recommendations: string[];
  riskRating: "Critical" | "High" | "Medium" | "Low";
  overallPercentage: number;
}

export interface CodeHealth {
  todoCount: number;
  fixmeCount: number;
  hackCount: number;
  largeComponents: string[]; // components > 500 lines
  unusedComponents: string[]; // components not imported
  unusedApis: string[]; // backend routes never fetched in frontend
  deadFiles: string[]; // files not imported anywhere starting from main.tsx
  duplicateComponents: string[]; // files with identical/almost identical sizes/codes
  duplicateCssCount: number;
  circularDependencies: string[][];
}

export interface GitInfo {
  branch: string;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitAuthor: string;
  lastCommitDate: string;
  pendingChangesCount: number;
  commitCount: number;
  releaseVersion: string;
  pendingFiles: string[];
}

export interface RiskAnalysis {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ReleaseScores {
  dhi: number; // Development Health Index (weighted average)
  developmentScore: number; // overall implementation completeness
  qualityScore: number; // inverse of TODOs / large files / dead codes
  releaseScore: number; // release readiness factors (tests, linting, docs, DHI)
  securityScore: number; // security check completions
  testCoverage: number; // test file completeness
  documentation: number; // docs file completeness
  grade: string; // Grade A, B, C, D
}

export interface ScanHistoryEntry {
  timestamp: string;
  dhi: number;
  developmentScore: number;
  qualityScore: number;
  releaseScore: number;
  securityScore: number;
  testCoverage: number;
  documentation: number;
}

export interface ScanResult {
  timestamp: string;
  gitInfo: GitInfo;
  releaseScores: ReleaseScores;
  riskAnalysis: RiskAnalysis;
  codeHealth: CodeHealth;
  modules: ModuleStatus[];
  history: ScanHistoryEntry[];
}
