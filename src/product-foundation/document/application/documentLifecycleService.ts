import { NumberingEngine } from '../../../services/numberingEngine';
import { WorkflowEngine } from '../../../services/workflowEngine';
import { PrintService } from '../print/application/printService';
import { InvoiceDocument, InvoiceLine } from '../print/domain/invoice';
import {
  CreateDocumentRequest,
  DocumentAuditEntry,
  DocumentChannel,
  DocumentLifecycleContext,
  DocumentLifecycleResult,
  DocumentSignature,
} from '../domain/documentLifecycle';

export class DocumentLifecycleService {
  private readonly printService = new PrintService();
  private readonly workflowEngine = WorkflowEngine;

  public createDocument(
    request: CreateDocumentRequest,
    invoicePayload: {
      customerId: string;
      lines: InvoiceLine[];
      taxBreakdown: { cgst: number; sgst: number; igst: number; totalTax: number };
      documentTitle?: string;
    }
  ): DocumentLifecycleResult {
    const documentNumber = this.allocateDocumentNumber(request.seriesId, {
      branch: request.branch,
      fy: request.financialYear,
    }, request.documentId);

    const documentTitle = request.documentTitle ?? invoicePayload.documentTitle ?? this.getDefaultTitle(request.documentType);

    const document = this.printService.createInvoiceDocument(
      documentNumber,
      invoicePayload.customerId,
      invoicePayload.lines,
      invoicePayload.taxBreakdown,
      documentTitle
    );

    const now = this.nowIso();
    const context: DocumentLifecycleContext = {
      documentId: request.documentId,
      documentType: request.documentType,
      documentNumber,
      templateName: request.templateName ?? documentTitle,
      status: 'Draft',
      channels: request.channels ?? ['Print'],
      signatures: request.signatures ?? [],
      attachments: request.attachments ?? [],
      auditTrail: [this.createAuditEntry(request.documentId, 'CREATE', 'System', 'Document created')],
      metadata: request.metadata ?? {
        partyId: request.partyId,
        documentType: request.documentType,
      },
      createdAt: now,
      updatedAt: now,
    };

    return {
      context,
      document,
    };
  }

  public submitDocument(context: DocumentLifecycleContext, userRole = 'Admin'): DocumentLifecycleContext {
    return this.applyAction(context, 'submit', userRole, 'Document submitted');
  }

  public approveDocument(context: DocumentLifecycleContext, userRole = 'Admin'): DocumentLifecycleContext {
    return this.applyAction(context, 'approve', userRole, 'Document approved');
  }

  public rejectDocument(context: DocumentLifecycleContext, userRole = 'Admin', notes?: string): DocumentLifecycleContext {
    return this.applyAction(context, 'reject', userRole, notes ?? 'Document rejected');
  }

  public cancelDocument(context: DocumentLifecycleContext, userRole = 'Admin', notes?: string): DocumentLifecycleContext {
    return this.applyAction(context, 'cancel', userRole, notes ?? 'Document cancelled');
  }

  public getAvailableActions(context: DocumentLifecycleContext, userRole = 'Admin'): string[] {
    return this.workflowEngine.getAvailableActions(context.documentType, context.status, userRole);
  }

  private applyAction(
    context: DocumentLifecycleContext,
    action: string,
    userRole: string,
    notes?: string
  ): DocumentLifecycleContext {
    if (!this.workflowEngine.canTransition(context.documentType, context.status, action, userRole)) {
      throw new Error(`Document ${context.documentNumber} cannot perform action '${action}' from status '${context.status}'.`);
    }

    const nextStatus = this.workflowEngine.getNextStatus(context.documentType, action);
    const auditEntry = this.createAuditEntry(context.documentId, action.toUpperCase(), userRole, notes ?? `${action} action applied`, {
      from: context.status,
      to: nextStatus,
    });

    return {
      ...context,
      status: nextStatus,
      updatedAt: this.nowIso(),
      auditTrail: [...context.auditTrail, auditEntry],
    };
  }

  private allocateDocumentNumber(
    seriesId: string | undefined,
    context: { branch?: string; fy?: string },
    documentId: string
  ): string {
    if (!seriesId) {
      return `${documentId}`;
    }

    const series = NumberingEngine.getAllSeries().find((s) => s.id === seriesId);
    if (!series) {
      return `${documentId}`;
    }

    return NumberingEngine.formatPreview(series, {
      branch: context.branch,
      fy: context.fy,
      date: new Date().toISOString(),
      user: 'System',
    });
  }

  private createAuditEntry(
    documentId: string,
    action: string,
    actor: string,
    notes: string,
    metadata?: Record<string, unknown>
  ): DocumentAuditEntry {
    return {
      id: `${documentId}-${action}-${Date.now()}`,
      timestamp: this.nowIso(),
      action,
      actor,
      notes,
      metadata,
    };
  }

  private getDefaultTitle(documentType: string): string {
    if (documentType === 'PurchaseInvoice') {
      return 'SMRITI PURCHASE INVOICE';
    }

    return 'SMRITI RETAIL INVOICE';
  }

  private nowIso(): string {
    return new Date().toISOString();
  }
}
