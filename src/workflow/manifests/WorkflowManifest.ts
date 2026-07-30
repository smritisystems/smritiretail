/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUWINE WorkflowManifest (Versioned Workflow Manifest Schema v2.0)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 2.0.0
 */

export interface WorkflowStep {
  id: string;
  type: "approval" | "notification" | "task" | "condition" | "parallel" | "merge" | "end";
  title: string;
  assignToRole?: string;
  nextStepId?: string;
  parallelStepIds?: string[];
}

export interface WorkflowManifestV2 {
  version: "2.0";
  entity: string;
  trigger: string;
  steps: WorkflowStep[];
  sla: {
    reminderHours: number;
    escalationHours: number;
    criticalHours: number;
  };
  offlineSupported: boolean;
}
