/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Quantity Strategy Panel Sub-Component - 6 Strategies)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React from "react";

export type LabelQuantityStrategy = 
  | "one_per_item" 
  | "stock_qty" 
  | "specified" 
  | "transaction_qty" 
  | "available_stock" 
  | "pack_qty";

export interface QuantityStrategyPanelProps {
  strategy: LabelQuantityStrategy;
  onStrategyChange: (strat: LabelQuantityStrategy) => void;
  copiesMultiplier: number;
  onCopiesMultiplierChange: (multiplier: number) => void;
  totalRecords: number;
  currentStockTotal: number;
  labelsToPrintTotal: number;
}

export const QuantityStrategyPanel: React.FC<QuantityStrategyPanelProps> = ({
  strategy,
  onStrategyChange,
  copiesMultiplier,
  onCopiesMultiplierChange,
  totalRecords,
  currentStockTotal,
  labelsToPrintTotal
}) => {
  return (
    <div className="bg-[#141726] border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl font-mono text-xs">
      <span className="text-xs font-bold text-white uppercase block border-b border-slate-800 pb-2">
        Labels To Print Quantity Strategy
      </span>

      <div className="grid grid-cols-2 gap-2 text-xs font-bold">
        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-slate-800">
          <input type="radio" name="labels_strat" checked={strategy === "one_per_item"} onChange={() => onStrategyChange("one_per_item")} className="accent-amber-500" />
          <span>One Label Per Item</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-slate-800">
          <input type="radio" name="labels_strat" checked={strategy === "stock_qty"} onChange={() => onStrategyChange("stock_qty")} className="accent-amber-500" />
          <span>Present Stock Qty</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-slate-800">
          <input type="radio" name="labels_strat" checked={strategy === "specified"} onChange={() => onStrategyChange("specified")} className="accent-amber-500" />
          <span>Enter Qty (Specified)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-slate-800">
          <input type="radio" name="labels_strat" checked={strategy === "transaction_qty"} onChange={() => onStrategyChange("transaction_qty")} className="accent-amber-500" />
          <span>Transaction Qty</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-slate-800">
          <input type="radio" name="labels_strat" checked={strategy === "available_stock"} onChange={() => onStrategyChange("available_stock")} className="accent-amber-500" />
          <span>Available Stock</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded bg-[#0a0c14] border border-slate-800">
          <input type="radio" name="labels_strat" checked={strategy === "pack_qty"} onChange={() => onStrategyChange("pack_qty")} className="accent-amber-500" />
          <span>Pack Quantity</span>
        </label>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-800">
        <span className="text-[11px] text-slate-400 font-bold">Copies Multiplier:</span>
        <input 
          type="number" 
          min={1} 
          max={100} 
          value={copiesMultiplier} 
          onChange={e => onCopiesMultiplierChange(Math.max(1, parseInt(e.target.value) || 1))} 
          className="bg-[#0a0c14] border border-slate-800 rounded px-2 py-0.5 text-amber-300 w-16 text-center font-bold" 
        />
      </div>

      {/* Summary Metrics Cards */}
      <div className="bg-[#0a0c14] border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <span className="text-[9px] text-slate-500 uppercase block font-bold">Total Records</span>
          <span className="text-sm font-bold text-amber-300">{totalRecords}</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase block font-bold">Current Stock</span>
          <span className="text-sm font-bold text-indigo-300">{currentStockTotal}</span>
        </div>
        <div>
          <span className="text-[9px] text-slate-500 uppercase block font-bold">Labels To Print</span>
          <span className="text-sm font-bold text-emerald-400">{labelsToPrintTotal}</span>
        </div>
      </div>
    </div>
  );
};
