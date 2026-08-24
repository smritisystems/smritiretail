/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 4.10.0
 * Created      : 2026-08-24
 * Modified     : 2026-08-24
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";

export interface TaxInvoiceStatusBarProps {
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

export const TaxInvoiceStatusBar: React.FC<TaxInvoiceStatusBarProps> = ({
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
    <div className="bg-primary-container text-on-primary border border-outline-variant rounded flex font-label-caps text-[10px] sm:text-label-caps overflow-hidden">
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">No. of Items</span>
        <span className="font-code-md font-bold text-lg text-white">{itemCount}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Total Qty.</span>
        <span className="font-code-md font-bold text-lg text-white">{totalQty.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Sales Value</span>
        <span className="font-code-md font-bold text-lg text-white">{salesValue.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Item Lvl. Discount</span>
        <span className="font-code-md font-bold text-lg text-amber-300">{itemDiscount.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Bill Discount</span>
        <span className="font-code-md font-bold text-lg text-amber-300">{billDiscount.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Total Tax</span>
        <span className="font-code-md font-bold text-lg text-emerald-300">{totalTax.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Total Addons</span>
        <span className="font-code-md font-bold text-lg text-sky-300">{totalAddons.toFixed(2)}</span>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center p-2 border-r border-outline-variant/30">
        <span className="opacity-70">Total Deductions</span>
        <span className="font-code-md font-bold text-lg text-rose-300">{totalDeductions.toFixed(2)}</span>
      </div>
      <div className="flex-[1.5] bg-secondary-container text-on-secondary-container flex flex-col justify-center items-end p-2 px-4">
        <span className="opacity-80">Net Amount</span>
        <span className="font-code-md font-bold text-2xl">₹{netAmount.toFixed(2)}</span>
      </div>
    </div>
  );
};
