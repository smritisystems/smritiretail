/**
 * Project      : SMRITI Retail OS
 * Organization : SmritiSys / AITDL Networks
 * Component    : Universal Variable Registry (DXP-VAR-001 Standard)
 * Author       : Jawahar Ramkripal Mallah
 * Document Type: SMRITI Constitutional Standard
 * Ownership    : SMRITI Retail OS Architecture Team
 * Copyright    : © Jawahar Ramkripal Mallah. All Rights Reserved.
 *
 * DXP-VAR-001 Compliance Declaration
 * Principle    : Centralized Placeholder Dictionary — Defines document variables (Company.Name,
 *                Invoice.Number, Item.Barcode, GST.CGST), providing autocomplete metadata,
 *                data type validation, and template string substitution.
 */

import { DxpDocumentType } from "../models/DxpTypes.ts";

export interface DxpVariableDefinition {
  key: string; // e.g. "Company.Name"
  label: string; // e.g. "Company Legal Name"
  category: "COMPANY" | "CUSTOMER" | "DOCUMENT" | "ITEM" | "TAX" | "SYSTEM";
  dataType: "STRING" | "NUMBER" | "CURRENCY" | "DATE" | "BOOLEAN";
  description: string;
  sampleValue: any;
}

class VariableRegistryManager {
  private variables: Map<string, DxpVariableDefinition> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: DxpVariableDefinition[] = [
      // Company Group
      { key: "Company.Name", label: "Company Legal Name", category: "COMPANY", dataType: "STRING", description: "Registered enterprise name", sampleValue: "SMRITI Enterprise Co." },
      { key: "Company.Address", label: "Company Address", category: "COMPANY", dataType: "STRING", description: "Primary registered office address", sampleValue: "101 Tech Park, Mumbai" },
      { key: "Company.GSTIN", label: "Company GSTIN", category: "COMPANY", dataType: "STRING", description: "15-digit GST Identification Number", sampleValue: "27AAAAA0000A1Z5" },
      { key: "Company.Phone", label: "Company Phone Number", category: "COMPANY", dataType: "STRING", description: "Customer helpline / office contact", sampleValue: "+91 9876543210" },

      // Customer Group
      { key: "Customer.Name", label: "Customer Full Name", category: "CUSTOMER", dataType: "STRING", description: "B2B or B2C customer name", sampleValue: "Acme Retail Corp" },
      { key: "Customer.Mobile", label: "Customer Mobile Number", category: "CUSTOMER", dataType: "STRING", description: "Customer phone number", sampleValue: "+91 9123456789" },
      { key: "Customer.GSTIN", label: "Customer GSTIN", category: "CUSTOMER", dataType: "STRING", description: "B2B customer GSTIN", sampleValue: "27BBBBA1111B2Z3" },

      // Document Group
      { key: "Document.Number", label: "Document Serial Number", category: "DOCUMENT", dataType: "STRING", description: "Invoice / PO / GRN serial number", sampleValue: "INV-2026-0891" },
      { key: "Document.Date", label: "Document Date", category: "DOCUMENT", dataType: "DATE", description: "Issue / posting date", sampleValue: "2026-08-06" },
      { key: "Document.Subtotal", label: "Subtotal Amount", category: "DOCUMENT", dataType: "CURRENCY", description: "Net line items total before tax", sampleValue: "7400.00" },
      { key: "Document.TaxTotal", label: "Total GST Tax", category: "DOCUMENT", dataType: "CURRENCY", description: "Combined tax amount", sampleValue: "1332.00" },
      { key: "Document.GrandTotal", label: "Grand Total Amount", category: "DOCUMENT", dataType: "CURRENCY", description: "Payable invoice grand total", sampleValue: "8732.00" },

      // Item Group
      { key: "Item.Name", label: "Product / SKU Title", category: "ITEM", dataType: "STRING", description: "Item description or title", sampleValue: "Wireless Keyboard" },
      { key: "Item.SKU", label: "Item SKU Code", category: "ITEM", dataType: "STRING", description: "Unique stock keeping unit code", sampleValue: "SKU-KBD-01" },
      { key: "Item.Barcode", label: "Barcode / EAN Code", category: "ITEM", dataType: "STRING", description: "13-digit EAN/UPC barcode", sampleValue: "8901234567890" },
      { key: "Item.Qty", label: "Quantity Sold", category: "ITEM", dataType: "NUMBER", description: "Line item quantity", sampleValue: "2" },
      { key: "Item.Rate", label: "Selling Unit Price", category: "ITEM", dataType: "CURRENCY", description: "Price per unit", sampleValue: "1450.00" },

      // Tax Group
      { key: "GST.CGST", label: "Central GST (CGST)", category: "TAX", dataType: "CURRENCY", description: "Intra-state CGST tax amount", sampleValue: "666.00" },
      { key: "GST.SGST", label: "State GST (SGST)", category: "TAX", dataType: "CURRENCY", description: "Intra-state SGST tax amount", sampleValue: "666.00" },
      { key: "GST.IGST", label: "Integrated GST (IGST)", category: "TAX", dataType: "CURRENCY", description: "Inter-state IGST tax amount", sampleValue: "0.00" },
      { key: "GST.HSNCode", label: "HSN / SAC Code", category: "TAX", dataType: "STRING", description: "Harmonized System Nomenclature code", sampleValue: "84716060" },
    ];

    defaults.forEach((v) => this.register(v));
  }

  public register(variable: DxpVariableDefinition): void {
    this.variables.set(variable.key, variable);
  }

  public get(key: string): DxpVariableDefinition | undefined {
    return this.variables.get(key);
  }

  public listAll(): DxpVariableDefinition[] {
    return Array.from(this.variables.values());
  }

  public listByCategory(category: DxpVariableDefinition["category"]): DxpVariableDefinition[] {
    return this.listAll().filter((v) => v.category === category);
  }

  /**
   * Template placeholder string substitution
   * Converts "Invoice: {{Document.Number}}" -> "Invoice: INV-2026-0891"
   */
  public substitute(templateString: string, data: Record<string, any>): string {
    if (!templateString) return "";
    return templateString.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
      const parts = key.split(".");
      let val: any = data;
      for (const p of parts) {
        if (val && typeof val === "object" && p in val) {
          val = val[p];
        } else {
          val = undefined;
          break;
        }
      }
      if (val !== undefined && val !== null) return String(val);
      const registered = this.get(key);
      return registered ? String(registered.sampleValue) : match;
    });
  }
}

export const VariableRegistry = new VariableRegistryManager();
