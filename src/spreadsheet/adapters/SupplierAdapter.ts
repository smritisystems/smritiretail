/**
 * Project      : SMRITI Retail OS
 * Module       : SMRITI Spreadsheet Platform (SSP)
 * Organization : SmritiSys
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.3.0
 * Created      : 2026-07-27
 * Copyright    : © SmritiSys. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import { SpreadsheetColumn } from "../SmritiSpreadsheetPlatform.js";

export interface SupplierRecord {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  city: string;
  paymentTerms: string;
}

/**
 * Domain Data Adapter mapping Supplier entity records into SMRITI Spreadsheet Platform grid schema.
 */
export class SupplierAdapter {
  public static getColumns(): SpreadsheetColumn[] {
    return [
      { key: "code", label: "Supplier Code", required: true, type: "text" },
      { key: "name", label: "Supplier Business Name", required: true, type: "text" },
      { key: "contactPerson", label: "Contact Representative", type: "text" },
      { key: "phone", label: "Phone / WhatsApp", required: true, type: "text" },
      { key: "email", label: "Email Address", type: "text" },
      { key: "gstin", label: "GSTIN Tax ID", required: true, type: "gstin" },
      { key: "city", label: "City / Warehouse Hub", type: "text" },
      { key: "paymentTerms", label: "Payment Credit Terms", type: "select", options: ["Net 15", "Net 30", "Net 45", "COD", "Advance"] },
    ];
  }

  public static toGridRows(suppliers: SupplierRecord[]): Record<string, any>[] {
    return suppliers.map((s) => ({
      id: s.id,
      code: s.code || "",
      name: s.name || "",
      contactPerson: s.contactPerson || "",
      phone: s.phone || "",
      email: s.email || "",
      gstin: s.gstin || "",
      city: s.city || "",
      paymentTerms: s.paymentTerms || "Net 30",
    }));
  }

  public static fromGridRows(rows: Record<string, any>[]): SupplierRecord[] {
    return rows.map((r, idx) => ({
      id: r.id || `SUPP-${Date.now()}-${idx}`,
      code: r.code || `SUPP-${idx + 1}`,
      name: r.name || `Supplier ${idx + 1}`,
      contactPerson: r.contactPerson || "",
      phone: r.phone || "",
      email: r.email || "",
      gstin: r.gstin || "",
      city: r.city || "",
      paymentTerms: r.paymentTerms || "Net 30",
    }));
  }
}
