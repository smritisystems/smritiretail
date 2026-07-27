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

import { Customer } from "../../types.js";
import { SpreadsheetColumn } from "../SmritiSpreadsheetPlatform.js";

/**
 * Domain Data Adapter mapping Customer entity records into SMRITI Spreadsheet Platform grid schema.
 */
export class CustomerAdapter {
  public static getColumns(): SpreadsheetColumn[] {
    return [
      { key: "code", label: "Customer Code", required: true, type: "text" },
      { key: "name", label: "Customer Full Name", required: true, type: "text" },
      { key: "mobile", label: "Mobile Phone Number", required: true, type: "text" },
      { key: "email", label: "Email Address", type: "text" },
      { key: "gstin", label: "GSTIN Tax ID", type: "gstin" },
      { key: "city", label: "City Location", type: "text" },
      { key: "pinCode", label: "PIN Code", type: "pincode" },
      { key: "loyaltyPoints", label: "Loyalty Points Balance", type: "number" },
    ];
  }

  public static toGridRows(customers: Customer[]): Record<string, any>[] {
    return customers.map((c) => {
      const cust = c as any;
      return {
        id: c.id,
        code: c.code || "",
        name: c.name || "",
        mobile: c.mobile || c.phone || "",
        email: c.email || "",
        gstin: c.gstNumber || cust.gstin || "",
        city: cust.city || "",
        pinCode: cust.pinCode || cust.pincode || "",
        loyaltyPoints: cust.loyaltyPoints !== undefined ? cust.loyaltyPoints.toString() : "0",
      };
    });
  }

  public static fromGridRows(rows: Record<string, any>[]): Partial<Customer>[] {
    return rows.map((r, idx) => ({
      id: r.id || `CUST-${Date.now()}-${idx}`,
      code: r.code || `CUST-${idx + 1}`,
      name: r.name || `Customer ${idx + 1}`,
      phone: r.mobile || "",
      mobile: r.mobile || "",
      email: r.email || "",
      gstNumber: r.gstin || "",
      city: r.city || "",
      pinCode: r.pinCode || "",
      loyaltyPoints: parseInt(r.loyaltyPoints, 10) || 0,
    } as any));
  }
}
