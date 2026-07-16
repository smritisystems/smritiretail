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

export const ThermalReceipt80mm: React.FC<{ data: any }> = ({ data }) => {
  return (
    <div className="w-[80mm] bg-white text-black font-mono text-xs mx-auto p-[4mm]">
      <div className="text-center mb-4 border-b border-dashed border-black pb-4">
        <h1 className="text-lg font-bold uppercase">{data.storeName || "SMRITI RETAIL"}</h1>
        <p>{data.storeAddress || "Main Street, City"}</p>
        <p>GSTIN: {data.gstin || "29XXXXX0000X1Z5"}</p>
        <p>Tel: {data.phone || "1800-000-0000"}</p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between"><span>RCPT:</span><span>{data.receiptNo || "RCT-001"}</span></div>
        <div className="flex justify-between"><span>DATE:</span><span>{data.date || new Date().toLocaleString()}</span></div>
        <div className="flex justify-between"><span>CASHIER:</span><span>{data.cashier || "Admin"}</span></div>
      </div>

      <table className="w-full text-left mb-4 border-t border-b border-dashed border-black py-2 block">
        <thead className="block w-full border-b border-dashed border-black pb-1 mb-1">
          <tr className="flex w-full">
            <th className="w-1/2 font-normal">ITEM</th>
            <th className="w-1/6 font-normal text-right">QTY</th>
            <th className="w-1/3 font-normal text-right">AMT</th>
          </tr>
        </thead>
        <tbody className="block w-full">
          {(data.items || []).map((item: any, idx: number) => (
            <tr key={idx} className="flex w-full mb-1">
              <td className="w-1/2 truncate">{item.name}</td>
              <td className="w-1/6 text-right">{item.qty}</td>
              <td className="w-1/3 text-right">{(item.qty * item.rate).toFixed(2)}</td>
            </tr>
          ))}
          {(!data.items || data.items.length === 0) && (
            <tr className="flex w-full"><td className="w-full text-center py-2">No Items</td></tr>
          )}
        </tbody>
      </table>

      <div className="mb-4">
        <div className="flex justify-between font-bold"><span>TOTAL:</span><span>{data.total?.toFixed(2) || "0.00"}</span></div>
        <div className="flex justify-between"><span>PAID ({data.paymentMethod || "CASH"}):</span><span>{data.paid?.toFixed(2) || data.total?.toFixed(2) || "0.00"}</span></div>
      </div>

      <div className="text-center mt-6 border-t border-dashed border-black pt-4">
        <p>*** THANK YOU ***</p>
        <p>PLEASE VISIT AGAIN</p>
      </div>
      
      {/* Barcode area for thermal printers */}
      <div className="mt-4 flex justify-center">
        <div className="w-3/4 h-8 bg-black"></div>
      </div>
      <p className="text-center mt-1 text-[10px]">{data.receiptNo || "RCT-001"}</p>
    </div>
  );
};
