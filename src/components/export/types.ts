/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.25.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export type ExportFormat = "csv" | "xlsx" | "txt" | "json" | "html" | "gsheet";

export type ExportScope = "currentPage" | "all" | "filtered" | "selected";

export type ColumnDataType = "text" | "number" | "currency" | "percentage" | "date" | "datetime" | "boolean" | "badge";

export interface ExportColumnDefinition {
  key: string;
  label: string;
  datatype?: ColumnDataType;
  align?: "left" | "center" | "right";
  width?: number | string; // Approximate char width or pixel string for text/excel
  format?: (value: any, row?: any) => string;
  isVisible?: boolean;
  isSummary?: boolean; // If true, include in summary/totals row calculation
}

export interface ExportMetadata {
  moduleTitle: string;
  companyName?: string;
  branchName?: string;
  exportedBy?: string;
  exportTimestamp?: string;
  appliedFilters?: Record<string, any>;
  searchTerm?: string;
  dateRange?: { start?: string; end?: string };
  totalRecordsCount?: number;
  selectedRecordsCount?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
}

export interface ExportProgressState {
  isExporting: boolean;
  currentStep: "idle" | "collecting" | "formatting" | "generating" | "complete" | "error";
  fetchedCount: number;
  totalEstimatedCount: number;
  currentPage: number;
  totalPages: number;
  percentage: number;
  errorMessage?: string;
}

export interface ExportDatasetOptions<T = any> {
  moduleName: string;
  format: ExportFormat;
  scope: ExportScope;
  columns: ExportColumnDefinition[];
  data: T[];
  selectedRows?: T[];
  metadata?: ExportMetadata;
  customFilename?: string;
  sheetName?: string;
}

export interface ExportPagedEndpointOptions {
  moduleName: string;
  format: ExportFormat;
  scope: ExportScope;
  endpoint: string; // e.g. "/products" or "/accounting/ledger"
  columns: ExportColumnDefinition[];
  pageSize?: number;
  queryParams?: Record<string, any>;
  metadata?: ExportMetadata;
  selectedRows?: any[];
  onProgress?: (progress: ExportProgressState) => void;
  abortSignal?: AbortSignal;
  customFilename?: string;
  sheetName?: string;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  format: ExportFormat;
  rowCount: number;
  fileSizeBytes: number;
  errorMessage?: string;
}
