/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.30.0
 * Created      : 2026-08-27
 * Modified     : 2026-08-27
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { formatCurrency, formatQuantity } from "../../lib/formatters";

export interface SalesOrderItemData {
  item_code?: string;
  item_description?: string;
  article_no?: string;
  name?: string;
  hsn_code?: string;
  quantity: number;
  ordered_qty?: number;
  unit_price?: number;
  price?: number;
  rate?: number;
  mrp?: number;
  discount_pct?: number;
  taxable_value?: number;
  gst_rate?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_tax?: number;
  tax_amount?: number;
  total_amount?: number;
  line_total?: number;
  size?: string;
  color?: string;
}

export interface SalesOrderA4Data {
  id?: string;
  order_no: string;
  po_number?: string;
  order_date: string;
  delivery_date?: string;
  site_code?: string;
  site_name?: string;
  customer_name?: string;
  customer_gstin?: string;
  billing_address?: string;
  shipping_address?: string;
  destination_state?: string;
  place_of_supply?: string;
  is_interstate?: boolean;
  total_qty?: number;
  basic_total?: number;
  tax_total?: number;
  grand_total?: number;
  amount_in_words?: string;
  fulfillment_status?: string;
  items: SalesOrderItemData[];
  supplier_name?: string;
  supplier_gstin?: string;
  supplier_address?: string;
  supplier_phone?: string;
  supplier_email?: string;
  bank_name?: string;
  account_no?: string;
  ifsc_code?: string;
  bank_branch?: string;
  account_holder_name?: string;
}

interface SalesOrderA4Props {
  data: SalesOrderA4Data;
  hideWatermark?: boolean;
}

export const SalesOrderA4: React.FC<SalesOrderA4Props> = ({ data, hideWatermark = false }) => {
  const items = data.items || [];
  const totQty = data.total_qty ?? items.reduce((acc, it) => acc + (it.quantity || it.ordered_qty || 0), 0);
  const basicTot = data.basic_total ?? items.reduce((acc, it) => acc + (it.taxable_value || ((it.quantity || 0) * (it.unit_price || it.price || 0))), 0);
  const taxTot = data.tax_total ?? items.reduce((acc, it) => acc + (it.total_tax || it.tax_amount || 0), 0);
  const grandTot = data.grand_total ?? (basicTot + taxTot);

  const supplierName = data.supplier_name || "TATTLY THREADS";
  const supplierGstin = data.supplier_gstin || "27AAXFT2508H1ZR";
  const supplierAddr = data.supplier_address || "C/O RAMKRIPAL MALLAH, H NO. 2785, OLD BAGADGANJ ROAD, WARDHMAN NAGAR, NAGPUR, MAHARASHTRA 440008";
  const supplierPhone = data.supplier_phone || "+91 9324117007 / +91 9823023023";
  const supplierEmail = data.supplier_email || "support@smritibooks.com";

  const bankName = data.bank_name || "STATE BANK OF INDIA";
  const accNo = data.account_no || "43976711765";
  const ifsc = data.ifsc_code || "SBIN0030425";
  const branch = data.bank_branch || "WARDHMAN NAGAR NAGPUR";
  const accHolder = data.account_holder_name || "TATTLY THREADS";

  return (
    <div className="a4-document relative bg-white text-slate-900 mx-auto shadow-2xl rounded-sm print:shadow-none print:m-0 print:w-full print:max-w-none text-[11px] leading-tight select-text"
         style={{ width: "210mm", minHeight: "297mm", padding: "12mm 15mm", boxSizing: "border-box", fontFamily: "Segoe UI, Inter, Roboto, sans-serif" }}>
      
      {/* 13% Opacity Watermark */}
      {!hideWatermark && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.13] z-0">
          <div className="text-center font-black tracking-widest text-slate-900 rotate-[-30deg] select-none text-[75px] border-8 border-dashed border-slate-700 px-12 py-6 rounded-3xl">
            TATTLY THREADS
            <div className="text-2xl font-bold tracking-normal mt-2">CONFIRMED ORDER</div>
          </div>
        </div>
      )}

      {/* Header Band */}
      <div className="relative z-10 border-b-2 border-slate-900 pb-3 mb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-indigo-950 uppercase">{supplierName}</h1>
            <p className="text-[10px] text-slate-600 max-w-[380px] mt-0.5">{supplierAddr}</p>
            <p className="text-[10px] font-semibold text-slate-700 mt-0.5">
              GSTIN: <span className="font-mono text-indigo-900 font-bold">{supplierGstin}</span> | Ph: {supplierPhone}
            </p>
          </div>
          <div className="text-right">
            <div className="inline-block bg-indigo-900 text-white font-bold text-xs uppercase px-3 py-1 rounded tracking-wider mb-1">
              Sales Order Confirmation
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Proforma Reference Document</p>
          </div>
        </div>
      </div>

      {/* Metadata 2-Column Grid */}
      <div className="relative z-10 grid grid-cols-2 gap-3 mb-3 text-[10.5px]">
        {/* Order Details */}
        <div className="border border-slate-300 rounded p-2.5 bg-slate-50/70">
          <div className="font-bold text-indigo-950 border-b border-slate-200 pb-1 mb-1.5 flex justify-between">
            <span>ORDER PARTICULARS</span>
            <span className="text-[10px] text-indigo-700 font-mono">STATUS: {(data.fulfillment_status || "UNFULFILLED").toUpperCase()}</span>
          </div>
          <div className="grid grid-cols-3 gap-y-1">
            <span className="text-slate-500 font-medium">Order No:</span>
            <span className="col-span-2 font-bold font-mono text-slate-900">{data.order_no}</span>

            <span className="text-slate-500 font-medium">Order Date:</span>
            <span className="col-span-2 font-semibold text-slate-800">{data.order_date || "-"}</span>

            <span className="text-slate-500 font-medium">Customer PO:</span>
            <span className="col-span-2 font-bold font-mono text-indigo-900">{data.po_number || "-"}</span>

            <span className="text-slate-500 font-medium">Delivery SLA:</span>
            <span className="col-span-2 font-semibold text-amber-900">{data.delivery_date || "Immediate / On Allocation"}</span>

            <span className="text-slate-500 font-medium">Store Code:</span>
            <span className="col-span-2 font-mono font-bold text-slate-900">{data.site_code || "-"} {data.site_name ? `(${data.site_name})` : ""}</span>
          </div>
        </div>

        {/* Customer / Consignee Details */}
        <div className="border border-slate-300 rounded p-2.5 bg-slate-50/70">
          <div className="font-bold text-indigo-950 border-b border-slate-200 pb-1 mb-1.5">
            BUYER / BILL TO & SHIP TO
          </div>
          <div className="grid grid-cols-3 gap-y-1">
            <span className="text-slate-500 font-medium">Customer:</span>
            <span className="col-span-2 font-bold text-slate-900">{data.customer_name || "Reliance Retail Limited"}</span>

            <span className="text-slate-500 font-medium">GSTIN:</span>
            <span className="col-span-2 font-mono font-bold text-slate-900">{data.customer_gstin || "27AABCR1718E1ZL"}</span>

            <span className="text-slate-500 font-medium">Place of Supply:</span>
            <span className="col-span-2 font-semibold text-slate-800">{data.place_of_supply || data.destination_state || "Maharashtra (27)"}</span>

            <span className="text-slate-500 font-medium">Delivery Addr:</span>
            <span className="col-span-2 text-[9.5px] text-slate-600 truncate">{data.shipping_address || data.billing_address || "As per PO master schedule"}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="relative z-10 mb-3 border border-slate-300 rounded overflow-hidden">
        <table className="w-full text-left border-collapse text-[10px]">
          <thead className="bg-slate-800 text-white font-semibold uppercase text-[9px] tracking-wider">
            <tr>
              <th className="p-1.5 text-center w-8 border-r border-slate-700">#</th>
              <th className="p-1.5 border-r border-slate-700">Style / Description</th>
              <th className="p-1.5 text-center w-16 border-r border-slate-700">HSN</th>
              <th className="p-1.5 text-right w-12 border-r border-slate-700">Qty</th>
              <th className="p-1.5 text-right w-16 border-r border-slate-700">Rate (₹)</th>
              <th className="p-1.5 text-right w-14 border-r border-slate-700">MRP (₹)</th>
              <th className="p-1.5 text-right w-20 border-r border-slate-700">Taxable (₹)</th>
              <th className="p-1.5 text-center w-10 border-r border-slate-700">GST</th>
              <th className="p-1.5 text-right w-16 border-r border-slate-700">Tax (₹)</th>
              <th className="p-1.5 text-right w-20">Total (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((it, idx) => {
              const q = it.quantity || it.ordered_qty || 0;
              const rate = it.unit_price || it.price || it.rate || 0;
              const mrp = it.mrp || rate * 1.75;
              const taxable = it.taxable_value || (q * rate);
              const tax = it.total_tax || it.tax_amount || (taxable * 0.05);
              const lineTot = it.total_amount || it.line_total || (taxable + tax);
              const isEven = idx % 2 === 0;

              return (
                <tr key={idx} className={isEven ? "bg-white" : "bg-slate-50/60"}>
                  <td className="p-1.5 text-center font-mono text-slate-500 border-r border-slate-200">{idx + 1}</td>
                  <td className="p-1.5 border-r border-slate-200">
                    <div className="font-bold text-slate-900">{it.item_description || it.name || it.article_no || "Footwear Article"}</div>
                    {it.item_code && <div className="text-[9px] font-mono text-slate-500">Code: {it.item_code}</div>}
                  </td>
                  <td className="p-1.5 text-center font-mono text-slate-600 border-r border-slate-200">{it.hsn_code || "64041990"}</td>
                  <td className="p-1.5 text-right font-bold text-slate-900 border-r border-slate-200">{formatQuantity(q)}</td>
                  <td className="p-1.5 text-right font-mono text-slate-700 border-r border-slate-200">{formatCurrency(rate)}</td>
                  <td className="p-1.5 text-right font-mono text-slate-500 border-r border-slate-200">{formatCurrency(mrp)}</td>
                  <td className="p-1.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">{formatCurrency(taxable)}</td>
                  <td className="p-1.5 text-center font-mono text-slate-600 border-r border-slate-200">{it.gst_rate ?? 5}%</td>
                  <td className="p-1.5 text-right font-mono text-slate-700 border-r border-slate-200">{formatCurrency(tax)}</td>
                  <td className="p-1.5 text-right font-mono font-bold text-indigo-950">{formatCurrency(lineTot)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
            <tr>
              <td colSpan={3} className="p-1.5 text-right uppercase">Total Booked Quantity:</td>
              <td className="p-1.5 text-right font-mono text-indigo-950 font-bold">{formatQuantity(totQty)}</td>
              <td colSpan={2} className="p-1.5 text-right uppercase">Totals:</td>
              <td className="p-1.5 text-right font-mono">{formatCurrency(basicTot)}</td>
              <td></td>
              <td className="p-1.5 text-right font-mono">{formatCurrency(taxTot)}</td>
              <td className="p-1.5 text-right font-mono text-indigo-950 text-[11px] font-black">{formatCurrency(grandTot)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Amount in Words */}
      <div className="relative z-10 mb-3 p-2 bg-indigo-50/60 border border-indigo-200 rounded text-[10px]">
        <span className="font-bold text-indigo-950">Amount in Words: </span>
        <span className="italic font-medium text-indigo-900">
          {data.amount_in_words || "INR Total Inclusive of Statutory GST Taxes"}
        </span>
      </div>

      {/* Footer 2-Column: Bank Settlement & Signatory */}
      <div className="relative z-10 grid grid-cols-2 gap-3 text-[10px] mt-auto">
        {/* Bank & Remittance Instructions */}
        <div className="border border-slate-300 rounded p-2.5 bg-slate-50/70">
          <div className="font-bold text-indigo-950 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
            <span>PERMANENT BANK REMITTANCE ACCOUNT</span>
          </div>
          <div className="grid grid-cols-3 gap-y-0.5 text-[9.5px]">
            <span className="text-slate-500 font-medium">A/C Name:</span>
            <span className="col-span-2 font-bold text-slate-900">{accHolder}</span>

            <span className="text-slate-500 font-medium">Bank Name:</span>
            <span className="col-span-2 font-bold text-slate-900">{bankName}</span>

            <span className="text-slate-500 font-medium">A/C No:</span>
            <span className="col-span-2 font-mono font-black text-indigo-950 text-[10.5px]">{accNo}</span>

            <span className="text-slate-500 font-medium">IFSC Code:</span>
            <span className="col-span-2 font-mono font-bold text-slate-900">{ifsc}</span>

            <span className="text-slate-500 font-medium">Branch:</span>
            <span className="col-span-2 font-semibold text-slate-700">{branch}</span>
          </div>
          <div className="text-[8.5px] text-slate-500 mt-1.5 italic border-t border-slate-200 pt-1">
            Note: This order confirmation constitutes an acceptance of PO schedule subject to production allocation.
          </div>
        </div>

        {/* Terms & Signatory */}
        <div className="border border-slate-300 rounded p-2.5 flex flex-col justify-between text-right bg-slate-50/70">
          <div>
            <div className="font-bold text-indigo-950 uppercase">{supplierName}</div>
            <div className="text-[9px] text-slate-500">Authorized Commercial Representative</div>
          </div>

          <div className="mt-8 border-t border-slate-300 pt-1">
            <div className="text-[9px] font-bold text-slate-800">Authorized Signatory</div>
            <div className="text-[8px] text-slate-500">Generated by SMRITI Retail OS • Digital Verifiable Document</div>
          </div>
        </div>
      </div>

    </div>
  );
};
