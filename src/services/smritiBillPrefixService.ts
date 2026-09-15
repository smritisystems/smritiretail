/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS & SMRITI Systems
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.18.0
 * Created      : 2026-09-14
 * Modified     : 2026-09-14
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Description  : Enterprise Bill Prefix & Document Serialization Service (Shoper 9 Parity & GST Rule 46b Compliance)
 */

import { apiFetchV1 } from "../lib/apiFetchV1.ts";

export type TransactionGroup = "SALES" | "CASH" | "SLIPS";

export type BillingTransactionType =
  | "SALES_CASH"
  | "SALES_CREDIT"
  | "SALES_RETURN"
  | "VOID_SALES"
  | "BILL_HOLD"
  | "SALES_ORDER"
  | "SALES_ADVICE_SLIP"
  | "SERVICE_ORDER"
  | "DELIVERY_CHALLAN"
  | "APPROVAL_DC"
  | "CASH_RECEIPT"
  | "CASH_PAYOUT";

export interface BillPrefixDefinition {
  id?: string;
  name: string;
  documentType: string;
  transactionGroup: TransactionGroup;
  terminalId: string;
  isCommonAcrossTerminals: boolean;
  prefix: string;
  suffix: string;
  startNumber: number;
  currentNumber: number;
  runningLength: number;
  isActive: boolean;
  isVoidUnified: boolean;
}

export interface BillPrefixResolveResult {
  seriesId: string;
  prefix: string;
  suffix: string;
  nextDocNo: number;
  formattedDocNo: string;
  fullPreview: string;
  runningLength: number;
  terminalId: string;
  isCommonAcrossTerminals: boolean;
  gstRule46bValid: boolean;
  gstRule46bLength: number;
  validationMessage?: string;
}

export interface GstValidationResult {
  isValid: boolean;
  combined: string;
  length: number;
  error?: string;
}

/**
 * Validates statutory GST Rule 46(b) compliance:
 * - Consecutive serial number not exceeding 16 characters
 * - Permitted characters: alphabets, numerals, '-' and '/'
 * - Unique for financial year
 */
export function validateGstRule46b(
  prefix: string = "",
  docNo: number | string = 1,
  suffix: string = ""
): GstValidationResult {
  const cleanPfx = prefix || "";
  const cleanSfx = suffix || "";
  const combined = `${cleanPfx}${docNo}${cleanSfx}`;
  const length = combined.length;

  const validCharRegex = /^[A-Za-z0-9/-]+$/;
  const isValidChars = combined.length === 0 || validCharRegex.test(combined);
  const isValidLen = length <= 16;
  const isValid = isValidChars && isValidLen;

  let error: string | undefined;
  if (!isValidLen) {
    error = `Statutory GST Rule 46(b) violation: Serial number '${combined}' (${length} chars) exceeds maximum 16 characters.`;
  } else if (!isValidChars) {
    error = `Statutory GST Rule 46(b) violation: Serial number '${combined}' contains invalid characters (only A-Z, 0-9, '/', '-' permitted).`;
  }

  return {
    isValid,
    combined,
    length,
    error
  };
}

/**
 * Formats a preview document number string given prefix, sequence, suffix, and padding.
 */
export function formatBillPreview(
  prefix: string = "",
  docNo: number = 1,
  suffix: string = "",
  runningLength: number = 4
): string {
  const padded = docNo.toString().padStart(runningLength, "0");
  return `${prefix || ""}${padded}${suffix || ""}`;
}

export class SmritiBillPrefixService {
  private static localCache = new Map<string, BillPrefixResolveResult>();

  /**
   * Generates standard default prefix definitions for all transaction categories.
   */
  public static getDefaultDefinitions(
    terminalId: string = "COMMON",
    isCommon: boolean = true,
    companyCode: string = ""
  ): BillPrefixDefinition[] {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fySuffix = `${fyStart.toString().slice(-2)}-${(fyStart + 1).toString().slice(-2)}`;
    const compPfx = companyCode ? `${companyCode}/` : "";

    return [
      // Sales Group
      {
        name: "Cash Sales Invoice",
        documentType: "SALES_CASH",
        transactionGroup: "SALES",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}INV/C/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Credit Sales Invoice",
        documentType: "SALES_CREDIT",
        transactionGroup: "SALES",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}INV/CR/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Sales Return",
        documentType: "SALES_RETURN",
        transactionGroup: "SALES",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}RET/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Void Sales",
        documentType: "VOID_SALES",
        transactionGroup: "SALES",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}VOID/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: true
      },

      // Cash Group
      {
        name: "Cash Receipt",
        documentType: "CASH_RECEIPT",
        transactionGroup: "CASH",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}RCP/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Cash Payout",
        documentType: "CASH_PAYOUT",
        transactionGroup: "CASH",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}PAY/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },

      // Intermediate Slips Group
      {
        name: "Bill Suspension (Hold)",
        documentType: "BILL_HOLD",
        transactionGroup: "SLIPS",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}HOLD/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Sales Order",
        documentType: "SALES_ORDER",
        transactionGroup: "SLIPS",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}SO/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Sales Advice Slip",
        documentType: "SALES_ADVICE_SLIP",
        transactionGroup: "SLIPS",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}SAS/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Service Order",
        documentType: "SERVICE_ORDER",
        transactionGroup: "SLIPS",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}SVO/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Delivery Challan",
        documentType: "DELIVERY_CHALLAN",
        transactionGroup: "SLIPS",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}DC/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      },
      {
        name: "Approval DC",
        documentType: "APPROVAL_DC",
        transactionGroup: "SLIPS",
        terminalId,
        isCommonAcrossTerminals: isCommon,
        prefix: `${compPfx}ADC/`,
        suffix: fySuffix,
        startNumber: 1,
        currentNumber: 0,
        runningLength: 4,
        isActive: true,
        isVoidUnified: false
      }
    ];
  }

  /**
   * Resolves the active bill prefix and next sequence for the given transaction type and terminal.
   */
  public static async resolveActivePrefix(params: {
    transactionType: BillingTransactionType | string;
    terminalId?: string;
    branchId?: string;
    billType?: string;
  }): Promise<BillPrefixResolveResult> {
    const termId = (params.terminalId || "COMMON").toUpperCase();
    const txType = (params.transactionType || "SALES_CASH").toUpperCase();
    const cacheKey = `${txType}:${termId}:${params.branchId || "ALL"}`;

    try {
      const response = await apiFetchV1<BillPrefixResolveResult>("/numbering/bill-prefixes/resolve", {
        method: "POST",
        body: JSON.stringify({
          transactionType: txType,
          terminalId: termId,
          branchId: params.branchId,
          billType: params.billType || "Product"
        })
      });

      if (response && response.prefix) {
        this.localCache.set(cacheKey, response);
        return response;
      }
    } catch (err) {
      console.warn("REST call to resolve bill prefix failed, using fallback:", err);
    }

    // Offline / Network Fallback
    const cached = this.localCache.get(cacheKey);
    if (cached) return cached;

    const defaults = this.getDefaultDefinitions(termId);
    const matched = defaults.find(d => d.documentType === txType) || defaults[0];
    const preview = formatBillPreview(matched.prefix, matched.startNumber, matched.suffix, matched.runningLength);
    const gst = validateGstRule46b(matched.prefix, matched.startNumber.toString().padStart(matched.runningLength, "0"), matched.suffix);

    const fallbackResult: BillPrefixResolveResult = {
      seriesId: "LOCAL_FALLBACK",
      prefix: matched.prefix,
      suffix: matched.suffix,
      nextDocNo: matched.startNumber,
      formattedDocNo: matched.startNumber.toString().padStart(matched.runningLength, "0"),
      fullPreview: preview,
      runningLength: matched.runningLength,
      terminalId: termId,
      isCommonAcrossTerminals: matched.isCommonAcrossTerminals,
      gstRule46bValid: gst.isValid,
      gstRule46bLength: gst.length,
      validationMessage: gst.error
    };

    return fallbackResult;
  }

  /**
   * Fetches all bill prefixes for configuration / studio.
   */
  public static async getAllPrefixes(filters?: {
    transactionGroup?: TransactionGroup;
    terminalId?: string;
    branchId?: string;
  }): Promise<BillPrefixDefinition[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters?.transactionGroup) queryParams.append("transaction_group", filters.transactionGroup);
      if (filters?.terminalId) queryParams.append("terminal_id", filters.terminalId);
      if (filters?.branchId) queryParams.append("branch_id", filters.branchId);

      const qs = queryParams.toString();
      const url = `/numbering/bill-prefixes${qs ? `?${qs}` : ""}`;
      const data = await apiFetchV1<any[]>(url);
      if (Array.isArray(data) && data.length > 0) {
        return data.map(d => ({
          id: d.id,
          name: d.name,
          documentType: d.documentType,
          transactionGroup: d.transactionGroup || "SALES",
          terminalId: d.terminalId || "COMMON",
          isCommonAcrossTerminals: d.isCommonAcrossTerminals !== false,
          prefix: d.prefix || "",
          suffix: d.suffix || "",
          startNumber: d.startNumber || 1,
          currentNumber: d.currentNumber || 0,
          runningLength: d.runningLength || 4,
          isActive: d.isActive !== false,
          isVoidUnified: Boolean(d.isVoidUnified)
        }));
      }
    } catch (err) {
      console.warn("Failed to fetch bill prefixes from API:", err);
    }
    return this.getDefaultDefinitions(filters?.terminalId || "COMMON");
  }

  /**
   * Batch saves prefix schemes from the Prefix Management Studio.
   */
  public static async saveBatch(payload: {
    terminalId?: string;
    isCommonAcrossTerminals?: boolean;
    companyCodeAsPrefix?: boolean;
    branchId?: string;
    items: BillPrefixDefinition[];
  }): Promise<boolean> {
    await apiFetchV1("/numbering/bill-prefixes/save-batch", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    this.localCache.clear();
    return true;
  }

  /**
   * Executes supervisory Year End Process.
   */
  public static async executeYearEndRollover(payload: {
    newFinancialYear: string;
    newYearSuffix: string;
    resetToStartNumber: boolean;
  }): Promise<any> {
    const res = await apiFetchV1("/numbering/year-end-rollover", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    this.localCache.clear();
    return res;
  }

  /**
   * Retrieves Terminal Prefix Listing report.
   */
  public static async getTerminalPrefixesReport(params?: {
    terminalId?: string;
    branchId?: string;
  }): Promise<{ items: any[]; count: number }> {
    const q = new URLSearchParams();
    if (params?.terminalId) q.append("terminal_id", params.terminalId);
    if (params?.branchId) q.append("branch_id", params.branchId);
    const qs = q.toString();
    return await apiFetchV1(`/numbering/terminal-prefixes-report${qs ? `?${qs}` : ""}`);
  }
}
