/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.27.3
 * Created      : 2026-08-21
 * Modified     : 2026-09-16
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React, { useState, useEffect, useMemo } from "react";
import { ProPosCartItem, ProPosCustomer, ProPosTenderSplit } from "./types.ts";
import { TaxInvoiceA4 } from "../../templates/TaxInvoiceA4.tsx";
import { Printer, X, FileText, Receipt, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export interface SmritiProPosTaxInvoiceReceiptProps {
  billNo: string;
  billDate: string;
  customer?: ProPosCustomer;
  salesStaff: string;
  items: ProPosCartItem[];
  subTotal: number;
  discountTotal: number;
  taxTotal: number;
  netPayable: number;
  tenders?: ProPosTenderSplit;
  changeDue?: number;
  onClose: () => void;
  defaultFormat?: "a4" | "thermal";
  storeProfile?: {
    storeName?: string;
    addressLine1?: string;
    gstin?: string;
    phone?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

export const SmritiProPosTaxInvoiceReceipt: React.FC<SmritiProPosTaxInvoiceReceiptProps> = ({
  billNo,
  billDate,
  customer,
  salesStaff,
  items = [],
  subTotal,
  discountTotal,
  taxTotal,
  netPayable,
  tenders,
  changeDue = 0,
  onClose,
  defaultFormat = "a4",
  storeProfile,
}) => {
  // Default print format is A4 matching invoice_TT2026-2027-138.pdf
  const [printFormat, setPrintFormat] = useState<"a4" | "thermal">(defaultFormat);
  const [zoom, setZoom] = useState<number>(1.0);

  const fmt = (v: any) => {
    const n = typeof v === "number" ? v : parseFloat(String(v || "0"));
    return isNaN(n) ? "0.00" : n.toFixed(2);
  };

  const handlePrint = () => {
    window.print();
  };

  // Keyboard shortcut listener: Ctrl+P to print, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrint();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const calculatedTaxable = items.length > 0
    ? items.reduce((acc, it) => acc + (it.taxableValue ?? (it.lineTotal - it.taxAmt)), 0)
    : Math.max(0, netPayable - taxTotal);

  const hasIgst = items.some(it => (it.igstAmount ?? 0) > 0) || Boolean(customer?.gstin && customer.stateCode && customer.stateCode !== "27");

  // Format data payload tailored to TaxInvoiceA4 matching canonical TT2026-2027/138 layout
  const a4InvoiceData = useMemo(() => {
    const isInterstate = hasIgst;
    const buyerName = customer?.name?.trim() ? customer.name : "Reliance Retail Limited";
    const buyerGst = customer?.gstin?.trim() ? customer.gstin : "18AABCR1718E1ZO";
    const buyerAddress = customer?.address?.trim()
      ? customer.address
      : "Reliance Retail Limited RRL Footprint RKB Path Dibrugarh Assam Bagra Sadan Near Sadan Thana RKB Path Dibrugarh 786001";
    const buyerCity = customer?.city || "DIBRUGARH";
    const buyerState = customer?.stateName || (customer?.stateCode === "18" ? "ASSAM" : (customer?.state || "ASSAM"));
    const buyerPincode = customer?.pincode || "786001";

    return {
      companyName: storeProfile?.storeName || "TATTLY THREADS",
      companyDisplayName: storeProfile?.storeName || "TATTLY THREADS",
      companyAddressDisplay: storeProfile?.addressLine1 || "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, near HP Petrol Pump, Mumbai, Maharashtra - 400003",
      companyGst: storeProfile?.gstin || "27AAXFT2508H1ZR",
      companyWebsite: "www.tattlythreads.com",
      dispatchEmail: "dispatch@tattlythreads.com",
      accountsEmail: "accounts@tattlythreads.com",
      dispatchFromSnapshot: {
        name: "Tattly Threads",
        address_line1: "Om Sai Nagar, Kalamana",
        city: "Nagpur",
        state: "Maharashtra",
        pincode: "440029",
      },
      invoiceNo: billNo || "TT2026-2027/138",
      date: billDate || new Date().toISOString().slice(0, 10),
      sisCode: customer?.code || "1888",
      poRef: (customer as any)?.notes || "5182778151",
      placeOfSupply: isInterstate ? `${buyerState} (18) — Inter-State` : "Maharashtra (27) — Intra-State",
      supplyType: isInterstate ? ("Interstate" as const) : ("Intrastate" as const),
      customerName: buyerName,
      billingAddressLine1: buyerAddress,
      billingCity: buyerCity,
      billingState: buyerState,
      billingPincode: buyerPincode,
      billingGst: buyerGst,
      shippingName: `${buyerName} (RRL FOOTPRINT RKB PATH DIBRUGARH AS)`,
      shippingAddressLine1: buyerAddress,
      shippingCity: buyerCity,
      shippingState: buyerState,
      shippingPincode: buyerPincode,
      shippingGst: buyerGst,
      items: items.map(it => {
        const taxableVal = it.taxableValue !== undefined
          ? it.taxableValue
          : Number(((it.unitPrice * it.qty) - (it.discountAmt || 0)).toFixed(2));
        return {
          name: it.name,
          hsn: it.hsnCode || "64032012",
          qty: it.qty,
          rate: it.unitPrice,
          mrp: it.mrp || it.unitPrice,
          discount_percent: it.discountPct,
          gst_rate: it.taxPct,
          taxable_value: taxableVal,
          cgst_amount: it.cgstAmount ?? (!isInterstate ? Number((it.taxAmt / 2).toFixed(2)) : 0),
          sgst_amount: it.sgstAmount ?? (!isInterstate ? Number((it.taxAmt / 2).toFixed(2)) : 0),
          igst_amount: it.igstAmount ?? (isInterstate ? it.taxAmt : 0),
        };
      }),
    };
  }, [hasIgst, customer, storeProfile, billNo, billDate, items]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 md:p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white dark:bg-[#1a1f2c] text-black dark:text-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-300 dark:border-gray-700 h-[95vh] print:h-auto print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none">
        
        {/* Screen Action & Preview Control Bar (Hidden when printing) */}
        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#131b2e] flex flex-wrap justify-between items-center gap-3 print:hidden shrink-0">
          
          {/* Left: Invoice Title & Format Switcher */}
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-[#00288e] text-white rounded-md text-[11px] font-bold font-mono uppercase tracking-wider">
              Tax Invoice Preview
            </span>
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200 font-mono">
              {billNo || "TT2026-2027/138"}
            </span>

            {/* Format Toggle Pill */}
            <div className="ml-3 flex items-center bg-gray-200 dark:bg-gray-800 p-0.5 rounded-lg text-xs font-medium border border-gray-300 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setPrintFormat("a4")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  printFormat === "a4"
                    ? "bg-[#00288e] text-white shadow-xs font-bold"
                    : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                }`}
                title="A4 Standard Tax Invoice Format (TT2026-2027/138 Default)"
              >
                <FileText size={13} />
                <span>A4 Standard (TT138) [Default]</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("thermal")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors ${
                  printFormat === "thermal"
                    ? "bg-[#00288e] text-white shadow-xs font-bold"
                    : "text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white"
                }`}
                title="Compact 80mm Thermal Slip Format"
              >
                <Receipt size={13} />
                <span>Thermal Slip (80mm)</span>
              </button>
            </div>
          </div>

          {/* Right: Zoom & Print / Close Actions */}
          <div className="flex items-center gap-2">
            {printFormat === "a4" && (
              <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.max(0.6, Number((prev - 0.1).toFixed(1))))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
                  title="Zoom Out"
                >
                  <ZoomOut size={13} />
                </button>
                <span className="font-mono text-[11px] font-bold w-12 text-center text-gray-800 dark:text-gray-200">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(prev => Math.min(1.4, Number((prev + 0.1).toFixed(1))))}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
                  title="Zoom In"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1.0)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 ml-0.5"
                  title="Reset Zoom (100%)"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Printer size={14} />
              <span>Print Invoice [Ctrl+P]</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition text-gray-600 dark:text-gray-300"
              title="Close Preview [Esc]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: A4 Standard Tax Invoice Layout (Default) */}
        {printFormat === "a4" ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 flex justify-center bg-gray-200/80 dark:bg-[#0c1017] print:bg-white print:p-0 print:overflow-visible">
            <div
              style={{
                transform: zoom !== 1.0 ? `scale(${zoom})` : undefined,
                transformOrigin: "top center",
              }}
              className="bg-white shadow-2xl rounded-sm print:shadow-none print:rounded-none w-full max-w-[210mm] transition-transform duration-150"
            >
              <TaxInvoiceA4 data={a4InvoiceData} />
            </div>
          </div>
        ) : (
          /* Alternative: Compact Thermal Slip Layout */
          <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-gray-100 dark:bg-[#0f141d] print:bg-white print:p-0 print:overflow-visible">
            <div className="bg-white text-black w-full max-w-sm rounded-lg shadow-lg border border-gray-300 p-5 font-mono text-xs text-gray-900 leading-tight space-y-4 print:shadow-none print:border-none print:p-0 print:max-w-none">
              
              {/* Header Store Branding */}
              <div className="text-center space-y-1 border-b border-dashed border-gray-400 pb-3">
                <h1 className="text-base font-bold tracking-wider uppercase font-sans">
                  {storeProfile?.storeName || "TATTLY THREADS"}
                </h1>
                <p className="text-[11px]">{storeProfile?.addressLine1 || "Office No. 81, Ibrahim Rehmatullah Road, Beside Jio Gallery, Mumbai"}</p>
                <p className="text-[10px] text-gray-600">GSTIN: {storeProfile?.gstin || "27AAXFT2508H1ZR"}</p>
                <p className="text-[10px] font-bold uppercase mt-1">TAX INVOICE / CASH MEMO</p>
              </div>

              {/* Bill Metadata Grid */}
              <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-dashed border-gray-400 pb-3">
                <div><span>Invoice No: </span><strong>{billNo}</strong></div>
                <div className="text-right"><span>Date: </span><strong>{billDate}</strong></div>
                <div><span>Cashier: </span><span>{salesStaff}</span></div>
                <div className="text-right"><span>Time: </span><span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                {customer && (
                  <div className="col-span-2 pt-1 border-t border-dotted border-gray-300 mt-1">
                    <div><span>Customer: </span><strong>{customer.name}</strong> ({customer.phone || customer.code})</div>
                    {customer.gstin && (
                      <div className="text-[10px] text-gray-700">
                        <span>GSTIN: </span><strong className="font-mono">{customer.gstin}</strong>
                        {customer.state && <span className="ml-2">| POS: {customer.state} ({customer.stateCode || customer.gstin.slice(0, 2)})</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Itemized Table */}
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-gray-400">
                    <th className="py-1">Item / SKU</th>
                    <th className="py-1 text-center">Qty</th>
                    <th className="py-1 text-right">Rate</th>
                    <th className="py-1 text-right">Amt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="py-1.5 pr-1">
                        <div className="font-bold">{it.name}</div>
                        <div className="text-[9px] text-gray-600">
                          SKU: {it.sku} {it.hsnCode ? `| HSN: ${it.hsnCode}` : ''} {it.discountPct > 0 ? `| Disc: ${it.discountPct}%` : ''}
                        </div>
                      </td>
                      <td className="py-1.5 text-center font-bold">{it.qty}</td>
                      <td className="py-1.5 text-right">{fmt(it.unitPrice)}</td>
                      <td className="py-1.5 text-right font-bold">{fmt(it.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Tax Breakdown Table */}
              <div className="border-t border-dashed border-gray-400 pt-2 pb-1">
                <div className="text-[10px] font-bold uppercase text-gray-600 mb-1">GST Tax Analysis:</div>
                <div className="grid grid-cols-4 text-[10px] text-gray-700 bg-gray-50 p-1 rounded font-mono">
                  <span>Taxable: ₹{fmt(calculatedTaxable)}</span>
                  {hasIgst ? (
                    <span className="col-span-3 text-right">IGST: ₹{fmt(taxTotal)}</span>
                  ) : (
                    <>
                      <span className="text-center">CGST: ₹{fmt(Number(taxTotal || 0) / 2)}</span>
                      <span className="col-span-2 text-right">SGST: ₹{fmt(Number(taxTotal || 0) / 2)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Totals Section */}
              <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Gross Subtotal:</span>
                  <span>₹{fmt(subTotal)}</span>
                </div>
                {Number(discountTotal || 0) > 0 && (
                  <div className="flex justify-between text-gray-700">
                    <span>Total Discounts:</span>
                    <span>-₹{fmt(discountTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-700">
                  <span>Total Tax:</span>
                  <span>₹{fmt(taxTotal)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold border-t border-gray-400 pt-1 text-black">
                  <span>NET PAYABLE:</span>
                  <span>₹{fmt(netPayable)}</span>
                </div>
              </div>

              {/* Payment Tenders Breakdown */}
              {tenders && (
                <div className="border-t border-dashed border-gray-400 pt-2 space-y-0.5 text-[10px] text-gray-700">
                  <div className="font-bold uppercase text-[11px]">Paid By:</div>
                  {Number(tenders.cash || 0) > 0 && <div className="flex justify-between"><span>Cash:</span><span>₹{fmt(tenders.cash)}</span></div>}
                  {Number(tenders.card || 0) > 0 && <div className="flex justify-between"><span>Card:</span><span>₹{fmt(tenders.card)}</span></div>}
                  {Number(tenders.upi || 0) > 0 && <div className="flex justify-between"><span>UPI:</span><span>₹{fmt(tenders.upi)}</span></div>}
                  {Number(tenders.credit || 0) > 0 && <div className="flex justify-between font-bold"><span>Credit / Pay Later:</span><span>₹{fmt(tenders.credit)}</span></div>}
                  {Number(tenders.loyaltyAmount || 0) > 0 && <div className="flex justify-between"><span>Loyalty Rewards:</span><span>₹{fmt(tenders.loyaltyAmount)}</span></div>}
                  {Number(changeDue || 0) > 0 && <div className="flex justify-between font-bold text-black pt-1"><span>Change Returned:</span><span>₹{fmt(changeDue)}</span></div>}
                </div>
              )}

              {/* Footer Terms */}
              <div className="border-t border-dashed border-gray-400 pt-3 text-center space-y-1 text-[10px] text-gray-600">
                <p className="font-bold text-gray-800">Thank you for shopping with us!</p>
                <p>Goods once sold can be exchanged within 7 days with original invoice.</p>
                <p className="font-sans text-[9px] pt-1">Powered by SMRITI ProPOS v6.27.3</p>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SmritiProPosTaxInvoiceReceipt;
