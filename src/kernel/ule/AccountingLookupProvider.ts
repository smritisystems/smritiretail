/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : AccountingLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { IAccountingService } from "../public/IAccountingService.js";

export class AccountingLookupProvider implements ILookupProvider {
  public readonly domain = "ACCOUNT_HEAD";

  async search(query: string): Promise<ILookupItem[]> {
    const accountingService = SPK.services.resolve<IAccountingService>("ACCOUNTING");
    const list = await accountingService.searchAccounts(query);

    return list.map((a) => ({
      id: a.id,
      code: a.code,
      name: `${a.code} — ${a.name}`,
      badge: `Group: ${a.groupName} | Type: ${a.type} (${a.balanceType})`,
      type: "ACCOUNT_HEAD",
      metadata: {
        code: a.code,
        name: a.name,
        type: a.type,
        groupName: a.groupName,
        balance: a.balance,
        balanceType: a.balanceType
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const accountingService = SPK.services.resolve<IAccountingService>("ACCOUNTING");
    const a = await accountingService.getAccountById(id);
    if (!a) return null;

    return {
      id: a.id,
      code: a.code,
      name: `${a.code} — ${a.name}`,
      badge: `Group: ${a.groupName} | Type: ${a.type} (${a.balanceType})`,
      type: "ACCOUNT_HEAD",
      metadata: {
        code: a.code,
        name: a.name,
        type: a.type,
        groupName: a.groupName,
        balance: a.balance,
        balanceType: a.balanceType
      }
    };
  }
}
