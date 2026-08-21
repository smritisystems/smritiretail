/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 6.0.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { ProPosCartItem, ProPosCustomer, ProPosTenderSplit } from "./types.ts";
import { Printer, X, CheckCircle, QrCode } from "lucide-react";

interface SmritiProPosTaxInvoiceReceiptProps {
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
  onClose
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 print:p-0 print:bg-white print:static">
      <div className="bg-white text-black w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-gray-300 max-h-[92vh] print:max-h-none print:shadow-none print:border-none">
        
        {/* Screen Action Bar (Hidden when printing) */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center print:hidden">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-[#00288e] text-white rounded text-[10px] font-bold font-mono uppercase">
              Tax Invoice
            </span>
            <span className="text-xs font-bold text-gray-800">{billNo}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#00288e] hover:bg-[#1e40af] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Printer size={14} />
              Print Receipt [Ctrl+P]
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-gray-200 rounded-lg transition text-gray-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Slip Container */}
        <div className="p-6 overflow-y-auto font-mono text-xs text-gray-900 leading-tight space-y-4 print:p-0 print:overflow-visible">
          
          {/* Header Store Branding */}
          <div className="text-center space-y-1 border-b border-dashed border-gray-400 pb-3">
            <h1 className="text-base font-bold tracking-wider uppercase font-sans">SMRITI RETAIL STORE</h1>
            <p className="text-[11px]">Flagship Outlet #102, MG Road</p>
            <p className="text-[10px] text-gray-600">GSTIN: 27AABCU9603R1ZM | Phone: +91 98765 43210</p>
            <p className="text-[10px] font-bold uppercase mt-1">TAX INVOICE / CASH MEMO</p>
          </div>

          {/* Bill Metadata Grid */}
          <div className="grid grid-cols-2 gap-1 text-[11px] border-b border-dashed border-gray-400 pb-3">
            <div>
              <span>Invoice No: </span>
              <strong>{billNo}</strong>
            </div>
            <div className="text-right">
              <span>Date: </span>
              <strong>{billDate}</strong>
            </div>
            <div>
              <span>Cashier: </span>
              <span>{salesStaff}</span>
            </div>
            <div className="text-right">
              <span>Time: </span>
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {customer && (
              <div className="col-span-2 pt-1">
                <span>Customer: </span>
                <strong>{customer.name}</strong> ({customer.phone || customer.code})
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
                    <div className="text-[9px] text-gray-600">SKU: {it.sku} {it.size ? `| Size: ${it.size}` : ''}</div>
                  </td>
                  <td className="py-1.5 text-center font-bold">{it.qty}</td>
                  <td className="py-1.5 text-right">{it.unitPrice.toFixed(2)}</td>
                  <td className="py-1.5 text-right font-bold">{it.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Section */}
          <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Gross Subtotal:</span>
              <span>₹{subTotal.toFixed(2)}</span>
            </div>
            {discountTotal > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Total Discounts:</span>
                <span>-₹{discountTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-700">
              <span>GST / Taxes:</span>
              <span>₹{taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-400 pt-1 text-black">
              <span>NET PAYABLE:</span>
              <span>₹{netPayable.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Tenders Breakdown */}
          {tenders && (
            <div className="border-t border-dashed border-gray-400 pt-2 space-y-0.5 text-[10px] text-gray-700">
              <div className="font-bold uppercase text-[11px]">Paid By:</div>
              {tenders.cash > 0 && <div className="flex justify-between"><span>Cash:</span><span>₹{tenders.cash.toFixed(2)}</span></div>}
              {tenders.card > 0 && <div className="flex justify-between"><span>Card:</span><span>₹{tenders.card.toFixed(2)}</span></div>}
              {tenders.upi > 0 && <div className="flex justify-between"><span>UPI:</span><span>₹{tenders.upi.toFixed(2)}</span></div>}
              {tenders.loyaltyAmount > 0 && <div className="flex justify-between"><span>Loyalty Rewards:</span><span>₹{tenders.loyaltyAmount.toFixed(2)}</span></div>}
              {changeDue > 0 && <div className="flex justify-between font-bold text-black pt-1"><span>Change Returned:</span><span>₹{changeDue.toFixed(2)}</span></div>}
            </div>
          )}

          {/* Footer Terms & Barcode */}
          <div className="border-t border-dashed border-gray-400 pt-3 text-center space-y-1 text-[10px] text-gray-600">
            <p className="font-bold text-gray-800">Thank you for shopping with us!</p>
            <p>Goods once sold can be exchanged within 7 days with original invoice.</p>
            <p className="font-sans text-[9px] pt-1">Powered by SMRITI ProPOS v6.0.0</p>
          </div>

        </div>

      </div>
    </div>
  );
};

export default SmritiProPosTaxInvoiceReceipt;
