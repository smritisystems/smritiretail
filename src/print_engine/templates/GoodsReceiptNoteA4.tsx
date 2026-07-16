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

export const GoodsReceiptNoteA4: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="w-[210mm] min-h-[297mm] bg-white text-black p-[20mm] mx-auto box-border text-sm font-sans">
      <div className="text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-3xl font-bold font-display uppercase tracking-wider">{data.companyName || "SMRITI Enterprise"}</h1>
        <h2 className="text-xl font-bold text-gray-700 mt-2">GOODS RECEIPT NOTE (GRN)</h2>
      </div>

      <div className="flex justify-between mb-8 text-sm">
        <div className="w-1/2 pr-4 space-y-1">
          <p><span className="font-bold">Supplier:</span> {data.supplierName || "Global Traders Ltd."}</p>
          <p><span className="font-bold">PO Number:</span> {data.poNumber || "PO-2023-441"}</p>
          <p><span className="font-bold">Supplier Invoice:</span> {data.supplierInvoice || "INV-99011"}</p>
        </div>
        <div className="w-1/2 pl-4 space-y-1 text-right">
          <p><span className="font-bold">GRN Number:</span> {data.grnNo || "GRN-00102"}</p>
          <p><span className="font-bold">Date:</span> {data.date || new Date().toLocaleDateString()}</p>
          <p><span className="font-bold">Received By:</span> {data.receivedBy || "Warehouse Staff"}</p>
        </div>
      </div>

      <table className="w-full text-left border-collapse mb-8">
        <thead>
          <tr className="bg-gray-100 text-gray-800 uppercase text-xs">
            <th className="p-2 border border-gray-300">#</th>
            <th className="p-2 border border-gray-300">Item Description</th>
            <th className="p-2 border border-gray-300 text-right">Ordered</th>
            <th className="p-2 border border-gray-300 text-right">Received</th>
            <th className="p-2 border border-gray-300 text-right">Accepted</th>
            <th className="p-2 border border-gray-300 text-right">Rejected</th>
          </tr>
        </thead>
        <tbody>
          {(data.items || []).map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-gray-200">
              <td className="p-2 border border-gray-300">{idx + 1}</td>
              <td className="p-2 border border-gray-300 font-medium">{item.name}</td>
              <td className="p-2 border border-gray-300 text-right">{item.qty}</td>
              <td className="p-2 border border-gray-300 text-right">{item.qty}</td>
              <td className="p-2 border border-gray-300 text-right">{item.qty}</td>
              <td className="p-2 border border-gray-300 text-right">0</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-16 flex justify-between text-center pt-16">
        <div className="w-1/3 border-t border-black pt-2 font-bold">Store Keeper</div>
        <div className="w-1/3 border-t border-black pt-2 font-bold">Quality Inspector</div>
        <div className="w-1/3 border-t border-black pt-2 font-bold">Authorised Signatory</div>
      </div>
    </div>
  );
};
