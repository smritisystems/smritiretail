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

export interface TaxInvoiceNetValuesPanelProps {
  salesValue: number;
  discountValue: number;
  taxValue: number;
  addonsValue: number;
  deductionsValue: number;
  netAmount: number;
}

export const TaxInvoiceNetValuesPanel: React.FC<TaxInvoiceNetValuesPanelProps> = ({
  salesValue,
  discountValue,
  taxValue,
  addonsValue,
  deductionsValue,
}) => {
  return (
    <div className="w-80 bg-surface-container-lowest border border-outline-variant rounded flex flex-col p-2">
      <table className="w-full text-left font-body-sm">
        <thead className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant">
          <tr>
            <th className="pb-1 w-24">Description</th>
            <th className="pb-1 text-right">Net Values</th>
          </tr>
        </thead>
        <tbody className="font-code-md text-code-md">
          <tr>
            <td className="py-1 text-on-surface-variant">Sales</td>
            <td className="py-1">
              <input
                className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded-sm px-1 text-on-surface font-code-md cursor-not-allowed"
                readOnly
                type="text"
                value={salesValue > 0 ? salesValue.toFixed(2) : "0.00"}
              />
            </td>
          </tr>
          <tr>
            <td className="py-1 text-on-surface-variant">Discounts</td>
            <td className="py-1">
              <input
                className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded-sm px-1 text-on-surface font-code-md cursor-not-allowed text-amber-700"
                readOnly
                type="text"
                value={discountValue > 0 ? discountValue.toFixed(2) : "0.00"}
              />
            </td>
          </tr>
          <tr>
            <td className="py-1 text-on-surface-variant">Sales Tax</td>
            <td className="py-1">
              <input
                className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded-sm px-1 text-on-surface font-code-md cursor-not-allowed"
                readOnly
                type="text"
                value={taxValue > 0 ? taxValue.toFixed(2) : "0.00"}
              />
            </td>
          </tr>
          <tr>
            <td className="py-1 text-on-surface-variant">Add-ons</td>
            <td className="py-1">
              <input
                className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded-sm px-1 text-on-surface font-code-md cursor-not-allowed"
                readOnly
                type="text"
                value={addonsValue > 0 ? addonsValue.toFixed(2) : "0.00"}
              />
            </td>
          </tr>
          <tr>
            <td className="py-1 text-on-surface-variant">Deductions</td>
            <td className="py-1">
              <input
                className="w-full h-6 text-right bg-surface-variant border border-outline-variant rounded-sm px-1 text-on-surface font-code-md cursor-not-allowed text-rose-600"
                readOnly
                type="text"
                value={deductionsValue > 0 ? deductionsValue.toFixed(2) : "0.00"}
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
