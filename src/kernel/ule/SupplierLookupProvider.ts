/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SupplierLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — Rule 18 (DCP-001)
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, LookupManifest, SPK } from "../SPK.js";
import { ISupplierService } from "../public/ISupplierService.js";

export class SupplierLookupProvider implements ILookupProvider {
  public readonly domain = "SUPPLIER";
  public readonly state = "ACTIVE";

  public readonly manifest: LookupManifest = {
    manifestVersion: "2.3.0",
    schemaVersion: "1.0.0",
    minimumKernelVersion: "1.0.0",
    domain: "SUPPLIER",
    title: "Supplier Sourcing Directory",
    icon: "building",
    defaultColumns: [
      { key: "code", label: "Supplier Code", type: "text" },
      { key: "name", label: "Company Name", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "gstin", label: "GSTIN", type: "text" }
    ],
    searchFields: ["code", "name", "gstin", "city", "contactPerson"],
    filterGroups: [
      {
        id: "location",
        label: "Geographic Location",
        fields: [{ key: "city", label: "City", type: "text" }]
      }
    ],
    sortOptions: [{ label: "Supplier Name", key: "name", order: "asc" }],
    savedViews: [
      {
        id: "active-vendors",
        name: "Active Vendors",
        description: "Approved vendors with active purchase contracts",
        createdBy: "SYSTEM",
        createdOn: "2026-08-05",
        owner: "SYSTEM",
        shared: true,
        filters: { active: true }
      }
    ],
    permissions: {
      readScope: "purchase:read",
      createScope: "purchase:create",
      costScope: "purchase:read_financials"
    },
    quickActions: [
      { id: "new-vendor", label: "New Vendor", icon: "building", permission: "purchase:create", shortcut: "Ctrl+N" }
    ],
    keyboardShortcuts: { universalSearch: "F2" },
    defaultLayout: "table",
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
    const supplierService = SPK.services.resolve<ISupplierService>("SUPPLIER");
    const list = await supplierService.search(query);

    return list.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      title: s.name,
      subtitle: `${s.code} • ${s.city || "Mumbai"}`,
      badge: `GSTIN: ${s.gstNumber || "N/A"}`,
      type: "SUPPLIER",
      columns: { code: s.code, name: s.name, city: s.city, gstin: s.gstNumber },
      metadata: {
        mobile: s.mobile,
        email: s.email,
        contactPerson: s.contactPerson,
        gstin: s.gstNumber,
        city: s.city,
        state: s.state,
        paymentTerms: s.paymentTerms,
        creditDays: s.creditDays,
        outstanding: s.outstanding
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const supplierService = SPK.services.resolve<ISupplierService>("SUPPLIER");
    const s = await supplierService.getById(id);
    if (!s) return null;

    return {
      id: s.id,
      code: s.code,
      name: s.name,
      title: s.name,
      subtitle: `${s.code} • ${s.city || "Mumbai"}`,
      badge: `GSTIN: ${s.gstNumber || "N/A"}`,
      type: "SUPPLIER",
      columns: { code: s.code, name: s.name, city: s.city, gstin: s.gstNumber },
      metadata: {
        mobile: s.mobile,
        email: s.email,
        contactPerson: s.contactPerson,
        gstin: s.gstNumber,
        city: s.city,
        state: s.state,
        paymentTerms: s.paymentTerms,
        creditDays: s.creditDays,
        outstanding: s.outstanding
      }
    };
  }
}
