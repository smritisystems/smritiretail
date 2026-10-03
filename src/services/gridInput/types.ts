/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.54.0
 * Created      : 2026-10-03
 * Modified     : 2026-10-03
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: SMRITI Global Grid Input & Import Standard
 */

import { SmritiFieldDefinition, ColumnMappingResult, MappingContext } from "../../lib/headerMapping/types";

export type GridProfileId =
  | "BILLING"
  | "PURCHASE"
  | "STOCK_MOVEMENT"
  | "BARCODE_PRINTING"
  | "ITEM_MASTER";

export type GridImportMode = "APPEND" | "MERGE" | "REPLACE";

export type GridDuplicatePolicy =
  | "ADD_AS_SEPARATE_ROWS"
  | "MERGE_ROWS"
  | "REJECT_DUPLICATE";

export interface GridInputProfile {
  profileId: GridProfileId;
  label: string;
  description: string;
  mappingContext: MappingContext;
  allowedFields: SmritiFieldDefinition[];
  defaultQuantity: number;
  requireProductResolution: boolean;
  atomicTransactionSafety: boolean;
  supportedImportModes: GridImportMode[];
  defaultImportMode: GridImportMode;
  supportedDuplicatePolicies: GridDuplicatePolicy[];
  defaultDuplicatePolicy: GridDuplicatePolicy;
}

export type GridRowResolutionStatus =
  | "PENDING"
  | "VALID"
  | "WARNING"
  | "PRODUCT_NOT_FOUND"
  | "PRODUCT_INACTIVE"
  | "PRODUCT_QUARANTINED"
  | "VALIDATION_ERROR";

export interface GridResolutionProduct {
  productId?: string;
  itemId?: string;
  variantId?: string;
  sku?: string;
  barcode?: string;
  name?: string;
  brand?: string;
  category?: string;
  uom?: string;
  hsnCode?: string;
  taxRate?: number;
  mrp?: number;
  sellingPrice?: number;
  costPrice?: number;
  isActive?: boolean;
  isQuarantined?: boolean;
}

export interface ParsedGridRow {
  rowNumber: number;
  rawValues: Record<string, string>;
  mappedValues: Record<string, any>;
  identifier: string;
  identifierType: "BARCODE" | "SKU" | "PRODUCT_ID" | "ITEM_CODE" | "AUTO";
  quantity: number;
  rate?: number;
  mrp?: number;
  sellingPrice?: number;
  costPrice?: number;
  discount?: number;
  taxRate?: number;
  uom?: string;
  batch?: string;
  expiry?: string;
  warehouse?: string;
  resolutionStatus: GridRowResolutionStatus;
  resolvedProduct?: GridResolutionProduct;
  errorCode?: string;
  errorMessage?: string;
  warnings?: string[];
}

export interface GridInputParseResult {
  matrix: string[][];
  rawText: string;
  detectedDelimiter: string;
  hasHeaders: boolean;
  headerRowIndex: number;
  columnMappings: ColumnMappingResult[];
  rows: ParsedGridRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  duplicateRows: number;
}
