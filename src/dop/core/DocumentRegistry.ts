/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Document Registry (SCS-DXP-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 */

import { DxpDocumentType } from "../models/DxpTypes.ts";

export interface RegisteredDocumentDescriptor {
  documentType: DxpDocumentType;
  title: string;
  category: "FINANCIAL" | "PROCUREMENT" | "LOGISTICS" | "INVENTORY" | "COMPLIANCE";
  defaultChannel: "PRINT" | "PDF" | "PREVIEW" | "EMAIL" | "WHATSAPP";
  supportedChannels: Array<"PRINT" | "PDF" | "PREVIEW" | "EMAIL" | "WHATSAPP" | "ARCHIVE">;
  requiresSecuritySignature: boolean;
}

class DocumentRegistryManager {
  private registry: Map<DxpDocumentType, RegisteredDocumentDescriptor> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: RegisteredDocumentDescriptor[] = [
      { documentType: "INVOICE", title: "Tax Invoice & Sales Bill", category: "FINANCIAL", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL", "WHATSAPP", "ARCHIVE"], requiresSecuritySignature: true },
      { documentType: "RECEIPT", title: "POS Thermal Sales Receipt", category: "FINANCIAL", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PDF", "PREVIEW", "WHATSAPP"], requiresSecuritySignature: false },
      { documentType: "PURCHASE_ORDER", title: "Purchase Procurement Order", category: "PROCUREMENT", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL", "WHATSAPP", "ARCHIVE"], requiresSecuritySignature: true },
      { documentType: "GRN", title: "Goods Receipt Note", category: "LOGISTICS", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "ARCHIVE"], requiresSecuritySignature: false },
      { documentType: "STOCK_TRANSFER", title: "Stock Transfer Dispatch Note", category: "INVENTORY", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PDF", "PREVIEW"], requiresSecuritySignature: false },
      { documentType: "SALES_RETURN", title: "Sales Return Credit Memo", category: "FINANCIAL", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL"], requiresSecuritySignature: true },
      { documentType: "PURCHASE_RETURN", title: "Purchase Return Debit Note", category: "PROCUREMENT", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "EMAIL"], requiresSecuritySignature: true },
      { documentType: "PAYMENT_RECEIPT", title: "Payment Receipt Voucher", category: "FINANCIAL", defaultChannel: "PDF", supportedChannels: ["PRINT", "PDF", "PREVIEW", "WHATSAPP"], requiresSecuritySignature: true },
      { documentType: "BARCODE_LABEL", title: "Product Thermal Barcode Label", category: "INVENTORY", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PREVIEW"], requiresSecuritySignature: false },
      { documentType: "SHELF_LABEL", title: "Shelf Edge Price Tag", category: "INVENTORY", defaultChannel: "PRINT", supportedChannels: ["PRINT", "PREVIEW"], requiresSecuritySignature: false },
      { documentType: "REPORT", title: "Analytical Management Statement", category: "COMPLIANCE", defaultChannel: "PDF", supportedChannels: ["PDF", "PREVIEW", "EMAIL", "ARCHIVE"], requiresSecuritySignature: false },
      { documentType: "CERTIFICATE", title: "Quality & Compliance Certificate", category: "COMPLIANCE", defaultChannel: "PDF", supportedChannels: ["PDF", "PREVIEW", "PRINT"], requiresSecuritySignature: true },
      { documentType: "LETTER", title: "Formal Vendor / Customer Notice", category: "COMPLIANCE", defaultChannel: "PDF", supportedChannels: ["PDF", "PREVIEW", "EMAIL"], requiresSecuritySignature: true },
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

  public register(descriptor: RegisteredDocumentDescriptor): void {
    this.registry.set(descriptor.documentType, descriptor);
  }
}

export const DocumentRegistry = new DocumentRegistryManager();
