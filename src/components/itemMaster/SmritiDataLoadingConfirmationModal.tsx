/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 5.2.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 * Classification: Internal
 */

import React from "react";
import { HelpCircle, Database, Filter, Check, X } from "lucide-react";

interface SmritiDataLoadingConfirmationModalProps {
  isOpen: boolean;
  onConfirm: (loadAll: boolean) => void;
  totalRecordsCount: number;
}

export const SmritiDataLoadingConfirmationModal: React.FC<SmritiDataLoadingConfirmationModalProps> = ({
  isOpen,
  onConfirm,
  totalRecordsCount
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 font-sans select-none animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[#131b2e] border border-[#c6c6cd] dark:border-[#45464d] rounded-xl shadow-2xl w-full max-w-md overflow-hidden text-[#191c1e] dark:text-[#eff1f3]">
        
        {/* Header */}
        <div className="p-4 border-b border-[#eceef0] dark:border-[#2d3133] bg-[#f2f4f6] dark:bg-[#191c1e] flex items-center gap-2">
          <HelpCircle size={20} className="text-[#0052cc]" />
          <h3 className="text-sm font-bold">Data Loading Confirmation</h3>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <p className="text-sm font-medium text-[#191c1e] dark:text-white leading-relaxed">
            Do you want to display all <strong>{totalRecordsCount}</strong> item records in the Item Details grid?
          </p>
          
          <div className="p-3 bg-[#e9edff] dark:bg-[#1d3054] border border-[#c4d2ff] dark:border-[#434654] rounded-lg space-y-2 text-[11px] text-[#003d9b] dark:text-[#b2c5ff]">
            <p><strong>• Yes:</strong> Loads all item records directly into the grid matrix.</p>
            <p><strong>• No:</strong> Opens a blank workspace where you can apply specific Category or Brand filters before loading.</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[#eceef0] dark:border-[#2d3133] bg-[#f2f4f6] dark:bg-[#191c1e] flex justify-end gap-3">
          <button
            type="button"
            onClick={() => onConfirm(false)}
            className="px-4 py-2 border border-[#c6c6cd] dark:border-[#45464d] bg-white dark:bg-[#2d3133] hover:bg-[#eceef0] rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Filter size={14} className="text-[#0052cc]" />
            No (Apply Filter First)
          </button>
          <button
            type="button"
            onClick={() => onConfirm(true)}
            className="px-5 py-2 bg-[#0052cc] hover:bg-[#003d9b] text-white rounded text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
          >
            <Check size={14} />
            Yes (Load All Records)
          </button>
        </div>

      </div>
    </div>
  );
};

export default SmritiDataLoadingConfirmationModal;
