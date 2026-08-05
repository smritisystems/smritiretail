/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CustomerLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { ICustomerService } from "../public/ICustomerService.js";

export class CustomerLookupProvider implements ILookupProvider {
  public readonly domain = "CUSTOMER";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "CUSTOMER",
    title: "Customer CRM Accounts",
    icon: "users",
    defaultColumns: [
      { key: "code", label: "Mobile / Code", type: "text" },
      { key: "name", label: "Customer Name", type: "text" },
      { key: "gstin", label: "GSTIN", type: "text" },
      { key: "group", label: "Customer Group", type: "text" }
    ],
    searchFields: ["name", "mobile", "gstin", "email"],
    filterGroups: [
      {
        id: "crm",
        label: "CRM Segment",
        fields: [{ key: "group", label: "Customer Group", type: "select" }]
      }
    ],
    sortOptions: [{ label: "Customer Name", key: "name", order: "asc" }],
    savedViews: [
      {
        id: "vip-customers",
        name: "VIP Accounts",
        description: "High credit limit accounts",
        createdBy: "SYSTEM",
        createdOn: "2026-08-05",
        owner: "SYSTEM",
        shared: true,
        filters: { isVip: true }
      }
    ],
    permissions: {
      readScope: "customer:read",
      createScope: "customer:create",
      costScope: "customer:read_financials"
    },
    quickActions: [
      { id: "new-customer", label: "New Customer", icon: "user-plus", permission: "customer:create", shortcut: "Ctrl+N" }
    ],
    keyboardShortcuts: { universalSearch: "F2" },
    defaultLayout: "card",
    supportedModes: ["field", "grid", "workspace", "global"],
    capabilities: {
      barcode: false,
      qr: true,
      voice: false,
      ai: true,
      bulkSelection: true,
      quickCreate: true
    }
  };

  async search(query: string): Promise<ILookupItem[]> {
    const customerService = SPK.services.resolve<ICustomerService>("CUSTOMER");
    const customers = await customerService.search(query);

    return customers.map((c) => ({
      id: c.id,
      code: c.mobile || c.id,
      name: c.name,
      title: c.name,
      subtitle: `${c.mobile || "No Mobile"} • GSTIN: ${c.gstNumber || "N/A"}`,
      badge: `${c.customerGroupId || "Regular"}`,
      type: "CUSTOMER",
      columns: { code: c.mobile, name: c.name, gstin: c.gstNumber, group: c.customerGroupId },
      metadata: {
        mobile: c.mobile,
        email: c.email,
        gstin: c.gstNumber,
        group: c.customerGroupId,
        creditLimit: c.creditLimit,
        outstanding: c.outstanding,
        loyaltyPoints: c.loyaltyPoints
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const customerService = SPK.services.resolve<ICustomerService>("CUSTOMER");
    const c = await customerService.getById(id);
    if (!c) return null;

    return {
      id: c.id,
      code: c.mobile || c.id,
      name: c.name,
      title: c.name,
      subtitle: `${c.mobile || "No Mobile"} • GSTIN: ${c.gstNumber || "N/A"}`,
      badge: `${c.customerGroupId || "Regular"}`,
      type: "CUSTOMER",
      columns: { code: c.mobile, name: c.name, gstin: c.gstNumber, group: c.customerGroupId },
      metadata: {
        mobile: c.mobile,
        email: c.email,
        gstin: c.gstNumber,
        group: c.customerGroupId,
        creditLimit: c.creditLimit,
        outstanding: c.outstanding,
        loyaltyPoints: c.loyaltyPoints
      }
    };
  }
}
