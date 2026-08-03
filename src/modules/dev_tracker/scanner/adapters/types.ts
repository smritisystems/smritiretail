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

export interface AdapterHealth {
  adapterId: string;
  version: string;
  filesProcessed: number;
  evidenceExtracted: number;
  warnings: number;
  errors: number;
  durationMs: number;
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
