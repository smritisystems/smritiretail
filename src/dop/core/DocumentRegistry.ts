/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Document Registry (SCS-DXP-001 / DXP-DOC-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * DXP-DOC-001 Compliance Declaration
 * Principle    : Dynamic Document Registry — Industry plugins & core platform modules
 *                register document descriptors dynamically. DocumentStudio discovers
 *                document types via DocumentRegistry.listAll() without hardcoded switch statements.
 */

import { DxpDocumentType } from "../models/DxpTypes.ts";

export interface RegisteredDocumentDescriptor {
  documentType: DxpDocumentType;
  title: string;
  category: "FINANCIAL" | "PROCUREMENT" | "LOGISTICS" | "INVENTORY" | "COMPLIANCE";
  defaultChannel: "PRINT" | "PDF" | "PREVIEW" | "EMAIL" | "WHATSAPP";
  supportedChannels: Array<"PRINT" | "PDF" | "PREVIEW" | "EMAIL" | "WHATSAPP" | "ARCHIVE">;
  requiresSecuritySignature: boolean;
  format?: "A4" | "A5" | "Thermal80mm" | "Label";
  iconName?: string;
  defaultTemplateId?: string;
}

class DocumentRegistryManager {
  private registry: Map<DxpDocumentType, RegisteredDocumentDescriptor> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: RegisteredDocumentDescriptor[] = [
      { documentType: "INVOICE", title: "Tax Invoice & Sales Bill", category: "FINANCIAL", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL", "WHATSAPP", "ARCHIVE"], requiresSecuritySignature: true, format: "A4", iconName: "FileText", defaultTemplateId: "standard-a4" },
      { documentType: "RECEIPT", title: "POS Thermal Sales Receipt", category: "FINANCIAL", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PDF", "PREVIEW", "WHATSAPP"], requiresSecuritySignature: false, format: "Thermal80mm", iconName: "FileSpreadsheet", defaultTemplateId: "thermal-80" },
      { documentType: "PURCHASE_ORDER", title: "Purchase Procurement Order", category: "PROCUREMENT", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL", "WHATSAPP", "ARCHIVE"], requiresSecuritySignature: true, format: "A4", iconName: "ShoppingBag", defaultTemplateId: "standard-a4" },
      { documentType: "GRN", title: "Goods Receipt Note", category: "LOGISTICS", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "ARCHIVE"], requiresSecuritySignature: false, format: "A4", iconName: "Truck", defaultTemplateId: "grn-a4" },
      { documentType: "STOCK_TRANSFER", title: "Stock Transfer Dispatch Note", category: "INVENTORY", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PDF", "PREVIEW"], requiresSecuritySignature: false, format: "A4", iconName: "Layers", defaultTemplateId: "standard-a4" },
      { documentType: "SALES_RETURN", title: "Sales Return Credit Memo", category: "FINANCIAL", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL"], requiresSecuritySignature: true, format: "A4", iconName: "RotateCcw", defaultTemplateId: "standard-a4" },
      { documentType: "PURCHASE_RETURN", title: "Purchase Return Debit Note", category: "PROCUREMENT", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL"], requiresSecuritySignature: true, format: "A4", iconName: "RotateCcw", defaultTemplateId: "standard-a4" },
      { documentType: "PAYMENT_RECEIPT", title: "Payment Receipt Voucher", category: "FINANCIAL", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "WHATSAPP"], requiresSecuritySignature: true, format: "A4", iconName: "CreditCard", defaultTemplateId: "standard-a4" },
      { documentType: "BARCODE_LABEL", title: "Product Thermal Barcode Label", category: "INVENTORY", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PREVIEW"], requiresSecuritySignature: false, format: "Label", iconName: "Tag", defaultTemplateId: "label-50x25" },
      { documentType: "SHELF_LABEL", title: "Shelf Edge Price Tag", category: "INVENTORY", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PREVIEW"], requiresSecuritySignature: false, format: "Label", iconName: "Tag", defaultTemplateId: "label-50x25" },
      { documentType: "REPORT", title: "Analytical Management Statement", category: "COMPLIANCE", defaultChannel: "PDF", supportedChannels: ["PDF", "PREVIEW", "EMAIL", "ARCHIVE"], requiresSecuritySignature: false, format: "A4", iconName: "FileText", defaultTemplateId: "standard-a4" },
      { documentType: "CERTIFICATE", title: "Quality & Compliance Certificate", category: "COMPLIANCE", defaultChannel: "PDF", supportedChannels: ["PDF", "PREVIEW", "PRINT"], requiresSecuritySignature: true, format: "A4", iconName: "Award", defaultTemplateId: "standard-a4" },
      { documentType: "LETTER", title: "Formal Vendor / Customer Notice", category: "COMPLIANCE", defaultChannel: "PDF", supportedChannels: ["PDF", "PREVIEW", "EMAIL"], requiresSecuritySignature: true, format: "A4", iconName: "Mail", defaultTemplateId: "standard-a4" },
    ];

    defaults.forEach((descriptor) => this.registry.set(descriptor.documentType, descriptor));
  }

  public getDescriptor(type: DxpDocumentType): RegisteredDocumentDescriptor {
    const found = this.registry.get(type);
    if (!found) {
      throw new Error(`[SCS-DXP-001] Unregistered document type: ${type}`);
    }
    return found;
  }

  public listAll(): RegisteredDocumentDescriptor[] {
    return Array.from(this.registry.values());
  }

  public listByCategory(category: RegisteredDocumentDescriptor["category"]): RegisteredDocumentDescriptor[] {
    return this.listAll().filter((d) => d.category === category);
  }

  public search(query: string): RegisteredDocumentDescriptor[] {
    if (!query || query.trim() === "") return this.listAll();
    const q = query.toLowerCase().trim();
    return this.listAll().filter(
      (d) => d.title.toLowerCase().includes(q) || d.documentType.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)
    );
  }

  public register(descriptor: RegisteredDocumentDescriptor): void {
    this.registry.set(descriptor.documentType, descriptor);
  }
}

export const DocumentRegistry = new DocumentRegistryManager();
