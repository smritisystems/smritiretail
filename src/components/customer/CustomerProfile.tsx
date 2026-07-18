/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.26.0
 * Created      : 2026-07-13
 * Modified     : 2026-07-18
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { Customer } from "../../types.ts";

interface CustomerProfileProps {
  customer: Customer;
  isReadOnly: boolean;
  onClose: () => void;
}

export const CustomerProfile: React.FC<CustomerProfileProps> = ({
  customer,
  isReadOnly,
  onClose
}) => {
  return (
    <div className="bg-theme-surface-2 border border-theme-divider rounded-xl p-5 shadow-lg relative space-y-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-theme-muted hover:text-theme-body"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>

      <h3 className="text-xs font-bold text-theme-muted uppercase tracking-wider font-mono">
        Customer Details View
      </h3>

      <div className="space-y-3 text-xs max-h-[75vh] overflow-y-auto pr-1">
        <div>
          <span className="text-theme-muted block font-medium">Customer ID</span>
          <span className="font-mono font-bold text-blue-400">{customer.id}</span>
        </div>
        {customer.code && (
          <div>
            <span className="text-theme-muted block font-medium">Customer Code</span>
            <span className="font-mono font-bold text-blue-400">{customer.code}</span>
          </div>
        )}
        <div>
          <span className="text-theme-muted block font-medium">Full Name</span>
          <span className="font-bold text-theme-body">{customer.name}</span>
        </div>
        {customer.shortName && (
          <div>
            <span className="text-theme-muted block font-medium">Short Name</span>
            <span className="text-theme-body">{customer.shortName}</span>
          </div>
        )}
        <div>
          <span className="text-theme-muted block font-medium">Contact Number</span>
          <span className="font-mono">{customer.mobile || "Not Registered"}</span>
        </div>
        <div>
          <span className="text-theme-muted block font-medium">Email Address</span>
          <span>{customer.email || "Not Registered"}</span>
        </div>
        <div>
          <span className="text-theme-muted block font-medium">GSTIN Registration</span>
          <span className="font-mono">{customer.gstNumber || "Not Registered"}</span>
        </div>
        <div>
          <span className="text-theme-muted block font-medium">PAN</span>
          <span className="font-mono">{customer.pan || "Not Registered"}</span>
        </div>
        {/* Pricing classification */}
        <div className="border-t border-theme-divider/30 pt-2 grid grid-cols-2 gap-3">
          <div>
            <span className="text-theme-muted block font-medium">Customer Group</span>
            <span className="font-mono text-theme-body">
              {(customer as any).customerGroupId || (customer as any).customer_group_id || "—"}
            </span>
          </div>
          <div>
            <span className="text-theme-muted block font-medium">Pricing Group</span>
            {(customer as any).pricingGroupId || (customer as any).pricing_group_id ? (
              <span className="inline-flex items-center gap-1 font-mono text-blue-300 bg-blue-950/40 border border-blue-500/30 rounded px-1.5 py-0.5 text-[10px]">
                <span className="material-symbols-outlined text-[11px]">sell</span>
                {(customer as any).pricingGroupId || (customer as any).pricing_group_id}
              </span>
            ) : (
              <span className="text-theme-muted text-[10px] font-mono">Standard Price</span>
            )}
          </div>
        </div>
        {customer.salesperson && (
          <div>
            <span className="text-theme-muted block font-medium">Salesperson</span>
            <span className="text-theme-body">{customer.salesperson}</span>
          </div>
        )}
        <div>
          <span className="text-theme-muted block font-medium">Outstanding Balances</span>
          <span className="font-mono text-emerald-400 font-bold">
            ₹{customer.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-theme-muted block font-medium font-mono uppercase text-[9px] mb-1">Status</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
            customer.status === "Active" ? "bg-emerald-950 text-emerald-400 border border-emerald-500/30" :
            customer.status === "Inactive" ? "bg-slate-700 text-slate-300" :
            "bg-rose-950 text-rose-400 border border-rose-500/30 font-bold"
          }`}>
            {customer.status}
          </span>
        </div>
        {(customer.effectiveFrom || customer.effectiveTo) && (
          <div className="grid grid-cols-2 gap-2 border-t border-theme-divider/30 pt-2">
            {customer.effectiveFrom && (
              <div>
                <span className="text-theme-muted block font-medium">Effective From</span>
                <span className="font-mono">{customer.effectiveFrom}</span>
              </div>
            )}
            {customer.effectiveTo && (
              <div>
                <span className="text-theme-muted block font-medium">Effective To</span>
                <span className="font-mono">{customer.effectiveTo}</span>
              </div>
            )}
          </div>
        )}
        {customer.sortOrder !== undefined && (
          <div>
            <span className="text-theme-muted block font-medium">Sort Order</span>
            <span className="font-mono">{customer.sortOrder}</span>
          </div>
        )}
        {customer.tags && customer.tags.length > 0 && (
          <div>
            <span className="text-theme-muted block font-medium mb-1">Tags</span>
            <div className="flex flex-wrap gap-1">
              {customer.tags.map((t, idx) => (
                <span key={idx} className="bg-theme-surface-3 border border-theme-divider text-[10px] px-1.5 py-0.5 rounded text-theme-muted font-mono">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
        {customer.notes && (
          <div className="border-t border-theme-divider/30 pt-2">
            <span className="text-theme-muted block font-medium">Internal Notes</span>
            <p className="text-theme-body leading-relaxed bg-theme-surface-3 p-2 rounded border border-theme-divider/50 break-words whitespace-pre-wrap">
              {customer.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
