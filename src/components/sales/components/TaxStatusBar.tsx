/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.12.0
 * Created      : 2026-08-24
 * Modified     : 2026-09-07
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

export interface TaxStatusBarrProps {
  itemCount: number;
  totalQty: number;
  salesValue: number;
  itemDiscount: number;
  billDiscount: number;
  totalTax: number;
  totalAddons: number;
  totalDeductions: number;
  netAmount: number;
}

export const TaxStatusBar: React.FC<TaxStatusBarrProps> = ({
  itemCount,
  totalQty,
  salesValue,
  itemDiscount,
  billDiscount,
  totalTax,
  totalAddons,
  totalDeductions,
  netAmount,
}) => {
  return (
    <section className="bg-[#0c243f] text-white flex-none border-t border-[#133458] shadow-inner select-none" data-purpose="totals-summary-bar">
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-9 divide-x divide-[#18416d] text-center">
        {/* Metric 1: No. of Items */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">No. of Items</span>
          <span className="text-base font-bold font-mono text-white mt-0.5 block">{itemCount}</span>
        </div>

        {/* Metric 2: Total Qty */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Total Qty.</span>
          <span className="text-base font-bold font-mono text-white mt-0.5 block">{totalQty.toFixed(2)}</span>
        </div>

        {/* Metric 3: Sales Value */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Sales Value</span>
          <span className="text-base font-bold font-mono text-white mt-0.5 block">₹{salesValue.toFixed(2)}</span>
        </div>

        {/* Metric 4: Item Disc */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Item Disc</span>
          <span className="text-base font-bold font-mono text-amber-300 mt-0.5 block">₹{itemDiscount.toFixed(2)}</span>
        </div>

        {/* Metric 5: Bill Discount */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Bill Discount</span>
          <span className="text-base font-bold font-mono text-amber-300 mt-0.5 block">₹{billDiscount.toFixed(2)}</span>
        </div>

        {/* Metric 6: Total Tax */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Total Tax</span>
          <span className="text-base font-bold font-mono text-emerald-300 mt-0.5 block">₹{totalTax.toFixed(2)}</span>
        </div>

        {/* Metric 7: Addons */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Addons</span>
          <span className="text-base font-bold font-mono text-sky-300 mt-0.5 block">₹{totalAddons.toFixed(2)}</span>
        </div>

        {/* Metric 8: Deductions */}
        <div className="py-2.5 px-2 flex flex-col justify-center">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-300 block">Deductions</span>
          <span className="text-base font-bold font-mono text-rose-300 mt-0.5 block">₹{totalDeductions.toFixed(2)}</span>
        </div>

        {/* Metric 9: Prominent NET AMOUNT Column (Dominant Blue Fill) */}
        <div className="bg-[#0066cc] py-2.5 px-4 flex flex-col justify-center items-center col-span-2 sm:col-span-4 md:col-span-1">
          <span className="text-[11px] uppercase font-extrabold tracking-widest text-cyan-100 leading-tight">Net Amount</span>
          <span className="text-2xl font-black font-mono text-white tracking-tight leading-none mt-1">₹{netAmount.toFixed(2)}</span>
        </div>
      </div>
    </section>
  );
};
