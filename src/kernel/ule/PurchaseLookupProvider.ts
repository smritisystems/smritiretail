/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : PurchaseLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { IPurchaseService } from "../public/IPurchaseService.js";

export class PurchaseLookupProvider implements ILookupProvider {
  public readonly domain = "PURCHASE_ORDER";

  async search(query: string): Promise<ILookupItem[]> {
    const purchaseService = SPK.services.resolve<IPurchaseService>("PURCHASE");
    const list = await purchaseService.searchPOs(query);

    return list.map((po) => ({
      id: po.id,
      code: po.poNumber,
      name: `PO: ${po.poNumber} — ${po.supplierName}`,
      badge: `Status: ${po.status} | Net: ₹${po.netPayable.toLocaleString("en-IN")}`,
      type: "PURCHASE_ORDER",
      metadata: {
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        status: po.status,
        netPayable: po.netPayable,
        lineCount: po.lines.length
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const purchaseService = SPK.services.resolve<IPurchaseService>("PURCHASE");
    const po = await purchaseService.getPOById(id);
    if (!po) return null;

    return {
      id: po.id,
      code: po.poNumber,
      name: `PO: ${po.poNumber} — ${po.supplierName}`,
      badge: `Status: ${po.status} | Net: ₹${po.netPayable.toLocaleString("en-IN")}`,
      type: "PURCHASE_ORDER",
      metadata: {
        poNumber: po.poNumber,
        supplierName: po.supplierName,
        orderDate: po.orderDate,
        status: po.status,
        netPayable: po.netPayable,
        lineCount: po.lines.length
      }
    };
  }
}
