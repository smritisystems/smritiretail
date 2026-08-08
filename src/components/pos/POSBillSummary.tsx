import React from "react";

interface POSBillSummaryProps {
  grossAmount: number;
  discounts: number;
  gstAmount: number;
  tcsAmount: number;
  roundOff: number;
  grandTotal: number;
}

export const POSBillSummary: React.FC<POSBillSummaryProps> = ({
  grossAmount,
  discounts,
  gstAmount,
  tcsAmount,
  roundOff,
  grandTotal
}) => {
  return (
    <section className="pos-reference-card bg-theme-surface-2/95 border border-theme-divider/60">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-theme-muted font-semibold">Billing Totals</p>
          <h3 className="mt-2 text-base font-bold text-theme-heading">Invoice Total</h3>
        </div>
      </div>

      <div className="mt-5 space-y-3 text-sm text-theme-muted">
        <div className="flex justify-between">
          <span>Items</span>
          <span className="font-semibold text-theme-body">₹{grossAmount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount</span>
          <span className="font-semibold text-rose-400">-₹{discounts.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>GST</span>
          <span className="font-semibold text-blue-400">₹{gstAmount.toFixed(2)}</span>
        </div>
        <div className="border-t border-theme-divider pt-3 flex justify-between text-theme-muted">
          <span>Round Off</span>
          <span>{roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}</span>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-blue-600 text-white p-5 shadow-[0_25px_80px_-40px_rgba(59,130,246,0.9)]">
        <div className="flex justify-between items-center text-sm text-blue-100 uppercase tracking-[0.28em] font-semibold">Total Payable</div>
        <p className="mt-3 text-3xl font-bold leading-tight">₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
      </div>
    </section>
  );
};
