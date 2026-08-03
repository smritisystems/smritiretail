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
