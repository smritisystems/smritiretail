/**
 * Project      : SMRITI Retail OS v6.5 — Platform Architecture Constitution
 * Module       : SUPAE AnalyticsQueryModel (Strongly-Typed AQM Engine v3.1)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com and AITDL.com. All Rights Reserved.
 * Version      : 3.1.0
 */

export interface AnalyticsFilter {
  field: string;
  operator: "equals" | "notEquals" | "in" | "between" | "greaterThan" | "lessThan";
  value: any;
}

export interface AnalyticsSort {
  field: string;
  direction: "asc" | "desc";
}

export interface AnalyticsQuery {
  source: string;
  rows: string[];
  columns: string[];
  measures: string[];
  filters: AnalyticsFilter[];
  sort?: AnalyticsSort[];
  drillLevel?: number;
  limit?: number;
  offset?: number;
  snapshotId?: string;
  tenantId?: string;
}

export interface PivotMatrixCell {
  rowKey: string;
  colKey: string;
  value: number | string;
  formattedValue: string;
  entityType?: string;
  entityId?: string;
}

export interface PivotMatrixResult {
  headers: { key: string; label: string }[];
  rows: Record<string, any>[];
  totalCount: number;
  executionTimeMs: number;
}
