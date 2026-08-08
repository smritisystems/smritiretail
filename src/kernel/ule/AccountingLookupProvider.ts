/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : AccountingLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { IAccountingService, AccountHead } from "../public/IAccountingService.js";

export class AccountingLookupProvider implements ILookupProvider {
  public readonly domain = "ACCOUNTING";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "ACCOUNTING",
    title: "Chart of Accounts & Ledgers",
    icon: "book-open",
    defaultColumns: [
      { key: "code", label: "Ledger Code", type: "text" },
      { key: "name", label: "Account Name", type: "text" },
      { key: "group", label: "Account Group", type: "text" },
      { key: "balance", label: "Closing Balance", type: "currency" }
    ],
    searchFields: ["code", "name", "group"],
    filterGroups: [],
    sortOptions: [{ label: "Account Name", key: "name", order: "asc" }],
    savedViews: [],
    permissions: {
      readScope: "accounting:read",
      createScope: "accounting:create",
      costScope: "accounting:read_financials"
    },
    quickActions: [
      { id: "new-ledger", label: "New Ledger", icon: "plus-circle", permission: "accounting:create", shortcut: "Ctrl+N" }
    ],
    keyboardShortcuts: { universalSearch: "F2" },
    defaultLayout: "tree",
    supportedModes: ["field", "grid", "workspace", "global"],
    capabilities: {
      barcode: false,
      qr: false,
      voice: false,
      ai: true,
      bulkSelection: true,
      quickCreate: true
    }
  };

  async search(query: string): Promise<ILookupItem[]> {
    const accService = SPK.services.resolve<IAccountingService>("ACCOUNTING");
    const list: AccountHead[] = typeof accService.searchAccounts === "function"
      ? await accService.searchAccounts(query)
      : typeof (accService as any).search === "function"
      ? await (accService as any).search(query)
      : [];

    return list.map((a: AccountHead) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      title: a.name,
      subtitle: `${a.code} • Group: ${a.groupName || "General"}`,
      badge: `Group: ${a.groupName || "General"}`,
      type: "ACCOUNTING",
      columns: { code: a.code, name: a.name, group: a.groupName, balance: a.balance },
      metadata: {
        accountGroup: a.groupName,
        accountType: a.type,
        balance: a.balance,
        balanceType: a.balanceType
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const accService = SPK.services.resolve<IAccountingService>("ACCOUNTING");
    const a: AccountHead | null = typeof accService.getAccountById === "function"
      ? await accService.getAccountById(id)
      : typeof (accService as any).getById === "function"
      ? await (accService as any).getById(id)
      : null;
    if (!a) return null;

    return {
      id: a.id,
      code: a.code,
      name: a.name,
      title: a.name,
      subtitle: `${a.code} • Group: ${a.groupName || "General"}`,
      badge: `Group: ${a.groupName || "General"}`,
      type: "ACCOUNTING",
      columns: { code: a.code, name: a.name, group: a.groupName, balance: a.balance },
      metadata: {
        accountGroup: a.groupName,
        accountType: a.type,
        balance: a.balance,
        balanceType: a.balanceType
      }
    };
  }
}
