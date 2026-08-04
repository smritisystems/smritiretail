import React from "react";
import { AdvancedCustomer } from "../AdvancedBillingEngine";

interface POSCustomerCardProps {
  customer: AdvancedCustomer;
  matchedCustomerName: string | null;
  onEdit: () => void;
}

export const POSCustomerCard: React.FC<POSCustomerCardProps> = ({ customer, matchedCustomerName, onEdit }) => {
  return (
    <section className="pos-reference-card bg-theme-surface-2/95 border border-theme-divider/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-theme-muted font-semibold">Customer</p>
          <h3 className="mt-2 text-base font-bold text-theme-heading">{customer.name}</h3>
          <p className="text-sm text-theme-muted leading-relaxed">{customer.type === "Registered" ? "Registered GST Customer" : "Walk-in Retail Customer"}</p>
        </div>
        <button
          onClick={onEdit}
          className="rounded-full bg-theme-surface-1 border border-theme-divider px-3 py-2 text-xs font-semibold text-theme-body hover:bg-theme-surface-3 transition"
        >
          Edit
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-theme-muted">
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Mobile</span>
          <span>{customer.mobile || "Not set"}</span>
        </div>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">GSTIN</span>
          <span>{customer.gstin || "N/A"}</span>
        </div>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Company</span>
          <span>{customer.companyName || "N/A"}</span>
        </div>
        <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Matched</span>
          <span>{matchedCustomerName || "No match"}</span>
        </div>
      </div>
    </section>
  );
};
