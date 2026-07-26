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
import { 
  Printer, Play, RotateCcw, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, Eye, ShieldCheck, RefreshCw 
} from "lucide-react";

export interface ActionToolbarProps {
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  activeIndex: number;
  totalFiltered: number;
  onClearCriteria: () => void;
  onPrintSelected: () => void;
  onPrintAll: () => void;
  onTestPrint?: () => void;
  labelsToPrintTotal: number;
  hasSelectedItem: boolean;
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  onFirst,
  onPrev,
  onNext,
  onLast,
  activeIndex,
  totalFiltered,
  onClearCriteria,
  onPrintSelected,
  onPrintAll,
  onTestPrint,
  labelsToPrintTotal,
  hasSelectedItem
}) => {
  return (
    <div className="bg-theme-surface-1 border border-amber-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-2xl font-mono select-none">
      {/* Navigation Controls: |< < > >| */}
      <div className="flex items-center gap-1">
        <button onClick={onFirst} disabled={totalFiltered === 0 || activeIndex === 0} className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
          <ChevronsLeft size={16} /> First
        </button>

        <button onClick={onPrev} disabled={totalFiltered === 0 || activeIndex === 0} className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
          <ChevronLeft size={16} /> Previous
        </button>

        <span className="px-3 py-2 bg-theme-surface-2 border border-amber-500/30 text-amber-300 font-bold text-xs rounded-xl">
          {totalFiltered > 0 ? `${activeIndex + 1} / ${totalFiltered}` : "0 / 0"}
        </span>

        <button onClick={onNext} disabled={totalFiltered === 0 || activeIndex >= totalFiltered - 1} className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
          Next <ChevronRight size={16} />
        </button>

        <button onClick={onLast} disabled={totalFiltered === 0 || activeIndex >= totalFiltered - 1} className="px-3 py-2 bg-theme-surface-2 border border-theme-divider hover:bg-theme-surface-hover text-theme-body rounded-xl font-bold disabled:opacity-30 text-xs flex items-center gap-1">
          Last <ChevronsRight size={16} />
        </button>
      </div>

      {/* Primary Action Buttons: Clear, Test Print, Print Selected, Print All */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onClearCriteria} 
          className="px-4 py-2 bg-theme-surface-3 hover:bg-theme-surface-hover text-theme-body font-bold rounded-xl text-xs flex items-center gap-1.5 border border-theme-divider shadow-md"
        >
          <RotateCcw size={14} /> Clear
        </button>

        {onTestPrint && (
          <button 
            onClick={onTestPrint} 
            className="px-4 py-2 bg-purple-950/60 hover:bg-purple-900/60 text-purple-300 font-bold rounded-xl text-xs border border-purple-800/40 flex items-center gap-1.5"
          >
            <RefreshCw size={13} /> Test Print
          </button>
        )}

        <button 
          onClick={onPrintSelected} 
          disabled={!hasSelectedItem} 
          className="px-5 py-2 bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg flex items-center gap-1.5 disabled:opacity-40"
        >
          <Printer size={15} /> Print Selected
        </button>

        <button 
          onClick={onPrintAll} 
          disabled={totalFiltered === 0} 
          className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-xl flex items-center gap-2 disabled:opacity-40"
        >
          <Play size={15} /> Print All ({labelsToPrintTotal} Labels)
        </button>
      </div>
    </div>
  );
};
