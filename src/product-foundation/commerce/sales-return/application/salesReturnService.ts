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

export interface SalesReturnItemRequest {
  itemId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRateId: string;
}

export interface SalesReturnRequest {
  returnId: string;
  customerId: string;
  items: SalesReturnItemRequest[];
  inventoryEntry: {
    itemId: string;
    quantity: number;
  };
  taxRules: Array<{ id: string; rate: number; description?: string }>;
  taxRateId: string;
}

export interface SalesReturnContext extends BusinessTransactionContext {
  items: SalesReturnItemRequest[];
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
  creditNote?: InvoiceDocument;
}

export interface SalesReturnResult {
  workflow: WorkflowContext;
  invoiceLines: InvoiceLine[];
  netAmount: number;
  taxBreakdown: TaxBreakdown;
  journalEntry: ReturnType<PostingService['postSalesReturn']>;
  creditNote: InvoiceDocument;
  inventoryEntry: StockLedgerEntry;
}

export class SalesReturnService {
  private approvalService = new ApprovalService();
  private inventoryService = new StockLedgerService();
  private gstService = new GstService();
  private postingService = new PostingService();
  private printService = new PrintService();

  public executeSalesReturn(request: SalesReturnRequest): SalesReturnResult {
    const stageImplementations: TransactionStageImplementation<SalesReturnContext> = {
      workflow: (context) => {
        let workflow = this.approvalService.createWorkflow(context.transactionId, context.documentType);
        workflow = this.approvalService.addStep(workflow, 'approval-1', 'Sales return approval', 1);
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
          const netAmount = Number((item.unitPrice * item.quantity).toFixed(2));
          return {
            itemId: item.itemId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
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
          id: `sret-${context.transactionId}`,
          quantity: context.inventoryEntry.quantity,
          type: 'in',
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
        const taxContext = { itemId: 'sales-return', baseAmount: context.netAmount ?? 0, taxRateId: context.taxRateId };
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
        const journalEntry = this.postingService.postSalesReturn(
          context.transactionId,
          context.partyId,
          `Sales return ${context.transactionId} for ${context.partyId}`,
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
        const creditNote = this.printService.createInvoiceDocument(
          `CRN-${context.transactionId}`,
          context.partyId,
          context.invoiceLines ?? [],
          context.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
          'SMRITI CREDIT NOTE'
        );

        return {
          stage: 'print',
          success: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          data: { creditNote },
        };
      },
      finalize: (context) => {
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

    const initialContext: SalesReturnContext = {
      transactionId: request.returnId,
      transactionType: 'SalesReturn',
      partyId: request.customerId,
      partyType: 'customer',
      documentId: request.returnId,
      documentType: 'SalesReturn',
      inventoryEntry: request.inventoryEntry,
      items: request.items,
      taxRules: request.taxRules,
      taxRateId: request.taxRateId,
      metadata: {},
    };

    const definition = DocumentDefinitionRegistry.getDefinition('SalesReturn');
    const pipeline = PipelineFactory.fromDocumentDefinition(definition, stageImplementations);
    const result = pipeline.execute(initialContext);
    const finalContext = result.context;

    return {
      workflow: finalContext.workflow!,
      invoiceLines: finalContext.invoiceLines ?? [],
      netAmount: finalContext.netAmount ?? 0,
      taxBreakdown: finalContext.taxBreakdown ?? { cgst: 0, sgst: 0, igst: 0, totalTax: 0 },
      journalEntry: finalContext.journalEntry!,
      creditNote: finalContext.creditNote!,
      inventoryEntry: finalContext.inventoryResult ?? { itemId: request.inventoryEntry.itemId, quantity: request.inventoryEntry.quantity },
    };
  }
}
