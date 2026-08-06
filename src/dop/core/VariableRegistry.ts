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
 * Principle    : Categorized & Strongly Typed Variable Dictionary — Defines placeholder metadata
 *                (Company, Customer, Supplier, Item, Tax, Inventory, Document, User, Organization, Plugin),
 *                data formatters (text, currency, date, barcode, number), autocomplete, and substitution.
 */

export type DxpVariableCategory =
  | "Company"
  | "Customer"
  | "Supplier"
  | "Item"
  | "Tax"
  | "Inventory"
  | "Document"
  | "User"
  | "Organization"
  | "Plugin";

export type DxpVariableFormatter = "text" | "currency" | "date" | "barcode" | "number";

export interface DxpTypedVariable {
  id: string; // e.g. "Company.Name"
  type: "string" | "number" | "currency" | "date" | "boolean";
  category: DxpVariableCategory;
  description: string;
  formatter: DxpVariableFormatter;
  example: string;
}

class VariableRegistryManager {
  private variables: Map<string, DxpTypedVariable> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: DxpTypedVariable[] = [
      // Company Category
      { id: "Company.Name", type: "string", category: "Company", description: "Legal Company Name", formatter: "text", example: "SMRITI Enterprise Co." },
      { id: "Company.Address", type: "string", category: "Company", description: "Registered Store / Corporate Address", formatter: "text", example: "101 Tech Park, Mumbai" },
      { id: "Company.GSTIN", type: "string", category: "Company", description: "15-digit GST Identification Number", formatter: "text", example: "27AAAAA0000A1Z5" },
      { id: "Company.Phone", type: "string", category: "Company", description: "Store Support / Helpline Phone Number", formatter: "text", example: "+91 9876543210" },

      // Customer Category
      { id: "Customer.Name", type: "string", category: "Customer", description: "Customer Full Name", formatter: "text", example: "Acme Retail Corp" },
      { id: "Customer.Mobile", type: "string", category: "Customer", description: "Customer Mobile Number", formatter: "text", example: "+91 9123456789" },
      { id: "Customer.GSTIN", type: "string", category: "Customer", description: "B2B Customer GSTIN", formatter: "text", example: "27BBBBA1111B2Z3" },

      // Supplier Category
      { id: "Supplier.Name", type: "string", category: "Supplier", description: "Vendor / Supplier Firm Name", formatter: "text", example: "National Distributors Ltd" },
      { id: "Supplier.GSTIN", type: "string", category: "Supplier", description: "Supplier GSTIN", formatter: "text", example: "27CCCCA2222C3Z4" },

      // Document Category
      { id: "Invoice.Number", type: "string", category: "Document", description: "Sales / Purchase Document Number", formatter: "text", example: "INV-2026-0891" },
      { id: "Invoice.Date", type: "date", category: "Document", description: "Document Posting Date", formatter: "date", example: "2026-08-06" },
      { id: "Invoice.Total", type: "currency", category: "Document", description: "Grand Total Payable Amount", formatter: "currency", example: "8732.00" },

      // Item Category
      { id: "Item.Name", type: "string", category: "Item", description: "Product SKU Description", formatter: "text", example: "Wireless Keyboard" },
      { id: "Item.Barcode", type: "string", category: "Item", description: "EAN / UPC Barcode", formatter: "barcode", example: "8901234567890" },
      { id: "Item.MRP", type: "currency", category: "Item", description: "Maximum Retail Price", formatter: "currency", example: "1450.00" },

      // Tax Category
      { id: "GST.CGST", type: "currency", category: "Tax", description: "Central GST Tax Amount", formatter: "currency", example: "666.00" },
      { id: "GST.SGST", type: "currency", category: "Tax", description: "State GST Tax Amount", formatter: "currency", example: "666.00" },
      { id: "GST.Total", type: "currency", category: "Tax", description: "Total GST Tax Amount", formatter: "currency", example: "1332.00" },

      // User & Organization Category
      { id: "User.FullName", type: "string", category: "User", description: "Billing Operator / Cashier Name", formatter: "text", example: "Jawahar M." },
      { id: "Organization.TenantId", type: "string", category: "Organization", description: "Multi-tenant Isolated Tenant ID", formatter: "text", example: "TNT-001" },
    ];

    defaults.forEach((v) => this.register(v));
  }

  public register(variable: DxpTypedVariable): void {
    this.variables.set(variable.id, variable);
  }

  public get(id: string): DxpTypedVariable | undefined {
    return this.variables.get(id);
  }

  public listAll(): DxpTypedVariable[] {
    return Array.from(this.variables.values());
  }

  public listByCategory(category: DxpVariableCategory): DxpTypedVariable[] {
    return this.listAll().filter((v) => v.category === category);
  }

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
      return registered ? registered.example : match;
    });
  }
}

export const VariableRegistry = new VariableRegistryManager();
