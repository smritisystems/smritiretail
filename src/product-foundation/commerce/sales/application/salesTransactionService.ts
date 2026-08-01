import { ApprovalService } from '../../../workflow/approval/application/approvalService';
import { PricingService } from '../../pricing/application/pricingService';
import { PriceRule } from '../../pricing/domain/pricing';
import { StockLedgerService } from '../../../inventory/stock-ledger/application/stockLedgerService';
import { ReservationService } from '../../../inventory/reservation/application/reservationService';
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
import { BusinessTransactionContext, PipelineStageResult } from '../../contracts/businessTransaction';
import { DocumentChannel, DocumentLifecycleResult } from '../../../document/domain/documentLifecycle';
import { DocumentDefinitionRegistry } from '../../../document/application/documentDefinitionRegistry';
import { PipelineFactory } from '../../application/pipelineFactory';
import { StockLedgerEntry } from '../../../inventory/stock-ledger/domain/stockLedger';

export interface SaleItemRequest {
  itemId: string;
  description: string;
  quantity: number;
  basePrice: number;
  taxRateId: string;
}

export interface SalesTransactionRequest {
  saleId: string;
  customerId: string;
  customerTier?: string;
  items: SaleItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  pricingRules: PriceRule[];
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
  paymentLines?: PaymentLine[];
  documentSeriesId?: string;
  documentChannels?: DocumentChannel[];
  templateName?: string;
  documentTitle?: string;
  metadata?: Record<string, unknown>;
}

export interface SalesTransactionContext extends BusinessTransactionContext {
  customerTier?: string;
  items: SaleItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  pricingRules: PriceRule[];
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
  paymentLines?: PaymentLine[];
  documentSeriesId?: string;
  documentChannels?: DocumentChannel[];
  templateName?: string;
  documentTitle?: string;
  metadata?: Record<string, unknown>;
  reservedInventory?: StockLedgerEntry;
  finalInventory?: StockLedgerEntry;
  documentLifecycleResult?: DocumentLifecycleResult;
}

export interface SalesTransactionResult {
  workflow: WorkflowContext;
  invoiceLines: InvoiceLine[];
  netAmount: number;
  taxBreakdown: TaxBreakdown;
  journalEntry: ReturnType<PostingService['postSalesTransaction']>;
  invoice: InvoiceDocument;
  documentContext: import('../../../document/domain/documentLifecycle').DocumentLifecycleContext;
  reservedInventory: { itemId: string; quantity: number };
  finalInventory: { itemId: string; quantity: number };
  paymentResult?: ReturnType<PaymentService['processPayment']>;
  outstanding: number;
  transactionContext?: SalesTransactionContext;
}

export class SalesTransactionService {
  private approvalService = new ApprovalService();
  private pricingService = new PricingService();
  private inventoryService = new StockLedgerService();
  private reservationService = new ReservationService();
  private gstService = new GstService();
  private postingService = new PostingService();
  private ledgerService = new LedgerService();
  private paymentService = new PaymentService(this.postingService, this.ledgerService);
  private printService = new PrintService();
  private documentLifecycleService = new DocumentLifecycleService();

  public executeSale(request: SalesTransactionRequest): SalesTransactionResult {
    const stageImplementations: TransactionStageImplementation<SalesTransactionContext> = {
      workflow: (context: SalesTransactionContext) => {
        let workflow = this.approvalService.createWorkflow(context.transactionId, context.documentType);
        workflow = this.approvalService.addStep(workflow, 'approval-1', 'Sales approval', 1);
        const submitted = this.approvalService.submitWorkflow(workflow);
        const currentStep = this.approvalService.getCurrentStep(submitted);
        const approved = currentStep ? this.approvalService.approveStep(submitted, currentStep.id) : submitted;

        return {
          stage: 'workflow',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { workflow: approved },
        };
      },
      pricing: (context: SalesTransactionContext) => {
        const invoiceLines = context.items.map((item) => {
          const unitPrice = this.pricingService.calculatePrice(
            { itemId: item.itemId, baseAmount: item.basePrice, quantity: item.quantity, customerTier: context.customerTier },
            context.pricingRules
          );

          return {
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice,
            netAmount: Number((unitPrice * item.quantity).toFixed(2)),
          };
        });

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
      reservation: (context: SalesTransactionContext) => {
        const totalQuantity = context.items.reduce((sum, item) => sum + item.quantity, 0);
        const reservedInventory = this.reservationService.reserve(context.inventoryEntry, totalQuantity);
        return {
          stage: 'reservation',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { reservedInventory },
        };
      },
      movement: (context: SalesTransactionContext) => {
        const totalQuantity = context.items.reduce((sum, item) => sum + item.quantity, 0);
        const finalInventory = this.inventoryService.applyMovement(context.reservedInventory!, {
          id: `sale-${context.transactionId}`,
          quantity: totalQuantity,
          type: 'out',
          consumeReserved: true,
        });
        return {
          stage: 'movement',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { finalInventory },
        };
      },
      tax: (context: SalesTransactionContext) => {
        const taxContext = { itemId: 'sales', baseAmount: context.netAmount ?? 0, taxRateId: context.taxRateId };
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
      document: (context: SalesTransactionContext) => {
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
      ledger: (context: SalesTransactionContext) => {
        this.ledgerService.recordInvoice(
          'customer',
          context.partyId,
          context.transactionId,
          Number(((context.netAmount ?? 0) + (context.taxBreakdown?.totalTax ?? 0)).toFixed(2)),
          `Sales invoice ${context.transactionId}`
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
      payment: (context: SalesTransactionContext) => {
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
          partyType: 'customer',
          invoiceId: context.invoice?.invoiceId,
          description: `Payment for sale ${context.transactionId}`,
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
      finalize: (context: SalesTransactionContext) => {
        return {
          stage: 'finalize',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { outstanding: this.ledgerService.getOutstanding('customer', context.partyId) },
        };
      },
    };

    const transactionContext: SalesTransactionContext = {
      transactionId: request.saleId,
      transactionType: 'Sales',
      partyId: request.customerId,
      partyType: 'customer',
      documentId: request.saleId,
      documentType: 'SalesInvoice',
      branch: undefined,
      financialYear: undefined,
      metadata: request.metadata,
      customerTier: request.customerTier,
      items: request.items,
      inventoryEntry: request.inventoryEntry,
      pricingRules: request.pricingRules,
      taxRules: request.taxRules,
      taxRateId: request.taxRateId,
      paymentLines: request.paymentLines,
      documentSeriesId: request.documentSeriesId,
      documentChannels: request.documentChannels,
      templateName: request.templateName,
      documentTitle: request.documentTitle,
    };

    const definition = DocumentDefinitionRegistry.getDefinition('SalesInvoice');
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
      reservedInventory: finalContext.reservedInventory ?? { itemId: request.inventoryEntry.itemId, quantity: request.inventoryEntry.quantity },
      finalInventory: finalContext.finalInventory ?? { itemId: request.inventoryEntry.itemId, quantity: request.inventoryEntry.quantity },
      paymentResult: finalContext.paymentResult,
      outstanding: finalContext.outstanding ?? 0,
      transactionContext: finalContext,
    };
  }
}
