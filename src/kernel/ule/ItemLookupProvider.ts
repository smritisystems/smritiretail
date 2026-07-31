/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ItemLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { IItemService } from "../public/IItemService.js";

export class ItemLookupProvider implements ILookupProvider {
  public readonly domain = "ITEM";

  async search(query: string): Promise<ILookupItem[]> {
    const itemService = SPK.services.resolve<IItemService>("ITEM");
    const products = await itemService.search(query);

    return products.map((p) => ({
      id: p.id,
      code: p.sku || p.code,
      name: p.name,
      badge: `Stock: ${p.stock ?? p.stock_qty ?? 0} ${p.uom || "Pcs"}`,
      type: "ITEM",
      metadata: {
        barcode: p.barcode,
        hsn: p.hsn_code || p.hsnCode,
        rate: p.price,
        mrp: p.mrp,
        costPrice: p.purchase_price || p.costPrice,
        uom: p.uom,
        brand: p.brand,
        category: p.category,
        taxRate: p.gst_rate || p.gstPercentage
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const itemService = SPK.services.resolve<IItemService>("ITEM");
    const p = await itemService.getById(id);
    if (!p) return null;

    return {
      id: p.id,
      code: p.sku || p.code,
      name: p.name,
      badge: `Stock: ${p.stock ?? p.stock_qty ?? 0} ${p.uom || "Pcs"}`,
      type: "ITEM",
      metadata: {
        barcode: p.barcode,
        hsn: p.hsn_code || p.hsnCode,
        rate: p.price,
        mrp: p.mrp,
        costPrice: p.purchase_price || p.costPrice,
        uom: p.uom,
        brand: p.brand,
        category: p.category,
        taxRate: p.gst_rate || p.gstPercentage
      }
    };
  }
}
