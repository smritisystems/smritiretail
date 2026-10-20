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
  Download
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
  onOpenFullInvoice?: (invoiceNo: string) => void;
}

export const CustomerTaxInvoicePreview: React.FC<TaxInvoicePreviewProps> = ({
  customer,
  onOpenFullInvoice,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [invoiceData, setInvoiceData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Try fetching the latest invoice for this customer if customer.id is present
  useEffect(() => {
    let isMounted = true;
    const fetchLatestInvoice = async () => {
      if (!customer.id || customer.id.startsWith("cust-draft-")) return;
      setIsLoading(true);
      try {
        const res = await apiFetchV1<any>(
          `/sales/invoices?customer_id=${encodeURIComponent(customer.id)}&limit=1`
        );
        if (isMounted) {
          const list = Array.isArray(res) ? res : (res?.invoices || res?.items || []);
          if (list.length > 0) {
            setInvoiceData(list[0]);
          }
        }
      } catch {
        // Fallback to reference illustrative invoice
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLatestInvoice();
    return () => {
      isMounted = false;
    };
  }, [customer.id]);

  // Baseline illustrative items matching the reference screenshot
  const items: InvoiceItemPreview[] = [
    {
      sr: 1,
      barcode: "8901234567890",
      article: "ART001",
      description: "Men's T-Shirt",
      size: "L",
      qty: 10,
      rate: 599.00,
      taxPercent: 5,
      amount: 5990.00
    },
    {
      sr: 2,
      barcode: "8901234567891",
      article: "ART002",
      description: "Men's T-Shirt",
      size: "M",
      qty: 5,
      rate: 599.00,
      taxPercent: 5,
      amount: 2995.00
    },
    {
      sr: 3,
      barcode: "8901234567892",
      article: "ART003",
      description: "Men's T-Shirt",
      size: "XL",
      qty: 3,
      rate: 699.00,
      taxPercent: 5,
      amount: 2097.00
    }
  ];

  const invoiceNo = invoiceData?.invoice_number || invoiceData?.invoiceNumber || "TT2026-2027/18";
  const invoiceDate = invoiceData?.invoice_date || invoiceData?.date || "15/06/2026";
  const subtotal = 11062.00;
  const gstAmount = 554.10;
  const totalAmount = 11636.10;

  const billToName = customer.name || "Reliance Retail Limited";
  const billToCode = customer.code || "REL001";
  const billToGstin = customer.gstin || "27AABCR1234F1Z5";
  const billToAddress = customer.mailingAddresses?.[0]?.address1 || "3rd Floor, MMRDA Building, BKC";
  const billToCityState = `${customer.mailingAddresses?.[0]?.city || "Mumbai"} - ${customer.mailingAddresses?.[0]?.postalCode || "400051"}, ${customer.mailingAddresses?.[0]?.state || "Maharashtra"}`;

  const deliverToStore = "Reliance - Phoenix Mall (REL001-001)";
  const deliverToAddress = "Senapati Bapat Marg, Lower Parel";
  const deliverToCityState = "Mumbai - 400013, Maharashtra";
  const deliverToStoreCode = "REL-MUM-001";

  return (
    <div className="bg-white dark:bg-[#191c1e] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
      {/* Header Bar */}
      <div className="bg-[#00355f] text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-sky-300" />
          <h3 className="font-bold text-xs tracking-wide">
            Tax Invoice {invoiceData ? "" : "(Example)"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {onOpenFullInvoice && (
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
                Invoice No. : <strong className="text-slate-800 dark:text-slate-200">{invoiceNo}</strong>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Date : <strong className="text-slate-800 dark:text-slate-200">{invoiceDate}</strong>
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
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-[10px] border-collapse min-w-[500px]">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
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
                {items.map((it) => (
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
                ))}
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
                <span>GST (5%)</span>
                <span className="font-mono">{gstAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs font-black text-slate-900 dark:text-white border-t border-slate-300 dark:border-slate-700 pt-1">
                <span>Total (₹)</span>
                <span className="font-mono font-bold">₹ {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
