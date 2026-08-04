import React from "react";

interface POSBillingCardProps {
  paymentMode: string;
  primaryPaymentMethod: string;
  loyaltyPoints: number;
  billDiscount: number;
}

export const POSBillingCard: React.FC<POSBillingCardProps> = ({ paymentMode, primaryPaymentMethod, loyaltyPoints, billDiscount }) => {
  return (
    <section className="pos-reference-card bg-theme-surface-2/95 border border-theme-divider/60">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-theme-muted font-semibold">Billing</p>
          <h3 className="mt-2 text-base font-bold text-theme-heading">Payment Summary</h3>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-theme-muted">
        <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Mode</span>
          <span>{paymentMode}</span>
        </div>
        <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Primary Tender</span>
          <span>{primaryPaymentMethod}</span>
        </div>
        <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Loyalty</span>
          <span>{loyaltyPoints} pts</span>
        </div>
        <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2">
          <span className="font-semibold text-theme-body">Bill Discount</span>
          <span>₹{billDiscount.toFixed(2)}</span>
        </div>
      </div>
    </section>
  );
};
