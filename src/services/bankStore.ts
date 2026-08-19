/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-08-13
 * Modified     : 2026-08-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

export interface BankAccountRecord {
  id: string;
  bankName: string;
  accountName?: string;
  accountNumber?: string;
  accountNo?: string;
  ifsc?: string;
  ifscCode?: string;
  branch?: string;
  branchName?: string;
  upi?: string;
  upiId?: string;
  isDefault?: boolean;
}

export const DEFAULT_BANK_ACCOUNT: BankAccountRecord = {
  id: "bank-default",
  bankName: "",
  branch: "",
  branchName: "",
  accountName: "",
  accountNo: "",
  accountNumber: "",
  ifsc: "",
  ifscCode: "",
  isDefault: true
};

export const DEFAULT_SBI_BANK_ACCOUNT = DEFAULT_BANK_ACCOUNT;

const STORAGE_KEY = "smriti_bank_accounts";

/**
 * Loads available bank accounts from localStorage fallback or Bank Master
 */
export function getAvailableBankAccounts(): BankAccountRecord[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to read bank accounts from localStorage:", e);
  }
  return [DEFAULT_SBI_BANK_ACCOUNT];
}

/**
 * Saves bank account list to localStorage fallback
 */
export function saveBankAccounts(accounts: BankAccountRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.warn("Failed to save bank accounts to localStorage:", e);
  }
}

/**
 * Returns default bank account if configured, or first available
 */
export function getDefaultBankAccount(): BankAccountRecord {
  const accounts = getAvailableBankAccounts();
  const defaultBank = accounts.find(a => a.isDefault);
  return defaultBank || DEFAULT_SBI_BANK_ACCOUNT;
}
