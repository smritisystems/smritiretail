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
 * Source Module: Shared Attachment Service
 * 
 * Purpose: Centralized service for validating, uploading, and managing
 * transaction attachments across all SMRITI modules.
 */

import type {
  TransactionAttachment,
  AttachmentValidation,
  DocumentType,
  AttachmentReference
} from "../domain/attachment";
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS
} from "../domain/attachment";

/**
 * Configuration for attachment handling
 */
export interface AttachmentServiceConfig {
  maxFileSizeBytes: number; // default: 25MB
  maxFilesPerTransaction: number; // default: 10
  storageBackend: "localStorage" | "indexeddb" | "server"; // default: localStorage for now
  enableVirusScan: boolean; // default: false
  requiredCategories?: Partial<Record<DocumentType, string[]>>; // which file categories are required
}

const DEFAULT_CONFIG: AttachmentServiceConfig = {
  maxFileSizeBytes: 25 * 1024 * 1024, // 25MB
  maxFilesPerTransaction: 10,
  storageBackend: "localStorage",
  enableVirusScan: false,
  requiredCategories: {}
};

/**
 * Shared Attachment Service
 * Handles validation, storage, retrieval, and audit for all transaction attachments
 */
export class AttachmentService {
  private config: AttachmentServiceConfig;
  private localStorageKey = "smriti_attachments";

  constructor(config: Partial<AttachmentServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate a file before upload
   */
  validateFile(file: File, documentType: DocumentType): AttachmentValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (file.size === 0) {
      errors.push("File is empty. Please select a file with content.");
    }
    if (file.size > this.config.maxFileSizeBytes) {
      errors.push(
        `File size exceeds maximum of ${this.formatBytes(this.config.maxFileSizeBytes)}. ` +
        `Current size: ${this.formatBytes(file.size)}`
      );
    }

    // Check file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      errors.push(
        `File type "${file.type}" not allowed. ` +
        `Supported types: PDF, Word, Excel, CSV, Images (JPG, PNG, GIF, WebP), ZIP`
      );
    }

    // Check file extension
    const fileExt = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      errors.push(
        `File extension "${fileExt}" not allowed. ` +
        `Use: ${ALLOWED_EXTENSIONS.join(", ")}`
      );
    }

    // Check for suspicious patterns in filename
    if (/[<>:"|?*\x00-\x1F]/.test(file.name)) {
      errors.push("File name contains invalid characters. Please rename the file.");
    }

    // Warnings
    if (file.size > 10 * 1024 * 1024) {
      warnings.push(
        `Large file (${this.formatBytes(file.size)}). Upload may take a moment.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate attachment count for transaction
   */
  async validateAttachmentCount(
    documentType: DocumentType,
    documentId: string
  ): Promise<{ isValid: boolean; message?: string }> {
    const existing = await this.getAttachments(documentType, documentId);
    if (existing.length >= this.config.maxFilesPerTransaction) {
      return {
        isValid: false,
        message: `Cannot add more attachments. Maximum of ${this.config.maxFilesPerTransaction} files per transaction.`
      };
    }
    return { isValid: true };
  }

  /**
   * Register a new attachment (stores metadata)
   */
  async addAttachment(
    attachment: Omit<TransactionAttachment, "id" | "uploadedAt">
  ): Promise<TransactionAttachment> {
    const now = new Date().toISOString();
    const newAttachment: TransactionAttachment = {
      ...attachment,
      id: this.generateAttachmentId(),
      uploadedAt: now
    };

    // Store in localStorage for now (can be replaced with server/IndexedDB)
    const allAttachments = this.getAllAttachments();
    allAttachments.push(newAttachment);
    localStorage.setItem(this.localStorageKey, JSON.stringify(allAttachments));

    return newAttachment;
  }

  /**
   * Get all attachments for a specific transaction
   */
  async getAttachments(
    documentType: DocumentType,
    documentId: string
  ): Promise<TransactionAttachment[]> {
    const allAttachments = this.getAllAttachments();
    return allAttachments.filter(
      a => a.documentType === documentType && a.documentId === documentId
    );
  }

  /**
   * Get attachment references (lightweight version)
   */
  async getAttachmentReferences(
    documentType: DocumentType,
    documentId: string
  ): Promise<AttachmentReference[]> {
    const attachments = await this.getAttachments(documentType, documentId);
    return attachments.map(a => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      uploadedAt: a.uploadedAt,
      remarks: a.remarks,
      category: a.category
    }));
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string): Promise<boolean> {
    const allAttachments = this.getAllAttachments();
    const idx = allAttachments.findIndex(a => a.id === attachmentId);
    if (idx === -1) return false;

    allAttachments.splice(idx, 1);
    localStorage.setItem(this.localStorageKey, JSON.stringify(allAttachments));
    return true;
  }

  /**
   * Update attachment metadata (remarks, category, approval status)
   */
  async updateAttachmentMetadata(
    attachmentId: string,
    updates: Partial<Omit<TransactionAttachment, "id" | "uploadedBy" | "uploadedAt">>
  ): Promise<TransactionAttachment | null> {
    const allAttachments = this.getAllAttachments();
    const attachment = allAttachments.find(a => a.id === attachmentId);
    if (!attachment) return null;

    Object.assign(attachment, updates, { lastAccessedAt: new Date().toISOString() });
    localStorage.setItem(this.localStorageKey, JSON.stringify(allAttachments));
    return attachment;
  }

  /**
   * Record attachment access for audit trail
   */
  async recordAccess(attachmentId: string): Promise<void> {
    await this.updateAttachmentMetadata(attachmentId, {
      lastAccessedAt: new Date().toISOString()
    });
  }

  /**
   * Get storage statistics for a transaction
   */
  async getStorageStats(
    documentType: DocumentType,
    documentId: string
  ): Promise<{ totalSize: number; fileCount: number; remainingSlots: number }> {
    const attachments = await this.getAttachments(documentType, documentId);
    return {
      totalSize: attachments.reduce((sum, a) => sum + a.fileSize, 0),
      fileCount: attachments.length,
      remainingSlots: this.config.maxFilesPerTransaction - attachments.length
    };
  }

  /**
   * Search attachments across all transactions
   */
  searchAttachments(query: string): TransactionAttachment[] {
    const allAttachments = this.getAllAttachments();
    const lowerQuery = query.toLowerCase();
    return allAttachments.filter(
      a =>
        a.fileName.toLowerCase().includes(lowerQuery) ||
        a.remarks?.toLowerCase().includes(lowerQuery) ||
        a.category?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Export attachments for a transaction as a list
   */
  async exportAttachmentsList(
    documentType: DocumentType,
    documentId: string
  ): Promise<string> {
    const attachments = await this.getAttachments(documentType, documentId);
    let csv = "File Name,Size,Type,Uploaded At,Remarks,Category\n";
    for (const att of attachments) {
      csv += `"${att.fileName}","${this.formatBytes(att.fileSize)}","${att.mimeType}","${att.uploadedAt}","${att.remarks || ""}","${att.category || ""}"\n`;
    }
    return csv;
  }

  /**
   * Cleanup old attachments (for compliance/retention)
   */
  async deleteOlderThan(daysOld: number): Promise<number> {
    const allAttachments = this.getAllAttachments();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const before = allAttachments.length;
    const filtered = allAttachments.filter(
      a => new Date(a.uploadedAt) > cutoffDate
    );
    const deleted = before - filtered.length;

    if (deleted > 0) {
      localStorage.setItem(this.localStorageKey, JSON.stringify(filtered));
    }

    return deleted;
  }

  // ============ Private Helpers ============

  private getAllAttachments(): TransactionAttachment[] {
    try {
      const data = localStorage.getItem(this.localStorageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private generateAttachmentId(): string {
    return `ATT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  }
}

// Export singleton instance for app-wide use
export const attachmentService = new AttachmentService();
