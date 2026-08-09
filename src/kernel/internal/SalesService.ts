/**
 * Project      : SMRITI Application Platform (SMAP) v1.0
 * Component    : SalesService Core Domain Implementation
 * Standard     : SMAP Constitution v1.0 — Internal Domain Engine
 * Author       : Jawahar Ramkripal Mallah
 * License      : Proprietary Commercial Software
 */

import logger from "../../core/logging/logger.js";
import { ISalesService, SalesInvoiceRecord, SalesInvoiceStatus } from "../public/ISalesService.js";
import { IAccountingService } from "../public/IAccountingService.js";
import { apiFetchV1 } from "../../lib/apiFetchV1.js";
import { SPK } from "../SPK.js";

export class SalesService implements ISalesService {
  private localCache: SalesInvoiceRecord[] = [];

  public async getAllInvoices(): Promise<SalesInvoiceRecord[]> {
    try {
      const data = await apiFetchV1("/sales/invoices/");
      if (Array.isArray(data)) {
        this.localCache = data.map((inv: any) => this.normalizeBackendInvoice(inv));
        return this.localCache;
      }
    } catch (e) {
      logger.error("[SalesService] API unreachable.", e as unknown);
      throw e;
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

  public async getByCustomer(customerMobileOrId: string): Promise<SalesInvoiceRecord[]> {
    const list = await this.getAllInvoices();
    const clean = customerMobileOrId.trim().toLowerCase();
    return list.filter((inv) =>
      inv.customerMobile.toLowerCase() === clean ||
      inv.customerName.toLowerCase().includes(clean) ||
      inv.id.toLowerCase() === clean
    );
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
      this.triggerSilentAccountingJournal(normalized);
      SPK.events.emit("InvoiceCreated", normalized.id, normalized);
      return normalized;
    } catch (err) {
      logger.error("[SalesService] Backend invoice save failed:", err as unknown);
      throw err;
    }
  }

  private triggerSilentAccountingJournal(invoice: SalesInvoiceRecord): void {
    /* Rule 18: Automatic Silent Accounting Journal Posting */
    try {
      const accountingService = SPK.services.resolve<IAccountingService>("ACCOUNTING");
      accountingService.postSalesInvoiceJournal(invoice.invoiceNumber, invoice.customerName, invoice.netPayable, invoice.taxTotal);
    } catch (aErr) {
      logger.warn("[SalesService] Silent accounting journal posting skipped:", aErr as unknown);
    }
  }

  public async cancelInvoice(id: string, reason: string, cancelledBy = "System"): Promise<SalesInvoiceRecord> {
    if (!reason || reason.trim().length < 3) {
      throw new Error("[SalesService Error] Cancellation reason is mandatory and must be at least 3 characters.");
    }

    const invoice = await this.getInvoiceById(id);
    if (!invoice) {
      throw new Error(`[SalesService Error] Sales Invoice ${id} not found.`);
    }

    const nonCancellableStatuses: SalesInvoiceStatus[] = ["Cancelled", "Refunded"];
    if (nonCancellableStatuses.includes(invoice.status as SalesInvoiceStatus)) {
      throw new Error(
        `[SalesService Error] Invoice ${invoice.invoiceNumber} is in status "${invoice.status}" and cannot be cancelled.`
      );
    }

    const cancelledRecord: SalesInvoiceRecord = {
      ...invoice,
      status: "Cancelled",
      cancellationReason: reason.trim(),
      cancelledAt: new Date().toISOString(),
      cancelledBy,
    };

    try {
      await apiFetchV1(`/sales/invoices/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ reason: cancelledRecord.cancellationReason, cancelledBy: cancelledRecord.cancelledBy }),
      });
    } catch (err) {
      logger.warn("[SalesService] Backend cancel API unreachable. Updating local cache only.", err as unknown);
    }

    this.upsertLocalCache(cancelledRecord);
    SPK.events.emit("InvoiceCancelled", id, {
      invoiceId: id,
      invoiceNumber: invoice.invoiceNumber,
      reason: cancelledRecord.cancellationReason,
      cancelledBy: cancelledRecord.cancelledBy,
    });

    return cancelledRecord;
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
