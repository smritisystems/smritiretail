/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SalesService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import { ISalesService, SalesInvoiceRecord } from "../public/ISalesService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class SalesService implements ISalesService {
  private localCache: SalesInvoiceRecord[] = [
    {
      id: "inv-1001",
      invoiceNumber: "INV-2025-0001",
      customerName: "Walk-in Retail Customer",
      customerMobile: "9876543210",
      invoiceDate: "2025-05-15",
      paymentMode: "UPI",
      cashierName: "Jawahar Mallah",
      itemsTotal: 3000,
      discountTotal: 0,
      taxableTotal: 2542.37,
      cgstTotal: 228.81,
      sgstTotal: 228.81,
      igstTotal: 0,
      taxTotal: 457.63,
      netPayable: 3000,
      roundedAmount: 3000,
      status: "Paid",
      lines: [
        {
          id: "invl-1",
          itemId: "prod-1",
          itemCode: "SHOE-001",
          itemName: "Nike Sports Shoes",
          hsnCode: "6404",
          qty: 1,
          uom: "Pair",
          rate: 3000,
          discountPct: 0,
          discountAmount: 0,
          taxableValue: 2542.37,
          gstRate: 18,
          cgstAmount: 228.81,
          sgstAmount: 228.81,
          igstAmount: 0,
          totalTaxAmount: 457.63,
          lineTotal: 3000
        }
      ]
    }
  ];

  public async getAllInvoices(): Promise<SalesInvoiceRecord[]> {
    try {
      const data = await apiFetchV1("/sales/invoices/");
      if (Array.isArray(data) && data.length > 0) {
        this.localCache = data.map((inv: any) => this.normalizeBackendInvoice(inv));
        return this.localCache;
      }
    } catch (e) {
      console.warn("[SalesService] API unreachable. Serving cached sales invoices.", e);
    }
    return this.localCache;
  }

  public async getInvoiceById(id: string): Promise<SalesInvoiceRecord | null> {
    const list = await this.getAllInvoices();
    return list.find((inv) => inv.id === id || inv.invoiceNumber === id) || null;
  }

  public async getByInvoiceNumber(invoiceNumber: string): Promise<SalesInvoiceRecord | null> {
    const list = await this.getAllInvoices();
    const clean = invoiceNumber.trim().toLowerCase();
    return list.find((inv) => inv.invoiceNumber.toLowerCase() === clean) || null;
  }

  public async searchInvoices(query: string, limit = 50): Promise<SalesInvoiceRecord[]> {
    const list = await this.getAllInvoices();
    const q = query.trim().toLowerCase();

    return list
      .filter((inv) => {
        if (!q) return true;
        const matchNumber = inv.invoiceNumber.toLowerCase().includes(q);
        const matchCustomer = inv.customerName.toLowerCase().includes(q);
        const matchMobile = inv.customerMobile.includes(q);

        return matchNumber || matchCustomer || matchMobile;
      })
      .slice(0, limit);
  }

  public async saveInvoice(invoiceData: Partial<SalesInvoiceRecord>): Promise<SalesInvoiceRecord> {
    const isNew = !invoiceData.id || invoiceData.id.startsWith("inv_temp_");
    const id = invoiceData.id || `inv_${Date.now()}`;

    const record: SalesInvoiceRecord = {
      id,
      invoiceNumber: invoiceData.invoiceNumber || `INV-2025-${Math.floor(10000 + Math.random() * 90000)}`,
      customerName: invoiceData.customerName || "Walk-in Customer",
      customerMobile: invoiceData.customerMobile || "9876543210",
      customerGstin: invoiceData.customerGstin,
      customerGroupId: invoiceData.customerGroupId || "CG-Regular",
      invoiceDate: invoiceData.invoiceDate || new Date().toISOString().slice(0, 10),
      paymentMode: invoiceData.paymentMode || "Cash",
      cashierName: invoiceData.cashierName || "System Operator",
      itemsTotal: invoiceData.itemsTotal || 0,
      discountTotal: invoiceData.discountTotal || 0,
      taxableTotal: invoiceData.taxableTotal || 0,
      cgstTotal: invoiceData.cgstTotal || 0,
      sgstTotal: invoiceData.sgstTotal || 0,
      igstTotal: invoiceData.igstTotal || 0,
      taxTotal: invoiceData.taxTotal || 0,
      netPayable: invoiceData.netPayable || 0,
      roundedAmount: invoiceData.roundedAmount || invoiceData.netPayable || 0,
      taxSnapshot: invoiceData.taxSnapshot,
      lines: invoiceData.lines || [],
      status: invoiceData.status || "Paid"
    };

    try {
      const endpoint = isNew ? "/sales/invoices/" : `/sales/invoices/${id}`;
      const method = isNew ? "POST" : "PUT";
      const savedResponse = await apiFetchV1(endpoint, {
        method,
        body: JSON.stringify(record)
      });

      const normalized = this.normalizeBackendInvoice(savedResponse || record);
      this.upsertLocalCache(normalized);
      SPK.events.emit("InvoiceCreated", normalized.id, normalized);
      return normalized;
    } catch (err) {
      console.warn("[SalesService] Backend save warning, caching locally.", err);
      this.upsertLocalCache(record);
      SPK.events.emit("InvoiceCreated", record.id, record);
      return record;
    }
  }

  private upsertLocalCache(inv: SalesInvoiceRecord): void {
    const idx = this.localCache.findIndex((i) => i.id === inv.id);
    if (idx >= 0) {
      this.localCache[idx] = inv;
    } else {
      this.localCache.unshift(inv);
    }
  }

  private normalizeBackendInvoice(inv: any): SalesInvoiceRecord {
    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number || inv.invoiceNumber || `INV-${inv.id}`,
      customerName: inv.customer_name || inv.customerName || "Customer",
      customerMobile: inv.customer_mobile || inv.customerMobile || "",
      customerGstin: inv.customer_gstin || inv.customerGstin,
      customerGroupId: inv.customer_group_id || inv.customerGroupId || "CG-Regular",
      invoiceDate: inv.invoice_date || inv.invoiceDate || new Date().toISOString().slice(0, 10),
      paymentMode: inv.payment_mode || inv.paymentMode || "Cash",
      cashierName: inv.cashier_name || inv.cashierName || "Cashier",
      itemsTotal: inv.items_total !== undefined ? parseFloat(inv.items_total) : (inv.itemsTotal || 0),
      discountTotal: inv.discount_total !== undefined ? parseFloat(inv.discount_total) : (inv.discountTotal || 0),
      taxableTotal: inv.taxable_total !== undefined ? parseFloat(inv.taxable_total) : (inv.taxableTotal || 0),
      cgstTotal: inv.cgst_total !== undefined ? parseFloat(inv.cgst_total) : (inv.cgstTotal || 0),
      sgstTotal: inv.sgst_total !== undefined ? parseFloat(inv.sgst_total) : (inv.sgstTotal || 0),
      igstTotal: inv.igst_total !== undefined ? parseFloat(inv.igst_total) : (inv.igstTotal || 0),
      taxTotal: inv.tax_total !== undefined ? parseFloat(inv.tax_total) : (inv.taxTotal || 0),
      netPayable: inv.net_payable !== undefined ? parseFloat(inv.net_payable) : (inv.netPayable || 0),
      roundedAmount: inv.rounded_amount !== undefined ? parseFloat(inv.rounded_amount) : (inv.roundedAmount || 0),
      taxSnapshot: inv.tax_snapshot || inv.taxSnapshot,
      lines: Array.isArray(inv.lines) ? inv.lines : [],
      status: inv.status || "Paid"
    };
  }
}
