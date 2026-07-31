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
