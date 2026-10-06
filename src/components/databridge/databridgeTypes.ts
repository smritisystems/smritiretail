/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 1.0.0
 * Created      : 2026-10-06
 * Modified     : 2026-10-06
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal — DataBridge Frontend Type Contracts
 * Capability    : databridge.workspace_ux (@SmritiCapability / smriti_capability)
 */

export type DataBridgeEntityType = "ITEM" | "VARIANT" | "BARCODE" | "PRICEBOOK" | "CATALOG_DOCUMENT" | "CATALOG";

export type DataBridgeClassification =
  | "CREATE"
  | "UPDATE"
  | "NO_CHANGE"
  | "EXISTING_CONFLICT"
  | "VALIDATION_ERROR"
  | "DEPENDENCY_ERROR";

export interface DataBridgeDiffField {
  field_name: string;
  current_value: any;
  incoming_value: any;
  diff_type: "CHANGED" | "NEW" | "REMOVED" | "UNCHANGED";
}

export interface DataBridgeDiff {
  fields: Record<string, DataBridgeDiffField>;
  new_record: boolean;
  has_changes: boolean;
}

export interface DataBridgeConflict {
  conflict_type: string;
  existing_identifier?: string | null;
  incoming_identifier?: string | null;
  message: string;
  suggested_action?: string | null;
}

export interface DataBridgeResultItem {
  row_index: number;
  classification: DataBridgeClassification;
  record_id?: string | null;
  identifier?: string | null;
  diff: DataBridgeDiff;
  conflicts: DataBridgeConflict[];
  validation_errors: string[];
  blocking: boolean;
  explanation?: string | null;
  raw_data: Record<string, any>;
  normalized_data: Record<string, any>;
  // Convenience & display aliases
  row_number?: number;
  sku?: string;
  status_label?: string;
  description?: string;
  barcode?: string;
  mrp?: number;
  selling_price?: number;
  changes_count?: number;
  diff_fields?: DataBridgeDiffField[];
  conflict_details?: Record<string, any>;
  issue_code?: string;
  issue_message?: string;
  suggested_action?: string;
  raw_row?: Record<string, any>;
}

export interface DataBridgeSummary {
  total_rows: number;
  create_count: number;
  update_count: number;
  no_change_count: number;
  conflict_count: number;
  validation_error_count: number;
  dependency_error_count: number;
  create?: number;
  update?: number;
  no_change?: number;
  conflicts?: number;
  validation_errors?: number;
  dependency_errors?: number;
}

export interface DataBridgePreviewResponse {
  preview_token: string;
  import_id?: string;
  entity_type: string;
  total_rows: number;
  can_commit: boolean;
  blocking_reasons: string[];
  summary: DataBridgeSummary;
  items: DataBridgeResultItem[];
}

export interface DataBridgeCommitResponse {
  success: boolean;
  import_id: string;
  entity_type: string;
  total_rows: number;
  committed_count: number;
  skipped_count: number;
  error_count: number;
  worm_audit_id?: string | null;
  timestamp: string;
  items: DataBridgeResultItem[];
}

export type InputFormatMode = "EXCEL_CSV" | "SMRITI_X" | "PASTE";

export interface HeaderMappingConfig {
  sourceColumn: string;
  targetField: string;
  targetLabel: string;
  confidence: "EXACT" | "HIGH" | "MEDIUM" | "UNMAPPED";
  required?: boolean;
}

export interface ImportHistoryItem {
  id: string;
  importId: string;
  date: string;
  entity: string;
  fileName: string;
  user: string;
  rows: number;
  created: number;
  updated: number;
  noChange: number;
  errors: number;
  status: "COMPLETED" | "IN_PROGRESS" | "FAILED";
  duration: string;
}

export type WizardStep =
  | "CHOOSE_DATA"
  | "SELECT_ENTITY"
  | "MAP_FIELDS"
  | "VALIDATE"
  | "PREVIEW"
  | "REVIEW_ISSUES"
  | "DIFF_VIEW"
  | "IN_PROGRESS"
  | "SUCCESS";

export interface DataBridgeAsyncSubmitRequest {
  entity_type: DataBridgeEntityType;
  rows: Record<string, any>[];
  chunk_size?: number;
  file_format?: string;
  filename?: string;
  idempotency_key?: string;
  preview_only?: boolean;
}

export interface DataBridgeAsyncJobResponse {
  job_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  total_rows: number;
  chunk_size: number;
  entity_type: string;
  created_at: string;
  message: string;
}

export interface DataBridgeJobStatusResponse {
  job_id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  entity_type: string;
  total_rows: number;
  processed_rows: number;
  committed_count: number;
  error_count: number;
  progress_percent: number;
  current_chunk: number;
  total_chunks: number;
  started_at?: string | null;
  completed_at?: string | null;
  compliance_sha256?: string | null;
  error_message?: string | null;
  summary?: DataBridgeSummary | null;
  items_sample?: DataBridgeResultItem[];
}

