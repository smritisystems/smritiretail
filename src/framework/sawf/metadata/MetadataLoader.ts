/**
 * SMRITI Adaptive Workspace Framework (SAWF v1.1)
 * Metadata Loader
 */

import { SAWFDocumentMeta } from "../types/sawf.ts";
import salesInvoiceMeta from "../../../metadata/sales_invoice.json";

const registry: Record<string, SAWFDocumentMeta> = {
  SalesInvoice: salesInvoiceMeta as SAWFDocumentMeta,
};

export class MetadataLoader {
  static getDocumentMeta(documentType: string): SAWFDocumentMeta {
    const meta = registry[documentType];
    if (!meta) {
      // Fallback default meta
      return {
        document: documentType,
        title: `${documentType} Studio`,
        defaultMode: "simple",
        panels: [
          { id: "customer", label: "General Details", modes: ["simple", "standard", "enterprise"] },
          { id: "items", label: "Line Items", modes: ["simple", "standard", "enterprise"] },
          { id: "totals", label: "Totals & Summary", modes: ["simple", "standard", "enterprise"] },
        ],
        sidebarWidgets: ["financial_summary", "timeline"],
      };
    }
    return meta;
  }
}
