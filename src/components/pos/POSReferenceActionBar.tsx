import React from "react";

interface POSReferenceActionBarProps {
  onMenu: () => void;
  onHold: () => void;
  onSave: () => void;
  onPreview: () => void;
  onPay: () => void;
}

export const POSReferenceActionBar: React.FC<POSReferenceActionBarProps> = ({
  onMenu,
  onHold,
  onSave,
  onPreview,
  onPay
}) => {
  return (
    <div className="fixed left-1/2 bottom-5 z-50 -translate-x-1/2">
      <div className="flex flex-wrap items-center gap-3 rounded-full bg-theme-surface-2/95 border border-theme-divider shadow-[0_22px_60px_-34px_rgba(15,23,42,0.75)] backdrop-blur-xl px-3 py-2">
        <button
          type="button"
          onClick={onMenu}
          className="inline-flex h-11 min-w-[44px] items-center justify-center rounded-full bg-theme-surface-1 text-theme-muted transition hover:bg-theme-surface-3"
          aria-label="Open menu"
        >
          <span className="text-lg">☰</span>
        </button>
        <button
          type="button"
          onClick={onHold}
          className="inline-flex h-11 rounded-full bg-theme-surface-1 px-4 text-sm font-semibold text-theme-body transition hover:bg-theme-surface-3"
        >Hold</button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-11 rounded-full bg-theme-surface-1 px-4 text-sm font-semibold text-theme-body transition hover:bg-theme-surface-3"
        >Save</button>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex h-11 rounded-full bg-theme-surface-1 px-4 text-sm font-semibold text-theme-body transition hover:bg-theme-surface-3"
        >Preview</button>
        <button
          type="button"
          onClick={onPay}
          className="inline-flex h-11 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-10px_rgba(59,130,246,0.8)] transition hover:bg-blue-500"
        >Pay</button>
      </div>
    </div>
  );
};
