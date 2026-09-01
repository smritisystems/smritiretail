/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.7.0
 * Created      : 2026-09-01
 * Modified     : 2026-09-01
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Source Module: Shared Transaction Attachment Contract
 * 
 * Purpose: Unified attachment model for sales orders, quotations, purchase orders,
 * invoices, returns, and all other transactional documents across SMRITI.
 */

/**
 * Supported document types for attachments
 */
export type DocumentType = 
  | "sales_order"
  | "quotation"
  | "sales_invoice"
  | "billing"
  | "delivery_note"
  | "sales_return"
  | "credit_note"
  | "purchase_requisition"
  | "purchase_order"
  | "supplier_invoice"
  | "goods_receipt"
  | "vendor_return"
  | "debit_note"
  | "payment_voucher"
  | "approval_document"
  | "other";

/**
 * Supported file MIME types for safe upload
 */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/zip"
];

export const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".zip"
];

/**
 * Core attachment metadata stored with transaction
 */
export interface TransactionAttachment {
  /** Unique attachment ID */
  id: string;
  
  /** Type of document this attachment belongs to */
  documentType: DocumentType;
  
  /** ID of the transaction/document */
  documentId: string;
  
  /** Original file name with extension */
  fileName: string;
  
  /** MIME type of the file */
  mimeType: string;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Storage path or blob reference (backend-specific) */
  storagePath: string;
  
  /** User ID of who uploaded the file */
  uploadedBy: string;
  
  /** Timestamp when file was uploaded */
  uploadedAt: string;
  
  /** Optional description/remarks about the attachment */
  remarks?: string;
  
  /** Optional category: invoice_copy, contract, approval, po_copy, etc. */
  category?: string;
  
  /** Whether this attachment is required for transaction completion */
  isRequired?: boolean;
  
  /** Optional approval status */
  approvalStatus?: "pending" | "approved" | "rejected";
  
  /** Audit trail: when it was last accessed or modified */
  lastAccessedAt?: string;
}

/**
 * Lightweight attachment reference for transaction storage
 */
export interface AttachmentReference {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  remarks?: string;
  category?: string;
}

/**
 * Upload progress and validation state
 */
export interface AttachmentUploadState {
  isUploading: boolean;
  progress: number; // 0-100
  error?: string;
  validationErrors: string[];
}

/**
 * Validation result for file upload
 */
export interface AttachmentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
