/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-09-11
 * Modified     : 2026-09-11
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import { isValidGSTIN, isValidMobile } from "./validators";

export interface DirectEntryValidationParams {
  stockNo?: string;
  barcode?: string;
  itemDescription?: string;
  qty: number;
  rate: number;
  effectiveMrp?: number;
  discPct?: number;
  discAmt?: number;
  uom?: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const DISCRETE_UOMS = new Set(["PCS", "PC", "NOS", "NO", "PAIR", "PRS", "BOX", "SET", "UNIT", "DOZ"]);

/**
 * Validates direct entry line item before adding to cart.
 */
export function validateDirectEntryItem(params: DirectEntryValidationParams): ValidationResult {
  if (!params.stockNo && !params.barcode && !params.itemDescription) {
    return { valid: false, error: "Please enter an item code, barcode, or description." };
  }

  if (isNaN(params.qty) || params.qty <= 0) {
    return { valid: false, error: "Quantity must be a positive number greater than 0." };
  }

  if (params.qty > 99999) {
    return { valid: false, error: "Quantity exceeds maximum limit of 99,999 units." };
  }

  // Discrete UoM Check: PCS/NOS/PAIR cannot have fractional decimals
  if (params.uom && DISCRETE_UOMS.has(params.uom.toUpperCase().trim())) {
    if (params.qty % 1 !== 0) {
      return {
        valid: false,
        error: `Fractional quantity (${params.qty}) is not permitted for discrete unit '${params.uom}'. Please enter a whole integer quantity.`
      };
    }
  }

  if (isNaN(params.rate) || params.rate < 0) {
    return { valid: false, error: "Selling rate cannot be negative." };
  }

  if (params.rate > 9999999.99) {
    return { valid: false, error: "Selling rate exceeds maximum limit of ₹9,999,999.99." };
  }

  // Statutory Price Ceiling: Rate cannot exceed declared MRP
  if (params.effectiveMrp && params.effectiveMrp > 0 && params.rate > params.effectiveMrp) {
    return {
      valid: false,
      error: `Selling price (₹${params.rate.toFixed(2)}) cannot exceed statutory MRP (₹${params.effectiveMrp.toFixed(2)}).`
    };
  }

  // Discount Bounding
  const discPct = params.discPct ?? 0;
  if (discPct < 0 || discPct > 100) {
    return { valid: false, error: "Discount percentage must be between 0% and 100%." };
  }

  const discAmt = params.discAmt ?? 0;
  if (discAmt < 0) {
    return { valid: false, error: "Discount amount cannot be negative." };
  }

  const lineGross = params.rate * params.qty;
  if (discAmt > lineGross) {
    return {
      valid: false,
      error: `Discount amount (₹${discAmt.toFixed(2)}) cannot exceed line item gross value (₹${lineGross.toFixed(2)}).`
    };
  }

  return { valid: true };
}

export interface QuickCustomerValidationParams {
  name: string;
  mobile?: string;
  gstin?: string;
}

const VALID_GSTIN_STATE_CODES = new Set([
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
  "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
  "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  "31", "32", "33", "34", "35", "36", "37", "38", "97"
]);

/**
 * Validates quick customer fields during counter billing.
 */
export function validateQuickCustomer(params: QuickCustomerValidationParams): ValidationResult {
  const trimmedName = params.name.trim();
  if (!trimmedName || trimmedName.length < 2) {
    return { valid: false, error: "Customer name must be at least 2 characters long." };
  }

  const trimmedMobile = (params.mobile || "").trim();
  if (trimmedMobile && trimmedMobile !== "0000000000") {
    const intlRegex = /^\+[1-9]\d{7,14}$/;
    if (!isValidMobile(trimmedMobile) && !intlRegex.test(trimmedMobile)) {
      return { valid: false, error: "Please enter a valid 10-digit mobile number." };
    }
  }

  const trimmedGstin = (params.gstin || "").trim().toUpperCase();
  if (trimmedGstin) {
    if (!isValidGSTIN(trimmedGstin)) {
      return {
        valid: false,
        error: "Invalid GSTIN format. Statutory GSTIN must be 15 alphanumeric characters (e.g. 27AAAAA0000A1Z5)."
      };
    }
    const stateCode = trimmedGstin.substring(0, 2);
    if (!VALID_GSTIN_STATE_CODES.has(stateCode)) {
      return {
        valid: false,
        error: `Invalid GSTIN state code '${stateCode}'. State code must be between 01 and 38 or 97.`
      };
    }
  }

  return { valid: true };
}

export interface SettlementValidationParams {
  isCredit: boolean;
  customer: any;
  netAmount: number;
  payments: Array<{
    mode: string;
    amount: number;
    refNo?: string;
  }>;
}

/**
 * Validates invoice settlement tenders and B2B credit constraints.
 */
export function validateSettlementTenders(params: SettlementValidationParams): ValidationResult {
  const { isCredit, customer, netAmount, payments } = params;

  if (isCredit) {
    if (!customer) {
      return { valid: false, error: "A customer account is required for B2B credit sales." };
    }
    const rawLimit = customer.creditLimit ?? customer.credit_limit;
    if (rawLimit !== undefined && rawLimit !== null && !isNaN(Number(rawLimit))) {
      const creditLimit = Number(rawLimit);
      const outstanding = Number(customer.outstanding || 0);
      const projectedOutstanding = outstanding + netAmount;
      if (creditLimit > 0 && projectedOutstanding > creditLimit) {
        const excess = projectedOutstanding - creditLimit;
        return {
          valid: false,
          error: `Customer credit limit exceeded! Sanctioned limit is ₹${creditLimit.toFixed(2)}, current outstanding is ₹${outstanding.toFixed(2)}. This invoice of ₹${netAmount.toFixed(2)} exceeds available credit by ₹${excess.toFixed(2)}.`
        };
      }
    }
    return { valid: true };
  }

  if (!payments || payments.length === 0) {
    return { valid: false, error: "At least one payment tender must be specified." };
  }

  for (const p of payments) {
    if (isNaN(p.amount) || p.amount <= 0) {
      return { valid: false, error: `Tender amount for '${p.mode}' must be greater than 0.` };
    }

    // Section 269ST Income Tax Act: Cash transaction ceiling >= 2,00,000 is illegal
    if (p.mode.toLowerCase() === "cash" && p.amount >= 200000) {
      return {
        valid: false,
        error: "Statutory Violation (Section 269ST of Income Tax Act): Cash receipt of ₹2,00,000 or more in a single transaction is prohibited by law. Please collect payment via Card, UPI, NetBanking, or Cheque."
      };
    }
  }

  for (const p of payments) {
    if (["Credit Card", "Debit Card", "UPI", "Cheque", "Credit Note"].includes(p.mode)) {
      if (!p.refNo || !p.refNo.trim()) {
        return { valid: false, error: `Reference / Transaction / Auth number is required for ${p.mode} payments.` };
      }
    }
  }

  const nonCashTendered = payments
    .filter(p => p.mode !== "Cash")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  if (nonCashTendered > netAmount) {
    return {
      valid: false,
      error: `Non-cash tenders (₹${nonCashTendered.toFixed(2)}) cannot exceed the invoice net total (₹${netAmount.toFixed(2)}). Cash change cannot be refunded on digital or card payments.`
    };
  }

  const totalTendered = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  if (totalTendered < netAmount) {
    const remaining = netAmount - totalTendered;
    return {
      valid: false,
      error: `Payment is incomplete. Remaining balance to tender: ₹${remaining.toFixed(2)}.`
    };
  }

  return { valid: true };
}

export interface RoundOffResult {
  unroundedAmount: number;
  roundedAmount: number;
  roundOffDelta: number;
}

/**
 * Calculates standard Indian retail statutory round-off to the nearest integer rupee.
 */
export function calculateStatutoryRoundOff(unroundedAmount: number): RoundOffResult {
  const roundedAmount = Math.round(unroundedAmount);
  const roundOffDelta = Math.round((roundedAmount - unroundedAmount) * 100) / 100;
  return {
    unroundedAmount,
    roundedAmount,
    roundOffDelta
  };
}
