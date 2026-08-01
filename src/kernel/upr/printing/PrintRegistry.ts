/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Module       : Universal Platform Registry (UPR) — Print Registry (UPRT-001)
 * Standard     : SMAP Constitution v1.0 — Rule SAP-018 (Metadata First) & UPRT Standard v1.0
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { PlatformContext } from "../../context/PlatformContext.js";

export type PrintPaperSize = "thermal_80mm" | "thermal_58mm" | "a4" | "a5" | "label_50x25mm";

export interface PrintTemplateDefinition {
  id: string;             // Template key (e.g. "tmpl.pos_receipt", "tmpl.barcode_label", "tmpl.tax_invoice")
  name: string;
  description?: string;
  entityId: string;       // Target entity ID (e.g. "sales_invoice", "product")
  paperSize: PrintPaperSize;
  permissionId: string;   // Required permission key
  templateBody: string;   // Raw template schema or HTML string template
  isDefault?: boolean;
}

export interface RenderedPrintDocument {
  templateId: string;
  paperSize: PrintPaperSize;
  renderedAt: string;
  htmlContent: string;
  plainTextContent?: string;
}

export class PrintRegistryService {
  private templates: Map<string, Readonly<PrintTemplateDefinition>> = new Map();
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.seedDefaultTemplates();
  }

  private seedDefaultTemplates() {
    const defaults: PrintTemplateDefinition[] = [
      {
        id: "tmpl.pos_receipt",
        name: "Standard POS Thermal 80mm Receipt",
        description: "Standard retail thermal receipt with GST breakdown and barcode",
        entityId: "sales_invoice",
        paperSize: "thermal_80mm",
        permissionId: "sales.pos.billing",
        isDefault: true,
        templateBody: `<div className="pos-receipt"><h1>SMRITI RETAIL RECEIPT</h1><p>Invoice: {{invoiceNo}}</p><p>Total: {{totalAmount}}</p></div>`
      },
      {
        id: "tmpl.barcode_label",
        name: "SKU Barcode & Price Tag Label (50x25mm)",
        description: "Thermal transfer sticky label with EAN-13 barcode & MRP",
        entityId: "product",
        paperSize: "label_50x25mm",
        permissionId: "inventory.item.read",
        isDefault: true,
        templateBody: `<div className="label-50x25"><p>{{sku}}</p><p>{{name}}</p><p>MRP: ₹{{mrpi}}</p></div>`
      },
      {
        id: "print.sales.invoice.a4",
        name: "Sales Invoice A4 Template",
        description: "Standard sale invoice A4 print template",
        entityId: "sales_invoice",
        paperSize: "a4",
        permissionId: "sales.invoice.print",
        templateBody: `<div><h1>Sales Invoice</h1><p>Invoice No: {{invoiceNo}}</p><p>Customer: {{customerName}}</p><p>Total: {{totalAmount}}</p></div>`
      },
      {
        id: "print.purchase.invoice.a4",
        name: "Purchase Invoice A4 Template",
        description: "Standard purchase invoice A4 print template",
        entityId: "purchase_invoice",
        paperSize: "a4",
        permissionId: "purchase.invoice.print",
        templateBody: `<div><h1>Purchase Invoice</h1><p>Invoice No: {{invoiceNo}}</p><p>Supplier: {{supplierName}}</p><p>Total: {{totalAmount}}</p></div>`
      },
      {
        id: "print.sales.return.a4",
        name: "Sales Return A4 Template",
        description: "Sales return A4 print template",
        entityId: "sales_return",
        paperSize: "a4",
        permissionId: "sales.return.print",
        templateBody: `<div><h1>Sales Return</h1><p>Return No: {{returnNo}}</p><p>Customer: {{customerName}}</p><p>Total Refund: {{refundAmount}}</p></div>`
      },
      {
        id: "print.purchase.return.a4",
        name: "Purchase Return A4 Template",
        description: "Purchase return A4 print template",
        entityId: "purchase_return",
        paperSize: "a4",
        permissionId: "purchase.return.print",
        templateBody: `<div><h1>Purchase Return</h1><p>Return No: {{returnNo}}</p><p>Supplier: {{supplierName}}</p><p>Total Refund: {{refundAmount}}</p></div>`
      },
      {
        id: "print.stock.transfer.a4",
        name: "Stock Transfer A4 Template",
        description: "Stock transfer A4 print template",
        entityId: "stock_transfer",
        paperSize: "a4",
        permissionId: "inventory.transfer.print",
        templateBody: `<div><h1>Stock Transfer</h1><p>Transfer No: {{transferNo}}</p><p>From: {{fromLocation}}</p><p>To: {{toLocation}}</p></div>`
      },
      {
        id: "print.physical.stock.a4",
        name: "Physical Stock Adjustment A4 Template",
        description: "Physical stock adjustment A4 print template",
        entityId: "physical_stock",
        paperSize: "a4",
        permissionId: "inventory.stock.adjust.print",
        templateBody: `<div><h1>Physical Stock Adjustment</h1><p>Adjustment No: {{adjustmentNo}}</p><p>Location: {{location}}</p><p>Note: {{notes}}</p></div>`
      }
    ];

    defaults.forEach((t) => this.registerTemplate(t));
  }

  public registerTemplate(template: PrintTemplateDefinition): void {
    const payload = Object.freeze({ ...template, id: template.id.toLowerCase() });
    this.templates.set(payload.id, payload);
    this.emitChange();
  }

  public getTemplate(id: string): Readonly<PrintTemplateDefinition> | undefined {
    if (!id) return undefined;
    return this.templates.get(id.toLowerCase());
  }

  public getTemplates(): ReadonlyArray<Readonly<PrintTemplateDefinition>> {
    return Array.from(this.templates.values());
  }

  public renderDocument(
    templateId: string,
    data: Record<string, any>,
    context: Readonly<PlatformContext>
  ): RenderedPrintDocument {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Print template '${templateId}' is not registered in UPRT.`);
    }

    let rendered = template.templateBody;
    Object.keys(data).forEach((key) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, "g"), String(data[key] ?? ""));
    });

    return {
      templateId: template.id,
      paperSize: template.paperSize,
      renderedAt: new Date().toISOString(),
      htmlContent: rendered,
      plainTextContent: rendered.replace(/<[^>]+>/g, " ").trim()
    };
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public clear(): void {
    this.templates.clear();
    this.seedDefaultTemplates();
    this.emitChange();
  }

  private emitChange(): void {
    this.listeners.forEach((listener) => listener());
  }
}

export const PrintRegistry = new PrintRegistryService();
