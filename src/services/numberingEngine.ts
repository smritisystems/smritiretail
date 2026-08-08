/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: smritisys.com | aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import logger from "../core/logging/logger.js";

export type NumberingMode = "Auto" | "Manual" | "Hybrid";
export type ResetRule = "Never" | "Daily" | "Monthly" | "Quarterly" | "Financial Year" | "Calendar Year" | "Branch";

export interface DocumentSeries {
  id: string;
  name: string;
  documentType: string;
  module: string;
  branch: string;
  financialYear: string;
  prefix: string;
  suffix: string;
  runningLength: number;
  currentNumber: number;
  resetRule: ResetRule;
  mode: NumberingMode;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
  
  // Enterprise Extensions
  tallyVoucherType?: string;
  dateLockEnabled?: boolean;
  periodLockEnabled?: boolean;
  preventManualOverrides?: boolean;
  preventDuplicateCheck?: boolean;
  allowGaplessSequencing?: boolean;
  enforceChronologicalDate?: boolean;
  companyCode?: string;
  description?: string;
}

export interface NumberingAuditLog {
  id: string;
  timestamp: string;
  seriesId: string;
  seriesName: string;
  action: "CREATE" | "UPDATE" | "RESET" | "ALLOCATE";
  user: string;
  documentNo: string;
  oldValue: string;
  newValue: string;
  details: string;
}

import { apiFetchV1 } from "../lib/apiFetchV1";

export class NumberingEngine {
  private static localSeries: DocumentSeries[] = [
    {
      id: "SER-001",
      name: "Standard Retail Invoice",
      documentType: "Retail Invoice",
      module: "Sales",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "INV/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 145,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      tallyVoucherType: "Sales",
      dateLockEnabled: true,
      companyCode: "SMRITI_IND"
    },
    {
      id: "PUR-001",
      name: "Standard Purchase Invoice",
      documentType: "Purchase Invoice",
      module: "Purchase",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "PUR/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 58,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      tallyVoucherType: "Purchase",
      companyCode: "SMRITI_IND"
    },
    {
      id: "SRET-001",
      name: "Sales Return Series",
      documentType: "Sales Return",
      module: "Sales",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "SRET/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 5,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      tallyVoucherType: "Sales Return",
      companyCode: "SMRITI_IND"
    },
    {
      id: "PRET-001",
      name: "Purchase Return Series",
      documentType: "Purchase Return",
      module: "Purchase",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "PRET/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 12,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      tallyVoucherType: "Purchase Return",
      companyCode: "SMRITI_IND"
    },
    {
      id: "STF-001",
      name: "Stock Transfer Series",
      documentType: "Stock Transfer",
      module: "Inventory",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "STF/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 3,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      tallyVoucherType: "Stock Transfer",
      companyCode: "SMRITI_IND"
    },
    {
      id: "PHYS-001",
      name: "Physical Stock Adjustment Series",
      documentType: "Physical Stock",
      module: "Inventory",
      branch: "All",
      financialYear: "2026-2027",
      prefix: "PHYS/{FY}/{Branch}/",
      suffix: "",
      runningLength: 6,
      currentNumber: 1,
      resetRule: "Financial Year",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2027-03-31",
      tallyVoucherType: "Stock Adjustment",
      companyCode: "SMRITI_IND"
    },
    {
      id: "SER-002",
      name: "Mumbai Wholesale PO",
      documentType: "Purchase Order",
      module: "Purchase",
      branch: "MUM",
      financialYear: "2026-2027",
      prefix: "PO-MUM-",
      suffix: "",
      runningLength: 4,
      currentNumber: 22,
      resetRule: "Never",
      mode: "Auto",
      isActive: true,
      effectiveFrom: "2026-01-01",
      effectiveTo: "2099-12-31",
      tallyVoucherType: "Purchase Order",
      companyCode: "SMRITI_MUM"
    }
  ];

  static getAllSeries(): DocumentSeries[] {
    return [...this.localSeries];
  }

  // Synchronous preview formatting helper
  static formatPreview(s: DocumentSeries, context?: { branch?: string; fy?: string; date?: string; user?: string }): string {
    const nextNum = s.currentNumber + 1;
    const formattedNum = nextNum.toString().padStart(s.runningLength, '0');

    const branchVal = context?.branch || (s.branch === "All" ? "HQ" : s.branch);
    const fyVal = context?.fy || "26-27";
    const dateVal = context?.date ? new Date(context.date) : new Date();
    const currentMonth = (dateVal.getMonth() + 1).toString().padStart(2, "0");
    const currentYear = dateVal.getFullYear().toString();
    const currentDay = dateVal.getDate().toString().padStart(2, "0");

    let finalPrefix = s.prefix || "";
    finalPrefix = finalPrefix.replace(/{FY}/g, fyVal);
    finalPrefix = finalPrefix.replace(/{Branch}/g, branchVal);
    finalPrefix = finalPrefix.replace(/{Store}/g, branchVal);
    finalPrefix = finalPrefix.replace(/{Month}/g, currentMonth);
    finalPrefix = finalPrefix.replace(/{Year}/g, currentYear);
    finalPrefix = finalPrefix.replace(/{Date}/g, currentDay);
    finalPrefix = finalPrefix.replace(/{User}/g, context?.user || "System");
    finalPrefix = finalPrefix.replace(/{Module}/g, s.module || "");

    let finalSuffix = s.suffix || "";
    finalSuffix = finalSuffix.replace(/{FY}/g, fyVal);
    finalSuffix = finalSuffix.replace(/{Branch}/g, branchVal);
    finalSuffix = finalSuffix.replace(/{Store}/g, branchVal);
    finalSuffix = finalSuffix.replace(/{Month}/g, currentMonth);
    finalSuffix = finalSuffix.replace(/{Year}/g, currentYear);
    finalSuffix = finalSuffix.replace(/{Date}/g, currentDay);
    finalSuffix = finalSuffix.replace(/{User}/g, context?.user || "System");
    finalSuffix = finalSuffix.replace(/{Module}/g, s.module || "");

    return `${finalPrefix}${formattedNum}${finalSuffix}`;
  }

  // ==========================================
  // ASYNC API CLIENT FOR REAL-TIME SYNC
  // ==========================================
  static async getAllSeriesAsync(): Promise<DocumentSeries[]> {
    try {
      const data = await apiFetchV1("/numbering/series");
      this.localSeries = data;
      return data;
    } catch (err) {
      logger.warn("REST Error, falling back to local storage:", err as unknown);
      return this.localSeries;
    }
  }

  static async createSeriesAsync(series: Partial<DocumentSeries>): Promise<DocumentSeries> {
    const data = await apiFetchV1("/numbering/series", {
      method: "POST",
      body: JSON.stringify(series)
    });
    return data;
  }

  static async updateSeriesAsync(id: string, series: Partial<DocumentSeries>): Promise<DocumentSeries> {
    const data = await apiFetchV1(`/numbering/series/${id}`, {
      method: "PUT",
      body: JSON.stringify(series)
    });
    return data;
  }

  static async deleteSeriesAsync(id: string): Promise<boolean> {
    await apiFetchV1(`/numbering/series/${id}`, {
      method: "DELETE"
    });
    return true;
  }

  static async getAuditLogsAsync(): Promise<NumberingAuditLog[]> {
    try {
      return await apiFetchV1("/numbering/logs");
    } catch (err) {
      logger.error(String(err));
      return [];
    }
  }

  static async allocateNextNumberAsync(seriesId: string, context?: { branch?: string; fy?: string }): Promise<string> {
    const data = await apiFetchV1(`/numbering/series/${seriesId}/allocate`, {
      method: "POST",
      body: JSON.stringify(context || {})
    });
    return data.documentNo;
  }
}
