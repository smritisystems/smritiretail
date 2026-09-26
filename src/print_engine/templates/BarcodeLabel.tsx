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

export const BarcodeLabel: React.FC<{ data?: any }> = ({ data = {} }) => {
  const item = data.items?.[0] || {};
  const rawRate = item.rate ?? item.price ?? item.mrp ?? 99.99;
  const formattedRate = typeof rawRate === "number" ? rawRate.toFixed(2) : Number(rawRate || 0).toFixed(2);
  const currencySymbol = data.currencySymbol || "₹";

  return (
    <div className="w-[50mm] h-[25mm] bg-white text-black p-[2mm] mx-auto box-border flex flex-col justify-between overflow-hidden">
      <div className="flex justify-between items-start">
        <span className="text-[8px] font-bold truncate max-w-[30mm]">{data.companyName || "SMRITI"}</span>
        <span className="text-[10px] font-bold">{currencySymbol}{formattedRate}</span>
      </div>
      <div className="text-[9px] truncate w-full">{item.name || item.productName || "Product Name"}</div>
      <div className="flex flex-col items-center mt-1">
        <div className="w-full h-[8mm] bg-black"></div>
        <span className="text-[8px] font-mono mt-0.5">{item.barcode || "123456789012"}</span>
      </div>
    </div>
  );
};
