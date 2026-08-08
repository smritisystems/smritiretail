/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys
 * Standard     : SCS-WSP-001 (Workspace Presentation Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Version      : 1.0.0
 */

export interface WorkspaceSchema {
  id: string;
  selectionModel: "single" | "multiple";
  supportsExcel: boolean;
  supportsImport: boolean;
  supportsExport: boolean;
  supportsCopilot: boolean;
  supportsTimeline: boolean;
  supportsBatchOperations?: boolean;
  defaultSortField?: string;
  primaryKeyField?: string;
}
