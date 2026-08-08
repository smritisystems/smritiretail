/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : DXP Models & Data Contracts (SCS-DXP-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * SIF / SCS Compliance Declaration
 * SCS Standard   : SCS-DXP-001 (Universal Document Experience Platform v1.0 — FROZEN)
 * Principle      : Principle 001 — Complexity Must Be Hidden
 */

export type DxpDocumentType =
  | "INVOICE"
  | "RECEIPT"
  | "PURCHASE_ORDER"
  | "GRN"
  | "STOCK_TRANSFER"
  | "SALES_RETURN"
  | "PURCHASE_RETURN"
  | "PAYMENT_RECEIPT"
  | "BARCODE_LABEL"
  | "SHELF_LABEL"
  | "REPORT"
  | "CERTIFICATE"
  | "LETTER";

export type DxpOutputChannel = "PRINT" | "PDF" | "PREVIEW" | "EMAIL" | "WHATSAPP" | "ARCHIVE";

export type DxpLifecycleState =
  | "DRAFT"
  | "GENERATED"
  | "VALIDATED"
  | "RENDERED"
  | "QUEUED"
  | "DELIVERED"
  | "ARCHIVED";

export interface DxpDocumentMetadata {
  documentId: string;
  documentType: DxpDocumentType;
  tenantId?: string;
  companyId?: string;
  branchId?: string;
  createdBy: string;
  createdAt: string;
  version: number;
  language: string; // e.g. "en" | "hi" | "mr" | "gu" | "ta" | "te" | "kn"
  currency: string; // e.g. "INR"
  timezone: string;
  status: string;
  classification: "INTERNAL" | "PUBLIC" | "CONFIDENTIAL" | "RESTRICTED";
  tags: string[];
}

export interface DxpSecurityPolicy {
  isDigitalSigned: boolean;
  isEncrypted: boolean;
  watermarkText?: string;
  isRedacted: boolean;
  linkExpirationTimestamp?: number;
}

export interface DxpBrandingProfile {
  logoUrl?: string;
  primaryColor?: string;
  companyName: string;
  gstin?: string;
  legalFooter?: string;
}

export interface DxpOutputHistoryRecord {
  jobId: string;
  channel: DxpOutputChannel;
  timestamp: string;
  user: string;
  targetDeviceOrAddress: string;
  status: "SUCCESS" | "FAILED" | "QUEUED";
}

/**
 * Normalized Document Model Stage (Decouples UI renderers from raw DB/business entities)
 */
export interface IDxpDocumentModel {
  documentType: DxpDocumentType;
  documentNo: string;
  date: string;
  company: {
    name: string;
    address?: string;
    gstin?: string;
    phone?: string;
    logoUrl?: string;
  };
  customer?: {
    name: string;
    mobile?: string;
    address?: string;
    gstin?: string;
  };
  items: Array<{
    name: string;
    sku?: string;
    barcode?: string;
    qty: number;
    rate: number;
    amount: number;
    hsnCode?: string;
    taxRate?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
  }>;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
  paymentMethod?: string;
  cashier?: string;
  customFields?: Record<string, any>;
}

export interface DxpDocumentRequest {
  documentType: DxpDocumentType;
  referenceId: string;
  channel?: DxpOutputChannel;
  templateId?: string;
  data: Record<string, any>;
  items?: Array<{
    itemCode: string;
    itemName: string;
    barcode: string;
    mrp: number;
    sellingPrice: number;
    quantity: number;
    batchNo?: string;
    expiryDate?: string;
    customFields?: Record<string, any>;
  }>;
  recipientEmail?: string;
  recipientPhone?: string;
  copies?: number;
  format?: "A4" | "A5" | "Thermal80mm" | "Label";
  options?: Record<string, any>;
  isAdvisoryOnly?: boolean;
}

export interface DxpDocumentResult {
  jobId: string;
  lifecycleState: DxpLifecycleState;
  channel: DxpOutputChannel;
  outputUri?: string;
  adapterUsed: string;
  templateVersion: number;
  labelsOrPagesProcessed: number;
  errorMessage?: string;
}

export interface DxpDocument {
  metadata: DxpDocumentMetadata;
  data: Record<string, any>;
  version: number;
  lifecycleState: DxpLifecycleState;
  security: DxpSecurityPolicy;
  branding: DxpBrandingProfile;
  history: DxpOutputHistoryRecord[];
}
