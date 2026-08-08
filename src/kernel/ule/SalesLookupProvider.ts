/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SalesLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { ISalesService, SalesInvoiceRecord } from "../public/ISalesService.js";

export class SalesLookupProvider implements ILookupProvider {
  public readonly domain = "SALES";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "SALES",
    title: "Sales Invoices & POS Receipts",
    icon: "shopping-bag",
    defaultColumns: [
      { key: "code", label: "Invoice / Receipt #", type: "text" },
      { key: "customerName", label: "Customer Name", type: "text" },
      { key: "amount", label: "Net Amount", type: "currency" },
      { key: "status", label: "Status", type: "badge" }
    ],
    searchFields: ["code", "customerName", "invoiceNumber"],
    filterGroups: [],
    sortOptions: [{ label: "Invoice Number", key: "code", order: "desc" }],
    savedViews: [],
    permissions: {
      readScope: "sales:read",
      createScope: "sales:create",
      costScope: "sales:read_financials"
    },
    quickActions: [
      { id: "new-sale", label: "New Sale (POS)", icon: "shopping-cart", permission: "sales:create", shortcut: "Ctrl+N" }
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
    const salesService = SPK.services.resolve<ISalesService>("SALES");
    const list: SalesInvoiceRecord[] = typeof salesService.searchInvoices === "function"
      ? await salesService.searchInvoices(query)
      : typeof (salesService as any).search === "function"
      ? await (salesService as any).search(query)
      : [];

    return list.map((inv: SalesInvoiceRecord) => ({
      id: inv.id,
      code: inv.invoiceNumber || inv.id,
      name: `Sale #${inv.invoiceNumber || inv.id} — ${inv.customerName || "Walk-in Customer"}`,
      title: `Sale #${inv.invoiceNumber || inv.id}`,
      subtitle: `${inv.customerName || "Walk-in"} • Status: ${inv.status || "Paid"}`,
      badge: `${inv.status || "Paid"} | ₹${inv.netPayable || 0}`,
      type: "SALES",
      columns: { code: inv.invoiceNumber || inv.id, customerName: inv.customerName, amount: inv.netPayable, status: inv.status },
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        customerMobile: inv.customerMobile,
        customerName: inv.customerName,
        netPayable: inv.netPayable,
        status: inv.status
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const salesService = SPK.services.resolve<ISalesService>("SALES");
    const inv: SalesInvoiceRecord | null = typeof salesService.getInvoiceById === "function"
      ? await salesService.getInvoiceById(id)
      : typeof (salesService as any).getById === "function"
      ? await (salesService as any).getById(id)
      : null;
    if (!inv) return null;

    return {
      id: inv.id,
      code: inv.invoiceNumber || inv.id,
      name: `Sale #${inv.invoiceNumber || inv.id} — ${inv.customerName || "Walk-in Customer"}`,
      title: `Sale #${inv.invoiceNumber || inv.id}`,
      subtitle: `${inv.customerName || "Walk-in"} • Status: ${inv.status || "Paid"}`,
      badge: `${inv.status || "Paid"} | ₹${inv.netPayable || 0}`,
      type: "SALES",
      columns: { code: inv.invoiceNumber || inv.id, customerName: inv.customerName, amount: inv.netPayable, status: inv.status },
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        customerMobile: inv.customerMobile,
        customerName: inv.customerName,
        netPayable: inv.netPayable,
        status: inv.status
      }
    };
  }
}
