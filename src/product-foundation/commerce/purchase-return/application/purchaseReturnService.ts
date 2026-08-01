import { ApprovalService } from '../../../workflow/approval/application/approvalService';
import { StockLedgerService } from '../../../inventory/stock-ledger/application/stockLedgerService';
import { GstService } from '../../../finance/gst/application/gstService';
import { PostingService } from '../../../finance/posting/application/postingService';
import { PrintService } from '../../../document/print/application/printService';
import { TaxBreakdown } from '../../../finance/posting/domain/posting';
import { InvoiceDocument, InvoiceLine } from '../../../document/print/domain/invoice';
import { WorkflowContext } from '../../../workflow/approval/domain/workflow';
import { StockLedgerEntry } from '../../../inventory/stock-ledger/domain/stockLedger';
import { DocumentDefinitionRegistry } from '../../../document/application/documentDefinitionRegistry';
import { PipelineFactory } from '../../application/pipelineFactory';
import { BusinessTransactionContext, PipelineStageResult } from '../../contracts/businessTransaction';
import { TransactionStageImplementation } from '../../application/transactionPolicyRegistry';

export interface PurchaseReturnItemRequest {
  itemId: string;
  description: string;
  quantity: number;
  unitCost: number;
  taxRateId: string;
}

export interface PurchaseReturnRequest {
  returnId: string;
  supplierId: string;
  items: PurchaseReturnItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
}

export interface PurchaseReturnContext extends BusinessTransactionContext {
  items: PurchaseReturnItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
  invoiceLines?: InvoiceLine[];
  netAmount?: number;
  taxBreakdown?: TaxBreakdown;
  inventoryResult?: StockLedgerEntry;
  debitNote?: InvoiceDocument;
}

export interface PurchaseReturnResult {
  workflow: WorkflowContext;
  invoiceLines: InvoiceLine[];
  netAmount: number;
  taxBreakdown: TaxBreakdown;
  journalEntry: ReturnType<PostingService['postPurchaseReturn']>;
  debitNote: InvoiceDocument;
  inventoryEntry: StockLedgerEntry;
}

export class PurchaseReturnService {
  private approvalService = new ApprovalService();
  private inventoryService = new StockLedgerService();
  private gstService = new GstService();
  private postingService = new PostingService();
  private printService = new PrintService();

  public executePurchaseReturn(request: PurchaseReturnRequest): PurchaseReturnResult {
    const stageImplementations: TransactionStageImplementation<PurchaseReturnContext> = {
      workflow: (context) => {
        let workflow = this.approvalService.createWorkflow(context.transactionId, context.documentType);
        workflow = this.approvalService.addStep(workflow, 'approval-1', 'Purchase return approval', 1);
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
      pricing: (context) => {
        const invoiceLines = context.items.map((item) => {
          const netAmount = Number((item.unitCost * item.quantity).toFixed(2));
          return {
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitCost,
            netAmount,
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
      movement: (context) => {
        const inventoryResult = this.inventoryService.applyMovement(context.inventoryEntry, {
          id: `pret-${context.transactionId}`,
          quantity: context.inventoryEntry.quantity,
          type: 'out',
        });

        return {
          stage: 'movement',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { inventoryResult },
        };
      },
      tax: (context) => {
        const taxContext = { itemId: 'purchase-return', baseAmount: context.netAmount ?? 0, taxRateId: context.taxRateId };
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
      posting: (context) => {
        const journalEntry = this.postingService.postPurchaseReturn(
          context.transactionId,
          context.partyId,
          `Purchase return ${context.transactionId} to ${context.partyId}`,
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
      print: (context) => {
        const debitNote = this.printService.createInvoiceDocument(
          `DBN-${context.transactionId}`,
          context.partyId,
          context.invoiceLines ?? [],
          context.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
          'SMRITI DEBIT NOTE'
        );

        return {
          stage: 'print',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { debitNote },
        };
      },
      finalize: () => {
        return {
          stage: 'finalize',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: {},
        };
      },
    };

    const initialContext: PurchaseReturnContext = {
      transactionId: request.returnId,
      transactionType: 'PurchaseReturn',
      partyId: request.supplierId,
      partyType: 'supplier',
      documentId: request.returnId,
      documentType: 'PurchaseReturn',
      inventoryEntry: request.inventoryEntry,
      items: request.items,
      taxRules: request.taxRules,
      taxRateId: request.taxRateId,
      metadata: {},
    };

    const definition = DocumentDefinitionRegistry.getDefinition('PurchaseReturn');
    const pipeline = PipelineFactory.fromDocumentDefinition(definition, stageImplementations);
    const result = pipeline.execute(initialContext);
    const finalContext = result.context;

    return {
      workflow: finalContext.workflow!,
      invoiceLines: finalContext.invoiceLines ?? [],
      netAmount: finalContext.netAmount ?? 0,
      taxBreakdown: finalContext.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      journalEntry: finalContext.journalEntry!,
      debitNote: finalContext.debitNote!,
      inventoryEntry: finalContext.inventoryResult ?? { itemId: request.inventoryEntry.itemId, quantity: request.inventoryEntry.quantity },
    };
  }
}
