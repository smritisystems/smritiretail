/**
 * Project      : SMRITI Retail OS
 * Architecture : Customer Policy Engine (Policy-Driven One Billing Workspace)
 * Standard     : SMRITI Customer-Policy Billing Architecture v1.0
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * Version      : 1.0.0
 */

import { Customer } from "../../types.js";

export type CustomerType = "WALK_IN" | "GST_RETAIL" | "WHOLESALE" | "CORPORATE" | "EXPORT";

export type PriceGroup = "Retail MRP" | "Wholesale Price" | "Dealer Rate" | "VIP Discount" | "Contract Price";

export type TaxGroup = "Retail Intra" | "GST Local" | "Interstate IGST" | "Export Zero Tax";

export type PrintTemplate = "Retail Receipt (3-inch Thermal)" | "Tax Invoice (A4)" | "Commercial Export Invoice";

export interface CustomerPolicy {
  customerType: CustomerType;
  customerTypeName: string;
  priceGroup: PriceGroup;
  taxGroup: TaxGroup;
  currency: "INR" | "USD" | "EUR";
  allowedPaymentModes: ("CASH" | "UPI" | "CARD" | "CREDIT" | "BANK_TRANSFER" | "AGAINST_PO")[];
  showGstFields: boolean;        // GSTIN, Transport, E-Way Bill
  showCorporateFields: boolean;  // PO Number, Project, Cost Center, Delivery Address
  showExportFields: boolean;     // Shipping Bill, Port Code, Currency Exchange
  defaultPrintTemplate: PrintTemplate;
  creditLimit?: number;
  outstandingBalance?: number;
  creditDays?: number;
  poMandatory?: boolean;
  creditAllowed?: boolean;
}

/**
 * Resolves full billing UI configuration, pricing rules, tax rules, and print policies
 * derived strictly from selected customer profile metadata. Zero manual UI mode switching required.
 */
export function resolveCustomerPolicy(customer: Customer | null | undefined): CustomerPolicy {
  if (!customer || customer.id === "CUST-001" || customer.name.toLowerCase().includes("walk-in")) {
    return {
      customerType: "WALK_IN",
      customerTypeName: "Walk-In Retail Customer",
      priceGroup: "Retail MRP",
      taxGroup: "Retail Intra",
      currency: "INR",
      allowedPaymentModes: ["CASH", "UPI", "CARD"],
      showGstFields: false,
      showCorporateFields: false,
      showExportFields: false,
      defaultPrintTemplate: "Retail Receipt (3-inch Thermal)",
      creditAllowed: false,
    };
  }

  const gstin = customer.gstNumber || (customer as any).gstin;
  const isExport =
    customer.tags?.includes("Export") ||
    customer.customerGroupId === "CG-Export" ||
    customer.name.toLowerCase().includes("export") ||
    customer.name.toLowerCase().includes("usa");

  const isCorporate =
    customer.tags?.includes("Corporate") ||
    customer.customerGroupId === "CG-Corporate" ||
    customer.name.toLowerCase().includes("reliance") ||
    customer.name.toLowerCase().includes("traders") ||
    customer.creditLimit !== undefined;

  // 1. Export Customer Policy
  if (isExport) {
    return {
      customerType: "EXPORT",
      customerTypeName: "Global Export Account",
      priceGroup: "Contract Price",
      taxGroup: "Export Zero Tax",
      currency: "USD",
      allowedPaymentModes: ["BANK_TRANSFER", "CREDIT"],
      showGstFields: false,
      showCorporateFields: true,
      showExportFields: true,
      defaultPrintTemplate: "Commercial Export Invoice",
      poMandatory: true,
      creditAllowed: true,
      creditLimit: customer.creditLimit || 2500000,
      outstandingBalance: customer.outstanding || 450000,
      creditDays: 45,
    };
  }

  // 2. Corporate Customer Policy
  if (isCorporate) {
    return {
      customerType: "CORPORATE",
      customerTypeName: "Corporate Account (Credit & PO)",
      priceGroup: "Contract Price",
      taxGroup: gstin && !gstin.startsWith("27") ? "Interstate IGST" : "GST Local",
      currency: "INR",
      allowedPaymentModes: ["CREDIT", "BANK_TRANSFER", "AGAINST_PO"],
      showGstFields: true,
      showCorporateFields: true,
      showExportFields: false,
      defaultPrintTemplate: "Tax Invoice (A4)",
      poMandatory: true,
      creditAllowed: true,
      creditLimit: customer.creditLimit || 500000,
      outstandingBalance: customer.outstanding || 180000,
      creditDays: 30,
    };
  }

  // 3. Registered GST Business / Wholesale Customer Policy
  if (gstin) {
    const isInterstate = !gstin.startsWith("27");
    const isWholesale = customer.customerGroupId === "CG-Wholesale" || customer.tags?.includes("Wholesale");
    return {
      customerType: isWholesale ? "WHOLESALE" : "GST_RETAIL",
      customerTypeName: isWholesale ? "Wholesale Partner (GST)" : "Registered GST Business",
      priceGroup: isWholesale ? "Wholesale Price" : "Retail MRP",
      taxGroup: isInterstate ? "Interstate IGST" : "GST Local",
      currency: "INR",
      allowedPaymentModes: ["CASH", "UPI", "CARD", "CREDIT", "BANK_TRANSFER"],
      showGstFields: true,
      showCorporateFields: false,
      showExportFields: false,
      defaultPrintTemplate: "Tax Invoice (A4)",
      creditAllowed: true,
      creditLimit: customer.creditLimit || 200000,
      outstandingBalance: customer.outstanding || 45000,
      creditDays: 15,
    };
  }

  // 4. Default Retail / VIP Customer Policy
  const isVip = customer.customerGroupId === "CG-VIP" || customer.tags?.includes("VIP");
  return {
    customerType: "WALK_IN",
    customerTypeName: isVip ? "VIP Privilege Member" : "Registered Retail Customer",
    priceGroup: isVip ? "VIP Discount" : "Retail MRP",
    taxGroup: "Retail Intra",
    currency: "INR",
    allowedPaymentModes: ["CASH", "UPI", "CARD"],
    showGstFields: false,
    showCorporateFields: false,
    showExportFields: false,
    defaultPrintTemplate: "Retail Receipt (3-inch Thermal)",
    creditAllowed: false,
  };
}
