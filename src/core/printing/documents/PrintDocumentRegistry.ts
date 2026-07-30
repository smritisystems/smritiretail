/**
 * Project      : SMRITI Retail OS
 * System       : SMRITI Universal Printing Platform (SUPP)
 * Component    : PrintDocumentRegistry (Business Document Registry — Rule SUPP-009)
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Version      : 1.0.0
 * Status       : FROZEN — APPROVED
 * License      : Proprietary Commercial Software
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 */

export type BusinessDocumentCategory =
  | "INVOICE"
  | "RECEIPT"
  | "BARCODE"
  | "SHELF_LABEL"
  | "PRICE_TAG"
  | "HANG_TAG"
  | "KITCHEN"
  | "DISPATCH"
  | "PACKING_SLIP"
  | "PURCHASE"
  | "STOCK_TRANSFER"
  | "REPORTS";

export interface BusinessDocumentDefinition {
  id: string;
  name: string;
  category: BusinessDocumentCategory;
  description: string;
  defaultTemplateId: string;
  allowedDriverIds: string[]; // e.g. ["zpl", "tspl", "epl", "esc_pos", "pdf"]
  moduleOwner: "POS" | "SALES" | "PURCHASE" | "INVENTORY" | "BARCODE" | "REPORTS";
}

export class PrintDocumentRegistry {
  private static documents: Map<string, BusinessDocumentDefinition> = new Map([
    [
      "sales_invoice",
      {
        id: "sales_invoice",
        name: "Retail Sales Tax Invoice",
        category: "INVOICE",
        description: "Standard GST A4 / Thermal Tax Invoice",
        defaultTemplateId: "tattly_threads_dual_tag",
        allowedDriverIds: ["zpl", "pdf", "esc_pos"],
        moduleOwner: "SALES",
      },
    ],
    [
      "barcode_sticky_tag",
      {
        id: "barcode_sticky_tag",
        name: "Product Dual Barcode Sticky Tag",
        category: "BARCODE",
        description: "Footwear / Garments dual barcode tag (100x50.7 mm)",
        defaultTemplateId: "tattly_threads_dual_tag",
        allowedDriverIds: ["zpl", "tspl", "epl"],
        moduleOwner: "BARCODE",
      },
    ],
    [
      "pos_receipt",
      {
        id: "pos_receipt",
        name: "POS Counter Thermal Receipt",
        category: "RECEIPT",
        description: "80mm ESC/POS Thermal Billing Receipt",
        defaultTemplateId: "tattly_threads_dual_tag",
        allowedDriverIds: ["esc_pos", "raw"],
        moduleOwner: "POS",
      },
    ],
  ]);

  static getDocuments(): BusinessDocumentDefinition[] {
    return Array.from(this.documents.values());
  }

  static getDocument(documentId: string): BusinessDocumentDefinition | undefined {
    return this.documents.get(documentId);
  }

  static registerDocument(def: BusinessDocumentDefinition): void {
    this.documents.set(def.id, def);
  }
}
