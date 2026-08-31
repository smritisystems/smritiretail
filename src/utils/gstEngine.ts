/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.8.0
 * Created      : 2026-08-22
 * Modified     : 2026-08-22
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

export const GST_STATE_MAP: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh (New)",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

export interface GstValidationResult {
  isValid: boolean;
  stateCode: string | null;
  stateName: string | null;
  pan: string | null;
}

export function parseAndValidateGSTIN(gstin?: string | null): GstValidationResult {
  if (!gstin) {
    return { isValid: false, stateCode: null, stateName: null, pan: null };
  }

  const cleaned = gstin.trim().toUpperCase();
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const isValid = gstRegex.test(cleaned);

  if (!isValid && cleaned.length !== 15) {
    return { isValid: false, stateCode: null, stateName: null, pan: null };
  }

  const stateCode = cleaned.slice(0, 2);
  const stateName = GST_STATE_MAP[stateCode] || null;
  const pan = cleaned.slice(2, 12);

  return {
    isValid,
    stateCode: stateName ? stateCode : null,
    stateName,
    pan,
  };
}

export interface TaxCalculationParams {
  unitPrice: number;
  quantity: number;
  discountAmount?: number;
  gstRate: number;
  isTaxInclusive: boolean;
  isInterstate: boolean;
}

export interface TaxCalculationResult {
  taxableValue: number;
  taxAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

export function calculateGST({
  unitPrice,
  quantity,
  discountAmount = 0,
  gstRate = 0,
  isTaxInclusive,
  isInterstate,
}: TaxCalculationParams): TaxCalculationResult {
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  const disc = Number(discountAmount) || 0;
  const rate = Number(gstRate) || 0;

  let taxableValue = 0;
  let taxAmount = 0;
  let totalAmount = 0;

  if (isTaxInclusive) {
    const grossTotal = price * qty - disc;
    if (rate > 0) {
      taxableValue = grossTotal / (1 + rate / 100);
      taxAmount = grossTotal - taxableValue;
    } else {
      taxableValue = grossTotal;
      taxAmount = 0;
    }
    totalAmount = grossTotal;
  } else {
    taxableValue = price * qty - disc;
    taxAmount = rate > 0 ? (taxableValue * rate) / 100 : 0;
    totalAmount = taxableValue + taxAmount;
  }

  const roundedTaxable = Math.round(taxableValue * 100) / 100;
  const roundedTax = Math.round(taxAmount * 100) / 100;
  const roundedTotal = Math.round(totalAmount * 100) / 100;

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstAmount = roundedTax;
  } else {
    const halfTax = Math.round((roundedTax / 2) * 100) / 100;
    cgstAmount = halfTax;
    sgstAmount = Math.round((roundedTax - halfTax) * 100) / 100;
  }

  return {
    taxableValue: roundedTaxable,
    taxAmount: roundedTax,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount: roundedTotal,
  };
}
