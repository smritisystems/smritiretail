/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : ItemLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { IItemService } from "../public/IItemService.js";

export class ItemLookupProvider implements ILookupProvider {
  public readonly domain = "ITEM";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "ITEM",
    title: "Item Master Catalog",
    icon: "package",
    defaultColumns: [
      { key: "code", label: "SKU Code", type: "text" },
      { key: "name", label: "Item Description", type: "text" },
      { key: "category", label: "Category", type: "text" },
      { key: "rate", label: "Selling Price", type: "currency" }
    ],
    searchFields: ["code", "name", "barcode", "hsn", "brand"],
    filterGroups: [
      {
        id: "hierarchy",
        label: "Product Hierarchy",
        fields: [
          { key: "category", label: "Category", type: "select" },
          { key: "brand", label: "Brand", type: "select" }
        ]
      }
    ],
    sortOptions: [
      { label: "Item Name", key: "name", order: "asc" },
      { label: "Selling Price", key: "rate", order: "desc" }
    ],
    savedViews: [
      {
        id: "low-stock",
        name: "Low Stock Items",
        description: "SKUs below safety re-order point",
        createdBy: "SYSTEM",
        createdOn: "2026-08-05",
        owner: "SYSTEM",
        shared: true,
        filters: { lowStock: true }
      }
    ],
    permissions: {
      readScope: "inventory:read",
      createScope: "inventory:create",
      costScope: "inventory:read_financials"
    },
    quickActions: [
      { id: "new-item", label: "New Item", icon: "plus", permission: "inventory:create", shortcut: "Ctrl+N" }
    ],
    keyboardShortcuts: { universalSearch: "F2" },
    defaultLayout: "table",
    supportedModes: ["field", "grid", "workspace", "global"],
    capabilities: {
      barcode: true,
      qr: true,
      voice: false,
      ai: true,
      bulkSelection: true,
      quickCreate: true
    }
  };

  async search(query: string): Promise<ILookupItem[]> {
    const itemService = SPK.services.resolve<IItemService>("ITEM");
    const products = await itemService.search(query);

    return products.map((p) => ({
      id: p.id,
      code: p.sku || p.code,
      name: p.name,
      title: p.name,
      subtitle: `${p.sku || p.code} • ${p.category || "General"}`,
      badge: `Stock: ${p.stock ?? p.stock_qty ?? 0} ${p.uom || "Pcs"}`,
      type: "ITEM",
      columns: { code: p.sku || p.code, name: p.name, category: p.category, rate: p.price },
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
      title: p.name,
      subtitle: `${p.sku || p.code} • ${p.category || "General"}`,
      badge: `Stock: ${p.stock ?? p.stock_qty ?? 0} ${p.uom || "Pcs"}`,
      type: "ITEM",
      columns: { code: p.sku || p.code, name: p.name, category: p.category, rate: p.price },
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
