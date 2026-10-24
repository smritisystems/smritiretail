/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.99.0
 * Created      : 2026-10-20
 * Modified     : 2026-10-20
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 * Target UI    : Enterprise Customer Tax Invoice Preview Card
 * Capability    : withCapability("customer.crud", "CRM")
 */

import React, { useState, useEffect } from "react";
import {
  FileText,
  Printer,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Receipt,
  Download,
  AlertCircle
} from "lucide-react";
import { RetailCustomerRecord } from "../types.ts";
import { apiFetchV1 } from "../../../lib/apiFetchV1.ts";

interface InvoiceItemPreview {
  sr: number;
  barcode: string;
  article: string;
  description: string;
  size: string;
  qty: number;
  rate: number;
  taxPercent: number;
  amount: number;
}

interface TaxInvoicePreviewProps {
  customer: RetailCustomerRecord;
  invoice?: any;
  onOpenFullInvoice?: (invoiceNo: string) => void;
}

export const CustomerTaxInvoicePreview: React.FC<TaxInvoicePreviewProps> = ({
  customer,
  invoice: propInvoice,
  onOpenFullInvoice,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any | null>(propInvoice || null);
  const [isLoading, setIsLoading] = useState(false);

  // Sync propInvoice if changed
  useEffect(() => {
    if (propInvoice) {
      setInvoiceData(propInvoice);
    }
  }, [propInvoice]);

  // Fetch the latest invoice for this customer if customer.id is present and no propInvoice
  useEffect(() => {
    if (propInvoice) return;
    let isMounted = true;
    const fetchLatestInvoice = async () => {
      if (!customer.id || customer.id.startsWith("cust-draft-")) {
        setInvoiceData(null);
        return;
      }
      setIsLoading(true);
      try {
        const res = await apiFetchV1<any>(
          `/sales/invoices?customer_id=${encodeURIComponent(customer.id)}&limit=1`
        );
        if (isMounted) {
          const list = Array.isArray(res) ? res : (res?.invoices || res?.items || []);
          if (list.length > 0) {
            setInvoiceData(list[0]);
          } else {
            setInvoiceData(null);
          }
        }
      } catch {
        if (isMounted) setInvoiceData(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLatestInvoice();
    return () => {
      isMounted = false;
    };
  }, [customer.id]);

  const rawItems: any[] = Array.isArray(invoiceData?.items) ? invoiceData.items : [];
  const items: InvoiceItemPreview[] = rawItems.map((it, idx) => ({
    sr: idx + 1,
    barcode: it.barcode || it.barcode_sym || it.code || "—",
    article: it.code || it.article || it.sku || "—",
    description: it.name || "Item",
    size: it.variant_id || it.size || "—",
    qty: Number(it.quantity || 1),
    rate: Number(it.price || 0),
    taxPercent: Number(it.gst_rate || 0),
    amount: Number(it.total_amount || 0),
  }));

  const invoiceNo = invoiceData?.invoice_no || invoiceData?.invoice_number || invoiceData?.invoiceNumber || "";
  const invoiceDate = invoiceData?.date || invoiceData?.invoice_date || invoiceData?.created_at?.split?.("T")?.[0] || "";
  const gstAmount = Number(invoiceData?.tax_amount ?? invoiceData?.tax_total ?? invoiceData?.taxTotal ?? 0);
  const totalAmount = Number(invoiceData?.grand_total ?? invoiceData?.grandTotal ?? 0);
  const subtotal = Number(invoiceData?.taxable_value ?? invoiceData?.taxableValue ?? (totalAmount - gstAmount));

  const billToName = invoiceData?.customer_name || customer.name || "—";
  const billToCode = customer.code || "—";
  const billToGstin = invoiceData?.customer_gstin || customer.gstin || "Not Registered";
  const billToAddress = invoiceData?.billing_address || customer.mailingAddresses?.[0]?.address1 || "—";
  const billToCityState = customer.mailingAddresses?.[0]?.city
    ? `${customer.mailingAddresses[0].city} - ${customer.mailingAddresses[0].postalCode || ""}, ${customer.mailingAddresses[0].state || ""}`
    : "—";

  const deliverToStoreCode = invoiceData?.delivery_store_code || "—";
  const deliverToAddress = invoiceData?.shipping_address || customer.mailingAddresses?.find(a => a.addressType === "shipping")?.address1 || "—";
  const deliverToStore = invoiceData?.delivery_store_code
    ? `Store Outlet (${invoiceData.delivery_store_code})`
    : (customer.name ? `${customer.name} Delivery Dock` : "Primary Outlet");
  const deliverToCityState = invoiceData?.shipping_address
    ? invoiceData.shipping_address
    : (customer.mailingAddresses?.find(a => a.addressType === "shipping")?.city
      ? `${customer.mailingAddresses.find(a => a.addressType === "shipping")?.city}, ${customer.mailingAddresses.find(a => a.addressType === "shipping")?.state}`
      : "—");

  return (
    <div className="bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Header Bar */}
      <div className="bg-[#00355f] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-sky-300" />
          <h3 className="font-bold text-xs tracking-wide">
            Tax Invoice Preview {invoiceData ? "" : "(No Invoices)"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {onOpenFullInvoice && invoiceNo && (
            <button
              type="button"
              onClick={() => onOpenFullInvoice(invoiceNo)}
              className="text-sky-200 hover:text-white p-1 rounded hover:bg-white/10 transition"
              title="Open Full Tax Invoice Viewer"
            >
              <ExternalLink size={13} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sky-200 hover:text-white p-1 rounded hover:bg-white/10 transition"
            title={isExpanded ? "Collapse Invoice" : "Expand Invoice"}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 bg-white dark:bg-slate-900 space-y-3.5 text-xs text-slate-800 dark:text-slate-200 font-sans">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500 animate-pulse">
              Loading authoritative tax invoice preview...
            </div>
          ) : !invoiceData ? (
            <div className="p-6 text-center space-y-2">
              <Receipt size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
              <div className="font-bold text-xs text-slate-700 dark:text-slate-300">
                No Posted Tax Invoices
              </div>
              <div className="text-[11px] text-slate-500 max-w-xs mx-auto">
                No sales invoices found for customer <span className="font-mono font-bold">{customer.code || customer.name}</span>. Real document preview and line items will appear here once an invoice is posted.
              </div>
            </div>
          ) : (
            <>
              {/* Top Brand & Invoice Metadata */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 font-black text-sm text-[#00355f] dark:text-[#8ebdf9] tracking-tight">
                    <span className="text-amber-500 text-lg leading-none font-extrabold">S</span>
                    <span>MRITI</span>
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 ml-1">Retail OS</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-slate-900 dark:text-white">Tax Invoice</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Invoice No. : <strong className="text-slate-800 dark:text-slate-200">{invoiceNo || "—"}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    Date : <strong className="text-slate-800 dark:text-slate-200">{invoiceDate || "—"}</strong>
                  </div>
                </div>
              </div>

              {/* Two-Column Bill-To & Deliver-To */}
              <div className="grid grid-cols-2 gap-3 text-[11px] leading-tight">
                {/* Bill To */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-sky-800 dark:text-sky-300 uppercase tracking-wider block mb-1">
                    Bill To (Corporate)
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {billToName} ({billToCode})
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{billToAddress}</div>
                  <div className="text-slate-600 dark:text-slate-400">{billToCityState}</div>
                  <div className="text-slate-700 dark:text-slate-300 font-mono text-[10px] mt-1">
                    GSTIN: <strong>{billToGstin}</strong>
                  </div>
                </div>

                {/* Deliver To */}
                <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-200/70 dark:border-emerald-800/50">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block mb-1">
                    Deliver To (Store)
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {deliverToStore}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400 mt-0.5">{deliverToAddress}</div>
                  <div className="text-slate-600 dark:text-slate-400">{deliverToCityState}</div>
                  <div className="text-slate-700 dark:text-slate-300 font-mono text-[10px] mt-1">
                    Store Code: <strong>{deliverToStoreCode}</strong>
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-[240px] overflow-y-auto">
                <table className="w-full text-left text-[10px] border-collapse min-w-[500px]">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700 z-10">
                    <tr>
                      <th className="p-1.5 w-6 text-center">#</th>
                      <th className="p-1.5">Barcode</th>
                      <th className="p-1.5">Article/Style</th>
                      <th className="p-1.5">Description</th>
                      <th className="p-1.5 text-center">Size</th>
                      <th className="p-1.5 text-right">Qty</th>
                      <th className="p-1.5 text-right">Rate</th>
                      <th className="p-1.5 text-right">Tax %</th>
                      <th className="p-1.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-4 text-center text-slate-400">
                          No line items recorded on this invoice.
                        </td>
                      </tr>
                    ) : (
                      items.map((it) => (
                        <tr key={it.sr} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-1.5 text-center font-mono text-slate-400">{it.sr}</td>
                          <td className="p-1.5 font-mono">{it.barcode}</td>
                          <td className="p-1.5 font-mono font-bold text-[#00355f] dark:text-[#8ebdf9]">{it.article}</td>
                          <td className="p-1.5 font-medium">{it.description}</td>
                          <td className="p-1.5 text-center font-bold">{it.size}</td>
                          <td className="p-1.5 text-right font-mono font-bold">{it.qty}</td>
                          <td className="p-1.5 text-right font-mono">{it.rate.toFixed(2)}</td>
                          <td className="p-1.5 text-right font-mono">{it.taxPercent}%</td>
                          <td className="p-1.5 text-right font-mono font-bold">{it.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Subtotal, Tax and Total */}
              <div className="flex justify-end pt-1">
                <div className="w-48 text-[11px] space-y-1">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono">{subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>GST Total</span>
                    <span className="font-mono">{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs font-black text-slate-900 dark:text-white border-t border-slate-300 dark:border-slate-700 pt-1">
                    <span>Total (₹)</span>
                    <span className="font-mono font-bold">₹ {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  );
};
