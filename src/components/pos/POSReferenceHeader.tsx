import React from "react";

interface POSReferenceHeaderProps {
  billType: string;
  paymentModeLabel: string;
  activeProfileName: string;
  activeShiftId: string | undefined;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onClose: () => void;
}

export const POSReferenceHeader: React.FC<POSReferenceHeaderProps> = ({
  billType,
  paymentModeLabel,
  activeProfileName,
  activeShiftId,
  searchValue,
  onSearchChange,
  onSearchSubmit,
  onClose
}) => {
  return (
    <header className="w-full bg-theme-surface-1/90 backdrop-blur-xl border-b border-theme-divider shadow-[0_18px_45px_-30px_rgba(2,8,20,0.8)]" style={{ height: 64 }}>
      <div className="max-w-[1640px] mx-auto h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-theme-surface-2 border border-theme-divider flex items-center justify-center text-theme-heading shadow-sm">
            <span className="material-symbols-outlined text-xl">point_of_sale</span>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-theme-muted font-semibold">SMRITI Reference</p>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-theme-body">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-theme-surface-2 text-theme-muted border border-theme-divider">{billType}</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-theme-surface-2 text-theme-muted border border-theme-divider">{paymentModeLabel}</span>
            </div>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSearchSubmit();
          }}
          className="flex-1 min-w-[320px] max-w-2xl"
        >
          <label className="sr-only">Search SKU or item</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-theme-muted">search</span>
            <input
              type="text"
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search SKU, item name, price or barcode..."
              className="w-full rounded-full border border-theme-divider bg-theme-surface-2/80 py-3 pl-12 pr-4 text-sm text-theme-body placeholder:text-theme-muted focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </form>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex flex-col text-right text-xs text-theme-muted">
            <span>{activeProfileName}</span>
            <span>Shift {activeShiftId || "–"}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-theme-surface-2 border border-theme-divider text-theme-body hover:bg-theme-surface-3 transition-colors"
            aria-label="Close POS reference screen"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
    </header>
  );
};
