/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : PurchaseLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { IPurchaseService, PurchaseOrderRecord } from "../public/IPurchaseService.js";

export class PurchaseLookupProvider implements ILookupProvider {
  public readonly domain = "PURCHASE";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "PURCHASE",
    title: "Purchase Orders & Bills",
    icon: "file-text",
    defaultColumns: [
      { key: "code", label: "PO / Invoice #", type: "text" },
      { key: "supplierName", label: "Supplier Name", type: "text" },
      { key: "amount", label: "Net Amount", type: "currency" },
      { key: "status", label: "Status", type: "badge" }
    ],
    searchFields: ["code", "supplierName", "poNumber"],
    filterGroups: [],
    sortOptions: [{ label: "Invoice Number", key: "code", order: "desc" }],
    savedViews: [],
    permissions: {
      readScope: "purchase:read",
      createScope: "purchase:create",
      costScope: "purchase:read_financials"
    },
    quickActions: [
      { id: "new-po", label: "New PO", icon: "plus-circle", permission: "purchase:create", shortcut: "Ctrl+N" }
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
    const purchaseService = SPK.services.resolve<IPurchaseService>("PURCHASE");
    const list: PurchaseOrderRecord[] = typeof purchaseService.searchPOs === "function"
      ? await purchaseService.searchPOs(query)
      : typeof (purchaseService as any).search === "function"
      ? await (purchaseService as any).search(query)
      : [];

    return list.map((po: PurchaseOrderRecord) => ({
      id: po.id,
      code: po.poNumber || po.id,
      name: `PO #${po.poNumber || po.id} — ${po.supplierName || "Vendor"}`,
      title: `PO #${po.poNumber || po.id}`,
      subtitle: `${po.supplierName || "Vendor"} • Status: ${po.status || "Draft"}`,
      badge: `${po.status || "Draft"} | ₹${po.netPayable || po.totalAmount || 0}`,
      type: "PURCHASE",
      columns: { code: po.poNumber || po.id, supplierName: po.supplierName, amount: po.netPayable, status: po.status },
      metadata: {
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        netPayable: po.netPayable,
        status: po.status
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const purchaseService = SPK.services.resolve<IPurchaseService>("PURCHASE");
    const po: PurchaseOrderRecord | null = typeof purchaseService.getPOById === "function"
      ? await purchaseService.getPOById(id)
      : typeof (purchaseService as any).getById === "function"
      ? await (purchaseService as any).getById(id)
      : null;
    if (!po) return null;

    return {
      id: po.id,
      code: po.poNumber || po.id,
      name: `PO #${po.poNumber || po.id} — ${po.supplierName || "Vendor"}`,
      title: `PO #${po.poNumber || po.id}`,
      subtitle: `${po.supplierName || "Vendor"} • Status: ${po.status || "Draft"}`,
      badge: `${po.status || "Draft"} | ₹${po.netPayable || po.totalAmount || 0}`,
      type: "PURCHASE",
      columns: { code: po.poNumber || po.id, supplierName: po.supplierName, amount: po.netPayable, status: po.status },
      metadata: {
        poNumber: po.poNumber,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        netPayable: po.netPayable,
        status: po.status
      }
    };
  }
}
