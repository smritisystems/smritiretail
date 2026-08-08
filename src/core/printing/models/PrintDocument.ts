/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintDocument & Models (Rule SUPP-005)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export type DocumentType =
  | "BARCODE_TAG"
  | "RETAIL_INVOICE"
  | "POS_RECEIPT"
  | "KITCHEN_TICKET"
  | "DELIVERY_CHALLAN"
  | "STOCK_TAG"
  | "STICKER_LABEL";

export interface PrintDocument {
  id: string;
  type: DocumentType;
  title: string;
  content: string; // Raw or template script content
  variables?: Record<string, any>;
  items?: Array<Record<string, any>>;
  metadata?: Record<string, any>;
  createdBy?: string;
  createdAt: string;
  immutable: boolean;
}

export type JobPriority = "HIGH" | "BILLING" | "KITCHEN" | "BARCODE" | "REPORTS" | "BACKGROUND";

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "RETRYING" | "CANCELLED";

export interface PrintJob {
  id: string;
  documentId: string;
  document: PrintDocument;
  printerName: string;
  printerIp?: string;
  printerPort?: number;
  profileId?: string;
  driverId: string; // e.g. "zpl", "tspl", "esc_pos"
  providerId: string; // e.g. "qz_tray", "windows_spooler", "web_usb", "network"
  priority: JobPriority;
  copies: number;
  payload: string; // Resolved command stream payload
  retryCount: number;
  maxRetries: number;
  status: JobStatus;
  error?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrinterCapability {
  id: string;
  name: string;
  manufacturer?: string;
  model?: string;
  vendorId?: number;
  productId?: number;
  transport?: "USB" | "SERIAL" | "NETWORK" | "SPOOLER" | "VIRTUAL";
  protocols?: Array<"ZPL" | "TSPL" | "EPL" | "ESC_POS" | "RAW" | "PDF">;
  dpi: number;
  paperWidthMm: number;
  paperHeightMm: number;
  supportsZPL: boolean;
  supportsTSPL: boolean;
  supportsEPL: boolean;
  supportsESC: boolean;
  supportsPDF: boolean;
  supportsRAW: boolean;
  supportsCutter: boolean;
  supportsPeeler: boolean;
  supportsDrawer: boolean;
  connection: "USB" | "SPOOLER" | "NETWORK" | "SERIAL" | "BLUETOOTH" | "CLOUD" | "VIRTUAL";
  status: "Online" | "Offline" | "Busy" | "Paused" | "Paper Out" | "Ribbon Out" | "Unknown";
  isDefault?: boolean;
}

export interface PrintResult {
  jobId: string;
  success: boolean;
  providerId: string;
  driverId: string;
  timestamp: string;
  error?: string;
  executionTimeMs: number;
}
