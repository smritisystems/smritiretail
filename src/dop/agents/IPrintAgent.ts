/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : IPrintAgent Interface (SCS-DXP-002 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 2.0.0
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { DxpDocumentRequest, DxpDocumentResult } from "../models/DxpTypes.ts";

export type PrintAgentCategory = "PROTOCOL" | "SYSTEM" | "DIAGNOSTIC";

export interface PrintAgentStatus {
  agentId: string;
  name: string;
  category: PrintAgentCategory;
  isReady: boolean;
  activeJobsCount: number;
  lastExecutionTimestamp?: string;
  metrics: {
    totalJobsProcessed: number;
    successfulJobs: number;
    failedJobs: number;
  };
}

export interface IPrintAgent {
  id: string;
  name: string;
  category: PrintAgentCategory;
  standardId: string; // e.g. "DXP-ESC-001", "DXP-ZPL-001", "DXP-RET-001"
  
  initialize(): Promise<boolean>;
  canHandle(req: DxpDocumentRequest): boolean;
  process(req: DxpDocumentRequest): Promise<DxpDocumentResult>;
  getStatus(): PrintAgentStatus;
}
