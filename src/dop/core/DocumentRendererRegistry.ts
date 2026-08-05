/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Document Renderer Registry (DXP-REN-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * DXP-REN-001 Compliance Declaration
 * Principle    : Renderer Decoupling — Document types resolve their UI preview and print
 *                renderers dynamically from DocumentRendererRegistry. Industry plugins can
 *                register custom renderers for KOTs, Medicine Labels, and Gold Tags.
 */

import React from "react";
import { DxpDocumentType } from "../models/DxpTypes.ts";
import { StandardInvoiceA4 } from "../../print_engine/templates/StandardInvoiceA4.tsx";
import { ThermalReceipt80mm } from "../../print_engine/templates/ThermalReceipt80mm.tsx";
import { GoodsReceiptNoteA4 } from "../../print_engine/templates/GoodsReceiptNoteA4.tsx";
import { BarcodeLabel } from "../../print_engine/templates/BarcodeLabel.tsx";

export type DocumentRendererComponent = React.ComponentType<{ data: any }>;

class DocumentRendererRegistryManager {
  private renderers: Map<DxpDocumentType, DocumentRendererComponent> = new Map();
  private fallbackRenderer: DocumentRendererComponent = StandardInvoiceA4;

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register("INVOICE", StandardInvoiceA4);
    this.register("RECEIPT", ThermalReceipt80mm);
    this.register("GRN", GoodsReceiptNoteA4);
    this.register("PURCHASE_ORDER", StandardInvoiceA4);
    this.register("STOCK_TRANSFER", StandardInvoiceA4);
    this.register("SALES_RETURN", StandardInvoiceA4);
    this.register("PURCHASE_RETURN", StandardInvoiceA4);
    this.register("PAYMENT_RECEIPT", StandardInvoiceA4);
    this.register("BARCODE_LABEL", BarcodeLabel);
    this.register("SHELF_LABEL", BarcodeLabel);
    this.register("REPORT", StandardInvoiceA4);
    this.register("CERTIFICATE", StandardInvoiceA4);
    this.register("LETTER", StandardInvoiceA4);
  }

  public register(type: DxpDocumentType, renderer: DocumentRendererComponent): void {
    this.renderers.set(type, renderer);
  }

  public resolve(type: DxpDocumentType): DocumentRendererComponent {
    return this.renderers.get(type) || this.fallbackRenderer;
  }

  public hasRenderer(type: DxpDocumentType): boolean {
    return this.renderers.has(type);
  }
}

export const DocumentRendererRegistry = new DocumentRendererRegistryManager();
