/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 5.1.0 (SEEF Phase 8 — Token Upgrade)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React from "react";

export type SelectionOptionMode = 
  | "manual" 
  | "item_master"
  | "purchase_pt" 
  | "grn"
  | "purchase_return"
  | "sales"
  | "sales_return"
  | "stock_transfer"
  | "production"
  | "physical_stock"
  | "batch"
  | "serial_number"
  | "direct_scan";

export interface SourceSelectionPanelProps {
  optionMode: SelectionOptionMode;
  onOptionModeChange: (mode: SelectionOptionMode) => void;
  ptFileName: string;
  onPtFileNameChange: (val: string) => void;
}

export const SourceSelectionPanel: React.FC<SourceSelectionPanelProps> = ({
  optionMode,
  onOptionModeChange,
  ptFileName,
  onPtFileNameChange
}) => {
  return (
    <div className="bg-theme-surface-1 border border-theme-divider rounded-2xl p-4 space-y-3 shadow-xl font-mono text-xs select-none">
      <span className="text-xs font-bold text-theme-heading uppercase block border-b border-theme-divider pb-2">
        Source Data Selection Criteria
      </span>

      <div className="grid grid-cols-1 gap-1 max-h-56 overflow-y-auto pr-1">
        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "manual"} onChange={() => onOptionModeChange("manual")} className="accent-amber-500" />
          <span className="font-bold text-amber-300">○ Manual Selection</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "item_master"} onChange={() => onOptionModeChange("item_master")} className="accent-amber-500" />
          <span>○ Against Item Master</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "purchase_pt"} onChange={() => onOptionModeChange("purchase_pt")} className="accent-amber-500" />
          <span>○ Against Purchase (PT File)</span>
        </label>

        {optionMode === "purchase_pt" && (
          <div className="pl-6 py-1 flex items-center gap-2">
            <span className="text-[10px] text-theme-muted">PT File:</span>
            <input 
              type="text" 
              value={ptFileName} 
              onChange={e => onPtFileNameChange(e.target.value)} 
              className="bg-theme-surface-2 border border-theme-divider rounded px-2 py-0.5 text-indigo-300 text-xs flex-1" 
            />
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "grn"} onChange={() => onOptionModeChange("grn")} className="accent-amber-500" />
          <span>○ Against GRN (Goods Receipt)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "purchase_return"} onChange={() => onOptionModeChange("purchase_return")} className="accent-amber-500" />
          <span>○ Against Purchase Return</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "sales"} onChange={() => onOptionModeChange("sales")} className="accent-amber-500" />
          <span>○ Against Sales (Invoice)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "sales_return"} onChange={() => onOptionModeChange("sales_return")} className="accent-amber-500" />
          <span>○ Against Sales Return</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "stock_transfer"} onChange={() => onOptionModeChange("stock_transfer")} className="accent-amber-500" />
          <span>○ Against Stock Transfer</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "production"} onChange={() => onOptionModeChange("production")} className="accent-amber-500" />
          <span>○ Against Production</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "physical_stock"} onChange={() => onOptionModeChange("physical_stock")} className="accent-amber-500" />
          <span>○ Against Physical Stock</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "batch"} onChange={() => onOptionModeChange("batch")} className="accent-amber-500" />
          <span>○ Against Batch</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "serial_number"} onChange={() => onOptionModeChange("serial_number")} className="accent-amber-500" />
          <span>○ Against Serial Number</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1 rounded hover:bg-theme-surface-2 text-theme-body">
          <input type="radio" name="opt_mode" checked={optionMode === "direct_scan"} onChange={() => onOptionModeChange("direct_scan")} className="accent-amber-500" />
          <span>○ Against Direct Scan</span>
        </label>
      </div>
    </div>
  );
};
