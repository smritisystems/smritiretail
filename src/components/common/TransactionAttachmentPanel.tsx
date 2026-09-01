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
 * Source Module: Transaction Attachment Upload Panel Component
 * 
 * Purpose: Reusable UI component for uploading and managing attachments
 * across all sales and procurement transaction forms.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, FileText, Download, Eye, AlertCircle, CheckCircle } from "lucide-react";
import type {
  TransactionAttachment,
  DocumentType,
  AttachmentValidation
} from "../../domain/attachment";
import { attachmentService } from "../../services/attachmentService";

interface TransactionAttachmentPanelProps {
  documentType: DocumentType;
  documentId: string;
  onAttachmentAdded?: (attachment: TransactionAttachment) => void;
  onAttachmentRemoved?: (attachmentId: string) => void;
  readOnly?: boolean;
  maxFiles?: number;
  allowedExtensions?: string;
}

export const TransactionAttachmentPanel: React.FC<TransactionAttachmentPanelProps> = ({
  documentType,
  documentId,
  onAttachmentAdded,
  onAttachmentRemoved,
  readOnly = false,
  maxFiles = 10,
  allowedExtensions = "PDF, Word, Excel, CSV, Images (JPG, PNG, GIF, WebP), ZIP"
}) => {
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragOverRef = useRef(false);

  // Load existing attachments on mount
  useEffect(() => {
    const loadAttachments = async () => {
      const existing = await attachmentService.getAttachments(documentType, documentId);
      setAttachments(existing);
    };
    loadAttachments();
  }, [documentType, documentId]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragOverRef.current = true;
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragOverRef.current = false;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragOverRef.current = false;
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleFileSelect = async (files: FileList) => {
    setValidationErrors([]);

    // Check attachment count
    const countCheck = await attachmentService.validateAttachmentCount(
      documentType,
      documentId
    );
    if (!countCheck.isValid) {
      setValidationErrors([countCheck.message || "Cannot add more files"]);
      return;
    }

    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = attachmentService.validateFile(file, documentType);

      if (!validation.isValid) {
        setValidationErrors(prev => [...prev, ...validation.errors]);
        continue;
      }

      // Simulate upload
      await uploadFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate upload progress
      for (let i = 0; i < 100; i += 10) {
        await new Promise(r => setTimeout(r, 100));
        setUploadProgress(i);
      }

      // Create attachment record
      const attachment = await attachmentService.addAttachment({
        documentType,
        documentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        storagePath: `uploads/${documentType}/${documentId}/${file.name}`,
        uploadedBy: "current_user", // TODO: get from auth context
        remarks: ""
      });

      setAttachments(prev => [...prev, attachment]);
      setUploadProgress(100);
      setSuccessMessage(`✓ ${file.name} uploaded successfully`);

      onAttachmentAdded?.(attachment);

      setTimeout(() => {
        setSuccessMessage("");
        setUploadProgress(0);
      }, 2000);
    } catch (error) {
      setValidationErrors([
        `Failed to upload ${file.name}: ${error instanceof Error ? error.message : "Unknown error"}`
      ]);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async (attachmentId: string) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return;

    const success = await attachmentService.deleteAttachment(attachmentId);
    if (success) {
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      onAttachmentRemoved?.(attachmentId);
    }
  };

  const handleDownload = async (attachment: TransactionAttachment) => {
    await attachmentService.recordAccess(attachment.id);
    // In real implementation, fetch from server
    alert(`Download: ${attachment.fileName}\nPath: ${attachment.storagePath}`);
  };

  const handlePreview = (attachment: TransactionAttachment) => {
    if (attachment.mimeType.includes("image") || attachment.mimeType === "application/pdf") {
      window.open(attachment.storagePath, "_blank");
    } else {
      alert("Preview not available for this file type");
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes("image")) return "🖼️";
    if (mimeType === "application/pdf") return "📄";
    if (mimeType.includes("word")) return "📝";
    if (mimeType.includes("sheet") || mimeType === "text/csv") return "📊";
    if (mimeType === "application/zip") return "📦";
    return "📎";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="bg-theme-surface border border-theme-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-theme-body uppercase tracking-wider">
          📎 Attachments ({attachments.length}/{maxFiles})
        </h3>
      </div>

      {/* Upload Area */}
      {!readOnly && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOverRef.current
              ? "border-blue-400 bg-blue-50"
              : "border-theme-border bg-theme-bg"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={e => handleFileSelect(e.target.files!)}
            className="hidden"
            disabled={isUploading || attachments.length >= maxFiles}
          />

          {isUploading ? (
            <div className="space-y-2">
              <p className="text-xs text-theme-muted">Uploading...</p>
              <div className="w-full bg-theme-border rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-theme-muted">{uploadProgress}%</p>
            </div>
          ) : (
            <>
              <Upload size={20} className="mx-auto text-theme-muted mb-2" />
              <p className="text-xs text-theme-body font-medium mb-1">
                Drag & drop files here or click to select
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= maxFiles}
                className="inline-block mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Choose Files
              </button>
              <p className="text-xs text-theme-muted mt-2">
                Max file size: 25MB | {allowedExtensions}
              </p>
            </>
          )}
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <CheckCircle size={14} />
          {successMessage}
        </div>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="space-y-1">
          {validationErrors.map((error, i) => (
            <div key={i} className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ))}
        </div>
      )}

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-theme-muted font-semibold">Files ({attachments.length})</p>
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="flex items-center gap-3 p-2 bg-theme-bg border border-theme-border rounded text-xs"
            >
              <span className="text-lg">{getFileIcon(attachment.mimeType)}</span>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-theme-body truncate" title={attachment.fileName}>
                  {attachment.fileName}
                </p>
                <p className="text-theme-muted text-xs">
                  {formatFileSize(attachment.fileSize)} • {formatDate(attachment.uploadedAt)}
                </p>
                {attachment.remarks && (
                  <p className="text-theme-muted text-xs mt-1">📝 {attachment.remarks}</p>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {attachment.mimeType.includes("image") || attachment.mimeType === "application/pdf" ? (
                  <button
                    type="button"
                    onClick={() => handlePreview(attachment)}
                    className="p-1 hover:bg-theme-border rounded text-theme-muted hover:text-theme-body transition-colors"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleDownload(attachment)}
                  className="p-1 hover:bg-theme-border rounded text-theme-muted hover:text-theme-body transition-colors"
                  title="Download"
                >
                  <Download size={14} />
                </button>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(attachment.id)}
                    className="p-1 hover:bg-red-100 rounded text-red-600 hover:text-red-700 transition-colors"
                    title="Delete"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {attachments.length === 0 && !isUploading && (
        <p className="text-xs text-theme-muted text-center py-2">
          No attachments yet. Upload supporting documents like contracts, POs, approvals, or invoices.
        </p>
      )}
    </div>
  );
};

export default TransactionAttachmentPanel;
