/**
 * Project      : SMRITI Retail OS
 * Author       : Jawahar Ramkripal Mallah
 * Designation  : Chief Systems Architect & Creator
 * Email        : support@smritibooks.com
 * Websites     : smritibooks.com | erpnbook.com | aitdl.com
 * Version      : 3.29.0
 * Created      : 2026-08-21
 * Modified     : 2026-08-21
 * Copyright    : © SMRITIBooks.com. All Rights Reserved.
 * License      : Proprietary Commercial Software
 */

import React from "react";
import { HelpCircle, X } from "lucide-react";

interface ItemMasterSaveWarningModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ItemMasterSaveWarningModal: React.FC<ItemMasterSaveWarningModalProps> = ({
  isOpen,
  message,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#F0F0F0] dark:bg-slate-800 border border-slate-400 dark:border-slate-700 shadow-2xl w-[500px] max-w-[92vw] flex flex-col font-sans rounded-none overflow-hidden">
        {/* Modal Title Bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 px-4 py-2 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Item Master Entry — Confirmation
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-500 hover:text-red-600 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 flex items-start gap-4 bg-white dark:bg-slate-900/90">
          <div className="bg-blue-800 text-white rounded-full p-2 flex items-center justify-center shrink-0 shadow-sm">
            <HelpCircle size={28} />
          </div>
          <div className="pt-0.5">
            <p className="text-xs leading-relaxed text-slate-800 dark:text-slate-200">
              {message}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F0F0F0] dark:bg-slate-800 p-4 border-t border-slate-300 dark:border-slate-700 flex justify-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="px-6 py-1.5 bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600 transition min-w-[90px] text-xs font-bold shadow-xs"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-1.5 bg-white dark:bg-slate-700 border border-slate-400 dark:border-slate-600 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-600 transition min-w-[90px] text-xs font-bold shadow-xs"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};
