/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritisys.com | smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.16.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-13
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Customer } from "../../types.ts";

interface CustomerLedgerProps {
  customer: Customer;
}

export const CustomerLedger: React.FC<CustomerLedgerProps> = ({ customer }) => {
  // Simulated historic customer sales ledger items
  const ledgerItems = [
    { date: "2026-07-01", desc: "Opening Balance Credit", amount: 0, balance: 0 },
    { date: "2026-07-05", desc: "Wholesale Order INV-1002", amount: 25000, balance: 25000 },
    { date: "2026-07-10", desc: "Payment Received bank settlement", amount: -15000, balance: 10000 },
  ];

  return (
    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg space-y-4">
      <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
        Customer Transaction Ledger
      </h3>

      <div className="overflow-x-auto text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-theme-divider/50 text-[10px] uppercase text-theme-muted font-mono">
              <th className="py-2">Date</th>
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Debit / Credit</th>
              <th className="py-2 text-right">Cumulative Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-divider/30">
            {ledgerItems.map((item, idx) => (
              <tr key={idx} className="hover:bg-theme-surface-hover/30">
                <td className="py-2 font-mono text-theme-muted">{item.date}</td>
                <td className="py-2 text-theme-body">{item.desc}</td>
                <td className={`py-2 text-right font-mono ${item.amount >= 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {item.amount >= 0 ? "+" : ""}₹{item.amount.toLocaleString("en-IN")}
                </td>
                <td className="py-2 text-right font-mono text-theme-body font-bold">
                  ₹{item.balance.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
