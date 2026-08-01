import { ApprovalService } from '../../../workflow/approval/application/approvalService';
import { StockLedgerService } from '../../../inventory/stock-ledger/application/stockLedgerService';
import { GstService } from '../../../finance/gst/application/gstService';
import { PostingService } from '../../../finance/posting/application/postingService';
import { PaymentService } from '../../../finance/payment/application/paymentService';
import { LedgerService } from '../../../finance/ledger/application/ledgerService';
import { DocumentLifecycleService } from '../../../document/application/documentLifecycleService';
import { PrintService } from '../../../document/print/application/printService';
import { TaxBreakdown } from '../../../finance/posting/domain/posting';
import { InvoiceDocument, InvoiceLine } from '../../../document/print/domain/invoice';
import { WorkflowContext } from '../../../workflow/approval/domain/workflow';
import { PaymentLine } from '../../../finance/payment/domain/payment';
import { TransactionStageImplementation } from '../../application/transactionPolicyRegistry';
import { BusinessTransactionContext } from '../../contracts/businessTransaction';
import { DocumentChannel, DocumentLifecycleResult } from '../../../document/domain/documentLifecycle';
import { DocumentDefinitionRegistry } from '../../../document/application/documentDefinitionRegistry';
import { PipelineFactory } from '../../application/pipelineFactory';
import { StockLedgerEntry } from '../../../inventory/stock-ledger/domain/stockLedger';

export interface PurchaseItemRequest {
  itemId: string;
  description: string;
  quantity: number;
  unitCost: number;
  taxRateId: string;
}

export interface PurchaseTransactionRequest {
  purchaseId: string;
  supplierId: string;
  items: PurchaseItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
  paymentLines?: PaymentLine[];
  documentSeriesId?: string;
  documentChannels?: DocumentChannel[];
  templateName?: string;
  documentTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface PurchaseTransactionContext extends BusinessTransactionContext {
  items: PurchaseItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
  paymentLines?: PaymentLine[];
  documentSeriesId?: string;
  documentChannels?: DocumentChannel[];
  templateName?: string;
  documentTitle?: string;
  metadata?: Record<string, unknown>;
  finalInventory?: StockLedgerEntry;
  documentLifecycleResult?: DocumentLifecycleResult;
}

export interface PurchaseTransactionResult {
  workflow: WorkflowContext;
  invoiceLines: InvoiceLine[];
  netAmount: number;
  taxBreakdown: TaxBreakdown;
  journalEntry: ReturnType<PostingService['postPurchaseTransaction']>;
  invoice: InvoiceDocument;
  documentContext: import('../../../document/domain/documentLifecycle').DocumentLifecycleContext;
  inventoryEntry: { itemId: string; quantity: number };
  paymentResult?: ReturnType<PaymentService['processPayment']>;
  outstanding: number;
  transactionContext?: PurchaseTransactionContext;
}

export class PurchaseTransactionService {
  private approvalService = new ApprovalService();
  private inventoryService = new StockLedgerService();
  private gstService = new GstService();
  private postingService = new PostingService();
  private ledgerService = new LedgerService();
  private paymentService = new PaymentService(this.postingService, this.ledgerService);
  private documentLifecycleService = new DocumentLifecycleService();
  private printService = new PrintService();

  public executePurchase(request: PurchaseTransactionRequest): PurchaseTransactionResult {
    const stageImplementations: TransactionStageImplementation<PurchaseTransactionContext> = {
      workflow: (context: PurchaseTransactionContext) => {
        const workflow = this.approvalService.createWorkflow(context.transactionId, context.documentType);
        const submitted = this.approvalService.submitWorkflow(workflow);
        const approved = this.approvalService.approveWorkflow(submitted);

        return {
          stage: 'workflow',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { workflow: approved },
        };
      },
      pricing: (context: PurchaseTransactionContext) => {
        const invoiceLines = context.items.map((item) => ({
          itemId: item.itemId,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitCost,
          netAmount: Number((item.unitCost * item.quantity).toFixed(2)),
        }));

        const netAmount = Number(invoiceLines.reduce((sum, line) => sum + line.netAmount, 0).toFixed(2));
        return {
          stage: 'pricing',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { invoiceLines, netAmount },
        };
      },
      movement: (context: PurchaseTransactionContext) => {
        const finalInventory = context.items.reduce((currentEntry, item) => {
          return this.inventoryService.applyMovement(currentEntry, {
            id: `pur-${context.transactionId}-${item.itemId}`,
            quantity: item.quantity,
            type: 'in',
            unitCost: item.unitCost,
          });
        }, context.inventoryEntry);

        return {
          stage: 'movement',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { finalInventory },
        };
      },
      tax: (context: PurchaseTransactionContext) => {
        const taxContext = { itemId: 'purchase', baseAmount: context.netAmount ?? 0, taxRateId: context.taxRateId };
        const cgst = this.gstService.calculateTax(taxContext, context.taxRules);
        const sgst = this.gstService.calculateTax(taxContext, context.taxRules);
        const igst = 0;
        const totalTax = Number((cgst + sgst + igst).toFixed(2));

        return {
          stage: 'tax',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { taxBreakdown: { cgst, sgst, igst, totalTax } },
        };
      },
      posting: (context: PurchaseTransactionContext) => {
        const journalEntry = this.postingService.postPurchaseTransaction(
          context.transactionId,
          context.partyId,
          `Purchase ${context.transactionId} from ${context.partyId}`,
          context.netAmount ?? 0,
          context.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 }
        );

        return {
          stage: 'posting',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { journalEntry },
        };
      },
      document: (context: PurchaseTransactionContext) => {
        const documentResult = this.documentLifecycleService.createDocument(
          {
            documentId: context.transactionId,
            documentType: context.documentType,
            partyId: context.partyId,
            templateName: context.templateName,
            documentTitle: context.documentTitle,
            seriesId: context.documentSeriesId,
            branch: context.branch,
            financialYear: context.financialYear,
            channels: context.documentChannels,
            metadata: context.metadata,
          },
          {
            customerId: context.partyId,
            lines: context.invoiceLines ?? [],
            taxBreakdown: context.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
            documentTitle: context.documentTitle,
          }
        );

        const submittedDocument = this.documentLifecycleService.submitDocument(documentResult.context);
        const approvedDocument = this.documentLifecycleService.approveDocument(submittedDocument);

        return {
          stage: 'document',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: {
            invoice: documentResult.document,
            documentContext: approvedDocument,
            documentLifecycleResult: documentResult,
          },
        };
      },
      ledger: (context: PurchaseTransactionContext) => {
        this.ledgerService.recordInvoice(
          'supplier',
          context.partyId,
          context.transactionId,
          Number(((context.netAmount ?? 0) + (context.taxBreakdown?.totalTax ?? 0)).toFixed(2)),
          `Purchase invoice ${context.transactionId}`
        );

        return {
          stage: 'ledger',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: {},
        };
      },
      payment: (context: PurchaseTransactionContext) => {
        if (!context.paymentLines?.length) {
          return {
            stage: 'payment',
            success: true,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            durationMs: 0,
            data: {},
          };
        }

        const paymentResult = this.paymentService.processPayment({
          paymentId: `pay-${context.transactionId}`,
          partyId: context.partyId,
          partyType: 'supplier',
          invoiceId: context.invoice?.invoiceId,
          description: `Payment for purchase ${context.transactionId}`,
          lines: context.paymentLines,
        });

        return {
          stage: 'payment',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { paymentResult },
        };
      },
      finalize: (context: PurchaseTransactionContext) => {
        return {
          stage: 'finalize',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { outstanding: this.ledgerService.getOutstanding('supplier', context.partyId) },
        };
      },
    };

    const transactionContext: PurchaseTransactionContext = {
      transactionId: request.purchaseId,
      transactionType: 'Purchase',
      partyId: request.supplierId,
      partyType: 'supplier',
      documentId: request.purchaseId,
      documentType: 'PurchaseInvoice',
      branch: undefined,
      financialYear: undefined,
      metadata: request.metadata,
      items: request.items,
      inventoryEntry: request.inventoryEntry,
      taxRules: request.taxRules,
      taxRateId: request.taxRateId,
      paymentLines: request.paymentLines,
      documentSeriesId: request.documentSeriesId,
      documentChannels: request.documentChannels,
      templateName: request.templateName,
      documentTitle: request.documentTitle,
    };

    const definition = DocumentDefinitionRegistry.getDefinition('PurchaseInvoice');
    const pipeline = PipelineFactory.fromDocumentDefinition(definition, stageImplementations);
    const result = pipeline.execute(transactionContext);
    const finalContext = result.context;

    return {
      workflow: finalContext.workflow!,
      invoiceLines: finalContext.invoiceLines ?? [],
      netAmount: finalContext.netAmount ?? 0,
      taxBreakdown: finalContext.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      journalEntry: finalContext.journalEntry!,
      invoice: finalContext.invoice!,
      documentContext: finalContext.documentContext!,
      inventoryEntry: finalContext.finalInventory ?? request.inventoryEntry,
      paymentResult: finalContext.paymentResult,
      outstanding: finalContext.outstanding ?? 0,
      transactionContext: finalContext,
    };
  }
}
