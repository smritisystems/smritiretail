/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SupplierLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { ISupplierService } from "../public/ISupplierService.js";

export class SupplierLookupProvider implements ILookupProvider {
  public readonly domain = "SUPPLIER";

  async search(query: string): Promise<ILookupItem[]> {
    const supplierService = SPK.services.resolve<ISupplierService>("SUPPLIER");
    const list = await supplierService.search(query);

    return list.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      badge: `GSTIN: ${s.gstNumber || "N/A"} | ${s.city || "Mumbai"}`,
      type: "SUPPLIER",
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
      badge: `GSTIN: ${s.gstNumber || "N/A"} | ${s.city || "Mumbai"}`,
      type: "SUPPLIER",
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
