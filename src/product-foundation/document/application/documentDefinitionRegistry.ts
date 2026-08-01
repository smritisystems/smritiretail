import { DocumentChannel, DocumentType } from '../domain/documentLifecycle';
import {
  TransactionPolicyDefinition,
  TransactionPolicyRegistry,
} from '../../commerce/application/transactionPolicyRegistry';
import { WorkflowPolicyDefinition, WorkflowPolicyRegistry } from '../../workflow/approval/application/workflowPolicyRegistry';
import {
  NumberingPolicyDefinition,
  NumberingPolicyRegistry,
} from '../numbering/application/numberingPolicyRegistry';
import { PrintPolicyDefinition, PrintPolicyRegistry } from '../print/application/printPolicyRegistry';
import {
  DocumentPolicyDefinition,
  DocumentPolicyRegistry,
} from './documentPolicyRegistry';
import {
  NotificationPolicyDefinition,
  NotificationPolicyRegistry,
} from '../../commerce/application/notificationPolicyRegistry';

export type DocumentCategory = 'sales' | 'purchase' | 'inventory' | 'finance' | 'other';

export interface PermissionPolicy {
  id: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface InventoryPolicy {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface FinancePolicy {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditPolicy {
  id: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DocumentCapabilities {
  supportsReservation?: boolean;
  supportsInventory?: boolean;
  supportsNumbering?: boolean;
  supportsPrinting?: boolean;
  supportsNotification?: boolean;
  supportsApproval?: boolean;
  supportsPayment?: boolean;
  supportsAudit?: boolean;
  supportsFinance?: boolean;
}

export interface DocumentDefinition {
  id: string;
  documentType: DocumentType;
  displayName: string;
  category: DocumentCategory;
  enabled?: boolean;
  transactionPolicy: TransactionPolicyDefinition;
  workflowPolicy: WorkflowPolicyDefinition;
  documentPolicy: DocumentPolicyDefinition;
  numberingPolicy: NumberingPolicyDefinition;
  printPolicy: PrintPolicyDefinition;
  notificationPolicy: NotificationPolicyDefinition;
  permissions?: PermissionPolicy;
  inventoryPolicy?: InventoryPolicy;
  financePolicy?: FinancePolicy;
  auditPolicy?: AuditPolicy;
  capabilities?: DocumentCapabilities;
  metadata?: Record<string, unknown>;
}

type RequiredDocumentDefinitionFields = {
  transactionPolicy: TransactionPolicyDefinition;
  workflowPolicy: WorkflowPolicyDefinition;
  documentPolicy: DocumentPolicyDefinition;
  numberingPolicy: NumberingPolicyDefinition;
  printPolicy: PrintPolicyDefinition;
  notificationPolicy: NotificationPolicyDefinition;
};

export class DocumentDefinitionBuilder<T extends Partial<DocumentDefinition> = Partial<DocumentDefinition>> {
  private readonly definition: Partial<DocumentDefinition>;

  private constructor(definition: Partial<DocumentDefinition>) {
    this.definition = definition;
  }

  public static create(
    id: string,
    documentType: DocumentType,
    displayName: string,
    category: DocumentCategory
  ): DocumentDefinitionBuilder<Pick<DocumentDefinition, 'id' | 'documentType' | 'displayName' | 'category'>> {
    return new DocumentDefinitionBuilder({
      id,
      documentType,
      displayName,
      category,
      enabled: true,
    });
  }

  public documentPolicy(
    documentPolicy: DocumentPolicyDefinition
  ): DocumentDefinitionBuilder<T & { documentPolicy: DocumentPolicyDefinition }> {
    return new DocumentDefinitionBuilder({ ...this.definition, documentPolicy });
  }

  public transactionPolicy(
    transactionPolicy: TransactionPolicyDefinition
  ): DocumentDefinitionBuilder<T & { transactionPolicy: TransactionPolicyDefinition }> {
    return new DocumentDefinitionBuilder({ ...this.definition, transactionPolicy });
  }

  public workflowPolicy(
    workflowPolicy: WorkflowPolicyDefinition
  ): DocumentDefinitionBuilder<T & { workflowPolicy: WorkflowPolicyDefinition }> {
    return new DocumentDefinitionBuilder({ ...this.definition, workflowPolicy });
  }

  public numberingPolicy(
    numberingPolicy: NumberingPolicyDefinition
  ): DocumentDefinitionBuilder<T & { numberingPolicy: NumberingPolicyDefinition }> {
    return new DocumentDefinitionBuilder({ ...this.definition, numberingPolicy });
  }

  public printPolicy(
    printPolicy: PrintPolicyDefinition
  ): DocumentDefinitionBuilder<T & { printPolicy: PrintPolicyDefinition }> {
    return new DocumentDefinitionBuilder({ ...this.definition, printPolicy });
  }

  public notificationPolicy(
    notificationPolicy: NotificationPolicyDefinition
  ): DocumentDefinitionBuilder<T & { notificationPolicy: NotificationPolicyDefinition }> {
    return new DocumentDefinitionBuilder({ ...this.definition, notificationPolicy });
  }

  public permissions(policy: PermissionPolicy): DocumentDefinitionBuilder<T & { permissions: PermissionPolicy }> {
    return new DocumentDefinitionBuilder({ ...this.definition, permissions: policy });
  }

  public inventoryPolicy(policy: InventoryPolicy): DocumentDefinitionBuilder<T & { inventoryPolicy: InventoryPolicy }> {
    return new DocumentDefinitionBuilder({ ...this.definition, inventoryPolicy: policy });
  }

  public financePolicy(policy: FinancePolicy): DocumentDefinitionBuilder<T & { financePolicy: FinancePolicy }> {
    return new DocumentDefinitionBuilder({ ...this.definition, financePolicy: policy });
  }

  public auditPolicy(policy: AuditPolicy): DocumentDefinitionBuilder<T & { auditPolicy: AuditPolicy }> {
    return new DocumentDefinitionBuilder({ ...this.definition, auditPolicy: policy });
  }

  public capabilities(capabilities: DocumentCapabilities): DocumentDefinitionBuilder<T & { capabilities: DocumentCapabilities }> {
    return new DocumentDefinitionBuilder({ ...this.definition, capabilities });
  }

  public metadata(metadata: Record<string, unknown>): DocumentDefinitionBuilder<T & { metadata: Record<string, unknown> }> {
    return new DocumentDefinitionBuilder({ ...this.definition, metadata });
  }

  public enabled(enabled: boolean): DocumentDefinitionBuilder<T & { enabled: boolean }> {
    return new DocumentDefinitionBuilder({ ...this.definition, enabled });
  }

  public build(
    this: DocumentDefinitionBuilder<T & RequiredDocumentDefinitionFields>
  ): DocumentDefinition {
    return this.definition as DocumentDefinition;
  }
}

export class DocumentDefinitionRegistryService {
  private readonly definitions = new Map<string, DocumentDefinition>();

  public registerDefinition(definition: DocumentDefinition): void {
    const key = definition.id.toLowerCase();
    if (this.definitions.has(key)) {
      throw new Error(`Document definition '${definition.id}' is already registered.`);
    }
    this.definitions.set(key, { ...definition });
  }

  public getDefinition(id: string): DocumentDefinition {
    const definition = this.definitions.get(id.toLowerCase());
    if (!definition) {
      throw new Error(`Document definition '${id}' is not registered.`);
    }
    return definition;
  }

  public listDefinitions(): DocumentDefinition[] {
    return Array.from(this.definitions.values());
  }

  public hasDefinition(id: string): boolean {
    return this.definitions.has(id.toLowerCase());
  }

  public clear(): void {
    this.definitions.clear();
  }
}

export const DocumentDefinitionRegistry = new DocumentDefinitionRegistryService();

DocumentDefinitionRegistry.registerDefinition(
  DocumentDefinitionBuilder.create('SalesInvoice', 'SalesInvoice', 'Sales Invoice', 'sales')
    .documentPolicy(DocumentPolicyRegistry.getPolicy('DefaultSalesInvoiceDocument'))
    .transactionPolicy(TransactionPolicyRegistry.getPolicy('SalesInvoice'))
    .workflowPolicy(WorkflowPolicyRegistry.getPolicy('SalesInvoiceApprovalPolicy'))
    .numberingPolicy(NumberingPolicyRegistry.getPolicy('SalesInvoiceNumberingPolicy'))
    .printPolicy(PrintPolicyRegistry.getPolicy('SalesInvoicePrintPolicy'))
    .notificationPolicy(NotificationPolicyRegistry.getPolicy('SalesInvoiceNotificationPolicy'))
    .capabilities({
      supportsReservation: true,
      supportsInventory: true,
      supportsNumbering: true,
      supportsPrinting: true,
      supportsNotification: true,
      supportsApproval: true,
      supportsPayment: true,
      supportsFinance: true,
    })
    .metadata({ description: 'Canonical definition for sales invoice processing.' })
    .build()
);

DocumentDefinitionRegistry.registerDefinition(
  DocumentDefinitionBuilder.create('PurchaseInvoice', 'PurchaseInvoice', 'Purchase Invoice', 'purchase')
    .documentPolicy(DocumentPolicyRegistry.getPolicy('DefaultPurchaseInvoiceDocument'))
    .transactionPolicy(TransactionPolicyRegistry.getPolicy('PurchaseInvoice'))
    .workflowPolicy(WorkflowPolicyRegistry.getPolicy('PurchaseInvoiceApprovalPolicy'))
    .numberingPolicy(NumberingPolicyRegistry.getPolicy('PurchaseInvoiceNumberingPolicy'))
    .printPolicy(PrintPolicyRegistry.getPolicy('PurchaseInvoicePrintPolicy'))
    .notificationPolicy(NotificationPolicyRegistry.getPolicy('PurchaseInvoiceNotificationPolicy'))
    .capabilities({
      supportsInventory: true,
      supportsNumbering: true,
      supportsPrinting: true,
      supportsApproval: true,
      supportsPayment: true,
      supportsFinance: true,
    })
    .metadata({ description: 'Canonical definition for purchase invoice processing.' })
    .build()
);

DocumentDefinitionRegistry.registerDefinition(
  DocumentDefinitionBuilder.create('SalesReturn', 'SalesReturn', 'Sales Return', 'sales')
    .documentPolicy(DocumentPolicyRegistry.getPolicy('DefaultSalesReturnDocument'))
    .transactionPolicy(TransactionPolicyRegistry.getPolicy('SalesReturn'))
    .workflowPolicy(WorkflowPolicyRegistry.getPolicy('SalesReturnApprovalPolicy'))
    .numberingPolicy(NumberingPolicyRegistry.getPolicy('SalesReturnNumberingPolicy'))
    .printPolicy(PrintPolicyRegistry.getPolicy('SalesReturnPrintPolicy'))
    .notificationPolicy(NotificationPolicyRegistry.getPolicy('SalesReturnNotificationPolicy'))
    .capabilities({
      supportsInventory: true,
      supportsNumbering: true,
      supportsPrinting: true,
      supportsApproval: true,
      supportsFinance: true,
      supportsNotification: true,
    })
    .metadata({ description: 'Canonical definition for sales return processing.' })
    .build()
);

DocumentDefinitionRegistry.registerDefinition(
  DocumentDefinitionBuilder.create('PurchaseReturn', 'PurchaseReturn', 'Purchase Return', 'purchase')
    .documentPolicy(DocumentPolicyRegistry.getPolicy('DefaultPurchaseReturnDocument'))
    .transactionPolicy(TransactionPolicyRegistry.getPolicy('PurchaseReturn'))
    .workflowPolicy(WorkflowPolicyRegistry.getPolicy('PurchaseReturnApprovalPolicy'))
    .numberingPolicy(NumberingPolicyRegistry.getPolicy('PurchaseReturnNumberingPolicy'))
    .printPolicy(PrintPolicyRegistry.getPolicy('PurchaseReturnPrintPolicy'))
    .notificationPolicy(NotificationPolicyRegistry.getPolicy('PurchaseReturnNotificationPolicy'))
    .capabilities({
      supportsInventory: true,
      supportsNumbering: true,
      supportsPrinting: true,
      supportsApproval: true,
      supportsFinance: true,
      supportsNotification: true,
    })
    .metadata({ description: 'Canonical definition for purchase return processing.' })
    .build()
);

DocumentDefinitionRegistry.registerDefinition(
  DocumentDefinitionBuilder.create('StockTransfer', 'StockTransfer', 'Stock Transfer', 'inventory')
    .documentPolicy(DocumentPolicyRegistry.getPolicy('DefaultStockTransferDocument'))
    .transactionPolicy(TransactionPolicyRegistry.getPolicy('StockTransfer'))
    .workflowPolicy(WorkflowPolicyRegistry.getPolicy('StockTransferApprovalPolicy'))
    .numberingPolicy(NumberingPolicyRegistry.getPolicy('StockTransferNumberingPolicy'))
    .printPolicy(PrintPolicyRegistry.getPolicy('StockTransferPrintPolicy'))
    .notificationPolicy(NotificationPolicyRegistry.getPolicy('StockTransferNotificationPolicy'))
    .capabilities({
      supportsInventory: true,
      supportsNumbering: true,
      supportsPrinting: true,
      supportsApproval: true,
      supportsFinance: true,
      supportsNotification: true,
    })
    .metadata({ description: 'Canonical definition for stock transfer processing.' })
    .build()
);

DocumentDefinitionRegistry.registerDefinition(
  DocumentDefinitionBuilder.create('PhysicalStock', 'PhysicalStock', 'Physical Stock Adjustment', 'inventory')
    .documentPolicy(DocumentPolicyRegistry.getPolicy('DefaultPhysicalStockDocument'))
    .transactionPolicy(TransactionPolicyRegistry.getPolicy('PhysicalStock'))
    .workflowPolicy(WorkflowPolicyRegistry.getPolicy('PhysicalStockApprovalPolicy'))
    .numberingPolicy(NumberingPolicyRegistry.getPolicy('PhysicalStockNumberingPolicy'))
    .printPolicy(PrintPolicyRegistry.getPolicy('PhysicalStockPrintPolicy'))
    .notificationPolicy(NotificationPolicyRegistry.getPolicy('PhysicalStockNotificationPolicy'))
    .capabilities({
      supportsInventory: true,
      supportsNumbering: true,
      supportsPrinting: true,
      supportsApproval: true,
      supportsFinance: true,
      supportsNotification: true,
    })
    .metadata({ description: 'Canonical definition for physical stock adjustment processing.' })
    .build()
);
