/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : IAccountingService Public Interface Contract
 * Standard     : SMAP Constitution v1.0 & Rule 18 (Simplified Accounting Policy)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

export interface AccountHead {
  id: string;
  code: string;
  name: string;
  type: "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
  groupName: string; // e.g. "Current Assets", "GST Paid", "Sales Revenue"
  balance: number;
  balanceType: "Dr" | "Cr";
}

export interface JournalVoucherLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  narration?: string;
}

export interface JournalVoucherRecord {
  id: string;
  voucherNumber: string;
  voucherType: "Sales" | "Purchase" | "Receipt" | "Payment" | "Journal" | "Contra" | string;
  voucherDate: string; // ISO YYYY-MM-DD
  referenceDocumentNo?: string;
  entityId?: string; // CustomerId / SupplierId
  totalAmount: number;
  narration: string;
  lines: JournalVoucherLine[];
  postedAt: string;
}

export interface IAccountingService {
  /**
   * Resolve an account head by ID or Account Code
   */
  getAccountById(idOrCode: string): Promise<AccountHead | null>;

  /**
   * Search Chart of Accounts by name, code, or type
   */
  searchAccounts(query: string, type?: string): Promise<AccountHead[]>;

  /**
   * Post a balanced Journal Voucher through UVE validation and Command Bus
   */
  postJournalVoucher(voucher: Partial<JournalVoucherRecord>): Promise<JournalVoucherRecord>;

  /**
   * Automatically generate and silently post a Sales Invoice Journal Voucher
   */
  postSalesInvoiceJournal(invoiceId: string, customerName: string, netAmount: number, taxAmount: number): Promise<JournalVoucherRecord>;

  /**
   * Fetch all active Chart of Accounts
   */
  getChartOfAccounts(): Promise<AccountHead[]>;

  /**
   * Fetch all posted journal vouchers
   */
  getJournalVouchers(): Promise<JournalVoucherRecord[]>;
}
