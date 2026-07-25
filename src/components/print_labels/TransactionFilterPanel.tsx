/**
 * Project      : SMRITI Retail OS
 * Repository   : SMRITIRetailNX
 * Organization : AITDL NETWORKS
 *
 * Version    : 3.37.0 (Contextual Transaction Filters Panel Sub-Component)
 * Created    : 2026-07-25
 * Copyright  : © AITDL.com and SMRITIBooks.com. All Rights Reserved.
 * License    : Proprietary Commercial Software
 */

import React from "react";
import { Filter, Calendar } from "lucide-react";
import { SelectionOptionMode } from "./SourceSelectionPanel.tsx";

export interface TransactionFilterState {
  docNoFrom: string;
  docNoTo: string;
  supplierCustomer: string;
  dateFrom: string;
  dateTo: string;
  warehouse: string;
  salesman: string;
}

export interface TransactionFilterPanelProps {
  optionMode: SelectionOptionMode;
  filters: TransactionFilterState;
  onFilterChange: (updated: TransactionFilterState) => void;
}

export const TransactionFilterPanel: React.FC<TransactionFilterPanelProps> = ({
  optionMode,
  filters,
  onFilterChange
}) => {
  // Only render if a transaction-based source is selected
  const isTransactionSource = ["purchase_pt", "grn", "sales", "purchase_return", "sales_return", "stock_transfer"].includes(optionMode);

  if (!isTransactionSource) return null;

  const isSales = optionMode === "sales" || optionMode === "sales_return";

  return (
    <div className="bg-[#141726] border border-amber-500/30 rounded-2xl p-3.5 space-y-2 shadow-xl font-mono text-xs">
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
        <Filter size={14} className="text-amber-400" />
        <span className="font-bold text-white uppercase text-[11px]">
          Contextual {optionMode.toUpperCase().replace("_", " ")} Transaction Filters
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
        {/* Document No Range */}
        <div>
          <span className="text-[9px] text-slate-400 block uppercase font-bold">{isSales ? "Invoice No From:" : "Doc / GRN No From:"}</span>
          <input 
            type="text" 
            value={filters.docNoFrom} 
            onChange={e => onFilterChange({ ...filters, docNoFrom: e.target.value })} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-amber-300 outline-none" 
            placeholder="INV-001" 
          />
        </div>

        <div>
          <span className="text-[9px] text-slate-400 block uppercase font-bold">{isSales ? "Invoice No To:" : "Doc / GRN No To:"}</span>
          <input 
            type="text" 
            value={filters.docNoTo} 
            onChange={e => onFilterChange({ ...filters, docNoTo: e.target.value })} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-amber-300 outline-none" 
            placeholder="INV-099" 
          />
        </div>

        {/* Supplier / Customer */}
        <div>
          <span className="text-[9px] text-slate-400 block uppercase font-bold">{isSales ? "Customer Name:" : "Supplier / Vendor:"}</span>
          <input 
            type="text" 
            value={filters.supplierCustomer} 
            onChange={e => onFilterChange({ ...filters, supplierCustomer: e.target.value })} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-indigo-300 outline-none" 
            placeholder="ALL" 
          />
        </div>

        {/* Warehouse */}
        <div>
          <span className="text-[9px] text-slate-400 block uppercase font-bold">Target Warehouse:</span>
          <input 
            type="text" 
            value={filters.warehouse} 
            onChange={e => onFilterChange({ ...filters, warehouse: e.target.value })} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-emerald-300 outline-none" 
            placeholder="MAIN WAREHOUSE" 
          />
        </div>

        {/* Date From */}
        <div>
          <span className="text-[9px] text-slate-400 block uppercase font-bold flex items-center gap-1">
            <Calendar size={10} /> Date From:
          </span>
          <input 
            type="date" 
            value={filters.dateFrom} 
            onChange={e => onFilterChange({ ...filters, dateFrom: e.target.value })} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none" 
          />
        </div>

        {/* Date To */}
        <div>
          <span className="text-[9px] text-slate-400 block uppercase font-bold flex items-center gap-1">
            <Calendar size={10} /> Date To:
          </span>
          <input 
            type="date" 
            value={filters.dateTo} 
            onChange={e => onFilterChange({ ...filters, dateTo: e.target.value })} 
            className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none" 
          />
        </div>

        {/* Salesman (Only for Sales) */}
        {isSales && (
          <div>
            <span className="text-[9px] text-slate-400 block uppercase font-bold">Salesman Code:</span>
            <input 
              type="text" 
              value={filters.salesman} 
              onChange={e => onFilterChange({ ...filters, salesman: e.target.value })} 
              className="w-full bg-[#0a0c14] border border-slate-800 rounded px-2 py-1 text-purple-300 outline-none" 
              placeholder="ALL" 
            />
          </div>
        )}
      </div>
    </div>
  );
};
