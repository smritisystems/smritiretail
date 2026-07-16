/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Founders
 *
 * * Pushpa Devi Jawahar Mallah
 *   * Founder & Chairperson
 *   * Phone: +91 9324117007
 *   * Email: founder@aitdl.com
 *
 * * Jawahar Ramkripal Mallah
 *   * Founder, Chief Executive Officer (CEO) & Chief Software Architect
 *   * Email: founder@aitdl.com
 *
 * * Websites: aitdl.com | erpnbook.com | smritibooks.com
 *
 * * Version    : 2.1.1
 * * Created    : 2026-07-10
 * * Modified   : 2026-07-11
 * * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * * License    : Proprietary Commercial Software
 */

import React from "react";

export const StandardInvoiceA4: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-black p-[20mm] mx-auto box-border text-sm font-sans">
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-wider">{data.companyName || "SMRITI Enterprise"}</h1>
          <p className="text-gray-600 mt-1">{data.companyAddress || "123 Business Road, Tech Park"}</p>
          <p className="text-gray-600">GSTIN: {data.companyGst || "29XXXXX0000X1Z5"}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-gray-500 uppercase">Tax Invoice</h2>
          <p className="font-bold mt-2">INV: {data.invoiceNo || "INV-0000"}</p>
          <p>Date: {data.date || new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex justify-between mb-8">
        <div className="w-1/2 pr-4">
          <h3 className="font-bold text-gray-700 uppercase text-xs mb-2 border-b pb-1">Billed To</h3>
          <p className="font-bold">{data.customerName || "Walk-in Customer"}</p>
          <p className="text-gray-600">{data.customerAddress || ""}</p>
          {data.customerGst && <p className="text-gray-600">GSTIN: {data.customerGst}</p>}
        </div>
        <div className="w-1/2 pl-4">
          <h3 className="font-bold text-gray-700 uppercase text-xs mb-2 border-b pb-1">Shipped To</h3>
          <p className="font-bold">{data.shippingName || data.customerName || "Walk-in Customer"}</p>
          <p className="text-gray-600">{data.shippingAddress || data.customerAddress || ""}</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100 text-gray-800 uppercase text-xs">
            <th className="p-2 border border-gray-300">#</th>
            <th className="p-2 border border-gray-300">Item Description</th>
            <th className="p-2 border border-gray-300">HSN/SAC</th>
            <th className="p-2 border border-gray-300 text-right">Qty</th>
            <th className="p-2 border border-gray-300 text-right">Rate</th>
            <th className="p-2 border border-gray-300 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {(data.items || []).map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-gray-200">
              <td className="p-2 border border-gray-300">{idx + 1}</td>
              <td className="p-2 border border-gray-300 font-medium">{item.name}</td>
              <td className="p-2 border border-gray-300">{item.hsn || "-"}</td>
              <td className="p-2 border border-gray-300 text-right">{item.qty}</td>
              <td className="p-2 border border-gray-300 text-right">{item.rate?.toFixed(2)}</td>
              <td className="p-2 border border-gray-300 text-right">{(item.qty * item.rate).toFixed(2)}</td>
            </tr>
          ))}
          {(!data.items || data.items.length === 0) && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-400 italic border border-gray-300">No items available</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="flex justify-end mb-8">
        <div className="w-1/3">
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-bold">{data.subtotal?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-gray-600">Tax (GST):</span>
            <span className="font-bold">{data.tax?.toFixed(2) || "0.00"}</span>
          </div>
          <div className="flex justify-between py-2 border-t-2 border-gray-800 mt-2">
            <span className="font-bold uppercase">Total:</span>
            <span className="font-bold text-lg">{data.total?.toFixed(2) || "0.00"}</span>
          </div>
        </div>
      </div>

      <div className="mt-16 text-center text-xs text-gray-500 border-t pt-4">
        <p>Thank you for your business!</p>
        <p>This is a computer-generated document and does not require a signature.</p>
      </div>
    </div>
  );
};
