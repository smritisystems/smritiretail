import React from "react";

interface POSTaxSummaryProps {
  isInterstate: boolean;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  tcsAmount: number;
}

export const POSTaxSummary: React.FC<POSTaxSummaryProps> = ({
  isInterstate,
  cgstTotal,
  sgstTotal,
  igstTotal,
  tcsAmount
}) => {
  return (
    <section className="pos-reference-card bg-theme-surface-2/95 border border-theme-divider/60">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-theme-muted font-semibold">Tax Summary</p>
          <h3 className="mt-2 text-base font-bold text-theme-heading">GST & Compliance</h3>
        </div>
      </div>
      <div className="mt-5 space-y-3 text-sm text-theme-muted">
        {!isInterstate ? (
          <>
            <div className="flex justify-between">
              <span className="font-semibold text-theme-body">CGST</span>
              <span>₹{cgstTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-theme-body">SGST</span>
              <span>₹{sgstTotal.toFixed(2)}</span>
            </div>
          </>
        ) : (
          <div className="flex justify-between">
            <span className="font-semibold text-theme-body">IGST</span>
            <span>₹{igstTotal.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-theme-divider pt-3 text-theme-muted">
          <span>TCS</span>
          <span>₹{tcsAmount.toFixed(2)}</span>
        </div>
        <div className="rounded-3xl bg-theme-surface-1/90 p-4 text-sm text-theme-body border border-theme-divider">
          <p className="text-[11px] uppercase tracking-[0.24em] text-theme-muted font-semibold">Compliance status</p>
          <p className="mt-2">Invoice summary is aligned to the current GST state: <strong>{isInterstate ? "Interstate" : "Intrastate"}</strong>.</p>
        </div>
      </div>
    </section>
  );
};
