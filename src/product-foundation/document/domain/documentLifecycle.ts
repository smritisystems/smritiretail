import { InvoiceDocument, InvoiceLine } from '../print/domain/invoice';

export type DocumentChannel = 'Print' | 'Email' | 'WhatsApp' | 'SMS' | 'Webhook';
export type DocumentStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Cancelled';
export type DocumentType =
  | 'SalesInvoice'
  | 'PurchaseInvoice'
  | 'SalesOrder'
  | 'PurchaseOrder'
  | 'Quotation'
  | 'SalesReturn'
  | 'PurchaseReturn'
  | 'StockTransfer'
  | 'PhysicalStock';

export interface DocumentSignature {
  name: string;
  role: string;
  signedAt: string;
  notes?: string;
}

export interface DocumentAttachment {
  id: string;
  name: string;
  contentType: string;
  url?: string;
  data?: string;
}

export interface DocumentAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentLifecycleContext {
  documentId: string;
  documentType: DocumentType;
  documentNumber: string;
  templateName: string;
  status: DocumentStatus;
  channels: DocumentChannel[];
  signatures: DocumentSignature[];
  attachments: DocumentAttachment[];
  auditTrail: DocumentAuditEntry[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  documentId: string;
  documentType: DocumentType;
  partyId: string;
  templateName?: string;
  documentTitle?: string;
  seriesId?: string;
  branch?: string;
  financialYear?: string;
  channels?: DocumentChannel[];
  metadata?: Record<string, unknown>;
  signatures?: DocumentSignature[];
  attachments?: DocumentAttachment[];
}

export interface DocumentLifecycleResult {
  context: DocumentLifecycleContext;
  document: InvoiceDocument;
}
