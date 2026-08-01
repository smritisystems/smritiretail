/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : AccountingService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 & Rule 18 (Simplified Accounting Policy)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { AccountHead, IAccountingService, JournalVoucherRecord } from "../public/IAccountingService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class AccountingService implements IAccountingService {
  private chartOfAccounts: AccountHead[] = [
    { id: "acc-101", code: "1001", name: "Cash in Hand", type: "Asset", groupName: "Cash & Bank", balance: 50000, balanceType: "Dr" },
    { id: "acc-102", code: "1002", name: "HDFC Bank Account", type: "Asset", groupName: "Cash & Bank", balance: 250000, balanceType: "Dr" },
    { id: "acc-103", code: "1003", name: "Sundry Debtors (Accounts Receivable)", type: "Asset", groupName: "Current Assets", balance: 180000, balanceType: "Dr" },
    { id: "acc-201", code: "2001", name: "Sundry Creditors (Accounts Payable)", type: "Liability", groupName: "Current Liabilities", balance: 120000, balanceType: "Cr" },
    { id: "acc-202", code: "2002", name: "CGST Output Account", type: "Liability", groupName: "Duties & Taxes", balance: 15000, balanceType: "Cr" },
    { id: "acc-203", code: "2003", name: "SGST Output Account", type: "Liability", groupName: "Duties & Taxes", balance: 15000, balanceType: "Cr" },
    { id: "acc-204", code: "2004", name: "IGST Output Account", type: "Liability", groupName: "Duties & Taxes", balance: 0, balanceType: "Cr" },
    { id: "acc-301", code: "3001", name: "Retail Sales Revenue", type: "Revenue", groupName: "Sales Accounts", balance: 850000, balanceType: "Cr" },
    { id: "acc-401", code: "4001", name: "Cost of Goods Sold (COGS)", type: "Expense", groupName: "Purchase Accounts", balance: 520000, balanceType: "Dr" }
  ];

  private vouchersCache: JournalVoucherRecord[] = [];

  public async getChartOfAccounts(): Promise<AccountHead[]> {
    return this.chartOfAccounts;
  }

  public async getAccountById(idOrCode: string): Promise<AccountHead | null> {
    const q = idOrCode.trim().toLowerCase();
    return this.chartOfAccounts.find((a) => a.id.toLowerCase() === q || a.code.toLowerCase() === q) || null;
  }

  public async searchAccounts(query: string, type?: string): Promise<AccountHead[]> {
    const q = query.trim().toLowerCase();
    const t = type ? type.trim().toLowerCase() : "";

    return this.chartOfAccounts.filter((a) => {
      const matchesType = !t || t === "all" || a.type.toLowerCase() === t;
      if (!matchesType) return false;

      if (!q) return true;
      return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q) || a.groupName.toLowerCase().includes(q);
    });
  }

  public async getJournalVouchers(): Promise<JournalVoucherRecord[]> {
    try {
      const data = await apiFetchV1("/accounting/vouchers/");
      if (Array.isArray(data) && data.length > 0) {
        this.vouchersCache = data.map((v: any) => this.normalizeBackendVoucher(v));
        return this.vouchersCache;
      }
    } catch (e) {
      logger.warn("[AccountingService] API unreachable. Serving cached vouchers.", e as unknown);
    }
    return this.vouchersCache;
  }

  public async postJournalVoucher(voucherData: Partial<JournalVoucherRecord>): Promise<JournalVoucherRecord> {
    const lines = voucherData.lines || [];
    if (lines.length < 2) {
      throw new Error("[Rule 18 Accounting Error] A Journal Voucher must contain at least 2 line items (Debit & Credit).");
    }

    /* Assert Double-Entry Accounting Equality (Debits == Credits) */
    const totalDebit = lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);

    if (diff > 0.05) {
      throw new Error(`[Rule 18 Accounting Error] Unbalanced Journal Voucher! Total Debits (₹${totalDebit}) must equal Total Credits (₹${totalCredit}).`);
    }

    const id = voucherData.id || `jv_${Date.now()}`;
    const record: JournalVoucherRecord = {
      id,
      voucherNumber: voucherData.voucherNumber || `JV-2025-${Math.floor(1000 + Math.random() * 9000)}`,
      voucherType: voucherData.voucherType || "Journal",
      voucherDate: voucherData.voucherDate || new Date().toISOString().slice(0, 10),
      referenceDocumentNo: voucherData.referenceDocumentNo,
      entityId: voucherData.entityId,
      totalAmount: Math.round(totalDebit * 100) / 100,
      narration: voucherData.narration || "Automated System Journal Entry",
      lines,
      postedAt: voucherData.postedAt || new Date().toISOString()
    };

    try {
      const savedResponse = await apiFetchV1("/accounting/vouchers/", {
        method: "POST",
        body: JSON.stringify(record)
      });

      const normalized = this.normalizeBackendVoucher(savedResponse || record);
      this.upsertLocalVoucher(normalized);
      SPK.events.emit("JournalPosted", normalized.id, normalized);
      return normalized;
    } catch (err) {
      logger.warn("[AccountingService] Backend voucher save warning, caching locally.", err as unknown);
      this.upsertLocalVoucher(record);
      SPK.events.emit("JournalPosted", record.id, record);
      return record;
    }
  }

  public async postSalesInvoiceJournal(
    invoiceId: string,
    customerName: string,
    netAmount: number,
    taxAmount: number
  ): Promise<JournalVoucherRecord> {
    const taxableAmount = Math.max(0, netAmount - taxAmount);
    const halfTax = Math.round((taxAmount / 2) * 100) / 100;

    const voucher: Partial<JournalVoucherRecord> = {
      voucherType: "Sales",
      referenceDocumentNo: invoiceId,
      narration: `Automated silent posting for Sales Invoice ${invoiceId} — Customer: ${customerName}`,
      lines: [
        {
          accountId: "acc-103",
          accountCode: "1003",
          accountName: `Accounts Receivable (${customerName})`,
          debitAmount: Math.round(netAmount * 100) / 100,
          creditAmount: 0,
          narration: `Invoice Debit`
        },
        {
          accountId: "acc-301",
          accountCode: "3001",
          accountName: "Retail Sales Revenue",
          debitAmount: 0,
          creditAmount: Math.round(taxableAmount * 100) / 100,
          narration: `Taxable Sales Revenue`
        },
        {
          accountId: "acc-202",
          accountCode: "2002",
          accountName: "CGST Output Account",
          debitAmount: 0,
          creditAmount: halfTax,
          narration: `CGST Output 9%`
        },
        {
          accountId: "acc-203",
          accountCode: "2003",
          accountName: "SGST Output Account",
          debitAmount: 0,
          creditAmount: halfTax,
          narration: `SGST Output 9%`
        }
      ]
    };

    return this.postJournalVoucher(voucher);
  }

  private upsertLocalVoucher(v: JournalVoucherRecord): void {
    const idx = this.vouchersCache.findIndex((x) => x.id === v.id);
    if (idx >= 0) {
      this.vouchersCache[idx] = v;
    } else {
      this.vouchersCache.unshift(v);
    }
  }

  private normalizeBackendVoucher(v: any): JournalVoucherRecord {
    return {
      id: v.id,
      voucherNumber: v.voucher_number || v.voucherNumber || `JV-${v.id}`,
      voucherType: v.voucher_type || v.voucherType || "Journal",
      voucherDate: v.voucher_date || v.voucherDate || new Date().toISOString().slice(0, 10),
      referenceDocumentNo: v.reference_document_no || v.referenceDocumentNo,
      entityId: v.entity_id || v.entityId,
      totalAmount: v.total_amount !== undefined ? parseFloat(v.total_amount) : (v.totalAmount || 0),
      narration: v.narration || "",
      lines: Array.isArray(v.lines) ? v.lines : [],
      postedAt: v.posted_at || v.postedAt || new Date().toISOString()
    };
  }
}
