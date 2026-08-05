/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Template Registry (DXP-TPL-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * DXP-TPL-001 Compliance Declaration
 * Principle    : Template Decoupling — Document definitions (DocumentRegistry) are decoupled
 *                from templates (Standard A4, Tax Invoice A5, Thermal 80mm, Sticker 50x25mm).
 *                Plugins and tenants can register custom templates without modifying document schemas.
 */

import React from "react";
import { DxpDocumentType } from "../models/DxpTypes.ts";
import { StandardInvoiceA4 } from "../../print_engine/templates/StandardInvoiceA4.tsx";
import { ThermalReceipt80mm } from "../../print_engine/templates/ThermalReceipt80mm.tsx";
import { GoodsReceiptNoteA4 } from "../../print_engine/templates/GoodsReceiptNoteA4.tsx";
import { BarcodeLabel } from "../../print_engine/templates/BarcodeLabel.tsx";

export interface RegisteredTemplateDescriptor {
  id: string;
  name: string;
  documentType: DxpDocumentType;
  format: "A4" | "A5" | "Thermal80mm" | "Label";
  component: React.ComponentType<{ data: any }>;
  isDefault?: boolean;
  companyId?: string;
  tags?: string[];
}

class TemplateRegistryManager {
  private templates: Map<string, RegisteredTemplateDescriptor> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: RegisteredTemplateDescriptor[] = [
      {
        id: "standard-a4",
        name: "Standard Tax Invoice (A4)",
        documentType: "INVOICE",
        format: "A4",
        component: StandardInvoiceA4,
        isDefault: true,
        tags: ["invoice", "a4", "standard"],
      },
      {
        id: "grn-a4",
        name: "Goods Receipt Note (GRN A4)",
        documentType: "GRN",
        format: "A4",
        component: GoodsReceiptNoteA4,
        isDefault: true,
        tags: ["grn", "logistics", "a4"],
      },
      {
        id: "thermal-80",
        name: "Retail Thermal Receipt (80mm)",
        documentType: "RECEIPT",
        format: "Thermal80mm",
        component: ThermalReceipt80mm,
        isDefault: true,
        tags: ["pos", "receipt", "thermal"],
      },
      {
        id: "label-50x25",
        name: "Product Sticky Barcode Label (50x25mm)",
        documentType: "BARCODE_LABEL",
        format: "Label",
        component: BarcodeLabel,
        isDefault: true,
        tags: ["barcode", "sticker", "inventory"],
      },
      {
        id: "shelf-label-75x50",
        name: "Supermarket Shelf Edge Tag (75x50mm)",
        documentType: "SHELF_LABEL",
        format: "Label",
        component: BarcodeLabel,
        isDefault: true,
        tags: ["shelf", "supermarket", "tag"],
      },
    ];

    defaults.forEach((t) => this.register(t));
  }

  public register(template: RegisteredTemplateDescriptor): void {
    this.templates.set(template.id, template);
  }

  public get(id: string): RegisteredTemplateDescriptor | undefined {
    return this.templates.get(id);
  }

  public listForDocument(documentType: DxpDocumentType): RegisteredTemplateDescriptor[] {
    return Array.from(this.templates.values()).filter((t) => t.documentType === documentType);
  }

  public getDefault(documentType: DxpDocumentType): RegisteredTemplateDescriptor {
    const docTemplates = this.listForDocument(documentType);
    const defaultTmpl = docTemplates.find((t) => t.isDefault) || docTemplates[0];
    if (!defaultTmpl) {
      return {
        id: "fallback-a4",
        name: "Standard Document Template (A4)",
        documentType,
        format: "A4",
        component: StandardInvoiceA4,
        isDefault: true,
      };
    }
    return defaultTmpl;
  }

  public listAll(): RegisteredTemplateDescriptor[] {
    return Array.from(this.templates.values());
  }
}

export const TemplateRegistry = new TemplateRegistryManager();
