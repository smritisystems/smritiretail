/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SalesLookupProvider for Universal Lookup Engine (ULE)
 * Standard     : SMAP Constitution v1.0 — ULE Integration
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ILookupItem, ILookupProvider, SPK } from "../SPK.js";
import { ISalesService } from "../public/ISalesService.js";

export class SalesLookupProvider implements ILookupProvider {
  public readonly domain = "SALES_INVOICE";

  async search(query: string): Promise<ILookupItem[]> {
    const salesService = SPK.services.resolve<ISalesService>("SALES");
    const list = await salesService.searchInvoices(query);

    return list.map((inv) => ({
      id: inv.id,
      code: inv.invoiceNumber,
      name: `Invoice: ${inv.invoiceNumber} — ${inv.customerName}`,
      badge: `Status: ${inv.status} | Net: ₹${inv.netPayable.toLocaleString("en-IN")}`,
      type: "SALES_INVOICE",
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerMobile: inv.customerMobile,
        invoiceDate: inv.invoiceDate,
        paymentMode: inv.paymentMode,
        netPayable: inv.netPayable,
        lineCount: inv.lines.length
      }
    }));
  }

  async getById(id: string): Promise<ILookupItem | null> {
    const salesService = SPK.services.resolve<ISalesService>("SALES");
    const inv = await salesService.getInvoiceById(id);
    if (!inv) return null;

    return {
      id: inv.id,
      code: inv.invoiceNumber,
      name: `Invoice: ${inv.invoiceNumber} — ${inv.customerName}`,
      badge: `Status: ${inv.status} | Net: ₹${inv.netPayable.toLocaleString("en-IN")}`,
      type: "SALES_INVOICE",
      metadata: {
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        customerMobile: inv.customerMobile,
        invoiceDate: inv.invoiceDate,
        paymentMode: inv.paymentMode,
        netPayable: inv.netPayable,
        lineCount: inv.lines.length
      }
    };
  }
}
