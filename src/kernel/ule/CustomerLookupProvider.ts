/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : CustomerLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { ICustomerService } from "../public/ICustomerService.js";

export class CustomerLookupProvider implements ILookupProvider {
  public readonly domain = "CUSTOMER";

  async search(query: string): Promise<ILookupItem[]> {
    const customerService = SPK.services.resolve<ICustomerService>("CUSTOMER");
    const customers = await customerService.search(query);

    return customers.map((c) => ({
      id: c.id,
      code: c.mobile,
      name: c.name,
      badge: `${c.customerGroupId || "Regular"} | GSTIN: ${c.gstNumber || "N/A"}`,
      type: "CUSTOMER",
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
      code: c.mobile,
      name: c.name,
      badge: `${c.customerGroupId || "Regular"} | GSTIN: ${c.gstNumber || "N/A"}`,
      type: "CUSTOMER",
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
